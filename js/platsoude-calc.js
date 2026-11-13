/* ==========================================================================
   Firmitas — attache par plat soudé (« fin plate ») : extrémité de poutre en I
   boulonnée sur un plat soudé à une poutre support.
   NF EN 1993-1-8 (+ AN), démarche du guide SCI P358 pour les plats soudés.
   Hors vérification : poutre support et soudure du plat sur la poutre support.
   Unités internes : N, mm, MPa. Entrées : kN, mm.
   Repère : x le long de la poutre portée depuis la face de la poutre support (x = 0),
   z vertical vers le haut, centre du groupe de boulons à z = 0.
   Convention : V_Ed > 0 = réaction d'appui de la poutre portée (charge descendante) ;
   N_Ed > 0 = traction (la poutre tire sur l'attache), < 0 = compression.
   ========================================================================== */
(function () {
  'use strict';
  const SC = window.FirmitasSpliceCalc, D = window.FIRMITAS_DATA;
  const { num, BOLTS, CLASSES, d0Of, fuOf, groupForces, bearing } = SC;
  // Ductilité (SCI P358, détails recommandés) : t_p et t_w ≤ 0,50·d (S275) ou 0,42·d (S355)
  const DUCT = { S235: 0.5, S275: 0.5, S355: 0.42, S420: 0.42, S460: 0.42 };
  const PI = Math.PI, BIG = 1e9;

  function defaultState() {
    return {
      v: 1, kind: 'platsoude', name: 'Attache A1',
      sec: { kind: 'cat', fam: 'IPE', name: 'IPE 360', prs: { h: 500, b: 200, tw: 10, tf: 16 } },
      grade: 'S355', plateGrade: 'S355',
      bolt: { d: 20, cls: '8.8', threads: true },
      gam: { M0: 1, M2: 1.25 },
      gap: 10,
      plate: { tp: 10, zTop: 35 },
      bolts: { n1: 4, n2: 1, p1: 70, p2: 60, e1: 40, e2p: 45, e2b: 40 },
      cur: 0,
      loads: [{ name: 'ELU 1', V: 180, N: 0 }, { name: 'ELU 2 — chaînage', V: 60, N: 75 }]
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

  // ---------- géométrie ----------
  function geometry(s, S) {
    const B = s.bolts, n1 = Math.max(1, Math.round(num(B.n1, 1))), n2 = Math.max(1, Math.round(num(B.n2, 1)));
    const p1 = num(B.p1), p2 = num(B.p2), e1 = num(B.e1), e2p = num(B.e2p), e2b = num(B.e2b), g = Math.max(0, num(s.gap));
    const tp = num(s.plate.tp), zTop = num(s.plate.zTop);
    const hp = 2 * e1 + (n1 - 1) * p1;
    const a = g + e2b;                                       // face d'appui → 1re file de boulons
    const bp = a + (n2 - 1) * p2 + e2p;                      // largeur du plat (débord depuis l'appui)
    const pts = [];
    for (let j = 0; j < n2; j++) for (let i = 0; i < n1; i++) pts.push({ x: a + j * p2, t: ((n1 - 1) / 2 - i) * p1 });
    const zc = a + (n2 - 1) * p2 / 2;                         // excentrement face d'appui → centre du groupe
    // position verticale : z mesuré depuis le haut de la poutre jusqu'au haut du plat ; centre du groupe sous le haut de poutre
    const zG = zTop + hp / 2;
    return { n1, n2, p1, p2, e1, e2p, e2b, g, tp, zTop, hp, a, bp, pts, zc, zG, h: S.h };
  }

  function compute(s, idx) {
    const R = { valid: true, warnings: [], info: [], checks: [] };
    const S = SC.beamOf(s); R.S = S;
    if (!S) { R.valid = false; R.warnings.push('Section invalide : profil en I à ailes parallèles ou PRS requis.'); return R; }
    const LD = loadOf(s, idx); R.loadName = LD.name || '';
    const V = num(LD.V) * 1e3, N = num(LD.N) * 1e3;
    R.L = { V, N };
    const gam = { M0: num(s.gam.M0, 1) || 1, M2: num(s.gam.M2, 1.25) || 1.25 };
    const b = s.bolt, d = num(b.d, 20), As = BOLTS[d] || 245, d0 = d0Of(d), Ab = PI * d * d / 4;
    const bc = CLASSES[b.cls] || CLASSES['8.8'];
    const threads = b.threads !== false;
    const Fv1 = (threads ? bc.av * As : 0.6 * Ab) * bc.fub / gam.M2;
    R.bolt = { d, d0, As, Ab, fub: bc.fub, cls: b.cls, threads, FvPlane: Fv1 };
    {
      const B = s.bolts, pos = [['n₁', B.n1], ['n₂', B.n2], ['p₁', num(B.n1) > 1 ? B.p1 : 1], ['p₂', num(B.n2) > 1 ? B.p2 : 1], ['e₁', B.e1], ['e₂,p', B.e2p], ['e₂,b', B.e2b], ['t_p', s.plate.tp]].filter((q) => !(num(q[1]) > 0));
      if (pos.length) { R.valid = false; R.warnings.push('Données invalides (valeurs nulles ou négatives) : ' + pos.map((q) => q[0]).join(', ') + '.'); return R; }
    }
    const G = geometry(s, S); R.geo = G;
    const tp = G.tp, fyp = D.fyOf(s.plateGrade, tp, 'en10025'), fup = fuOf(s.plateGrade, tp);
    const fyb = D.fyOf(s.grade, S.tf, 'en10025'), fub = fuOf(s.grade, S.tf);
    R.mat = { fyp, fup, fyb, fub };
    R.gam = gam;
    const hw = S.h - 2 * S.tf;

    // ---------- contrôles géométriques (tableau 3.3 et encombrement) ----------
    const gChk = [];
    const geoC = (id, label, need, have, note, grpId) => gChk.push({ grp: grpId || 'plate', id, label, ref: '1-8 tab. 3.3 · géométrie', Ed: need, Rd: have, rg: have > 0 ? Math.max(0, need) / have : Infinity, r: !(have > 0) || need > have + 1e-6 ? (have > 0 ? need / have : Infinity) : 0, ratioOnly: true, geo: true, note });
    const warnMin = (lbl, v, lim, grpId) => geoC('g' + gChk.length, lbl + ' ≥ min', lim, v, `${v.toFixed(1)} mm ≥ ${lim.toFixed(1)} mm`, grpId);
    warnMin('Plat : pince verticale e₁', G.e1, 1.2 * d0);
    warnMin('Plat : pince horizontale e₂ (bord libre)', G.e2p, 1.2 * d0);
    warnMin('Âme : pince e₂,b (about de poutre)', G.e2b, 1.2 * d0, 'web');
    if (G.n1 > 1) warnMin('Entraxe vertical p₁', G.p1, 2.2 * d0);
    if (G.n2 > 1) warnMin('Entraxe horizontal p₂', G.p2, 2.4 * d0);
    geoC('g_top', 'Géométrie — haut du plat sous la semelle et le congé', S.tf + S.r, G.zTop, `z_haut = ${G.zTop} mm ≥ t_f + r = ${(S.tf + S.r).toFixed(1)} mm`, 'web');
    geoC('g_bot', 'Géométrie — bas du plat au-dessus de la semelle inf. et du congé', G.zTop + G.hp, S.h - S.tf - S.r, `z_bas = ${(G.zTop + G.hp).toFixed(0)} mm ≤ h − t_f − r = ${(S.h - S.tf - S.r).toFixed(1)} mm`, 'web');
    if (G.g < 10) R.info.push('Jeu entre l\'about de poutre et la poutre support inférieur à 10 mm : vérifier la rotation de l\'attache sans contact.');
    // recommandations de ductilité et de stabilité (guide SCI P358, attaches articulées)
    const kdp = DUCT[s.plateGrade] || 0.42, kdw = DUCT[s.grade] || 0.42;
    if (tp > kdp * d + 1e-9) R.info.push(`Ductilité : t_p = ${tp} mm > ${String(kdp).replace('.', ',')}·d = ${(kdp * d).toFixed(1).replace('.', ',')} mm — le guide SCI P358 recommande t_p ≤ 0,50·d (S275) ou 0,42·d (S355), boulons 8.8 non précontraints, pour que la rotation se fasse par ovalisation des trous avant la rupture des boulons.`);
    if (S.tw > kdw * d + 1e-9) R.info.push(`Ductilité : âme t_w = ${S.tw} mm > ${String(kdw).replace('.', ',')}·d = ${(kdw * d).toFixed(1).replace('.', ',')} mm (même recommandation SCI P358 pour l’âme de la poutre portée).`);
    if (bc.fub !== 800) R.info.push('Le guide SCI P358 est établi pour des boulons de classe 8.8 non précontraints dans des trous normaux.');
    if (Math.min(G.e1, G.e2p, G.e2b) < 2 * d - 1e-6) R.info.push(`Pinces : le guide SCI P358 recommande des pinces ≥ 2·d = ${2 * d} mm sur le plat et l’âme (ductilité, rotation).`);
    if (G.hp < 0.6 * S.h) R.info.push(`Hauteur du plat h_p = ${G.hp.toFixed(0)} mm < 0,6·h = ${(0.6 * S.h).toFixed(0)} mm : maintien en torsion de l'extrémité de poutre à justifier (SCI P358 recommande h_p ≥ 0,6·h).`);
    if (G.a > tp / 0.15) R.info.push(`Plat long : distance soudure – 1re file a = ${G.a.toFixed(0)} mm > t_p/0,15 = ${(tp / 0.15).toFixed(0)} mm — stabilité latérale du plat à justifier (SCI P358).`);
    R.info.push('Hors champ : poutre entaillée (grugeage), soudure du plat (le guide SCI P358 recommande des soudures à pleine résistance) et poutre support.');

    // ---------- efforts dans les boulons (répartition élastique, V excentré de z) ----------
    const grp = { pts: G.pts };
    const forces = groupForces(grp, N, -V, 0);
    const parts = { V: groupForces(grp, 0, -V, 0), N: groupForces(grp, N, 0, 0) };
    R.forces = forces; R.parts = parts;
    const imax = forces.reduce((a, f, i) => (f.f > forces[a].f ? i : a), 0);
    R.imax = imax;
    const fm = forces[imax];
    const add = (grpId, id, label, ref, Ed, Rd, extra) => {
      const r = Rd > 0 ? Math.abs(Ed) / Rd : (Math.abs(Ed) > 0 ? Infinity : 0);
      R.checks.push(Object.assign({ grp: grpId, id, label, ref, Ed, Rd, r }, extra || {}));
    };
    gChk.forEach((c) => R.checks.push(c));

    // --- boulons : cisaillement (1 plan), joint long dans la direction de V
    const Lj = (G.n1 - 1) * G.p1;
    const bL = Lj > 15 * d ? Math.max(0.75, Math.min(1, 1 - (Lj - 15 * d) / (200 * d))) : 1;
    R.bL = bL;
    add('bolts', 'v', `Boulons — cisaillement (1 plan${bL < 1 ? ', β_Lf = ' + bL.toFixed(3) : ''})`, '3.6.1 tab. 3.4 · 3.8', fm.f, Fv1 * bL);

    // --- pression diamétrale : plat et âme, interaction vectorielle des deux directions
    // âme : distance des files extrêmes aux faces intérieures des semelles (pas de bord libre, valeur sécuritaire)
    const eWeb = Math.max(0, Math.min(G.zTop + G.e1 - S.tf, S.h - S.tf - (G.zTop + G.hp - G.e1)));
    R.eWeb = eWeb;
    const plies = [
      { id: 'plate', grp: 'plate', label: 'plat soudé', t: tp, fu: fup,
        x: { eEnd: G.e2p, pAlong: G.p2, nAlong: G.n2, eEdge: G.e1, pPerp: G.p1, nPerp: G.n1 },
        z: { eEnd: G.e1, pAlong: G.p1, nAlong: G.n1, eEdge: G.e2p, pPerp: G.p2, nPerp: G.n2 } },
      { id: 'web', grp: 'web', label: 'âme de la poutre', t: S.tw, fu: fub,
        x: { eEnd: G.e2b, pAlong: G.p2, nAlong: G.n2, eEdge: eWeb, pPerp: G.p1, nPerp: G.n1 },
        z: { eEnd: eWeb, pAlong: G.p1, nAlong: G.n1, eEdge: G.e2b, pPerp: G.p2, nPerp: G.n2 } }
    ];
    plies.forEach((p) => {
      const bx = bearing(d, d0, p.t, p.fu, bc.fub, gam.M2, p.x), bz = bearing(d, d0, p.t, p.fu, bc.fub, gam.M2, p.z);
      let worst = 0, iw = 0;
      forces.forEach((f, i) => { const v = Math.hypot(f.fx / bx.Fb, f.ft / bz.Fb); if (v > worst) { worst = v; iw = i; } });
      const f = forces[iw];
      add(p.grp, 'b', `Pression diamétrale — ${p.label} (t = ${p.t} mm)`, '3.6.1 tab. 3.4', worst, 1, {
        ratioOnly: true, bx, bz,
        note: `F_x = ${(f.fx / 1e3).toFixed(1)} kN / F_b,x,Rd = ${(bx.Fb / 1e3).toFixed(1)} kN (k₁ = ${bx.k1.toFixed(2)}, α_b = ${bx.ab.toFixed(2)}) ; F_z = ${(f.ft / 1e3).toFixed(1)} kN / F_b,z,Rd = ${(bz.Fb / 1e3).toFixed(1)} kN (k₁ = ${bz.k1.toFixed(2)}, α_b = ${bz.ab.toFixed(2)}) ; √(Σ²)`
      });
      p.bx = bx; p.bz = bz;
    });
    R.plies = plies;

    // --- plat soudé
    const Ap = G.hp * tp, Apn = (G.hp - G.n1 * d0) * tp;
    const Vpl = Ap * fyp / (Math.sqrt(3) * gam.M0);
    add('plate', 'pv', 'Plat — cisaillement, section brute (V_pl/1,27 : flexion concomitante)', '6.2.6 (6.18) · SCI P358', V, Vpl / 1.27);
    add('plate', 'pvn', 'Plat — cisaillement, section nette', '6.2.6 · 3.10.2', V, Apn * fup / (Math.sqrt(3) * gam.M2));
    {
      const Ant = (G.e2p + (G.n2 - 1) * G.p2 - (G.n2 - 0.5) * d0) * tp;
      const Anv = (G.e1 + (G.n1 - 1) * G.p1 - (G.n1 - 0.5) * d0) * tp;
      add('plate', 'pbt', 'Plat — rupture en bloc sous V (charge excentrée)', '3.10.2 (3.10)', V, 0.5 * fup * Ant / gam.M2 + fyp * Anv / (Math.sqrt(3) * gam.M0));
    }
    {
      // flexion du plat : M = V·z à la soudure (section brute) et V·(z − a) à la 1re file (section nette), avec N
      const rho = Math.abs(V) > 0.5 * Vpl ? Math.pow(2 * Math.abs(V) / Vpl - 1, 2) : 0;
      const fr = fyp * (1 - rho) / gam.M0;
      const W = tp * G.hp * G.hp / 6;
      const In = tp * (Math.pow(G.hp, 3) / 12 - G.pts.filter((q) => q.x === G.a).reduce((a, q) => a + d0 * d0 * d0 / 12 + d0 * q.t * q.t, 0));
      const Wn = In / (G.hp / 2);
      const M0 = Math.abs(V) * G.zc, M1 = Math.abs(V) * Math.max(0, G.zc - G.a);
      // excentricité hors plan (recouvrement simple) : N agit dans le plan moyen de l'âme, à e_z = (t_w + t_p)/2
      // du plan moyen du plat ; M_z repris en totalité par le plat, constant de la file à la soudure (sécuritaire)
      const ez = (S.tw + tp) / 2, Mz = Math.abs(N) * ez;
      const Wz = G.hp * tp * tp / 4, Wzn = (G.hp - G.n1 * d0) * tp * tp / 4;   // modules plastiques hors plan
      R.ez = ez; R.Mz = Mz; R.Wz = Wz; R.Wzn = Wzn;
      const etaG = Math.abs(N) / (Ap * fr) + M0 / (W * fr) + Mz / (Wz * fr);
      const etaN = Math.abs(N) / (Apn * fr) + M1 / (Wn * fr) + Mz / (Wzn * fr);
      add('plate', 'pm', `Plat — flexion + effort normal (soudure : M = ${(M0 / 1e6).toFixed(2)} kN·m ; 1ʳᵉ file, nette : ${(M1 / 1e6).toFixed(2)} kN·m${Mz > 0 ? ` ; hors plan M_z = N·(t_w+t_p)/2 = ${(Mz / 1e6).toFixed(2)} kN·m` : ''}${rho > 0 ? ', ρ = ' + rho.toFixed(3) : ''})`, '6.2.1 (6.2) (7) · 6.2.8', Math.max(etaG, etaN), 1, { ratioOnly: true, note: Mz > 0 ? `e_z = ${ez.toFixed(1)} mm ; W_z = h_p·t_p²/4 = ${(Wz / 1e3).toFixed(2)} cm³ ; W_z,n = (h_p − n₁·d₀)·t_p²/4 = ${(Wzn / 1e3).toFixed(2)} cm³ ; interaction linéaire N/N_Rd + M/M_Rd + M_z/M_z,Rd` : '' });
      if (Mz > 0) R.info.push(`Excentricité hors plan : M_z = N·(t_w + t_p)/2 = ${(Mz / 1e6).toFixed(2)} kN·m (e_z = ${ez.toFixed(1)} mm) entièrement repris par le plat (sécuritaire ; avec une seule colonne de boulons, une part de ce moment est en réalité reprise en flexion d'axe faible par la poutre portée). La torsion V·e n'est pas vérifiée (couverte par h_p ≥ 0,6·h et le maintien latéral, SCI P358).`);
    }
    if (N > 0) {
      add('plate', 'pt', 'Plat — traction, section brute', '6.2.3 (6.6)', N, Ap * fyp / gam.M0);
      add('plate', 'pu', 'Plat — traction, section nette', '6.2.3 (6.7)', N, 0.9 * Apn * fup / gam.M2);
      const Ant = ((G.n1 - 1) * G.p1 - (G.n1 - 1) * d0) * tp, Anv = 2 * (G.e2p + (G.n2 - 1) * G.p2 - (G.n2 - 0.5) * d0) * tp;
      if (G.n1 > 1) add('plate', 'pbtN', 'Plat — rupture en bloc sous N', '3.10.2 (3.9)', N, fup * Ant / gam.M2 + fyp * Anv / (Math.sqrt(3) * gam.M0));
    } else if (N < 0) {
      add('plate', 'pc', 'Plat — compression, section brute', '6.2.4', -N, Ap * fyp / gam.M0);
    }

    // --- âme de la poutre portée
    add('web', 'wv', 'Âme — cisaillement, section brute (A_v,z)', '6.2.6 (6.18)', V, S.Avz * fyb / (Math.sqrt(3) * gam.M0));
    add('web', 'wvn', 'Âme — cisaillement, section nette à la file de boulons', '6.2.6 · 3.10.2', V, (S.Avz - G.n1 * d0 * S.tw) * fub / (Math.sqrt(3) * gam.M2));
    if (N > 0) {
      add('web', 'wt', 'Âme — traction, section nette', '6.2.3 (6.7)', N, 0.9 * (hw - G.n1 * d0) * S.tw * fub / gam.M2);
      if (G.n1 > 1) {
        const Ant = ((G.n1 - 1) * G.p1 - (G.n1 - 1) * d0) * S.tw, Anv = 2 * (G.e2b + (G.n2 - 1) * G.p2 - (G.n2 - 0.5) * d0) * S.tw;
        add('web', 'wbt', 'Âme — rupture en bloc sous N', '3.10.2 (3.9)', N, fub * Ant / gam.M2 + fyb * Anv / (Math.sqrt(3) * gam.M0));
      }
    }
    R.max = R.checks.reduce((a, c) => Math.max(a, c.r), 0);
    R.gov = R.checks.reduce((a, c) => (!a || c.r > a.r ? c : a), null);
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
    const order = { bolts: 0, plate: 1, web: 2 };
    rows.sort((a, b) => order[a.grp] - order[b.grp]);
    const max = rows.reduce((a, c) => Math.max(a, c.r), 0);
    const gov = rows.reduce((a, c) => (!a || c.r > a.r ? c : a), null);
    // résistance de l'attache à l'effort tranchant seul (taux linéaire en V)
    let VRd = null;
    if (runs[0].valid) {
      const s2 = JSON.parse(JSON.stringify(s)); s2.loads = [{ name: 'V seul', V: 100, N: 0 }]; s2.cur = 0;
      const r2 = compute(s2, 0); if (r2.max > 0) VRd = 100 / r2.max;
    }
    return { runs, rows, max, gov, govIdx: gov ? gov.idx : 0, valid: runs.every((r) => r.valid), perLoad: runs.map((r) => r.max), VRd };
  }

  function summary(st) {
    try {
      const E = computeEnv(st), r = E.runs[0];
      return { type: 'Plat & boulonnage', sec: r.S ? `${r.S.name} · ${E.runs[0].geo.n1}×${E.runs[0].geo.n2} M${r.bolt.d} ${r.bolt.cls}` : '—', gov: E.gov ? E.gov.label.replace(/\s*\(.*$/, '') : '', max: E.valid ? E.max : null };
    } catch (e) { return null; }
  }

  window.FirmitasFinCalc = { compute, computeEnv, defaultState, upgrade, summary, geometry };
})();
