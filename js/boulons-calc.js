/* ==========================================================================
   Firmitas — vérification d'un boulon, NF EN 1993-1-8 § 3 (+ AN).
   Cisaillement, traction, flexion du boulon, interaction (tableau 3.4) ; pression diamétrale
   et poinçonnement de la pièce ; pinces et entraxes (tableau 3.3) ; couple de serrage
   (VDI 2230) ; longueur en prise minimale dans un taraudage (Dose & Pittner, 1996).
   Efforts par boulon : F_v,Ed (total, tous plans), F_t,Ed, M_b,Ed, F_b,Ed (sur la pièce vérifiée).
   Unités internes : N, mm, MPa. Entrées : kN, kN·m, mm.
   ========================================================================== */
(function () {
  'use strict';
  const SC = window.FirmitasSpliceCalc;
  const { num, fuOf, d0Hole, HOLES } = SC;
  const PI = Math.PI, SQ3 = Math.sqrt(3);
  // d : [pas P, section résistante A_s (ISO 898-1), surplat s de la tête ou de l'écrou (ISO 4017 / 4032)]
  const SIZES = {
    3: [0.5, 5.03, 5.5], 4: [0.7, 8.78, 7], 5: [0.8, 14.2, 8], 6: [1, 20.1, 10], 8: [1.25, 36.6, 13], 10: [1.5, 58, 16],
    12: [1.75, 84.3, 18], 14: [2, 115, 21], 16: [2, 157, 24], 18: [2.5, 192, 27], 20: [2.5, 245, 30], 22: [2.5, 303, 34],
    24: [3, 353, 36], 27: [3, 459, 41], 30: [3.5, 561, 46], 33: [3.5, 694, 50], 36: [4, 817, 55], 39: [4, 976, 60],
    42: [4.5, 1121, 65], 48: [5, 1473, 75], 52: [5, 1758, 80], 64: [6, 2676, 95]
  };
  // classes : f_yb, f_ub [MPa] ; α_v plan de cisaillement dans le filetage (tableau 3.4) — 0,6 hors filetage
  const CLASSES = {
    '4.6': { fyb: 240, fub: 400, av: 0.6 }, '4.8': { fyb: 320, fub: 400, av: 0.5 }, '5.6': { fyb: 300, fub: 500, av: 0.6 },
    '5.8': { fyb: 400, fub: 500, av: 0.5 }, '6.8': { fyb: 480, fub: 600, av: 0.5 }, '8.8': { fyb: 640, fub: 800, av: 0.6 },
    '10.9': { fyb: 900, fub: 1000, av: 0.5 },
    'A4-50': { fyb: 210, fub: 500, av: 0.5, inox: true }, 'A4-70': { fyb: 450, fub: 700, av: 0.5, inox: true }, 'A4-80': { fyb: 600, fub: 800, av: 0.5, inox: true }
  };
  const geomOf = (d) => {
    const z = SIZES[d] || SIZES[16], P = z[0], As = z[1], s = z[2];
    return { d, P, As, s, A: PI * d * d / 4, d2: d - 0.649519 * P, d3: d - 1.226869 * P, ds: Math.sqrt(4 * As / PI), dm: s * (1 + 2 / SQ3) / 2 };
  };
  const BEND = {
    el: { label: 'Élastique : W_el·f_ub/γ_M2' },
    pl: { label: 'Plastique : W_pl·f_yb/γ_M2' },
    pin: { label: 'Axe (tableau 3.10) : 1,5·W_el·f_yb/γ_M0' }
  };

  function defaultState() {
    return {
      v: 1, kind: 'boulons', name: 'Boulon B1',
      d: 16, cls: '8.8', threads: true, planes: 1, csk: false,
      gam: { M2: 1.25, M0: 1 }, bend: 'el',
      plate: { grade: 'custom', fu: 300, t: 7 },
      holes: 'normal', pos1: 'end', pos2: 'inner', e1: 20, e2: 22.3, p1: 60, p2: 85,
      tq: { on: true, F: 35, muT: 0.18, muH: 0.2 },
      tap: { on: false, fu: 500, ang: 60, m: '' },
      loads: [{ name: 'ELU 1', Fv: 8, Ft: 37, Mb: 0, Fb: 25 }]
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
  const loadOf = (s, idx) => { const L = Array.isArray(s.loads) && s.loads.length ? s.loads : [{}]; return L[Math.max(0, Math.min(L.length - 1, idx || 0))]; };
  const blank = (v) => v == null || String(v).trim() === '';

  // longueur en prise minimale (Dose & Pittner) : partage du cisaillement entre filets du boulon et du taraudage
  function tapped(g, fub, fuM, ang) {
    const tB = fub / SQ3, tM = fuM / SQ3;
    const ab = tM / (tB + tM), aM = tB / (tB + tM);
    const FB = g.As * fub;
    const dt = g.d2 + (0.5 - ab) * g.P / Math.tan(ang * PI / 360);
    const At = FB * (1 / tB + 1 / tM);
    return { tB, tM, ab, aM, FB, dt, At, mmin: At / (PI * dt) };
  }
  // couple de serrage (VDI 2230) : M_A = F·(0,16·P + 0,58·µ_G·d_2 + µ_K·D_Km/2)
  function torque(g, F, muT, muH, d0) {
    const Dkm = (g.s + d0) / 2;
    const MG = F * (0.16 * g.P + 0.58 * muT * g.d2), MK = F * muH * Dkm / 2;
    return { Dkm, MG, MK, MA: MG + MK, MAxl: F * (muT * 1.25 * g.d / 2 + muH * 1.3 * g.d / 2) };
  }

  function compute(s, idx) {
    const R = { valid: true, warnings: [], info: [], checks: [] };
    const L = loadOf(s, idx); R.loadName = L.name || 'ELU';
    const d = num(s.d, 16), cl = CLASSES[s.cls] || CLASSES['8.8'], g = geomOf(d);
    const gM2 = num(s.gam && s.gam.M2, 1.25), gM0 = num(s.gam && s.gam.M0, 1), planes = Math.max(1, Math.round(num(s.planes, 1)));
    const t = num(s.plate.t), fu = s.plate.grade === 'custom' ? num(s.plate.fu) : fuOf(s.plate.grade, t);
    const e1 = num(s.e1), e2 = num(s.e2), p1 = num(s.p1), p2 = num(s.p2);
    const bad = [];
    if (!SIZES[d]) bad.push('diamètre');
    if (!(gM2 > 0) || !(gM0 > 0)) bad.push('coefficients partiels');
    if (!(t > 0)) bad.push('épaisseur de la pièce');
    if (!(fu > 0)) bad.push('f_u de la pièce');
    if (s.pos1 === 'end' ? !(e1 > 0) : !(p1 > 0)) bad.push(s.pos1 === 'end' ? 'e_1' : 'p_1');
    if (s.pos2 === 'edge' ? !(e2 > 0) : !(p2 > 0)) bad.push(s.pos2 === 'edge' ? 'e_2' : 'p_2');
    if (s.tap && s.tap.on && (!(num(s.tap.fu) > 0) || !(num(s.tap.ang) > 0 && num(s.tap.ang) < 180))) bad.push('taraudage (f_u, angle)');
    if (bad.length) { R.valid = false; R.warnings.push('Données invalides : ' + bad.join(', ') + '.'); return R; }
    const d0 = d0Hole(d, s.holes), kb = (HOLES[s.holes] || HOLES.normal).kb;
    R.bolt = Object.assign({ cls: s.cls, fyb: cl.fyb, fub: cl.fub, d0 }, g);
    R.mat = { fu, t };
    const Fv = num(L.Fv) * 1e3, Ft = num(L.Ft) * 1e3, Mb = Math.abs(num(L.Mb)) * 1e6, Fb = (blank(L.Fb) ? num(L.Fv) : num(L.Fb)) * 1e3;
    R.L = { Fv, Ft, Mb, Fb };
    const add = (o) => { o.r = o.geo ? (o.ok ? 0 : o.rg) : o.ratioOnly ? o.r : (o.Rd > 0 ? Math.abs(o.Ed) / o.Rd : (Math.abs(o.Ed) > 0 ? Infinity : 0)); R.checks.push(o); return o; };

    // --- boulon
    const av = s.threads ? cl.av : 0.6, Av = s.threads ? g.As : g.A;
    const FvRd = planes * av * cl.fub * Av / gM2;
    const k2 = s.csk ? 0.63 : 0.9, FtRd = k2 * cl.fub * g.As / gM2;
    const Wel = PI * g.ds ** 3 / 32, Wpl = g.ds ** 3 / 6;
    const MbRd = s.bend === 'pl' ? Wpl * cl.fyb / gM2 : s.bend === 'pin' ? 1.5 * Wel * cl.fyb / gM0 : Wel * cl.fub / gM2;
    R.res = { av, Av, FvRd, k2, FtRd, Wel, Wpl, MbRd };
    add({ grp: 'bolt', id: 'fv', label: `Cisaillement F_v,Ed ≤ F_v,Rd (${planes} plan${planes > 1 ? 's' : ''}, ${s.threads ? 'filetage' : 'fût lisse'})`, ref: '3.6.1 tab. 3.4', Ed: Fv, Rd: FvRd, unit: 'kN' });
    add({ grp: 'bolt', id: 'ft', label: `Traction F_t,Ed ≤ F_t,Rd (k_2 = ${String(k2).replace(".", ",")})`, ref: '3.6.1 tab. 3.4', Ed: Ft, Rd: FtRd, unit: 'kN' });
    if (Mb > 0) {
      add({ grp: 'bolt', id: 'mb', label: 'Flexion M_b,Ed ≤ M_b,Rd — ' + BEND[s.bend in BEND ? s.bend : 'el'].label, ref: s.bend === 'pin' ? '3.13 tab. 3.10' : '—', Ed: Mb, Rd: MbRd, unit: 'kN·m' });
      add({ grp: 'bolt', id: 'tm', label: 'Traction + flexion : F_t,Ed/F_t,Rd + M_b,Ed/M_b,Rd ≤ 1', ref: 'tab. 3.4 (extension)', ratioOnly: true, r: Ft / FtRd + Mb / MbRd });
    }
    const rvt = Fv / FvRd + Ft / (1.4 * FtRd) + Mb / (1.4 * MbRd);
    if (Fv > 0 && (Ft > 0 || Mb > 0)) add({ grp: 'bolt', id: 'vt', label: 'Cisaillement + traction : F_v,Ed/F_v,Rd + F_t,Ed/(1,4·F_t,Rd)' + (Mb > 0 ? ' + M_b,Ed/(1,4·M_b,Rd)' : '') + ' ≤ 1', ref: 'tab. 3.4', ratioOnly: true, r: rvt });

    // --- pièce : pinces et entraxes (tableau 3.3)
    const gchk = (id, label, v, min) => add({ grp: 'geo', id, label, ref: 'tab. 3.3', Ed: v, Rd: min, unit: 'mm', geo: true, ok: v >= min - 1e-9, rg: v > 0 ? min / v : Infinity });
    if (s.pos1 === 'end') gchk('e1', 'Pince longitudinale e_1 ≥ 1,2·d_0', e1, 1.2 * d0); else gchk('p1', 'Entraxe longitudinal p_1 ≥ 2,2·d_0', p1, 2.2 * d0);
    if (s.pos2 === 'edge') gchk('e2', 'Pince transversale e_2 ≥ 1,2·d_0', e2, 1.2 * d0);
    if (s.pos2 === 'inner' || (s.pos2 === 'edge' && p2 > 0)) gchk('p2', 'Entraxe transversal p_2 ≥ 2,4·d_0', p2, 2.4 * d0);

    // --- pression diamétrale (tableau 3.4)
    const ad = s.pos1 === 'end' ? e1 / (3 * d0) : p1 / (3 * d0) - 0.25;
    const ab = Math.min(ad, cl.fub / fu, 1);
    const k1c = [2.5];
    if (s.pos2 === 'edge') k1c.push(2.8 * e2 / d0 - 1.7);
    if (s.pos2 === 'inner' || p2 > 0) k1c.push(1.4 * p2 / d0 - 1.7);
    const k1 = Math.min(...k1c);
    const FbRd = Math.max(0, kb * k1 * ab * fu * d * t / gM2);
    R.bear = { d0, kb, ad, ab, k1, FbRd };
    add({ grp: 'plate', id: 'fb', label: `Pression diamétrale F_b,Ed ≤ F_b,Rd (k_1 = ${k1.toFixed(2).replace('.', ',')}, α_b = ${ab.toFixed(3).replace('.', ',')}${kb < 1 ? ', ×' + String(kb).replace('.', ',') : ''})`, ref: '3.6.1 tab. 3.4', Ed: Fb, Rd: FbRd, unit: 'kN' });
    if (s.csk) R.info.push('Tête fraisée : t à réduire de la moitié de la profondeur de fraisage pour la pression diamétrale (tableau 3.4, note 2) ; poinçonnement non vérifié.');
    if (Ft > 0 && !s.csk) {
      const BpRd = 0.6 * PI * g.dm * t * fu / gM2;
      R.res.BpRd = BpRd;
      add({ grp: 'plate', id: 'bp', label: `Poinçonnement F_t,Ed ≤ B_p,Rd (d_m = ${g.dm.toFixed(1).replace('.', ',')} mm)`, ref: '3.6.1 tab. 3.4', Ed: Ft, Rd: BpRd, unit: 'kN' });
    }

    // --- taraudage : longueur en prise minimale et cisaillement des filets
    if (s.tap && s.tap.on) {
      const T = tapped(g, cl.fub, num(s.tap.fu), num(s.tap.ang, 60));
      const m = num(s.tap.m, 0), mu = m > 0 ? m : T.mmin;
      T.m = m; T.mu = mu;
      T.tauB = Ft / (T.ab * PI * T.dt * mu); T.tauM = Ft / (T.aM * PI * T.dt * mu);
      R.tap = T;
      if (m > 0) add({ grp: 'tap', id: 'm', label: 'Longueur en prise m ≥ m_min (rupture du boulon avant arrachement des filets)', ref: 'Dose & Pittner', Ed: m, Rd: T.mmin, unit: 'mm', geo: true, ok: m >= T.mmin - 1e-9, rg: T.mmin / m });
      add({ grp: 'tap', id: 'tb', label: 'Cisaillement des filets du boulon τ_B ≤ τ_m,B/γ_M2', ref: 'Dose & Pittner', Ed: T.tauB, Rd: T.tB / gM2, unit: 'MPa' });
      add({ grp: 'tap', id: 'tmm', label: 'Cisaillement des filets taraudés τ_M ≤ τ_m,M/γ_M2', ref: 'Dose & Pittner', Ed: T.tauM, Rd: T.tM / gM2, unit: 'MPa' });
    }

    // --- serrage
    if (s.tq && s.tq.on) {
      const F = num(s.tq.F) * 1e3, Q = torque(g, F, num(s.tq.muT), num(s.tq.muH), SC.d0Of(d));
      const sig = F / g.As, tau = Q.MG / (PI * g.ds ** 3 / 16), sred = Math.sqrt(sig * sig + 3 * tau * tau);
      Object.assign(Q, { F, sig, tau, sred, FpC: 0.7 * cl.fub * g.As });
      R.tq = Q;
      if (F > 0) add({ grp: 'tq', id: 'sr', label: 'Contrainte réduite au serrage √(σ² + 3τ²) ≤ 0,9·f_yb', ref: 'VDI 2230', Ed: sred, Rd: 0.9 * cl.fyb, unit: 'MPa' });
    }
    if (cl.inox) R.info.push('Boulons inox A4 : NF EN 1993-1-4 § 6.2 ; α_v = 0,5 retenu dans le filetage comme pour les classes 4.8 à 10.9.');
    R.max = R.checks.reduce((m, c) => Math.max(m, c.r), 0);
    R.gov = R.checks.reduce((gv, c) => (!gv || c.r > gv.r ? c : gv), null);
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
    const order = { bolt: 0, geo: 1, plate: 2, tap: 3, tq: 4 };
    rows.sort((a, b) => order[a.grp] - order[b.grp]);
    const max = rows.reduce((a, c) => Math.max(a, c.r), 0);
    const gov = rows.reduce((a, c) => (!a || c.r > a.r ? c : a), null);
    return { runs, rows, max, gov, govIdx: gov ? gov.idx : 0, valid: runs.every((r) => r.valid), perLoad: runs.map((r) => r.max) };
  }

  function summary(st) {
    try {
      const E = computeEnv(st);
      return { type: 'Boulon', sec: `M${num(st.d, 16)} ${st.cls}`, gov: E.gov ? E.gov.label.replace(/\s*\(.*$/, '').replace(/\s*—.*$/, '') : '', max: E.valid ? E.max : null };
    } catch (e) { return null; }
  }

  window.FirmitasBoltCalc = { compute, computeEnv, defaultState, upgrade, summary, tapped, torque, geomOf, SIZES, CLASSES, BEND };
})();
