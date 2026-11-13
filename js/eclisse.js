/* ==========================================================================
   Firmitas — module « Éclisse » : interface, schémas et fiche NDC
   ========================================================================== */
(function () {
  'use strict';
  const C = window.FirmitasSpliceCalc, D = window.FIRMITAS_DATA;
  const A = () => window.FirmitasApp;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
  const fmtG = (x, d = 3) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { maximumFractionDigits: d }) : '—');
  const pct = (r) => (Number.isFinite(r) ? Math.round(r * 100) + ' %' : '∞');
  const sub = (s) => esc(s).replace(/_([A-Za-z0-9,.]+)/g, '<sub>$1</sub>');
  const bar = (r) => `<div class="bar"><i class="${!(r <= 1) ? 'ko' : r > 0.9 ? 'hi' : ''}" style="width:${Math.min(100, (Number.isFinite(r) ? r : 1) * 100)}%"></i></div>`;
  const pill = (r) => (r == null ? '<span class="pill na">—</span>' : r <= 1 ? '<span class="pill ok">OK</span>' : '<span class="pill ko">NON</span>');
  const kN = (x) => fmt(x / 1e3, 1), kNm = (x) => fmt(x / 1e6, 2);
  const ACC = '#8b9d99', RED = '#fa554f', INK = '#111110', BEAM = '#d9dee6';

  let st = null, R = null, ENV = null, dirty = false, view = 'tot', db = null, common = false;
  const curLoad = () => st.loads[Math.min(st.loads.length - 1, +st.cur || 0)];
  const DR = window.FirmitasSpliceDraw;
  function tqFields() {
    const i = Math.min(st.loads.length - 1, +st.cur || 0), L = st.loads[i];
    const chips = st.loads.length > 1 ? `<div class="chips" style="margin-bottom:10px">${st.loads.map((x, j) => `<button type="button" class="chip${j === i ? ' on' : ''}" data-sact="cur" data-i="${j}">${esc(x.name || 'T' + (j + 1))}</button>`).join('')}</div>` : '';
    return `${chips}<div class="fields" style="grid-template-columns:1fr">
      ${field('Torseur', `<input type="text" data-sp="loads.${i}.name" value="${esc(L.name)}">`)}
      ${C.COMPS.map((x) => `<label class="field"><span><b style="color:${DR.COL[x.id]}">${sub(x.label)}</b> <span class="u">[${x.unit}] — ${x.title.toLowerCase()}</span></span><input type="number" step="any" data-sp="loads.${i}.${x.id}" value="${esc(L[x.id])}"></label>`).join('')}
      ${field('Partage de M<sub>y</sub>', sel('myShare', [['inertie', 'Âme selon sa part d\'inertie (a)'], ['semelles', 'Semelles seules (b)']]))}
    </div>`;
  }
  // taux par pièce (enveloppe) pour la carte des taux
  const PARTS = [
    ['bTop', 'Boulons — semelle supérieure', (c) => c.grp === 'top' && /^(v|s)$/.test(c.id)],
    ['bBot', 'Boulons — semelle inférieure', (c) => c.grp === 'bot' && /^(v|s)$/.test(c.id)],
    ['bWeb', 'Boulons — âme', (c) => c.grp === 'web' && /^(v|s)$/.test(c.id)],
    ['pTop', 'Tôles d\'éclisse — semelle supérieure', (c) => c.grp === 'top' && (/^p/.test(c.id) || /^b_(outer|inner)$/.test(c.id))],
    ['pBot', 'Tôles d\'éclisse — semelle inférieure', (c) => c.grp === 'bot' && (/^p/.test(c.id) || /^b_(outer|inner)$/.test(c.id))],
    ['pWeb', 'Tôles d\'éclisse — âme', (c) => c.grp === 'web' && (/^p/.test(c.id) || c.id === 'b_plate')],
    ['fTop', 'Semelle supérieure de la poutre', (c) => c.grp === 'top' && /^(b_beam|bbt|bnet)$/.test(c.id)],
    ['fBot', 'Semelle inférieure de la poutre', (c) => c.grp === 'bot' && /^(b_beam|bbt|bnet)$/.test(c.id)],
    ['web', 'Âme de la poutre', (c) => c.grp === 'web' && /^(b_beam|bnet)$/.test(c.id)]
  ];
  function partRates(rows) {
    const o = {};
    PARTS.forEach(([id, label, f]) => { const g = rows.filter(f).reduce((a, c) => (c.r > a.r ? c : a), { r: 0, label: '—' }); o[id] = { r: g.r, label, gov: g }; });
    return o;
  }
  function geoFigs(R, compact) {
    return `<div class="fig-grid">
      <div class="fig wide">${DR.elevation(R)}</div>
      <div class="fig">${DR.plan(R, 'top')}</div><div class="fig">${DR.plan(R, 'bot')}</div>
      <div class="fig">${DR.section(R)}</div><div class="fig">${DR.iso(R, { sub: 'plats d\'éclisse en vert, boulons en gris foncé' })}</div>
    </div>${compact ? '' : ''}`;
  }
  const get = (p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), st);
  function set(p, v) { const ks = p.split('.'); let a = st; ks.slice(0, -1).forEach((k) => { if (a[k] == null) a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }

  // ---------- champs ----------
  const inp = (p, o = {}) => `<input type="${o.type || 'number'}" data-sp="${p}" value="${esc(get(p))}"${(o.type || 'number') === 'number' ? ' step="any"' : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>`;
  const sel = (p, opts, o = {}) => { const v = String(get(p)); return `<select data-sp="${p}"${o.rr ? ' data-rr="1"' : ''}>${opts.map((x) => x.group ? `<optgroup label="${esc(x.group)}">${x.items.map((it) => `<option value="${esc(it[0])}"${String(it[0]) === v ? ' selected' : ''}>${esc(it[1])}</option>`).join('')}</optgroup>` : `<option value="${esc(x[0])}"${String(x[0]) === v ? ' selected' : ''}>${esc(x[1])}</option>`).join('')}</select>`; };
  const chk = (p, label, rr) => `<label class="check"><input type="checkbox" data-sp="${p}"${get(p) ? ' checked' : ''}${rr ? ' data-rr="1"' : ''}> ${label}</label>`;
  const field = (label, control, unit, hint) => `<label class="field"><span>${label}${unit ? ` <span class="u">[${unit}]</span>` : ''}</span>${control}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  const blockHead = (n, t, p) => `<div class="block-head"><span class="num">${n}</span><h2>${t}</h2><p>${p || ''}</p></div>`;
  const iFams = () => D.FAMILIES.filter((f) => !f.tube && !f.ipn).map((f) => [f.id, f.id]);

  function init(database) { db = database; st = db.sdraft ? C.upgrade(db.sdraft) : C.defaultState(); dirty = !!db.sdraftDirty; }
  let saveT = null;
  function persist() { clearTimeout(saveT); saveT = setTimeout(() => { db.sdraft = st; db.sdraftDirty = dirty; A().saveDb(); }, 250); }

  // ======================================================================
  //  SCHÉMAS
  // ======================================================================
  let mk = 0;
  const marker = (id, col) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="${col}"/></marker>`;
  const arrow = (x1, y1, x2, y2, id, col, w = 1.6) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="${w}" marker-end="url(#${id})"/>`;
  const T = (x, y, s, o = {}) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="Inter,Arial,sans-serif" font-size="${o.fs || 10.5}" font-weight="${o.fw || 600}" fill="${o.col || INK}"${o.a ? ` text-anchor="${o.a}"` : ''}>${s}</text>`;
  const loadsOf = (comp) => (comp === 'tot' ? R.dist.tot : R.dist.per[comp]);
  const compLabel = (c) => (c === 'tot' ? 'torseur complet' : esc(C.COMPS.find((x) => x.id === c).label).replace(/_([A-Za-z]+)/, '<tspan baseline-shift="sub" font-size="75%">$1</tspan>') + ' seul');

  // Coupe transversale au droit du joint : répartition entre les plats
  function endView(comp, W = 620, H = 380) {
    const S = R.S, s = st, G = R.groups, id = 'ae' + (++mk);
    const top = G.top.plate, bot = G.bot.plate, wp = G.web.plate;
    const Htot = S.h + top.to + bot.to, Bt = Math.max(S.b, top.bo, bot.bo);
    const k = Math.min((H - 110) / Htot, (W * 0.42) / Bt);
    const cx = W * 0.27, cy = (H - 26) / 2 + (top.to - bot.to) * k / 2;
    const X = (y) => cx + y * k, Y = (z) => cy - z * k;
    const rect = (y1, y2, z1, z2, fill, o = '') => `<rect x="${X(Math.min(y1, y2)).toFixed(1)}" y="${Y(Math.max(z1, z2)).toFixed(1)}" width="${(Math.abs(y2 - y1) * k).toFixed(1)}" height="${(Math.abs(z2 - z1) * k).toFixed(1)}" fill="${fill}" stroke="${INK}" stroke-width=".8"${o}/>`;
    const h2 = S.h / 2;
    let g = '';
    // poutre
    g += rect(-S.b / 2, S.b / 2, h2 - S.tf, h2, BEAM) + rect(-S.b / 2, S.b / 2, -h2, -h2 + S.tf, BEAM) + rect(-S.tw / 2, S.tw / 2, -h2 + S.tf, h2 - S.tf, BEAM);
    // plats
    const pf = ` fill-opacity=".75"`;
    g += rect(-top.bo / 2, top.bo / 2, h2, h2 + top.to, ACC, pf);
    g += rect(-bot.bo / 2, bot.bo / 2, -h2, -h2 - bot.to, ACC, pf);
    if (G.top.dbl) [1, -1].forEach((sg) => { g += rect(sg * top.tIn0, sg * (top.tIn0 + top.bi), h2 - S.tf, h2 - S.tf - top.ti, ACC, pf); });
    if (G.bot.dbl) [1, -1].forEach((sg) => { g += rect(sg * bot.tIn0, sg * (bot.tIn0 + bot.bi), -h2 + S.tf, -h2 + S.tf + bot.ti, ACC, pf); });
    [1, -1].forEach((sg) => { g += rect(sg * S.tw / 2, sg * (S.tw / 2 + wp.tp), -wp.hp / 2, wp.hp / 2, ACC, pf); });
    // boulons
    const FG = R.geo.fl, WG = R.geo.web;
    FG.ts.forEach((t) => {
      g += `<line x1="${X(t)}" y1="${Y(h2 + top.to + 4)}" x2="${X(t)}" y2="${Y(h2 - S.tf - (G.top.dbl ? top.ti : 0) - 4)}" stroke="${INK}" stroke-width="${Math.max(1.5, R.bolt.d * k * 0.6)}" stroke-opacity=".55"/>`;
      g += `<line x1="${X(t)}" y1="${Y(-h2 - bot.to - 4)}" x2="${X(t)}" y2="${Y(-h2 + S.tf + (G.bot.dbl ? bot.ti : 0) + 4)}" stroke="${INK}" stroke-width="${Math.max(1.5, R.bolt.d * k * 0.6)}" stroke-opacity=".55"/>`;
    });
    WG.ts.forEach((z) => { g += `<line x1="${X(-S.tw / 2 - wp.tp - 4)}" y1="${Y(z)}" x2="${X(S.tw / 2 + wp.tp + 4)}" y2="${Y(z)}" stroke="${INK}" stroke-width="${Math.max(1.5, R.bolt.d * k * 0.6)}" stroke-opacity=".55"/>`; });
    g += `<line x1="${X(-Bt / 2 - 10)}" y1="${Y(0)}" x2="${X(Bt / 2 + 10)}" y2="${Y(0)}" stroke="${INK}" stroke-width=".5" stroke-dasharray="4 2 1 2"/>`;
    g += `<line x1="${X(0)}" y1="${Y(Htot / 2 + 8)}" x2="${X(0)}" y2="${Y(-Htot / 2 - 8)}" stroke="${INK}" stroke-width=".5" stroke-dasharray="4 2 1 2"/>`;
    g += T(X(Bt / 2 + 12), Y(0) - 3, 'y') + T(X(0) - 5, Y(Htot / 2 + 2), 'z', { a: 'end' });
    // efforts dans chaque partie
    const L = loadsOf(comp);
    const mx = Math.max(1, ...['top', 'web', 'bot'].map((p) => Math.abs(L[p].Ft)));
    const amax = 55;
    const fxSym = (x, y, v) => (Math.abs(v) < 1 ? '' : `<circle cx="${x}" cy="${y}" r="7" fill="#fff" stroke="${v > 0 ? INK : RED}" stroke-width="1.4"/>${v > 0 ? `<circle cx="${x}" cy="${y}" r="2" fill="${INK}"/>` : `<path d="M${x - 4},${y - 4}L${x + 4},${y + 4}M${x - 4},${y + 4}L${x + 4},${y - 4}" stroke="${RED}" stroke-width="1.4"/>`}`);
    const lab = (p, yTxt) => {
      const q = L[p], lines = [];
      lines.push(`F<tspan font-size="8" dy="2">x</tspan><tspan dy="-2"> = ${kN(Math.abs(q.Fx))} kN ${Math.abs(q.Fx) < 1 ? '' : q.Fx > 0 ? '(compr.)' : '(tract.)'}</tspan>`);
      lines.push(`F<tspan font-size="8" dy="2">${p === 'web' ? 'z' : 'y'}</tspan><tspan dy="-2"> = ${kN(q.Ft)} kN</tspan>`);
      lines.push(`M<tspan font-size="8" dy="2">${p === 'web' ? 'y' : 'z'}</tspan><tspan dy="-2"> = ${kNm(q.M)} kN·m (dans le plan)</tspan>`);
      const xt = X(Bt / 2) + 28;
      return T(xt, yTxt - 13, p === 'web' ? 'Plats d\'âme' : p === 'top' ? 'Semelle supérieure' : 'Semelle inférieure', { fw: 800, fs: 12 }) + lines.map((l, i) => T(xt, yTxt + 3 + i * 14, l, { fw: 500, fs: 11 })).join('');
    };
    g += fxSym(X(-top.bo / 2) - 14, Y(h2 + top.to / 2), L.top.Fx) + fxSym(X(-bot.bo / 2) - 14, Y(-h2 - bot.to / 2), L.bot.Fx) + fxSym(X(-S.tw / 2 - wp.tp) - 14, Y(0) - 14, L.web.Fx);
    const ah = (p, x0, y0, horiz) => {
      const v = L[p].Ft; if (Math.abs(v) < 1) return '';
      const len = 12 + amax * Math.abs(v) / mx;
      return horiz ? arrow(x0, y0, x0 + Math.sign(v) * len, y0, id, INK, 2) : arrow(x0, y0, x0, y0 - Math.sign(v) * len, id, INK, 2);
    };
    g += ah('top', X(0), Y(h2 + top.to) - 14, true) + ah('bot', X(0), Y(-h2 - bot.to) + 14, true) + ah('web', X(S.tw / 2 + wp.tp) + 16, Y(0), false);
    g += lab('top', Y(h2 + top.to) - 10) + lab('web', Y(0) - 8) + lab('bot', Y(-h2 - bot.to) - 14);
    g += T(8, H - 8, `⊙ compression · ⊗ traction · flèches : efforts tranchants — ${compLabel(comp)}`, { fw: 500, fs: 9.5, col: '#6e6d69' });
    return `<svg class="diag" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs>${marker(id, INK)}</defs>${g}</svg>`;
  }

  // Vue en plan d'un groupe : plats, boulons, vecteurs d'effort par boulon
  function refOf(G) {
    let ref = G.Fv;
    if (R.cat === 'C') ref = Math.min(ref, G.Fs);
    G.plies.forEach((p) => { if (p.bx && p.bt) ref = Math.min(ref, Math.min(p.bx.Fb, p.bt.Fb) / p.share); });
    return ref;
  }
  function groupPanel(gid, comp, fScale, W = 560, H = 240) {
    const G = R.groups[gid], geo = G.G, S = R.S, g = R.g, id = 'ag' + (++mk), idr = 'agr' + mk;
    const fl = G.kind === 'flange';
    const Lh = g / 2 + geo.e1b + (geo.n1 - 1) * geo.p1 + geo.e1;
    const span = fl ? Math.max(S.b, G.plate.bo) : (S.h - 2 * S.tf);
    const k = Math.min((W - 60) / (2 * Lh + 60), (H - 56) / span);
    const cx = W / 2, cy = 28 + (H - 56) / 2;
    const X = (x) => cx + x * k, Y = (t) => cy - t * k;
    const rect = (x1, x2, t1, t2, o) => `<rect x="${X(Math.min(x1, x2)).toFixed(1)}" y="${Y(Math.max(t1, t2)).toFixed(1)}" width="${(Math.abs(x2 - x1) * k).toFixed(1)}" height="${(Math.abs(t2 - t1) * k).toFixed(1)}" ${o}/>`;
    let s = '';
    const ext = Lh + 30;
    const half = fl ? S.b / 2 : (S.h - 2 * S.tf) / 2;
    s += rect(-ext, -g / 2, -half, half, `fill="${BEAM}" stroke="${INK}" stroke-width=".8"`) + rect(g / 2, ext, -half, half, `fill="${BEAM}" stroke="${INK}" stroke-width=".8"`);
    if (fl) {
      s += rect(-ext, ext, -S.tw / 2, S.tw / 2, `fill="none" stroke="${INK}" stroke-width=".5" stroke-dasharray="3 2"`);     // âme sous la semelle
      s += rect(-Lh, Lh, -G.plate.bo / 2, G.plate.bo / 2, `fill="${ACC}" fill-opacity=".45" stroke="${INK}" stroke-width="1"`);
      if (G.dbl) [1, -1].forEach((sg) => { s += rect(-Lh, Lh, sg * G.plate.tIn0, sg * (G.plate.tIn0 + G.plate.bi), `fill="none" stroke="${INK}" stroke-width=".9" stroke-dasharray="5 3"`); });
    } else {
      s += rect(-Lh, Lh, -G.plate.hp / 2, G.plate.hp / 2, `fill="${ACC}" fill-opacity=".45" stroke="${INK}" stroke-width="1"`);
    }
    s += `<line x1="${X(0)}" y1="${Y(half + 12)}" x2="${X(0)}" y2="${Y(-half - 12)}" stroke="${INK}" stroke-width=".7" stroke-dasharray="6 3 1 3"/>`;
    const ref = refOf(G);
    const forces = comp === 'tot' ? G.tot : G.loads[comp];
    const r = Math.max(3, R.bolt.d0 / 2 * k);
    const minSp = Math.min(geo.p1, fl ? (geo.n2s > 1 ? geo.p2 : geo.w) : geo.p2) * k;
    const scl = fScale == null ? Math.max(...forces.map((f) => f.f)) : fScale;
    const sc = scl > 0 ? Math.max(16, 0.75 * minSp) / scl : 0;
    let imax = 0;
    geo.pts.forEach((p, i) => {
      s += `<circle cx="${X(-p.x)}" cy="${Y(p.t)}" r="${r}" fill="#fff" stroke="${INK}" stroke-width=".7" stroke-opacity=".5"/>`;
      const u = G.tot[i].f / ref;
      s += `<circle cx="${X(p.x)}" cy="${Y(p.t)}" r="${r}" fill="${u > 1 ? RED : ACC}" fill-opacity="${u > 1 ? 1 : (0.15 + 0.85 * Math.min(1, u)).toFixed(2)}" stroke="${INK}" stroke-width="1"/>`;
      if (forces[i].f > forces[imax].f) imax = i;
    });
    geo.pts.forEach((p, i) => {
      const f = forces[i]; if (!(f.f > scl * 1e-3)) return;
      const ln = Math.max(f.f * sc, r + 9) / (f.f * sc);
      s += arrow(X(p.x), Y(p.t), X(p.x) + f.fx * sc * ln, Y(p.t) - f.ft * sc * ln, i === imax ? idr : id, i === imax ? RED : INK, i === imax ? 2 : 1.4);
    });
    const pm = geo.pts[imax], fm = forces[imax];
    if (fm.f > 0) s += T(X(pm.x) - r - 4, Y(pm.t) + (pm.t >= 0 ? -r - 3 : r + 11), `${kN(fm.f)} kN`, { col: RED, fw: 800, a: 'end' });
    const q = comp === 'tot' ? G.force : R.dist.per[comp][gid];
    s += T(8, 14, `${C.GROUPS.find((x) => x.id === gid).label} — ${fl ? (G.dbl ? 'plat extérieur + 2 plats intérieurs (2 plans)' : 'plat extérieur seul (1 plan)') : '2 plats (2 plans)'}`, { fw: 800, fs: 11 });
    s += T(W - 8, 14, `F<tspan font-size="8" dy="2">x</tspan><tspan dy="-2"> = ${kN(q.Fx)} · F</tspan><tspan font-size="8" dy="2">${fl ? 'y' : 'z'}</tspan><tspan dy="-2"> = ${kN(q.Ft)} kN · M = ${kNm(q.M)} kN·m</tspan>`, { a: 'end', fw: 500, fs: 10 });
    s += T(8, H - 8, `${fl ? 'Vue en plan' : 'Élévation'} · trait mixte : axe du joint · côté vérifié à droite ·${compLabel(comp)} · teinte = taux du boulon sous le torseur complet`, { fw: 500, fs: 9, col: '#6e6d69' });
    return { svg: `<svg class="diag" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs>${marker(id, INK)}${marker(idr, RED)}</defs>${s}</svg>`, fmax: fm.f };
  }
  function scaleOf(comp) {
    let m = 0;
    ['top', 'web', 'bot'].forEach((g) => { (comp === 'tot' ? R.groups[g].tot : R.groups[g].loads[comp]).forEach((f) => { m = Math.max(m, f.f); }); });
    return m;
  }

  // ======================================================================
  //  PAGE
  // ======================================================================
  function render(app) {
    R = C.compute(st);
    const c = st.sec, b = st.bolt;
    const plateBlock = (k, lbl) => `<div><div class="sub-title">${lbl}</div>
      <div style="margin-bottom:10px">${chk(k + '.double', 'Plat dédoublé : plat extérieur + 2 plats intérieurs (double recouvrement)', true)}</div>
      <div class="fields">${field('Plat extérieur b<sub>o</sub>', inp(k + '.bo'), 'mm')}${field('t<sub>o</sub>', inp(k + '.to'), 'mm')}
      ${st[k].double ? field('Plats intérieurs b<sub>i</sub>', inp(k + '.bi'), 'mm', 'Chacun, posés contre le congé') + field('t<sub>i</sub>', inp(k + '.ti'), 'mm') : ''}
      ${field('Fourrure t<sub>p</sub>', inp(k + '.pack'), 'mm', 'Profils de hauteurs différentes : β<sub>p</sub> si t<sub>p</sub> &gt; d/3 (3.6.1 (12))')}</div></div>`;
    const { p } = A().crumbK('eclisse');
    app.innerHTML = `<div class="page">
      <div class="actionbar">
        <div class="grow"><span class="crumb">${p ? `Projet <b>${esc(p.name)}</b> ›` : 'Hors projet ›'} <b id="sCrumb">${esc(st.name || 'Sans nom')}</b></span><span class="dirty" id="sDirty">${dirty ? 'modifié · non enregistré' : ''}</span></div>
        <span id="sVerdict"></span>
        <div class="btn-group"><button class="btn" data-sact="new">Nouveau</button><button class="btn" data-sact="save">Enregistrer</button><button class="btn" data-sact="saveas">Enregistrer sous…</button></div>
        <button class="btn primary" data-sact="report">Fiche NDC ↗</button>
      </div>

      ${blockHead('01', 'Poutre & matériaux', "Éclisse boulonnée d'une poutre en I : couvre-joints de semelles (simples ou dédoublés) et deux plats d'âme. Un côté du joint est vérifié, l'autre est symétrique.")}
      <div class="cols2"><div>
        <div class="fields">${field('Repère', inp('name', { type: 'text', ph: 'ex. Éclisse poutre P2' }))}</div>
        <div class="chips" style="margin:14px 0">${[['cat', 'Catalogue'], ['prs', 'PRS (I soudé)']].map(([k, l]) => `<button type="button" class="chip${c.kind === k ? ' on' : ''}" data-sact="kind" data-v="${k}">${l}</button>`).join('')}</div>
        <div class="fields">
          ${c.kind === 'prs' ? field('h', inp('sec.prs.h'), 'mm') + field('b', inp('sec.prs.b'), 'mm') + field('t<sub>w</sub>', inp('sec.prs.tw'), 'mm') + field('t<sub>f</sub>', inp('sec.prs.tf'), 'mm')
            : field('Famille', sel('sec.fam', iFams(), { rr: true })) + field('Profil', sel('sec.name', (D.CATALOG[c.fam] || []).map((x) => [x.name, x.name])))}
          ${field('Acier de la poutre', sel('grade', Object.keys(D.STEELS).map((x) => [x, x])))}
          ${field('Acier des plats', sel('plateGrade', Object.keys(D.STEELS).map((x) => [x, x])))}
          ${field('Jeu entre abouts g', inp('gap'), 'mm')}
        </div></div>
        <div id="sSecInfo" class="muted" style="font-size:12.5px;line-height:1.6"></div>
      </div>

      ${blockHead('02', 'Boulons', "Boulons ordinaires (catégorie A, cisaillement + pression diamétrale) ou précontraints (catégorie B : non-glissement à l'ELS ; catégorie C : non-glissement à l'ELU).")}
      <div class="fields">
        ${field('Diamètre — semelles', sel('bolt.d', Object.keys(C.BOLTS).map((d) => [d, 'M' + d])))}
        ${field('Diamètre — âme', sel('bolt.dw', [['same', 'Identique aux semelles']].concat(Object.keys(C.BOLTS).map((d) => [d, 'M' + d]))))}
        ${field('Classe', sel('bolt.cls', Object.keys(C.CLASSES).map((x) => [x, x]), { rr: true }))}
        ${field('γ<sub>M2</sub>', inp('gam.M2'))}
      </div>
      <div style="display:flex;gap:18px;flex-wrap:wrap;margin:12px 0">
        ${chk('bolt.pre', 'Boulons précontraints (HR)', true)}
        ${chk('bolt.threads', 'Filetage dans le plan de cisaillement')}
      </div>
      ${b.pre ? `<div class="fields">
        ${field('Catégorie', sel('bolt.cat', [['C', 'C — non-glissement à l\'ELU'], ['B', 'B — non-glissement à l\'ELS']], { rr: true }))}
        ${field('Surfaces de frottement', sel('bolt.surf', [['A', 'Classe A — μ = 0,5'], ['B', 'Classe B — μ = 0,4'], ['C', 'Classe C — μ = 0,3'], ['D', 'Classe D — μ = 0,2']]))}
        ${field('Trous', sel('bolt.holes', [['normal', 'Normaux — k_s = 1'], ['oversize', 'Surdimensionnés — k_s = 0,85'], ['slotShortT', 'Oblongs courts ⊥ — k_s = 0,85'], ['slotLongT', 'Oblongs longs ⊥ — k_s = 0,7']]))}
        ${b.cat === 'B' ? field('Torseur ELS / ELU', inp('bolt.kser'), '', 'Rapport appliqué aux efforts des boulons') + field('γ<sub>M3,ser</sub>', inp('gam.M3ser')) : field('γ<sub>M3</sub>', inp('gam.M3'))}
      </div>` : ''}
      ${b.pre && !(b.cls === '8.8' || b.cls === '10.9') ? '<p class="note warn">Précontrainte réservée aux classes 8.8 et 10.9.</p>' : ''}

      ${blockHead('03', 'Géométrie', "Pinces et entraxes d'un côté du joint. x : le long de la poutre depuis l'abouts ; e<sub>1,b</sub> : pince sur la poutre (côté joint), e<sub>1</sub> : pince en bout de plat.")}
      <div style="margin-bottom:16px"><button class="btn sm" data-sact="propose">Proposer une géométrie pour ce profil</button> <span class="muted" style="font-size:12.5px">plats d'aire ≥ partie éclissée, pinces 1,5·d₀, entraxes 3·d₀ — l'état « dédoublé » de chaque semelle est conservé</span></div>
      <div class="cols2">
        <div><div class="sub-title" style="margin-top:0">Boulons de semelles (identiques en haut et en bas)</div>
          <div class="fields">
            ${field('Files n<sub>1</sub> (par côté)', inp('fl.n1'))}${field('Entraxe p<sub>1</sub>', inp('fl.p1'), 'mm')}
            ${field('Pince poutre e<sub>1,b</sub>', inp('fl.e1b'), 'mm')}${field('Pince plat e<sub>1</sub>', inp('fl.e1'), 'mm')}
            ${field('Lignes par côté de l\'âme', sel('fl.n2s', [[1, '1 ligne'], [2, '2 lignes']], { rr: true }))}
            ${field('Pince w entre lignes intérieures', inp('fl.w'), 'mm', 'Entraxe de part et d\'âme')}
            ${+st.fl.n2s === 2 ? field('Entraxe p<sub>2</sub>', inp('fl.p2'), 'mm') : ''}
          </div></div>
        <div><div class="sub-title" style="margin-top:0">Âme</div>
          <div class="fields">
            ${field('Files n<sub>1</sub> (par côté)', inp('web.n1'))}${field('Entraxe p<sub>1</sub>', inp('web.p1'), 'mm')}
            ${field('Pince poutre e<sub>1,b</sub>', inp('web.e1b'), 'mm')}${field('Pince plat e<sub>1</sub>', inp('web.e1'), 'mm')}
            ${field('Rangées n<sub>2</sub>', inp('web.n2'))}${field('Entraxe p<sub>2</sub>', inp('web.p2'), 'mm')}
            ${field('Hauteur des plats h<sub>p</sub>', inp('web.hp'), 'mm')}${field('Épaisseur t<sub>p</sub> (chacun)', inp('web.tp'), 'mm')}
          </div></div>
      </div>
      <div class="cols2" style="margin-top:6px">${plateBlock('top', 'Plats de la semelle supérieure')}${plateBlock('bot', 'Plats de la semelle inférieure')}</div>
      <div class="sub-title" style="margin-top:28px">Vues de l'assemblage et notations</div>
      <div id="sGeoFigs"></div>
      <div class="tbl-wrap" style="margin-top:10px"><table class="tbl compact" style="max-width:900px"><tbody>
        <tr><td><b>g</b></td><td>jeu entre les abouts des deux poutres</td><td><b>e<sub>1,b</sub></b></td><td>pince longitudinale sur la poutre : de l'about à la 1<sup>re</sup> file de boulons</td></tr>
        <tr><td><b>p<sub>1</sub></b></td><td>entraxe des files, parallèle à la poutre</td><td><b>e<sub>1</sub></b></td><td>pince longitudinale sur le plat : de la dernière file au bout du plat</td></tr>
        <tr><td><b>w</b></td><td>entraxe des lignes de semelle de part et d'autre de l'âme</td><td><b>p<sub>2</sub></b></td><td>entraxe transversal (2<sup>e</sup> ligne de semelle, rangées d'âme)</td></tr>
        <tr><td><b>e<sub>2</sub></b></td><td>pince transversale : de la ligne extrême au bord du plat</td><td><b>b<sub>o</sub>, t<sub>o</sub></b></td><td>largeur et épaisseur du plat extérieur de semelle</td></tr>
        <tr><td><b>b<sub>i</sub>, t<sub>i</sub></b></td><td>largeur et épaisseur de chaque plat intérieur (posé contre le congé)</td><td><b>h<sub>p</sub>, t<sub>p</sub></b></td><td>hauteur et épaisseur de chaque plat d'âme</td></tr>
      </tbody></table></div>

      ${blockHead('04', 'Torseurs ELU', "Un torseur par combinaison à vérifier (M<sub>max</sub>, V<sub>max</sub>, N<sub>max</sub> concomitants…), à la section du joint. N &gt; 0 : compression ; M<sub>y</sub> &gt; 0 comprime la semelle supérieure ; M<sub>z</sub> &gt; 0 comprime le côté +y ; M<sub>x</sub> : torsion. Un bloc copié depuis Excel ou RFEM se colle dans le tableau.")}
      <div class="tq-grid">
        <div id="sTqFields">${tqFields()}</div>
        <div id="sTq3D" class="fig"></div>
        <div class="fig">${DR.convention()}</div>
      </div>
      <div class="sub-title" style="margin-top:22px">Tous les torseurs <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:500">· l'enveloppe est vérifiée</span></div>
      <div class="tbl-wrap"><table class="grid" id="sLoads">
        <thead><tr><th class="rowh">Torseur</th>${C.COMPS.map((x) => `<th>${sub(x.label)} [${x.unit}]</th>`).join('')}<th>Taux</th><th>Affiché</th><th></th></tr></thead>
        <tbody>${st.loads.map((L, i) => `<tr><td><input type="text" data-sp="loads.${i}.name" value="${esc(L.name)}" style="min-width:150px;text-align:left"></td>
          ${C.COMPS.map((x, j) => `<td><input type="number" step="any" data-sp="loads.${i}.${x.id}" data-lr="${i}" data-lc="${j}" value="${esc(L[x.id])}"></td>`).join('')}
          <td class="ro" id="sRate${i}"></td>
          <td style="text-align:center"><input type="radio" name="sCur" data-sact="cur" data-i="${i}"${(+st.cur || 0) === i ? ' checked' : ''}></td>
          <td>${st.loads.length > 1 ? `<button class="btn sm ghost" data-sact="delLoad" data-i="${i}" title="Supprimer">✕</button>` : ''}</td></tr>`).join('')}</tbody>
      </table></div>
      <div style="display:flex;gap:8px;margin:8px 0 14px;flex-wrap:wrap"><button class="btn sm" data-sact="addLoad">+ Ajouter un torseur</button></div>
      <p class="note">Répartition : N au prorata des aires (semelles b·t<sub>f</sub>, âme le reste) ; M<sub>y</sub> par un couple dans les semelles (bras h − t<sub>f</sub>) et, au choix, la part d'inertie de l'âme dans les plats d'âme ; V<sub>z</sub> par l'âme ; V<sub>y</sub> et M<sub>z</sub> pour moitié par chaque semelle ; M<sub>x</sub> par un couple d'efforts transversaux opposés dans les semelles (torsion gênée, sécuritaire pour les boulons de semelles). Chaque groupe reprend en plus le moment de l'excentrement entre l'axe du joint et son centre.</p>

      ${blockHead('05', 'Cheminement des efforts', "Choisir une composante du torseur, ou le torseur complet : répartition entre les plats au droit du joint, puis efforts dans chaque boulon (vecteurs à l'échelle de chaque groupe, ou à une échelle commune pour comparer les groupes).")}
      <div class="chips" id="sCurChips" style="margin-bottom:10px"></div>
      <div class="chips" id="sViews">${C.COMPS.map((x) => [x.id, sub(x.label)]).concat([['tot', 'Torseur complet']]).map(([k, l]) => `<button type="button" class="chip${view === k ? ' on' : ''}" data-sact="view" data-v="${k}">${l}</button>`).join('')}</div>
      <div id="sFlow" style="margin-top:16px"></div>

      ${blockHead('06', 'Vérifications', "NF EN 1993-1-8 § 3 (boulons, pinces, rupture en bloc) et NF EN 1993-1-1 § 6.2 (plats et section affaiblie de la poutre).")}
      <div id="sResults"></div>

      ${blockHead('07', 'Rigidité et résistance', "Raideur rotationnelle initiale par la méthode des composantes (EN 1993-1-8 § 6.3) et classification (§ 5.2.2) : l'éclissage peut-il être considéré comme un encastrement (continuité) ?")}
      <div class="fields">
        ${field('Portée de la poutre L<sub>b</sub>', inp('rig.Lb'), 'm', 'Pour la limite k<sub>b</sub>·E·I<sub>b</sub>/L<sub>b</sub>')}
        ${field('Ossature', sel('rig.frame', [['braced', 'Contreventée — k_b = 8'], ['unbraced', 'Non contreventée — k_b = 25']]))}
      </div>
      <div id="sRig"></div>
    </div>`;
    refresh();
  }

  function refresh() {
    R = C.compute(st); ENV = C.computeEnv(st);
    const v = $('#sVerdict');
    if (v) v.innerHTML = !R.valid ? '<span class="verdict ko">— <small>données invalides</small></span>' : `<span class="verdict ${ENV.max <= 1 ? 'ok' : 'ko'}">${pct(ENV.max)} <small>${ENV.max <= 1 ? 'vérifié*' : 'non vérifié'}</small></span>`;
    ENV.perLoad.forEach((m, i) => { const c = $('#sRate' + i); if (c) c.innerHTML = `<b style="color:${m > 1 ? 'var(--c-red)' : 'inherit'}">${pct(m)}</b>${i === ENV.govIdx ? ' ◂' : ''}`; });
    const cc = $('#sCurChips');
    if (cc) cc.innerHTML = '<span class="muted" style="font-size:12.5px;align-self:center;margin-right:10px">Torseur affiché :</span>' + st.loads.map((L, i) => `<button type="button" class="chip${(+st.cur || 0) === i ? ' on' : ''}" data-sact="cur" data-i="${i}">${esc(L.name || 'Torseur ' + (i + 1))}${i === ENV.govIdx ? ' · dimensionnant' : ''}</button>`).join('');
    const dd = $('#sDirty'); if (dd) dd.textContent = dirty ? 'modifié · non enregistré' : '';
    const cn = $('#sCrumb'); if (cn) cn.textContent = st.name || 'Sans nom';
    if (!R.valid) { ['#sFlow', '#sResults'].forEach((x) => { const e = $(x); if (e) e.innerHTML = R.warnings.map((w) => `<p class="note warn">${sub(w)}</p>`).join(''); }); return; }
    const S = R.S, bo = R.bolt;
    const si = $('#sSecInfo');
    if (si) si.innerHTML = `<b style="color:var(--ink)">${esc(S.name)}</b> — h = ${fmtG(S.h, 1)}, b = ${fmtG(S.b, 1)}, t<sub>w</sub> = ${fmtG(S.tw, 1)}, t<sub>f</sub> = ${fmtG(S.tf, 1)}, r = ${fmtG(S.r, 1)} mm<br>
      f<sub>y</sub> / f<sub>u</sub> poutre : ${R.mat.fy} / ${R.mat.fu} MPa · A = ${fmt(S.A / 100, 1)} cm² · I<sub>y</sub> = ${fmtG(S.Iy / 1e4, 0)} cm⁴<br>
      Part de M<sub>y</sub> reprise par l'âme : ${fmt(R.dist.eta * 100, 1)} % · bras de levier des semelles h − t<sub>f</sub> = ${fmtG(R.dist.hf, 1)} mm<br>
      Boulons M${bo.d} ${bo.cls}${R.pre ? ' précontraints, catégorie ' + R.cat : ' — catégorie A'} : d<sub>0</sub> = ${bo.d0} mm, A<sub>s</sub> = ${bo.As} mm², F<sub>v,Rd</sub> = ${kN(bo.FvPlane)} kN par plan${R.pre ? `, F<sub>p,C</sub> = ${kN(bo.FpC)} kN` : ''}`;
    const gf = $('#sGeoFigs'); if (gf) gf.innerHTML = geoFigs(R);
    const t3 = $('#sTq3D'); if (t3) t3.innerHTML = DR.torseur3D(R, curLoad());
    renderFlow();
    renderResults();
    renderRig();
  }

  function renderRig() {
    const box = $('#sRig'); if (!box || !ENV || !ENV.rig) return;
    const g = ENV.rig, E = ENV;
    const Sj = g.Sj / 1e9, rl = g.rigidLim / 1e9, pl = g.pinLim / 1e9;
    const pos = (v) => Math.max(0, Math.min(100, (Math.log10(v) - Math.log10(pl / 4)) / (Math.log10(rl * 4) - Math.log10(pl / 4)) * 100));
    const scale = `<div style="position:relative;height:46px;margin:18px 0 6px;max-width:760px">
      <div style="position:absolute;left:0;right:0;top:16px;height:10px;background:linear-gradient(90deg,#f3d6d4 0%,#f3d6d4 ${pos(pl)}%,#f6ead2 ${pos(pl)}%,#f6ead2 ${pos(rl)}%,#d8ecdf ${pos(rl)}%,#d8ecdf 100%)"></div>
      <div style="position:absolute;left:${pos(pl)}%;top:8px;height:26px;border-left:1px solid var(--ink)"></div><div style="position:absolute;left:${pos(pl)}%;top:36px;font-size:11px;transform:translateX(-50%)">0,5·EI/L</div>
      <div style="position:absolute;left:${pos(rl)}%;top:8px;height:26px;border-left:1px solid var(--ink)"></div><div style="position:absolute;left:${pos(rl)}%;top:36px;font-size:11px;transform:translateX(-50%)">${g.kb}·EI/L</div>
      <div style="position:absolute;left:${pos(Sj)}%;top:0;transform:translateX(-50%);font-size:11px;font-weight:800">▼ S<sub>j,ini</sub></div>
      <div style="position:absolute;left:2px;top:-14px;font-size:11px;color:var(--muted)">articulé</div><div style="position:absolute;left:50%;top:-14px;font-size:11px;color:var(--muted);transform:translateX(-50%)">semi-rigide</div><div style="position:absolute;right:2px;top:-14px;font-size:11px;color:var(--muted)">rigide</div>
    </div>`;
    const P = g.parts;
    const kr = (x) => (Number.isFinite(x) ? fmt(x, 2) : '∞');
    const full = E.MjRd != null && E.MjRd >= E.Mpl;
    box.innerHTML = `<div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="kpi ${g.cls === 'rigide' ? 'hero' : ''}"><b>Rigidité initiale</b><span>${fmt(Sj, 1)}</span><small>MN·m/rad — assemblage <b>${g.cls}</b> (5.2.2.5)</small></div>
        <div class="kpi"><b>Limite « rigide »</b><span>${fmt(rl, 1)}</span><small>k<sub>b</sub>·E·I<sub>b</sub>/L<sub>b</sub>, k<sub>b</sub> = ${g.kb} (${g.kb === 8 ? 'ossature contreventée' : 'non contreventée'})</small></div>
        <div class="kpi ${full ? 'hero' : ''}"><b>Résistance M<sub>j,Rd</sub></b><span>${E.MjRd != null ? fmt(E.MjRd, 0) : '—'}</span><small>kN·m pour M<sub>y</sub> seul · M<sub>pl,Rd</sub> poutre = ${fmt(E.Mpl, 0)} kN·m → ${full ? 'pleine résistance' : 'résistance partielle'}${E.govM ? ' · gouverné par : ' + sub(E.govM.label.replace(/\s*\(.*$/, '')) : ''}</small></div>
      </div>
      ${scale}
      <div class="tbl-wrap" style="margin-top:14px"><table class="tbl compact" style="max-width:900px"><thead><tr><th>Composante (par semelle, un côté)</th><th class="num">Semelle sup.</th><th class="num">Semelle inf.</th></tr></thead><tbody>
        <tr><td>k<sub>11</sub> boulon en cisaillement (×${R.groups.top.nPl === R.groups.bot.nPl ? R.groups.top.nPl : '1/2'} plans) [mm]</td><td class="num">${kr(P.top.k11)}</td><td class="num">${kr(P.bot.k11)}</td></tr>
        <tr><td>k<sub>12</sub> pression diamétrale — semelle de poutre [mm]</td><td class="num">${kr(P.top.kf)}</td><td class="num">${kr(P.bot.kf)}</td></tr>
        <tr><td>k<sub>12</sub> pression diamétrale — plats [mm]</td><td class="num">${kr(P.top.kp)}</td><td class="num">${kr(P.bot.kp)}</td></tr>
        <tr><td>Groupe de ${P.top.nb} boulons, un côté du joint [mm]</td><td class="num">${kr(P.top.kSide)}</td><td class="num">${kr(P.bot.kSide)}</td></tr>
        <tr><td>Plats entre premières files, A/L (L = ${fmt(P.top.Lpl, 0)} mm) [mm]</td><td class="num">${kr(P.top.kPlate)}</td><td class="num">${kr(P.bot.kPlate)}</td></tr>
        <tr><td><b>Raideur équivalente de la semelle</b> (2 côtés + plats) [mm]</td><td class="num"><b>${kr(P.top.keq)}</b></td><td class="num"><b>${kr(P.bot.keq)}</b></td></tr>
      </tbody></table></div>
      <p class="note">S<sub>j,ini</sub> = E·z²/Σ(1/k<sub>i</sub>) (6.27, μ = 1) avec z = h − t<sub>f</sub> = ${fmt(g.z, 1)} mm ; coefficients k<sub>11</sub> = 16·d²·f<sub>ub</sub>/(E·d<sub>M16</sub>) et k<sub>12</sub> = 24·k<sub>b</sub>·k<sub>t</sub>·d·f<sub>u</sub>/E du tableau 6.11, en série des deux côtés du joint ; l'âme est négligée (sécuritaire). ${g.preload ? 'Boulons précontraints dimensionnés au non-glissement : k<sub>11</sub> = k<sub>12</sub> = ∞ (tableau 6.11).' : 'En catégorie A, le glissement dans le jeu des trous n\'est pas compris dans S<sub>j,ini</sub> : pour un éclissage de continuité, des boulons précontraints (catégorie B ou C) ou ajustés évitent cette rotation supplémentaire.'} Classification selon 5.2.2.5 pour une poutre de portée L<sub>b</sub> = ${fmt(g.Lb / 1000, 2)} m. M<sub>j,Rd</sub> : moment M<sub>y</sub> seul qui porte le critère le plus sollicité à 100 %.</p>`;
  }

  function renderFlow() {
    const box = $('#sFlow'); if (!box) return;
    const sc = common ? scaleOf(view) : null;
    const panels = ['top', 'web', 'bot'].map((g) => groupPanel(g, view, sc));
    const scaleChips = [[false, 'Vecteurs à l\'échelle de chaque groupe'], [true, 'Échelle commune aux 3 groupes']].map(([v, l]) => `<button type="button" class="chip${common === v ? ' on' : ''}" data-sact="scale" data-v="${v}">${l}</button>`).join('');
    const per = R.dist.per, tot = R.dist.tot;
    const cell = (q, k, unit) => `<td class="num">${Math.abs(q[k]) < 1 ? '·' : unit === 'm' ? kNm(q[k]) : kN(q[k])}</td>`;
    const row = (lbl, val, L, on) => `<tr${on ? ' class="gov"' : ''}><td>${lbl}</td><td class="num">${val}</td>${['top', 'web', 'bot'].map((g) => cell(L[g], 'Fx') + cell(L[g], 'Ft') + cell(L[g], 'M', 'm')).join('')}</tr>`;
    // contribution des composantes au boulon le plus chargé de chaque groupe
    const contrib = C.COMPS.map((c) => `<tr${view === c.id ? ' class="gov"' : ''}><td>${sub(c.label)}</td>${['top', 'web', 'bot'].map((g) => { const G = R.groups[g], f = G.loads[c.id][G.imax]; return `<td class="num">${f.f < 1 ? '·' : kN(f.fx)}</td><td class="num">${f.f < 1 ? '·' : kN(f.ft)}</td>`; }).join('')}</tr>`).join('');
    const keepOpen = !box.querySelector('details') || box.querySelector('details').open;
    box.innerHTML = `<details class="fold" style="margin-top:0;margin-bottom:18px"${keepOpen ? ' open' : ''}><summary>Géométrie cotée de l'assemblage</summary>${geoFigs(R)}</details>
      <div style="display:grid;gap:22px">
        <div style="max-width:760px">${endView(view)}</div>
        <div>
          <div class="sub-title" style="margin-top:0">Répartition entre les plats [kN, kN·m]</div>
          <div class="tbl-wrap"><table class="tbl compact"><thead>
            <tr><th colspan="2"></th><th colspan="3" style="text-align:center">Semelle sup.</th><th colspan="3" style="text-align:center">Âme</th><th colspan="3" style="text-align:center">Semelle inf.</th></tr>
            <tr><th>Comp.</th><th class="num">Valeur</th>${['F<sub>x</sub>', 'F<sub>y</sub>', 'M<sub>z</sub>', 'F<sub>x</sub>', 'F<sub>z</sub>', 'M<sub>y</sub>', 'F<sub>x</sub>', 'F<sub>y</sub>', 'M<sub>z</sub>'].map((x) => `<th class="num">${x}</th>`).join('')}</tr></thead><tbody>
            ${C.COMPS.map((c) => row(sub(c.label), fmtG(C.num(curLoad()[c.id]), 2) + ' ' + c.unit, per[c.id], view === c.id)).join('')}
            ${row('<b>Total</b>', '', tot, view === 'tot')}
          </tbody></table></div>
          <p class="note">F<sub>x</sub> &gt; 0 : compression transmise par les plats. M : moment dans le plan du groupe, à l'axe du joint (avant ajout de l'excentrement).</p>
          <div class="sub-title">Boulon le plus chargé — contribution de chaque composante [kN]</div>
          <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th></th><th colspan="2" style="text-align:center">Semelle sup.</th><th colspan="2" style="text-align:center">Âme</th><th colspan="2" style="text-align:center">Semelle inf.</th></tr>
            <tr><th>Comp.</th>${['f<sub>x</sub>', 'f<sub>y</sub>', 'f<sub>x</sub>', 'f<sub>z</sub>', 'f<sub>x</sub>', 'f<sub>y</sub>'].map((x) => `<th class="num">${x}</th>`).join('')}</tr></thead><tbody>
            ${contrib}
            <tr${view === 'tot' ? ' class="gov"' : ''}><td><b>Résultante</b></td>${['top', 'web', 'bot'].map((g) => { const f = R.groups[g].tot[R.groups[g].imax]; return `<td class="num" colspan="2"><b>${kN(f.f)} kN</b></td>`; }).join('')}</tr>
          </tbody></table></div>
        </div>
      </div>
      <div class="chips" style="margin-top:22px">${scaleChips}</div>
      <div style="margin-top:12px;display:grid;gap:10px;max-width:900px">${panels.map((p) => p.svg).join('')}</div>
      <p class="note">Effort par boulon : f = F/n + M<sub>c</sub>·r/Σr² (répartition élastique), avec M<sub>c</sub> = moment à l'axe du joint + excentrement de l'effort transversal jusqu'au centre du groupe. Vecteurs : effort exercé par le plat sur le boulon ; en rouge le boulon le plus sollicité pour la vue choisie. Boulons pâles à gauche : côté symétrique, non représenté.</p>`;
  }

  function renderResults() {
    const box = $('#sResults'); if (!box) return;
    const cats = { bolt: (c) => /^(v|s|b_)/.test(c.id) && !/^b_beam/.test(c.id), plate: (c) => /^p/.test(c.id), beam: (c) => /^(b_beam|bbt|bnet)/.test(c.id) };
    const E = ENV, multi = st.loads.length > 1;
    const mx = (f) => E.rows.filter(f).reduce((a, c) => (c.r > a.r ? c : a), { r: 0, label: '' });
    const kpi = (t, o) => `<div class="kpi${o.r > 1 ? ' bad' : ''}"><b>${t}</b><span>${pct(o.r)}</span><small>${sub((o.label || '—').replace(/\s*\(.*$/, ''))}${multi && o.name ? ' · ' + esc(o.name) : ''}</small></div>`;
    const ok = E.max <= 1;
    const rows = (g) => E.rows.filter((c) => c.grp === g).map((c) => `<tr${E.gov === c ? ' class="gov"' : ''}><td>${sub(c.label)}${c.note ? `<div class="f" style="font-size:11px">${sub(c.note)}</div>` : ''}</td><td class="f">${c.ref}</td>${multi ? `<td class="f">${esc(c.name)}</td>` : ''}<td class="num">${c.ratioOnly ? '—' : kN(c.Ed)}</td><td class="num">${c.ratioOnly ? '—' : kN(c.Rd)}</td><td class="num"><span class="ratio">${pct(c.r)}</span></td><td style="width:100px">${bar(c.r)}</td><td>${pill(c.r)}</td></tr>`).join('');
    const plast = ['top', 'web', 'bot'].map((g) => `${C.GROUPS.find((x) => x.id === g).label.toLowerCase()} : ${R.groups[g].plast ? 'oui' : 'non'}`).join(' ; ');
    const warns = [...new Set(E.runs.flatMap((r) => r.warnings))];
    box.innerHTML = `${warns.map((w) => `<p class="note warn">${sub(w)}</p>`).join('')}
      ${(R.info || []).map((w) => `<p class="note">${sub(w)}</p>`).join('')}
      <div class="kpis">
        <div class="kpi ${ok ? 'hero' : 'bad'}"><b>Taux maximal${multi ? ' (enveloppe)' : ''}</b><span>${pct(E.max)}</span><small>${ok ? 'Vérifié pour les critères traités*' : 'Assemblage non vérifié'}${multi ? ' · ' + esc(st.loads[E.govIdx].name) : ''}</small></div>
        ${kpi('Boulons', mx(cats.bolt))}${kpi('Plats', mx(cats.plate))}${kpi('Poutre au droit du joint', mx(cats.beam))}
        <div class="kpi"><b>Boulons</b><span>${R.geo.fl.pts.length * 2 + R.geo.web.pts.length}</span><small>par côté : ${R.geo.fl.pts.length} × 2 semelles + ${R.geo.web.pts.length} âme · M${R.bolt.d} ${R.bolt.cls}${R.pre ? ' HR' : ''}</small></div>
      </div>
      ${(() => {
        const pr = partRates(E.rows), rates = Object.fromEntries(Object.entries(pr).map(([k, v]) => [k, v.r]));
        return `<div class="fig-grid" style="margin-top:18px;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)">
          <div class="fig">${DR.rateMap(R, rates)}</div>
          <div><div class="sub-title" style="margin-top:4px">Taux par pièce</div><div class="rate-legend" style="grid-template-columns:1fr">
            ${PARTS.map(([id]) => `<div><i style="background:${DR.rateCol(pr[id].r)}"></i><span>${pr[id].label}<br><small class="muted">${sub((pr[id].gov.label || '—').replace(/\s*\(.*$/, ''))}</small></span><b>${pct(pr[id].r)}</b></div>`).join('')}
          </div></div></div>`;
      })()}
      <p class="note">* Critères traités : boulons (cisaillement, glissement, pression diamétrale par pli), plats (traction, compression, flexion dans le plan, cisaillement, rupture en bloc), poutre affaiblie (section nette, rupture en bloc). Hors champ : transmission par contact des abouts, voilement local, fatigue, résistance de la poutre hors du joint (onglet Vérification).${multi ? ' Chaque ligne donne le torseur le plus défavorable pour le critère (enveloppe).' : ''}</p>
      <p class="note">Répartition élastique entre boulons retenue (3.12 (2), toujours admise). Répartition plastique admissible au sens de 3.12 (3) — catégorie C, ou F<sub>v,Rd</sub> &gt; F<sub>b,Rd</sub> : ${plast}.</p>
      ${['top', 'web', 'bot'].map((g) => `<div class="sub-title" style="margin-top:26px">${C.GROUPS.find((x) => x.id === g).label} <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:500">· boulon le plus chargé ${kN(Math.max(...E.runs.map((r) => r.groups[g].tot[r.groups[g].imax].f)))} kN</span></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Critère</th><th>Réf. EC3</th>${multi ? '<th>Torseur</th>' : ''}<th class="num">E<sub>d</sub> [kN]</th><th class="num">R<sub>d</sub> [kN]</th><th class="num">Taux</th><th></th><th></th></tr></thead><tbody>${rows(g)}</tbody></table></div>`).join('')}`;
  }

  // ======================================================================
  //  FICHE NDC
  // ======================================================================
  function page(state, project, idx, total, opts) {
    const keep = st, keepR = R; st = C.upgrade(JSON.parse(JSON.stringify(state))); const E = C.computeEnv(st); R = C.compute(st, E.govIdx); const multi = st.loads.length > 1; const gName = esc(st.loads[E.govIdx].name || '');
    try {
      if (!R.valid) return `<section class="rp-page"><p>${esc(state.name)} : données invalides.</p></section>`;
      const S = R.S, G = R.groups, bo = R.bolt;
      const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      const head = (pg) => `<header class="rp-head"><div class="l"><b>${esc(project || 'Note de calcul')}</b>Vérification d'assemblage acier — NF EN 1993-1-8${opts && opts.ref ? ' · ' + esc(opts.ref) : ''}</div>
        <div class="r">${!opts || opts.logo ? '<div class="logo-s">tracés</div>' : ''}${esc(state.name)} · ${date} · ${pg}</div></header>`;
      let n = 0; const H2 = (t) => `<h2><span class="n">${++n}</span>${t}</h2>`;
      const kv = (a, b) => `<div><span>${a}</span><b>${b}</b></div>`;
      const pl = (k) => { const P = G[k].plate; return `${fmtG(P.bo, 0)} × ${fmtG(P.to, 1)}${G[k].dbl ? ` + 2 × ${fmtG(P.bi, 0)} × ${fmtG(P.ti, 1)}` : ''} mm`; };
      const L = R.L;
      const distRow = (lbl, Q) => `<tr><td>${lbl}</td>${['top', 'web', 'bot'].map((g) => `<td class="num">${kN(Q[g].Fx)}</td><td class="num">${kN(Q[g].Ft)}</td><td class="num">${kNm(Q[g].M)}</td>`).join('')}</tr>`;
      const sc = scaleOf('tot');
      const chkRows = E.rows.map((c) => `<tr${E.gov === c ? ' class="gov"' : ''}><td>${C.GROUPS.find((x) => x.id === c.grp).label}</td><td>${sub(c.label)}</td><td>${c.ref}</td>${multi ? `<td>${esc(c.name)}</td>` : ''}<td class="num">${c.ratioOnly ? '—' : kN(c.Ed)}</td><td class="num">${c.ratioOnly ? '—' : kN(c.Rd)}</td><td class="num">${pct(c.r)}</td><td>${c.r <= 1 ? '<span class="rp-ok">OK</span>' : '<span class="rp-ko">Non vérifié</span>'}</td></tr>`).join('');
      const p1 = `<section class="rp-page">${head('p. 1')}
        <div class="rp-title"><h1>${esc(state.name || 'Éclisse')} — éclisse de ${esc(S.name)}${total > 1 ? ` (${idx + 1}/${total})` : ''}</h1>
        <p>Couvre-joints boulonnés de semelles et d'âme · boulons M${bo.d} ${bo.cls}${R.pre ? ` précontraints, catégorie ${R.cat}` : ', catégorie A'} · NF EN 1993-1-8 et NF EN 1993-1-1 avec annexes nationales françaises</p></div>
        ${H2('Hypothèses')}
        <div class="rp-kv">
          ${kv('Poutre', `${esc(S.name)} ${esc(state.grade)} (f<sub>y</sub> = ${R.mat.fy}, f<sub>u</sub> = ${R.mat.fu} MPa)`)}${kv('Plats', `${esc(state.plateGrade)}`)}
          ${kv('Semelle sup.', pl('top'))}${kv('Semelle inf.', pl('bot'))}
          ${kv('Plats d\'âme', `2 × ${fmtG(G.web.plate.hp, 0)} × ${fmtG(G.web.plate.tp, 1)} mm`)}${kv('Jeu entre abouts', fmtG(R.g, 1) + ' mm')}
          ${kv('Boulons de semelle (par côté)', `${R.geo.fl.n1} files × ${R.geo.fl.n2} lignes ; p₁ = ${R.geo.fl.p1}, w = ${R.geo.fl.w}${R.geo.fl.n2s > 1 ? ', p₂ = ' + R.geo.fl.p2 : ''} ; e₁ = ${R.geo.fl.e1}, e₁,b = ${R.geo.fl.e1b} mm`)}
          ${kv('Boulons d\'âme (par côté)', `${R.geo.web.n1} files × ${R.geo.web.n2} rangées ; p₁ = ${R.geo.web.p1}, p₂ = ${R.geo.web.p2} ; e₁ = ${R.geo.web.e1}, e₁,b = ${R.geo.web.e1b} mm`)}
          ${kv('Boulon', `d₀ = ${bo.d0} mm, A<sub>s</sub> = ${bo.As} mm², F<sub>v,Rd</sub> = ${kN(bo.FvPlane)} kN/plan${bo.threads ? ' (filetage dans le plan)' : ''}`)}
          ${kv('Coefficients', `γ<sub>M0</sub> = ${fmt(R.gam.M0, 2)}, γ<sub>M2</sub> = ${fmt(R.gam.M2, 2)}${R.pre ? `, μ = ${fmt(bo.mu, 1)}, k<sub>s</sub> = ${fmt(bo.ks, 2)}, F<sub>p,C</sub> = ${kN(bo.FpC)} kN` : ''}`)}
        </div>
        ${H2(multi ? 'Torseurs ELU au droit du joint' : 'Torseur ELU au droit du joint')}
        <table><thead><tr><th>Torseur</th>${C.COMPS.map((c) => `<th class="num">${sub(c.label)} [${c.unit}]</th>`).join('')}<th class="num">Taux</th></tr></thead><tbody>${st.loads.map((L, i) => `<tr${i === E.govIdx ? ' class="gov"' : ''}><td>${esc(L.name)}</td>${C.COMPS.map((c) => `<td class="num">${fmtG(C.num(L[c.id]), 2)}</td>`).join('')}<td class="num">${pct(E.perLoad[i])}</td></tr>`).join('')}</tbody></table>
        ${H2('Répartition entre les plats' + (multi ? ' — torseur dimensionnant « ' + gName + ' »' : ''))}
        <div class="rp-fig">${endView('tot', 520, 300)}</div>
        <table><thead><tr><th></th><th colspan="3">Semelle sup.</th><th colspan="3">Âme</th><th colspan="3">Semelle inf.</th></tr>
          <tr><th>[kN, kN·m]</th>${['F<sub>x</sub>', 'F<sub>y</sub>', 'M<sub>z</sub>', 'F<sub>x</sub>', 'F<sub>z</sub>', 'M<sub>y</sub>', 'F<sub>x</sub>', 'F<sub>y</sub>', 'M<sub>z</sub>'].map((x) => `<th class="num">${x}</th>`).join('')}</tr></thead><tbody>
          ${C.COMPS.map((c) => distRow(sub(c.label), R.dist.per[c.id])).join('')}<tr class="gov"><td>Total</td>${['top', 'web', 'bot'].map((g) => `<td class="num">${kN(R.dist.tot[g].Fx)}</td><td class="num">${kN(R.dist.tot[g].Ft)}</td><td class="num">${kNm(R.dist.tot[g].M)}</td>`).join('')}</tr>
        </tbody></table>
        <p style="font-size:7.6pt;color:#555">N au prorata des aires ; M<sub>y</sub> : couple dans les semelles (bras ${fmtG(R.dist.hf, 1)} mm)${R.dist.eta > 0 ? `, part d'inertie de l'âme ${fmt(R.dist.eta * 100, 1)} %` : ', âme non sollicitée'} ; V<sub>z</sub> par l'âme ; V<sub>y</sub>, M<sub>z</sub> pour moitié par semelle ; M<sub>x</sub> par un couple transversal dans les semelles. F<sub>x</sub> &gt; 0 : compression.</p>
      </section>`;
      const p2 = `<section class="rp-page">${head('p. 2')}
        ${H2('Efforts dans les boulons — ' + (multi ? 'torseur « ' + gName + ' »' : 'torseur complet'))}
        ${['top', 'web', 'bot'].map((g) => groupPanel(g, 'tot', sc, 560, 200).svg).join('')}
        <p style="font-size:7.6pt;color:#555">Répartition élastique f = F/n + M<sub>c</sub>·r/Σr², M<sub>c</sub> incluant l'excentrement jusqu'au centre du groupe. Boulon le plus chargé : semelle sup. ${kN(G.top.tot[G.top.imax].f)} kN, âme ${kN(G.web.tot[G.web.imax].f)} kN, semelle inf. ${kN(G.bot.tot[G.bot.imax].f)} kN.</p>
      </section>`;
      const p3 = `<section class="rp-page">${head('p. 3')}
        ${H2('Vérifications')}
        <table><thead><tr><th>Partie</th><th>Critère</th><th>Réf. EC3</th>${multi ? '<th>Torseur</th>' : ''}<th class="num">E<sub>d</sub> [kN]</th><th class="num">R<sub>d</sub> [kN]</th><th class="num">Taux</th><th>Statut</th></tr></thead><tbody>${chkRows}</tbody></table>
        ${(() => { const w = [...new Set(E.runs.flatMap((r) => r.warnings))].concat(R.info || []); return w.length ? `<p style="font-size:7.8pt"><b>Remarques :</b> ${w.map(sub).join(' ')}</p>` : ''; })()}
        <div class="rp-concl"><span>Conclusion — éclisse de ${esc(S.name)}, boulons M${bo.d} ${bo.cls}${R.pre ? ' HR' : ''}</span><b class="${E.max <= 1 ? 'rp-ok' : 'rp-ko'}">${E.max <= 1 ? 'Vérifiée' : 'Non vérifiée'} — taux max. ${pct(E.max)}${multi ? ' (' + gName + ')' : ''}</b></div>
        <p style="font-size:7.4pt;color:#555;margin-top:5pt">Critères couverts : NF EN 1993-1-8 § 3.5 à 3.10 (pinces, cisaillement, pression diamétrale par pli en interaction vectorielle, glissement, joints longs, rupture en bloc), NF EN 1993-1-1 § 6.2 (plats, section nette). Répartition élastique entre boulons (3.12 (2)). Pression diamétrale : k₁ et α<sub>b</sub> pris au plus défavorable (boulons d'extrémité et intérieurs confondus)${multi ? ' ; chaque critère est donné pour le torseur le plus défavorable' : ''}. Non couverts : transmission par contact des abouts, fatigue, résistance de la poutre hors du joint.</p>
      </section>`;
      const pr = partRates(E.rows), rates = Object.fromEntries(Object.entries(pr).map(([k, v]) => [k, v.r]));
      const pG = `<section class="rp-page">${head('géométrie')}
        ${H2('Géométrie de l\'assemblage')}
        <div style="margin-bottom:4pt">${DR.elevation(R, 620, 330)}</div>
        <table style="border:0"><tr><td style="border:0;padding:0 4pt 0 0;width:50%">${DR.plan(R, 'top', 520, 290)}</td><td style="border:0;padding:0;width:50%">${DR.plan(R, 'bot', 520, 290)}</td></tr>
        <tr><td style="border:0;padding:0 4pt 0 0">${DR.section(R, 440, 340)}</td><td style="border:0;padding:0">${DR.iso(R, { W: 520, H: 330 })}</td></tr></table>
        <p style="font-size:7.4pt;color:#555">g : jeu entre abouts ; e<sub>1,b</sub> : pince sur la poutre ; e<sub>1</sub> : pince en bout de plat ; p<sub>1</sub>, p<sub>2</sub> : entraxes ; w : entraxe des lignes de part et d'autre de l'âme ; e<sub>2</sub> : pince transversale ; b<sub>o</sub>×t<sub>o</sub>, b<sub>i</sub>×t<sub>i</sub>, h<sub>p</sub>×t<sub>p</sub> : plats extérieur, intérieurs et d'âme. Cotes en mm.</p>
      </section>`;
      const rg = E.rig;
      const pR = `<section class="rp-page">${head('synthèse')}
        ${H2('Taux d\'utilisation par pièce')}
        <table style="border:0"><tr><td style="border:0;padding:0;width:58%">${DR.rateMap(R, rates, 560, 360)}</td><td style="border:0;padding:0 0 0 6pt">
          <table><thead><tr><th>Pièce</th><th class="num">Taux</th></tr></thead><tbody>${PARTS.map(([id]) => `<tr><td><span style="display:inline-block;width:8pt;height:8pt;background:${DR.rateCol(pr[id].r)};border:.5pt solid #111;margin-right:4pt"></span>${pr[id].label}</td><td class="num">${pct(pr[id].r)}</td></tr>`).join('')}</tbody></table></td></tr></table>
        ${H2('Rigidité et résistance de l\'assemblage')}
        <div class="rp-kv">
          ${kv('S<sub>j,ini</sub> (6.27, tableau 6.11)', `${fmt(rg.Sj / 1e9, 1)} MN·m/rad`)}${kv('Classification (5.2.2.5)', `<b>${rg.cls}</b>`)}
          ${kv(`Limite rigide k<sub>b</sub>·E·I<sub>b</sub>/L<sub>b</sub> (k<sub>b</sub> = ${rg.kb}, L<sub>b</sub> = ${fmt(rg.Lb / 1000, 2)} m)`, `${fmt(rg.rigidLim / 1e9, 1)} MN·m/rad`)}${kv('Limite articulée 0,5·E·I<sub>b</sub>/L<sub>b</sub>', `${fmt(rg.pinLim / 1e9, 1)} MN·m/rad`)}
          ${kv('M<sub>j,Rd</sub> (M<sub>y</sub> seul)', E.MjRd != null ? `${fmt(E.MjRd, 0)} kN·m` : '—')}${kv('M<sub>pl,Rd</sub> de la poutre', `${fmt(E.Mpl, 0)} kN·m — ${E.MjRd != null && E.MjRd >= E.Mpl ? 'pleine résistance' : 'résistance partielle'}`)}
        </div>
        <p style="font-size:7.6pt;color:#555">S<sub>j,ini</sub> = E·z²/Σ(1/k<sub>i</sub>), z = h − t<sub>f</sub> = ${fmt(rg.z, 1)} mm ; par semelle, en série des deux côtés du joint : boulons en cisaillement k<sub>11</sub>, pression diamétrale k<sub>12</sub> sur la semelle et sur les plats, plats tendus entre premières files (A/L) ; âme négligée. ${rg.preload ? 'Boulons précontraints : k<sub>11</sub> = k<sub>12</sub> = ∞.' : 'Catégorie A : le glissement dans le jeu des trous n\'est pas inclus.'}</p>
      </section>`;
      return p1 + pG + p2 + p3 + pR;
    } finally { st = keep; R = keepR; }
  }

  // ======================================================================
  //  ÉVÉNEMENTS
  // ======================================================================
  function bind(app) {
    const onEdit = (e) => {
      const t = e.target; if (!t.dataset || !t.dataset.sp || t.closest('.modal')) return;
      if (e.type === 'input' && (t.tagName === 'SELECT' || t.type === 'checkbox')) return;
      const p = t.dataset.sp;
      let v = t.type === 'checkbox' ? t.checked : t.value;
      if (p === 'bolt.d' || p === 'fl.n2s') v = +v;
      set(p, v);
      if (p === 'sec.fam') { const l = D.CATALOG[v] || []; st.sec.name = l.length ? l[Math.floor(l.length / 2)].name : ''; }
      // champs jumeaux (saisie du torseur courant ↔ tableau de tous les torseurs)
      document.querySelectorAll(`[data-sp="${p}"]`).forEach((el) => { if (el !== t && el.type !== 'checkbox') el.value = t.value; });
      dirty = true; persist();
      if ((t.dataset.rr && e.type === 'change') || p === 'sec.fam') { const y = window.scrollY; render(app); window.scrollTo(0, y); return; }
      refresh();
    };
    app.addEventListener('input', onEdit);
    app.addEventListener('change', onEdit);
    // collage d'un bloc (Excel, RFEM) dans le tableau des torseurs : remplit vers la droite et vers le bas
    app.addEventListener('paste', (e) => {
      const t = e.target; if (!t.dataset || t.dataset.lr == null) return;
      const txt = (e.clipboardData || window.clipboardData).getData('text');
      if (!/[\t\n]/.test(txt)) return;
      e.preventDefault();
      const r0 = +t.dataset.lr, c0 = +t.dataset.lc;
      txt.replace(/\r/g, '').split('\n').filter((l) => l.trim().length).forEach((line, i) => {
        const r = r0 + i;
        while (st.loads.length <= r) st.loads.push({ name: 'ELU ' + (st.loads.length + 1), N: 0, Vy: 0, Vz: 0, Mx: 0, My: 0, Mz: 0 });
        line.split('\t').forEach((cell, j) => { const c = C.COMPS[c0 + j]; if (c) st.loads[r][c.id] = cell.trim().replace(/\s/g, '').replace(',', '.'); });
      });
      dirty = true; persist(); const y = window.scrollY; render(app); window.scrollTo(0, y);
    });
    app.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-sact]'); if (!b) return;
      const a = b.dataset.sact, y = window.scrollY;
      if (a === 'kind') { st.sec.kind = b.dataset.v; dirty = true; persist(); render(app); window.scrollTo(0, y); }
      else if (a === 'cur') { st.cur = +b.dataset.i; dirty = true; persist(); render(app); window.scrollTo(0, y); }
      else if (a === 'addLoad') { const L = curLoad(); st.loads.push(Object.assign({}, L, { name: 'ELU ' + (st.loads.length + 1) })); dirty = true; persist(); render(app); window.scrollTo(0, y); }
      else if (a === 'delLoad') { st.loads.splice(+b.dataset.i, 1); st.cur = Math.min(+st.cur || 0, st.loads.length - 1); dirty = true; persist(); render(app); window.scrollTo(0, y); }
      else if (a === 'propose') { if (C.propose(st)) { dirty = true; persist(); render(app); window.scrollTo(0, y); } }
      else if (a === 'scale') { common = b.dataset.v === 'true'; renderFlow(); }
      else if (a === 'view') { view = b.dataset.v; document.querySelectorAll('#sViews .chip').forEach((c) => c.classList.toggle('on', c.dataset.v === view)); renderFlow(); }
      else if (a === 'save' || a === 'saveas') { const ok = await A().saveItem('eclisse', st, a === 'saveas'); if (ok) { dirty = false; persist(); render(app); window.scrollTo(0, y); } }
      else if (a === 'new') {
        if (dirty && !(await A().confirmBox('Nouvelle éclisse', 'Les modifications non enregistrées seront perdues. Continuer ?'))) return;
        st = C.defaultState(); st.name = 'Nouvelle éclisse'; A().newItem('eclisse'); dirty = false; persist(); render(app);
      }
      else if (a === 'report') window.FirmitasReport.open([{ state: st, project: A().crumbK('eclisse').p ? A().crumbK('eclisse').p.name : '' }]);
    });
  }

  function load(state) { st = C.upgrade(state); dirty = false; persist(); }

  function flush(dbx) { dbx.sdraft = st; dbx.sdraftDirty = dirty; }
  window.FirmitasSplice = { init, render, bind, page, load, flush, get state() { return st; }, get dirty() { return dirty; }, summary: C.summary };
  window.FirmitasModules = window.FirmitasModules || {};
  window.FirmitasModules.eclisse = { kind: 'eclisse', route: 'eclisse', title: 'Éclisse boulonnée', short: 'éclisse', ref: 'NF EN 1993-1-8 + AN', api: window.FirmitasSplice, upgrade: C.upgrade };
})();
