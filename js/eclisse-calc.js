/* ==========================================================================
   Firmitas — éclisse boulonnée de poutre en I (couvre-joints de semelles et d'âme)
   NF EN 1993-1-8 + AN. Unités internes : N, mm, MPa. Entrées : kN, kN·m, mm.
   Torseur ELU à la section du joint : N (> 0 compression), V_y, V_z, M_x, M_y (> 0 comprime
   la semelle supérieure), M_z (> 0 comprime le côté +y des semelles).
   On vérifie un côté du joint (symétrique) : les boulons d'un côté reprennent tout le torseur.
   ========================================================================== */
(function () {
  'use strict';
  const D = window.FIRMITAS_DATA, GEO = window.FirmitasGeom;
  const num = (v, d = 0) => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(x) ? x : d; };
  const PI = Math.PI;

  // ---------- données boulons (NF EN 1993-1-8 tableaux 3.1, 3.4 ; ISO 898-1) ----------
  const BOLTS = { 12: 84.3, 14: 115, 16: 157, 18: 192, 20: 245, 22: 303, 24: 353, 27: 459, 30: 561, 36: 817 };
  const d0Of = (d) => d + (d <= 14 ? 1 : d <= 24 ? 2 : 3);
  const CLASSES = { '4.6': { fub: 400, fyb: 240, av: 0.6 }, '5.6': { fub: 500, fyb: 300, av: 0.6 }, '8.8': { fub: 800, fyb: 640, av: 0.6 }, '10.9': { fub: 1000, fyb: 900, av: 0.5 } };
  const MU = { A: 0.5, B: 0.4, C: 0.3, D: 0.2 };
  const KS = { normal: 1, oversize: 0.85, slotShortT: 0.85, slotLongT: 0.7 };
  // fu [MPa] — tableau 3.1 de l'EN 1993-1-1 (t ≤ 40 / 40 < t ≤ 80)
  const FU = { S235: [360, 360], S275: [430, 410], S355: [490, 470], S420: [520, 500], S460: [540, 530] };
  const fuOf = (g, t) => (FU[g] || FU.S355)[t <= 40 ? 0 : 1];

  const COMPS = [
    { id: 'N', label: 'N', unit: 'kN', title: 'Effort normal' },
    { id: 'Vy', label: 'V_y', unit: 'kN', title: 'Effort tranchant transversal' },
    { id: 'Vz', label: 'V_z', unit: 'kN', title: 'Effort tranchant vertical' },
    { id: 'Mx', label: 'M_x', unit: 'kN·m', title: 'Moment de torsion' },
    { id: 'My', label: 'M_y', unit: 'kN·m', title: 'Moment fort' },
    { id: 'Mz', label: 'M_z', unit: 'kN·m', title: 'Moment faible' }
  ];
  const GROUPS = [{ id: 'top', label: 'Semelle supérieure' }, { id: 'web', label: 'Âme' }, { id: 'bot', label: 'Semelle inférieure' }];

  function defaultState() {
    return {
      v: 1, kind: 'eclisse', name: 'Éclisse E1',
      sec: { kind: 'cat', fam: 'HE A', name: 'HE 300 A', prs: { h: 600, b: 300, tw: 12, tf: 25 } },
      grade: 'S355', plateGrade: 'S355',
      bolt: { d: 20, cls: '8.8', pre: false, cat: 'C', surf: 'B', holes: 'normal', threads: true, kser: 0.7 },
      gam: { M0: 1, M2: 1.25, M3: 1.25, M3ser: 1.1 },
      gap: 10, myShare: 'inertie',
      fl: { n1: 3, p1: 70, e1: 40, e1b: 45, n2s: 1, w: 160, p2: 60 },
      top: { double: true, bo: 300, to: 10, bi: 110, ti: 10, pack: 0 },
      bot: { double: true, bo: 300, to: 10, bi: 110, ti: 10, pack: 0 },
      web: { n1: 2, p1: 60, e1: 40, e1b: 45, n2: 3, p2: 60, hp: 190, tp: 10 },
      cur: 0,
      loads: [
        { name: 'ELU 1 — M_y max', N: 50, Vy: 10, Vz: 150, Mx: 2, My: 250, Mz: 10 },
        { name: 'ELU 2 — V_z max', N: 20, Vy: 5, Vz: 220, Mx: 1, My: 120, Mz: 5 }
      ]
    };
  }
  function upgrade(s) {
    if (s.load && !Array.isArray(s.loads)) { s.loads = [Object.assign({ name: 'ELU 1' }, s.load)]; }
    delete s.load;
    const d = defaultState();
    (function merge(dst, src) {
      Object.keys(src).forEach((k) => {
        if (dst[k] === undefined) dst[k] = src[k];
        else if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') merge(dst[k], src[k]);
      });
    })(s, d);
    return s;
  }

  function beamOf(s) {
    const c = s.sec || {};
    if (c.kind === 'prs') {
      const p = c.prs, h = num(p.h), b = num(p.b), tw = num(p.tw), tf = num(p.tf);
      if (!(h > 2 * tf && b > tw && tw > 0 && tf > 0)) return null;
      return GEO.iSection(`PRS ${h} × ${b} × ${tw} × ${tf}`, h, b, tw, tf, 0, 'welded');
    }
    const S = D.findSection(c.fam, c.name);
    return S && S.type === 'I' ? S : null;
  }

  // ---------- géométrie des groupes de boulons (un côté du joint) ----------
  // Repère local : x le long de la poutre depuis l'axe du joint, t transversal (y pour les semelles, z pour l'âme).
  function flangeBolts(s, g) {
    const f = s.fl, n1 = Math.max(1, Math.round(num(f.n1, 1))), n2s = num(f.n2s, 1) >= 2 ? 2 : 1;
    const w = num(f.w), p2 = num(f.p2), p1 = num(f.p1), e1b = num(f.e1b);
    const ts = n2s === 1 ? [-w / 2, w / 2] : [-w / 2 - p2, -w / 2, w / 2, w / 2 + p2];
    const pts = [];
    for (let j = 0; j < n1; j++) ts.forEach((t) => pts.push({ x: g / 2 + e1b + j * p1, t }));
    return { pts, n1, n2: ts.length, n2s, ts, p1, p2, w, e1: num(f.e1), e1b };
  }
  function webBolts(s, g) {
    const f = s.web, n1 = Math.max(1, Math.round(num(f.n1, 1))), n2 = Math.max(1, Math.round(num(f.n2, 1)));
    const p1 = num(f.p1), p2 = num(f.p2), e1b = num(f.e1b);
    const ts = []; for (let k = 0; k < n2; k++) ts.push((k - (n2 - 1) / 2) * p2);
    const pts = [];
    for (let j = 0; j < n1; j++) ts.forEach((t) => pts.push({ x: g / 2 + e1b + j * p1, t }));
    return { pts, n1, n2, ts, p1, p2, e1: num(f.e1), e1b };
  }

  // Répartition élastique : torseur (Fx, Ft, M0) donné à l'axe du joint (x = 0, t = 0).
  function groupForces(G, Fx, Ft, M0) {
    const n = G.pts.length;
    const xc = G.pts.reduce((a, p) => a + p.x, 0) / n, tc = G.pts.reduce((a, p) => a + p.t, 0) / n;
    const Mc = M0 + (-xc) * Ft - (-tc) * Fx;            // moment rapporté au centre du groupe
    const Ip = G.pts.reduce((a, p) => a + (p.x - xc) ** 2 + (p.t - tc) ** 2, 0);
    return G.pts.map((p) => {
      const fx = Fx / n + (Ip > 0 ? -Mc * (p.t - tc) / Ip : 0);
      const ft = Ft / n + (Ip > 0 ? Mc * (p.x - xc) / Ip : 0);
      return { fx, ft, f: Math.hypot(fx, ft) };
    });
  }

  // ---------- répartition du torseur entre les plats ----------
  function distribution(S, L, share) {
    const hf = S.h - S.tf, Af = S.b * S.tf, Aw = S.A - 2 * Af;
    const Iyw = S.tw * Math.pow(S.h - 2 * S.tf, 3) / 12;
    const eta = share === 'semelles' ? 0 : Math.min(1, Iyw / S.Iy);
    const z = () => ({ top: { Fx: 0, Ft: 0, M: 0 }, web: { Fx: 0, Ft: 0, M: 0 }, bot: { Fx: 0, Ft: 0, M: 0 } });
    const per = {};
    // Convention : Fx > 0 = compression dans la partie ; Ft le long de t ; M dans le plan de la partie.
    per.N = z(); per.N.top.Fx = L.N * Af / S.A; per.N.bot.Fx = L.N * Af / S.A; per.N.web.Fx = L.N * Aw / S.A;
    per.Vy = z(); per.Vy.top.Ft = L.Vy / 2; per.Vy.bot.Ft = L.Vy / 2;
    per.Vz = z(); per.Vz.web.Ft = L.Vz;
    per.Mx = z(); per.Mx.top.Ft = L.Mx / hf; per.Mx.bot.Ft = -L.Mx / hf;
    per.My = z(); per.My.top.Fx = L.My * (1 - eta) / hf; per.My.bot.Fx = -L.My * (1 - eta) / hf; per.My.web.M = L.My * eta;
    per.Mz = z(); per.Mz.top.M = L.Mz / 2; per.Mz.bot.M = L.Mz / 2;
    const tot = z();
    COMPS.forEach((c) => ['top', 'web', 'bot'].forEach((g) => ['Fx', 'Ft', 'M'].forEach((k) => { tot[g][k] += per[c.id][g][k]; })));
    return { per, tot, eta, hf, Af, Aw };
  }

  // ---------- pression diamétrale (tableau 3.4) ----------
  function bearing(d, d0, t, fu, fub, gM2, geo) {
    // geo : { eEnd, pAlong, nAlong, eEdge, pPerp, nPerp } pour une direction d'effort
    const ad = Math.min(geo.eEnd / (3 * d0), geo.nAlong > 1 ? geo.pAlong / (3 * d0) - 0.25 : Infinity);
    const ab = Math.max(0, Math.min(ad, fub / fu, 1));
    const k1 = Math.max(0, Math.min(2.8 * geo.eEdge / d0 - 1.7, geo.nPerp > 1 ? 1.4 * geo.pPerp / d0 - 1.7 : Infinity, 2.5));
    return { ab, k1, Fb: k1 * ab * fu * d * t / gM2 };
  }

  // ======================================================================
  const loadOf = (s, idx) => { const L = Array.isArray(s.loads) && s.loads.length ? s.loads : [{}]; return L[Math.max(0, Math.min(L.length - 1, idx == null ? (+s.cur || 0) : idx))]; };
  function compute(s, idx) {
    const LD = loadOf(s, idx);
    const R = { valid: true, warnings: [], checks: [] };
    const S = beamOf(s); R.S = S;
    if (!S) { R.valid = false; R.warnings.push('Section invalide : profil en I à ailes parallèles ou PRS requis.'); return R; }
    const g = Math.max(0, num(s.gap));
    const gam = { M0: num(s.gam.M0, 1) || 1, M2: num(s.gam.M2, 1.25) || 1.25, M3: num(s.gam.M3, 1.25) || 1.25, M3ser: num(s.gam.M3ser, 1.1) || 1.1 };
    const b = s.bolt, d = num(b.d, 20), As = BOLTS[d] || 245, d0 = d0Of(d), Ab = PI * d * d / 4;
    const bc = CLASSES[b.cls] || CLASSES['8.8'];
    const pre = !!b.pre && (b.cls === '8.8' || b.cls === '10.9');
    if (b.pre && !pre) R.warnings.push('Précontrainte : seules les classes 8.8 et 10.9 sont admises (EN 1993-1-8 § 3.1.2) — calcul en boulons ordinaires.');
    const cat = pre ? (b.cat === 'B' ? 'B' : 'C') : 'A';
    const fy = D.fyOf(s.grade, S.tf, 'en10025'), fu = fuOf(s.grade, S.tf);
    R.g = g; R.gam = gam; R.cat = cat; R.pre = pre;
    R.bolt = { d, d0, As, Ab, fub: bc.fub, cls: b.cls, threads: b.threads !== false };
    const Lk = { N: num(LD.N) * 1e3, Vy: num(LD.Vy) * 1e3, Vz: num(LD.Vz) * 1e3, Mx: num(LD.Mx) * 1e6, My: num(LD.My) * 1e6, Mz: num(LD.Mz) * 1e6 };
    R.loadName = LD.name || '';
    R.L = Lk;
    const dist = distribution(S, Lk, s.myShare); R.dist = dist;
    R.mat = { fy, fu };

    // ---------- groupes ----------
    const FG = flangeBolts(s, g), WG = webBolts(s, g);
    R.geo = { fl: FG, web: WG };
    // résistance d'un boulon au cisaillement (par plan) et réduction des joints longs (3.8)
    const avA = R.bolt.threads ? bc.av * As : 0.6 * Ab;
    const FvPlane = avA * bc.fub / gam.M2;
    const betaLf = (Lj) => (Lj > 15 * d ? Math.max(0.75, Math.min(1, 1 - (Lj - 15 * d) / (200 * d))) : 1);
    const FpC = 0.7 * bc.fub * As;
    const ks = KS[b.holes] || 1, mu = MU[b.surf] || 0.4;
    R.bolt.FvPlane = FvPlane; R.bolt.FpC = FpC; R.bolt.ks = ks; R.bolt.mu = mu;

    const comps = COMPS.map((c) => c.id);
    const groups = {};
    const fyp = (t) => D.fyOf(s.plateGrade, t, 'en10025'), fup = (t) => fuOf(s.plateGrade, t);

    // --- semelles
    ['top', 'bot'].forEach((k) => {
      const P = s[k], dbl = !!P.double;
      const bo = num(P.bo), to = num(P.to), bi = num(P.bi), ti = num(P.ti);
      const nPl = dbl ? 2 : 1;
      const tIn0 = S.tw / 2 + S.r + 2;                        // bord intérieur des plats intérieurs (2 mm de jeu au congé)
      const Ao = bo * to, Ai = dbl ? 2 * bi * ti : 0;
      const shO = Ao / (Ao + Ai), shI = 1 - shO;
      const tmax = Math.max(...FG.ts.map(Math.abs)), tmin = Math.min(...FG.ts.map(Math.abs));
      const plies = [
        { id: 'beam', label: 'Semelle de la poutre', t: S.tf, fu, share: 1, eEnd: FG.e1b, eEdge: S.b / 2 - tmax },
        { id: 'outer', label: 'Plat extérieur', t: to, fu: fup(to), share: shO, eEnd: FG.e1, eEdge: bo / 2 - tmax }
      ];
      if (dbl) plies.push({ id: 'inner', label: 'Plats intérieurs', t: ti, fu: fup(ti), share: shI, eEnd: FG.e1, eEdge: Math.min(tmin - tIn0, tIn0 + bi - tmax) });
      const loads = {}; comps.forEach((c) => { const q = dist.per[c][k]; loads[c] = groupForces(FG, q.Fx, q.Ft, q.M); });
      const tq = dist.tot[k];
      const tot = groupForces(FG, tq.Fx, tq.Ft, tq.M);
      const Lj = (FG.n1 - 1) * FG.p1;
      groups[k] = {
        id: k, kind: 'flange', G: FG, dbl, nPl, plies, loads, tot, Lj, bL: betaLf(Lj), force: tq,
        plate: { bo, to, bi, ti, tIn0, A: Ao + Ai, Ao, Ai,
          Anet: Ao - FG.n2 * d0 * to + (dbl ? Ai - FG.n2 * d0 * ti : 0),
          W: to * bo * bo / 6 + (dbl ? 2 * (ti * Math.pow(bi, 3) / 12 + ti * bi * Math.pow(tIn0 + bi / 2, 2)) / (bo / 2) : 0),
          fy: fyp(Math.max(to, dbl ? ti : 0)), fu: fup(Math.max(to, dbl ? ti : 0)), tmin: dbl ? Math.min(to, ti) : to }
      };
      if (dbl && tIn0 + bi > S.b / 2 + 1e-6) R.warnings.push(`${k === 'top' ? 'Semelle supérieure' : 'Semelle inférieure'} : les plats intérieurs (${bi} mm) dépassent du bord de la semelle (place disponible ${(S.b / 2 - tIn0).toFixed(0)} mm depuis le congé).`);
      if (dbl && (tmin - d0 / 2 < tIn0 || tmax + d0 / 2 > tIn0 + bi)) R.warnings.push(`${k === 'top' ? 'Semelle supérieure' : 'Semelle inférieure'} : des trous de boulons sortent des plats intérieurs — revoir la pince w ou la largeur b_i.`);
      if (tmax + d0 / 2 > bo / 2) R.warnings.push(`${k === 'top' ? 'Semelle supérieure' : 'Semelle inférieure'} : les trous sortent du plat extérieur.`);
    });
    if (FG.ts.some((t) => Math.abs(t) - 0.9 * d < S.tw / 2 + S.r)) R.warnings.push(`Semelles : les lignes de boulons les plus proches de l'âme (|t| = ${(Math.min(...FG.ts.map(Math.abs))).toFixed(0)} mm) laissent moins de place qu'une rondelle (≈ 1,8·d) contre le congé de raccordement (t_w/2 + r = ${(S.tw / 2 + S.r).toFixed(1)} mm).`);

    // --- âme
    {
      const P = s.web, hp = num(P.hp), tp = num(P.tp);
      const zmax = Math.max(...WG.ts.map(Math.abs));
      const hw = S.h - 2 * S.tf;
      const plies = [
        { id: 'beam', label: 'Âme de la poutre', t: S.tw, fu, share: 1, eEnd: WG.e1b, eEdge: hw / 2 - zmax },
        { id: 'plate', label: 'Plats d\'âme (×2)', t: tp, fu: fup(tp), share: 0.5, eEnd: WG.e1, eEdge: hp / 2 - zmax }
      ];
      const loads = {}; comps.forEach((c) => { const q = dist.per[c].web; loads[c] = groupForces(WG, q.Fx, q.Ft, q.M); });
      const tq = dist.tot.web;
      const Lj = (WG.n1 - 1) * WG.p1;
      groups.web = {
        id: 'web', kind: 'web', G: WG, nPl: 2, plies, loads, tot: groupForces(WG, tq.Fx, tq.Ft, tq.M), Lj, bL: betaLf(Lj), force: tq,
        plate: { hp, tp, A: 2 * hp * tp, Anet: 2 * (hp - WG.n2 * d0) * tp, W: 2 * tp * hp * hp / 6, fy: fyp(tp), fu: fup(tp) }
      };
      if (hp > hw - 2 * S.r + 1e-6) R.warnings.push(`Âme : la hauteur des plats (${hp} mm) dépasse la hauteur droite entre congés (${(hw - 2 * S.r).toFixed(0)} mm).`);
      if (zmax + d0 / 2 > hp / 2) R.warnings.push('Âme : les trous sortent des plats d\'âme.');
    }
    R.groups = groups;

    // ---------- dispositions constructives (tableau 3.3) ----------
    const minChk = (lbl, v, lim) => { if (v < lim - 1e-6) R.warnings.push(`${lbl} = ${v.toFixed(1)} mm < ${lim.toFixed(1)} mm (EN 1993-1-8 tableau 3.3).`); };
    ['top', 'bot', 'web'].forEach((k) => {
      const G = groups[k], nm = k === 'web' ? 'Âme' : k === 'top' ? 'Semelle sup.' : 'Semelle inf.';
      G.plies.forEach((p) => { minChk(`${nm} · ${p.label.toLowerCase()} : pince longitudinale e₁`, p.eEnd, 1.2 * d0); minChk(`${nm} · ${p.label.toLowerCase()} : pince transversale e₂`, p.eEdge, 1.2 * d0); });
      if (G.G.n1 > 1) minChk(`${nm} : entraxe p₁`, G.G.p1, 2.2 * d0);
      if (k === 'web' && G.G.n2 > 1) minChk(`${nm} : entraxe p₂`, G.G.p2, 2.4 * d0);
      if (k !== 'web' && G.G.n2s > 1) minChk(`${nm} : entraxe p₂`, G.G.p2, 2.4 * d0);
    });
    if (s.fl.n2s < 2 && num(s.fl.w) < 2.4 * d0) R.warnings.push('Semelles : pince w entre les deux lignes trop faible.');

    // ---------- vérifications ----------
    const add = (grp, id, label, ref, Ed, Rd, extra) => {
      const r = Rd > 0 ? Math.abs(Ed) / Rd : (Math.abs(Ed) > 0 ? Infinity : 0);
      R.checks.push(Object.assign({ grp, id, label, ref, Ed, Rd, r }, extra || {}));
    };
    const fyb = fy;
    ['top', 'web', 'bot'].forEach((k) => {
      const G = groups[k], gl = GROUPS.find((x) => x.id === k).label;
      const imax = G.tot.reduce((a, f, i) => (f.f > G.tot[a].f ? i : a), 0);
      const fm = G.tot[imax];
      G.imax = imax;
      // cisaillement des boulons
      // fourrure sous les plats de semelle (3.6.1 (12)) : β_p = 9d/(8d + 3t_p) si t_p > d/3
      const pack = G.kind === 'flange' ? Math.max(0, num(s[k].pack)) : 0;
      G.pack = pack; G.bp = pack > d / 3 ? Math.min(1, 9 * d / (8 * d + 3 * pack)) : 1;
      const Fv = FvPlane * G.nPl * G.bL * G.bp;
      G.Fv = Fv;
      if (cat !== 'C') add(k, 'v', `Boulons — cisaillement (${G.nPl} plan${G.nPl > 1 ? 's' : ''}${G.bL < 1 ? ', β_Lf = ' + G.bL.toFixed(3) : ''}${G.bp < 1 ? ', β_p = ' + G.bp.toFixed(3) : ''})`, '3.6.1 tab. 3.4', fm.f, Fv);
      else add(k, 'v', `Boulons — cisaillement (${G.nPl} plan${G.nPl > 1 ? 's' : ''})`, '3.6.1 tab. 3.4', fm.f, Fv);
      // glissement
      if (cat !== 'A') {
        const Fs = ks * G.nPl * mu * FpC / (cat === 'C' ? gam.M3 : gam.M3ser);
        G.Fs = Fs;
        add(k, 's', cat === 'C' ? 'Boulons précontraints — glissement à l\'ELU (cat. C)' : 'Boulons précontraints — glissement à l\'ELS (cat. B)', '3.9.1 (3.6)', cat === 'C' ? fm.f : fm.f * num(b.kser, 0.7), Fs);
      }
      // pression diamétrale, par pli, interaction vectorielle des deux directions
      G.plies.forEach((p) => {
        const Gg = G.G;
        const nPerpX = k === 'web' ? Gg.n2 : Gg.n2;
        const pPerpX = k === 'web' ? Gg.p2 : (Gg.n2s > 1 ? Gg.p2 : Gg.w);
        const bx = bearing(d, d0, p.t, p.fu, bc.fub, gam.M2, { eEnd: p.eEnd, pAlong: Gg.p1, nAlong: Gg.n1, eEdge: p.eEdge, pPerp: pPerpX, nPerp: nPerpX });
        const bt = bearing(d, d0, p.t, p.fu, bc.fub, gam.M2, { eEnd: p.eEdge, pAlong: pPerpX, nAlong: nPerpX, eEdge: p.eEnd, pPerp: Gg.p1, nPerp: Gg.n1 });
        // pli intérieur : chaque boulon ne traverse qu'un des deux plats intérieurs
        let worst = 0, iw = 0;
        G.tot.forEach((f, i) => { const v = Math.hypot(f.fx * p.share / bx.Fb, f.ft * p.share / bt.Fb); if (v > worst) { worst = v; iw = i; } });
        const f = G.tot[iw];
        add(k, 'b_' + p.id, `Pression diamétrale — ${p.label.toLowerCase()} (t = ${p.t} mm)`, '3.6.1 tab. 3.4', worst, 1,
          { note: `F_x = ${(f.fx * p.share / 1e3).toFixed(1)} kN / F_b,x,Rd = ${(bx.Fb / 1e3).toFixed(1)} kN (k₁ = ${bx.k1.toFixed(2)}, α_b = ${bx.ab.toFixed(2)}) ; F_t = ${(f.ft * p.share / 1e3).toFixed(1)} kN / F_b,t,Rd = ${(bt.Fb / 1e3).toFixed(1)} kN (k₁ = ${bt.k1.toFixed(2)}, α_b = ${bt.ab.toFixed(2)}) ; √(Σ²)`, ratioOnly: true, bx, bt });
        p.bx = bx; p.bt = bt;
      });

      // ---------- plats ----------
      const PL = G.plate, F = G.force, fyP = PL.fy, fuP = PL.fu;
      const xc0 = g / 2 + G.G.e1b;                 // première file de boulons
      if (G.kind === 'flange') {
        const Npl = PL.A * fyP / gam.M0, Nu = 0.9 * PL.Anet * fuP / gam.M2, Nnet = PL.Anet * fyP / gam.M0;
        if (F.Fx < 0) {
          add(k, 'pt', 'Plats — traction, section brute', '6.2.3 (6.6)', -F.Fx, Npl);
          add(k, 'pu', `Plats — traction, section nette${cat === 'C' ? ' (cat. C : A_net·f_y)' : ''}`, cat === 'C' ? '3.4.1 (1) c)' : '6.2.3 (6.7)', -F.Fx, cat === 'C' ? Nnet : Nu);
        } else if (F.Fx > 0) {
          const Lc = 0.6 * (g + 2 * G.G.e1b), i = PL.tmin / Math.sqrt(12);
          const lam = Lc / i / (PI * Math.sqrt(210000 / fyP));
          const phi = 0.5 * (1 + 0.49 * (lam - 0.2) + lam * lam), chi = lam <= 0.2 ? 1 : Math.min(1, 1 / (phi + Math.sqrt(phi * phi - lam * lam)));
          add(k, 'pc', `Plats — compression avec flambement entre boulons (L_cr = 0,6·(g + 2e₁) = ${Lc.toFixed(0)} mm, χ = ${chi.toFixed(3)})`, '6.3.1 · 1-8 tab. 3.3 (2)', F.Fx, chi * Npl);
        }
        // flexion dans le plan (M_z, V_y, torsion) + effort axial, section brute à l'axe du joint
        const Vpl = PL.A * fyP / (Math.sqrt(3) * gam.M0);
        const rho = Math.abs(F.Ft) > 0.5 * Vpl ? Math.pow(2 * Math.abs(F.Ft) / Vpl - 1, 2) : 0;
        add(k, 'pv', 'Plats — cisaillement transversal', '6.2.6', F.Ft, Vpl);
        if (Math.abs(F.M) > 0 || Math.abs(F.Ft) > 0) {
          const Mnet = Math.abs(F.M + F.Ft * xc0);
          const etaG = Math.abs(F.Fx) / (PL.A * fyP * (1 - rho) / gam.M0) + Math.abs(F.M) / (PL.W * fyP * (1 - rho) / gam.M0);
          const etaN = Math.abs(F.Fx) / (PL.Anet * fyP / gam.M0) + Mnet / (PL.W * PL.Anet / PL.A * fyP / gam.M0);
          add(k, 'pm', `Plats — effort axial + flexion dans le plan (joint : M = ${(F.M / 1e6).toFixed(2)} kN·m ; 1ʳᵉ file, nette : ${(Mnet / 1e6).toFixed(2)} kN·m)`, '6.2.1 (6.2)', Math.max(etaG, etaN), 1, { ratioOnly: true });
        }
        // rupture en bloc des plats et de la semelle, en traction
        if (F.Fx < 0) {
          const blk = (t, e1, Wpl, fyx, fux) => {
            const Lv = e1 + (G.G.n1 - 1) * G.G.p1 - (G.G.n1 - 0.5) * d0;
            const outer = Math.max(...G.G.ts);
            const span = 2 * outer;
            const a = fux * (span - (G.G.n2 - 1) * d0) * t / gam.M2 + fyx * 2 * Lv * t / (Math.sqrt(3) * gam.M0);   // bloc central entre lignes extrêmes
            const b2 = fux * 2 * (Wpl / 2 - outer - d0 / 2) * t / gam.M2 + fyx * 2 * Lv * t / (Math.sqrt(3) * gam.M0);  // arrachement des deux bords
            return Math.min(a, b2);
          };
          const Vb = blk(PL.to, G.G.e1, PL.bo, fyP, fuP);
          add(k, 'pbt', 'Plat extérieur — rupture en bloc', '3.10.2 (3.9)', -F.Fx * (PL.Ao / PL.A), Vb);
          add(k, 'bbt', 'Semelle de la poutre — rupture en bloc', '3.10.2 (3.9)', -F.Fx, blk(S.tf, G.G.e1b, S.b, fyb, fu));
          add(k, 'bnet', 'Semelle de la poutre — section nette', '6.2.3 (6.7)', -F.Fx, 0.9 * (S.b - G.G.n2 * d0) * S.tf * fu / gam.M2);
        }
      } else {
        const Vpl = PL.A * fyP / (Math.sqrt(3) * gam.M0), Vnet = PL.Anet * fuP / (Math.sqrt(3) * gam.M2);
        add(k, 'pv', 'Plats d\'âme — cisaillement, section brute', '6.2.6 (6.18)', F.Ft, Vpl);
        add(k, 'pvn', 'Plats d\'âme — cisaillement, section nette', '6.2.6 · 3.10.2', F.Ft, Vnet);
        const rho = Math.abs(F.Ft) > 0.5 * Vpl ? Math.pow(2 * Math.abs(F.Ft) / Vpl - 1, 2) : 0;
        const Mnet = Math.abs(F.M + F.Ft * xc0);
        const fyr = fyP * (1 - rho) / gam.M0;
        const etaG = Math.abs(F.Fx) / (PL.A * fyr) + Math.abs(F.M) / (PL.W * fyr);
        const Wn = 2 * PL.tp * (Math.pow(PL.hp, 3) / 12 - G.G.ts.reduce((a, z) => a + d0 * d0 * d0 / 12 + d0 * z * z, 0)) / (PL.hp / 2);
        const etaN = Math.abs(F.Fx) / (PL.Anet * fyr) + Mnet / (Wn * fyr);
        add(k, 'pm', `Plats d'âme — N + M (joint : M = ${(F.M / 1e6).toFixed(2)} kN·m ; 1ʳᵉ file, nette : ${(Mnet / 1e6).toFixed(2)} kN·m${rho > 0 ? ', ρ = ' + rho.toFixed(3) : ''})`, '6.2.8 · 6.2.1 (6.2)', Math.max(etaG, etaN), 1, { ratioOnly: true });
        // rupture en bloc sous V_z (charge excentrée, 3.10.2 (3))
        const Ant = (G.G.e1 + (G.G.n1 - 1) * G.G.p1 - (G.G.n1 - 0.5) * d0) * PL.tp;
        const Anv = (PL.hp / 2 - Math.max(...G.G.ts) + (G.G.n2 - 1) * G.G.p2 - (G.G.n2 - 0.5) * d0) * PL.tp;
        add(k, 'pbt', 'Plats d\'âme — rupture en bloc sous V_z', '3.10.2 (3.10)', F.Ft, 2 * (0.5 * fuP * Ant / gam.M2 + fyP * Anv / (Math.sqrt(3) * gam.M0)));
        add(k, 'bnet', 'Âme de la poutre — cisaillement, section nette', '6.2.6 · 3.10.2', F.Ft, (S.Avz - G.G.n2 * d0 * S.tw) * fu / (Math.sqrt(3) * gam.M2));
      }
    });
    // 3.12 : répartition plastique admise en catégorie C, ou si F_v,Rd > F_b,Rd (pression diamétrale déterminante)
    ['top', 'web', 'bot'].forEach((k) => {
      const G = groups[k];
      const Fb = Math.min(...G.plies.map((p) => Math.min(p.bx.Fb, p.bt.Fb) / p.share));
      G.plast = cat === 'C' || G.Fv > Fb;
    });
    R.info = [];
    if (cat === 'A') R.info.push('Catégorie A : le jeu des trous permet un glissement, d’où une rotation et une flèche supplémentaires au joint. Pour une éclisse de continuité, envisager des boulons précontraints (catégorie B) ou ajustés.');
    if (s.top.pack > 0 || s.bot.pack > 0) R.info.push('Fourrures sous les plats de semelles : réduction β_p appliquée au cisaillement des boulons au-delà de t_p = d/3 (3.6.1 (12)).');
    R.max = R.checks.reduce((a, c) => Math.max(a, c.r), 0);
    R.gov = R.checks.reduce((a, c) => (!a || c.r > a.r ? c : a), null);
    return R;
  }

  // Géométrie proposée pour le profil courant : plats d'aire au moins égale à la partie éclissée,
  // pinces ≥ 1,5·d0, une ligne de boulons par côté de l'âme au milieu des plats intérieurs.
  function propose(s) {
    const S = beamOf(s); if (!S) return false;
    const d = num(s.bolt.d, 20), d0 = d0Of(d);
    const STD = [6, 8, 10, 12, 15, 20, 25, 30, 35, 40, 50, 60];
    const up = (t) => STD.find((x) => x >= t - 1e-9) || Math.ceil(t / 5) * 5;
    const r5 = (x) => Math.floor(x / 5) * 5;
    const tIn0 = S.tw / 2 + S.r + 2;
    const bo = r5(S.b), bi = r5(S.b / 2 - tIn0 - 5);
    const roomIn = bi >= 2 * Math.ceil(1.2 * d0);          // place pour des plats intérieurs
    // ligne de boulons : au milieu des plats intérieurs, ou entre le congé (+ rondelle) et la pince de bord
    const tl = roomIn ? tIn0 + bi / 2 : ((S.tw / 2 + S.r + 0.9 * d) + (S.b / 2 - 1.5 * d0)) / 2;
    const w = 2 * Math.round(tl / 2.5) * 2.5;
    const e = Math.ceil(1.5 * d0 / 5) * 5, p = Math.ceil(3 * d0 / 5) * 5;
    ['top', 'bot'].forEach((k) => {
      const P = s[k], dbl = P.double !== false && roomIn;
      const tpl = up(S.b * S.tf / (bo + (dbl ? 2 * bi : 0)));
      Object.assign(P, { double: dbl, bo, to: tpl, bi, ti: tpl });
    });
    const Af = S.b * S.tf, n1 = Math.min(8, Math.max(2, Math.ceil(0.9 * Af * D.fyOf(s.grade, S.tf, 'en10025') / (2 * 0.6 * CLASSES[s.bolt.cls].fub * (BOLTS[d] || 245) / 1.25) / 2)));
    Object.assign(s.fl, { n1, p1: p, e1: e, e1b: e, n2s: 1, w });
    const hw = S.h - 2 * S.tf, hp = Math.max(r5(hw - 2 * S.r - 10), 2 * e);
    const n2 = Math.max(1, Math.floor((hp - 2 * e) / p) + 1), p2 = n2 > 1 ? r5((hp - 2 * e) / (n2 - 1)) : p;
    Object.assign(s.web, { n1: 2, p1: p, e1: e, e1b: e, n2, p2, hp, tp: up(Math.max(S.tw * hw / (2 * hp), S.tw * Math.pow(hw, 3) / (2 * Math.pow(hp, 3)))) });
    return true;
  }

  // Enveloppe sur tous les torseurs : pour chaque critère, le torseur le plus défavorable
  function computeEnv(s) {
    const n = Array.isArray(s.loads) && s.loads.length ? s.loads.length : 1;
    const runs = []; for (let i = 0; i < n; i++) runs.push(compute(s, i));
    const rows = [], idx = {};
    runs.forEach((r, i) => (r.checks || []).forEach((c) => {
      const key = c.grp + '|' + c.id;
      if (!(key in idx)) { idx[key] = rows.length; rows.push(Object.assign({}, c, { idx: i, name: r.loadName })); }
      else if (c.r > rows[idx[key]].r) rows[idx[key]] = Object.assign({}, c, { idx: i, name: r.loadName });
    }));
    const order = { top: 0, web: 1, bot: 2 };
    rows.sort((a, b) => order[a.grp] - order[b.grp]);
    const max = rows.reduce((a, c) => Math.max(a, c.r), 0);
    const gov = rows.reduce((a, c) => (!a || c.r > a.r ? c : a), null);
    return { runs, rows, max, gov, govIdx: gov ? gov.idx : 0, valid: runs.every((r) => r.valid), perLoad: runs.map((r) => r.max) };
  }

  function summary(st) {
    try {
      const r = computeEnv(st); r.bolt = r.runs[0].bolt; r.S = r.runs[0].S; r.pre = r.runs[0].pre;
      return { type: 'Éclisse', sec: r.S ? `${r.S.name} · M${r.bolt.d} ${r.bolt.cls}${r.pre ? ' HR' : ''}` : '—', gov: r.gov ? r.gov.label.replace(/\s*\(.*$/, '') : '', max: r.valid ? r.max : null };
    } catch (e) { return null; }
  }

  window.FirmitasSpliceCalc = { compute, computeEnv, propose, defaultState, upgrade, summary, BOLTS, CLASSES, MU, KS, COMPS, GROUPS, d0Of, fuOf, num, beamOf };
})();
