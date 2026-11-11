/* ==========================================================================
   Firmitas — moteur de vérification NF EN 1993-1-1 (+ AN française)
   Poutres et barres en acier : I laminés ou soudés, tubes rectangulaires et ronds.
   Unités internes : N, mm, MPa. Entrées : kN, m.
   Convention : N > 0 en compression. Charges positives vers le bas (z) / +y.
   Fonction pure : FirmitasEC3.compute(state) → résultats.
   ========================================================================== */
(function () {
  'use strict';
  const D = window.FIRMITAS_DATA, GEO = window.FirmitasGeom;
  const E = D.E, Gs = D.Gs, PI = Math.PI;
  const num = (v, d = 0) => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(x) ? x : d; };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  const CRITERIA = {
    N: { label: 'Effort normal', ref: '6.2.3 / 6.2.4', f: 'N_Ed / N_Rd' },
    Vz: { label: 'Cisaillement V_z', ref: '6.2.6 (6.17)', f: 'V_z,Ed / V_pl,z,Rd' },
    Vy: { label: 'Cisaillement V_y', ref: '6.2.6 (6.17)', f: 'V_y,Ed / V_pl,y,Rd' },
    My: { label: 'Flexion M_y (avec V_z)', ref: '6.2.5 / 6.2.8', f: 'M_y,Ed / M_y,V,Rd' },
    Mz: { label: 'Flexion M_z (avec V_y)', ref: '6.2.5 / 6.2.8', f: 'M_z,Ed / M_z,V,Rd' },
    NMV: { label: 'Flexion composée, déviée (N + M_y + M_z + V)', ref: '6.2.9 / 6.2.10', f: '(M_y/M_N,y)^α + (M_z/M_N,z)^β  ou  Σ σ / f_y' },
    Fb: { label: 'Flambement', ref: '6.3.1 (6.46)', f: 'N_Ed / N_b,Rd' },
    LT: { label: 'Déversement', ref: '6.3.2 (6.54)', f: 'M_y,Ed / M_b,Rd' },
    I1: { label: 'Flexion composée avec instabilité — axe y', ref: '6.3.3 (6.61)', f: 'N/(χ_y·N_Rk) + k_yy·M_y/(χ_LT·M_y,Rk) + k_yz·M_z/M_z,Rk' },
    I2: { label: 'Flexion composée avec instabilité — axe z', ref: '6.3.3 (6.62)', f: 'N/(χ_z·N_Rk) + k_zy·M_y/(χ_LT·M_y,Rk) + k_zz·M_z/M_z,Rk' }
  };
  const SEC_KEYS = ['N', 'Vz', 'Vy', 'My', 'Mz', 'NMV'], MEM_KEYS = ['Fb', 'LT', 'I1', 'I2'];

  // ======================================================================
  //  Section
  // ======================================================================
  function sectionOf(s) {
    const c = s.sec || {};
    if (c.kind === 'prs') {
      const p = c.prs, h = num(p.h), b = num(p.b), tw = num(p.tw), tf = num(p.tf);
      if (!(h > 2 * tf && b > tw && tw > 0 && tf > 0)) return null;
      return GEO.iSection(`PRS ${h} × ${b} × ${tw} × ${tf}`, h, b, tw, tf, 0, 'welded');
    }
    if (c.kind === 'tube') {
      const p = c.tube, t = num(p.t);
      if (p.shape === 'chs') { const d = num(p.d); return d > 2 * t && t > 0 ? GEO.chs(d, t, c.fab) : null; }
      const h = num(p.h), b = num(p.b);
      return h > 3 * t && b > 3 * t && t > 0 ? GEO.rhs(h, b, t, c.fab) : null;
    }
    return D.findSection(c.fam, c.name, c.fab);
  }

  // ---------- classification (tableau 5.2) ----------
  const clsOf = (ct, lim) => (ct <= lim[0] ? 1 : ct <= lim[1] ? 2 : ct <= lim[2] ? 3 : 4);
  function internal(ct, eps, mode, alpha, psi) {
    let lim;
    if (mode === 'none') return { ct, mode, cls: 1, lim: null };
    if (mode === 'comp') lim = [33 * eps, 38 * eps, 42 * eps];
    else if (mode === 'bend') lim = [72 * eps, 83 * eps, 124 * eps];
    else {
      if (alpha <= 0) return { ct, mode: 'none', cls: 1, lim: null, alpha };
      lim = [alpha > 0.5 ? 396 * eps / (13 * alpha - 1) : 36 * eps / alpha,
        alpha > 0.5 ? 456 * eps / (13 * alpha - 1) : 41.5 * eps / alpha,
        psi > -1 ? 42 * eps / (0.67 + 0.33 * psi) : 62 * eps * (1 - psi) * Math.sqrt(-psi)];
      lim[1] = Math.max(lim[1], lim[0]); lim[2] = Math.max(lim[2], lim[1]);
    }
    return { ct, mode, cls: clsOf(ct, lim), lim, alpha, psi };
  }
  // N > 0 : compression. Classe sous le torseur (N, My, Mz).
  function classify(S, fy, N, My, Mz) {
    const eps = Math.sqrt(235 / fy);
    const hasMy = Math.abs(My) > 1e-6 * S.Wely * fy, hasMz = Math.abs(Mz) > 1e-6 * S.Welz * fy, comp = N > 1e-9 * S.A * fy;
    const any = hasMy || hasMz || comp;
    const psi = clamp(2 * N / (S.A * fy) - 1, -3, 1);
    let web, flange;
    if (S.type === 'CHS') {
      const lim = [50 * eps * eps, 70 * eps * eps, 90 * eps * eps], ct = S.d / S.t;
      web = { ct, mode: any ? 'tube' : 'none', cls: any ? clsOf(ct, lim) : 1, lim };
      return { cls: web.cls, web, flange: null, eps };
    }
    if (S.type === 'I') {
      const ctf = S.cf / S.tf, limf = [9 * eps, 10 * eps, 14 * eps];
      flange = { ct: ctf, mode: any ? 'out' : 'none', cls: any ? clsOf(ctf, limf) : 1, lim: limf };
      const ct = S.cw / S.tw;
      if (!hasMy) web = internal(ct, eps, comp ? 'comp' : 'none');
      else if (Math.abs(N) < 1e-9 * S.A * fy) web = internal(ct, eps, 'bend');
      else web = internal(ct, eps, 'nm', clamp(0.5 * (1 + N / (S.cw * S.tw * fy)), 0, 1), psi);
    } else {
      const wall = (c, own, other) => {
        const ct = c / S.t;
        if (other) return internal(ct, eps, 'comp');
        if (own) return Math.abs(N) < 1e-9 * S.A * fy ? internal(ct, eps, 'bend') : internal(ct, eps, 'nm', clamp(0.5 * (1 + N / (2 * c * S.t * fy)), 0, 1), psi);
        return internal(ct, eps, comp ? 'comp' : 'none');
      };
      web = wall(S.cw, hasMy, hasMz);        // parois de hauteur h
      flange = wall(S.cf, hasMz, hasMy);     // parois de largeur b
    }
    return { cls: Math.max(web.cls, flange.cls), web, flange, eps };
  }

  // Aire efficace en compression uniforme (EN 1993-1-5 § 4.4) — sections de classe 4
  function aeff(S, fy) {
    if (S.type === 'CHS') return null;
    const eps = Math.sqrt(235 / fy);
    const rin = (ct) => { const lp = ct / (28.4 * eps * 2); return lp <= 0.673 ? 1 : Math.min(1, (lp - 0.22) / (lp * lp)); };
    const rout = (ct) => { const lp = ct / (28.4 * eps * Math.sqrt(0.43)); return lp <= 0.748 ? 1 : Math.min(1, (lp - 0.188) / (lp * lp)); };
    if (S.type === 'I') {
      const rw = rin(S.cw / S.tw), rf = rout(S.cf / S.tf);
      return { A: S.A - (1 - rw) * S.cw * S.tw - 4 * (1 - rf) * S.cf * S.tf, rw, rf };
    }
    const rw = rin(S.cw / S.t), rf = rin(S.cf / S.t);
    return { A: S.A - 2 * (1 - rw) * S.cw * S.t - 2 * (1 - rf) * S.cf * S.t, rw, rf };
  }

  // Propriétés de résistance indépendantes du torseur
  function prepare(S, fy) {
    const cN = classify(S, fy, 1e-3 * S.A * fy, 0, 0);
    const cMy = classify(S, fy, 0, S.Wely * fy, 0), cMz = classify(S, fy, 0, 0, S.Welz * fy);
    const ae = cN.cls === 4 ? aeff(S, fy) : null;
    return { fy, eps: cN.eps, cN, cMy, cMz, Aeff: ae ? ae.A : S.A, ae, Ac: cN.cls === 4 && ae ? ae.A : S.A };
  }

  // ======================================================================
  //  Résistance des sections (6.2) — efforts en N, N·mm, N > 0 compression
  // ======================================================================
  function sectionCheck(S, P, g0, F) {
    const fy = P.fy, fyd = fy / g0;
    const N = F.N, aN = Math.abs(N), My = Math.abs(F.My), Mz = Math.abs(F.Mz);
    let Vz = Math.abs(F.Vz), Vy = Math.abs(F.Vy);
    const cl = classify(S, fy, N, F.My, F.Mz);
    const cls = cl.cls;
    const o = { cl, cls, r: {} };
    const Vplz = S.Avz * fyd / Math.sqrt(3), Vply = S.Avy * fyd / Math.sqrt(3);
    const rho = (V, Vpl) => (V > 0.5 * Vpl ? Math.min(1, Math.pow(2 * V / Vpl - 1, 2)) : 0);
    const Ac = cls === 4 ? P.Ac : S.A;
    const Npl = S.A * fyd, NcRd = Ac * fyd;
    o.Npl = Npl; o.NcRd = NcRd; o.Vplz = Vplz; o.Vply = Vply;
    o.r.N = aN / (N > 0 ? NcRd : Npl);

    if (S.type === 'CHS') {
      const V = Math.hypot(Vz, Vy), M = Math.hypot(My, Mz), r = rho(V, Vplz);
      o.rhoz = o.rhoy = r;
      o.r.Vz = V / Vplz; o.r.Vy = 0;
      const W = cls <= 2 ? S.Wply : S.Wely;
      const MV = W * fyd * (1 - r);
      o.MyRd = o.MzRd = MV; o.Mres = M; o.Vres = V;
      o.r.My = MV > 0 ? M / MV : (M > 0 ? Infinity : 0); o.r.Mz = 0;
      const NV = S.A * (1 - r * 2 / PI) * fyd, n = aN / NV;
      o.n = n;
      if (cls <= 2) { o.MNy = o.MNz = n < 1 ? MV * (1 - Math.pow(n, 1.7)) : 0; o.r.NMV = n >= 1 ? n : (M > 0 ? M / o.MNy : 0); o.alpha = o.beta = null; }
      else o.r.NMV = aN / ((N > 0 ? Ac : S.A) * fyd) + (MV > 0 ? M / MV : (M > 0 ? Infinity : 0));
      o.r.NMV = Math.max(o.r.NMV, o.r.N);
      return o;
    }

    const rz = rho(Vz, Vplz), ry = rho(Vy, Vply);
    o.rhoz = rz; o.rhoy = ry;
    o.r.Vz = Vz / Vplz; o.r.Vy = Vy / Vply;
    const isI = S.type === 'I';
    if (cls <= 2) {
      let MyV, MzV, NV, MNy, MNz, al, be;
      if (isI) {
        const Aw = S.hw * S.tw;
        MyV = Math.max(0, S.Wply - rz * Aw * Aw / (4 * S.tw)) * fyd;
        MzV = Math.max(0, S.Wplz - ry * S.tf * S.b * S.b / 2) * fyd;
        NV = Math.max(1e-9, S.A - rz * Aw - ry * 2 * S.b * S.tf) * fyd;
      } else {
        MyV = Math.max(0, S.Wply - rz * 2 * S.t * Math.pow(S.h - 2 * S.t, 2) / 4) * fyd;
        MzV = Math.max(0, S.Wplz - ry * 2 * S.t * Math.pow(S.b - 2 * S.t, 2) / 4) * fyd;
        NV = Math.max(1e-9, S.A - rz * 2 * (S.h - 2 * S.t) * S.t - ry * 2 * (S.b - 2 * S.t) * S.t) * fyd;
      }
      const n = aN / NV;
      if (isI) {
        const a = Math.min((S.A - 2 * S.b * S.tf) / S.A, 0.5);
        MNy = MyV * Math.min(1, Math.max(0, (1 - n) / (1 - 0.5 * a)));
        MNz = n <= a ? MzV : MzV * Math.max(0, 1 - Math.pow((n - a) / (1 - a), 2));
        al = 2; be = Math.max(1, 5 * n);
        o.a = a;
      } else {
        const aw = Math.min((S.A - 2 * S.b * S.t) / S.A, 0.5), af = Math.min((S.A - 2 * S.h * S.t) / S.A, 0.5);
        MNy = MyV * Math.min(1, Math.max(0, (1 - n) / (1 - 0.5 * aw)));
        MNz = MzV * Math.min(1, Math.max(0, (1 - n) / (1 - 0.5 * af)));
        const dd = 1 - 1.13 * n * n;
        al = be = dd > 0 ? Math.min(6, 1.66 / dd) : 6;
        o.a = aw; o.af = af;
      }
      Object.assign(o, { MyRd: MyV, MzRd: MzV, NV, n, MNy, MNz, alpha: al, beta: be });
      const q = (M, R) => (M <= 0 ? 0 : R > 0 ? M / R : Infinity);
      o.r.My = q(My, MyV); o.r.Mz = q(Mz, MzV);
      o.r.NMV = n >= 1 ? n : Math.pow(q(My, MNy), al) + Math.pow(q(Mz, MNz), be);
      if (My > 0 && Mz <= 0) o.r.NMV = n >= 1 ? n : q(My, MNy);      // flexion simple : taux linéaire, plus lisible
      if (Mz > 0 && My <= 0) o.r.NMV = n >= 1 ? n : q(Mz, MNz);
    } else {
      const MyV = S.Wely * fyd * (1 - rz), MzV = S.Welz * fyd * (1 - ry);
      const q = (M, R) => (M <= 0 ? 0 : R > 0 ? M / R : Infinity);
      Object.assign(o, { MyRd: MyV, MzRd: MzV, n: aN / Npl });
      o.r.My = q(My, MyV); o.r.Mz = q(Mz, MzV);
      o.r.NMV = aN / ((N > 0 ? Ac : S.A) * fyd) + o.r.My + o.r.Mz;      // (6.2), (6.42)–(6.44) avec e_N = 0
    }
    o.r.NMV = Math.max(o.r.NMV, 0);
    return o;
  }

  // ======================================================================
  //  Instabilités (6.3)
  // ======================================================================
  function curves(S, grade) {
    const hi = grade === 'S460';
    if (S.type === 'I') {
      if (S.fab === 'welded') return S.tf <= 40 ? { y: 'b', z: 'c' } : { y: 'c', z: 'd' };
      if (S.h / S.b > 1.2) return S.tf <= 40 ? { y: hi ? 'a0' : 'a', z: hi ? 'a0' : 'b' } : { y: hi ? 'a' : 'b', z: hi ? 'a' : 'c' };
      return S.tf <= 100 ? { y: hi ? 'a' : 'b', z: hi ? 'a' : 'c' } : { y: hi ? 'c' : 'd', z: hi ? 'c' : 'd' };
    }
    const c = S.fab === 'cold' ? 'c' : hi ? 'a0' : 'a';
    return { y: c, z: c };
  }
  function ltCurve(S) {
    if (S.type !== 'I') return 'd';
    const slim = S.h / S.b > 2;
    return S.fab === 'welded' ? (slim ? 'd' : 'c') : (slim ? 'b' : 'a');
  }
  function chi(lam, alpha) {
    if (!(lam > 0.2)) return { phi: 0.5 * (1 + alpha * (lam - 0.2) + lam * lam), chi: 1 };
    const phi = 0.5 * (1 + alpha * (lam - 0.2) + lam * lam);
    return { phi, chi: Math.min(1, 1 / (phi + Math.sqrt(Math.max(0, phi * phi - lam * lam)))) };
  }
  function mcr(S, L, k, kw, C1, C2, zg) {
    if (!(L > 0)) return Infinity;
    const kL = k * L, a = PI * PI * E * S.Iz / (kL * kL);
    const c2 = C2 * zg;
    return C1 * a * (Math.sqrt(Math.pow(k / kw, 2) * S.Iw / S.Iz + kL * kL * Gs * S.It / (PI * PI * E * S.Iz) + c2 * c2) - c2);
  }
  // Facteur de moment uniforme équivalent, tableau B.3. M1, M2 : moments d'extrémité, Ms : moment à mi-longueur (signés).
  function cmB3(M1, Ms, M2, load, linear) {
    const a1 = Math.abs(M1), a2 = Math.abs(M2);
    const Mh = a1 >= a2 ? M1 : M2, Mo = a1 >= a2 ? M2 : M1;
    const tol = 1e-9 * Math.max(a1, a2, Math.abs(Ms), 1e-30);
    if (Math.abs(Mh) <= tol && Math.abs(Ms) <= tol) return { cm: 1, kind: '—' };
    const psi = Math.abs(Mh) > tol ? clamp(Mo / Mh, -1, 1) : 0;
    if (linear || Math.abs(Ms - (M1 + M2) / 2) <= 1e-6 * Math.max(a1, a2, Math.abs(Ms))) return { cm: Math.max(0.4, 0.6 + 0.4 * psi), psi, kind: 'linéaire' };
    const C = load === 'C';
    let cm;
    if (Math.abs(Ms) <= Math.abs(Mh)) {
      const as = Ms / Mh;
      if (as >= 0) cm = 0.2 + 0.8 * as;
      else if (psi >= 0) cm = C ? -0.8 * as : 0.1 - 0.8 * as;
      else cm = C ? 0.2 * (-psi) - 0.8 * as : 0.1 * (1 - psi) - 0.8 * as;
      return { cm: Math.max(0.4, cm), psi, as, kind: 'αs' };
    }
    const ah = Mh / Ms;
    if (ah >= 0 || psi >= 0) cm = C ? 0.90 + 0.10 * ah : 0.95 + 0.05 * ah;
    else cm = C ? 0.90 + 0.10 * ah * (1 + 2 * psi) : 0.95 + 0.05 * ah * (1 + 2 * psi);
    return { cm: Math.max(0.4, cm), psi, ah, kind: 'αh' };
  }

  /* diag : { N, My:[M(0),M(L/4),M(L/2),M(3L/4),M(L)], Mz:[…], Mymax, Mzmax, loadY:'U'|'C'|null (charges dans le plan fort), loadZ }
     stab : { Lcry, Lcrz, LLT (mm), k, kw, zg, C1, C2 (null = auto), restrained, sway, bc } */
  function memberCheck(S, P, grade, g1, diag, stab) {
    const fy = P.fy;
    const Nc = Math.max(0, diag.N);
    const cl = classify(S, fy, diag.N, diag.Mymax, diag.Mzmax);
    const cls = cl.cls;
    const Ac = Nc > 0 && cls === 4 ? P.Ac : S.A;
    const NRk = Ac * fy;
    const Wy = cls <= 2 ? S.Wply : S.Wely, Wz = cls <= 2 ? S.Wplz : S.Welz;
    const MyRk = Wy * fy, MzRk = Wz * fy;
    const cv = curves(S, grade);
    const ax = (I, Lcr, c) => {
      const Ncr = Lcr > 0 ? PI * PI * E * I / (Lcr * Lcr) : Infinity;
      const lam = Lcr > 0 ? Math.sqrt(Ac * fy / Ncr) : 0;
      const x = chi(lam, D.ALPHA[c]);
      return { Lcr, Ncr, lam, curve: c, alpha: D.ALPHA[c], phi: x.phi, chi: x.chi, NbRd: x.chi * Ac * fy / g1 };
    };
    const y = ax(S.Iy, stab.Lcry, cv.y), z = ax(S.Iz, stab.Lcrz, cv.z);

    // --- déversement
    const lt = { L: stab.LLT, k: stab.k, kw: stab.kw, zg: stab.zg };
    const m = diag.My, Mmax = Math.max(Math.abs(m[0]), Math.abs(m[1]), Math.abs(m[2]), Math.abs(m[3]), Math.abs(m[4]), Math.abs(diag.Mymax));
    const single = stab.LLT >= stab.L * 0.999 && stab.bc !== 'c';
    let C1a = 1;
    if (single && Mmax > 0) C1a = clamp(12.5 * Mmax / (2.5 * Mmax + 3 * Math.abs(m[1]) + 4 * Math.abs(m[2]) + 3 * Math.abs(m[3])), 1, 2.6);
    lt.C1auto = C1a; lt.C1 = stab.C1 != null ? stab.C1 : C1a;
    const c2tab = (D.BC[stab.bc] || D.BC.aa).C2;
    lt.C2auto = diag.loadY ? c2tab[diag.loadY === 'C' ? 1 : 0] : 0;
    lt.C2 = stab.C2 != null ? stab.C2 : lt.C2auto;
    lt.curve = ltCurve(S); lt.alpha = D.ALPHA[lt.curve];
    if (S.type === 'CHS') { lt.skip = 'tube rond : non sujet au déversement'; lt.chi = 1; lt.lam = 0; lt.Mcr = Infinity; }
    else if (stab.restrained || !(stab.LLT > 0)) { lt.skip = 'semelle comprimée maintenue en continu'; lt.chi = 1; lt.lam = 0; lt.Mcr = Infinity; }
    else {
      lt.Mcr = mcr(S, stab.LLT, stab.k, stab.kw, lt.C1, S.type === 'I' ? lt.C2 : 0, S.type === 'I' ? stab.zg : 0);
      lt.lam = Math.sqrt(MyRk / lt.Mcr);
      const x = chi(lt.lam, lt.alpha);
      lt.phi = x.phi; lt.chi = x.chi;
      if (S.type === 'RHS' && lt.lam <= 0.4) { lt.chi = 1; lt.skip = 'tube : λ̄_LT ≤ 0,4, déversement négligé (6.3.2.2(4))'; }
    }
    lt.MbRd = lt.chi * MyRk / g1;
    const sens = S.type === 'I' && !(stab.restrained || !(stab.LLT > 0));

    // --- facteurs Cm (tableau B.3) et k_ij (annexe B, méthode 2)
    const sway = stab.sway || stab.bc === 'c';
    const cmy = sway ? { cm: 0.9, kind: 'nœuds déplaçables' } : cmB3(m[0], m[2], m[4], diag.loadY, !diag.loadY);
    const mz = diag.Mz;
    const cmz = sway ? { cm: 0.9, kind: 'nœuds déplaçables' } : cmB3(mz[0], mz[2], mz[4], diag.loadZ, !diag.loadZ);
    const cmLT = cmy;
    const ny = Nc / (y.chi * NRk / g1), nz = Nc / (z.chi * NRk / g1);
    const ly = Math.min(y.lam, 1), lz = Math.min(z.lam, 1);
    let kyy, kzz, kyz, kzy;
    if (cls <= 2) {
      kyy = cmy.cm * (1 + (ly - 0.2) * ny);
      kzz = S.type === 'I' ? cmz.cm * (1 + (2 * lz - 0.6) * nz) : cmz.cm * (1 + (lz - 0.2) * nz);
      kyz = 0.6 * kzz;
      if (!sens) kzy = 0.6 * kyy;
      else {
        const d = Math.max(cmLT.cm - 0.25, 0.15);
        kzy = z.lam >= 0.4 ? 1 - 0.1 * lz * nz / d : Math.min(0.6 + z.lam, 1 - 0.1 * z.lam * nz / d);
      }
    } else {
      kyy = cmy.cm * (1 + 0.6 * ly * ny);
      kzz = cmz.cm * (1 + 0.6 * lz * nz);
      kyz = kzz;
      kzy = !sens ? 0.8 * kyy : 1 - 0.05 * lz * nz / Math.max(cmLT.cm - 0.25, 0.15);
    }
    const My = Math.abs(diag.Mymax), Mz = Math.abs(diag.Mzmax);
    const r = {};
    r.Fb = Nc > 0 ? Nc / Math.min(y.NbRd, z.NbRd) : 0;
    r.LT = My / lt.MbRd;
    r.I1 = ny + kyy * My / (lt.chi * MyRk / g1) + kyz * Mz / (MzRk / g1);
    r.I2 = nz + kzy * My / (lt.chi * MyRk / g1) + kzz * Mz / (MzRk / g1);
    return { cl, cls, NRk, MyRk, MzRk, y, z, lt, sens, cmy, cmz, cmLT, ny, nz, kyy, kyz, kzy, kzz, My, Mz, N: diag.N, r };
  }

  // ======================================================================
  //  Analyse de la poutre à une travée (kN, m)
  // ======================================================================
  // q : charge répartie sur toute la travée ; P : charge ponctuelle à l'abscisse a.
  // Appuyée–encastrée : appui simple à gauche, encastrement à droite. Console : encastrée à gauche.
  function beamCase(L, bc, q, P, a) {
    a = clamp(a, 0, L);
    const b = L - a;
    let MA = 0, MB = 0;            // moments d'extrémité, positifs s'ils tendent la fibre inférieure
    if (bc === 'ee') { MA = -(q * L * L / 12 + P * a * b * b / (L * L)); MB = -(q * L * L / 12 + P * a * a * b / (L * L)); }
    else if (bc === 'ae') MB = -(q * L * L / 8 + P * a * (L * L - a * a) / (2 * L * L));
    else if (bc === 'c') MA = -(q * L * L / 2 + P * a);
    const RA = (MB - MA) / L + q * L / 2 + P * b / L;
    const M = (x) => MA + RA * x - q * x * x / 2 - (x > a ? P * (x - a) : 0);
    const V = (x, side) => RA - q * x - ((side > 0 ? x >= a : x > a) ? P : 0);
    return { L, bc, q, P, a, MA, MB, RA, RB: q * L + P - RA, M, V };
  }
  // EI·w(x) [kN·m³] sur n intervalles : EI·w'' = −M
  function deflection(c, n) {
    const h = c.L / n, T1 = new Float64Array(n + 1), T2 = new Float64Array(n + 1), w = new Float64Array(n + 1);
    let m0 = c.M(0);
    for (let i = 1; i <= n; i++) {
      const m1 = c.M(i * h);
      T1[i] = T1[i - 1] + (m0 + m1) * h / 2;
      T2[i] = T2[i - 1] + (T1[i - 1] + T1[i]) * h / 2 - (m1 - m0) * h * h / 12;       // correction d'ordre supérieur (M linéaire par morceaux)
      m0 = m1;
    }
    const th = c.bc === 'c' ? 0 : T2[n] / c.L;
    for (let i = 0; i <= n; i++) w[i] = th * i * h - T2[i];
    return w;
  }

  // ======================================================================
  //  Calcul complet
  // ======================================================================
  function compute(s) {
    const R = { valid: true, warnings: [], combos: [], env: null, sls: { rows: [], max: 0 }, freq: null };
    const S = sectionOf(s);
    R.S = S;
    const L = num(s.L);
    if (!S || !(L > 0)) { R.valid = false; R.warnings.push(!S ? 'Section invalide : vérifier les dimensions.' : 'Longueur nulle.'); if (!S) return R; }
    const st = s.steel || {};
    const grade = st.grade || 'S355';
    const fy = st.fyMode === 'custom' && num(st.fyCustom) > 0 ? num(st.fyCustom) : D.fyOf(grade, S.t, st.fyMode);
    const g0 = num(st.gM0, 1) || 1, g1 = num(st.gM1, 1) || 1;
    const P = prepare(S, fy);
    Object.assign(R, { grade, fy, g0, g1, P, L, bc: s.bc, mode: s.mode });
    R.curves = curves(S, grade);
    R.pp = S.G * 9.81 / 1000;                          // kN/m

    // --- longueurs d'instabilité
    const sb = s.stab || {}, lk = sb.link || {};
    const auto = s.bc === 'c' ? 2 * L : L;
    const Lcry = (lk.Lcry !== false ? auto : num(sb.Lcry)) * 1000;
    const Lcrz = (lk.Lcrz !== false ? auto : num(sb.Lcrz)) * 1000;
    const LLT = (lk.LLT !== false ? auto : num(sb.LLT)) * 1000;
    const zg = sb.zgMode === 'centre' ? 0 : sb.zgMode === 'bottom' ? -S.h / 2 : sb.zgMode === 'custom' ? num(sb.zg) : S.h / 2;
    const stab = {
      L: L * 1000, bc: s.bc, Lcry, Lcrz, LLT, k: num(sb.k, 1) || 1, kw: num(sb.kw, 1) || 1, zg,
      C1: sb.C1mode === 'manual' && num(sb.C1) > 0 ? num(sb.C1) : null,
      C2: sb.C1mode === 'manual' ? num(sb.C2) : null,
      restrained: !!sb.restrained, sway: !!sb.sway
    };
    R.stab = stab;
    if (P.cMy.cls === 4 || (S.type === 'CHS' && P.cN.cls === 4)) {
      R.valid = false;
      R.warnings.push(S.type === 'CHS' ? 'Tube rond de classe 4 (d/t > 90ε²) : hors du champ de l\'EN 1993-1-1 (voir EN 1993-1-6).' : 'Section de classe 4 en flexion simple : module efficace W_eff non calculé par Firmitas (EN 1993-1-5).');
    }
    const epsw = Math.sqrt(235 / fy);
    if (S.type !== 'CHS' && S.hw / S.tw > 72 * epsw) R.warnings.push(`Âme élancée : h_w/t_w = ${(S.hw / S.tw).toFixed(1)} > 72ε = ${(72 * epsw).toFixed(1)} — résistance au voilement par cisaillement à vérifier (EN 1993-1-5 § 5).`);
    if (!R.valid && !(L > 0)) return R;

    const gam = s.gam || {};
    const gGs = num(gam.Gsup, 1.35), gGi = num(gam.Ginf, 1), gQ = num(gam.Q, 1.5);
    const combos = [];

    if (s.mode === 'direct') {
      const d = s.direct || {};
      const a3 = (v) => [num(v && v[0]), num(v && v[1]), num(v && v[2])];
      const my = a3(d.My), mz = a3(d.Mz);
      const quarter = (m) => [m[0], 0.375 * m[0] + 0.75 * m[1] - 0.125 * m[2], m[1], -0.125 * m[0] + 0.75 * m[1] + 0.375 * m[2], m[2]];
      const lin = (m) => Math.abs(m[1] - (m[0] + m[2]) / 2) <= 1e-6 * Math.max(Math.abs(m[0]), Math.abs(m[1]), Math.abs(m[2]), 1e-12);
      const N = num(d.N) * 1e3, Vz = num(d.Vz) * 1e3, Vy = num(d.Vy) * 1e3;
      const xs = [0, L / 2, L];
      combos.push({
        id: 'ELU', label: 'Sollicitations de calcul saisies', N,
        stations: xs.map((x, i) => ({ x, N, My: my[i] * 1e6, Mz: mz[i] * 1e6, Vz, Vy })),
        diag: { N, My: quarter(my).map((v) => v * 1e6), Mz: quarter(mz).map((v) => v * 1e6), loadY: lin(my) ? null : (d.load === 'C' ? 'C' : 'U'), loadZ: lin(mz) ? null : (d.load === 'C' ? 'C' : 'U') }
      });
      R.cases = null;
    } else {
      // --- cas de charge unitaires
      const ld = s.loads || {};
      const row = (id) => { const r = ld[id] || {}; return { q: num(r.q), P: num(r.P), x: num(r.x) }; };
      const rows = { Gz: row('Gz'), Qz: row('Qz'), Gy: row('Gy'), Qy: row('Qy') };
      if (s.pp !== false) rows.Gz.q += R.pp;
      const cases = {};
      const NS = 40, ND = 400;
      const stn = [];
      for (let i = 0; i <= NS; i++) stn.push({ x: i * L / NS, side: i === 0 ? 1 : -1 });
      Object.keys(rows).forEach((k) => {
        const r = rows[k];
        const c = beamCase(L, s.bc, r.q, r.P, r.x);
        cases[k] = { ...r, c, w: deflection(c, ND) };
        if (r.P !== 0) { const a = c.a; stn.push({ x: a, side: -1 }, { x: a, side: 1 }); }
      });
      stn.sort((p, q) => p.x - q.x || p.side - q.side);
      R.cases = cases; R.rows = rows;
      const NG = num(s.N && s.N.G) * 1e3, NQ = num(s.N && s.N.Q) * 1e3;
      const hasQ = ['Qz', 'Qy'].some((k) => rows[k].q !== 0 || rows[k].P !== 0) || NQ !== 0;
      const hasG = ['Gz', 'Gy'].some((k) => rows[k].q !== 0 || rows[k].P !== 0) || NG !== 0;
      const fmtC = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
      const defs = [];
      if (hasQ) defs.push({ id: 'ELU 1', g: gGs, q: gQ, label: `${fmtC(gGs)}·G + ${fmtC(gQ)}·Q` });
      if (hasG || !hasQ) defs.push({ id: 'ELU ' + (defs.length + 1), g: gGs, q: 0, label: `${fmtC(gGs)}·G` });
      const opp = (a, b) => a * b < 0;
      const uplift = [['Gz', 'Qz'], ['Gy', 'Qy']].some(([g, q]) => opp(rows[g].q || rows[g].P, rows[q].q || rows[q].P) || (rows[q].q < 0 || rows[q].P < 0)) || opp(NG, NQ) || NQ < 0;
      if (hasQ && hasG && gGi !== gGs && uplift) defs.push({ id: 'ELU ' + (defs.length + 1), g: gGi, q: gQ, label: `${fmtC(gGi)}·G + ${fmtC(gQ)}·Q (G favorable)` });
      const kind = (a, b) => { const hasq = a.q * 1 !== 0 || b.q * 1 !== 0, hasp = a.P !== 0 || b.P !== 0; return !hasq && !hasp ? null : (hasq ? 'U' : 'C'); };
      defs.forEach((df) => {
        const Mfun = (kG, kQ) => (x) => df.g * cases[kG].c.M(x) + df.q * cases[kQ].c.M(x);
        const Vfun = (kG, kQ) => (x, sd) => df.g * cases[kG].c.V(x, sd) + df.q * cases[kQ].c.V(x, sd);
        const My = Mfun('Gz', 'Qz'), Mz = Mfun('Gy', 'Qy'), Vz = Vfun('Gz', 'Qz'), Vy = Vfun('Gy', 'Qy');
        const N = df.g * NG + df.q * NQ;
        const five = (f) => [0, 0.25, 0.5, 0.75, 1].map((t) => f(t * L) * 1e6);
        combos.push({
          id: df.id, label: df.label, N, g: df.g, q: df.q,
          stations: stn.map((p) => ({ x: p.x, side: p.side, N, My: My(p.x) * 1e6, Mz: Mz(p.x) * 1e6, Vz: Vz(p.x, p.side) * 1e3, Vy: Vy(p.x, p.side) * 1e3 })),
          diag: { N, My: five(My), Mz: five(Mz), loadY: kind(rows.Gz, rows.Qz), loadZ: kind(rows.Gy, rows.Qy) }
        });
      });
    }

    // --- vérifications par combinaison
    const env = { byCrit: {}, max: 0, worst: null, n: combos.length };
    combos.forEach((c) => {
      c.r = {}; c.at = {};
      let best = -1, bestSt = null;
      c.stations.forEach((p) => {
        const o = sectionCheck(S, P, g0, p);
        p.cls = o.cls; p.r = o.r;
        let m = 0;
        SEC_KEYS.forEach((k) => { const v = o.r[k]; if (!(c.r[k] >= v)) { c.r[k] = v; c.at[k] = p; } if (v > m || Number.isNaN(v)) m = v; });
        if (m > best) { best = m; bestSt = p; }
      });
      c.secSt = bestSt;
      c.sec = sectionCheck(S, P, g0, bestSt);
      const my = c.stations.reduce((a, p) => (Math.abs(p.My) > Math.abs(a) ? p.My : a), 0);
      const mz = c.stations.reduce((a, p) => (Math.abs(p.Mz) > Math.abs(a) ? p.Mz : a), 0);
      c.diag.Mymax = my; c.diag.Mzmax = mz;
      c.Vzmax = Math.max(...c.stations.map((p) => Math.abs(p.Vz))); c.Vymax = Math.max(...c.stations.map((p) => Math.abs(p.Vy)));
      c.mem = memberCheck(S, P, grade, g1, c.diag, stab);
      MEM_KEYS.forEach((k) => { c.r[k] = c.mem.r[k]; });
      c.cls = c.mem.cls;
      c.max = 0; c.gov = null;
      Object.keys(CRITERIA).forEach((k) => {
        const v = c.r[k];
        if (v > c.max || (!Number.isFinite(v) && v !== undefined)) { c.max = v; c.gov = k; }
        if (!env.byCrit[k] || v > env.byCrit[k].r) env.byCrit[k] = { r: v, combo: c };
      });
      if (!env.worst || c.max > env.max) { env.max = c.max; env.worst = c; }
    });
    R.combos = combos; R.env = env;
    R.cls = combos.length ? Math.max(...combos.map((c) => c.cls)) : P.cMy.cls;
    if (combos.some((c) => c.N < 0)) R.warnings.push('Traction : la résistance de la section nette (trous de boulons, 6.2.3 (6.7)) n\'est pas vérifiée ici.');
    if (combos.some((c) => c.N > 0 && c.cls === 4)) R.warnings.push(`Section de classe 4 en compression : aire efficace A_eff = ${(P.Aeff / 100).toFixed(1)} cm² (A = ${(S.A / 100).toFixed(1)} cm²) utilisée pour N_c,Rd et le flambement (EN 1993-1-5 § 4.4).`);
    if (s.bc === 'c' && s.mode !== 'direct' && lk.LLT !== false) R.warnings.push('Console : longueur de déversement forfaitaire 2·L et C1 = 1 (extrémité libre non maintenue) — à ajuster selon les maintiens réels.');

    // --- ELS : flèches
    const sl = s.sls || {};
    const Lref = (num(sl.Lref) > 0 ? num(sl.Lref) : (s.bc === 'c' ? 2 * L : L)) * 1000;
    const limT = num(sl.tot), limQ = num(sl.q);
    const addRow = (label, dir, w, limRatio, x) => {
      if (!(limRatio > 0)) return;
      const lim = Lref / limRatio;
      R.sls.rows.push({ label, dir, w, lim, limRatio, Lratio: w > 0 ? Lref / w : Infinity, ratio: w / lim, x });
    };
    if (s.mode === 'direct') {
      const d = s.direct || {};
      if (String(d.wTot == null ? '' : d.wTot).trim() !== '') addRow('Flèche totale (G + Q) — saisie', 'z', Math.abs(num(d.wTot)), limT);
      if (String(d.wQ == null ? '' : d.wQ).trim() !== '') addRow('Flèche sous Q — saisie', 'z', Math.abs(num(d.wQ)), limQ);
    } else if (R.cases) {
      const wmax = (kG, kQ, I, fg, fq) => {
        let m = 0, im = 0; const a = R.cases[kG].w, b = R.cases[kQ].w;
        for (let i = 0; i < a.length; i++) { const v = Math.abs(fg * a[i] + fq * b[i]); if (v > m) { m = v; im = i; } }
        return { w: m * 1e12 / (E * I), x: im * L / (a.length - 1) };
      };
      const any = (a, b) => R.rows[a].q !== 0 || R.rows[a].P !== 0 || R.rows[b].q !== 0 || R.rows[b].P !== 0;
      [['z', 'Gz', 'Qz', S.Iy], ['y', 'Gy', 'Qy', S.Iz]].forEach(([dir, kG, kQ, I]) => {
        if (!any(kG, kQ)) return;
        const t = wmax(kG, kQ, I, 1, 1), q = wmax(kG, kQ, I, 0, 1);
        addRow('Flèche totale (G + Q)', dir, t.w, limT, t.x);
        addRow('Flèche sous actions variables (Q)', dir, q.w, limQ, q.x);
      });
      // fréquence propre fondamentale (flexion dans le plan fort)
      const psi = num(sl.psi2, 0.3);
      const mlin = (R.rows.Gz.q + psi * R.rows.Qz.q) * 1000 / 9.81;          // kg/m
      if (mlin > 0) {
        const K = (D.BC[s.bc] || D.BC.aa).K;
        const f = K / (2 * PI * L * L) * Math.sqrt(E * S.Iy * 1e-6 / mlin);
        const fmin = num(sl.fmin);
        R.freq = { f, m: mlin, K, psi, fmin, ratio: fmin > 0 ? fmin / f : null, pt: R.rows.Gz.P !== 0 || R.rows.Qz.P !== 0 };
      }
    }
    R.sls.Lref = Lref;
    R.sls.max = R.sls.rows.reduce((a, r) => Math.max(a, r.ratio), 0);
    if (R.freq && R.freq.ratio != null) R.sls.max = Math.max(R.sls.max, R.freq.ratio);
    R.max = Math.max(env.max || 0, R.sls.max);
    return R;
  }

  window.FirmitasEC3 = { compute, sectionOf, classify, prepare, sectionCheck, memberCheck, beamCase, deflection, cmB3, curves, ltCurve, chi, mcr, aeff, CRITERIA, SEC_KEYS, MEM_KEYS, num };
})();
