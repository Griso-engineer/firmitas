/* ==========================================================================
   Firmitas — assemblage boulonné par platines d'about (extrémités de barres)
   Profils en I/H (méthode des composantes, NF EN 1993-1-8 § 6.2) et tubes RHS/SHS/CHS
   (répartition élastique des tractions, tronçon en T équivalent par boulon).
   Les deux platines sont identiques : une platine et les boulons sont vérifiés.
   Unités internes : N, mm, MPa. Entrées : kN, kN·m, mm.
   Torseur au droit du joint : N > 0 compression ; M_y > 0 comprime la face supérieure (z > 0) ;
   M_z > 0 comprime le côté +y ; V_y, V_z efforts tranchants ; M_x torsion.
   ========================================================================== */
(function () {
  'use strict';
  const SC = window.FirmitasSpliceCalc, D = window.FIRMITAS_DATA, GEO = window.FirmitasGeom;
  const { num, BOLTS, CLASSES, d0Of, fuOf, bearing } = SC;
  const PI = Math.PI, BIG = 1e9, SQ2 = Math.SQRT2;
  // diamètre moyen d_m de la tête / de l'écrou (moyenne entre plats et sur angles, ISO 4014/4032) pour le poinçonnement
  const DM = { 12: 19.0, 14: 22.0, 16: 25.0, 18: 28.0, 20: 31.5, 22: 34.5, 24: 37.8, 27: 42.6, 30: 47.5, 36: 57.0 };
  const BETAW = { S235: 0.8, S275: 0.85, S355: 0.9, S420: 1.0, S460: 1.0 };

  function defaultState() {
    return {
      v: 1, kind: 'platines', name: 'Platines P1', shape: 'I',
      sec: { kind: 'cat', fam: 'HE A', name: 'HE 300 A', prs: { h: 500, b: 250, tw: 10, tf: 20 } },
      tube: { kind: 'cat', fam: 'SHS (tube carré)', name: 'SHS 200 × 200 × 10', fab: 'hot', h: 200, b: 100, t: 8, d: 219.1 },
      grade: 'S355', plateGrade: 'S355',
      bolt: { d: 22, cls: '10.9', threads: true },
      gam: { M0: 1, M2: 1.25 },
      plate: { tp: 25, af: 8, aw: 5 },
      Ilay: { extTop: true, extBot: true, mx: 45, ex: 40, nInTop: 1, nInBot: 1, mi: 50, p: 80, w: 150, bp: 300, over: 15 },
      Tlay: { sides: 4, nSide: 2, m: 40, e: 35, nChs: 8, over: 15 },
      cur: 0,
      loads: [{ name: 'ELU 1', N: -50, Vy: 0, Vz: 120, Mx: 0, My: 160, Mz: 0 }]
    };
  }
  function upgrade(s) {
    const d = defaultState();
    (function merge(dst, src) {
      Object.keys(src).forEach((k) => {
        if (dst[k] === undefined) dst[k] = src[k];
        else if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') merge(dst[k], src[k]);
      });
    })(s, d);
    return s;
  }
  const loadOf = (s, idx) => { const L = Array.isArray(s.loads) && s.loads.length ? s.loads : [{}]; return L[Math.max(0, Math.min(L.length - 1, idx == null ? (+s.cur || 0) : idx))]; };

  function memberOf(s) {
    if (s.shape === 'I') return SC.beamOf(s);
    const t = s.tube || {};
    if (t.kind === 'custom') {
      if (s.shape === 'chs') { const d = num(t.d), tt = num(t.t); return d > 2 * tt && tt > 0 ? GEO.chs(d, tt, t.fab) : null; }
      const h = num(t.h), b = num(t.b), tt = num(t.t); return h > 3 * tt && b > 3 * tt && tt > 0 ? GEO.rhs(h, b, tt, t.fab) : null;
    }
    const S = D.findSection(t.fam, t.name, t.fab);
    if (!S) return null;
    if (s.shape === 'chs' && S.type !== 'CHS') return null;
    if (s.shape === 'rhs' && S.type !== 'RHS') return null;
    return S;
  }

  // Coefficient α de la figure 6.11 (EN 1993-1-8), forme analytique des courbes (Moore & Wald, « Design of
  // Structural Connections to Eurocode 3 — FAQ », Q&A 6.2) : λ1* = 1,25/(α − 2,75), λ2* = α·λ1*/2,
  // λ1 = λ1* + (1 − λ1*)·((λ2* − λ2)/λ2*)^(α/√2) si λ2 < λ2*, sinon λ1 = λ1*. α ∈ [4,45 ; 8], obtenu par dichotomie.
  function lam1Of(a, l2) { const l1s = 1.25 / (a - 2.75), l2s = a * l1s / 2; return l2 >= l2s ? l1s : l1s + (1 - l1s) * Math.pow((l2s - l2) / l2s, a / SQ2); }
  function alphaOf(l1, l2) {
    if (!(l1 > 0) || !(l2 >= 0)) return 4.45;
    if (lam1Of(8, l2) >= l1) return 8;
    if (lam1Of(4.45, l2) <= l1) return 4.45;
    let lo = 4.45, hi = 8;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (lam1Of(m, l2) > l1) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  // Tractions des boulons d'une platine de tube (platine supposée rigide) : boulons = ressorts en traction seule,
  // contact platine/platine sous la paroi du tube = ressorts en compression seule (raideurs relatives d'après
  // EN 1993-1-8 tab. 6.11 : k10 boulon, k5 platine fléchie ; diffusion à 45° pour le contact).
  // Équilibre : ΣF = −N, ΣF·(−z) = M_y, ΣF·(−y) = M_z. Itération sur les ressorts actifs.
  function tubeTension(bolts, kb, cpts, N, My, Mz) {
    const pts = bolts.map((q) => ({ y: q.y, z: q.z, k: kb, bolt: true })).concat(cpts.map((c) => ({ y: c.y, z: c.z, k: c.k, bolt: false })));
    let act = pts.map((q) => q.bolt), sol = null;
    for (let it = 0; it < 100; it++) {
      const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], phi = (q) => [1, q.y, q.z];
      pts.forEach((q, i) => { if (!act[i]) return; const f = phi(q); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) A[r][c] += q.k * f[r] * f[c]; });
      const x = solve3(A, [-N, -Mz, -My]);
      if (!x) { sol = null; break; }
      const dl = pts.map((q) => x[0] + x[1] * q.y + x[2] * q.z);
      const nxt = pts.map((q, i) => (q.bolt ? dl[i] > 0 : dl[i] < 0));
      sol = { x, dl };
      if (nxt.every((v, i) => v === act[i])) break;
      act = nxt;
    }
    if (!sol) return bolts.map(() => 0);
    return bolts.map((q, i) => Math.max(0, kb * sol.dl[i]));
  }
  function solve3(A, b) {
    const M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < 3; c++) {
      let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12 * (Math.abs(M[0][0]) + 1)) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < 3; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k]; }
    }
    return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
  }

  // tronçon en T équivalent (EN 1993-1-8 § 6.2.4, tableau 6.2, méthode 1, avec effet de levier)
  function tstub(leff1, leff2, m, n, tf, fy, gM0, sumFtRd) {
    const Mpl1 = 0.25 * leff1 * tf * tf * fy / gM0, Mpl2 = 0.25 * leff2 * tf * tf * fy / gM0;
    const F1 = m > 0 ? 4 * Mpl1 / m : Infinity, F2 = (2 * Mpl2 + n * sumFtRd) / (m + n), F3 = sumFtRd;
    const F = Math.min(F1, F2, F3);
    return { F, F1, F2, F3, mode: F === F1 ? 1 : F === F2 ? 2 : 3, Mpl1, Mpl2 };
  }

  // ---------- géométrie : profils en I ----------
  function geomI(s, S, d) {
    const L = s.Ilay, h2 = S.h / 2;
    const mxIn = num(L.mx), ex = num(L.ex), mi = num(L.mi), p = num(L.p), w = num(L.w), bp = num(L.bp), over = num(L.over);
    const rows = [];
    if (L.extTop) rows.push({ z: h2 + mxIn, type: 'ext', side: 'top' });
    for (let i = 0; i < Math.round(num(L.nInTop)); i++) rows.push({ z: h2 - S.tf - mi - i * p, type: i === 0 ? 'adj' : 'inner', side: 'top' });
    for (let i = Math.round(num(L.nInBot)) - 1; i >= 0; i--) rows.push({ z: -h2 + S.tf + mi + i * p, type: i === 0 ? 'adj' : 'inner', side: 'bot' });
    if (L.extBot) rows.push({ z: -h2 - mxIn, type: 'ext', side: 'bot' });
    rows.sort((a, b) => b.z - a.z);
    const topEdge = L.extTop ? h2 + mxIn + ex : h2 + over, botEdge = L.extBot ? -h2 - mxIn - ex : -h2 - over;
    const bolts = []; rows.forEach((r, i) => { r.i = i; [-w / 2, w / 2].forEach((y) => bolts.push({ y, z: r.z, row: i })); });
    return { rows, bolts, w, bp, hp: topEdge - botEdge, topEdge, botEdge, mx: mxIn, ex, mi, p, e: (bp - w) / 2, over };
  }

  // ---------- géométrie : tubes ----------
  function geomT(s, S) {
    const L = s.Tlay, m = num(L.m), e = num(L.e), over = num(L.over);
    const bolts = [];
    if (s.shape === 'chs') {
      const n = Math.max(3, Math.round(num(L.nChs, 8))), Rb = S.d / 2 + m;
      // largeur tributaire au pied du cordon (rayon r + 0,8·a·√2, cohérent avec m), et non au cercle des boulons
      const Rt = S.d / 2 + 0.8 * num(s.plate.aw) * SQ2, Rw = (S.d - S.t) / 2;
      for (let k = 0; k < n; k++) { const a = PI / 2 + PI / n + 2 * PI * k / n; bolts.push({ y: Rb * Math.cos(a), z: Rb * Math.sin(a), trib: 2 * PI * Rt / n, tribW: 2 * PI * Rw / n }); }
      return { bolts, m, e, Rb, Dp: 2 * (Rb + e), round: true, n };
    }
    const ns = Math.max(1, Math.round(num(L.nSide, 2))), sides = num(L.sides) === 2 ? 2 : 4;
    const put = (len, n) => { const ps = len / n; const a = []; for (let k = 0; k < n; k++) a.push((k - (n - 1) / 2) * ps); return { a, ps }; };
    const tb = put(S.b, ns);
    tb.a.forEach((y) => { bolts.push({ y, z: S.h / 2 + m, trib: tb.ps, face: 'top' }); bolts.push({ y, z: -S.h / 2 - m, trib: tb.ps, face: 'bot' }); });
    if (sides === 4) {
      const lr = put(S.h, ns);
      lr.a.forEach((z) => { bolts.push({ y: S.b / 2 + m, z, trib: lr.ps, face: 'right' }); bolts.push({ y: -S.b / 2 - m, z, trib: lr.ps, face: 'left' }); });
    }
    const bp = sides === 4 ? S.b + 2 * (m + e) : S.b + 2 * over, hp = S.h + 2 * (m + e);
    return { bolts, m, e, bp, hp, sides, ns, round: false };
  }

  function compute(s, idx) {
    const R = { valid: true, warnings: [], info: [], checks: [] };
    const S = memberOf(s); R.S = S;
    if (!S) { R.valid = false; R.warnings.push(s.shape === 'I' ? 'Section invalide : profil en I à ailes parallèles ou PRS requis.' : 'Section de tube invalide.'); return R; }
    const LD = loadOf(s, idx); R.loadName = LD.name || '';
    const L = { N: num(LD.N) * 1e3, Vy: num(LD.Vy) * 1e3, Vz: num(LD.Vz) * 1e3, Mx: num(LD.Mx) * 1e6, My: num(LD.My) * 1e6, Mz: num(LD.Mz) * 1e6 };
    R.L = L;
    const gam = { M0: num(s.gam.M0, 1) || 1, M2: num(s.gam.M2, 1.25) || 1.25 }; R.gam = gam;
    const b = s.bolt, d = num(b.d, 20), As = BOLTS[d] || 245, d0 = d0Of(d), Ab = PI * d * d / 4, bc = CLASSES[b.cls] || CLASSES['8.8'];
    const threads = b.threads !== false;
    const tp = num(s.plate.tp), fyp = D.fyOf(s.plateGrade, tp, 'en10025'), fup = fuOf(s.plateGrade, tp);
    {
      const pos = [['t_p', s.plate.tp], ['a (âme / paroi)', s.plate.aw]].concat(S.type === 'I' ? [['a (semelles)', s.plate.af], ['w', s.Ilay.w], ['b_p', s.Ilay.bp]] : [['m', s.Tlay.m], ['e', s.Tlay.e]]).filter((q) => !(num(q[1]) > 0));
      if (pos.length) { R.valid = false; R.warnings.push('Données invalides (valeurs nulles ou négatives) : ' + pos.map((q) => q[0]).join(', ') + '.'); return R; }
    }
    const tm = S.type === 'I' ? S.tf : S.t, fym = D.fyOf(s.grade, tm, 'en10025'), fum = fuOf(s.grade, tm);
    const FtRd = 0.9 * bc.fub * As / gam.M2, BpRd = 0.6 * PI * (DM[d] || 1.6 * d) * tp * fup / gam.M2;
    const Ftb = Math.min(FtRd, BpRd);
    const FvRd = (threads ? bc.av * As : 0.6 * Ab) * bc.fub / gam.M2;
    R.bolt = { d, d0, As, fub: bc.fub, cls: b.cls, threads, FtRd, BpRd, Ftb, FvRd };
    R.mat = { fyp, fup, fym, fum }; R.tp = tp;
    const add = (grp, id, label, ref, Ed, Rd, extra) => {
      const r = Rd > 0 ? Math.abs(Ed) / Rd : (Math.abs(Ed) > 0 ? Infinity : 0);
      R.checks.push(Object.assign({ grp, id, label, ref, Ed, Rd, r }, extra || {}));
    };
    const aw = num(s.plate.aw), af = num(s.plate.af);
    const gChk = [];
    const geoC = (id, label, need, have, note) => gChk.push({ grp: 'plate', id, label, ref: '1-8 tab. 3.3 · géométrie', Ed: need, Rd: have, rg: have > 0 ? Math.max(0, need) / have : Infinity, r: !(have > 0) || need > have + 1e-6 ? (have > 0 ? need / have : Infinity) : 0, ratioOnly: true, geo: true, note });
    // résistance d'une soudure d'angle par unité de gorge (4.5.3.3) : pièce la plus faible des deux assemblées
    const fw = Math.min(fum / (BETAW[s.grade] || 0.9), fup / (BETAW[s.plateGrade] || 0.9)) / (Math.sqrt(3) * gam.M2);

    if (S.type === 'I') {
      const G = geomI(s, S, d); R.geo = G;
      if (Math.abs(L.Mz) > 1 || Math.abs(L.Mx) > 1) R.warnings.push('M_z et M_x ne sont pas traités pour un profil en I (méthode des composantes de l\'EN 1993-1-8 en flexion d\'axe fort) : vérification incomplète.');
      geoC('g_e', 'Pince transversale e = (b_p − w)/2 ≥ 1,2·d₀', 1.2 * d0, G.e, `${G.e.toFixed(1)} mm ≥ ${(1.2 * d0).toFixed(1)} mm`);
      geoC('g_bp', 'Géométrie — platine au moins aussi large que la semelle', S.b, G.bp, `b_p = ${G.bp} mm ≥ b = ${S.b} mm`);
      const mw = (G.w - S.tw) / 2 - 0.8 * aw * SQ2;
      geoC('g_mw', 'Géométrie — distance boulon–cordon d’âme m > 0,5·d (clé, écrou)', 0.5 * d, mw, `m = ${mw.toFixed(1)} mm > ${(0.5 * d).toFixed(1)} mm`);
      if (G.w / 2 + 1.0 * d > S.b / 2 && G.rows.some((r) => r.type !== 'ext')) R.info.push('Rangées intérieures : vérifier le passage de la clé entre semelle et âme.');
      const mfx = G.mx - 0.8 * af * SQ2;                      // rangée débordante : distance boulon–cordon de semelle
      if (G.rows.some((r) => r.type === 'ext')) geoC('g_mx', 'Géométrie — rangée débordante : distance au cordon de semelle m_x > 0,5·d', 0.5 * d, mfx, `m_x = ${mfx.toFixed(1)} mm > ${(0.5 * d).toFixed(1)} mm`);
      if (G.rows.some((r) => r.type === 'ext')) geoC('g_ex', 'Pince e_x de la rangée débordante ≥ 1,2·d₀', 1.2 * d0, G.ex, `${G.ex} mm ≥ ${(1.2 * d0).toFixed(1)} mm`);
      if (G.rows.length > 1) { const zs0 = G.rows.map((r) => r.z); const pm0 = Math.min(...zs0.slice(1).map((z, i) => zs0[i] - z)); geoC('g_p', 'Entraxe vertical minimal entre rangées ≥ 2,2·d₀', 2.2 * d0, pm0, `${pm0.toFixed(1)} mm ≥ ${(2.2 * d0).toFixed(1)} mm`); }
      const nI = Math.min(G.e, 1.25 * mw);
      // longueurs efficaces par rangée (tableau 6.6), groupes de rangées intérieures de chaque côté
      const rowCap = (r, tensionSide) => {
        let cp, nc, m, n;
        if (r.type === 'ext') {
          m = mfx; n = Math.min(G.ex, 1.25 * m);
          cp = Math.min(2 * PI * m, PI * m + G.w, PI * m + 2 * G.e);
          nc = Math.min(4 * m + 1.25 * G.ex, G.e + 2 * m + 0.625 * G.ex, 0.5 * G.bp, 0.5 * G.w + 2 * m + 0.625 * G.ex);
        } else {
          m = mw; n = nI;
          const adjT = r.type === 'adj' && r.side === tensionSide;          // rangée près de la semelle tendue : α (fig. 6.11)
          const m2 = G.mi - 0.8 * af * SQ2;                                  // boulon → pied du cordon de semelle
          const alpha = alphaOf(m / (m + G.e), Math.max(0, m2) / (m + G.e));
          if (adjT) Object.assign(r, { alpha, lam1: m / (m + G.e), lam2: Math.max(0, m2) / (m + G.e), m2 });
          cp = 2 * PI * m; nc = adjT ? alpha * m : 4 * m + 1.25 * G.e;
          // effet de groupe : rangées intérieures voisines du même côté
          const same = G.rows.filter((q) => q.type !== 'ext' && q.side === r.side);
          if (same.length > 1) {
            const ps = same.filter((q) => q.i !== r.i).map((q) => Math.abs(q.z - r.z));
            const pn = Math.min(...ps);
            const isEnd = same[0].i === r.i || same[same.length - 1].i === r.i;   // r est une copie (Mres) : comparaison par indice
            let cpg, ncg;
            if (adjT) { cpg = PI * m + pn; ncg = 0.5 * pn + alpha * m - (2 * m + 0.625 * G.e); }
            else if (isEnd) { cpg = PI * m + pn; ncg = 2 * m + 0.625 * G.e + 0.5 * pn; }
            else { cpg = 2 * pn; ncg = pn; }
            cp = Math.min(cp, cpg); nc = Math.min(nc, ncg);
          }
        }
        const l1 = Math.min(cp, nc), l2 = nc;
        const ts = tstub(l1, l2, m, n, tp, fyp, gam.M0, 2 * Ftb);
        const web = r.type === 'ext' ? Infinity : l1 * S.tw * fym / gam.M0;   // âme tendue (6.2.6.8), b_eff = l_eff
        return { cp, nc, l1, l2, m, n, ts, web, F: Math.min(ts.F, web) };
      };
      const fy0 = fym;
      const McRd = S.Wply * fy0 / gam.M0;
      const FcRd = McRd / (S.h - S.tf);
      R.comp = { McRd, FcRd };
      // moment résistant pour un sens de flexion : 'bot' = rangées inférieures tendues (M_y > 0)
      const Mres = (tensionSide) => {
        const zc = tensionSide === 'bot' ? S.h / 2 - S.tf / 2 : -S.h / 2 + S.tf / 2;
        const tr = G.rows.map((r) => Object.assign({}, r, { h: tensionSide === 'bot' ? zc - r.z : r.z - zc })).filter((r) => r.h > 1e-6);
        tr.sort((a, b) => b.h - a.h);
        let sum = 0, Fx19 = null;
        const out = tr.map((r) => {
          const c = rowCap(r, tensionSide);
          let F = c.F;
          if (Fx19) F = Math.min(F, Fx19.F * r.h / Fx19.h);                // 6.2.7.2 (9)
          F = Math.min(F, Math.max(0, FcRd - sum));                       // 6.2.7.2 (7) : ΣF ≤ F_c,fb,Rd
          sum += F;
          if (!Fx19 && F > 1.9 * FtRd) Fx19 = { F, h: r.h };
          return Object.assign(r, { cap: c, F });
        });
        const M = out.reduce((a, r) => a + r.F * r.h, 0);
        return { rows: out, M, zc };
      };
      const MpBot = Mres('bot'), MpTop = Mres('top');
      R.Mres = { bot: MpBot, top: MpTop };
      // traction pure : toutes les rangées, sans limite de compression
      const NtRd = G.rows.reduce((a, r) => a + rowCap(r, r.side).F, 0);
      const NcRd = S.A * fym / gam.M0;
      R.NjRd = { t: NtRd, c: NcRd };
      const Mside = L.My >= 0 ? MpBot : MpTop;
      const MjRd = Mside.M;
      R.MjRd = MjRd; R.Mside = L.My >= 0 ? 'bot' : 'top';
      const etaM = Math.abs(L.My) / MjRd, etaN = L.N < 0 ? -L.N / NtRd : L.N / NcRd;
      add('plate', 'MN', `Moment et effort normal : M_j,Ed/M_j,Rd + N_j,Ed/N_j,Rd (M_j,Rd = ${(MjRd / 1e6).toFixed(1)} kN·m, N_j,Rd = ${((L.N < 0 ? NtRd : NcRd) / 1e3).toFixed(0)} kN ${L.N < 0 ? 'traction' : 'compression'})`, '6.2.7.1 (6.23)', etaM + etaN, 1, { ratioOnly: true });
      add('beam', 'Fc', 'Semelle et âme comprimées : F_c,Ed = |M_y|/(h − t_f) + part de N en compression', '6.2.6.7', Math.abs(L.My) / (S.h - S.tf) + Math.max(0, L.N) / 2, FcRd);
      // efforts de traction dans les boulons sous le torseur : rangées tendues mobilisées au prorata de l'utilisation
      const etaT = Math.min(1, etaM + Math.max(0, etaN));
      const FtRow = {};
      Mside.rows.forEach((r) => { FtRow[r.i] = r.F * Math.min(1, etaM) / 2; });
      if (L.N < 0) G.rows.forEach((r) => { FtRow[r.i] = (FtRow[r.i] || 0) + rowCap(r, r.side).F * etaN / 2; });
      R.FtBolt = G.bolts.map((q) => FtRow[q.row] || 0);
      R.etaT = etaT;
      // cisaillement : réparti sur tous les boulons, interaction avec la traction (tableau 3.4)
      const nb = G.bolts.length, V = Math.hypot(L.Vy, L.Vz), FvEd = V / nb;
      let worst = 0, iw = 0;
      G.bolts.forEach((q, i) => { const v = FvEd / FvRd + R.FtBolt[i] / (1.4 * FtRd); if (v > worst) { worst = v; iw = i; } });
      R.FvEd = FvEd;
      add('bolts', 'v', `Boulons — cisaillement (V/n = ${(FvEd / 1e3).toFixed(1)} kN)`, '3.6.1 tab. 3.4', FvEd, FvRd);
      add('bolts', 'vt', `Boulons — cisaillement + traction (boulon le plus tendu : F_t,Ed = ${(R.FtBolt[iw] / 1e3).toFixed(1)} kN)`, 'tab. 3.4', worst, 1, { ratioOnly: true });
      add('bolts', 't', 'Boulons — traction (F_t,Rd) et poinçonnement (B_p,Rd)', 'tab. 3.4', Math.max(...R.FtBolt), Ftb, { note: `F_t,Rd = ${(FtRd / 1e3).toFixed(1)} kN ; B_p,Rd = ${(BpRd / 1e3).toFixed(1)} kN (d_m = ${(DM[d] || 1.6 * d).toFixed(1)} mm)` });
      // pression diamétrale sur la platine (effort tranchant vertical / horizontal)
      const zs = G.rows.map((r) => r.z), pmin = zs.length > 1 ? Math.min(...zs.slice(1).map((z, i) => zs[i] - z)) : BIG;
      const eV = Math.min(G.topEdge - zs[0], zs[zs.length - 1] - G.botEdge);
      const bz = bearing(d, d0, tp, fup, bc.fub, gam.M2, { eEnd: eV, pAlong: pmin, nAlong: zs.length, eEdge: G.e, pPerp: G.w, nPerp: 2 });
      const by = bearing(d, d0, tp, fup, bc.fub, gam.M2, { eEnd: G.e, pAlong: G.w, nAlong: 2, eEdge: eV, pPerp: pmin, nPerp: zs.length });
      add('plate', 'b', `Platine — pression diamétrale (t = ${tp} mm)`, '3.6.1 tab. 3.4', Math.hypot(L.Vz / nb / bz.Fb, L.Vy / nb / by.Fb), 1, { ratioOnly: true, note: `F_b,z,Rd = ${(bz.Fb / 1e3).toFixed(1)} kN ; F_b,y,Rd = ${(by.Fb / 1e3).toFixed(1)} kN` });
      // soudures (méthode simplifiée 4.5.3.3) : semelles (effort de semelle), âme (V_z et part de N)
      const Af = S.b * S.tf, Aw = S.A - 2 * Af;
      const Ffl = Math.abs(L.My) / (S.h - S.tf) + Math.max(0, -L.N) * Af / S.A;
      const Lf = 2 * S.b - S.tw, Lw = 2 * (S.h - 2 * S.tf - 2 * S.r);
      add('weld', 'wf', `Soudure de semelle (2 cordons a = ${af} mm, L = ${Lf.toFixed(0)} mm ; F_fl et V_y/2 combinés)`, '4.5.3.3', Math.hypot(Ffl, Math.abs(L.Vy) / 2) / Lf, fw * af, { perLen: true });
      add('weld', 'ww', `Soudure d'âme (2 cordons a = ${aw} mm, L = ${Lw.toFixed(0)} mm)`, '4.5.3.3', Math.hypot(Math.abs(L.Vz), Math.max(0, -L.N) * Aw / S.A) / Lw, fw * aw, { perLen: true });
      R.Ftb = Ftb;
    } else {
      // ---------- tubes ----------
      const G = geomT(s, S); R.geo = G;
      const t = S.t, aT = aw;
      const mEff = G.m - 0.8 * aT * SQ2;
      geoC('g_m', 'Géométrie — distance boulon–cordon m > 0,5·d (clé, écrou)', 0.5 * d, mEff, `m = ${mEff.toFixed(1)} mm > ${(0.5 * d).toFixed(1)} mm`);
      geoC('g_e', 'Pince e ≥ 1,2·d₀', 1.2 * d0, G.e, `${G.e} mm ≥ ${(1.2 * d0).toFixed(1)} mm`);
      { const P = []; for (let i = 0; i < G.bolts.length; i++) for (let j = i + 1; j < G.bolts.length; j++) P.push(Math.hypot(G.bolts[i].y - G.bolts[j].y, G.bolts[i].z - G.bolts[j].z)); if (P.length) { const pm0 = Math.min(...P); geoC('g_p', 'Entraxe minimal entre boulons ≥ 2,2·d₀', 2.2 * d0, pm0, `${pm0.toFixed(1)} mm ≥ ${(2.2 * d0).toFixed(1)} mm`); } }
      const nT = Math.min(G.e, 1.25 * mEff);
      const n = G.bolts.length;
      const Iz = G.bolts.reduce((a, q) => a + q.z * q.z, 0), Iy = G.bolts.reduce((a, q) => a + q.y * q.y, 0);
      const caps = G.bolts.map((q) => {
        const cp = 2 * PI * mEff, nc = 4 * mEff + 1.25 * G.e;
        const l1 = Math.min(cp, nc, q.trib), l2 = Math.min(nc, q.trib);
        const ts = tstub(l1, l2, mEff, nT, tp, fyp, gam.M0, Ftb);
        const wall = (q.tribW || q.trib) * t * fym / gam.M0;                 // bande de paroi tendue
        return { l1, l2, ts, wall, F: Math.min(ts.F, wall) };
      });
      // tractions : platine rigide, contact sous la paroi comprimée (et non rotation autour du centre du groupe,
      // qui sous-estime la traction en flexion) ; tous boulons tendus si la traction domine
      const Lb = 2 * tp + 8 + 0.8 * d;                                     // serrage + ½ tête + ½ écrou (approx.)
      const k10 = 1.6 * As / Lb, l1m = caps.reduce((a, c) => a + c.l1, 0) / caps.length;
      const k5 = 0.9 * l1m * tp * tp * tp / Math.pow(Math.max(mEff, 1), 3);
      const kbT = 1 / (1 / k10 + 1 / k5);
      const cpts = [], bcw0 = t + 2 * tp;                                  // largeur de contact (diffusion à 45°)
      if (S.type === 'CHS') {
        const rc = (S.d - t) / 2, nc = 72;
        for (let k = 0; k < nc; k++) { const a = 2 * PI * (k + 0.5) / nc; cpts.push({ y: rc * Math.cos(a), z: rc * Math.sin(a), k: bcw0 * (2 * PI * rc / nc) / (2 * tp) }); }
      } else {
        const hc = S.h - t, bc2 = S.b - t, ns = 24;
        for (let k = 0; k < ns; k++) {
          const u = (k + 0.5) / ns - 0.5;
          cpts.push({ y: u * bc2, z: hc / 2, k: bcw0 * bc2 / ns / (2 * tp) }, { y: u * bc2, z: -hc / 2, k: bcw0 * bc2 / ns / (2 * tp) });
          cpts.push({ y: bc2 / 2, z: u * hc, k: bcw0 * hc / ns / (2 * tp) }, { y: -bc2 / 2, z: u * hc, k: bcw0 * hc / ns / (2 * tp) });
        }
      }
      R.FtBolt = tubeTension(G.bolts, kbT, cpts, L.N, L.My, L.Mz);
      R.kTube = { k10, k5, kb: kbT, Lb };
      R.caps = caps;
      let worstT = 0, it = 0;
      R.FtBolt.forEach((f, i) => { const r = f / caps[i].F; if (r > worstT) { worstT = r; it = i; } });
      const c0 = caps[it];
      add('plate', 'tT', `Tronçon en T par boulon (platine + boulon, mode ${c0.ts.mode}) et paroi tendue`, '6.2.4 tab. 6.2', R.FtBolt[it], c0.F, { note: `l_eff,1 = ${c0.l1.toFixed(0)} mm, m = ${mEff.toFixed(1)} mm, n = ${nT.toFixed(1)} mm ; F_T,1 = ${(c0.ts.F1 / 1e3).toFixed(1)}, F_T,2 = ${(c0.ts.F2 / 1e3).toFixed(1)}, F_T,3 = ${(c0.ts.F3 / 1e3).toFixed(1)} kN ; paroi : ${(c0.wall / 1e3).toFixed(1)} kN` });
      add('bolts', 't', 'Boulons — traction (F_t,Rd) et poinçonnement (B_p,Rd)', 'tab. 3.4', Math.max(...R.FtBolt), Ftb, { note: `F_t,Rd = ${(FtRd / 1e3).toFixed(1)} kN ; B_p,Rd = ${(BpRd / 1e3).toFixed(1)} kN` });
      // cisaillement + torsion (vectoriel)
      const Ip = Iz + Iy;
      const fv = G.bolts.map((q) => { const fy = L.Vy / n - (Ip > 0 ? L.Mx * q.z / Ip : 0), fz = L.Vz / n + (Ip > 0 ? L.Mx * q.y / Ip : 0); return { fy, fz, f: Math.hypot(fy, fz) }; });
      R.fv = fv;
      const iv = fv.reduce((a, f, i) => (f.f > fv[a].f ? i : a), 0);
      add('bolts', 'v', 'Boulons — cisaillement (V_y, V_z et torsion M_x)', '3.6.1 tab. 3.4', fv[iv].f, FvRd);
      let worst = 0; G.bolts.forEach((q, i) => { worst = Math.max(worst, fv[i].f / FvRd + R.FtBolt[i] / (1.4 * FtRd)); });
      add('bolts', 'vt', 'Boulons — cisaillement + traction', 'tab. 3.4', worst, 1, { ratioOnly: true });
      const bb = bearing(d, d0, tp, fup, bc.fub, gam.M2, { eEnd: G.e, pAlong: BIG, nAlong: 1, eEdge: G.e, pPerp: BIG, nPerp: 1 });
      add('plate', 'b', `Platine — pression diamétrale (t = ${tp} mm, pinces e = ${G.e} mm)`, '3.6.1 tab. 3.4', fv[iv].f, bb.Fb);
      // soudure périphérique : effort de membrane maximal par unité de longueur
      let qN, qV, Lw;
      if (S.type === 'CHS') {
        const r = S.d / 2; Lw = 2 * PI * r;
        qN = Math.max(0, -L.N) / Lw + Math.hypot(L.My, L.Mz) / (PI * r * r);
        qV = 2 * Math.hypot(L.Vy, L.Vz) / Lw + Math.abs(L.Mx) / (2 * PI * r * r);
      } else {
        Lw = 2 * (S.h + S.b);
        const Wy = S.h * S.b + S.h * S.h / 3, Wz = S.h * S.b + S.b * S.b / 3;   // modules de flexion d'un contour linéique
        qN = Math.max(0, -L.N) / Lw + Math.abs(L.My) / Wy + Math.abs(L.Mz) / Wz;
        qV = Math.max(Math.abs(L.Vz) / (2 * S.h), Math.abs(L.Vy) / (2 * S.b)) + Math.abs(L.Mx) / (2 * S.h * S.b);
      }
      add('weld', 'w', `Soudure périphérique (a = ${aT} mm, L = ${Lw.toFixed(0)} mm)`, '4.5.3.3', Math.hypot(qN, qV), fw * aT, { perLen: true });
      // paroi du tube en compression / section : la barre elle-même est hors champ
      R.Ftb = Ftb;
    }
    gChk.forEach((c) => R.checks.push(c));
    R.max = R.checks.reduce((a, c) => Math.max(a, c.r), 0);
    R.gov = R.checks.reduce((a, c) => (!a || c.r > a.r ? c : a), null);
    if (R.warnings.some((w) => /incomplète/.test(w))) R.partial = true;
    return R;
  }

  function computeEnv(s) {
    const n = Array.isArray(s.loads) && s.loads.length ? s.loads.length : 1;
    const runs = []; for (let i = 0; i < n; i++) runs.push(compute(s, i));
    const rows = [], idx = {};
    runs.forEach((r, i) => (r.checks || []).forEach((c) => {
      const key = c.grp + '|' + c.id;
      if (!(key in idx)) { idx[key] = rows.length; rows.push(Object.assign({}, c, { idx: i, name: r.loadName })); }
      else if (c.r > rows[idx[key]].r) rows[idx[key]] = Object.assign({}, c, { idx: i, name: r.loadName });
    }));
    const order = { bolts: 0, plate: 1, beam: 2, weld: 3 };
    rows.sort((a, b) => order[a.grp] - order[b.grp]);
    const max = rows.reduce((a, c) => Math.max(a, c.r), 0);
    const gov = rows.reduce((a, c) => (!a || c.r > a.r ? c : a), null);
    return { runs, rows, max, gov, govIdx: gov ? gov.idx : 0, valid: runs.every((r) => r.valid), partial: runs.some((r) => r.partial), perLoad: runs.map((r) => r.max) };
  }

  function summary(st) {
    try {
      const E = computeEnv(st), r = E.runs[0];
      return { type: 'Platines d\'about', sec: r.S ? `${r.S.name} · ${r.geo ? r.geo.bolts.length : '?'} M${r.bolt.d} ${r.bolt.cls}` : '—', gov: E.gov ? E.gov.label.replace(/\s*\(.*$/, '') : '', max: E.valid ? E.max : null };
    } catch (e) { return null; }
  }

  window.FirmitasEPCalc = { compute, computeEnv, defaultState, upgrade, summary, tstub, memberOf, DM, alphaOf, tubeTension };
})();
