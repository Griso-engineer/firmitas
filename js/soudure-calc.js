/* ==========================================================================
   Firmitas — cordons de soudure d'angle, NF EN 1993-1-8 § 4.5 (+ AN).
   Deux méthodes :
   · simplifiée (4.5.3.3) : résultante des efforts linéiques, quelle que soit sa direction,
     comparée à F_w,Rd = f_vw,d · a ;
   · directionnelle (4.5.3.2) : efforts décomposés dans la section de gorge (σ⊥, τ⊥, τ∥).
   Cordon d'angle à 90° entre une pièce support (horizontale) et une pièce attachée (verticale).
   Efforts linéiques [N/mm = kN/m] appliqués à l'assemblage, partagés entre les cordons :
   F_L le long du cordon ; F_N perpendiculaire à la pièce support (> 0 : la pièce attachée est
   tirée) ; F_T parallèle à la pièce support, perpendiculaire au cordon (> 0 : vers le cordon 1).
   Unités internes : N, mm, MPa.
   ========================================================================== */
(function () {
  'use strict';
  const SC = window.FirmitasSpliceCalc;
  const { num, fuOf } = SC;
  // β_w : NF EN 1993-1-8 tableau 4.1
  const BW = { S235: 0.8, S275: 0.85, S355: 0.9, S420: 1, S460: 1 };
  const SQ2 = Math.SQRT2, SQ3 = Math.sqrt(3);
  const fwRd = (fu, a, bw, gM2) => fu * a / (SQ3 * bw * gM2);    // (4.4) : F_w,Rd = f_u·a / (√3·β_w·γ_M2)

  function defaultState() {
    return {
      v: 1, kind: 'soudure', name: 'Soudure W1', mode: 'simple',
      p1: { grade: 'S355', t: 10 }, p2: { grade: 'S355', t: 10 },
      a: 4, nw: 1, L: '', craters: true, lap: false,
      gam: { M2: 1.25 },
      loads: [{ name: 'ELU 1', FL: 0, FN: 180, FT: 0 }]
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
  const matOf = (g, t) => ({ grade: g, t, fu: fuOf(g, t), bw: BW[g] || 0.9 });

  // contraintes dans la gorge d'un cordon (efforts linéiques du cordon, N/mm)
  // cordon 1 (côté +x de la pièce attachée) : σ⊥ = (F_N − F_T)/(√2·a), τ⊥ = (F_N + F_T)/(√2·a), τ∥ = F_L/a
  function throat(FL, FN, FT, a) {
    const sn = (FN - FT) / (SQ2 * a), tn = (FN + FT) / (SQ2 * a), tl = FL / a;
    return { sn, tn, tl, eq: Math.sqrt(sn * sn + 3 * (tn * tn + tl * tl)) };
  }

  function compute(s, idx) {
    const R = { valid: true, warnings: [], info: [], checks: [] };
    const L = loadOf(s, idx); R.loadName = L.name || 'ELU';
    const a = num(s.a), nw = num(s.nw, 1) >= 2 ? 2 : 1, gM2 = num(s.gam && s.gam.M2, 1.25);
    const t1 = num(s.p1 && s.p1.t), t2 = num(s.p2 && s.p2.t), Lw = num(s.L, 0);
    const bad = [];
    if (!(a > 0)) bad.push('gorge a');
    if (!(t1 > 0) || !(t2 > 0)) bad.push('épaisseurs des pièces');
    if (!(gM2 > 0)) bad.push('γ_M2');
    if (String(s.L || '').trim() !== '' && !(Lw > 0)) bad.push('longueur du cordon');
    if (bad.length) { R.valid = false; R.warnings.push('Données invalides : ' + bad.join(', ') + ' (valeurs strictement positives attendues).'); return R; }
    const m1 = matOf(s.p1.grade, t1), m2 = matOf(s.p2.grade, t2);
    const w = m1.fu < m2.fu || (m1.fu === m2.fu && m1.bw >= m2.bw) ? m1 : m2;   // pièce la plus faible (4.5.3.2(6))
    R.mat = { m1, m2, w };
    // longueur efficace et joint long (4.5.1, 4.11)
    let leff = null, bLw = 1;
    if (Lw > 0) {
      leff = s.craters ? Lw - 2 * a : Lw;
      if (s.lap && Lw > 150 * a) bLw = Math.max(0, Math.min(1, 1.2 - 0.2 * Lw / (150 * a)));
    }
    const FwRd = fwRd(w.fu, a, w.bw, gM2) * bLw;
    const lim1 = w.fu / (w.bw * gM2) * bLw, lim2 = 0.9 * w.fu / gM2 * bLw;
    R.geo = { a, nw, Lw, leff, bLw, FwRd, lim1, lim2, fvwd: w.fu / (SQ3 * w.bw * gM2) };
    const FL = num(L.FL), FN = num(L.FN), FT = num(L.FT);
    R.L = { FL, FN, FT };
    const add = (o) => { o.r = o.geo ? (o.ok ? 0 : o.rg) : (o.Rd > 0 ? Math.abs(o.Ed) / o.Rd : (Math.abs(o.Ed) > 0 ? Infinity : 0)); R.checks.push(o); return o; };
    // --- dispositions constructives (bloquantes)
    add({ grp: 'geo', id: 'amin', label: 'Gorge a ≥ 3 mm', ref: '4.5.2(2)', Ed: a, Rd: 3, unit: 'mm', geo: true, ok: a >= 3, rg: 3 / a });
    if (leff != null) {
      const lmin = Math.max(30, 6 * a);
      add({ grp: 'geo', id: 'lmin', label: 'Longueur efficace ℓ_eff ≥ max(30 mm ; 6·a)', ref: '4.5.1(2)', Ed: leff, Rd: lmin, unit: 'mm', geo: true, ok: leff >= lmin, rg: leff > 0 ? lmin / leff : Infinity });
    }
    if (a > 0.7 * Math.min(t1, t2)) R.info.push(`Gorge a = ${a} mm supérieure à 0,7·t_min = ${(0.7 * Math.min(t1, t2)).toFixed(1)} mm : vérifier la faisabilité du cordon.`);
    if (bLw < 1) R.info.push(`Joint long (L = ${Lw} mm > 150·a) : résistance réduite par β_Lw,1 = ${bLw.toFixed(3)} (4.11, éq. 4.9).`);
    // --- méthode simplifiée (toujours calculée, pour comparaison)
    const Fres = Math.sqrt(FL * FL + FN * FN + FT * FT) / nw;
    R.simple = { Fed: Fres, r: FwRd > 0 ? Fres / FwRd : Infinity };
    // --- méthode directionnelle : chaque cordon ; le cordon 2 voit F_T en sens opposé
    const welds = [];
    for (let i = 0; i < nw; i++) { const sg = i === 0 ? 1 : -1; welds.push(throat(FL / nw, FN / nw, sg * FT / nw, a)); }
    welds.forEach((x) => { x.r1 = x.eq / lim1; x.r2 = Math.abs(x.sn) / lim2; x.r = Math.max(x.r1, x.r2); });
    const wi = welds.reduce((b, x, i) => (x.r > welds[b].r ? i : b), 0);
    R.dir = { welds, wi, r: welds[wi].r };
    if (s.mode === 'dir') {
      const x = welds[wi], lbl = nw > 1 ? ` (cordon ${wi + 1})` : '';
      add({ grp: 'weld', id: 'eq', label: 'Contrainte équivalente √(σ⊥² + 3(τ⊥² + τ∥²))' + lbl, ref: '4.5.3.2 (4.1)', Ed: x.eq, Rd: lim1, unit: 'MPa' });
      const x2 = welds.reduce((b, y) => (Math.abs(y.sn) > Math.abs(b.sn) ? y : b), welds[0]);
      add({ grp: 'weld', id: 'sn', label: 'Contrainte normale |σ⊥| ≤ 0,9·f_u/γ_M2', ref: '4.5.3.2 (4.1)', Ed: Math.abs(x2.sn), Rd: lim2, unit: 'MPa' });
      R.info.push(`Méthode simplifiée pour comparaison : taux ${Math.round(R.simple.r * 100)} %.`);
    } else {
      add({ grp: 'weld', id: 'fw', label: 'Effort linéique résultant F_w,Ed ≤ F_w,Rd', ref: '4.5.3.3 (4.3)', Ed: Fres, Rd: FwRd, unit: 'N/mm' });
      R.info.push(`Méthode directionnelle pour comparaison : taux ${Math.round(R.dir.r * 100)} %.`);
    }
    if (leff != null) R.info.push(`Résistance du cordon sur sa longueur efficace : F_w,Rd·ℓ_eff = ${(FwRd * Math.max(0, leff) / 1e3).toFixed(1)} kN par cordon (méthode simplifiée).`);
    R.max = R.checks.reduce((m, c) => Math.max(m, c.r), 0);
    R.gov = R.checks.reduce((g, c) => (!g || c.r > g.r ? c : g), null);
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
    const max = rows.reduce((a, c) => Math.max(a, c.r), 0);
    const gov = rows.reduce((a, c) => (!a || c.r > a.r ? c : a), null);
    return { runs, rows, max, gov, govIdx: gov ? gov.idx : 0, valid: runs.every((r) => r.valid), perLoad: runs.map((r) => r.max) };
  }

  function summary(st) {
    try {
      const E = computeEnv(st);
      return { type: 'Soudure', sec: `a = ${num(st.a)} mm · ${num(st.nw, 1) >= 2 ? '2 cordons' : '1 cordon'} · ${st.mode === 'dir' ? 'directionnelle' : 'simplifiée'}`, gov: E.gov ? E.gov.label.replace(/\s*\(.*$/, '') : '', max: E.valid ? E.max : null };
    } catch (e) { return null; }
  }

  window.FirmitasWeldCalc = { compute, computeEnv, defaultState, upgrade, summary, throat, fwRd, BW };
})();
