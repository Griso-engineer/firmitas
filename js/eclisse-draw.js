/* ==========================================================================
   Firmitas — dessins de l'éclisse : vues cotées (élévation, plans, coupe),
   vue 3D axonométrique (assemblage, torseur, carte des taux), schéma de convention.
   Repère : x le long de la poutre (axe du joint en x = 0, côté vérifié x > 0),
   y transversal, z vertical vers le haut. Unités : mm.
   ========================================================================== */
(function () {
  'use strict';
  const INK = '#111110', MUTED = '#6e6d69', ACC = '#8b9d99', BEAM = '#d9dee6', RED = '#fa554f', DIM = '#3d5a80';
  const F = 'font-family="Inter,Arial,sans-serif"';
  const fmt = (x, d = 0) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { maximumFractionDigits: d }) : '—');
  let uid = 0;
  const T = (x, y, s, o = {}) => `<text x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" ${F} font-size="${o.fs || 10}" font-weight="${o.fw || 600}" fill="${o.col || INK}"${o.a ? ` text-anchor="${o.a}"` : ''}${o.rot ? ` transform="rotate(${o.rot} ${(+x).toFixed(1)} ${(+y).toFixed(1)})"` : ''}>${s}</text>`;
  const sb = (s) => String(s).replace(/_([A-Za-z0-9,]+)/g, '<tspan baseline-shift="sub" font-size="75%">$1</tspan>');
  const svgWrap = (W, H, body, defs = '') => `<svg class="diag" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs>${body}</svg>`;

  // ---------- cotation ----------
  // cote entre deux points écran (horizontale ou verticale), décalée de off pixels
  function dimH(x1, x2, y, label, o = {}) {
    if (Math.abs(x2 - x1) < 0.5) return '';
    const yy = y + (o.off || 0), ext = o.ext == null ? y : o.ext;
    const t = 3;
    return `<g stroke="${DIM}" stroke-width=".7" fill="none">
      ${o.noExt ? '' : `<line x1="${x1}" y1="${ext}" x2="${x1}" y2="${yy + (yy > ext ? 3 : -3)}"/><line x1="${x2}" y1="${ext}" x2="${x2}" y2="${yy + (yy > ext ? 3 : -3)}"/>`}
      <line x1="${x1}" y1="${yy}" x2="${x2}" y2="${yy}"/>
      <line x1="${x1 - t}" y1="${yy + t}" x2="${x1 + t}" y2="${yy - t}"/><line x1="${x2 - t}" y1="${yy + t}" x2="${x2 + t}" y2="${yy - t}"/></g>
      ${T((x1 + x2) / 2, yy - 3, sb(label), { a: 'middle', fs: o.fs || 9, col: DIM })}`;
  }
  function dimV(y1, y2, x, label, o = {}) {
    if (Math.abs(y2 - y1) < 0.5) return '';
    const xx = x + (o.off || 0), ext = o.ext == null ? x : o.ext;
    const t = 3;
    return `<g stroke="${DIM}" stroke-width=".7" fill="none">
      ${o.noExt ? '' : `<line x1="${ext}" y1="${y1}" x2="${xx + (xx > ext ? 3 : -3)}" y2="${y1}"/><line x1="${ext}" y1="${y2}" x2="${xx + (xx > ext ? 3 : -3)}" y2="${y2}"/>`}
      <line x1="${xx}" y1="${y1}" x2="${xx}" y2="${y2}"/>
      <line x1="${xx - t}" y1="${y1 + t}" x2="${xx + t}" y2="${y1 - t}"/><line x1="${xx - t}" y1="${y2 + t}" x2="${xx + t}" y2="${y2 - t}"/></g>
      ${T(xx + (o.left ? -4 : 4), (y1 + y2) / 2 + 3, sb(label), { a: o.left ? 'end' : 'start', fs: o.fs || 9, col: DIM })}`;
  }
  const rect = (x, y, w, h, st) => `<rect x="${Math.min(x, x + w).toFixed(1)}" y="${Math.min(y, y + h).toFixed(1)}" width="${Math.abs(w).toFixed(1)}" height="${Math.abs(h).toFixed(1)}" ${st}/>`;
  const stBeam = `fill="${BEAM}" stroke="${INK}" stroke-width=".8"`, stPl = `fill="${ACC}" fill-opacity=".55" stroke="${INK}" stroke-width="1"`;
  const stDash = `fill="none" stroke="${INK}" stroke-width=".8" stroke-dasharray="5 3"`;
  const axisV = (x, y1, y2) => `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${INK}" stroke-width=".6" stroke-dasharray="7 3 1 3"/>`;
  const axisH = (y, x1, x2) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${INK}" stroke-width=".6" stroke-dasharray="7 3 1 3"/>`;

  // longueurs utiles
  function lens(R) {
    const fl = R.geo.fl, wb = R.geo.web, g = R.g;
    const Lf = g / 2 + fl.e1b + (fl.n1 - 1) * fl.p1 + fl.e1;
    const Lw = g / 2 + wb.e1b + (wb.n1 - 1) * wb.p1 + wb.e1;
    return { Lf, Lw, L: Math.max(Lf, Lw) };
  }

  // ======================================================================
  //  PLAN D'UNE SEMELLE (vue de dessus)
  // ======================================================================
  function plan(R, gid, W = 560, H = 300) {
    const S = R.S, G = R.groups[gid], fl = R.geo.fl, P = G.plate, g = R.g;
    const { Lf } = lens(R);
    const ext = Lf + 60;
    const k = Math.min((W - 120) / (2 * ext), (H - 110) / Math.max(S.b, P.bo));
    const cx = W / 2 - 10, cy = 52 + Math.max(S.b, P.bo) * k / 2;
    const X = (x) => cx + x * k, Y = (y) => cy - y * k;
    let s = '';
    s += rect(X(-ext), Y(S.b / 2), (ext - g / 2) * k, S.b * k, stBeam) + rect(X(g / 2), Y(S.b / 2), (ext - g / 2) * k, S.b * k, stBeam);
    s += rect(X(-ext), Y(S.tw / 2), 2 * ext * k, S.tw * k, `fill="none" stroke="${INK}" stroke-width=".5" stroke-dasharray="3 2"`);
    s += rect(X(-Lf), Y(P.bo / 2), 2 * Lf * k, P.bo * k, stPl);
    if (G.dbl) [1, -1].forEach((sg) => { s += rect(X(-Lf), Y(sg > 0 ? P.tIn0 + P.bi : -P.tIn0), 2 * Lf * k, P.bi * k, stDash); });
    s += axisV(X(0), Y(Math.max(S.b, P.bo) / 2) - 10, Y(-Math.max(S.b, P.bo) / 2) + 10) + axisH(Y(0), X(-ext) - 6, X(ext) + 6);
    const r = Math.max(2.5, R.bolt.d0 / 2 * k);
    fl.pts.forEach((p) => { [1, -1].forEach((sg) => { s += `<circle cx="${X(sg * p.x)}" cy="${Y(p.t)}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="1"/>`; }); });
    // cotes longitudinales (côté droit) sous la semelle
    const yb = Y(-Math.max(S.b, P.bo) / 2) + 16;
    let xs = [g / 2, g / 2 + fl.e1b]; for (let j = 1; j < fl.n1; j++) xs.push(g / 2 + fl.e1b + j * fl.p1); xs.push(Lf);
    const lbl = ['e_1,b'].concat(Array(fl.n1 - 1).fill('p_1')).concat(['e_1']);
    for (let i = 0; i < xs.length - 1; i++) s += dimH(X(xs[i]), X(xs[i + 1]), yb, `${lbl[i]} = ${fmt(xs[i + 1] - xs[i], 1)}`, { ext: Y(-P.bo / 2), fs: 8.5, off: (i % 2) * 11 });
    s += T(X(0), Y(Math.max(S.b, P.bo) / 2) - 4, `g = ${fmt(g, 1)}`, { a: 'middle', fs: 8.5, col: DIM });
    s += dimH(X(-Lf), X(Lf), yb + 34, `L_plat = ${fmt(2 * Lf, 0)}`, { ext: Y(-P.bo / 2) });
    // cotes transversales (à droite)
    const xr = X(Lf) + 18;
    const ts = fl.ts.slice().sort((a, b) => b - a);
    s += dimV(Y(P.bo / 2), Y(ts[0]), xr, `e_2 = ${fmt(P.bo / 2 - ts[0], 1)}`, { ext: X(Lf) });
    if (fl.n2s > 1) s += dimV(Y(ts[0]), Y(ts[1]), xr, `p_2 = ${fmt(fl.p2, 0)}`, { ext: X(Lf) });
    const tin = ts.filter((t) => t > 0).pop();
    s += dimV(Y(tin), Y(-tin), xr, `w = ${fmt(fl.w, 0)}`, { ext: X(Lf) });
    s += dimV(Y(P.bo / 2), Y(-P.bo / 2), xr + 62, `b_o = ${fmt(P.bo, 0)}`, { ext: X(Lf) });
    if (G.dbl) s += dimV(Y(-P.tIn0), Y(-P.tIn0 - P.bi), X(-Lf) - 16, `b_i = ${fmt(P.bi, 0)}`, { ext: X(-Lf), left: true });
    const tt = gid === 'top' ? 'Plan de la semelle supérieure' : 'Plan de la semelle inférieure';
    s += T(8, 16, tt, { fw: 800, fs: 11.5 });
    s += T(8, 30, `${G.dbl ? `plat extérieur ${fmt(P.bo)} × ${fmt(P.to, 1)} + 2 plats intérieurs ${fmt(P.bi)} × ${fmt(P.ti, 1)} (tiretés)` : `plat extérieur seul ${fmt(P.bo)} × ${fmt(P.to, 1)}`} · M${G.B.d}, d_0 = ${G.B.d0}${G.pack > 0 ? ` · fourrure ${fmt(G.pack, 1)}` : ''}`.replace(/d_0/, 'd<tspan baseline-shift="sub" font-size="75%">0</tspan>'), { fw: 500, fs: 9.5, col: MUTED });
    return svgWrap(W, H, s);
  }

  // ======================================================================
  //  ÉLÉVATION (vue de face, plan x-z)
  // ======================================================================
  function elevation(R, W = 620, H = 340) {
    const S = R.S, wb = R.geo.web, fl = R.geo.fl, G = R.groups, g = R.g;
    const top = G.top.plate, bot = G.bot.plate, wp = G.web.plate;
    const { Lf, Lw, L } = lens(R);
    const ext = L + 60;
    const Ht = S.h + top.to + bot.to;
    const k = Math.min((W - 130) / (2 * ext), (H - 110) / Ht);
    const cx = W / 2 - 20, cy = 44 + (top.to + S.h / 2) * k;
    const X = (x) => cx + x * k, Z = (z) => cy - z * k;
    const h2 = S.h / 2;
    let s = '';
    [[-ext, -g / 2], [g / 2, ext]].forEach(([a, b]) => {
      s += rect(X(a), Z(h2), (b - a) * k, S.tf * k, stBeam) + rect(X(a), Z(-h2 + S.tf), (b - a) * k, S.tf * k, stBeam);
      s += rect(X(a), Z(h2 - S.tf), (b - a) * k, (S.h - 2 * S.tf) * k, `fill="#eef1f5" stroke="${INK}" stroke-width=".6"`);
    });
    s += rect(X(-Lf), Z(h2 + top.to), 2 * Lf * k, top.to * k, stPl) + rect(X(-Lf), Z(-h2), 2 * Lf * k, bot.to * k, stPl);
    if (G.top.dbl) s += rect(X(-Lf), Z(h2 - S.tf), 2 * Lf * k, top.ti * k, stDash);
    if (G.bot.dbl) s += rect(X(-Lf), Z(-h2 + S.tf + bot.ti), 2 * Lf * k, bot.ti * k, stDash);
    s += rect(X(-Lw), Z(wp.hp / 2), 2 * Lw * k, wp.hp * k, stPl);
    s += axisV(X(0), Z(h2 + top.to) - 12, Z(-h2 - bot.to) + 12) + axisH(Z(0), X(-ext) - 6, X(ext) + 6);
    // boulons de semelles : axes verticaux
    fl.pts.filter((p) => p.t === fl.ts[0]).forEach((p) => [1, -1].forEach((sg) => {
      s += `<line x1="${X(sg * p.x)}" y1="${Z(h2 + top.to) - 4}" x2="${X(sg * p.x)}" y2="${Z(h2 - S.tf - (G.top.dbl ? top.ti : 0)) + 4}" stroke="${INK}" stroke-width="1.6"/>`;
      s += `<line x1="${X(sg * p.x)}" y1="${Z(-h2 + S.tf + (G.bot.dbl ? bot.ti : 0)) - 4}" x2="${X(sg * p.x)}" y2="${Z(-h2 - bot.to) + 4}" stroke="${INK}" stroke-width="1.6"/>`;
    }));
    const r = Math.max(2.5, R.boltW.d0 / 2 * k);
    wb.pts.forEach((p) => [1, -1].forEach((sg) => { s += `<circle cx="${X(sg * p.x)}" cy="${Z(p.t)}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="1"/>`; }));
    // cotes de l'âme (côté droit, sous la poutre)
    const yb = Z(-h2 - bot.to) + 16;
    let xs = [g / 2, g / 2 + wb.e1b]; for (let j = 1; j < wb.n1; j++) xs.push(g / 2 + wb.e1b + j * wb.p1); xs.push(Lw);
    const lbl = ['e_1,b'].concat(Array(wb.n1 - 1).fill('p_1')).concat(['e_1']);
    for (let i = 0; i < xs.length - 1; i++) s += dimH(X(xs[i]), X(xs[i + 1]), yb, `${lbl[i]} = ${fmt(xs[i + 1] - xs[i], 1)}`, { ext: Z(-wp.hp / 2), fs: 8.5, off: (i % 2) * 11 });
    s += T(X(0), Z(-h2 - bot.to) + 12, `g = ${fmt(g, 1)}`, { a: 'middle', fs: 8.5, col: DIM });
    s += dimH(X(-Lw), X(Lw), yb + 34, `L_plat âme = ${fmt(2 * Lw, 0)}`, { ext: Z(-wp.hp / 2) });
    // cotes verticales à droite
    const xr = X(ext) + 10;
    const zs = wb.ts.slice().sort((a, b) => b - a);
    s += dimV(Z(wp.hp / 2), Z(zs[0]), xr, `e_2 = ${fmt(wp.hp / 2 - zs[0], 1)}`, { ext: X(Lw) });
    for (let i = 0; i < zs.length - 1; i++) s += dimV(Z(zs[i]), Z(zs[i + 1]), xr, `p_2 = ${fmt(wb.p2, 0)}`, { ext: X(Lw) });
    s += dimV(Z(wp.hp / 2), Z(-wp.hp / 2), xr + 62, `h_p = ${fmt(wp.hp, 0)}`, { ext: X(Lw) });
    s += dimV(Z(h2), Z(-h2), X(-ext) - 12, `h = ${fmt(S.h, 1)}`, { ext: X(-ext), left: true });
    s += T(X(-Lf), Z(h2 + top.to) - 4, `t_o = ${fmt(top.to, 1)}`.replace('t_o', 't<tspan baseline-shift="sub" font-size="75%">o</tspan>'), { fs: 8.5, col: DIM });
    s += T(8, 16, 'Élévation', { fw: 800, fs: 11.5 });
    s += T(8, 30, `plats d'âme 2 × ${fmt(wp.hp)} × ${fmt(wp.tp, 1)} · M${R.boltW.d} · ${wb.n1} file(s) × ${wb.n2} rangée(s) par côté · trait mixte : axe du joint`, { fw: 500, fs: 9.5, col: MUTED });
    return svgWrap(W, H, s);
  }

  // ======================================================================
  //  COUPE TRANSVERSALE (plan y-z) au droit des boulons
  // ======================================================================
  function section(R, W = 440, H = 360) {
    const S = R.S, G = R.groups, top = G.top.plate, bot = G.bot.plate, wp = G.web.plate, fl = R.geo.fl, wb = R.geo.web;
    const Ht = S.h + top.to + bot.to, Bt = Math.max(S.b, top.bo, bot.bo);
    const k = Math.min((H - 80) / Ht, (W - 170) / Bt);
    const cx = 95 + Bt * k / 2, cy = 44 + (top.to + S.h / 2) * k;
    const X = (y) => cx + y * k, Z = (z) => cy - z * k;
    const h2 = S.h / 2;
    const R2 = (y1, y2, z1, z2, st) => rect(X(Math.min(y1, y2)), Z(Math.max(z1, z2)), Math.abs(y2 - y1) * k, Math.abs(z2 - z1) * k, st);
    let s = '';
    s += R2(-S.b / 2, S.b / 2, h2 - S.tf, h2, stBeam) + R2(-S.b / 2, S.b / 2, -h2, -h2 + S.tf, stBeam) + R2(-S.tw / 2, S.tw / 2, -h2 + S.tf, h2 - S.tf, stBeam);
    s += R2(-top.bo / 2, top.bo / 2, h2, h2 + top.to, stPl) + R2(-bot.bo / 2, bot.bo / 2, -h2, -h2 - bot.to, stPl);
    if (G.top.dbl) [1, -1].forEach((sg) => { s += R2(sg * top.tIn0, sg * (top.tIn0 + top.bi), h2 - S.tf, h2 - S.tf - top.ti, stPl); });
    if (G.bot.dbl) [1, -1].forEach((sg) => { s += R2(sg * bot.tIn0, sg * (bot.tIn0 + bot.bi), -h2 + S.tf, -h2 + S.tf + bot.ti, stPl); });
    [1, -1].forEach((sg) => { s += R2(sg * S.tw / 2, sg * (S.tw / 2 + wp.tp), -wp.hp / 2, wp.hp / 2, stPl); });
    const bw = (d) => Math.max(1.5, d * k * 0.55);
    fl.ts.forEach((t) => {
      s += `<line x1="${X(t)}" y1="${Z(h2 + top.to) - 5}" x2="${X(t)}" y2="${Z(h2 - S.tf - (G.top.dbl ? top.ti : 0)) + 5}" stroke="${INK}" stroke-width="${bw(R.bolt.d)}" stroke-opacity=".6"/>`;
      s += `<line x1="${X(t)}" y1="${Z(-h2 + S.tf + (G.bot.dbl ? bot.ti : 0)) - 5}" x2="${X(t)}" y2="${Z(-h2 - bot.to) + 5}" stroke="${INK}" stroke-width="${bw(R.bolt.d)}" stroke-opacity=".6"/>`;
    });
    wb.ts.forEach((z) => { s += `<line x1="${X(-S.tw / 2 - wp.tp) - 5}" y1="${Z(z)}" x2="${X(S.tw / 2 + wp.tp) + 5}" y2="${Z(z)}" stroke="${INK}" stroke-width="${bw(R.boltW.d)}" stroke-opacity=".6"/>`; });
    s += axisV(X(0), Z(h2 + top.to) - 10, Z(-h2 - bot.to) + 10) + axisH(Z(0), X(-Bt / 2) - 8, X(Bt / 2) + 8);
    // cotes
    s += dimH(X(-top.bo / 2), X(top.bo / 2), Z(h2 + top.to) - 14, `b_o = ${fmt(top.bo)}`, { ext: Z(h2 + top.to) });
    const tin = Math.min(...fl.ts.filter((t) => t > 0));
    s += dimH(X(-tin), X(tin), Z(-h2 - bot.to) + 18, `w = ${fmt(fl.w)}`, { ext: Z(-h2 - bot.to) });
    s += dimV(Z(h2 + top.to), Z(h2), X(Bt / 2) + 12, `t_o = ${fmt(top.to, 1)}`, { ext: X(top.bo / 2) });
    if (G.top.dbl) s += dimV(Z(h2 - S.tf), Z(h2 - S.tf - top.ti), X(Bt / 2) + 12, `t_i = ${fmt(top.ti, 1)}`, { ext: X(top.tIn0 + top.bi) });
    s += dimV(Z(-h2), Z(-h2 - bot.to), X(Bt / 2) + 12, `t_o = ${fmt(bot.to, 1)}`, { ext: X(bot.bo / 2) });
    if (G.bot.dbl) s += dimV(Z(-h2 + S.tf + bot.ti), Z(-h2 + S.tf), X(Bt / 2) + 12, `t_i = ${fmt(bot.ti, 1)}`, { ext: X(bot.tIn0 + bot.bi) });
    s += dimV(Z(wp.hp / 2), Z(-wp.hp / 2), X(-Bt / 2) - 14, `h_p = ${fmt(wp.hp)}`, { ext: X(-S.tw / 2 - wp.tp), left: true });
    s += T(X(S.tw / 2 + wp.tp) + 4, Z(wp.hp / 2) + 12, `t_p = ${fmt(wp.tp, 1)}`.replace('t_p', 't<tspan baseline-shift="sub" font-size="75%">p</tspan>'), { fs: 8.5, col: DIM });
    if (G.top.dbl || G.bot.dbl) { const P = G.top.dbl ? top : bot; s += T(X(P.tIn0), Z(G.top.dbl ? h2 - S.tf - P.ti : -h2 + S.tf + P.ti) + (G.top.dbl ? 11 : -4), `b_i = ${fmt(P.bi)}`.replace('b_i', 'b<tspan baseline-shift="sub" font-size="75%">i</tspan>'), { fs: 8.5, col: DIM }); }
    s += T(8, 16, 'Coupe transversale', { fw: 800, fs: 11.5 });
    s += T(8, 30, `${S.name} · y horizontal, z vertical`, { fw: 500, fs: 9.5, col: MUTED });
    return svgWrap(W, H, s);
  }

  // ======================================================================
  //  3D AXONOMÉTRIQUE
  // ======================================================================
  function camera(az = -32, el = 24) {
    const a = az * Math.PI / 180, e = el * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), ce = Math.cos(e), se = Math.sin(e);
    return {
      p: (x, y, z) => { const xr = x * ca - y * sa, yr = x * sa + y * ca; return { u: xr, v: -(z * ce + yr * se), d: yr * ce - z * se }; }
    };
  }
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(Math.min(255, v * f))); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); };

  // boîtes : { x0,x1,y0,y1,z0,z1, col, op, id }
  function boxesOf(R, colorOf) {
    const S = R.S, G = R.groups, top = G.top.plate, bot = G.bot.plate, wp = G.web.plate, g = R.g;
    const { Lf, Lw, L } = lens(R);
    const ext = L + Math.max(S.h * 0.5, 120);
    const h2 = S.h / 2;
    const B = [];
    const c = (id, def) => (colorOf ? colorOf(id) || def : def);
    [[-ext, -g / 2, 'L'], [g / 2, ext, 'R']].forEach(([a, b]) => {
      B.push({ x0: a, x1: b, y0: -S.b / 2, y1: S.b / 2, z0: h2 - S.tf, z1: h2, col: c('fTop', BEAM), id: 'fTop' });
      B.push({ x0: a, x1: b, y0: -S.b / 2, y1: S.b / 2, z0: -h2, z1: -h2 + S.tf, col: c('fBot', BEAM), id: 'fBot' });
      B.push({ x0: a, x1: b, y0: -S.tw / 2, y1: S.tw / 2, z0: -h2 + S.tf, z1: h2 - S.tf, col: c('web', BEAM), id: 'web' });
    });
    B.push({ x0: -Lf, x1: Lf, y0: -top.bo / 2, y1: top.bo / 2, z0: h2, z1: h2 + top.to, col: c('pTop', ACC), id: 'pTop' });
    B.push({ x0: -Lf, x1: Lf, y0: -bot.bo / 2, y1: bot.bo / 2, z0: -h2 - bot.to, z1: -h2, col: c('pBot', ACC), id: 'pBot' });
    if (G.top.dbl) [1, -1].forEach((sg) => B.push({ x0: -Lf, x1: Lf, y0: sg > 0 ? top.tIn0 : -top.tIn0 - top.bi, y1: sg > 0 ? top.tIn0 + top.bi : -top.tIn0, z0: h2 - S.tf - top.ti, z1: h2 - S.tf, col: c('pTop', ACC), id: 'pTop' }));
    if (G.bot.dbl) [1, -1].forEach((sg) => B.push({ x0: -Lf, x1: Lf, y0: sg > 0 ? bot.tIn0 : -bot.tIn0 - bot.bi, y1: sg > 0 ? bot.tIn0 + bot.bi : -bot.tIn0, z0: -h2 + S.tf, z1: -h2 + S.tf + bot.ti, col: c('pBot', ACC), id: 'pBot' }));
    [1, -1].forEach((sg) => B.push({ x0: -Lw, x1: Lw, y0: sg > 0 ? S.tw / 2 : -S.tw / 2 - wp.tp, y1: sg > 0 ? S.tw / 2 + wp.tp : -S.tw / 2, z0: -wp.hp / 2, z1: wp.hp / 2, col: c('pWeb', ACC), id: 'pWeb' }));
    // têtes de boulons (prismes)
    const hd = (d) => d * 0.9;
    R.geo.fl.pts.forEach((p) => [1, -1].forEach((sg) => {
      const x = sg * p.x, d = hd(R.bolt.d);
      B.push({ x0: x - d / 2, x1: x + d / 2, y0: p.t - d / 2, y1: p.t + d / 2, z0: h2 + top.to, z1: h2 + top.to + R.bolt.d * 0.6, col: c('bTop', '#4a4a48'), id: 'bTop' });
      B.push({ x0: x - d / 2, x1: x + d / 2, y0: p.t - d / 2, y1: p.t + d / 2, z0: -h2 - bot.to - R.bolt.d * 0.6, z1: -h2 - bot.to, col: c('bBot', '#4a4a48'), id: 'bBot' });
    }));
    R.geo.web.pts.forEach((p) => [1, -1].forEach((sg) => {
      const x = sg * p.x, d = hd(R.boltW.d), y0 = -S.tw / 2 - wp.tp;
      B.push({ x0: x - d / 2, x1: x + d / 2, y0: y0 - R.boltW.d * 0.6, y1: y0, z0: p.t - d / 2, z1: p.t + d / 2, col: c('bWeb', '#4a4a48'), id: 'bWeb' });
    }));
    return { B, ext, h2 };
  }

  // Faces visibles de boîtes, triées du plus loin au plus proche. Les boîtes longues sont découpées en tranches
  // le long de x pour que l'algorithme du peintre reste juste (plat posé sur une semelle longue, etc.).
  function facesOf(B, cam, step) {
    const faces = [];
    const slices = [];
    // grille commune : toutes les boîtes sont coupées aux mêmes abscisses (multiples de step)
    B.forEach((b) => {
      const cuts = [b.x0];
      for (let x = Math.ceil(b.x0 / step + 1e-9) * step; x < b.x1 - 1e-6; x += step) cuts.push(x);
      cuts.push(b.x1);
      for (let i = 0; i < cuts.length - 1; i++) slices.push(Object.assign({}, b, { x0: cuts[i], x1: cuts[i + 1], first: i === 0, last: i === cuts.length - 2 }));
    });
    slices.forEach((b) => {
      const P = (x, y, z) => cam.p(x, y, z);
      const cen = P((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
      const F6 = [
        { c: [[b.x0, b.y0, b.z1], [b.x1, b.y0, b.z1], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1]], f: 1.12 },
        { c: [[b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0], [b.x1, b.y1, b.z0], [b.x0, b.y1, b.z0]], f: 0.7 },
        { c: [[b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0], [b.x1, b.y0, b.z1], [b.x0, b.y0, b.z1]], f: 0.95 },
        { c: [[b.x0, b.y1, b.z0], [b.x1, b.y1, b.z0], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1]], f: 0.8 },
        { c: [[b.x0, b.y0, b.z0], [b.x0, b.y1, b.z0], [b.x0, b.y1, b.z1], [b.x0, b.y0, b.z1]], f: 0.85, end: 'first' },
        { c: [[b.x1, b.y0, b.z0], [b.x1, b.y1, b.z0], [b.x1, b.y1, b.z1], [b.x1, b.y0, b.z1]], f: 0.78, end: 'last' }
      ];
      F6.forEach((fc) => {
        if (fc.end && !b[fc.end]) return;                    // face interne entre deux tranches
        const pts = fc.c.map((q) => P(q[0], q[1], q[2]));
        const d = pts.reduce((a, q) => a + q.d / 4, 0);
        if (d >= cen.d - 1e-6) return;                       // face tournée vers l'arrière
        const col = shade(b.col, fc.f);
        faces.push({ pts, d, col, op: b.op, seam: !fc.end && !(b.first && b.last) });
      });
    });
    faces.sort((a, b) => b.d - a.d);
    return faces;
  }
  const poly = (f, S2) => `<polygon points="${f.pts.map((q) => { const p = S2(q); return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ')}" fill="${f.col}"${f.op ? ` fill-opacity="${f.op}"` : ''} stroke="${f.seam ? f.col : INK}" stroke-width="${f.seam ? 0.8 : 0.45}"${f.op ? ` stroke-opacity="${f.op}"` : ''} stroke-linejoin="round"/>`;

  function render3D(R, opts = {}) {
    const W = opts.W || 560, H = opts.H || 360;
    const cam = camera(opts.az, opts.el);
    const { B, ext } = boxesOf(R, opts.colorOf);
    const faces = facesOf(B, cam, Math.max(10, Math.round(ext / 18 / 5) * 5));
    const all = faces.flatMap((f) => f.pts).concat(opts.extraPts ? opts.extraPts.map((q) => cam.p(q[0], q[1], q[2])) : []);
    const umin = Math.min(...all.map((q) => q.u)), umax = Math.max(...all.map((q) => q.u)), vmin = Math.min(...all.map((q) => q.v)), vmax = Math.max(...all.map((q) => q.v));
    const pad = opts.pad || 26, top = opts.top || 36;
    const k = Math.min((W - 2 * pad) / (umax - umin), (H - top - pad) / (vmax - vmin));
    const ox = (W - (umax - umin) * k) / 2 - umin * k, oy = top + (H - top - pad - (vmax - vmin) * k) / 2 - vmin * k;
    const S2 = (q) => ({ x: ox + q.u * k, y: oy + q.v * k });
    let s = faces.map((f) => poly(f, S2)).join('');
    // axe du joint
    const a1 = S2(cam.p(0, 0, R.S.h / 2 + 60)), a2 = S2(cam.p(0, 0, -R.S.h / 2 - 60));
    s += `<line x1="${a1.x}" y1="${a1.y}" x2="${a2.x}" y2="${a2.y}" stroke="${INK}" stroke-width=".6" stroke-dasharray="7 3 1 3"/>`;
    const proj = (x, y, z) => S2(cam.p(x, y, z));
    // trièdre
    const tri = opts.triad !== false ? (() => {
      const o = { x: 34, y: H - 30 }, L = 26;
      const d = (x, y, z) => { const a = cam.p(x, y, z), b = cam.p(0, 0, 0); const n = Math.hypot(a.u - b.u, a.v - b.v) || 1; return { x: o.x + (a.u - b.u) / n * L, y: o.y + (a.v - b.v) / n * L }; };
      const id = 'tri' + (++uid);
      return `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0L10,5L0,10z" fill="${INK}"/></marker></defs>` +
        [['x', d(1, 0, 0)], ['y', d(0, 1, 0)], ['z', d(0, 0, 1)]].map(([n, p]) => `<line x1="${o.x}" y1="${o.y}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="${INK}" stroke-width="1" marker-end="url(#${id})"/>${T(p.x + (p.x - o.x) * 0.25, p.y + (p.y - o.y) * 0.25 + 3, n, { a: 'middle', fs: 9.5, fw: 700 })}`).join('');
    })() : '';
    return { s: s + tri, proj, k, cam, W, H };
  }

  function iso(R, opts = {}) {
    const W = opts.W || 560, H = opts.H || 340;
    const r = render3D(R, Object.assign({}, opts, { W, H }));
    const title = opts.title == null ? 'Vue 3D' : opts.title;
    return svgWrap(W, H, (title ? T(8, 16, title, { fw: 800, fs: 11.5 }) : '') + (opts.sub ? T(8, 30, opts.sub, { fw: 500, fs: 9.5, col: MUTED }) : '') + r.s + (opts.after ? opts.after(r) : ''));
  }

  // ---------- vue 3D du torseur (actions sur la partie droite, côté vérifié) ----------
  const COL = { N: '#c0392b', Vy: '#2e86de', Vz: '#16a085', Mx: '#8e44ad', My: '#d35400', Mz: '#2c3e50' };
  function torseur3D(R, L, W = 520, H = 400) {
    const S = R.S;
    const Lmax = 1.9 * S.h;
    const vals = { N: +L.N || 0, Vy: +L.Vy || 0, Vz: +L.Vz || 0, Mx: +L.Mx || 0, My: +L.My || 0, Mz: +L.Mz || 0 };
    // vecteurs (repère global) : N > 0 compression → +x sur la face gauche de la partie droite ;
    // M_y > 0 (semelle sup. comprimée) → vecteur +y ; M_z > 0 (côté +y comprimé) → vecteur −z ; M_x > 0 → vecteur −x
    const F = { N: [1, 0, 0], Vy: [0, 1, 0], Vz: [0, 0, 1] }, M = { Mx: [-1, 0, 0], My: [0, 1, 0], Mz: [0, 0, -1] };
    const fmax = Math.max(1e-9, ...['N', 'Vy', 'Vz'].map((k) => Math.abs(vals[k]))), mmax = Math.max(1e-9, ...['Mx', 'My', 'Mz'].map((k) => Math.abs(vals[k])));
    const len = (v, m) => (Math.abs(v) < 1e-9 ? 0 : (0.35 + 0.65 * Math.abs(v) / m) * Lmax * 0.55);
    const ext = [[Lmax, 0, 0], [-Lmax, 0, 0], [0, Lmax * 0.6, 0], [0, -Lmax * 0.6, 0], [0, 0, Lmax * 0.6], [0, 0, -Lmax * 0.6]];
    // poutre seule (sans éclisse) : partie droite pleine, partie gauche estompée
    const Rb = Object.assign({}, R);
    const S0 = R.S, h2 = S0.h / 2;
    const Bx = [];
    const add = (x0, x1, op) => {
      Bx.push({ x0, x1, y0: -S0.b / 2, y1: S0.b / 2, z0: h2 - S0.tf, z1: h2, col: BEAM, op });
      Bx.push({ x0, x1, y0: -S0.b / 2, y1: S0.b / 2, z0: -h2, z1: -h2 + S0.tf, col: BEAM, op });
      Bx.push({ x0, x1, y0: -S0.tw / 2, y1: S0.tw / 2, z0: -h2 + S0.tf, z1: h2 - S0.tf, col: BEAM, op });
    };
    add(-Lmax, -30, 0.35); add(30, Lmax, null);
    void Rb;
    const cam = camera(-32, 22);
    const faces = facesOf(Bx, cam, Lmax / 10);
    const all = faces.flatMap((f) => f.pts).concat(ext.map((q) => cam.p(q[0], q[1], q[2])));
    const umin = Math.min(...all.map((q) => q.u)), umax = Math.max(...all.map((q) => q.u)), vmin = Math.min(...all.map((q) => q.v)), vmax = Math.max(...all.map((q) => q.v));
    const k = Math.min((W - 40) / (umax - umin), (H - 70) / (vmax - vmin));
    const ox = (W - (umax - umin) * k) / 2 - umin * k, oy = 36 + (H - 60 - (vmax - vmin) * k) / 2 - vmin * k;
    const P = (x, y, z) => { const q = cam.p(x, y, z); return { x: ox + q.u * k, y: oy + q.v * k }; };
    let s = faces.map((f) => poly(f, (q) => ({ x: ox + q.u * k, y: oy + q.v * k }))).join('');
    // face du joint (partie droite) mise en évidence
    const fc = [[30, -S0.b / 2, h2], [30, S0.b / 2, h2], [30, S0.b / 2, h2 - S0.tf], [30, S0.tw / 2, h2 - S0.tf], [30, S0.tw / 2, -h2 + S0.tf], [30, S0.b / 2, -h2 + S0.tf], [30, S0.b / 2, -h2], [30, -S0.b / 2, -h2], [30, -S0.b / 2, -h2 + S0.tf], [30, -S0.tw / 2, -h2 + S0.tf], [30, -S0.tw / 2, h2 - S0.tf], [30, -S0.b / 2, h2 - S0.tf]];
    s += `<polygon points="${fc.map((q) => { const p = P(q[0], q[1], q[2]); return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ')}" fill="#fff4d6" fill-opacity=".85" stroke="${INK}" stroke-width=".8"/>`;
    const o = P(30, 0, 0);
    let defs = '';
    Object.keys(COL).forEach((kk) => { defs += `<marker id="tq${kk}${uid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="${COL[kk]}"/></marker>`; });
    const id = uid++;
    const vec = (key, dir, m, isM) => {
      const v = vals[key]; const l = len(v, m); if (!l) return '';
      const sg = Math.sign(v);
      const e = P(30 + dir[0] * sg * l, dir[1] * sg * l, dir[2] * sg * l);
      const mk = `url(#tq${key}${id})`;
      let a = `<line x1="${o.x.toFixed(1)}" y1="${o.y.toFixed(1)}" x2="${e.x.toFixed(1)}" y2="${e.y.toFixed(1)}" stroke="${COL[key]}" stroke-width="${isM ? 2.2 : 2.6}" marker-end="${mk}"/>`;
      if (isM) {        // double flèche des moments
        const e2 = P(30 + dir[0] * sg * l * 0.86, dir[1] * sg * l * 0.86, dir[2] * sg * l * 0.86);
        a += `<line x1="${o.x.toFixed(1)}" y1="${o.y.toFixed(1)}" x2="${e2.x.toFixed(1)}" y2="${e2.y.toFixed(1)}" stroke="${COL[key]}" stroke-width="2.2" marker-end="${mk}"/>`;
      }
      const lbl = { N: 'N', Vy: 'V_y', Vz: 'V_z', Mx: 'M_x', My: 'M_y', Mz: 'M_z' }[key];
      const u = isM ? 'kN·m' : 'kN';
      a += T(e.x + (e.x >= o.x ? 6 : -6), e.y + (e.y >= o.y ? 13 : -5), sb(`${lbl} = ${fmt(v, 1)} ${u}`), { col: COL[key], fw: 800, fs: 10.5, a: e.x >= o.x ? 'start' : 'end' });
      return a;
    };
    s += ['N', 'Vy', 'Vz'].map((kk) => vec(kk, F[kk], fmax, false)).join('') + ['Mx', 'My', 'Mz'].map((kk) => vec(kk, M[kk], mmax, true)).join('');
    s += `<circle cx="${o.x}" cy="${o.y}" r="3" fill="${INK}"/>`;
    // trièdre
    const tri = (() => {
      const oo = { x: 34, y: H - 26 }, Ln = 24;
      const d = (x, y, z) => { const a = cam.p(x, y, z), b = cam.p(0, 0, 0); const n = Math.hypot(a.u - b.u, a.v - b.v) || 1; return { x: oo.x + (a.u - b.u) / n * Ln, y: oo.y + (a.v - b.v) / n * Ln }; };
      return [['x', d(1, 0, 0)], ['y', d(0, 1, 0)], ['z', d(0, 0, 1)]].map(([n, p]) => `<line x1="${oo.x}" y1="${oo.y}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="${INK}" stroke-width="1"/>${T(p.x + (p.x - oo.x) * 0.3, p.y + (p.y - oo.y) * 0.3 + 3, n, { a: 'middle', fs: 9.5, fw: 700 })}`).join('');
    })();
    s += T(8, 16, 'Torseur appliqué au droit du joint', { fw: 800, fs: 11.5 });
    s += T(8, 30, 'actions sur la partie droite · flèche simple : effort · double flèche : moment', { fw: 500, fs: 9, col: MUTED });
    return svgWrap(W, H, s + tri, defs);
  }

  // ---------- exemple de convention : poutre isostatique, éclisse à L/4 ----------
  function convention(W = 300, H = 400) {
    const x0 = 26, x1 = W - 26, Lp = x1 - x0, xs = x0 + Lp / 4;
    const yb = 92;
    const id = 'cv' + (++uid);
    let s = `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0L10,5L0,10z" fill="${INK}"/></marker></defs>`;
    s += T(8, 16, 'Convention de signe', { fw: 800, fs: 11.5 });
    s += T(8, 30, 'poutre isostatique, charge q ↓, éclisse à L/4', { fw: 500, fs: 9, col: MUTED });
    for (let i = 0; i <= 10; i++) { const x = x0 + Lp * i / 10; s += `<line x1="${x}" y1="${yb - 30}" x2="${x}" y2="${yb - 8}" stroke="${INK}" stroke-width=".8" marker-end="url(#${id})"/>`; }
    s += `<line x1="${x0}" y1="${yb - 30}" x2="${x1}" y2="${yb - 30}" stroke="${INK}" stroke-width=".8"/>` + T((x0 + x1) / 2, yb - 34, 'q', { a: 'middle', fs: 10 });
    s += `<rect x="${x0}" y="${yb - 6}" width="${Lp}" height="12" fill="${BEAM}" stroke="${INK}" stroke-width=".8"/>`;
    s += `<rect x="${xs - 10}" y="${yb - 9}" width="20" height="18" fill="${ACC}" fill-opacity=".8" stroke="${INK}" stroke-width=".8"/>`;
    s += `<path d="M${x0},${yb + 6} l-7,12 h14 z M${x1},${yb + 6} l-7,12 h14 z" fill="none" stroke="${INK}" stroke-width=".9"/>`;
    s += T(xs, yb - 13, 'éclisse', { a: 'middle', fs: 8.5, col: MUTED });
    // diagramme V
    const yv = yb + 70, hv = 26;
    s += T(8, yv - hv - 6, 'V_z = dM_y/dx'.replace(/_([a-z]+)/g, '<tspan baseline-shift="sub" font-size="75%">$1</tspan>'), { fs: 9.5, fw: 700 });
    s += `<line x1="${x0}" y1="${yv}" x2="${x1}" y2="${yv}" stroke="${INK}" stroke-width=".7"/><path d="M${x0},${yv} L${x0},${yv - hv} L${x1},${yv + hv} L${x1},${yv} Z" fill="#16a085" fill-opacity=".18" stroke="#16a085" stroke-width="1.2"/>`;
    s += `<line x1="${xs}" y1="${yv - hv - 4}" x2="${xs}" y2="${yv + hv + 4}" stroke="${RED}" stroke-width="1" stroke-dasharray="3 2"/>` + T(xs + 4, yv - hv / 2 - 2, 'V_z > 0'.replace('_z', '<tspan baseline-shift="sub" font-size="75%">z</tspan>'), { fs: 9.5, fw: 800, col: '#16a085' });
    // diagramme M (positif vers le bas : semelle inférieure tendue)
    const ym = yv + 64, hm = 34;
    s += T(8, ym - 10, 'M_y (> 0 : semelle sup. comprimée)'.replace('_y', '<tspan baseline-shift="sub" font-size="75%">y</tspan>'), { fs: 9.5, fw: 700 });
    let pth = `M${x0},${ym}`; for (let i = 0; i <= 40; i++) { const t = i / 40; pth += ` L${(x0 + Lp * t).toFixed(1)},${(ym + 4 * hm * t * (1 - t)).toFixed(1)}`; }
    s += `<line x1="${x0}" y1="${ym}" x2="${x1}" y2="${ym}" stroke="${INK}" stroke-width=".7"/><path d="${pth} Z" fill="#d35400" fill-opacity=".16" stroke="#d35400" stroke-width="1.2"/>`;
    s += `<line x1="${xs}" y1="${ym - 4}" x2="${xs}" y2="${ym + hm + 6}" stroke="${RED}" stroke-width="1" stroke-dasharray="3 2"/>` + T(xs + 4, ym + 3 * hm / 4 + 4, 'M_y > 0'.replace('_y', '<tspan baseline-shift="sub" font-size="75%">y</tspan>'), { fs: 9.5, fw: 800, col: '#d35400' });
    // résumé
    const yt = ym + hm + 34;
    const lines = ['À x = L/4 :', 'V_z = +q·L/4  (> 0)', 'M_y = +3·q·L²/32  (> 0)', 'N > 0 : compression', 'M_z > 0 comprime le côté +y', 'M_x > 0 : semelle sup. poussée vers +y'];
    lines.forEach((l, i) => { s += T(8, yt + i * 14, sb(l), { fs: 9.5, fw: i ? 500 : 700 }); });
    return svgWrap(W, H, s);
  }

  // ---------- carte des taux d'utilisation ----------
  const rateCol = (r) => {
    if (!(r >= 0)) return BEAM;
    if (r > 1) return RED;
    const stops = [[0, [205, 232, 214]], [0.5, [133, 191, 156]], [0.8, [244, 196, 107]], [1, [236, 120, 72]]];
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) if (r >= stops[i][0] && r <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
    const t = (r - a[0]) / Math.max(1e-9, b[0] - a[0]);
    const c = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * t));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  };
  function rateMap(R, rates, W = 600, H = 380) {
    const colorOf = (id) => rateCol(rates[id]);
    return iso(R, { W, H, colorOf, title: 'Taux d\'utilisation par pièce', sub: 'vert : faible · orange : proche de 1 · rouge : > 100 % — enveloppe des torseurs' });
  }

  window.FirmitasSpliceDraw = { plan, elevation, section, iso, torseur3D, convention, rateMap, rateCol, COL };
})();
