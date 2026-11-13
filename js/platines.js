/* ==========================================================================
   Firmitas — module « Platines d'about » : interface, dessins cotés, 3D, fiche NDC
   ========================================================================== */
(function () {
  'use strict';
  const C = window.FirmitasEPCalc, SC = window.FirmitasSpliceCalc, D = window.FIRMITAS_DATA;
  const A = () => window.FirmitasApp, R3 = () => window.FirmitasR3D, DR = window.FirmitasSpliceDraw;
  const U = DR.util;
  const { T, sb, svgWrap, dimH, dimV, rect, axisV, axisH, INK, MUTED, ACC, BEAM, RED, DIM, BOLT } = U;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
  const fmtG = (x, d = 3) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { maximumFractionDigits: d }) : '—');
  const pct = (r) => (Number.isFinite(r) ? Math.round(r * 100) + ' %' : '∞');
  const sub = (s) => esc(s).replace(/_([A-Za-z0-9,.]+)/g, '<sub>$1</sub>');
  const bar = (r) => `<div class="bar"><i class="${!(r <= 1) ? 'ko' : r > 0.9 ? 'hi' : ''}" style="width:${Math.min(100, (Number.isFinite(r) ? r : 1) * 100)}%"></i></div>`;
  const pill = (r) => (r == null ? '<span class="pill na">—</span>' : r <= 1 ? '<span class="pill ok">OK</span>' : '<span class="pill ko">NON</span>');
  const kN = (x) => fmt(x / 1e3, 1);
  const COMPS = [['N', 'N', 'kN', 'effort normal (> 0 compression)'], ['Vy', 'V_y', 'kN', 'tranchant transversal'], ['Vz', 'V_z', 'kN', 'tranchant vertical'], ['Mx', 'M_x', 'kN·m', 'torsion'], ['My', 'M_y', 'kN·m', 'moment fort (> 0 comprime le haut)'], ['Mz', 'M_z', 'kN·m', 'moment faible (> 0 comprime +y)']];
  let st = null, R = null, ENV = null, dirty = false, db = null, uid = 0;
  const get = (p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), st);
  function set(p, v) { const ks = p.split('.'); let a = st; ks.slice(0, -1).forEach((k) => { if (a[k] == null) a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }
  const curLoad = () => st.loads[Math.min(st.loads.length - 1, +st.cur || 0)];
  const inp = (p, o = {}) => `<input type="${o.type || 'number'}" data-ep="${p}" value="${esc(get(p))}"${(o.type || 'number') === 'number' ? ' step="any"' : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>`;
  const sel = (p, opts, o = {}) => { const v = String(get(p)); return `<select data-ep="${p}"${o.rr ? ' data-rr="1"' : ''}>${opts.map((x) => `<option value="${esc(x[0])}"${String(x[0]) === v ? ' selected' : ''}>${esc(x[1])}</option>`).join('')}</select>`; };
  const chk = (p, label, rr) => `<label class="check"><input type="checkbox" data-ep="${p}"${get(p) ? ' checked' : ''}${rr ? ' data-rr="1"' : ''}> ${label}</label>`;
  const field = (label, control, unit, hint) => `<label class="field"><span>${label}${unit ? ` <span class="u">[${unit}]</span>` : ''}</span>${control}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  const blockHead = (n, t, p) => `<div class="block-head"><span class="num">${n}</span><h2>${t}</h2><p>${p || ''}</p></div>`;
  const iFams = () => D.FAMILIES.filter((f) => !f.tube && !f.ipn).map((f) => [f.id, f.id]);

  function init(database) { db = database; st = db.draft_platines ? C.upgrade(db.draft_platines) : C.defaultState(); dirty = !!db.draftDirty_platines; }
  function flush(dbx) { dbx.draft_platines = st; dbx.draftDirty_platines = dirty; }
  let saveT = null;
  function persist() { clearTimeout(saveT); saveT = setTimeout(() => { flush(db); A().saveDb(); }, 250); }

  // ======================================================================
  //  DESSINS
  // ======================================================================
  // contour de la barre dans le plan de la platine (y, z)
  function memberOutline(S, Y, Z, k, st2) {
    if (S.type === 'I') {
      const h2 = S.h / 2;
      const pts = [[-S.b / 2, h2], [S.b / 2, h2], [S.b / 2, h2 - S.tf], [S.tw / 2, h2 - S.tf], [S.tw / 2, -h2 + S.tf], [S.b / 2, -h2 + S.tf], [S.b / 2, -h2], [-S.b / 2, -h2], [-S.b / 2, -h2 + S.tf], [-S.tw / 2, -h2 + S.tf], [-S.tw / 2, h2 - S.tf], [-S.b / 2, h2 - S.tf]];
      return `<polygon points="${pts.map((p) => Y(p[0]).toFixed(1) + ',' + Z(p[1]).toFixed(1)).join(' ')}" ${st2}/>`;
    }
    if (S.type === 'CHS') { const r = S.d / 2; return `<path d="M${Y(-r)},${Z(0)}a${r * k},${r * k} 0 1,0 ${2 * r * k},0a${r * k},${r * k} 0 1,0 ${-2 * r * k},0ZM${Y(-r + S.t)},${Z(0)}a${(r - S.t) * k},${(r - S.t) * k} 0 1,1 ${2 * (r - S.t) * k},0a${(r - S.t) * k},${(r - S.t) * k} 0 1,1 ${-2 * (r - S.t) * k},0Z" fill-rule="evenodd" ${st2}/>`; }
    return `<path d="M${Y(-S.b / 2)},${Z(S.h / 2)}h${S.b * k}v${S.h * k}h${-S.b * k}ZM${Y(-S.b / 2 + S.t)},${Z(S.h / 2 - S.t)}v${(S.h - 2 * S.t) * k}h${(S.b - 2 * S.t) * k}v${-(S.h - 2 * S.t) * k}Z" fill-rule="evenodd" ${st2}/>`;
  }
  function plateDims(R) {
    const G = R.geo, S = R.S;
    if (S.type === 'I') return { yl: -G.bp / 2, yr: G.bp / 2, zt: G.topEdge, zb: G.botEdge };
    if (G.round) return { yl: -G.Dp / 2, yr: G.Dp / 2, zt: G.Dp / 2, zb: -G.Dp / 2 };
    return { yl: -G.bp / 2, yr: G.bp / 2, zt: G.hp / 2, zb: -G.hp / 2 };
  }
  // vue de face de la platine, cotée ; mode 'forces' : boulons colorés selon leur traction
  function front(R, mode, W = 520, H = 470) {
    const S = R.S, G = R.geo, P = plateDims(R);
    const Wd = P.yr - P.yl, Hd = P.zt - P.zb;
    const k = Math.min((W - 190) / Wd, (H - 110) / Hd);
    const cy0 = 60 + P.zt * k, cx0 = 70 + (-P.yl) * k;
    const Y = (y) => cx0 + y * k, Z = (z) => cy0 - z * k;
    let s = '';
    if (G.round) s += `<circle cx="${Y(0)}" cy="${Z(0)}" r="${G.Dp / 2 * k}" fill="${ACC}" fill-opacity=".45" stroke="${INK}" stroke-width="1"/>`;
    else s += rect(Y(P.yl), Z(P.zt), Wd * k, Hd * k, `fill="${ACC}" fill-opacity=".45" stroke="${INK}" stroke-width="1"`);
    s += memberOutline(S, Y, Z, k, `fill="${BEAM}" stroke="${INK}" stroke-width=".9"`);
    s += axisV(Y(0), Z(P.zt) - 8, Z(P.zb) + 8) + axisH(Z(0), Y(P.yl) - 8, Y(P.yr) + 8);
    const r = Math.max(3, R.bolt.d0 / 2 * k);
    const ref = R.Ftb || 1;
    G.bolts.forEach((q, i) => {
      if (mode === 'forces') {
        const f = R.FtBolt[i] || 0, u = f / (R.caps ? R.caps[i].F : ref);
        s += `<circle cx="${Y(q.y)}" cy="${Z(q.z)}" r="${r + 1}" fill="${f > 0 ? DR.rateCol(u) : '#fff'}" stroke="${INK}" stroke-width="1"/>`;
        if (f > 0) s += T(Y(q.y), Z(q.z) - r - 4, kN(f), { a: 'middle', fs: 8.5, fw: 700 });
      } else s += `<circle cx="${Y(q.y)}" cy="${Z(q.z)}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="1"/>`;
    });
    if (mode !== 'forces') {
      if (S.type === 'I') {
        const xr = Y(P.yr) + 14;
        const zs = [G.topEdge].concat(G.rows.map((q) => q.z)).concat([G.botEdge]);
        const flz = [S.h / 2, S.h / 2 - S.tf, -S.h / 2 + S.tf, -S.h / 2];
        for (let i = 0; i < zs.length - 1; i++) s += dimV(Z(zs[i]), Z(zs[i + 1]), xr, fmtG(zs[i] - zs[i + 1], 1), { ext: Y(P.yr) });
        s += dimV(Z(G.topEdge), Z(G.botEdge), xr + 50, `h_p = ${fmtG(G.hp, 1)}`, { ext: Y(P.yr) });
        void flz;
        const w2 = G.w / 2;
        s += dimH(Y(-w2), Y(w2), Z(P.zb) + 18, `w = ${fmtG(G.w, 1)}`, { ext: Z(P.zb) });
        s += dimH(Y(w2), Y(P.yr), Z(P.zb) + 18, `e = ${fmtG(G.e, 1)}`, { ext: Z(P.zb) });
        s += dimH(Y(P.yl), Y(P.yr), Z(P.zb) + 38, `b_p = ${fmtG(G.bp, 1)}`, { ext: Z(P.zb) });
        if (G.rows.some((q) => q.type === 'ext')) s += T(Y(P.yl) - 6, Z(S.h / 2 + G.mx) + 3, sb(`m_x = ${fmtG(G.mx, 0)}`), { a: 'end', fs: 8.5, col: DIM });
        if (G.rows.some((q) => q.type !== 'ext')) s += T(Y(P.yl) - 6, Z(S.h / 2 - S.tf - G.mi) + 3, sb(`m_i = ${fmtG(G.mi, 0)}`), { a: 'end', fs: 8.5, col: DIM });
      } else if (G.round) {
        s += `<circle cx="${Y(0)}" cy="${Z(0)}" r="${G.Rb * k}" fill="none" stroke="${DIM}" stroke-width=".7" stroke-dasharray="4 3"/>`;
        s += dimH(Y(-G.Rb), Y(G.Rb), Z(P.zb) + 18, `Ø boulons = ${fmtG(2 * G.Rb, 1)}`, { ext: Z(0) });
        s += dimH(Y(P.yl), Y(P.yr), Z(P.zb) + 38, `Ø platine = ${fmtG(G.Dp, 1)}`, { ext: Z(0) });
        s += T(Y(P.yr) + 8, Z(0) - 4, sb(`m = ${fmtG(G.m, 0)} ; e = ${fmtG(G.e, 0)}`), { fs: 8.5, col: DIM });
      } else {
        const xr = Y(P.yr) + 14;
        s += dimV(Z(P.zt), Z(S.h / 2 + G.m), xr, `e = ${fmtG(G.e, 1)}`, { ext: Y(P.yr) });
        s += dimV(Z(S.h / 2 + G.m), Z(S.h / 2), xr, `m = ${fmtG(G.m, 1)}`, { ext: Y(P.yr) });
        s += dimV(Z(S.h / 2), Z(-S.h / 2), xr, `h = ${fmtG(S.h, 1)}`, { ext: Y(S.b / 2) });
        s += dimV(Z(P.zt), Z(P.zb), xr + 54, `h_p = ${fmtG(G.hp, 1)}`, { ext: Y(P.yr) });
        s += dimH(Y(P.yl), Y(P.yr), Z(P.zb) + 20, `b_p = ${fmtG(G.bp, 1)}`, { ext: Z(P.zb) });
      }
    }
    s += T(8, 16, mode === 'forces' ? 'Traction dans les boulons' : 'Vue de face de la platine', { fw: 800, fs: 11.5 });
    s += T(8, 30, mode === 'forces' ? `${esc(R.loadName)} · kN par boulon · teinte : taux du boulon (tronçon en T)` : `${S.name} · platine ${fmtG(R.tp, 1)} mm · ${G.bolts.length} × M${R.bolt.d} ${R.bolt.cls}`, { fw: 500, fs: 9.5, col: MUTED });
    return svgWrap(W, H, s);
  }
  // vue de côté : deux barres, deux platines, boulons
  function side(R, W = 520, H = 300) {
    const S = R.S, P = plateDims(R), tp = R.tp;
    const Lm = Math.max(1.1 * (P.zt - P.zb), 200);
    const k = Math.min((W - 120) / (2 * Lm + 2 * tp), (H - 110) / (P.zt - P.zb));
    const cx = W / 2, cy = 56 + P.zt * k;
    const X = (x) => cx + x * k, Z = (z) => cy - z * k;
    let s = '';
    const zt = S.type === 'CHS' ? S.d / 2 : S.h / 2;
    [[-tp - Lm, -tp], [tp, tp + Lm]].forEach(([a, b]) => { s += rect(X(a), Z(zt), (b - a) * k, 2 * zt * k, `fill="${BEAM}" stroke="${INK}" stroke-width=".8"`); });
    [[-tp, 0], [0, tp]].forEach(([a, b]) => { s += rect(X(a), Z(P.zt), (b - a) * k, (P.zt - P.zb) * k, `fill="${ACC}" fill-opacity=".6" stroke="${INK}" stroke-width="1"`); });
    const zs = [...new Set(R.geo.bolts.map((q) => Math.round(q.z * 10) / 10))];
    zs.forEach((z) => { s += `<line x1="${X(-tp) - 8}" y1="${Z(z)}" x2="${X(tp) + 8}" y2="${Z(z)}" stroke="${INK}" stroke-width="${Math.max(1.6, R.bolt.d * k * 0.55)}" stroke-opacity=".6"/>`; });
    s += dimH(X(-tp), X(tp), Z(P.zb) + 16, '', { ext: Z(P.zb) }) + T(X(tp) + 10, Z(P.zb) + 20, sb(`2 platines, t_p = ${fmtG(tp, 1)} mm`), { fs: 9, col: DIM });
    s += T(8, 16, 'Vue de côté', { fw: 800, fs: 11.5 }) + T(8, 30, 'deux platines identiques, boulonnées', { fw: 500, fs: 9.5, col: MUTED });
    return svgWrap(W, H, s);
  }
  function scene(R, colorOf) {
    const S = R.S, G = R.geo, P = plateDims(R), tp = R.tp, c = (id, def) => (colorOf ? colorOf(id) || def : def);
    const Lm = Math.max(1.0 * (P.zt - P.zb), 220);
    const boxes = [], prisms = [];
    [[-tp - Lm, -tp], [tp, tp + Lm]].forEach(([a, b]) => {
      if (S.type === 'I') {
        const h2 = S.h / 2;
        boxes.push({ x0: a, x1: b, y0: -S.b / 2, y1: S.b / 2, z0: h2 - S.tf, z1: h2, col: c('m', BEAM) });
        boxes.push({ x0: a, x1: b, y0: -S.b / 2, y1: S.b / 2, z0: -h2, z1: -h2 + S.tf, col: c('m', BEAM) });
        boxes.push({ x0: a, x1: b, y0: -S.tw / 2, y1: S.tw / 2, z0: -h2 + S.tf, z1: h2 - S.tf, col: c('m', BEAM) });
      } else if (S.type === 'CHS') prisms.push({ axis: 'x', c: [0, 0, 0], r: S.d / 2, a0: a, a1: b, n: 36, col: c('m', BEAM) });
      else {
        boxes.push({ x0: a, x1: b, y0: -S.b / 2, y1: S.b / 2, z0: S.h / 2 - S.t, z1: S.h / 2, col: c('m', BEAM) });
        boxes.push({ x0: a, x1: b, y0: -S.b / 2, y1: S.b / 2, z0: -S.h / 2, z1: -S.h / 2 + S.t, col: c('m', BEAM) });
        boxes.push({ x0: a, x1: b, y0: -S.b / 2, y1: -S.b / 2 + S.t, z0: -S.h / 2 + S.t, z1: S.h / 2 - S.t, col: c('m', BEAM) });
        boxes.push({ x0: a, x1: b, y0: S.b / 2 - S.t, y1: S.b / 2, z0: -S.h / 2 + S.t, z1: S.h / 2 - S.t, col: c('m', BEAM) });
      }
    });
    [[-tp, 0], [0, tp]].forEach(([a, b]) => {
      if (G.round) prisms.push({ axis: 'x', c: [0, 0, 0], r: G.Dp / 2, a0: a, a1: b, n: 48, col: c('p', ACC) });
      else boxes.push({ x0: a, x1: b, y0: P.yl, y1: P.yr, z0: P.zb, z1: P.zt, col: c('p', ACC) });
    });
    G.bolts.forEach((q) => prisms.push(...U.boltPrisms('x', [0, q.y, q.z], R.bolt.d, -tp, tp, c('b', BOLT), 'b')));
    return { boxes, prisms };
  }
  function iso(R, opts = {}) {
    const W = opts.W || 520, H = opts.H || 360;
    const r = R3().render(scene(R, opts.colorOf), { W, H, top: 40, pad: 20, az: -40, el: 22 });
    return svgWrap(W, H, `<image href="${r.img}" x="0" y="0" width="${W}" height="${H}"/>` + T(8, 16, opts.title || 'Vue 3D', { fw: 800, fs: 11.5 }) + (opts.sub ? T(8, 30, opts.sub, { fw: 500, fs: 9.5, col: MUTED }) : '') + U.triadSvg(r.cam, H));
  }
  const PARTS = [['b', 'Boulons', (c) => c.grp === 'bolts'], ['p', 'Platines', (c) => c.grp === 'plate'], ['m', 'Barre (semelle comprimée, paroi)', (c) => c.grp === 'beam'], ['w', 'Soudures platine / barre', (c) => c.grp === 'weld']];
  function partRates(rows) { const o = {}; PARTS.forEach(([id, label, f]) => { const g = rows.filter(f).reduce((a, c) => (c.r > a.r ? c : a), { r: 0, label: '—' }); o[id] = { r: g.r, label, gov: g }; }); return o; }

  // ======================================================================
  //  PAGE
  // ======================================================================
  function render(app) {
    R = C.compute(st);
    const isI = st.shape === 'I', L = curLoad(), i0 = Math.min(st.loads.length - 1, +st.cur || 0);
    const { p } = A().crumbK('platines');
    const tubeFams = D.FAMILIES.filter((f) => f.tube && (st.shape === 'chs' ? f.tube === 'chs' : f.tube !== 'chs')).map((f) => [f.id, f.id]);
    if (!isI && !tubeFams.some((f) => f[0] === st.tube.fam)) { st.tube.fam = tubeFams[0][0]; const l = D.CATALOG[st.tube.fam] || []; st.tube.name = l.length ? l[Math.floor(l.length / 3)].name : ''; }
    const secFields = isI
      ? (st.sec.kind === 'prs' ? field('h', inp('sec.prs.h'), 'mm') + field('b', inp('sec.prs.b'), 'mm') + field('t<sub>w</sub>', inp('sec.prs.tw'), 'mm') + field('t<sub>f</sub>', inp('sec.prs.tf'), 'mm')
        : field('Famille', sel('sec.fam', iFams(), { rr: true })) + field('Profil', sel('sec.name', (D.CATALOG[st.sec.fam] || []).map((x) => [x.name, x.name]))))
      : (st.tube.kind === 'custom' ? (st.shape === 'chs' ? field('d', inp('tube.d'), 'mm') : field('h', inp('tube.h'), 'mm') + field('b', inp('tube.b'), 'mm')) + field('t', inp('tube.t'), 'mm')
        : field('Famille', sel('tube.fam', tubeFams, { rr: true })) + field('Profil', sel('tube.name', (D.CATALOG[st.tube.fam] || []).map((x) => [x.name, x.name])))) + field('Fabrication', sel('tube.fab', [['hot', 'Fini à chaud (EN 10210)'], ['cold', 'Formé à froid (EN 10219)']]));
    const lay = isI ? `<div class="fields">
        <div style="grid-column:1/-1;display:flex;gap:18px;flex-wrap:wrap">${chk('Ilay.extTop', 'Rangée débordante en haut', true)} ${chk('Ilay.extBot', 'Rangée débordante en bas', true)}</div>
        ${field('m<sub>x</sub> (débord)', inp('Ilay.mx'), 'mm', 'Axe des boulons → face extérieure de la semelle')}${field('e<sub>x</sub>', inp('Ilay.ex'), 'mm', 'Axe des boulons → bord de platine')}
        ${field('Rangées intérieures en haut', inp('Ilay.nInTop'))}${field('Rangées intérieures en bas', inp('Ilay.nInBot'))}
        ${field('m<sub>i</sub>', inp('Ilay.mi'), 'mm', 'Face intérieure de semelle → 1re rangée intérieure')}${field('Entraxe p', inp('Ilay.p'), 'mm', 'Entre rangées intérieures du même côté')}
        ${field('Pince w', inp('Ilay.w'), 'mm', 'Entraxe horizontal des 2 boulons d\'une rangée')}${field('Largeur b<sub>p</sub>', inp('Ilay.bp'), 'mm')}
        ${field('Débord sans rangée', inp('Ilay.over'), 'mm', 'Platine au-delà de la semelle')}
      </div>` : `<div class="fields">
        ${st.shape === 'rhs' ? field('Boulons sur', sel('Tlay.sides', [[4, '4 faces'], [2, '2 faces (haut et bas)']], { rr: true })) + field('Boulons par face', inp('Tlay.nSide')) : field('Nombre de boulons', inp('Tlay.nChs'))}
        ${field('m', inp('Tlay.m'), 'mm', 'Face extérieure du tube → axe des boulons')}${field('e', inp('Tlay.e'), 'mm', 'Axe des boulons → bord de platine')}
        ${st.shape === 'rhs' && +st.Tlay.sides === 2 ? field('Débord latéral', inp('Tlay.over'), 'mm') : ''}
      </div>`;
    app.innerHTML = `<div class="page">
      <div class="actionbar">
        <div class="grow"><span class="crumb">${p ? `Projet <b>${esc(p.name)}</b> ›` : 'Hors projet ›'} <b id="eCrumb">${esc(st.name || 'Sans nom')}</b></span><span class="dirty" id="eDirty">${dirty ? 'modifié · non enregistré' : ''}</span></div>
        <span id="eVerdict"></span>
        <div class="btn-group"><button class="btn" data-eact="new">Nouveau</button><button class="btn" data-eact="save">Enregistrer</button><button class="btn" data-eact="saveas">Enregistrer sous…</button></div>
        <button class="btn primary" data-eact="report">Fiche NDC ↗</button>
      </div>
      ${blockHead('01', 'Barres & matériaux', 'Deux extrémités de barres identiques, chacune soudée sur une platine d\'about ; les deux platines sont boulonnées.')}
      <div class="cols2"><div>
        <div class="fields">${field('Repère', inp('name', { type: 'text', ph: 'ex. Joint de montage J2' }))}</div>
        <div class="chips" style="margin:14px 0">${[['I', 'Profil I / H'], ['rhs', 'Tube RHS / SHS'], ['chs', 'Tube CHS']].map(([k, l]) => `<button type="button" class="chip${st.shape === k ? ' on' : ''}" data-eact="shape" data-v="${k}">${l}</button>`).join('')}</div>
        <div class="chips" style="margin:0 0 14px">${isI ? [['cat', 'Catalogue'], ['prs', 'PRS']].map(([k, l]) => `<button type="button" class="chip${st.sec.kind === k ? ' on' : ''}" data-eact="kind" data-v="${k}">${l}</button>`).join('') : [['cat', 'Catalogue'], ['custom', 'Sur mesure']].map(([k, l]) => `<button type="button" class="chip${st.tube.kind === k ? ' on' : ''}" data-eact="tkind" data-v="${k}">${l}</button>`).join('')}</div>
        <div class="fields">${secFields}
          ${field('Acier de la barre', sel('grade', Object.keys(D.STEELS).map((x) => [x, x])))}
          ${field('Acier des platines', sel('plateGrade', Object.keys(D.STEELS).map((x) => [x, x])))}
        </div></div>
        <div id="eInfo" class="muted" style="font-size:12.5px;line-height:1.6"></div>
      </div>
      ${blockHead('02', 'Boulons, platines, soudures', 'Boulons sollicités en traction (avec effet de levier) et en cisaillement.')}
      <div class="fields">
        ${field('Diamètre', sel('bolt.d', Object.keys(SC.BOLTS).map((d) => [d, 'M' + d])))}${field('Classe', sel('bolt.cls', Object.keys(SC.CLASSES).map((x) => [x, x])))}
        ${field('Épaisseur des platines t<sub>p</sub>', inp('plate.tp'), 'mm')}
        ${isI ? field('Gorge cordons de semelle a<sub>f</sub>', inp('plate.af'), 'mm') + field('Gorge cordons d\'âme a<sub>w</sub>', inp('plate.aw'), 'mm') : field('Gorge du cordon périphérique a', inp('plate.aw'), 'mm')}
        ${field('γ<sub>M2</sub>', inp('gam.M2'))}
      </div>
      <div style="margin:12px 0">${chk('bolt.threads', 'Filetage dans le plan de cisaillement')}</div>
      ${blockHead('03', 'Disposition des boulons', isI ? 'Rangées de 2 boulons (de part et d\'autre de l\'âme) : débordantes au-delà des semelles et intérieures entre semelles.' : 'Boulons répartis autour du tube, hors des parois.')}
      ${lay}
      <div id="eGeo" style="margin-top:14px"></div>
      ${blockHead('04', 'Torseurs ELU', 'Torseur au droit du joint, un par combinaison ; l\'enveloppe est vérifiée.')}
      <div class="tq-grid">
        <div class="fields" style="grid-template-columns:1fr">
          ${st.loads.length > 1 ? `<div class="chips">${st.loads.map((x, j) => `<button type="button" class="chip${j === i0 ? ' on' : ''}" data-eact="cur" data-i="${j}">${esc(x.name || 'T' + (j + 1))}</button>`).join('')}</div>` : ''}
          ${field('Torseur', `<input type="text" data-ep="loads.${i0}.name" value="${esc(L.name)}">`)}
          ${COMPS.map(([k, l, u, t]) => `<label class="field"><span><b style="color:${DR.COL[k]}">${sub(l)}</b> <span class="u">[${u}] — ${t}</span></span><input type="number" step="any" data-ep="loads.${i0}.${k}" value="${esc(L[k])}"></label>`).join('')}
        </div>
        <div id="eTq3D" class="fig"></div>
        <div class="fig">${DR.convention()}</div>
      </div>
      <div class="sub-title" style="margin-top:22px">Tous les torseurs</div>
      <div class="tbl-wrap"><table class="grid">
        <thead><tr><th class="rowh">Torseur</th>${COMPS.map(([, l, u]) => `<th>${sub(l)} [${u}]</th>`).join('')}<th>Taux</th><th></th></tr></thead>
        <tbody>${st.loads.map((x, i) => `<tr><td><input type="text" data-ep="loads.${i}.name" value="${esc(x.name)}" style="min-width:140px;text-align:left"></td>${COMPS.map(([k], j) => `<td><input type="number" step="any" data-ep="loads.${i}.${k}" data-lr="${i}" data-lc="${j}" value="${esc(x[k])}"></td>`).join('')}<td class="ro" id="eRate${i}"></td><td>${st.loads.length > 1 ? `<button class="btn sm ghost" data-eact="delLoad" data-i="${i}">✕</button>` : ''}</td></tr>`).join('')}</tbody>
      </table></div>
      <div style="margin:8px 0 14px"><button class="btn sm" data-eact="addLoad">+ Ajouter un torseur</button></div>
      ${blockHead('05', 'Efforts dans les boulons', isI ? 'Méthode des composantes : résistance de chaque rangée tendue (tronçon en T, âme tendue, boulons), M_j,Rd et interaction avec N.' : 'Tractions élastiques par boulon (N, M_y, M_z) ; cisaillement V et torsion M_x répartis sur les boulons.')}
      <div id="eFlow"></div>
      ${blockHead('06', 'Vérifications', 'NF EN 1993-1-8 § 3 (boulons) et § 6.2 (tronçons en T, composantes) ; soudures par la méthode simplifiée § 4.5.3.3.')}
      <div id="eResults"></div>
    </div>`;
    refresh();
  }

  function refresh() {
    R = C.compute(st); ENV = C.computeEnv(st);
    const v = $('#eVerdict');
    if (v) v.innerHTML = !R.valid ? '<span class="verdict ko">— <small>données invalides</small></span>' : `<span class="verdict ${ENV.max <= 1 && !ENV.partial ? 'ok' : 'ko'}">${pct(ENV.max)} <small>${ENV.partial ? 'incomplet' : ENV.max <= 1 ? 'vérifié*' : 'non vérifié'}</small></span>`;
    const dd = $('#eDirty'); if (dd) dd.textContent = dirty ? 'modifié · non enregistré' : '';
    const cn = $('#eCrumb'); if (cn) cn.textContent = st.name || 'Sans nom';
    ENV.perLoad.forEach((m, i) => { const c = $('#eRate' + i); if (c) c.innerHTML = `<b style="color:${m > 1 ? 'var(--c-red)' : 'inherit'}">${pct(m)}</b>${i === ENV.govIdx ? ' ◂' : ''}`; });
    if (!R.valid) { ['#eGeo', '#eFlow', '#eResults'].forEach((x) => { const e = $(x); if (e) e.innerHTML = R.warnings.map((w) => `<p class="note warn">${sub(w)}</p>`).join(''); }); return; }
    const S = R.S;
    const ei = $('#eInfo');
    if (ei) ei.innerHTML = `<b style="color:var(--ink)">${esc(S.name)}</b> — ${S.type === 'CHS' ? `d = ${fmtG(S.d, 1)}, t = ${fmtG(S.t, 1)}` : S.type === 'RHS' ? `h = ${fmtG(S.h, 1)}, b = ${fmtG(S.b, 1)}, t = ${fmtG(S.t, 1)}` : `h = ${fmtG(S.h, 1)}, b = ${fmtG(S.b, 1)}, t<sub>w</sub> = ${fmtG(S.tw, 1)}, t<sub>f</sub> = ${fmtG(S.tf, 1)}`} mm<br>
      f<sub>y</sub>/f<sub>u</sub> barre : ${R.mat.fym}/${R.mat.fum} MPa · platines : ${R.mat.fyp}/${R.mat.fup} MPa<br>
      M${R.bolt.d} ${R.bolt.cls} : F<sub>t,Rd</sub> = ${kN(R.bolt.FtRd)} kN, B<sub>p,Rd</sub> = ${kN(R.bolt.BpRd)} kN, F<sub>v,Rd</sub> = ${kN(R.bolt.FvRd)} kN`;
    const geo = $('#eGeo');
    if (geo) geo.innerHTML = `<div class="fig-grid"><div class="fig">${front(R)}</div><div class="fig">${iso(R)}</div><div class="fig wide">${side(R)}</div></div>`;
    const t3 = $('#eTq3D');
    if (t3) t3.innerHTML = S.type === 'I' ? DR.torseur3D(R, curLoad()) : `<div style="padding:12px;font-size:13px">${front(R)}<p class="note">Repère : y horizontal, z vertical, x le long de la barre. N &gt; 0 : compression ; M<sub>y</sub> &gt; 0 comprime le haut (z &gt; 0) ; M<sub>z</sub> &gt; 0 comprime le côté +y.</p></div>`;
    renderFlow();
    renderResults();
  }

  function renderFlow() {
    const box = $('#eFlow'); if (!box) return;
    const S = R.S;
    let tbl = '';
    if (S.type === 'I') {
      const side = R.Mres[R.Mside];
      tbl = `<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Rangée</th><th class="num">z [mm]</th><th class="num">h<sub>r</sub> [mm]</th><th class="num">l<sub>eff,1</sub> / l<sub>eff,2</sub></th><th class="num">m</th><th>Mode</th><th class="num">F<sub>T,ep</sub> [kN]</th><th class="num">Âme tendue [kN]</th><th class="num">F<sub>t,r,Rd</sub> [kN]</th></tr></thead><tbody>
        ${side.rows.map((q) => `<tr><td>${{ ext: 'débordante', adj: 'près de semelle', inner: 'intérieure' }[q.type]}</td><td class="num">${fmtG(q.z, 1)}</td><td class="num">${fmtG(q.h, 1)}</td><td class="num">${fmtG(q.cap.l1, 0)} / ${fmtG(q.cap.l2, 0)}</td><td class="num">${fmtG(q.cap.m, 1)}</td><td>${q.cap.ts.mode}</td><td class="num">${kN(q.cap.ts.F)}</td><td class="num">${Number.isFinite(q.cap.web) ? kN(q.cap.web) : '—'}</td><td class="num"><b>${kN(q.F)}</b></td></tr>`).join('')}
        </tbody></table></div>
        <p class="note">Sens de flexion du torseur affiché : rangées ${R.Mside === 'bot' ? 'inférieures' : 'supérieures'} tendues. M<sub>j,Rd</sub> = Σ h<sub>r</sub>·F<sub>t,r,Rd</sub> = <b>${fmt(R.MjRd / 1e6, 1)} kN·m</b> ; F<sub>c,fb,Rd</sub> = ${kN(R.comp.FcRd)} kN ; N<sub>j,Rd</sub> (traction) = ${kN(R.NjRd.t)} kN. Longueurs efficaces du tableau 6.6 (rangée près de la semelle tendue avec α = 4,45, valeur minimale de la figure 6.11, donc sécuritaire ; effets de groupe pris par rangée), limitation 6.2.7.2 (9) si une rangée dépasse 1,9·F<sub>t,Rd</sub>.</p>`;
    } else {
      tbl = `<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Boulon</th><th class="num">y</th><th class="num">z</th><th class="num">F<sub>t,Ed</sub> [kN]</th><th class="num">F<sub>T,Rd</sub> [kN]</th><th class="num">F<sub>v,Ed</sub> [kN]</th></tr></thead><tbody>
        ${R.geo.bolts.map((q, i) => `<tr><td>${i + 1}</td><td class="num">${fmtG(q.y, 1)}</td><td class="num">${fmtG(q.z, 1)}</td><td class="num">${kN(R.FtBolt[i])}</td><td class="num">${kN(R.caps[i].F)}</td><td class="num">${kN(R.fv[i].f)}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="note">F<sub>t,i</sub> = −N/n + M<sub>y</sub>·(−z<sub>i</sub>)/Σz² + M<sub>z</sub>·(−y<sub>i</sub>)/Σy² (répartition élastique autour du centre du groupe, sécuritaire par rapport à un centre de compression au bord de la paroi). Résistance par boulon : tronçon en T (l<sub>eff</sub> = min(2πm ; 4m + 1,25e ; longueur tributaire)) et bande de paroi tendue.</p>`;
    }
    box.innerHTML = `<div class="fig-grid"><div class="fig">${front(R, 'forces')}</div><div>${tbl}</div></div>`;
  }

  function renderResults() {
    const box = $('#eResults'); if (!box) return;
    const E = ENV, multi = st.loads.length > 1;
    const pr = partRates(E.rows), rates = Object.fromEntries(Object.entries(pr).map(([k, v]) => [k, v.r]));
    const val = (c, x) => (c.ratioOnly ? '—' : c.perLen ? fmt(x, 0) + ' N/mm' : kN(x));
    const rows = (g) => E.rows.filter((c) => c.grp === g).map((c) => `<tr${E.gov === c ? ' class="gov"' : ''}><td>${sub(c.label)}${c.note ? `<div class="f" style="font-size:11px">${sub(c.note)}</div>` : ''}</td><td class="f">${c.ref}</td>${multi ? `<td class="f">${esc(c.name)}</td>` : ''}<td class="num">${val(c, c.Ed)}</td><td class="num">${val(c, c.Rd)}</td><td class="num"><span class="ratio">${pct(c.geo ? c.rg : c.r)}</span></td><td style="width:100px">${bar(c.r)}</td><td>${pill(c.r)}</td></tr>`).join('');
    const warns = [...new Set(E.runs.flatMap((r) => r.warnings))], infos = [...new Set(E.runs.flatMap((r) => r.info))];
    box.innerHTML = `${warns.map((w) => `<p class="note warn">${sub(w)}</p>`).join('')}${infos.map((w) => `<p class="note">${sub(w)}</p>`).join('')}
      <div class="kpis">
        <div class="kpi ${E.max <= 1 && !E.partial ? 'hero' : 'bad'}"><b>Taux maximal</b><span>${pct(E.max)}</span><small>${E.partial ? 'Vérification incomplète (M_z, M_x)' : E.max <= 1 ? 'Vérifié pour les critères traités*' : 'Assemblage non vérifié'}${multi ? ' · ' + esc(st.loads[E.govIdx].name) : ''}</small></div>
        ${PARTS.map(([id, label]) => `<div class="kpi${pr[id].r > 1 ? ' bad' : ''}"><b>${label}</b><span>${pct(pr[id].r)}</span><small>${sub((pr[id].gov.label || '—').replace(/\s*\(.*$/, ''))}</small></div>`).join('')}
      </div>
      <div class="fig-grid split" style="margin-top:18px">
        <div class="fig">${iso(R, { colorOf: (id) => DR.rateCol(rates[id]), title: 'Taux d\'utilisation par pièce', sub: 'vert : faible · orange : proche de 1 · rouge : > 100 % — enveloppe' })}</div>
        <div><div class="sub-title" style="margin-top:4px">Taux par pièce</div><div class="rate-legend" style="grid-template-columns:1fr">
          ${PARTS.map(([id]) => `<div><i style="background:${DR.rateCol(pr[id].r)}"></i><span>${pr[id].label}<br><small class="muted">${sub((pr[id].gov.label || '—').replace(/\s*\(.*$/, ''))}</small></span><b>${pct(pr[id].r)}</b></div>`).join('')}
        </div></div></div>
      <p class="note">* Critères traités : tronçons en T des platines (3 modes, effet de levier), boulons (traction, poinçonnement, cisaillement, interaction), ${R.S.type === 'I' ? 'âme tendue, semelle comprimée, moment résistant M_j,Rd et interaction N–M (6.23)' : 'bande de paroi tendue'}, pression diamétrale, soudures (méthode simplifiée). Hors champ : résistance de la barre hors du joint, raideur de l'assemblage${R.S.type === 'I' ? ', M_z et M_x' : ''}.</p>
      ${[['bolts', 'Boulons'], ['plate', 'Platines'], ['beam', 'Barre'], ['weld', 'Soudures']].filter(([g]) => E.rows.some((c) => c.grp === g)).map(([g, t]) => `<div class="sub-title" style="margin-top:26px">${t}</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Critère</th><th>Réf. EC3</th>${multi ? '<th>Torseur</th>' : ''}<th class="num">E<sub>d</sub></th><th class="num">R<sub>d</sub></th><th class="num">Taux</th><th></th><th></th></tr></thead><tbody>${rows(g)}</tbody></table></div>`).join('')}`;
  }

  // ======================================================================
  //  FICHE NDC
  // ======================================================================
  function page(state, project, idx, total, opts) {
    const keep = st; st = C.upgrade(JSON.parse(JSON.stringify(state)));
    try {
      const E = C.computeEnv(st), Rg = C.compute(st, E.govIdx);
      if (!Rg.valid) return `<section class="rp-page"><p>${esc(st.name)} : données invalides.</p></section>`;
      const S = Rg.S, G = Rg.geo, multi = st.loads.length > 1;
      const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      const head = (pg) => `<header class="rp-head"><div class="l"><b>${esc(project || 'Note de calcul')}</b>Vérification d'assemblage acier — NF EN 1993-1-8${opts && opts.ref ? ' · ' + esc(opts.ref) : ''}</div><div class="r">${!opts || opts.logo ? '<div class="logo-s">tracés</div>' : ''}${esc(st.name)} · ${date} · ${pg}</div></header>`;
      let n = 0; const H2 = (t) => `<h2><span class="n">${++n}</span>${t}</h2>`;
      const kv = (a, b) => `<div><span>${a}</span><b>${b}</b></div>`;
      const pr = partRates(E.rows), rates = Object.fromEntries(Object.entries(pr).map(([k, v]) => [k, v.r]));
      const val = (c, x) => (c.ratioOnly ? '—' : c.perLen ? fmt(x, 0) + ' N/mm' : kN(x));
      const chk = E.rows.map((c) => `<tr${E.gov === c ? ' class="gov"' : ''}><td>${{ bolts: 'Boulons', plate: 'Platines', beam: 'Barre', weld: 'Soudures' }[c.grp]}</td><td>${sub(c.label)}</td><td>${c.ref}</td>${multi ? `<td>${esc(c.name)}</td>` : ''}<td class="num">${val(c, c.Ed)}</td><td class="num">${val(c, c.Rd)}</td><td class="num">${pct(c.geo ? c.rg : c.r)}</td><td>${c.r <= 1 ? '<span class="rp-ok">OK</span>' : '<span class="rp-ko">Non vérifié</span>'}</td></tr>`).join('');
      const infos = [...new Set(E.runs.flatMap((r) => r.warnings.concat(r.info)))];
      const p1 = `<section class="rp-page">${head('p. 1')}
        <div class="rp-title"><h1>${esc(st.name)} — platines d'about, ${esc(S.name)}${total > 1 ? ` (${idx + 1}/${total})` : ''}</h1>
        <p>Deux platines ${fmtG(Rg.tp, 1)} mm ${esc(st.plateGrade)} · ${G.bolts.length} boulons M${Rg.bolt.d} ${Rg.bolt.cls} · NF EN 1993-1-8 et NF EN 1993-1-1 avec annexes nationales françaises</p></div>
        ${H2('Hypothèses')}
        <div class="rp-kv">
          ${kv('Barres', `${esc(S.name)} ${esc(st.grade)} (f<sub>y</sub> = ${Rg.mat.fym}, f<sub>u</sub> = ${Rg.mat.fum} MPa)`)}${kv('Platines', `t<sub>p</sub> = ${fmtG(Rg.tp, 1)} mm ${esc(st.plateGrade)} (f<sub>y</sub> = ${Rg.mat.fyp}, f<sub>u</sub> = ${Rg.mat.fup} MPa)`)}
          ${kv('Boulons', `M${Rg.bolt.d} ${Rg.bolt.cls} : F<sub>t,Rd</sub> = ${kN(Rg.bolt.FtRd)}, B<sub>p,Rd</sub> = ${kN(Rg.bolt.BpRd)}, F<sub>v,Rd</sub> = ${kN(Rg.bolt.FvRd)} kN`)}${kv('Soudures', S.type === 'I' ? `a<sub>f</sub> = ${st.plate.af} mm, a<sub>w</sub> = ${st.plate.aw} mm` : `a = ${st.plate.aw} mm`)}
        </div>
        <table style="border:0"><tr><td style="border:0;padding:0;width:50%">${front(Rg, null, 460, 430)}</td><td style="border:0;padding:0">${iso(Rg, { W: 480, H: 340 })}</td></tr></table>
        ${side(Rg, 600, 260)}
      </section>`;
      const p2 = `<section class="rp-page">${head('p. 2')}
        ${H2(multi ? 'Torseurs ELU' : 'Torseur ELU')}
        <table><thead><tr><th>Torseur</th>${COMPS.map(([, l, u]) => `<th class="num">${sub(l)} [${u}]</th>`).join('')}<th class="num">Taux</th></tr></thead><tbody>${st.loads.map((x, i) => `<tr${i === E.govIdx ? ' class="gov"' : ''}><td>${esc(x.name)}</td>${COMPS.map(([k]) => `<td class="num">${fmtG(+x[k] || 0, 2)}</td>`).join('')}<td class="num">${pct(E.perLoad[i])}</td></tr>`).join('')}</tbody></table>
        ${H2('Efforts dans les boulons' + (multi ? ' — torseur « ' + esc(Rg.loadName) + ' »' : ''))}
        <table style="border:0"><tr><td style="border:0;padding:0;width:50%">${front(Rg, 'forces', 460, 430)}</td><td style="border:0;padding:0 0 0 6pt;font-size:8pt">${S.type === 'I' ? `M<sub>j,Rd</sub> = ${fmt(Rg.MjRd / 1e6, 1)} kN·m ; F<sub>c,fb,Rd</sub> = ${kN(Rg.comp.FcRd)} kN ; N<sub>j,Rd</sub> = ${kN(Rg.NjRd.t)} kN (traction).<br><br>` + Rg.Mres[Rg.Mside].rows.map((q) => `Rangée z = ${fmtG(q.z, 0)} mm (${{ ext: 'débordante', adj: 'près de semelle', inner: 'intérieure' }[q.type]}) : h<sub>r</sub> = ${fmtG(q.h, 0)} mm, l<sub>eff,1</sub> = ${fmtG(q.cap.l1, 0)} mm, mode ${q.cap.ts.mode}, F<sub>t,r,Rd</sub> = ${kN(q.F)} kN`).join('<br>') : 'Tractions élastiques par boulon ; résistance par boulon : tronçon en T et bande de paroi.'}</td></tr></table>
        ${H2('Vérifications')}
        <table><thead><tr><th>Partie</th><th>Critère</th><th>Réf.</th>${multi ? '<th>Torseur</th>' : ''}<th class="num">E<sub>d</sub></th><th class="num">R<sub>d</sub></th><th class="num">Taux</th><th>Statut</th></tr></thead><tbody>${chk}</tbody></table>
        ${infos.length ? `<p style="font-size:7.6pt"><b>Remarques :</b> ${infos.map(sub).join(' ')}</p>` : ''}
        <table style="border:0"><tr><td style="border:0;padding:0;width:58%">${iso(Rg, { W: 500, H: 320, colorOf: (id) => DR.rateCol(rates[id]), title: 'Taux d\'utilisation par pièce', sub: 'enveloppe des torseurs' })}</td><td style="border:0;padding:0 0 0 6pt"><table><tbody>${PARTS.map(([id]) => `<tr><td><span style="display:inline-block;width:8pt;height:8pt;background:${DR.rateCol(pr[id].r)};border:.5pt solid #111;margin-right:4pt"></span>${pr[id].label}</td><td class="num">${pct(pr[id].r)}</td></tr>`).join('')}</tbody></table></td></tr></table>
        <div class="rp-concl"><span>Conclusion — platines d'about ${esc(S.name)}</span><b class="${E.max <= 1 && !E.partial ? 'rp-ok' : 'rp-ko'}">${E.partial ? 'Vérification incomplète' : E.max <= 1 ? 'Vérifiées' : 'Non vérifiées'} — taux max. ${pct(E.max)}</b></div>
      </section>`;
      return p1 + p2;
    } finally { st = keep; }
  }

  // ======================================================================
  //  ÉVÉNEMENTS
  // ======================================================================
  function bind(app) {
    const onEdit = (e) => {
      const t = e.target; if (!t.dataset || !t.dataset.ep || t.closest('.modal')) return;
      if (e.type === 'input' && (t.tagName === 'SELECT' || t.type === 'checkbox')) return;
      const p = t.dataset.ep;
      let v = t.type === 'checkbox' ? t.checked : t.value;
      if (p === 'bolt.d' || p === 'Tlay.sides') v = +v;
      set(p, v);
      if (p === 'sec.fam') { const l = D.CATALOG[v] || []; st.sec.name = l.length ? l[Math.floor(l.length / 2)].name : ''; }
      if (p === 'tube.fam') { const l = D.CATALOG[v] || []; st.tube.name = l.length ? l[Math.floor(l.length / 3)].name : ''; }
      document.querySelectorAll(`[data-ep="${p}"]`).forEach((el) => { if (el !== t && el.type !== 'checkbox') el.value = t.value; });
      dirty = true; persist();
      if ((t.dataset.rr && e.type === 'change') || p === 'sec.fam' || p === 'tube.fam') { const y = window.scrollY; render(app); window.scrollTo(0, y); return; }
      refresh();
    };
    app.addEventListener('input', onEdit);
    app.addEventListener('change', onEdit);
    app.addEventListener('paste', (e) => {
      const t = e.target; if (!t.dataset || t.dataset.lr == null || !t.dataset.ep) return;
      const txt = (e.clipboardData || window.clipboardData).getData('text');
      if (!/[\t\n]/.test(txt)) return;
      e.preventDefault();
      const r0 = +t.dataset.lr, c0 = +t.dataset.lc;
      txt.replace(/\r/g, '').split('\n').filter((l) => l.trim().length).forEach((line, i) => {
        const r = r0 + i;
        while (st.loads.length <= r) st.loads.push({ name: 'ELU ' + (st.loads.length + 1), N: 0, Vy: 0, Vz: 0, Mx: 0, My: 0, Mz: 0 });
        line.split('\t').forEach((cell, j) => { const c = COMPS[c0 + j]; if (c) st.loads[r][c[0]] = cell.trim().replace(/\s/g, '').replace(',', '.'); });
      });
      dirty = true; persist(); const y = window.scrollY; render(app); window.scrollTo(0, y);
    });
    app.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-eact]'); if (!b) return;
      const a = b.dataset.eact, y = window.scrollY;
      const rr = () => { dirty = true; persist(); render(app); window.scrollTo(0, y); };
      if (a === 'shape') { st.shape = b.dataset.v; rr(); }
      else if (a === 'kind') { st.sec.kind = b.dataset.v; rr(); }
      else if (a === 'tkind') { st.tube.kind = b.dataset.v; rr(); }
      else if (a === 'cur') { st.cur = +b.dataset.i; rr(); }
      else if (a === 'addLoad') { st.loads.push(Object.assign({}, curLoad(), { name: 'ELU ' + (st.loads.length + 1) })); rr(); }
      else if (a === 'delLoad') { st.loads.splice(+b.dataset.i, 1); st.cur = Math.min(+st.cur || 0, st.loads.length - 1); rr(); }
      else if (a === 'save' || a === 'saveas') { const ok = await A().saveItem('platines', st, a === 'saveas'); if (ok) { dirty = false; persist(); render(app); window.scrollTo(0, y); } }
      else if (a === 'new') {
        if (dirty && !(await A().confirmBox('Nouvel assemblage', 'Les modifications non enregistrées seront perdues. Continuer ?'))) return;
        st = C.defaultState(); st.name = 'Nouvelles platines'; A().newItem('platines'); dirty = false; persist(); render(app);
      }
      else if (a === 'report') window.FirmitasReport.open([{ state: st, project: A().crumbK('platines').p ? A().crumbK('platines').p.name : '' }]);
    });
  }
  function load(state) { st = C.upgrade(state); dirty = false; persist(); }

  const api = { init, render, bind, page, load, flush, get state() { return st; }, get dirty() { return dirty; }, summary: C.summary };
  window.FirmitasEP = api;
  window.FirmitasModules = window.FirmitasModules || {};
  window.FirmitasModules.platines = { kind: 'platines', route: 'platines', title: 'Platines d\'about', short: 'platines', ref: 'NF EN 1993-1-8 + AN', api, upgrade: C.upgrade };
})();
