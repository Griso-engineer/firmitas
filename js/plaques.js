/* ==========================================================================
   Firmitas — module « Plaques » : plaques rectangulaires sur 2, 3 ou 4 côtés (Roark, tableau 11.4)
   Interface, plan de la plaque, fiche NDC.
   ========================================================================== */
(function () {
  'use strict';
  const C = window.FirmitasPlateCalc, D = window.FIRMITAS_DATA;
  const A = () => window.FirmitasApp;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
  const fmtG = (x, d = 3) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { maximumFractionDigits: d }) : '—');
  const pct = (r) => (Number.isFinite(r) ? Math.round(r * 100) + ' %' : '∞');
  const sub = (s) => esc(s).replace(/_([A-Za-z0-9,.′]+)/g, '<sub>$1</sub>');
  const bar = (r) => `<div class="bar"><i class="${!(r <= 1) ? 'ko' : r > 0.9 ? 'hi' : ''}" style="width:${Math.min(100, (Number.isFinite(r) ? r : 1) * 100)}%"></i></div>`;
  const pill = (r) => (r == null ? '<span class="pill na">—</span>' : r <= 1 ? '<span class="pill ok">OK</span>' : '<span class="pill ko">NON</span>');
  const fV = (o) => fmt(o.v, o.unit === 'mm' ? 2 : 1);
  let st = null, dirty = false, db = null;
  const get = (p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), st);
  function set(p, v) { const ks = p.split('.'); let a = st; ks.slice(0, -1).forEach((k) => { if (a[k] == null) a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }
  const inp = (p, o = {}) => `<input type="${o.type || 'number'}" data-qp="${p}" value="${esc(get(p))}"${(o.type || 'number') === 'number' ? ' step="any"' : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>`;
  const sel = (p, opts, o = {}) => { const v = String(get(p)); return `<select data-qp="${p}"${o.rr ? ' data-rr="1"' : ''}>${opts.map((x) => `<option value="${esc(x[0])}"${String(x[0]) === v ? ' selected' : ''}>${esc(x[1])}</option>`).join('')}</select>`; };
  const chk = (p, label) => `<label class="check"><input type="checkbox" data-qp="${p}"${get(p) ? ' checked' : ''}> ${label}</label>`;
  const field = (label, control, unit, hint) => `<label class="field"><span>${label}${unit ? ` <span class="u">[${unit}]</span>` : ''}</span>${control}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  const blockHead = (n, t, p) => `<div class="block-head"><span class="num">${n}</span><h2>${t}</h2><p>${p || ''}</p></div>`;
  const grades = () => Object.keys(D.STEELS).map((x) => [x, x]);

  function init(database) { db = database; st = db.draft_plaque ? C.upgrade(db.draft_plaque) : C.defaultState(); dirty = !!db.draftDirty_plaque; }
  function flush(dbx) { dbx.draft_plaque = st; dbx.draftDirty_plaque = dirty; }
  let saveT = null;
  function persist() { clearTimeout(saveT); saveT = setTimeout(() => { flush(db); A().saveDb(); }, 250); }

  // ======================================================================
  //  DESSINS
  // ======================================================================
  // icône 52 × 30 : épais = encastré, fin = appui simple, tireté = bord libre
  function icon(e) {
    const seg = (x1, y1, x2, y2, k) => k === 'fx' ? `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#111110" stroke-width="3.2"/>` : k === 'ss' ? `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#111110" stroke-width="1.3"/>` : `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#8b9d99" stroke-width="1.1" stroke-dasharray="2.5 2"/>`;
    return `<svg viewBox="0 0 52 30" width="52" height="30" aria-hidden="true"><rect x="9" y="4" width="34" height="22" fill="#e8ece9"/>${seg(9, 26, 43, 26, e.bottom)}${seg(9, 4, 43, 4, e.top)}${seg(9, 4, 9, 26, e.left)}${seg(43, 4, 43, 26, e.right)}</svg>`;
  }
  function edge(x1, y1, x2, y2, k, nx, ny) {
    if (k === 'fx') {
      const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(3, Math.round(L / 12));
      let h = '';
      for (let i = 0; i <= n; i++) { const x = x1 + (x2 - x1) * i / n, y = y1 + (y2 - y1) * i / n; h += `<line x1="${x}" y1="${y}" x2="${x + nx * 8 + (y2 - y1) / L * 5}" y2="${y + ny * 8 - (x2 - x1) / L * 5}" stroke="#111110" stroke-width="1"/>`; }
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#111110" stroke-width="4"/>${h}`;
    }
    if (k === 'ss') {
      const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.round(L / 40));
      let h = '';
      for (let i = 0; i <= n; i++) { const x = x1 + (x2 - x1) * (i + 0.5) / (n + 1), y = y1 + (y2 - y1) * (i + 0.5) / (n + 1); h += `<path d="M${x} ${y} l${nx * 9 - ny * 5} ${ny * 9 + nx * 5} l${ny * 10} ${-nx * 10} z" fill="#fff" stroke="#111110" stroke-width="1"/>`; }
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#111110" stroke-width="1.6"/>${h}`;
    }
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#8b9d99" stroke-width="1.3" stroke-dasharray="5 4"/>`;
  }
  // plan de la plaque (z = 0 en bas), conditions d'appui, cotes, points de calcul numérotés
  function plan(R, W = 420, H = 300) {
    const g = R.geo, c = R.case, m = 46, k = Math.min((W - 2 * m) / g.a, (H - 2 * m) / g.b);
    const w = g.a * k, h = g.b * k, x0 = (W - w) / 2, y0 = (H - h) / 2, e = c.edges;
    let s = `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#e8ece9"/>`;
    s += edge(x0, y0 + h, x0 + w, y0 + h, e.bottom, 0, 1) + edge(x0, y0, x0 + w, y0, e.top, 0, -1) + edge(x0, y0, x0, y0 + h, e.left, -1, 0) + edge(x0 + w, y0, x0 + w, y0 + h, e.right, 1, 0);
    s += `<text x="${x0 + w / 2}" y="${y0 + h + 34}" font-size="12" text-anchor="middle" fill="#111110">a = ${fmtG(g.a, 0)} mm</text>`;
    s += `<text x="${x0 - 30}" y="${y0 + h / 2}" font-size="12" text-anchor="middle" fill="#111110" transform="rotate(-90 ${x0 - 30} ${y0 + h / 2})">b = ${fmtG(g.b, 0)} mm</text>`;
    s += `<text x="${x0 + 4}" y="${y0 + h - 6}" font-size="9.5" fill="#6e6d69">z = 0</text>`;
    R.uls.forEach((o, i) => {
      if (!o.pos) return;
      const x = x0 + (o.pos[0] + 0.5) * w, y = y0 + h - o.pos[1] * h, col = o.unit === 'mm' ? '#1f7a4d' : o.unit === 'MPa' ? '#c0392b' : '#5e706c';
      s += `<circle cx="${x}" cy="${y}" r="5.5" fill="${col}" stroke="#fff" stroke-width="1.5"/><text x="${x + 7}" y="${y - 6}" font-size="11" font-weight="700" fill="#111110">${i + 1}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block" font-family="Inter, sans-serif">${s}</svg>
      <div class="pl-legend"><span class="k fx">encastré</span><span class="k ss">appui simple</span><span class="k fr">bord libre</span></div>`;
  }

  // ======================================================================
  //  PAGE
  // ======================================================================
  function render(app) {
    const { p } = A().crumbK('plaque');
    const c = C.CASE[st.cas], conc = /^conc/.test(st.load);
    const groups = ['4 côtés', '3 côtés', '2 côtés'].map((gname) => `<div class="pl-group"><div class="sub-title">Appuyée sur ${gname}</div><div class="pl-cases">${C.CASES.filter((x) => x.group === gname).map((x) =>
      `<button type="button" class="pl-case${x.id === st.cas ? ' on' : ''}" data-qact="cas" data-v="${x.id}">${icon(x.edges)}<span>${esc(x.label)}<small>Roark ${x.roark === 'bande' ? '— flexion cylindrique' : 'cas ' + x.roark}</small></span></button>`).join('')}</div></div>`).join('');
    app.innerHTML = `<div class="page">
      <div class="actionbar">
        <div class="grow"><span class="crumb">${p ? `Projet <b>${esc(p.name)}</b> ›` : 'Hors projet ›'} <b id="qCrumb">${esc(st.name || 'Sans nom')}</b></span><span class="dirty" id="qDirty">${dirty ? 'modifié · non enregistré' : ''}</span></div>
        <span id="qVerdict"></span>
        <div class="btn-group"><button class="btn" data-qact="new">Nouveau</button><button class="btn" data-qact="save">Enregistrer</button><button class="btn" data-qact="saveas">Enregistrer sous…</button></div>
        <button class="btn primary" data-qact="report">Fiche NDC ↗</button>
      </div>
      ${blockHead('01', 'Conditions d’appui', 'Plaque rectangulaire d’épaisseur constante, chargée normalement à son plan. Coefficients α, β, γ du tableau 11.4 de Roark ; deux côtés opposés seulement : flexion cylindrique d’une bande.')}
      ${groups}
      ${blockHead('02', 'Plaque, acier et charge', 'f<sub>y</sub> selon l’épaisseur (NF EN 10025). Pressions en kPa (= kN/m²), charges concentrées en kN, ELU pour les contraintes et ELS pour la flèche.')}
      <div class="cols2"><div>
        <div class="fields">${field('Repère', inp('name', { type: 'text', ph: 'ex. Tôle de plancher T1' }))}</div>
        <p class="muted" style="font-size:12.5px;margin:4px 0 8px">${esc(c.ab)}</p>
        <div class="fields">
          ${field('Côté a', inp('a'), 'mm')}${field('Côté b', inp('b'), 'mm')}${field('Épaisseur t', inp('t'), 'mm')}
          ${field('Acier', sel('grade', grades()))}${field('Coefficient de Poisson ν', inp('nu'))}${field('γ<sub>M0</sub>', inp('gam.M0'))}
          ${field('Flèche limite : b /', inp('lim'), '', 'ex. 150 pour une tôle de plancher')}
          ${field('Charge', sel('load', Object.entries(c.loads).map(([k, l]) => [k, `${l.label} (${l.roark})`]), { rr: true }))}
        </div>
        <div class="sub-title">${conc ? 'Charge concentrée au centre' : /lin|tri/.test(st.load) ? 'Pression (valeur maximale)' : 'Pression uniforme'}</div>
        <div class="fields">${conc
          ? `${field('W ELU', inp('Wu'), 'kN')}${field('W ELS', inp('Ws'), 'kN')}${field('Rayon de la zone chargée r<sub>o</sub>', inp('ro'), 'mm', 'r′<sub>o</sub> = √(1,6·r<sub>o</sub>² + t²) − 0,675·t si r<sub>o</sub> < 0,5·t')}`
          : `${field('q ELU', inp('qu'), 'kPa')}${field('q ELS', inp('qs'), 'kPa')}`}</div>
        ${(st.cas === 'c1' || st.cas === 'c8') && st.load === 'uni' ? `<div style="margin:12px 0">${chk('large', 'Signaler l’effet membrane (grandes flèches, § 11.11)')}</div>` : ''}
        <div id="qInfo" class="muted" style="font-size:12.5px;line-height:1.6;margin-top:8px"></div>
      </div>
      <div class="fig" id="qFig"></div></div>
      ${blockHead('03', 'Résultats', 'σ = β·q·b²/t², y = α·q·b⁴/(E·t³), R = γ·q·b ; σ positive quand la face inférieure est tendue (charge vers le bas). Coins supposés maintenus.')}
      <div id="qResults"></div>
    </div>`;
    refresh();
  }

  function refresh() {
    const R = C.compute(st);
    const v = $('#qVerdict');
    if (v) v.innerHTML = !R.valid ? '<span class="verdict ko">— <small>données invalides</small></span>' : `<span class="verdict ${R.max <= 1 ? 'ok' : 'ko'}">${pct(R.max)} <small>${R.max <= 1 ? 'vérifié*' : 'non vérifié'}</small></span>`;
    const dd = $('#qDirty'); if (dd) dd.textContent = dirty ? 'modifié · non enregistré' : '';
    const cn = $('#qCrumb'); if (cn) cn.textContent = st.name || 'Sans nom';
    const box = $('#qResults'), info = $('#qInfo'), fig = $('#qFig');
    if (!R.valid) { if (box) box.innerHTML = R.warnings.map((x) => `<p class="note warn">${sub(x)}</p>`).join(''); if (fig) fig.innerHTML = ''; if (info) info.innerHTML = ''; return; }
    const G = R.geo;
    if (fig) fig.innerHTML = plan(R);
    if (info) info.innerHTML = `a/b = <b style="color:var(--ink)">${fmt(G.ratio, 2)}</b> · f<sub>y</sub> = ${G.fy} MPa · E = ${fmtG(G.E, 0)} MPa · cas ${esc(R.L.roark)}${R.L.nu != null ? ` (tableau établi pour ν = ${String(R.L.nu).replace('.', ',')})` : ''}`;
    if (!box) return;
    const yU = R.uls.find((o) => o.unit === 'mm'), yS = R.sls.find((o) => o.unit === 'mm');
    const sMax = R.uls.filter((o) => o.unit === 'MPa').reduce((m, o) => Math.max(m, Math.abs(o.v)), 0);
    const rows = R.checks.map((x) => `<tr${R.gov === x ? ' class="gov"' : ''}><td>${sub(x.label)}</td><td class="f">${x.ref}</td><td class="num">${fmt(x.Ed, x.unit === 'mm' ? 2 : 1)}</td><td class="num">${fmt(x.Rd, x.unit === 'mm' ? 2 : 1)}</td><td class="f">${x.unit}</td><td class="num"><span class="ratio">${pct(x.r)}</span></td><td style="width:100px">${bar(x.r)}</td><td>${pill(x.r)}</td></tr>`).join('');
    const outRows = R.uls.map((o, i) => `<tr><td><span class="pl-badge ${o.unit === 'mm' ? 'y' : o.unit === 'MPa' ? 's' : 'R'}">${i + 1}</span></td><td>${sub(o.label)}</td><td class="f">${sub(o.formula)}</td><td class="num">${fmt(o.k, 4)}</td><td class="num"><b>${fV(o)}</b></td><td class="num">${fV(R.sls[i])}</td><td class="f">${o.unit}</td></tr>`).join('');
    const L = R.large;
    const large = L && st.large ? `<div class="sub-title" style="margin-top:22px">Grandes flèches — effet membrane (Roark § 11.11)</div>
      <p class="note">Bords retenus dans leur plan (« held »), ν = 0,316, tableau a/b = ${esc(L.table)}. Relation α·Q = w + k·w³ (w = y/t, Q = q·b⁴/(E·t⁴)) tangente à la théorie linéaire, k ajusté sur le tableau ; contrainte totale (flexion + membrane) ${esc(L.where)}.${L.uls.out || L.sls.out ? ' Q au-delà du tableau (250) : extrapolation.' : ''}</p>
      <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th></th><th class="num">Q</th><th class="num">Linéaire</th><th class="num">Grandes flèches</th></tr></thead><tbody>
        <tr><td>Flèche ELS</td><td class="num">${fmt(L.sls.Q, 1)}</td><td class="num">${yS ? fmt(yS.v, 2) : '—'} mm</td><td class="num"><b>${fmt(L.sls.y, 2)} mm</b></td></tr>
        <tr><td>Contrainte maximale ELU</td><td class="num">${fmt(L.uls.Q, 1)}</td><td class="num">${fmt(sMax, 1)} MPa</td><td class="num"><b>${fmt(L.uls.s, 1)} MPa</b></td></tr>
      </tbody></table></div>
      <p class="note">${L.sls.y < (yS ? yS.v : 0) * 0.95 ? `La rigidité de membrane réduit la flèche ELS de ${Math.round((1 - L.sls.y / yS.v) * 100)} % : utilisable si les bords sont effectivement retenus dans leur plan (soudure continue, platelage). Les vérifications ci-dessus restent celles de la théorie linéaire, du côté de la sécurité.` : 'Petites flèches : la théorie linéaire suffit.'}</p>` : '';
    const tab = R.case.strip ? '' : (() => {
      const keys = Object.keys(R.L.c), nm = (k) => ({ a: 'α', b: 'β', g: 'γ' }[k[0]] + (k.length > 1 ? `<sub>${k[1]}</sub>` : ''));
      return `<details class="pl-tab"><summary>Coefficients de Roark, cas ${esc(R.L.roark)} (interpolés en a/b)</summary><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>a/b</th>${R.L.r.map((x) => `<th class="num">${x === Infinity ? '∞' : fmtG(x, 3)}</th>`).join('')}<th class="num hl">${fmt(G.ratio, 2)}</th></tr></thead><tbody>
        ${keys.map((k) => `<tr><td>${nm(k)}</td>${R.L.c[k].map((x) => `<td class="num">${fmtG(x, 4)}</td>`).join('')}<td class="num hl"><b>${fmtG(R.cs[k].v, 4)}</b></td></tr>`).join('')}</tbody></table></div></details>`;
    })();
    box.innerHTML = `${R.warnings.map((w) => `<p class="note warn">${sub(w)}</p>`).join('')}${R.info.map((w) => `<p class="note">${sub(w)}</p>`).join('')}
      <div class="kpis k3">
        <div class="kpi ${R.max <= 1 ? 'hero' : 'bad'}"><b>Taux maximal</b><span>${pct(R.max)}</span><small>${R.max <= 1 ? 'Vérifié pour les critères traités*' : 'Plaque non vérifiée'}</small></div>
        <div class="kpi"><b>Contrainte ELU</b><span>${fmt(sMax, 1)} MPa</span><small>f<sub>y</sub>/γ<sub>M0</sub> = ${fmt(G.fy / G.gM0, 0)} MPa</small></div>
        <div class="kpi"><b>Flèche ELS</b><span>${yS ? fmt(Math.abs(yS.v), 2) + ' mm' : '—'}</span><small>${yS ? `b/${Math.round(G.b / Math.abs(yS.v))} · y/t = ${fmt(Math.abs(yS.v) / G.t, 2)}` : 'non donnée par Roark pour ce cas'}</small></div>
      </div>
      <div class="tbl-wrap" style="margin-top:18px"><table class="tbl"><thead><tr><th>Critère</th><th>Réf.</th><th class="num">E<sub>d</sub></th><th class="num">R<sub>d</sub></th><th>Unité</th><th class="num">Taux</th><th></th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="sub-title" style="margin-top:22px">Grandeurs calculées</div>
      <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th></th><th>Grandeur</th><th>Formule</th><th class="num">Coef.</th><th class="num">ELU</th><th class="num">ELS</th><th>Unité</th></tr></thead><tbody>${outRows}</tbody></table></div>
      ${large}${tab}
      <p class="note">* Critères traités : contrainte de flexion élastique ≤ f<sub>y</sub>/γ<sub>M0</sub> (première plastification, une seule direction de contrainte donnée par Roark), flèche ELS. Hors champ : réserve plastique (lignes de rupture), voilement sous compression dans le plan, fatigue, assemblages des bords. Si les coins peuvent se soulever, la contrainte au centre d’une plaque carrée sur appuis simples augmente d’environ 35 % (Roark § 11.10).</p>`;
  }

  // ======================================================================
  //  FICHE NDC
  // ======================================================================
  function page(state, project, idx, total, opts) {
    const s = C.upgrade(JSON.parse(JSON.stringify(state)));
    const R = C.compute(s);
    if (!R.valid) return `<section class="rp-page"><p>${esc(s.name)} : données invalides.</p></section>`;
    const G = R.geo, conc = /^conc/.test(s.load);
    const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const head = `<header class="rp-head"><div class="l"><b>${esc(project || 'Note de calcul')}</b>Plaque rectangulaire — Roark, tableau 11.4${opts && opts.ref ? ' · ' + esc(opts.ref) : ''}</div><div class="r">${!opts || opts.logo ? '<div class="logo-s">tracés</div>' : ''}${esc(s.name)} · ${date} · p. 1</div></header>`;
    let n = 0; const H2 = (t) => `<h2><span class="n">${++n}</span>${t}</h2>`;
    const kv = (a, b) => `<div><span>${a}</span><b>${b}</b></div>`;
    const chkRows = R.checks.map((x) => `<tr${R.gov === x ? ' class="gov"' : ''}><td>${sub(x.label)}</td><td>${x.ref}</td><td class="num">${fmt(x.Ed, x.unit === 'mm' ? 2 : 1)}</td><td class="num">${fmt(x.Rd, x.unit === 'mm' ? 2 : 1)}</td><td>${x.unit}</td><td class="num">${pct(x.r)}</td><td>${x.r <= 1 ? '<span class="rp-ok">OK</span>' : '<span class="rp-ko">Non vérifié</span>'}</td></tr>`).join('');
    const outRows = R.uls.map((o, i) => `<tr><td>${i + 1}</td><td>${sub(o.label)}</td><td>${sub(o.formula)}</td><td class="num">${fmt(o.k, 4)}</td><td class="num">${fV(o)}</td><td class="num">${fV(R.sls[i])}</td><td>${o.unit}</td></tr>`).join('');
    const notes = R.warnings.concat(R.info);
    return `<section class="rp-page">${head}
      <div class="rp-title"><h1>${esc(s.name)} — tôle ${fmtG(G.a, 0)} × ${fmtG(G.b, 0)} × ${fmtG(G.t, 1)} mm${total > 1 ? ` (${idx + 1}/${total})` : ''}</h1>
      <p>${esc(R.case.label)} · ${esc(R.L.label)} (Roark ${esc(R.L.roark)}) · acier ${esc(s.grade)}</p></div>
      ${H2('Hypothèses')}
      <div class="rp-kv">
        ${kv('Dimensions', `a = ${fmtG(G.a, 0)} mm, b = ${fmtG(G.b, 0)} mm, a/b = ${fmt(G.ratio, 2)}, t = ${fmtG(G.t, 1)} mm`)}${kv('Acier', `${esc(s.grade)}, f<sub>y</sub> = ${G.fy} MPa, E = ${fmtG(G.E, 0)} MPa, ν = ${fmtG(G.nu, 2)}, γ<sub>M0</sub> = ${fmtG(G.gM0, 2)}`)}
        ${kv('Charge ELU', conc ? `W = ${fmtG(+s.Wu, 2)} kN sur r<sub>o</sub> = ${fmtG(+s.ro, 0)} mm` : `q = ${fmtG(+s.qu, 2)} kPa`)}${kv('Charge ELS', conc ? `W = ${fmtG(+s.Ws, 2)} kN` : `q = ${fmtG(+s.qs, 2)} kPa`)}
        ${kv('Flèche limite', `b/${fmtG(G.lim, 0)} = ${fmt(G.b / G.lim, 2)} mm`)}${kv('Appuis', esc(R.case.label))}
      </div>
      <div style="margin-top:4pt;max-width:110mm">${plan(R, 420, 300)}</div>
      ${H2('Grandeurs calculées')}
      <table><thead><tr><th></th><th>Grandeur</th><th>Formule</th><th class="num">Coef.</th><th class="num">ELU</th><th class="num">ELS</th><th>Unité</th></tr></thead><tbody>${outRows}</tbody></table>
      ${H2('Vérifications')}
      <table><thead><tr><th>Critère</th><th>Réf.</th><th class="num">E<sub>d</sub></th><th class="num">R<sub>d</sub></th><th>Unité</th><th class="num">Taux</th><th>Statut</th></tr></thead><tbody>${chkRows}</tbody></table>
      ${R.large && s.large ? `<p style="font-size:7.6pt">Grandes flèches (§ 11.11, bords retenus dans leur plan) : flèche ELS ${fmt(R.large.sls.y, 2)} mm, contrainte ELU ${fmt(R.large.uls.s, 1)} MPa (pour information).</p>` : ''}
      ${notes.length ? `<p style="font-size:7.6pt"><b>Remarques :</b> ${notes.map(sub).join(' ')}</p>` : ''}
      <div class="rp-concl"><span>Conclusion — tôle ${fmtG(G.t, 1)} mm ${esc(s.grade)}</span><b class="${R.max <= 1 ? 'rp-ok' : 'rp-ko'}">${R.max <= 1 ? 'Vérifié' : 'Non vérifié'} — taux max. ${pct(R.max)}</b></div>
      <p style="font-size:7.4pt;color:#555;margin-top:5pt">Formules et coefficients : W. C. Young, R. G. Budynas, Roark's Formulas for Stress and Strain, chapitre 11, tableau 11.4 (coefficients interpolés en a/b). Contrainte de flexion élastique comparée à f<sub>y</sub>/γ<sub>M0</sub> ; hors champ : réserve plastique, voilement, fatigue, assemblages.</p>
    </section>`;
  }

  // ======================================================================
  //  ÉVÉNEMENTS
  // ======================================================================
  function bind(app) {
    const onEdit = (e) => {
      const t = e.target; if (!t.dataset || !t.dataset.qp || t.closest('.modal')) return;
      if (e.type === 'input' && (t.tagName === 'SELECT' || t.type === 'checkbox')) return;
      set(t.dataset.qp, t.type === 'checkbox' ? t.checked : t.value);
      dirty = true; persist();
      if (t.dataset.rr && e.type === 'change') { const y = window.scrollY; render(app); window.scrollTo(0, y); return; }
      refresh();
    };
    app.addEventListener('input', onEdit);
    app.addEventListener('change', onEdit);
    app.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-qact]'); if (!b) return;
      const a = b.dataset.qact, y = window.scrollY;
      if (a === 'cas') { st.cas = b.dataset.v; if (!C.CASE[st.cas].loads[st.load]) st.load = 'uni'; dirty = true; persist(); render(app); window.scrollTo(0, y); }
      else if (a === 'save' || a === 'saveas') { const ok = await A().saveItem('plaque', st, a === 'saveas'); if (ok) { dirty = false; persist(); render(app); window.scrollTo(0, y); } }
      else if (a === 'new') {
        if (dirty && !(await A().confirmBox('Nouvelle plaque', 'Les modifications non enregistrées seront perdues. Continuer ?'))) return;
        st = C.defaultState(); st.name = 'Nouvelle plaque'; A().newItem('plaque'); dirty = false; persist(); render(app);
      }
      else if (a === 'report') window.FirmitasReport.open([{ state: st, project: A().crumbK('plaque').p ? A().crumbK('plaque').p.name : '' }]);
    });
  }
  function load(state) { st = C.upgrade(state); dirty = false; persist(); }

  const api = { init, render, bind, page, load, flush, get state() { return st; }, get dirty() { return dirty; }, summary: C.summary };
  window.FirmitasModules = window.FirmitasModules || {};
  window.FirmitasModules.plaque = { kind: 'plaque', route: 'plaques', title: 'Plaques', short: 'plaque', ref: 'Roark, tableau 11.4', api, upgrade: C.upgrade };
})();
