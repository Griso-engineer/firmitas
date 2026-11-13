/* ==========================================================================
   Firmitas — module « Plat soudé » : interface, dessins cotés, 3D, fiche NDC
   ========================================================================== */
(function () {
  'use strict';
  const C = window.FirmitasFinCalc, SC = window.FirmitasSpliceCalc, D = window.FIRMITAS_DATA;
  const A = () => window.FirmitasApp, R3 = () => window.FirmitasR3D, DR = window.FirmitasSpliceDraw;
  const U = DR.util;
  const { T, sb, svgWrap, dimH, dimV, chainH, rect, axisV, INK, MUTED, ACC, BEAM, RED, DIM, BOLT } = U;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
  const fmtG = (x, d = 3) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { maximumFractionDigits: d }) : '—');
  const pct = (r) => (Number.isFinite(r) ? Math.round(r * 100) + ' %' : '∞');
  const sub = (s) => esc(s).replace(/_([A-Za-z0-9,.]+)/g, '<sub>$1</sub>');
  const bar = (r) => `<div class="bar"><i class="${!(r <= 1) ? 'ko' : r > 0.9 ? 'hi' : ''}" style="width:${Math.min(100, (Number.isFinite(r) ? r : 1) * 100)}%"></i></div>`;
  const pill = (r) => (r == null ? '<span class="pill na">—</span>' : r <= 1 ? '<span class="pill ok">OK</span>' : '<span class="pill ko">NON</span>');
  const kN = (x) => fmt(x / 1e3, 1);
  const SUP = '#e9e6dc';
  let st = null, R = null, ENV = null, dirty = false, db = null, uid = 0;
  const get = (p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), st);
  function set(p, v) { const ks = p.split('.'); let a = st; ks.slice(0, -1).forEach((k) => { if (a[k] == null) a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }
  const curLoad = () => st.loads[Math.min(st.loads.length - 1, +st.cur || 0)];
  const inp = (p, o = {}) => `<input type="${o.type || 'number'}" data-fp="${p}" value="${esc(get(p))}"${(o.type || 'number') === 'number' ? ' step="any"' : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>`;
  const sel = (p, opts, o = {}) => { const v = String(get(p)); return `<select data-fp="${p}"${o.rr ? ' data-rr="1"' : ''}>${opts.map((x) => `<option value="${esc(x[0])}"${String(x[0]) === v ? ' selected' : ''}>${esc(x[1])}</option>`).join('')}</select>`; };
  const chk = (p, label, rr) => `<label class="check"><input type="checkbox" data-fp="${p}"${get(p) ? ' checked' : ''}${rr ? ' data-rr="1"' : ''}> ${label}</label>`;
  const field = (label, control, unit, hint) => `<label class="field"><span>${label}${unit ? ` <span class="u">[${unit}]</span>` : ''}</span>${control}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  const blockHead = (n, t, p) => `<div class="block-head"><span class="num">${n}</span><h2>${t}</h2><p>${p || ''}</p></div>`;
  const iFams = () => D.FAMILIES.filter((f) => !f.tube && !f.ipn).map((f) => [f.id, f.id]);

  function init(database) { db = database; st = db.draft_platsoude ? C.upgrade(db.draft_platsoude) : C.defaultState(); dirty = !!db.draftDirty_platsoude; }
  function flush(dbx) { dbx.draft_platsoude = st; dbx.draftDirty_platsoude = dirty; }
  let saveT = null;
  function persist() { clearTimeout(saveT); saveT = setTimeout(() => { flush(db); A().saveDb(); }, 250); }

  // ======================================================================
  //  DESSINS
  // ======================================================================
  // Élévation (face côté plat) : x horizontal depuis la face d'appui, z vertical (0 = haut de la poutre)
  function elevation(R, W = 600, H = 400) {
    const S = R.S, G = R.geo;
    const Lb = G.g + Math.max(G.bp - G.g + 0.7 * S.h, 1.1 * S.h);
    const k = Math.min((W - 210) / (Lb + 30), (H - 120) / (S.h + 80));
    const x0 = 90, z0 = 62;
    const X = (x) => x0 + (x + 30) * k, Z = (z) => z0 + (40 - z) * k;     // z vers le haut, haut de poutre à z = 0
    let s = '';
    // poutre support (hors vérification) hachurée
    const hid = 'h' + (++uid);
    s += `<defs><pattern id="${hid}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${MUTED}" stroke-width=".7"/></pattern></defs>`;
    s += rect(X(-30), Z(40), 30 * k, (S.h + 80) * k, `fill="url(#${hid})" stroke="${INK}" stroke-width=".8"`);
    s += T(X(-15), Z(40) - 5, 'support', { a: 'middle', fs: 9, col: MUTED });
    // poutre portée
    s += rect(X(G.g), Z(0), (Lb - G.g) * k, S.h * k, `fill="#eef1f5" stroke="${INK}" stroke-width=".9"`);
    s += `<line x1="${X(G.g)}" y1="${Z(-S.tf)}" x2="${X(Lb)}" y2="${Z(-S.tf)}" stroke="${INK}" stroke-width=".7"/><line x1="${X(G.g)}" y1="${Z(-S.h + S.tf)}" x2="${X(Lb)}" y2="${Z(-S.h + S.tf)}" stroke="${INK}" stroke-width=".7"/>`;
    // plat soudé + cordon
    s += rect(X(0), Z(-G.zTop), G.bp * k, G.hp * k, `fill="${ACC}" fill-opacity=".6" stroke="${INK}" stroke-width="1"`);
    s += `<path d="M${X(0)},${Z(-G.zTop)} l${6},0 l${-6},${-6} z M${X(0)},${Z(-G.zTop - G.hp)} l6,0 l-6,6 z" fill="${INK}"/>`;
    // boulons
    const r = Math.max(2.5, R.bolt.d0 / 2 * k);
    G.pts.forEach((p) => { s += `<circle cx="${X(p.x)}" cy="${Z(-G.zG + p.t)}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="1"/>`; });
    s += axisV(X(G.zc), Z(-G.zTop) - 8, Z(-G.zTop - G.hp) + 8);
    // cotes horizontales (sous la poutre)
    const xs = [0, G.g, G.a]; const lb = ['g', 'e_2,b'];
    for (let j = 1; j < G.n2; j++) { xs.push(G.a + j * G.p2); lb.push('p_2'); }
    xs.push(G.bp); lb.push('e_2');
    const ch = chainH(xs.map(X), lb.map((l, i) => `${l} = ${fmtG(xs[i + 1] - xs[i], 1)}`), Z(-S.h) + 18, Z(-G.zTop - G.hp));
    s += ch.s;
    s += dimH(X(0), X(G.bp), ch.bottom + 18, `b_p = ${fmtG(G.bp, 1)}`, { ext: Z(-G.zTop - G.hp) });
    s += dimH(X(0), X(G.zc), Z(40) - 8, `z = ${fmtG(G.zc, 1)}`, { ext: Z(-G.zTop) });
    // cotes verticales (à droite)
    const xr = X(Lb) + 12;
    const zs = [0, -G.zTop]; const lv = [`z_p = ${fmtG(G.zTop, 1)}`, `e_1 = ${fmtG(G.e1, 1)}`];
    for (let i = 0; i < G.n1; i++) zs.push(-G.zTop - G.e1 - i * G.p1);
    zs.push(-G.zTop - G.hp);
    let sv = dimV(Z(zs[0]), Z(zs[1]), xr, lv[0], { ext: X(Lb) }) + dimV(Z(zs[1]), Z(zs[2]), xr, lv[1], { ext: X(G.bp) });
    for (let i = 2; i < zs.length - 2; i++) sv += dimV(Z(zs[i]), Z(zs[i + 1]), xr, `p_1 = ${fmtG(G.p1, 1)}`, { ext: X(G.bp) });
    sv += dimV(Z(zs[zs.length - 2]), Z(zs[zs.length - 1]), xr, `e_1 = ${fmtG(G.e1, 1)}`, { ext: X(G.bp) });
    s += sv + dimV(Z(-G.zTop), Z(-G.zTop - G.hp), xr + 64, `h_p = ${fmtG(G.hp, 1)}`, { ext: X(G.bp) });
    s += dimV(Z(0), Z(-S.h), X(G.g) - 10 - 30 * k, `h = ${fmtG(S.h, 1)}`, { ext: X(G.g), left: true });
    s += T(8, 16, 'Élévation (côté plat)', { fw: 800, fs: 11.5 });
    s += T(8, 30, `${S.name} · plat ${fmtG(G.hp, 0)} × ${fmtG(G.bp, 0)} × ${fmtG(G.tp, 1)} · ${G.n1} × ${G.n2} M${R.bolt.d} ${R.bolt.cls} · trait mixte : centre du groupe`, { fw: 500, fs: 9.5, col: MUTED });
    return svgWrap(W, Math.max(H, ch.bottom + 44), s);
  }
  // Coupe transversale (vue depuis la poutre portée vers l'appui) : y horizontal, z vertical
  function section(R, W = 400, H = 380) {
    const S = R.S, G = R.geo;
    const k = Math.min((H - 90) / S.h, (W - 170) / S.b);
    const cx = 70 + S.b * k / 2 + 30, z0 = 48;
    const Y = (y) => cx + y * k, Z = (z) => z0 - z * k;
    let s = '';
    const R2 = (y1, y2, z1, z2, st) => rect(Y(Math.min(y1, y2)), Z(Math.max(z1, z2)), Math.abs(y2 - y1) * k, Math.abs(z2 - z1) * k, st);
    s += R2(-S.b / 2, S.b / 2, -S.tf, 0, `fill="${BEAM}" stroke="${INK}" stroke-width=".8"`) + R2(-S.b / 2, S.b / 2, -S.h, -S.h + S.tf, `fill="${BEAM}" stroke="${INK}" stroke-width=".8"`) + R2(-S.tw / 2, S.tw / 2, -S.h + S.tf, -S.tf, `fill="${BEAM}" stroke="${INK}" stroke-width=".8"`);
    s += R2(-S.tw / 2 - G.tp, -S.tw / 2, -G.zTop - G.hp, -G.zTop, `fill="${ACC}" fill-opacity=".7" stroke="${INK}" stroke-width="1"`);
    const zr = [...new Set(G.pts.map((p) => p.t))];
    zr.forEach((t) => { s += `<line x1="${Y(-S.tw / 2 - G.tp) - 6}" y1="${Z(-G.zG + t)}" x2="${Y(S.tw / 2) + 6}" y2="${Z(-G.zG + t)}" stroke="${INK}" stroke-width="${Math.max(1.5, R.bolt.d * k * 0.55)}" stroke-opacity=".6"/>`; });
    s += axisV(Y(0), Z(0) - 8, Z(-S.h) + 8);
    s += dimV(Z(0), Z(-G.zTop), Y(-S.b / 2) - 14, `z_p = ${fmtG(G.zTop, 1)}`, { ext: Y(-S.tw / 2 - G.tp), left: true });
    s += dimV(Z(-G.zTop), Z(-G.zTop - G.hp), Y(-S.b / 2) - 14, `h_p = ${fmtG(G.hp, 1)}`, { ext: Y(-S.tw / 2 - G.tp), left: true });
    s += dimH(Y(-S.tw / 2 - G.tp), Y(-S.tw / 2), Z(-S.h) + 20, `t_p = ${fmtG(G.tp, 1)}`, { ext: Z(-G.zTop - G.hp) });
    s += T(Y(S.tw / 2) + 6, Z(-S.h / 2) + 4, sb(`t_w = ${fmtG(S.tw, 1)}`), { fs: 8.5, col: DIM });
    s += T(8, 16, 'Coupe transversale', { fw: 800, fs: 11.5 });
    s += T(8, 30, 'vue depuis la poutre portée vers l\'appui', { fw: 500, fs: 9.5, col: MUTED });
    return svgWrap(W, H, s);
  }
  // Vue de dessus (coupe sous la semelle supérieure) : x horizontal, y vertical
  function plan(R, W = 560, H = 230) {
    const S = R.S, G = R.groups ? null : null; void G;
    const g = R.geo;
    const Lb = g.g + Math.max(g.bp - g.g + 0.7 * S.h, 1.1 * S.h);
    const k = Math.min((W - 170) / (Lb + 30), (H - 100) / (S.b + 20));
    const x0 = 70, cy = 60 + S.b * k / 2;
    const X = (x) => x0 + (x + 30) * k, Y = (y) => cy - y * k;
    const hid = 'h' + (++uid);
    let s = `<defs><pattern id="${hid}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${MUTED}" stroke-width=".7"/></pattern></defs>`;
    s += rect(X(-30), Y(S.b / 2 + 20), 30 * k, (S.b + 40) * k, `fill="url(#${hid})" stroke="${INK}" stroke-width=".8"`);
    s += rect(X(g.g), Y(S.b / 2), (Lb - g.g) * k, S.b * k, `fill="none" stroke="${INK}" stroke-width=".7" stroke-dasharray="5 3"`);
    s += rect(X(g.g), Y(S.tw / 2), (Lb - g.g) * k, S.tw * k, `fill="${BEAM}" stroke="${INK}" stroke-width=".9"`);
    s += rect(X(0), Y(-S.tw / 2), g.bp * k, g.tp * k, `fill="${ACC}" fill-opacity=".7" stroke="${INK}" stroke-width="1"`);
    [...new Set(g.pts.map((p) => p.x))].forEach((x) => { s += `<line x1="${X(x)}" y1="${Y(S.tw / 2) - 7}" x2="${X(x)}" y2="${Y(-S.tw / 2 - g.tp) + 7}" stroke="${INK}" stroke-width="${Math.max(1.5, R.bolt.d * k * 0.55)}" stroke-opacity=".6"/>`; });
    s += dimH(X(0), X(g.g), Y(-S.b / 2) + 16, `g = ${fmtG(g.g, 1)}`, { ext: Y(-S.tw / 2 - g.tp) });
    s += dimH(X(0), X(g.bp), Y(-S.b / 2) + 34, `b_p = ${fmtG(g.bp, 1)}`, { ext: Y(-S.tw / 2 - g.tp) });
    s += dimV(Y(-S.tw / 2), Y(-S.tw / 2 - g.tp), X(Lb) + 12, `t_p = ${fmtG(g.tp, 1)}`, { ext: X(g.bp) });
    s += T(8, 16, 'Vue de dessus', { fw: 800, fs: 11.5 });
    s += T(8, 30, 'sous la semelle supérieure (tiretés : contour de la semelle)', { fw: 500, fs: 9.5, col: MUTED });
    return svgWrap(W, H, s);
  }
  function scene(R, colorOf) {
    const S = R.S, G = R.geo, c = (id, def) => (colorOf ? colorOf(id) || def : def);
    const Lb = G.g + Math.max(G.bp - G.g + 0.7 * S.h, 1.1 * S.h);
    const boxes = [], prisms = [];
    // âme de la poutre support (hors vérification)
    boxes.push({ x0: -12, x1: 0, y0: -S.b * 0.9, y1: S.b * 0.9, z0: -S.h - 50, z1: 30, col: SUP });
    // poutre portée (haut de poutre à z = 0)
    boxes.push({ x0: G.g, x1: Lb, y0: -S.b / 2, y1: S.b / 2, z0: -S.tf, z1: 0, col: c('w', BEAM) });
    boxes.push({ x0: G.g, x1: Lb, y0: -S.b / 2, y1: S.b / 2, z0: -S.h, z1: -S.h + S.tf, col: c('w', BEAM) });
    boxes.push({ x0: G.g, x1: Lb, y0: -S.tw / 2, y1: S.tw / 2, z0: -S.h + S.tf, z1: -S.tf, col: c('w', BEAM) });
    // plat soudé côté −y
    boxes.push({ x0: 0, x1: G.bp, y0: -S.tw / 2 - G.tp, y1: -S.tw / 2, z0: -G.zTop - G.hp, z1: -G.zTop, col: c('p', ACC) });
    G.pts.forEach((p) => prisms.push(...U.boltPrisms('y', [p.x, 0, -G.zG + p.t], R.bolt.d, -S.tw / 2 - G.tp, S.tw / 2, c('b', BOLT), 'b')));
    return { boxes, prisms };
  }
  function iso(R, opts = {}) {
    const W = opts.W || 520, H = opts.H || 360;
    const r = R3().render(scene(R, opts.colorOf), { W, H, top: 40, pad: 20, az: -36, el: 18 });
    return svgWrap(W, H, `<image href="${r.img}" x="0" y="0" width="${W}" height="${H}"/>` + T(8, 16, opts.title || 'Vue 3D', { fw: 800, fs: 11.5 }) + T(8, 30, opts.sub || 'poutre support (âme) en beige, hors vérification', { fw: 500, fs: 9.5, col: MUTED }) + U.triadSvg(r.cam, H));
  }
  // efforts dans les boulons (vue sur le plat, côté vérifié)
  function forcesPanel(R, comp, W = 560, H = 320) {
    const G = R.geo, forces = comp === 'V' ? R.parts.V : comp === 'N' ? R.parts.N : R.forces;
    const k = Math.min((W - 140) / (G.bp + 40), (H - 90) / (G.hp + 20));
    const x0 = 60, cy = 50 + G.hp * k / 2;
    const X = (x) => x0 + x * k, Z = (t) => cy - t * k;
    const id = 'fa' + (++uid), idr = 'fr' + uid;
    const mk = (i, c) => `<marker id="${i}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L10,5L0,10z" fill="${c}"/></marker>`;
    let s = rect(X(-12), Z(G.hp / 2 + 30), 12 * k, (G.hp + 60) * k, `fill="${SUP}" stroke="${INK}" stroke-width=".8"`);
    s += rect(X(0), Z(G.hp / 2), G.bp * k, G.hp * k, `fill="${ACC}" fill-opacity=".45" stroke="${INK}" stroke-width="1"`);
    const ref = Math.min(R.bolt.FvPlane * R.bL, ...R.plies.map((p) => Math.min(p.bx.Fb, p.bz.Fb)));
    const fmax = Math.max(...forces.map((f) => f.f)), r = Math.max(3, R.bolt.d0 / 2 * k);
    const minSp = Math.min(G.n1 > 1 ? G.p1 : 1e9, G.n2 > 1 ? G.p2 : 1e9, G.hp) * k;
    const sc = fmax > 0 ? Math.max(18, 0.7 * minSp) / fmax : 0;
    let im = 0;
    G.pts.forEach((p, i) => {
      const u = R.forces[i].f / ref;
      s += `<circle cx="${X(p.x)}" cy="${Z(p.t)}" r="${r}" fill="${u > 1 ? RED : ACC}" fill-opacity="${u > 1 ? 1 : (0.15 + 0.85 * Math.min(1, u)).toFixed(2)}" stroke="${INK}" stroke-width="1"/>`;
      if (forces[i].f > forces[im].f) im = i;
    });
    G.pts.forEach((p, i) => {
      const f = forces[i]; if (!(f.f > fmax * 1e-3)) return;
      const ln = Math.max(f.f * sc, r + 9) / (f.f * sc);
      s += `<line x1="${X(p.x)}" y1="${Z(p.t)}" x2="${(X(p.x) + f.fx * sc * ln).toFixed(1)}" y2="${(Z(p.t) - f.ft * sc * ln).toFixed(1)}" stroke="${i === im ? RED : INK}" stroke-width="${i === im ? 2 : 1.4}" marker-end="url(#${i === im ? idr : id})"/>`;
    });
    const pm = G.pts[im];
    if (forces[im].f > 0) s += T(X(pm.x) + r + 4, Z(pm.t) - r - 2, `${kN(forces[im].f)} kN`, { col: RED, fw: 800 });
    s += `<circle cx="${X(G.zc)}" cy="${Z(0)}" r="2.5" fill="${INK}"/>` + T(X(G.zc) + 5, Z(0) + 12, 'centre', { fs: 8.5, col: MUTED });
    const L = R.L, lbl = comp === 'V' ? `V = ${kN(L.V)} kN seul (excentré de z = ${fmtG(G.zc, 1)} mm)` : comp === 'N' ? `N = ${kN(L.N)} kN seul` : `V = ${kN(L.V)} kN, N = ${kN(L.N)} kN, M = V·z = ${fmt(Math.abs(L.V) * G.zc / 1e6, 2)} kN·m`;
    s += T(8, 16, 'Efforts dans les boulons', { fw: 800, fs: 11.5 }) + T(8, 30, lbl, { fw: 500, fs: 9.5, col: MUTED });
    s += T(8, H - 8, 'vecteur : action du plat sur le boulon · teinte : taux du boulon (cisaillement, pression diamétrale)', { fw: 500, fs: 9, col: MUTED });
    return svgWrap(W, H, s, mk(id, INK) + mk(idr, RED));
  }
  // schéma de convention : V > 0 réaction descendante transmise, N > 0 traction
  function convention(W = 320, H = 270) {
    const id = 'cv' + (++uid);
    let s = `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L10,5L0,10z" fill="${INK}"/></marker></defs>`;
    s += T(8, 16, 'Convention de signe', { fw: 800, fs: 11.5 });
    const hid = 'h' + (++uid);
    s += `<defs><pattern id="${hid}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${MUTED}" stroke-width=".7"/></pattern></defs>`;
    s += rect(30, 40, 16, 130, `fill="url(#${hid})" stroke="${INK}" stroke-width=".8"`) + rect(52, 70, 220, 60, `fill="#eef1f5" stroke="${INK}" stroke-width=".8"`) + rect(46, 82, 40, 36, `fill="${ACC}" fill-opacity=".7" stroke="${INK}" stroke-width=".8"`);
    for (let i = 0; i <= 8; i++) { const x = 70 + i * 25; s += `<line x1="${x}" y1="${44}" x2="${x}" y2="${66}" stroke="${INK}" stroke-width=".8" marker-end="url(#${id})"/>`; }
    s += T(165, 40, 'charge q', { a: 'middle', fs: 9, col: MUTED });
    s += `<line x1="74" y1="100" x2="74" y2="150" stroke="#16a085" stroke-width="2.4" marker-end="url(#${id})"/>` + T(80, 152, 'V_Ed > 0'.replace('_Ed', '<tspan baseline-shift="sub" font-size="75%">Ed</tspan>'), { fs: 10, fw: 800, col: '#16a085' });
    s += `<line x1="150" y1="100" x2="205" y2="100" stroke="#c0392b" stroke-width="2.4" marker-end="url(#${id})"/>` + T(210, 104, 'N_Ed > 0'.replace('_Ed', '<tspan baseline-shift="sub" font-size="75%">Ed</tspan>'), { fs: 10, fw: 800, col: '#c0392b' });
    const lines = ['V > 0 : réaction d\'appui de la poutre portée', '(charge descendante transmise au support)', 'N > 0 : traction (chaînage), N < 0 : compression', 'Moment d\'excentrement M = V·z au centre', 'du groupe de boulons (articulation à l\'appui).'];
    lines.forEach((l, i) => { s += T(8, 196 + i * 13, l, { fs: 9.5, fw: i % 2 ? 500 : 600 }); });
    return svgWrap(W, H, s);
  }
  const PARTS = [['b', 'Boulons', (c) => c.grp === 'bolts'], ['p', 'Plat soudé', (c) => c.grp === 'plate'], ['w', 'Âme de la poutre portée', (c) => c.grp === 'web']];
  function partRates(rows) { const o = {}; PARTS.forEach(([id, label, f]) => { const g = rows.filter(f).reduce((a, c) => (c.r > a.r ? c : a), { r: 0, label: '—' }); o[id] = { r: g.r, label, gov: g }; }); return o; }

  // ======================================================================
  //  PAGE
  // ======================================================================
  function render(app) {
    R = C.compute(st);
    const c = st.sec, L = curLoad(), i0 = Math.min(st.loads.length - 1, +st.cur || 0);
    const { p } = A().crumbK('platsoude');
    app.innerHTML = `<div class="page">
      <div class="actionbar">
        <div class="grow"><span class="crumb">${p ? `Projet <b>${esc(p.name)}</b> ›` : 'Hors projet ›'} <b id="fCrumb">${esc(st.name || 'Sans nom')}</b></span><span class="dirty" id="fDirty">${dirty ? 'modifié · non enregistré' : ''}</span></div>
        <span id="fVerdict"></span>
        <div class="btn-group"><button class="btn" data-fact="new">Nouveau</button><button class="btn" data-fact="save">Enregistrer</button><button class="btn" data-fact="saveas">Enregistrer sous…</button></div>
        <button class="btn primary" data-fact="report">Fiche NDC ↗</button>
      </div>
      ${blockHead('01', 'Poutre portée & matériaux', "Extrémité d'une poutre en I boulonnée sur un plat soudé à la poutre support. La poutre support et la soudure du plat sont hors vérification.")}
      <div class="cols2"><div>
        <div class="fields">${field('Repère', inp('name', { type: 'text', ph: 'ex. Attache solive S3' }))}</div>
        <div class="chips" style="margin:14px 0">${[['cat', 'Catalogue'], ['prs', 'PRS (I soudé)']].map(([k, l]) => `<button type="button" class="chip${c.kind === k ? ' on' : ''}" data-fact="kind" data-v="${k}">${l}</button>`).join('')}</div>
        <div class="fields">
          ${c.kind === 'prs' ? field('h', inp('sec.prs.h'), 'mm') + field('b', inp('sec.prs.b'), 'mm') + field('t<sub>w</sub>', inp('sec.prs.tw'), 'mm') + field('t<sub>f</sub>', inp('sec.prs.tf'), 'mm')
            : field('Famille', sel('sec.fam', iFams(), { rr: true })) + field('Profil', sel('sec.name', (D.CATALOG[c.fam] || []).map((x) => [x.name, x.name])))}
          ${field('Acier de la poutre', sel('grade', Object.keys(D.STEELS).map((x) => [x, x])))}
          ${field('Acier du plat', sel('plateGrade', Object.keys(D.STEELS).map((x) => [x, x])))}
        </div></div>
        <div id="fInfo" class="muted" style="font-size:12.5px;line-height:1.6"></div>
      </div>
      ${blockHead('02', 'Boulons', 'Boulons ordinaires en simple cisaillement (catégorie A).')}
      <div class="fields">
        ${field('Diamètre', sel('bolt.d', Object.keys(SC.BOLTS).map((d) => [d, 'M' + d])))}
        ${field('Classe', sel('bolt.cls', Object.keys(SC.CLASSES).map((x) => [x, x])))}
        ${field('γ<sub>M2</sub>', inp('gam.M2'))}
      </div>
      <div style="margin:12px 0">${chk('bolt.threads', 'Filetage dans le plan de cisaillement')}</div>
      ${blockHead('03', 'Géométrie', "Plat soudé sur l'appui, file(s) de boulons verticale(s). Les vues ci-dessous sont cotées avec les notations des champs.")}
      <div class="cols2">
        <div><div class="sub-title" style="margin-top:0">Plat</div><div class="fields">
          ${field('Épaisseur t<sub>p</sub>', inp('plate.tp'), 'mm')}
          ${field('Position z<sub>p</sub>', inp('plate.zTop'), 'mm', 'Du haut de la poutre au haut du plat')}
          ${field('Jeu g', inp('gap'), 'mm', 'About de poutre ↔ face d\'appui')}
        </div></div>
        <div><div class="sub-title" style="margin-top:0">Boulons</div><div class="fields">
          ${field('Rangées n<sub>1</sub>', inp('bolts.n1'))}${field('Files n<sub>2</sub>', inp('bolts.n2'))}
          ${field('Entraxe p<sub>1</sub> (vertical)', inp('bolts.p1'), 'mm')}${field('Entraxe p<sub>2</sub> (horizontal)', inp('bolts.p2'), 'mm')}
          ${field('Pince e<sub>1</sub> (haut / bas du plat)', inp('bolts.e1'), 'mm')}${field('Pince e<sub>2</sub> (bord libre du plat)', inp('bolts.e2p'), 'mm')}
          ${field('Pince e<sub>2,b</sub> (about de poutre)', inp('bolts.e2b'), 'mm')}
        </div></div>
      </div>
      <p class="note">h<sub>p</sub> = 2·e<sub>1</sub> + (n<sub>1</sub> − 1)·p<sub>1</sub> ; b<sub>p</sub> = g + e<sub>2,b</sub> + (n<sub>2</sub> − 1)·p<sub>2</sub> + e<sub>2</sub> ; excentrement z = g + e<sub>2,b</sub> + (n<sub>2</sub> − 1)·p<sub>2</sub>/2 (face d'appui → centre du groupe).</p>
      <div id="fGeo" style="margin-top:12px"></div>
      ${blockHead('04', 'Torseurs ELU', 'Un torseur par combinaison : effort tranchant d\'appui V et effort normal N (chaînage). L\'enveloppe est vérifiée.')}
      <div class="tq-grid tq2">
        <div class="fields" style="grid-template-columns:1fr">
          ${st.loads.length > 1 ? `<div class="chips">${st.loads.map((x, j) => `<button type="button" class="chip${j === i0 ? ' on' : ''}" data-fact="cur" data-i="${j}">${esc(x.name || 'T' + (j + 1))}</button>`).join('')}</div>` : ''}
          ${field('Torseur', `<input type="text" data-fp="loads.${i0}.name" value="${esc(L.name)}">`)}
          ${field('<b style="color:#16a085">V<sub>Ed</sub></b> — réaction d\'appui', `<input type="number" step="any" data-fp="loads.${i0}.V" value="${esc(L.V)}">`, 'kN')}
          ${field('<b style="color:#c0392b">N<sub>Ed</sub></b> — &gt; 0 traction', `<input type="number" step="any" data-fp="loads.${i0}.N" value="${esc(L.N)}">`, 'kN')}
        </div>
        <div class="fig">${convention()}</div>
      </div>
      <div class="sub-title" style="margin-top:22px">Tous les torseurs</div>
      <div class="tbl-wrap"><table class="grid">
        <thead><tr><th class="rowh">Torseur</th><th>V<sub>Ed</sub> [kN]</th><th>N<sub>Ed</sub> [kN]</th><th>Taux</th><th></th></tr></thead>
        <tbody>${st.loads.map((x, i) => `<tr><td><input type="text" data-fp="loads.${i}.name" value="${esc(x.name)}" style="min-width:150px;text-align:left"></td><td><input type="number" step="any" data-fp="loads.${i}.V" data-lr="${i}" data-lc="0" value="${esc(x.V)}"></td><td><input type="number" step="any" data-fp="loads.${i}.N" data-lr="${i}" data-lc="1" value="${esc(x.N)}"></td><td class="ro" id="fRate${i}"></td><td>${st.loads.length > 1 ? `<button class="btn sm ghost" data-fact="delLoad" data-i="${i}">✕</button>` : ''}</td></tr>`).join('')}</tbody>
      </table></div>
      <div style="margin:8px 0 14px"><button class="btn sm" data-fact="addLoad">+ Ajouter un torseur</button></div>
      ${blockHead('05', 'Efforts dans les boulons', "Répartition élastique (3.12) : V/n, N/n et moment d'excentrement V·z rapporté au centre du groupe.")}
      <div class="chips" id="fViews">${[['tot', 'Torseur complet'], ['V', 'V seul'], ['N', 'N seul']].map(([k, l]) => `<button type="button" class="chip${(st.view || 'tot') === k ? ' on' : ''}" data-fact="view" data-v="${k}">${l}</button>`).join('')}</div>
      <div id="fFlow" style="margin-top:14px"></div>
      ${blockHead('06', 'Vérifications', 'NF EN 1993-1-8 § 3 (boulons, pinces, rupture en bloc) et NF EN 1993-1-1 § 6.2 (plat, âme de la poutre portée).')}
      <div id="fResults"></div>
    </div>`;
    refresh();
  }

  function refresh() {
    R = C.compute(st); ENV = C.computeEnv(st);
    const v = $('#fVerdict');
    if (v) v.innerHTML = !R.valid ? '<span class="verdict ko">— <small>données invalides</small></span>' : `<span class="verdict ${ENV.max <= 1 ? 'ok' : 'ko'}">${pct(ENV.max)} <small>${ENV.max <= 1 ? 'vérifié*' : 'non vérifié'}</small></span>`;
    const dd = $('#fDirty'); if (dd) dd.textContent = dirty ? 'modifié · non enregistré' : '';
    const cn = $('#fCrumb'); if (cn) cn.textContent = st.name || 'Sans nom';
    ENV.perLoad.forEach((m, i) => { const c = $('#fRate' + i); if (c) c.innerHTML = `<b style="color:${m > 1 ? 'var(--c-red)' : 'inherit'}">${pct(m)}</b>${i === ENV.govIdx ? ' ◂' : ''}`; });
    if (!R.valid) { ['#fGeo', '#fFlow', '#fResults'].forEach((x) => { const e = $(x); if (e) e.innerHTML = R.warnings.map((w) => `<p class="note warn">${sub(w)}</p>`).join(''); }); return; }
    const S = R.S, G = R.geo;
    const fi = $('#fInfo');
    if (fi) fi.innerHTML = `<b style="color:var(--ink)">${esc(S.name)}</b> — h = ${fmtG(S.h, 1)}, b = ${fmtG(S.b, 1)}, t<sub>w</sub> = ${fmtG(S.tw, 1)}, t<sub>f</sub> = ${fmtG(S.tf, 1)}, r = ${fmtG(S.r, 1)} mm<br>
      f<sub>y</sub>/f<sub>u</sub> poutre : ${R.mat.fyb}/${R.mat.fub} MPa · plat : ${R.mat.fyp}/${R.mat.fup} MPa<br>
      Plat ${fmtG(G.hp, 0)} × ${fmtG(G.bp, 0)} × ${fmtG(G.tp, 1)} mm · excentrement z = ${fmtG(G.zc, 1)} mm<br>
      M${R.bolt.d} ${R.bolt.cls} : d<sub>0</sub> = ${R.bolt.d0} mm, F<sub>v,Rd</sub> = ${kN(R.bolt.FvPlane)} kN${R.bL < 1 ? `, β<sub>Lf</sub> = ${fmt(R.bL, 3)}` : ''}`;
    const geo = $('#fGeo');
    if (geo) geo.innerHTML = `<div class="fig-grid"><div class="fig wide">${elevation(R)}</div><div class="fig">${section(R)}</div><div class="fig">${iso(R)}</div><div class="fig wide">${plan(R)}</div></div>`;
    const fl = $('#fFlow');
    if (fl) {
      const view = st.view || 'tot';
      const rows = G.pts.map((q, i) => `<tr${i === R.imax ? ' class="gov"' : ''}><td>${i + 1}</td><td class="num">${fmtG(q.x, 1)}</td><td class="num">${fmtG(-G.zG + q.t, 1)}</td><td class="num">${kN(R.parts.V[i].fx)}</td><td class="num">${kN(R.parts.V[i].ft)}</td><td class="num">${kN(R.parts.N[i].fx)}</td><td class="num"><b>${kN(R.forces[i].f)}</b></td></tr>`).join('');
      fl.innerHTML = `<div class="fig-grid"><div class="fig">${forcesPanel(R, view)}</div><div><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Boulon</th><th class="num">x [mm]</th><th class="num">z [mm]</th><th class="num">f<sub>x</sub>(V) [kN]</th><th class="num">f<sub>z</sub>(V) [kN]</th><th class="num">f<sub>x</sub>(N) [kN]</th><th class="num">Résultante [kN]</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="note">Torseur affiché : <b>${esc(R.loadName)}</b>. x depuis la face d'appui ; z depuis le haut de la poutre (négatif vers le bas). f(V) inclut le moment d'excentrement V·z = ${fmt(Math.abs(R.L.V) * G.zc / 1e6, 2)} kN·m.</p></div></div>`;
    }
    renderResults();
  }

  function renderResults() {
    const box = $('#fResults'); if (!box) return;
    const E = ENV, multi = st.loads.length > 1;
    const pr = partRates(E.rows), rates = Object.fromEntries(Object.entries(pr).map(([k, v]) => [k, v.r]));
    const kpi = (t, o) => `<div class="kpi${o.r > 1 ? ' bad' : ''}"><b>${t}</b><span>${pct(o.r)}</span><small>${sub((o.gov.label || '—').replace(/\s*\(.*$/, ''))}</small></div>`;
    const rows = (g) => E.rows.filter((c) => c.grp === g).map((c) => `<tr${E.gov === c ? ' class="gov"' : ''}><td>${sub(c.label)}${c.note ? `<div class="f" style="font-size:11px">${sub(c.note)}</div>` : ''}</td><td class="f">${c.ref}</td>${multi ? `<td class="f">${esc(c.name)}</td>` : ''}<td class="num">${c.ratioOnly ? '—' : kN(c.Ed)}</td><td class="num">${c.ratioOnly ? '—' : kN(c.Rd)}</td><td class="num"><span class="ratio">${pct(c.geo ? c.rg : c.r)}</span></td><td style="width:100px">${bar(c.r)}</td><td>${pill(c.r)}</td></tr>`).join('');
    const warns = [...new Set(E.runs.flatMap((r) => r.warnings))], infos = [...new Set(E.runs.flatMap((r) => r.info))];
    box.innerHTML = `${warns.map((w) => `<p class="note warn">${sub(w)}</p>`).join('')}${infos.map((w) => `<p class="note">${sub(w)}</p>`).join('')}
      <div class="kpis">
        <div class="kpi ${E.max <= 1 ? 'hero' : 'bad'}"><b>Taux maximal</b><span>${pct(E.max)}</span><small>${E.max <= 1 ? 'Vérifié pour les critères traités*' : 'Attache non vérifiée'}${multi ? ' · ' + esc(st.loads[E.govIdx].name) : ''}</small></div>
        ${kpi('Boulons', pr.b)}${kpi('Plat soudé', pr.p)}${kpi('Âme de la poutre', pr.w)}
        <div class="kpi"><b>V<sub>Rd</sub> de l'attache</b><span>${E.VRd != null ? fmt(E.VRd, 0) : '—'}</span><small>kN, pour V seul (N = 0)</small></div>
      </div>
      <div class="fig-grid split" style="margin-top:18px">
        <div class="fig">${iso(R, { colorOf: (id) => DR.rateCol(rates[id]), title: 'Taux d\'utilisation par pièce', sub: 'vert : faible · orange : proche de 1 · rouge : > 100 % — enveloppe' })}</div>
        <div><div class="sub-title" style="margin-top:4px">Taux par pièce</div><div class="rate-legend" style="grid-template-columns:1fr">
          ${PARTS.map(([id]) => `<div><i style="background:${DR.rateCol(pr[id].r)}"></i><span>${pr[id].label}<br><small class="muted">${sub((pr[id].gov.label || '—').replace(/\s*\(.*$/, ''))}</small></span><b>${pct(pr[id].r)}</b></div>`).join('')}
          <div><i style="background:#e9e6dc"></i><span>Poutre support et soudure<br><small class="muted">hors vérification</small></span><b>—</b></div>
        </div></div></div>
      <p class="note">* Critères traités : boulons (cisaillement, pression diamétrale sur le plat et sur l'âme, joint long), plat (cisaillement brut et net, rupture en bloc, flexion + effort normal, traction ou compression), âme de la poutre portée (cisaillement brut et net, traction, rupture en bloc). Hors champ : poutre support, soudure, stabilité latérale d'un plat long, âme grugée.</p>
      ${[['bolts', 'Boulons'], ['plate', 'Plat soudé'], ['web', 'Âme de la poutre portée']].map(([g, t]) => `<div class="sub-title" style="margin-top:26px">${t}</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Critère</th><th>Réf. EC3</th>${multi ? '<th>Torseur</th>' : ''}<th class="num">E<sub>d</sub> [kN]</th><th class="num">R<sub>d</sub> [kN]</th><th class="num">Taux</th><th></th><th></th></tr></thead><tbody>${rows(g)}</tbody></table></div>`).join('')}`;
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
      const chk = E.rows.map((c) => `<tr${E.gov === c ? ' class="gov"' : ''}><td>${{ bolts: 'Boulons', plate: 'Plat', web: 'Âme' }[c.grp]}</td><td>${sub(c.label)}</td><td>${c.ref}</td>${multi ? `<td>${esc(c.name)}</td>` : ''}<td class="num">${c.ratioOnly ? '—' : kN(c.Ed)}</td><td class="num">${c.ratioOnly ? '—' : kN(c.Rd)}</td><td class="num">${pct(c.geo ? c.rg : c.r)}</td><td>${c.r <= 1 ? '<span class="rp-ok">OK</span>' : '<span class="rp-ko">Non vérifié</span>'}</td></tr>`).join('');
      const infos = [...new Set(E.runs.flatMap((r) => r.warnings.concat(r.info)))];
      const p1 = `<section class="rp-page">${head('p. 1')}
        <div class="rp-title"><h1>${esc(st.name)} — attache de ${esc(S.name)} par plat soudé${total > 1 ? ` (${idx + 1}/${total})` : ''}</h1>
        <p>Plat ${fmtG(G.hp, 0)} × ${fmtG(G.bp, 0)} × ${fmtG(G.tp, 1)} mm ${esc(st.plateGrade)} · ${G.n1} × ${G.n2} boulons M${Rg.bolt.d} ${Rg.bolt.cls} · NF EN 1993-1-8 et NF EN 1993-1-1 avec annexes nationales françaises · poutre support et soudure hors vérification</p></div>
        ${H2('Hypothèses')}
        <div class="rp-kv">
          ${kv('Poutre portée', `${esc(S.name)} ${esc(st.grade)} (f<sub>y</sub> = ${Rg.mat.fyb}, f<sub>u</sub> = ${Rg.mat.fub} MPa)`)}${kv('Plat soudé', `${esc(st.plateGrade)} (f<sub>y</sub> = ${Rg.mat.fyp}, f<sub>u</sub> = ${Rg.mat.fup} MPa)`)}
          ${kv('Boulons', `M${Rg.bolt.d} ${Rg.bolt.cls}, d<sub>0</sub> = ${Rg.bolt.d0} mm, F<sub>v,Rd</sub> = ${kN(Rg.bolt.FvPlane)} kN (1 plan)`)}${kv('Disposition', `${G.n1} rangée(s) × ${G.n2} file(s) ; p<sub>1</sub> = ${G.p1}, p<sub>2</sub> = ${G.p2} ; e<sub>1</sub> = ${G.e1}, e<sub>2</sub> = ${G.e2p}, e<sub>2,b</sub> = ${G.e2b} mm`)}
          ${kv('Jeu, position', `g = ${G.g} mm ; z<sub>p</sub> = ${G.zTop} mm`)}${kv('Excentrement', `z = ${fmtG(G.zc, 1)} mm`)}
        </div>
        <div style="margin-top:4pt">${elevation(Rg, 600, 380)}</div>
        <table style="border:0"><tr><td style="border:0;padding:0;width:44%">${section(Rg, 380, 360)}</td><td style="border:0;padding:0">${iso(Rg, { W: 500, H: 340 })}</td></tr></table>
      </section>`;
      const p2 = `<section class="rp-page">${head('p. 2')}
        ${H2(multi ? 'Torseurs ELU' : 'Torseur ELU')}
        <table><thead><tr><th>Torseur</th><th class="num">V<sub>Ed</sub> [kN]</th><th class="num">N<sub>Ed</sub> [kN]</th><th class="num">Taux</th></tr></thead><tbody>${st.loads.map((x, i) => `<tr${i === E.govIdx ? ' class="gov"' : ''}><td>${esc(x.name)}</td><td class="num">${fmtG(+x.V || 0, 2)}</td><td class="num">${fmtG(+x.N || 0, 2)}</td><td class="num">${pct(E.perLoad[i])}</td></tr>`).join('')}</tbody></table>
        <p style="font-size:7.6pt;color:#555">V > 0 : réaction d'appui de la poutre portée ; N > 0 : traction. Moment d'excentrement M = V·z au centre du groupe (articulation supposée à la face d'appui).</p>
        ${H2('Efforts dans les boulons' + (multi ? ' — torseur « ' + esc(Rg.loadName) + ' »' : ''))}
        ${forcesPanel(Rg, 'tot', 560, 300)}
        ${H2('Vérifications')}
        <table><thead><tr><th>Partie</th><th>Critère</th><th>Réf.</th>${multi ? '<th>Torseur</th>' : ''}<th class="num">E<sub>d</sub> [kN]</th><th class="num">R<sub>d</sub> [kN]</th><th class="num">Taux</th><th>Statut</th></tr></thead><tbody>${chk}</tbody></table>
        ${infos.length ? `<p style="font-size:7.6pt"><b>Remarques :</b> ${infos.map(sub).join(' ')}</p>` : ''}
        <table style="border:0"><tr><td style="border:0;padding:0;width:58%">${iso(Rg, { W: 520, H: 330, colorOf: (id) => DR.rateCol(rates[id]), title: 'Taux d\'utilisation par pièce', sub: 'enveloppe des torseurs' })}</td><td style="border:0;padding:0 0 0 6pt"><table><tbody>${PARTS.map(([id]) => `<tr><td><span style="display:inline-block;width:8pt;height:8pt;background:${DR.rateCol(pr[id].r)};border:.5pt solid #111;margin-right:4pt"></span>${pr[id].label}</td><td class="num">${pct(pr[id].r)}</td></tr>`).join('')}<tr><td>Résistance V<sub>Rd</sub> (N = 0)</td><td class="num">${E.VRd != null ? fmt(E.VRd, 0) + ' kN' : '—'}</td></tr></tbody></table></td></tr></table>
        <div class="rp-concl"><span>Conclusion — attache ${esc(S.name)} sur plat soudé</span><b class="${E.max <= 1 ? 'rp-ok' : 'rp-ko'}">${E.max <= 1 ? 'Vérifiée' : 'Non vérifiée'} — taux max. ${pct(E.max)}</b></div>
        <p style="font-size:7.4pt;color:#555;margin-top:5pt">Critères couverts : NF EN 1993-1-8 § 3.5 à 3.10 (pinces, cisaillement, pression diamétrale en interaction vectorielle, joint long, rupture en bloc), NF EN 1993-1-1 § 6.2 (plat, âme). Répartition élastique des efforts entre boulons (3.12). Hors champ : poutre support, soudure du plat, stabilité latérale d'un plat long, âme grugée.</p>
      </section>`;
      return p1 + p2;
    } finally { st = keep; }
  }

  // ======================================================================
  //  ÉVÉNEMENTS
  // ======================================================================
  function bind(app) {
    const onEdit = (e) => {
      const t = e.target; if (!t.dataset || !t.dataset.fp || t.closest('.modal')) return;
      if (e.type === 'input' && (t.tagName === 'SELECT' || t.type === 'checkbox')) return;
      const p = t.dataset.fp;
      let v = t.type === 'checkbox' ? t.checked : t.value;
      if (p === 'bolt.d') v = +v;
      set(p, v);
      if (p === 'sec.fam') { const l = D.CATALOG[v] || []; st.sec.name = l.length ? l[Math.floor(l.length / 2)].name : ''; }
      document.querySelectorAll(`[data-fp="${p}"]`).forEach((el) => { if (el !== t && el.type !== 'checkbox') el.value = t.value; });
      dirty = true; persist();
      if ((t.dataset.rr && e.type === 'change') || p === 'sec.fam') { const y = window.scrollY; render(app); window.scrollTo(0, y); return; }
      refresh();
    };
    app.addEventListener('input', onEdit);
    app.addEventListener('change', onEdit);
    app.addEventListener('paste', (e) => {
      const t = e.target; if (!t.dataset || t.dataset.lr == null || !t.dataset.fp) return;
      const txt = (e.clipboardData || window.clipboardData).getData('text');
      if (!/[\t\n]/.test(txt)) return;
      e.preventDefault();
      const r0 = +t.dataset.lr, c0 = +t.dataset.lc, keys = ['V', 'N'];
      txt.replace(/\r/g, '').split('\n').filter((l) => l.trim().length).forEach((line, i) => {
        const r = r0 + i;
        while (st.loads.length <= r) st.loads.push({ name: 'ELU ' + (st.loads.length + 1), V: 0, N: 0 });
        line.split('\t').forEach((cell, j) => { const k = keys[c0 + j]; if (k) st.loads[r][k] = cell.trim().replace(/\s/g, '').replace(',', '.'); });
      });
      dirty = true; persist(); const y = window.scrollY; render(app); window.scrollTo(0, y);
    });
    app.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-fact]'); if (!b) return;
      const a = b.dataset.fact, y = window.scrollY;
      if (a === 'kind') { st.sec.kind = b.dataset.v; dirty = true; persist(); render(app); window.scrollTo(0, y); }
      else if (a === 'cur') { st.cur = +b.dataset.i; dirty = true; persist(); render(app); window.scrollTo(0, y); }
      else if (a === 'view') { st.view = b.dataset.v; document.querySelectorAll('#fViews .chip').forEach((c) => c.classList.toggle('on', c.dataset.v === st.view)); refresh(); }
      else if (a === 'addLoad') { st.loads.push(Object.assign({}, curLoad(), { name: 'ELU ' + (st.loads.length + 1) })); dirty = true; persist(); render(app); window.scrollTo(0, y); }
      else if (a === 'delLoad') { st.loads.splice(+b.dataset.i, 1); st.cur = Math.min(+st.cur || 0, st.loads.length - 1); dirty = true; persist(); render(app); window.scrollTo(0, y); }
      else if (a === 'save' || a === 'saveas') { const ok = await A().saveItem('platsoude', st, a === 'saveas'); if (ok) { dirty = false; persist(); render(app); window.scrollTo(0, y); } }
      else if (a === 'new') {
        if (dirty && !(await A().confirmBox('Nouvelle attache', 'Les modifications non enregistrées seront perdues. Continuer ?'))) return;
        st = C.defaultState(); st.name = 'Nouvelle attache'; A().newItem('platsoude'); dirty = false; persist(); render(app);
      }
      else if (a === 'report') window.FirmitasReport.open([{ state: st, project: A().crumbK('platsoude').p ? A().crumbK('platsoude').p.name : '' }]);
    });
  }
  function load(state) { st = C.upgrade(state); dirty = false; persist(); }

  const api = { init, render, bind, page, load, flush, get state() { return st; }, get dirty() { return dirty; }, summary: C.summary };
  window.FirmitasFin = api;
  window.FirmitasModules = window.FirmitasModules || {};
  window.FirmitasModules.platsoude = { kind: 'platsoude', route: 'platsoude', title: 'Plat & boulonnage', short: 'plat & boulonnage', ref: 'NF EN 1993-1-8 + AN', api, upgrade: C.upgrade };
  window.FirmitasFinDraw = { elevation, section, plan, iso, forcesPanel };
})();
