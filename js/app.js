/* ==========================================================================
   Firmitas — interface
   ========================================================================== */
(function () {
  'use strict';
  const E = window.FirmitasEC3, D = window.FIRMITAS_DATA, ST = window.FirmitasStore;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let db = ST.load();
  let state = db.draft ? ST.upgrade(db.draft) : ST.defaultState();
  let R = null;
  let dirty = !!db.draftDirty;

  // ---------- formats ----------
  const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
  const fmtG = (x, d = 3) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { maximumFractionDigits: d }) : '—');
  const pct = (r) => (Number.isFinite(r) ? Math.round(r * 100) + ' %' : '∞');
  const cls = (r) => (!(r <= 1) ? 'ko' : r > 0.9 ? 'hi' : '');
  const bar = (r) => `<div class="bar"><i class="${cls(r)}" style="width:${Math.min(100, (Number.isFinite(r) ? r : 1) * 100)}%"></i></div>`;
  const pill = (r) => (r == null ? '<span class="pill na">—</span>' : r <= 1 ? '<span class="pill ok">OK</span>' : '<span class="pill ko">NON</span>');
  const sub = (s) => esc(s).replace(/_([A-Za-z0-9,.]+)/g, '<sub>$1</sub>').replace(/\^([0-9αβ]+)/g, '<sup>$1</sup>');
  const kN = (x) => fmt(x / 1e3, 2), kNm = (x) => fmt(x / 1e6, 2);

  // ---------- accès par chemin ----------
  const get = (p, o = state) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function set(p, v, o = state) {
    const ks = p.split('.'); let a = o;
    ks.slice(0, -1).forEach((k) => { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; });
    a[ks[ks.length - 1]] = v;
  }
  function recompute() { R = E.compute(state); return R; }
  let saveT = null;
  function persistDraft() { clearTimeout(saveT); saveT = setTimeout(() => { db.draft = state; db.draftDirty = dirty; ST.save(db); }, 250); }
  function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }

  // ---------- champs ----------
  function inp(p, opt = {}) {
    const v = opt.value != null ? opt.value : get(p);
    const type = opt.type || 'number';
    return `<input type="${type}" data-p="${p}" value="${esc(v)}"${type === 'number' ? ' step="any"' : ''}${opt.ph ? ` placeholder="${esc(opt.ph)}"` : ''}${opt.dis ? ' disabled' : ''}>`;
  }
  function sel(p, options, opt = {}) {
    const v = String(get(p));
    const html = options.map((o) => {
      if (o.group) return `<optgroup label="${esc(o.group)}">${o.items.map((it) => `<option value="${esc(it[0])}"${String(it[0]) === v ? ' selected' : ''}>${esc(it[1])}</option>`).join('')}</optgroup>`;
      return `<option value="${esc(o[0])}"${String(o[0]) === v ? ' selected' : ''}>${esc(o[1])}</option>`;
    }).join('');
    return `<select data-p="${p}"${opt.rerender ? ' data-rerender="1"' : ''}${opt.dis ? ' disabled' : ''}>${html}</select>`;
  }
  const field = (label, control, unit, hint) => `<label class="field"><span>${label}${unit ? ` <span class="u">[${unit}]</span>` : ''}</span>${control}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  const chk = (p, label, rerender) => `<label class="check"><input type="checkbox" data-p="${p}"${get(p) ? ' checked' : ''}${rerender ? ' data-rerender="1"' : ''}> ${label}</label>`;
  const blockHead = (n, title, text) => `<div class="block-head"><span class="num">${n}</span><h2>${title}</h2><p>${text || ''}</p></div>`;

  // ---------- schéma de section ----------
  function sectionSvg(S, size = 130) {
    if (!S) return `<svg width="${size}" height="${size}"></svg>`;
    const pad = 16, k = (size - 2 * pad) / Math.max(S.h, S.b);
    const W = S.b * k, H = S.h * k, x0 = (size - W) / 2, y0 = (size - H) / 2, cx = size / 2, cy = size / 2;
    let shape;
    const st = 'fill="#d9dee6" stroke="#111" stroke-width="1.1"';
    if (S.type === 'CHS') {
      const ro = S.d / 2 * k, ri = (S.d / 2 - S.t) * k;
      shape = `<path d="M${cx - ro},${cy}a${ro},${ro} 0 1,0 ${2 * ro},0a${ro},${ro} 0 1,0 ${-2 * ro},0ZM${cx - ri},${cy}a${ri},${ri} 0 1,1 ${2 * ri},0a${ri},${ri} 0 1,1 ${-2 * ri},0Z" fill-rule="evenodd" ${st}/>`;
    } else if (S.type === 'RHS') {
      const t = Math.max(S.t * k, 1), ro = 1.5 * S.t * k;
      shape = `<path d="${rr(x0, y0, W, H, ro)}${rr(x0 + t, y0 + t, W - 2 * t, H - 2 * t, Math.max(ro - t, 0))}" fill-rule="evenodd" ${st}/>`;
    } else {
      const tf = Math.max(S.tf * k, 1), tw = Math.max(S.tw * k, 1);
      const xl = cx - tw / 2, xr = cx + tw / 2;
      shape = `<path d="M${x0},${y0}h${W}v${tf}H${xr}V${y0 + H - tf}H${x0 + W}v${tf}H${x0}v${-tf}H${xl}V${y0 + tf}H${x0}Z" ${st}/>`;
    }
    return `<svg width="${size + 14}" height="${size}" viewBox="0 0 ${size + 14} ${size}" aria-hidden="true">${shape}
      <line x1="${cx}" y1="${y0 - 8}" x2="${cx}" y2="${y0 + H + 8}" stroke="#111" stroke-width=".6" stroke-dasharray="4 2 1 2"/>
      <line x1="${x0 - 8}" y1="${cy}" x2="${x0 + W + 8}" y2="${cy}" stroke="#111" stroke-width=".6" stroke-dasharray="4 2 1 2"/>
      <text x="${x0 + W + 10}" y="${cy + 4}">y</text><text x="${cx + 4}" y="${y0 + H + 14}">z</text></svg>`;
  }
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    return `M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(w - 2 * r)}a${r},${r} 0 0 1 ${-r},${-r}v${-(h - 2 * r)}a${r},${r} 0 0 1 ${r},${-r}Z`;
  }

  // ---------- diagrammes M / V / flèche ----------
  function diagSvg(c, key, unit, scale, cssCls, title, W = 520, H = 120) {
    const pts = c.stations.map((p) => [p.x, p[key] / scale]);
    const L = R.L, max = Math.max(1e-9, ...pts.map((p) => Math.abs(p[1])));
    const x0 = 34, x1 = W - 14, ym = H / 2 + 8, k = (H / 2 - 24) / max;
    const X = (x) => x0 + (x1 - x0) * x / L;
    const sgn = key === 'My' || key === 'Mz' ? 1 : -1;      // moments positifs (fibre inférieure tendue) tracés vers le bas
    const path = `M${X(0)},${ym}` + pts.map((p) => `L${X(p[0]).toFixed(1)},${(ym + sgn * p[1] * k).toFixed(1)}`).join('') + `L${X(L)},${ym}Z`;
    const ext = pts.reduce((a, p) => (Math.abs(p[1]) > Math.abs(a[1]) ? p : a), pts[0]);
    const ex = X(ext[0]), ey = ym + sgn * ext[1] * k;
    return `<svg class="diag" viewBox="0 0 ${W} ${H}"><text x="0" y="12">${title}</text>
      <path class="${cssCls}" d="${path}"/><line class="ax" x1="${x0}" y1="${ym}" x2="${x1}" y2="${ym}"/>
      <text x="${Math.min(Math.max(ex, x0 + 30), x1 - 30)}" y="${ey + (sgn * ext[1] >= 0 ? 13 : -5)}" text-anchor="middle">${fmt(ext[1], 2)} ${unit}</text></svg>`;
  }

  // ======================================================================
  //  VÉRIFICATION
  // ======================================================================
  function crumb() {
    const p = db.current && db.projects.find((x) => x.id === db.current.projectId);
    const it = p && p.items.find((x) => x.id === db.current.itemId);
    return { p, it };
  }
  const famOptions = () => [
    { group: 'Profilés en I', items: D.FAMILIES.filter((f) => !f.tube).map((f) => [f.id, f.id]) },
    { group: 'Tubes', items: D.FAMILIES.filter((f) => f.tube).map((f) => [f.id, f.id]) }
  ];
  const isTubeFam = (f) => { const x = D.FAMILIES.find((y) => y.id === f); return !!(x && x.tube); };

  function renderVerification(app) {
    recompute();
    const { p } = crumb();
    const s = state, c = s.sec;
    const kindChips = [['cat', 'Catalogue'], ['prs', 'PRS (I soudé)'], ['tube', 'Tube sur mesure']]
      .map(([k, l]) => `<button type="button" class="chip${c.kind === k ? ' on' : ''}" data-act="kind" data-v="${k}">${l}</button>`).join('');
    const modeChips = [['charges', 'Charges sur la poutre'], ['direct', 'Sollicitations de calcul (modèle)']]
      .map(([k, l]) => `<button type="button" class="chip${s.mode === k ? ' on' : ''}" data-act="mode" data-v="${k}">${l}</button>`).join('');
    let secFields;
    if (c.kind === 'prs') secFields = `${field('h', inp('sec.prs.h'), 'mm')}${field('b', inp('sec.prs.b'), 'mm')}${field('t<sub>w</sub>', inp('sec.prs.tw'), 'mm')}${field('t<sub>f</sub>', inp('sec.prs.tf'), 'mm')}`;
    else if (c.kind === 'tube') secFields = `${field('Forme', sel('sec.tube.shape', [['rhs', 'Rectangulaire / carré'], ['chs', 'Rond']], { rerender: true }))}
      ${c.tube.shape === 'chs' ? field('d', inp('sec.tube.d'), 'mm') : field('h', inp('sec.tube.h'), 'mm') + field('b', inp('sec.tube.b'), 'mm')}${field('t', inp('sec.tube.t'), 'mm')}
      ${field('Fabrication', sel('sec.fab', [['hot', 'Fini à chaud (EN 10210)'], ['cold', 'Formé à froid (EN 10219)']]))}`;
    else secFields = `${field('Famille', sel('sec.fam', famOptions(), { rerender: true }))}
      ${field('Profil', sel('sec.name', (D.CATALOG[c.fam] || []).map((x) => [x.name, x.name + (x.added ? ' ＋' : '')])))}
      ${isTubeFam(c.fam) ? field('Fabrication', sel('sec.fab', [['hot', 'Fini à chaud (EN 10210)'], ['cold', 'Formé à froid (EN 10219)']])) : ''}`;

    app.innerHTML = `<div class="page">
      <div class="actionbar">
        <div class="grow">
          <span class="crumb">${p ? `Projet <b>${esc(p.name)}</b> ›` : 'Hors projet ›'} <b id="crumbName">${esc(s.name || 'Sans nom')}</b></span>
          <span class="dirty" id="dirtyFlag">${dirty ? 'modifié · non enregistré' : ''}</span>
        </div>
        <span id="verdict"></span>
        <div class="btn-group">
          <button class="btn" data-act="new">Nouveau</button>
          <button class="btn" data-act="save">Enregistrer</button>
          <button class="btn" data-act="saveas">Enregistrer sous…</button>
        </div>
        <button class="btn primary" data-act="report">Fiche NDC ↗</button>
      </div>

      ${blockHead('01', 'Section & acier', "Profilé du catalogue (caractéristiques recalculées depuis les dimensions), PRS soudé ou tube. Axe y : axe fort, z : axe faible.")}
      <div class="cols2">
        <div>
          <div class="fields">${field('Repère', inp('name', { type: 'text', ph: 'ex. Poutre P3 – R+1' }))}</div>
          <div class="chips" style="margin:14px 0">${kindChips}</div>
          <div class="fields">${secFields}</div>
          <div class="sub-title">Acier</div>
          <div class="fields">
            ${field('Nuance', sel('steel.grade', Object.keys(D.STEELS).map((k) => [k, k])))}
            ${field('f<sub>y</sub>', sel('steel.fyMode', [['en10025', 'Selon t — NF EN 10025'], ['tab31', 'Tableau 3.1 (2 paliers)'], ['custom', 'Saisie libre']], { rerender: true }))}
            ${s.steel.fyMode === 'custom' ? field('f<sub>y</sub> saisi', inp('steel.fyCustom'), 'MPa') : ''}
            ${field('γ<sub>M0</sub>', inp('steel.gM0'), '', 'AN : 1,00')}
            ${field('γ<sub>M1</sub>', inp('steel.gM1'), '', 'AN : 1,00')}
          </div>
        </div>
        <div class="section-fig" id="secFig" style="align-items:flex-start"></div>
      </div>

      ${blockHead('02', 'Portée & stabilité', "Travée unique, conditions d'appui dans le plan fort. Longueurs de flambement et de déversement entre maintiens.")}
      <div class="cols2">
        <div>
          <div class="fields">
            ${field('Portée L', inp('L'), 'm')}
            ${field('Appuis', sel('bc', Object.keys(D.BC).map((k) => [k, D.BC[k].label]), { rerender: true }))}
          </div>
          <div class="sub-title">Flambement</div>
          <div class="fields">
            ${field('L<sub>cr,y</sub>', inp('stab.Lcry', { dis: s.stab.link.Lcry, value: s.stab.link.Lcry ? R.stab && R.stab.Lcry / 1000 : null }), 'm')}
            ${field('L<sub>cr,z</sub>', inp('stab.Lcrz', { dis: s.stab.link.Lcrz, value: s.stab.link.Lcrz ? R.stab && R.stab.Lcrz / 1000 : null }), 'm')}
          </div>
          <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px">${chk('stab.link.Lcry', 'L<sub>cr,y</sub> auto', true)} ${chk('stab.link.Lcrz', 'L<sub>cr,z</sub> auto', true)} ${chk('stab.sway', 'Nœuds déplaçables (C<sub>m</sub> = 0,9)')}</div>
          <p class="note">Auto : L (2·L pour une console). À ajuster selon la structure : appuis encastrés, maintiens intermédiaires, cadre à nœuds déplaçables…</p>
        </div>
        <div>
          <div class="sub-title" style="margin-top:0">Déversement</div>
          <div style="margin-bottom:10px">${chk('stab.restrained', 'Semelle comprimée maintenue en continu (plancher collaborant, bac fixé…)', true)}</div>
          ${s.stab.restrained ? '' : `<div class="fields">
            ${field('L<sub>LT</sub> entre maintiens', inp('stab.LLT', { dis: s.stab.link.LLT, value: s.stab.link.LLT ? R.stab && R.stab.LLT / 1000 : null }), 'm')}
            ${field('k', inp('stab.k'), '', 'Rotation d\'axe z aux extrémités : 1 libre, 0,5 empêchée')}
            ${field('k<sub>w</sub>', inp('stab.kw'), '', 'Gauchissement : 1 libre, 0,5 empêché')}
            ${field('Point d\'application', sel('stab.zgMode', [['top', 'Semelle supérieure (déstabilisant)'], ['centre', 'Centre de cisaillement'], ['bottom', 'Semelle inférieure'], ['custom', 'z_g saisi']], { rerender: true }))}
            ${s.stab.zgMode === 'custom' ? field('z<sub>g</sub>', inp('stab.zg'), 'mm', '> 0 au-dessus du centre') : ''}
            ${field('C<sub>1</sub>, C<sub>2</sub>', sel('stab.C1mode', [['auto', 'Automatiques'], ['manual', 'Saisis']], { rerender: true }))}
            ${s.stab.C1mode === 'manual' ? field('C<sub>1</sub>', inp('stab.C1')) + field('C<sub>2</sub>', inp('stab.C2')) : ''}
          </div>
          <div style="margin-top:8px">${chk('stab.link.LLT', 'L<sub>LT</sub> auto', true)}</div>`}
          <p class="note" id="ltNote"></p>
        </div>
      </div>

      ${blockHead('03', 'Actions', "Charges caractéristiques sur la travée, ou sollicitations de calcul issues d'un modèle (enveloppe ELU).")}
      <div class="chips">${modeChips}</div>
      <div id="loadInputs" style="margin-top:16px">${renderLoadInputs()}</div>

      <div class="sub-title" style="margin-top:30px">Flèches et vibrations</div>
      <div class="fields">
        ${field('Préréglage', sel('sls.preset', Object.keys(D.SLS_PRESETS).map((k) => [k, D.SLS_PRESETS[k].label]).concat([['custom', 'Personnalisé']])))}
        ${field('w<sub>max</sub> (G + Q) ≤ L /', inp('sls.tot'))}
        ${field('w<sub>Q</sub> ≤ L /', inp('sls.q'))}
        ${field('Portée de référence', inp('sls.Lref', { ph: s.bc === 'c' ? '2·L' : 'L' }), 'm', 'Console : 2 × porte-à-faux (AN).')}
        ${s.mode === 'charges' ? field('Fréquence minimale', inp('sls.fmin', { ph: 'aucune' }), 'Hz', 'Ex. 3 Hz habitation, 5 Hz salles de sport (vide = non vérifiée).') + field('ψ<sub>2</sub> pour la masse', inp('sls.psi2'), '', 'm = G + ψ<sub>2</sub>·Q') : ''}
      </div>
      <p class="note">NF EN 1993-1-1/NA tableau 1 (flèches verticales). Une limite laissée vide désactive le critère.</p>

      ${blockHead('04', 'Résultats', "Taux de travail maximaux ; détail des calculs dans l'onglet Détail.")}
      <div id="results"></div>
    </div>`;
    refreshDynamic();
  }

  function renderLoadInputs() {
    const s = state;
    if (s.mode === 'direct') {
      const d = 'direct.';
      return `<div class="cols2"><div>
        <div class="fields">
          ${field('N<sub>Ed</sub>', inp(d + 'N'), 'kN', '> 0 compression, < 0 traction')}
          ${field('V<sub>z,Ed</sub>', inp(d + 'Vz'), 'kN', 'Valeur max.')}
          ${field('V<sub>y,Ed</sub>', inp(d + 'Vy'), 'kN')}
        </div>
        <div class="tbl-wrap" style="margin-top:14px"><table class="grid">
          <thead><tr><th class="rowh">Moments [kN·m]</th><th>Gauche</th><th>Milieu</th><th>Droite</th></tr></thead>
          <tbody>
            <tr><td class="rowh">M<sub>y,Ed</sub></td>${[0, 1, 2].map((i) => `<td>${inp(d + 'My.' + i)}</td>`).join('')}</tr>
            <tr><td class="rowh">M<sub>z,Ed</sub></td>${[0, 1, 2].map((i) => `<td>${inp(d + 'Mz.' + i)}</td>`).join('')}</tr>
          </tbody></table></div>
        <div class="fields" style="margin-top:12px">${field('Charge entre maintiens', sel(d + 'load', [['U', 'Répartie'], ['C', 'Concentrée']]), '', 'Pour C<sub>m</sub> (tableau B.3) si le diagramme n\'est pas linéaire.')}</div>
      </div><div>
        <p class="note" style="margin-top:0">Saisir les sollicitations de <b>calcul</b> (combinaison ELU) de la barre. Signes : M &gt; 0 tend la fibre inférieure ; les moments d'extrémité de signe opposé au moment en travée correspondent à des encastrements. La résistance des sections est vérifiée aux trois points avec V<sub>Ed</sub> partout (sécuritaire) ; le diagramme de moment entre les points est supposé parabolique.</p>
        <div class="fields">
          ${field('Flèche totale (G + Q)', inp(d + 'wTot', { ph: 'non vérifiée' }), 'mm')}
          ${field('Flèche sous Q', inp(d + 'wQ', { ph: 'non vérifiée' }), 'mm')}
        </div>
      </div></div>`;
    }
    const row = (r) => `<tr><td class="rowh">${r.label} <small>${r.sub}</small></td><td>${inp('loads.' + r.id + '.q')}</td><td>${inp('loads.' + r.id + '.P')}</td><td>${inp('loads.' + r.id + '.x', { ph: 'L/2' })}</td></tr>`;
    return `<div class="cols2"><div>
      <div class="tbl-wrap"><table class="grid">
        <thead><tr><th class="rowh">Charges caractéristiques</th><th>q [kN/m]</th><th>P [kN]</th><th>x<sub>P</sub> [m]</th></tr></thead>
        <tbody>${D.LOAD_ROWS.map(row).join('')}</tbody></table></div>
      <div style="margin-top:10px">${chk('pp', `Ajouter le poids propre (${fmt(R && R.pp, 3)} kN/m) à G`)}</div>
      <div class="fields" style="margin-top:14px">
        ${field('Effort normal N<sub>G</sub>', inp('N.G'), 'kN', '> 0 compression')}
        ${field('Effort normal N<sub>Q</sub>', inp('N.Q'), 'kN')}
      </div>
    </div><div>
      <div class="fields">
        ${field('γ<sub>G,sup</sub>', inp('gam.Gsup'))}${field('γ<sub>G,inf</sub>', inp('gam.Ginf'), '', 'G favorable')}${field('γ<sub>Q</sub>', inp('gam.Q'))}
      </div>
      <p class="note">ELU (NF EN 1990 éq. 6.10) : γ<sub>G</sub>·G + γ<sub>Q</sub>·Q, γ<sub>G</sub>·G seul, et 1,0·G + γ<sub>Q</sub>·Q si Q est de signe opposé (soulèvement : saisir une charge négative). ELS caractéristique : G + Q. Charge ponctuelle : x<sub>P</sub> mesuré depuis l'appui gauche (ou l'encastrement de la console) ; vide = mi-portée (bout de la console). Les sollicitations sont calculées en 40 sections plus les points d'application des charges.</p>
    </div></div>`;
  }

  function refreshDynamic() {
    recompute();
    const S = R.S;
    const fig = $('#secFig');
    if (fig) {
      fig.innerHTML = sectionSvg(S, 140) + (S ? `<div style="flex:1;min-width:0">
        <div style="font-weight:800;font-size:15px;margin-bottom:6px">${esc(S.name)} <span class="cls-badge${R.cls === 4 ? ' c4' : ''}" title="Classe la plus défavorable sur les combinaisons">classe ${R.cls}</span></div>
        <div class="kv">
          <div><span>Masse</span><b>${fmt(S.G, 1)} kg/m</b></div><div><span>A</span><b>${fmt(S.A / 100, 1)} cm²</b></div>
          <div><span>I<sub>y</sub></span><b>${fmtG(S.Iy / 1e4, 0)} cm⁴</b></div><div><span>I<sub>z</sub></span><b>${fmtG(S.Iz / 1e4, 0)} cm⁴</b></div>
          <div><span>W<sub>pl,y</sub></span><b>${fmtG(S.Wply / 1e3, 1)} cm³</b></div><div><span>W<sub>pl,z</sub></span><b>${fmtG(S.Wplz / 1e3, 1)} cm³</b></div>
          <div><span>W<sub>el,y</sub></span><b>${fmtG(S.Wely / 1e3, 1)} cm³</b></div><div><span>W<sub>el,z</sub></span><b>${fmtG(S.Welz / 1e3, 1)} cm³</b></div>
          <div><span>I<sub>t</sub></span><b>${fmtG(S.It / 1e4, 2)} cm⁴</b></div><div><span>I<sub>w</sub></span><b>${S.Iw ? fmtG(S.Iw / 1e6, 0) + ' cm⁶' : '—'}</b></div>
          <div><span>A<sub>v,z</sub></span><b>${fmt(S.Avz / 100, 1)} cm²</b></div><div><span>i<sub>y</sub> / i<sub>z</sub></span><b>${fmt(S.iy / 10, 2)} / ${fmt(S.iz / 10, 2)} cm</b></div>
          <div><span>f<sub>y</sub> (t = ${fmtG(S.t, 1)} mm)</span><b>${R.fy} MPa</b></div><div><span>Courbes y / z</span><b>${R.curves.y} / ${R.curves.z}</b></div>
        </div></div>` : '<p class="note warn">Dimensions invalides.</p>');
    }
    const ln = $('#ltNote');
    if (ln && R.env && R.env.worst) {
      const lt = R.env.worst.mem.lt;
      ln.innerHTML = lt.skip ? 'Déversement : ' + sub(lt.skip) + '.'
        : `M<sub>cr</sub> = ${kNm(lt.Mcr)} kN·m (annexe F de l'ENV / NCCI SN003) · C<sub>1</sub> = ${fmt(lt.C1, 3)}${state.stab.C1mode === 'manual' ? '' : ' (forme du diagramme, entre maintiens d\'extrémité)'} · C<sub>2</sub>·z<sub>g</sub> = ${fmt(lt.C2, 3)} × ${fmtG(R.stab.zg, 1)} mm · λ̄<sub>LT</sub> = ${fmt(lt.lam, 3)} · χ<sub>LT</sub> = ${fmt(lt.chi, 3)} (courbe ${lt.curve}).`;
    }
    renderResults();
    const v = $('#verdict');
    if (v) v.innerHTML = !R.valid ? '<span class="verdict ko">— <small>hors domaine</small></span>' : `<span class="verdict ${R.max <= 1 ? 'ok' : 'ko'}">${pct(R.max)} <small>${R.max <= 1 ? 'vérifié*' : 'non vérifié'}</small></span>`;
    const df = $('#dirtyFlag'); if (df) df.textContent = dirty ? 'modifié · non enregistré' : '';
    const cn = $('#crumbName'); if (cn) cn.textContent = state.name || 'Sans nom';
  }

  function critRows(env, keys) {
    return keys.filter((k) => env.byCrit[k]).map((k) => {
      const c = E.CRITERIA[k], x = env.byCrit[k];
      return `<tr class="${env.worst.gov === k ? 'gov' : ''}"><td>${sub(c.label)}</td><td class="f">${c.ref}</td><td class="f">${esc(x.combo.id)}</td><td class="num"><span class="ratio">${pct(x.r)}</span></td><td style="width:110px">${bar(x.r)}</td><td>${pill(x.r)}</td></tr>`;
    }).join('');
  }

  function renderResults() {
    const box = $('#results'); if (!box) return;
    const warn = R.warnings.map((w) => `<p class="note warn">${sub(w)}</p>`).join('');
    if (!R.env || !R.env.worst) { box.innerHTML = warn || '<p class="empty">Aucune sollicitation.</p>'; return; }
    const env = R.env, w = env.worst;
    const mx = (keys) => keys.reduce((a, k) => (env.byCrit[k] && env.byCrit[k].r > a.r ? { r: env.byCrit[k].r, k } : a), { r: 0, k: null });
    const sec = mx(E.SEC_KEYS), mem = mx(E.MEM_KEYS);
    const kpi = (t, o, extra) => `<div class="kpi${o.r > 1 ? ' bad' : ''}"><b>${t}</b><span>${pct(o.r)}</span><small>${o.k ? sub(E.CRITERIA[o.k].label) + ' · ' + E.CRITERIA[o.k].ref : extra || ''}</small></div>`;
    const sl = R.sls.rows.reduce((a, r) => (r.ratio > a.ratio ? r : a), R.sls.rows[0] || { ratio: 0 });
    const ok = R.valid && R.max <= 1;
    let html = `${warn}<div class="kpis">
      <div class="kpi ${R.valid ? (ok ? 'hero' : 'bad') : 'bad'}"><b>Taux maximal</b><span>${R.valid ? pct(R.max) : '—'}</span><small>${!R.valid ? 'Hors domaine de validité' : ok ? 'Vérifié pour les critères traités*' : 'Élément non vérifié'}</small></div>
      ${kpi('Résistance des sections', sec)}
      ${kpi('Instabilités', mem)}
      <div class="kpi${R.sls.max > 1 ? ' bad' : ''}"><b>ELS</b><span>${pct(R.sls.max)}</span><small>${sl && sl.w > 0 ? esc(sl.label) + ' = L/' + Math.round(sl.Lratio) : 'aucune flèche'}${R.freq ? ' · f = ' + fmt(R.freq.f, 1) + ' Hz' : ''}</small></div>
      <div class="kpi"><b>Classe</b><span>${R.cls}</span><small>${esc(R.S.name)} · ${R.grade} · f<sub>y</sub> = ${R.fy} MPa</small></div>
    </div>
    <p class="note">* Vérifié pour les critères traités par Firmitas uniquement. Hors champ : assemblages, voilement de l'âme sous charge concentrée (EN 1993-1-5 § 6), raidisseurs, torsion, fatigue, feu, section nette en traction — voir l'onglet Méthode.</p>
    <div class="sub-title" style="margin-top:28px">ELU — enveloppe par critère <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:500">· ${env.n} combinaison${env.n > 1 ? 's' : ''}</span></div>
    <div class="cols2" style="grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)">
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Critère</th><th>Réf. EC3</th><th>Comb.</th><th class="num">Taux</th><th></th><th></th></tr></thead><tbody>
        ${critRows(env, E.SEC_KEYS)}<tr><td colspan="6" style="border:0;padding:4px"></td></tr>${critRows(env, E.MEM_KEYS)}
      </tbody></table></div>
      <div>${detailBlock(w)}</div>
    </div>`;
    if (R.mode !== 'direct') {
      html += `<div class="cols2" style="margin-top:20px">
        <div>${diagSvg(w, 'My', 'kN·m', 1e6, 'm', 'My,Ed — ' + esc(w.id))}${Math.max(...w.stations.map((p) => Math.abs(p.Mz))) > 0 ? diagSvg(w, 'Mz', 'kN·m', 1e6, 'm', 'Mz,Ed — ' + esc(w.id)) : ''}</div>
        <div>${diagSvg(w, 'Vz', 'kN', 1e3, 'v', 'Vz,Ed — ' + esc(w.id))}${Math.max(...w.stations.map((p) => Math.abs(p.Vy))) > 0 ? diagSvg(w, 'Vy', 'kN', 1e3, 'v', 'Vy,Ed — ' + esc(w.id)) : ''}</div>
      </div>`;
    }
    html += `<div class="sub-title" style="margin-top:28px">ELS — flèches <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:500">· portée de référence ${fmt(R.sls.Lref / 1000, 2)} m · E = 210 000 MPa</span></div>
      ${R.sls.rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Flèche</th><th>Plan</th><th class="num">w [mm]</th><th class="num">Limite [mm]</th><th class="num">soit</th><th class="num">Taux</th><th></th><th></th></tr></thead><tbody>
      ${R.sls.rows.map((r) => `<tr><td>${r.label}</td><td>${r.dir === 'z' ? 'fort (w<sub>z</sub>)' : 'faible (w<sub>y</sub>)'}</td><td class="num">${fmt(r.w, 1)}</td><td class="num">L/${r.limRatio} = ${fmt(r.lim, 1)}</td><td class="num">${r.w > 0 ? 'L/' + Math.round(r.Lratio) : '—'}</td><td class="num"><span class="ratio">${pct(r.ratio)}</span></td><td style="width:110px">${bar(r.ratio)}</td><td>${pill(r.ratio)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="empty">Aucune flèche à vérifier.</p>'}
      ${R.freq ? `<p class="note">Fréquence propre (flexion, plan fort) : f<sub>1</sub> = K/(2π·L²)·√(E·I<sub>y</sub>/m) = <b>${fmt(R.freq.f, 2)} Hz</b> avec K = ${fmt(R.freq.K, 3)} (${D.BC[state.bc].label.toLowerCase()}), m = ${fmt(R.freq.m, 0)} kg/m (G + ${fmtG(R.freq.psi, 2)}·Q réparties${R.freq.pt ? ', charges ponctuelles non comptées' : ''})${R.freq.fmin ? ` — exigence f ≥ ${fmtG(R.freq.fmin, 1)} Hz : ${R.freq.ratio <= 1 ? 'satisfaite' : '<b>non satisfaite</b>'}` : ''}.</p>` : ''}`;
    html += `<details class="fold"><summary>Toutes les combinaisons (${R.combos.length})</summary>
      <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>N°</th><th>Combinaison</th><th class="num">N [kN]</th><th class="num">M<sub>y,max</sub> [kN·m]</th><th class="num">M<sub>z,max</sub> [kN·m]</th><th class="num">V<sub>z,max</sub> [kN]</th><th class="num">Classe</th><th>Critère</th><th class="num">Taux</th></tr></thead><tbody>
      ${R.combos.map((c) => `<tr><td>${c.id}</td><td>${esc(c.label)}</td><td class="num">${kN(c.N)}</td><td class="num">${kNm(c.diag.Mymax)}</td><td class="num">${kNm(c.diag.Mzmax)}</td><td class="num">${kN(c.Vzmax)}</td><td class="num">${c.cls}</td><td class="f">${c.gov ? E.CRITERIA[c.gov].ref : '—'}</td><td class="num"><b>${pct(c.max)}</b></td></tr>`).join('')}
      </tbody></table></div></details>`;
    box.innerHTML = html;
  }

  function detailBlock(c) {
    const m = c.mem, s = c.sec, at = c.secSt;
    return `<div class="tbl-wrap"><table class="tbl compact">
      <tr><th>Combinaison dimensionnante</th><th>${esc(c.id)} — ${esc(c.label)}</th></tr>
      <tr><td>Section la plus sollicitée</td><td>x = ${fmt(at.x, 2)} m : N = ${kN(at.N)} kN · M<sub>y</sub> = ${kNm(at.My)} · M<sub>z</sub> = ${kNm(at.Mz)} kN·m · V<sub>z</sub> = ${kN(at.Vz)} kN</td></tr>
      <tr><td>Classe</td><td>${s.cls} (âme c/t = ${fmt(s.cl.web.ct, 1)}${s.cl.flange ? ', semelle c/t = ' + fmt(s.cl.flange.ct, 1) : ''}, ε = ${fmt(s.cl.eps, 3)})</td></tr>
      <tr><td>Résistances</td><td>N<sub>pl,Rd</sub> = ${kN(s.Npl)} kN · M<sub>y,V,Rd</sub> = ${kNm(s.MyRd)} kN·m · V<sub>pl,z,Rd</sub> = ${kN(s.Vplz)} kN${s.rhoz > 0 ? ' · ρ<sub>z</sub> = ' + fmt(s.rhoz, 3) : ''}</td></tr>
      <tr><td>Flambement</td><td>λ̄<sub>y</sub> = ${fmt(m.y.lam, 3)} → χ<sub>y</sub> = ${fmt(m.y.chi, 3)} (${m.y.curve}) · λ̄<sub>z</sub> = ${fmt(m.z.lam, 3)} → χ<sub>z</sub> = ${fmt(m.z.chi, 3)} (${m.z.curve})</td></tr>
      <tr><td>Déversement</td><td>${m.lt.skip ? sub(m.lt.skip) : `M<sub>cr</sub> = ${kNm(m.lt.Mcr)} kN·m · λ̄<sub>LT</sub> = ${fmt(m.lt.lam, 3)} → χ<sub>LT</sub> = ${fmt(m.lt.chi, 3)} · M<sub>b,Rd</sub> = ${kNm(m.lt.MbRd)} kN·m`}</td></tr>
      <tr><td>Interaction (annexe B)</td><td>C<sub>my</sub> = ${fmt(m.cmy.cm, 3)} · C<sub>mz</sub> = ${fmt(m.cmz.cm, 3)} · k<sub>yy</sub> = ${fmt(m.kyy, 3)} · k<sub>yz</sub> = ${fmt(m.kyz, 3)} · k<sub>zy</sub> = ${fmt(m.kzy, 3)} · k<sub>zz</sub> = ${fmt(m.kzz, 3)}</td></tr>
      <tr><td>Critère dimensionnant</td><td><b>${c.gov ? sub(E.CRITERIA[c.gov].label) + ' (' + E.CRITERIA[c.gov].ref + ')' : '—'} : ${pct(c.max)}</b></td></tr>
    </table></div>`;
  }

  // ======================================================================
  //  DÉTAIL
  // ======================================================================
  function renderDetail(app) {
    recompute();
    if (!R.env || !R.env.worst) { app.innerHTML = `<div class="page">${blockHead('—', 'Détail', 'Aucun résultat.')}</div>`; return; }
    const c = R.env.worst, m = c.mem, s = c.sec, S = R.S, P = R.P;
    const line = (a, b) => `<tr><td>${a}</td><td class="num">${b}</td></tr>`;
    const clRow = (n, w) => (w ? `<tr><td>${n}</td><td class="num">${fmt(w.ct, 2)}</td><td>${({ comp: 'comprimée', bend: 'fléchie', nm: 'fléchie et comprimée', out: 'en console', tube: 'tube', none: 'non comprimée' })[w.mode] || w.mode}</td><td class="num">${w.lim ? w.lim.map((x) => fmt(x, 1)).join(' / ') : '—'}</td><td class="num">${w.alpha != null ? fmt(w.alpha, 3) : '—'}</td><td class="num"><b>${w.cls}</b></td></tr>` : '');
    app.innerHTML = `<div class="page">
      ${blockHead('—', 'Détail', `Calculs intermédiaires de l'élément courant « ${esc(state.name)} » — ${esc(S.name)} ${R.grade}, combinaison dimensionnante ${esc(c.id)} (${esc(c.label)}).`)}
      <div class="cols2">
        <div>
          <div class="sub-title" style="margin-top:0">Classification — tableau 5.2 (torseur de la barre)</div>
          <table class="tbl compact"><thead><tr><th>Paroi</th><th class="num">c/t</th><th>Sollicitation</th><th class="num">Limites cl. 1/2/3</th><th class="num">α</th><th class="num">Classe</th></tr></thead><tbody>
            ${clRow(S.type === 'CHS' ? 'Tube d/t' : S.type === 'I' ? 'Âme' : 'Parois de hauteur h', m.cl.web)}${clRow(S.type === 'I' ? 'Semelle' : 'Parois de largeur b', m.cl.flange)}
          </tbody></table>
          <p class="note">c<sub>âme</sub> = h − 2t<sub>f</sub> − 2r ; c<sub>semelle</sub> = (b − t<sub>w</sub>)/2 − r ; tubes : c = h − 3t (NF EN 1993-1-1 tableau 5.2). Pour l'âme en flexion composée : α = ½·(1 + N<sub>Ed</sub>/(c·t<sub>w</sub>·f<sub>y</sub>)), ψ = 2N<sub>Ed</sub>/(A·f<sub>y</sub>) − 1. Compression seule : classe ${P.cN.cls}${P.ae ? `, A<sub>eff</sub> = ${fmt(P.Aeff / 100, 2)} cm² (ρ<sub>âme</sub> = ${fmt(P.ae.rw, 3)}, ρ<sub>semelle</sub> = ${fmt(P.ae.rf, 3)})` : ''} ; flexion seule : classe ${P.cMy.cls}.</p>
          <div class="sub-title">Résistance des sections — § 6.2 (x = ${fmt(c.secSt.x, 2)} m)</div>
          <table class="tbl compact"><tbody>
            ${line('N<sub>pl,Rd</sub> = A·f<sub>y</sub>/γ<sub>M0</sub>', kN(s.Npl) + ' kN')}
            ${line('V<sub>pl,z,Rd</sub> = A<sub>v,z</sub>·f<sub>y</sub>/(√3·γ<sub>M0</sub>)', kN(s.Vplz) + ' kN')}
            ${S.type !== 'CHS' ? line('V<sub>pl,y,Rd</sub>', kN(s.Vply) + ' kN') : ''}
            ${line('ρ<sub>z</sub> / ρ<sub>y</sub> (6.2.8)', fmt(s.rhoz, 3) + ' / ' + fmt(s.rhoy, 3))}
            ${line(`M<sub>y,V,Rd</sub> (W<sub>${s.cls <= 2 ? 'pl' : 'el'}</sub>)`, kNm(s.MyRd) + ' kN·m')}
            ${line('M<sub>z,V,Rd</sub>', kNm(s.MzRd) + ' kN·m')}
            ${s.MNy != null ? line('n = N<sub>Ed</sub>/N<sub>V,Rd</sub> ; M<sub>N,y,Rd</sub> ; M<sub>N,z,Rd</sub>', `${fmt(s.n, 3)} ; ${kNm(s.MNy)} ; ${kNm(s.MNz)} kN·m`) : ''}
            ${s.alpha != null ? line('α ; β (6.41)', fmt(s.alpha, 2) + ' ; ' + fmt(s.beta, 2)) : ''}
          </tbody></table>
        </div>
        <div>
          <div class="sub-title" style="margin-top:0">Flambement — § 6.3.1</div>
          <table class="tbl compact"><thead><tr><th></th><th class="num">axe y</th><th class="num">axe z</th></tr></thead><tbody>
            ${[['L<sub>cr</sub> [m]', (a) => fmt(a.Lcr / 1000, 2)], ['N<sub>cr</sub> [kN]', (a) => kN(a.Ncr)], ['λ̄', (a) => fmt(a.lam, 3)], ['courbe / α', (a) => a.curve + ' / ' + fmt(a.alpha, 2)], ['Φ', (a) => fmt(a.phi, 3)], ['χ', (a) => fmt(a.chi, 3)], ['N<sub>b,Rd</sub> [kN]', (a) => kN(a.NbRd)]]
              .map(([l, f]) => `<tr><td>${l}</td><td class="num">${f(m.y)}</td><td class="num">${f(m.z)}</td></tr>`).join('')}
          </tbody></table>
          <div class="sub-title">Déversement — § 6.3.2</div>
          <table class="tbl compact"><tbody>
            ${m.lt.skip ? line('—', sub(m.lt.skip)) : `${line('L<sub>LT</sub> ; k ; k<sub>w</sub>', `${fmt(m.lt.L / 1000, 2)} m ; ${fmtG(m.lt.k, 2)} ; ${fmtG(m.lt.kw, 2)}`)}
            ${line('C<sub>1</sub> ; C<sub>2</sub> ; z<sub>g</sub>', `${fmt(m.lt.C1, 3)} ; ${fmt(m.lt.C2, 3)} ; ${fmtG(m.lt.zg, 1)} mm`)}
            ${line('M<sub>cr</sub>', kNm(m.lt.Mcr) + ' kN·m')}
            ${line('λ̄<sub>LT</sub> = √(W<sub>y</sub>·f<sub>y</sub>/M<sub>cr</sub>)', fmt(m.lt.lam, 3))}
            ${line('courbe (tableau 6.4) / α<sub>LT</sub>', m.lt.curve + ' / ' + fmt(m.lt.alpha, 2))}
            ${line('χ<sub>LT</sub> (6.3.2.2, cas général)', fmt(m.lt.chi, 3))}`}
            ${line('M<sub>b,Rd</sub>', kNm(m.lt.MbRd) + ' kN·m')}
          </tbody></table>
          <div class="sub-title">Flexion composée — § 6.3.3, annexe B (méthode 2)</div>
          <table class="tbl compact"><tbody>
            ${line('C<sub>my</sub> ; C<sub>mz</sub> ; C<sub>mLT</sub> (tableau B.3)', `${fmt(m.cmy.cm, 3)} ; ${fmt(m.cmz.cm, 3)} ; ${fmt(m.cmLT.cm, 3)}`)}
            ${line('Barre sensible à la torsion', m.sens ? 'oui (tableau B.2)' : 'non (tableau B.1)')}
            ${line('k<sub>yy</sub> ; k<sub>yz</sub>', `${fmt(m.kyy, 3)} ; ${fmt(m.kyz, 3)}`)}
            ${line('k<sub>zy</sub> ; k<sub>zz</sub>', `${fmt(m.kzy, 3)} ; ${fmt(m.kzz, 3)}`)}
            ${line('(6.61)', fmt(m.r.I1, 3))}${line('(6.62)', fmt(m.r.I2, 3))}
          </tbody></table>
        </div>
      </div>
    </div>`;
  }

  // ======================================================================
  //  SECTIONS (bibliothèque)
  // ======================================================================
  let libFam = null;
  function renderSections(app) {
    libFam = libFam || state.sec.fam || 'IPE';
    const list = D.CATALOG[libFam] || [];
    const nAdd = Object.values(D.CATALOG).reduce((a, l) => a + l.filter((x) => x.added).length, 0);
    const nAll = Object.values(D.CATALOG).reduce((a, l) => a + l.length, 0);
    const chips = D.FAMILIES.map((f) => `<button class="chip${f.id === libFam ? ' on' : ''}" data-act="libfam" data-v="${esc(f.id)}">${esc(f.id)} <small>${D.CATALOG[f.id].length}</small></button>`).join('');
    const rows = list.map((it) => {
      const S = it.make(); const cur = state.sec.kind === 'cat' && state.sec.fam === libFam && state.sec.name === it.name;
      return `<tr${cur ? ' class="gov"' : ''}><td><b>${esc(it.name)}</b>${it.added ? '<span class="tag">ajoutée</span>' : ''}${it.fixed ? '<span class="tag fix">corrigée</span>' : ''}</td>
        <td class="num">${fmtG(S.h, 1)}</td><td class="num">${fmtG(S.b, 1)}</td><td class="num">${fmtG(S.tw, 1)}</td><td class="num">${fmtG(S.tf, 1)}</td><td class="num">${fmt(S.G, 1)}</td><td class="num">${fmt(S.A / 100, 1)}</td>
        <td class="num">${fmtG(S.Iy / 1e4, 0)}</td><td class="num">${fmtG(S.Wply / 1e3, 0)}</td><td class="num">${fmtG(S.Iz / 1e4, 0)}</td><td class="num">${fmtG(S.Wplz / 1e3, 0)}</td><td class="num">${fmt(S.It / 1e4, 1)}</td><td class="num">${S.Iw ? fmtG(S.Iw / 1e6, 0) : '—'}</td>
        <td><button class="btn sm" data-act="useSec" data-v="${esc(it.name)}">Utiliser</button></td></tr>`;
    }).join('');
    app.innerHTML = `<div class="page">
      ${blockHead('—', 'Sections', `${nAll} profils, dont ${nAdd} ajoutés au classeur d'origine. Caractéristiques calculées depuis les dimensions (congés de raccordement inclus ; IPN : valeurs tabulées). Les tubes existent en finis à chaud (EN 10210-2) et formés à froid (EN 10219-2), sélection dans l'onglet Vérification.`)}
      <div class="chips" style="margin-bottom:16px">${chips}</div>
      <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Profil</th><th class="num">h</th><th class="num">b</th><th class="num">t<sub>w</sub></th><th class="num">t<sub>f</sub></th><th class="num">kg/m</th><th class="num">A cm²</th><th class="num">I<sub>y</sub> cm⁴</th><th class="num">W<sub>pl,y</sub> cm³</th><th class="num">I<sub>z</sub> cm⁴</th><th class="num">W<sub>pl,z</sub> cm³</th><th class="num">I<sub>t</sub> cm⁴</th><th class="num">I<sub>w</sub> cm⁶</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
  }

  // ======================================================================
  //  MÉTHODE (et contre-vérification du classeur)
  // ======================================================================
  function renderMethode(app) {
    app.innerHTML = `<div class="page">
      ${blockHead('—', 'Méthode', "Ce que calcule Firmitas, et la contre-vérification du classeur « Predim_poutre acier_v3 » dont il reprend le principe.")}
      <div class="cols2">
        <div>
          <div class="sub-title">Contre-vérification du classeur — anomalies relevées</div>
          <ol class="audit">
            <li><b class="sev">majeur</b><b>Coefficients partiels mal affectés.</b> L'effort tranchant ELU V<sub>z</sub> (AS33:AX36) multiplie la charge variable répartie par γ = I24 (= 1,0, prévu pour G<sub>y</sub>) au lieu de 1,5, et la charge permanente ponctuelle par I23 (1,5) : V<sub>z,Ed</sub> est sous-estimé dès qu'il y a des charges variables. Les sollicitations du plan faible (M<sub>z</sub>, V<sub>y</sub>) reçoivent γ = 1,0 (I24, I25) : non pondérées.</li>
            <li><b class="sev">majeur</b><b>Flèches et fréquence propre faussées par la mauvaise inertie.</b> La fréquence (cellule F105) utilise I<sub>z</sub> (Q12) au lieu de I<sub>y</sub>, et la masse (F108) additionne les charges des deux plans ; la deuxième formule (L5) mélange I<sub>y</sub> et le seul poids propre. Pour un IPE 80 : rapport I<sub>y</sub>/I<sub>z</sub> = 9,4, soit une fréquence sous-estimée d'un facteur 3.</li>
            <li><b class="sev">majeur</b><b>Flèches du plan faible</b> : les charges F<sub>y</sub> ne donnent aucune flèche w<sub>y</sub>, sauf pour la console où la charge ponctuelle G<sub>y</sub> (BE27) est ajoutée à la flèche du plan fort avec I<sub>y</sub>. Module pris à 205 000 MPa au lieu de 210 000.</li>
            <li><b class="sev">majeur</b><b>Bibliothèque de tubes</b> : I<sub>z</sub> multiplié par 10 pour les 46 tubes carrés 250 à 400 (ex. 350 × 350 × 11 : I<sub>y</sub> = 28 180 cm⁴, I<sub>z</sub> = 2 818 cm⁴) ; valeurs approchées de 3 à 7 % pour les tubes épais (≥ 10 mm) ; une ligne « 200 × 120 × 6,3 » en double avec des caractéristiques d'un autre profil ; tubes ronds non calculés (#VALEUR!, la formule bute sur le point décimal) ; « HD 400 × 1086 » et « RHS10x70x5,0 » mal nommés.</li>
            <li><b class="sev">majeur</b><b>Déversement</b> : M<sub>cr</sub> calculé avec C<sub>1</sub>, C<sub>2</sub>, k = 0,5 saisis à la main sans lien avec les appuis ni le diagramme (k = 0,5 par défaut = rotation empêchée, non sécuritaire pour une poutre courante) ; χ<sub>LT</sub> par la méthode générale mais λ̄<sub>LT,0</sub> non utilisé ; « C<sub>mLT</sub> = 1 » figé.</li>
            <li><b class="sev">majeur</b><b>Classification</b> faite avec les maxima de |M| et N en un même point fictif ; classe 4 seulement signalée (« non vérifiable ») mais les taux restent affichés comme valides.</li>
            <li><b class="sev m">moyen</b><b>Charges ponctuelles</b> : les torseurs sont des valeurs « conservatives » (signalé dans la feuille) — moment ponctuel de l'appuyé–encastré approché, cumul de maxima d'abscisses différentes. Firmitas calcule les sollicitations exactes en chaque section.</li>
            <li><b class="sev m">moyen</b><b>f<sub>y</sub></b> : un seul palier à 40 mm (tableau 3.1) appliqué sur t<sub>f</sub> ; l'AN française renvoie aux normes produits (EN 10025-2 : S355 → 345 MPa dès 16 mm). Firmitas propose les deux.</li>
            <li><b class="sev m">moyen</b><b>Combinaisons</b> : une seule (γ<sub>G</sub>·G + γ<sub>Q</sub>·Q), pas de G favorable (soulèvement), et les « coefficients dynamiques » (J22:J25) ne sont utilisés nulle part.</li>
            <li><b class="sev m">moyen</b><b>Tubes</b> : la ligne torsion renvoie #REF!, et la contrainte de cisaillement des tubes rectangulaires est calculée avec 2·t<sub>w</sub> mais V<sub>pl,Rd</sub> avec A<sub>v</sub> = A·h/(b+h) : deux méthodes mélangées selon la classe.</li>
            <li><b class="sev l">mineur</b><b>Données</b> : IPE 750 × 137 avec b = 265 au lieu de 263 mm et IPE 750 × 196 avec r = 20 au lieu de 17 mm (corrigés) ; profil « T60120R » mélangé aux IPE (retiré).</li>
          </ol>
          <p class="note">Résultats non concernés par ces points recoupés à 10<sup>-4</sup> près : N<sub>pl,Rd</sub>, V<sub>pl,Rd</sub>, M<sub>pl,Rd</sub>, classes, χ<sub>y</sub>, χ<sub>z</sub>, M<sub>cr</sub>, χ<sub>LT</sub>, moments et flèches sous charge répartie des 4 schémas (<a href="tests.html">tests.html</a>).</p>
        </div>
        <div>
          <div class="sub-title">Ce que calcule Firmitas</div>
          <p><b>Sections</b> : caractéristiques calculées depuis h, b, t<sub>w</sub>, t<sub>f</sub>, r (I laminés : congés ; I<sub>t</sub> par la formule du catalogue ArcelorMittal ; I<sub>w</sub> = I<sub>z</sub>·(h − t<sub>f</sub>)²/4) ; tubes avec rayons d'angle normalisés (EN 10210-2 : r<sub>o</sub> = 1,5t ; EN 10219-2 : 2t à 3t). Masses recoupées avec les catalogues à ± 1 %.</p>
          <p><b>Sollicitations</b> : poutre à une travée (appuyée, appuyée–encastrée, bi-encastrée, console), charges réparties et ponctuelles dans les deux plans, poids propre, effort normal ; sollicitations exactes en 41 sections + points de charge ; flèches par double intégration (400 pas).</p>
          <p><b>Classification</b> (tableau 5.2) sous le torseur réel de chaque section ; classe 4 en compression : A<sub>eff</sub> selon EN 1993-1-5 § 4.4 ; classe 4 en flexion : hors domaine (signalé).</p>
          <p><b>Résistance des sections</b> : 6.2.3 à 6.2.10 — N, V (A<sub>v</sub> selon 6.2.6(3)), M avec réduction ρ (6.2.8), N + M (6.36 à 6.41 en classes 1-2, sommation des contraintes en classe 3), tubes ronds M<sub>N</sub> = M<sub>pl</sub>(1 − n<sup>1,7</sup>).</p>
          <p><b>Instabilités</b> : flambement (6.46 à 6.49, courbes du tableau 6.2) ; déversement (6.54 à 6.57, cas général, courbes du tableau 6.4) avec M<sub>cr</sub> à 3 facteurs (C<sub>1</sub> déduit de la forme du diagramme, C<sub>2</sub> selon le chargement et z<sub>g</sub>) ; flexion composée (6.61), (6.62) avec les k<sub>ij</sub> de l'annexe B et C<sub>m</sub> du tableau B.3.</p>
          <p><b>ELS</b> : flèches G + Q et Q seules dans les deux plans (NF EN 1993-1-1/NA tableau 1) ; fréquence propre de flexion.</p>
          <div class="sub-title">Non couvert</div>
          <p style="font-size:14px">Assemblages ; voilement par cisaillement des âmes élancées (h<sub>w</sub>/t<sub>w</sub> &gt; 72ε, signalé) ; résistance de l'âme aux charges transversales (EN 1993-1-5 § 6) ; torsion ; section nette ; sections de classe 4 en flexion ; profils U, cornières, T ; continuité sur plusieurs travées ; feu ; fatigue ; vibrations au-delà de la fréquence propre.</p>
          <div class="sub-title">Bibliothèque complétée</div>
          <p style="font-size:14px">Ajouts : IPE 550 (absent du classeur) ; IPE A 360 à 600 ; IPE O 600 ; IPE 750 × 147, 173, 220 ; tubes ronds (calculés) ; PRS et tubes sur mesure saisis par leurs dimensions. Les familles HE AA/A/B/M 100 à 1000, HL, HD, UB, UC, IPN, SHS/RHS et CHS du classeur sont reprises.</p>
        </div>
      </div>
    </div>`;
  }

  // ======================================================================
  //  PROJETS
  // ======================================================================
  // modules d'assemblages enregistrés dans window.FirmitasModules (éclisse, plat soudé, platines…)
  const MODS = () => window.FirmitasModules || {};
  const kindOf = (it) => (it.kind || (it.state && it.state.kind) || 'beam');
  const modOf = (kind) => MODS()[kind];
  const isSplice = (it) => kindOf(it) !== 'beam';
  function summaryOf(st) {
    if (st && st.kind && modOf(st.kind)) { const m = modOf(st.kind); return m.api.summary(m.upgrade(JSON.parse(JSON.stringify(st)))); }
    try {
      const r = E.compute(st);
      return { type: 'Poutre', sec: r.S ? `${r.S.name} ${r.grade} · L = ${fmt(+st.L, 2)} m` : '—', gov: r.sls.max > (r.env ? r.env.max : 0) ? 'ELS — flèche' : (r.env && r.env.worst && r.env.worst.gov ? E.CRITERIA[r.env.worst.gov].label : ''), max: r.valid ? r.max : null };
    } catch (e) { return null; }
  }
  function renderProjets(app) {
    const kb = ST.usage() / 1024;
    const list = db.projects.map((p) => {
      const isCur = [db.current, db.currentS].concat(Object.values(db.curs || {})).some((c) => c && c.projectId === p.id);
      const rows = p.items.map((it) => {
        const sm = summaryOf(it.state) || {};
        const cur = curOf(kindOf(it));
        const isIt = cur && cur.projectId === p.id && cur.itemId === it.id;
        return `<tr${isIt ? ' class="gov"' : ''}><td><b>${esc(it.name)}</b></td><td>${esc(sm.type || '')}</td><td>${esc(sm.sec || '')}</td><td class="f">${sub(sm.gov || '')}</td><td class="num">${sm.max == null ? '—' : pct(sm.max)}</td><td>${pill(sm.max)}</td><td class="f">${new Date(it.updated).toLocaleDateString('fr-FR')}</td>
          <td style="white-space:nowrap"><button class="btn sm" data-act="open" data-p="${p.id}" data-i="${it.id}">Ouvrir</button> <button class="btn sm ghost" data-act="dupItem" data-p="${p.id}" data-i="${it.id}">Dupliquer</button> <button class="btn sm ghost" data-act="delItem" data-p="${p.id}" data-i="${it.id}">Supprimer</button></td></tr>`;
      }).join('');
      return `<div class="proj${isCur ? ' current' : ''}">
        <div class="proj-head"><h3>${esc(p.name)}</h3><span class="muted" style="font-size:13px">${p.items.length} vérification${p.items.length > 1 ? 's' : ''}</span><span class="grow"></span>
          <button class="btn sm" data-act="reportProj" data-p="${p.id}"${p.items.length ? '' : ' disabled'}>Fiches NDC du projet</button>
          <button class="btn sm" data-act="exportProj" data-p="${p.id}">Exporter .json</button>
          <button class="btn sm ghost" data-act="renameProj" data-p="${p.id}">Renommer</button>
          <button class="btn sm ghost" data-act="delProj" data-p="${p.id}">Supprimer</button></div>
        ${p.items.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Repère</th><th>Type</th><th>Élément</th><th>Critère dimensionnant</th><th class="num">Taux</th><th></th><th>Modifié</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="empty">Aucune vérification enregistrée dans ce projet.</p>'}
      </div>`;
    }).join('');
    app.innerHTML = `<div class="page">
      ${blockHead('—', 'Projets', "Chaque projet regroupe les vérifications enregistrées. Les données restent dans ce navigateur (aucun serveur) : exporter le projet en .json pour l'archiver avec l'affaire ou le rouvrir sur un autre poste.")}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
        <button class="btn primary" data-act="newProj">Nouveau projet</button>
        <label class="btn" style="cursor:pointer">Importer un .json<input type="file" accept=".json,application/json" data-act="import" hidden></label>
        <span class="muted" style="font-size:12.5px;align-self:center">Stockage utilisé : ${fmt(kb, 1)} ko sur ~5 000 ko disponibles</span>
      </div>
      <div class="proj-list">${list || '<p class="empty">Aucun projet pour l\'instant. Créez-en un, puis enregistrez vos vérifications depuis l\'onglet Vérification.</p>'}</div>
    </div>`;
  }

  // ---------- modales ----------
  function modal(title, body, actions) {
    return new Promise((resolve) => {
      const bg = document.createElement('div'); bg.className = 'modal-bg';
      bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h3>${title}</h3>${body}<div class="row-actions">${actions.map((a, i) => `<button class="btn${a.primary ? ' primary' : ''}" data-i="${i}">${a.label}</button>`).join('')}</div></div>`;
      document.body.appendChild(bg);
      const close = (v) => { bg.remove(); resolve(v); };
      bg.addEventListener('click', (e) => { if (e.target === bg) return close(null); const b = e.target.closest('button[data-i]'); if (b) { const a = actions[+b.dataset.i]; close(a.value ? a.value(bg) : null); } });
      bg.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close(null);
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') { const a = actions.find((x) => x.primary); close(a && a.value ? a.value(bg) : null); }
      });
      const f = bg.querySelector('input,select'); if (f) { f.focus(); if (f.select) f.select(); }
    });
  }
  const confirmBox = (title, text) => modal(title, `<p>${text}</p>`, [{ label: 'Annuler' }, { label: 'Confirmer', primary: true, value: () => true }]);
  const curOf = (kind) => (kind === 'eclisse' ? db.currentS : kind === 'beam' ? db.current : (db.curs || {})[kind]);
  const setCur = (kind, v) => { if (kind === 'eclisse') db.currentS = v; else if (kind === 'beam') db.current = v; else { db.curs = db.curs || {}; db.curs[kind] = v; } };
  function crumbK(kind) {
    const c = curOf(kind);
    const p = c && db.projects.find((x) => x.id === c.projectId);
    const it = p && p.items.find((x) => x.id === c.itemId);
    return { p, it };
  }
  async function askSave(asNew, obj = state, kind = 'beam') {
    const cc = curOf(kind) || db.current || db.currentS;
    const projOpts = db.projects.map((p) => `<option value="${p.id}"${cc && cc.projectId === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    return modal(asNew ? 'Enregistrer sous…' : 'Enregistrer la vérification', `
      <div class="fields wide" style="grid-template-columns:1fr">
        <label class="field">Projet<select id="mProj">${projOpts}<option value="__new"${db.projects.length ? '' : ' selected'}>+ Nouveau projet…</option></select></label>
        <label class="field" id="mNewWrap"${db.projects.length ? ' hidden' : ''}>Nom du nouveau projet<input type="text" id="mNewName" placeholder="ex. Pavillon"></label>
        <label class="field">Repère de l'élément<input type="text" id="mName" value="${esc(obj.name)}"></label>
      </div>`, [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, value: (bg) => ({ proj: $('#mProj', bg).value, newName: $('#mNewName', bg).value.trim(), name: $('#mName', bg).value.trim() }) }]);
  }
  document.addEventListener('change', (e) => { if (e.target.id === 'mProj') { const w = $('#mNewWrap'); if (w) w.hidden = e.target.value !== '__new'; } });
  function storeItem(projectId, itemId, name, obj = state, kind = 'beam') {
    const p = db.projects.find((x) => x.id === projectId);
    obj.name = name || obj.name;
    const copy = JSON.parse(JSON.stringify(obj));
    let it = itemId && p.items.find((x) => x.id === itemId);
    if (!it) { it = { id: ST.uid(), created: Date.now() }; p.items.push(it); }
    Object.assign(it, { name: obj.name || 'Sans nom', kind, state: copy, updated: Date.now() });
    setCur(kind, { projectId, itemId: it.id });
    if (kind === 'beam') { dirty = false; db.draft = state; db.draftDirty = false; }
    else { db.sdraft = obj; db.sdraftDirty = false; }
    toast(ST.save(db) ? 'Enregistré dans « ' + p.name + ' »' : 'Stockage du navigateur plein : exportez puis supprimez d\'anciens projets.');
  }
  async function doSave(asNew, obj = state, kind = 'beam') {
    const cur = crumbK(kind);
    if (!asNew && cur.p && cur.it) { storeItem(cur.p.id, cur.it.id, obj.name, obj, kind); if (kind === 'beam') refreshDynamic(); return true; }
    const r = await askSave(asNew, obj, kind); if (!r) return false;
    let pid = r.proj;
    if (pid === '__new' || !pid) { const p = { id: ST.uid(), name: r.newName || 'Projet sans nom', created: Date.now(), items: [] }; db.projects.push(p); pid = p.id; }
    storeItem(pid, null, r.name, obj, kind);
    if (kind === 'beam') route();
    return true;
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const slug = (s) => String(s || 'firmitas').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

  // ---------- événements ----------
  const app = $('#app');
  app.addEventListener('input', onEdit);
  app.addEventListener('change', onEdit);
  function onEdit(e) {
    const t = e.target;
    if (!t.dataset || !t.dataset.p || t.closest('.modal')) return;
    if (e.type === 'input' && (t.tagName === 'SELECT' || t.type === 'checkbox')) return;
    const p = t.dataset.p;
    let v = t.type === 'checkbox' ? t.checked : t.value;
    set(p, v);
    if (p === 'sec.fam') { const l = D.CATALOG[v] || []; state.sec.name = l.length ? l[Math.min(l.length - 1, Math.floor(l.length / 3))].name : ''; }
    if (p === 'sls.preset' && D.SLS_PRESETS[v]) {
      state.sls.tot = D.SLS_PRESETS[v].tot; state.sls.q = D.SLS_PRESETS[v].q;
      const a = $('[data-p="sls.tot"]'), b = $('[data-p="sls.q"]'); if (a) a.value = state.sls.tot; if (b) b.value = state.sls.q;
    }
    if (p === 'sls.tot' || p === 'sls.q') { state.sls.preset = 'custom'; const ps = $('[data-p="sls.preset"]'); if (ps) ps.value = 'custom'; }
    dirty = true; persistDraft();
    if ((t.dataset.rerender && e.type === 'change') || p === 'sec.fam' || (p === 'L' && e.type === 'change')) { const y = window.scrollY; renderVerification(app); window.scrollTo(0, y); return; }
    if (p === 'L' || p === 'bc') ['Lcry', 'Lcrz', 'LLT'].forEach((k) => { if (state.stab.link[k]) { const el = $(`[data-p="stab.${k}"]`); if (el) el.value = (state.bc === 'c' ? 2 : 1) * (+state.L || 0); } });
    refreshDynamic();
  }

  app.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.tagName === 'INPUT') return;
    const a = b.dataset.act;
    const rer = () => { const y = window.scrollY; renderVerification(app); window.scrollTo(0, y); };
    if (a === 'kind') { state.sec.kind = b.dataset.v; dirty = true; persistDraft(); rer(); }
    else if (a === 'mode') { state.mode = b.dataset.v; dirty = true; persistDraft(); rer(); }
    else if (a === 'save') doSave(false);
    else if (a === 'saveas') doSave(true);
    else if (a === 'new') {
      if (dirty && !(await confirmBox('Nouvelle vérification', 'Les modifications non enregistrées seront perdues. Continuer ?'))) return;
      const keep = db.current && db.current.projectId;
      state = ST.defaultState(); state.name = 'Nouvel élément';
      db.current = keep ? { projectId: keep, itemId: null } : null;
      dirty = false; persistDraft(); renderVerification(app);
    }
    else if (a === 'report') window.FirmitasReport.open([{ state, project: crumb().p ? crumb().p.name : '' }]);
    else if (a === 'libfam') { libFam = b.dataset.v; renderSections(app); }
    else if (a === 'useSec') { Object.assign(state.sec, { kind: 'cat', fam: libFam, name: b.dataset.v }); dirty = true; persistDraft(); location.hash = '#/verification'; toast(b.dataset.v + ' sélectionné'); }
    else if (a === 'newProj') {
      const n = await modal('Nouveau projet', '<label class="field">Nom<input type="text" id="mN" placeholder="ex. Pavillon"></label>', [{ label: 'Annuler' }, { label: 'Créer', primary: true, value: (bg) => $('#mN', bg).value.trim() }]);
      if (n == null) return;
      db.projects.push({ id: ST.uid(), name: n || 'Projet sans nom', created: Date.now(), items: [] }); ST.save(db); route();
    }
    else if (a === 'renameProj') {
      const p = db.projects.find((x) => x.id === b.dataset.p);
      const n = await modal('Renommer le projet', `<label class="field">Nom<input type="text" id="mN" value="${esc(p.name)}"></label>`, [{ label: 'Annuler' }, { label: 'Renommer', primary: true, value: (bg) => $('#mN', bg).value.trim() }]);
      if (n) { p.name = n; ST.save(db); route(); }
    }
    else if (a === 'delProj') {
      const p = db.projects.find((x) => x.id === b.dataset.p);
      if (!(await confirmBox('Supprimer le projet', `Supprimer « ${esc(p.name)} » et ses ${p.items.length} vérification(s) ? Pensez à l'exporter avant.`))) return;
      db.projects = db.projects.filter((x) => x !== p);
      if (db.current && db.current.projectId === p.id) db.current = null;
      ST.save(db); route();
    }
    else if (a === 'open' || a === 'dupItem' || a === 'delItem') {
      const p = db.projects.find((x) => x.id === b.dataset.p), it = p.items.find((x) => x.id === b.dataset.i);
      if (a === 'open' && isSplice(it)) {
        const m = modOf(kindOf(it)); if (!m) return;
        if (m.api.dirty && !(await confirmBox('Ouvrir', 'Les modifications non enregistrées de la vérification en cours seront perdues. Continuer ?'))) return;
        m.api.load(JSON.parse(JSON.stringify(it.state)));
        setCur(kindOf(it), { projectId: p.id, itemId: it.id }); ST.save(db);
        location.hash = '#/' + m.route;
      } else if (a === 'open') {
        if (dirty && !(await confirmBox('Ouvrir', 'Les modifications non enregistrées de la vérification en cours seront perdues. Continuer ?'))) return;
        state = ST.upgrade(JSON.parse(JSON.stringify(it.state)));
        db.current = { projectId: p.id, itemId: it.id }; dirty = false; persistDraft();
        location.hash = '#/verification';
      } else if (a === 'dupItem') {
        const c = JSON.parse(JSON.stringify(it)); c.id = ST.uid(); c.name = it.name + ' (copie)'; c.state.name = c.name; c.updated = Date.now();
        p.items.splice(p.items.indexOf(it) + 1, 0, c); ST.save(db); route();
      } else {
        if (!(await confirmBox('Supprimer', `Supprimer la vérification « ${esc(it.name)} » ?`))) return;
        p.items = p.items.filter((x) => x !== it);
        [db.current, db.currentS].concat(Object.values(db.curs || {})).forEach((c) => { if (c && c.itemId === it.id) c.itemId = null; });
        ST.save(db); route();
      }
    }
    else if (a === 'exportProj') {
      const p = db.projects.find((x) => x.id === b.dataset.p);
      download('firmitas-' + slug(p.name) + '.json', JSON.stringify({ firmitas: 1, exported: new Date().toISOString(), project: p }, null, 1), 'application/json');
    }
    else if (a === 'reportProj') {
      const p = db.projects.find((x) => x.id === b.dataset.p);
      window.FirmitasReport.open(p.items.map((it) => ({ state: isSplice(it) ? JSON.parse(JSON.stringify(it.state)) : ST.upgrade(JSON.parse(JSON.stringify(it.state))), project: p.name })));
    }
  });
  app.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.act === 'import' && t.files && t.files[0]) {
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const j = JSON.parse(fr.result), p = j.project || j;
          if (!p || !Array.isArray(p.items)) throw new Error('format');
          p.id = ST.uid();
          if (db.projects.some((x) => x.name === p.name)) p.name += ' (import)';
          p.items.forEach((it) => { it.id = ST.uid(); it.state = isSplice(it) ? (modOf(kindOf(it)) ? modOf(kindOf(it)).upgrade(it.state) : it.state) : ST.upgrade(it.state); });
          db.projects.push(p); ST.save(db); route(); toast('Projet « ' + p.name + ' » importé');
        } catch (err) { toast('Fichier non reconnu'); }
      };
      fr.readAsText(t.files[0]);
    }
  });

  // ---------- routage ----------
  function route() {
    const r = (location.hash.replace(/^#\/?/, '') || 'verification').split('/')[0];
    $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === r));
    const { p } = crumb();
    $('#topMeta').innerHTML = p ? `${esc(p.name)}<span>${p.items.length} vérification${p.items.length > 1 ? 's' : ''}</span>` : 'Vérification acier<span>NF EN 1993-1-1 + AN</span>';
    const mr = Object.values(MODS()).find((m) => m.route === r);
    if (mr) { const ps = crumbK(mr.kind).p; $('#topMeta').innerHTML = ps ? `${esc(ps.name)}<span>${esc(mr.short)}</span>` : `${esc(mr.title)}<span>${esc(mr.ref)}</span>`; }
    const views = { verification: renderVerification, detail: renderDetail, sections: renderSections, methode: renderMethode, projets: renderProjets };
    if (mr) mr.api.render(app); else (views[r] || renderVerification)(app);
    if (r !== 'verification') window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', () => { db.draft = state; db.draftDirty = dirty; Object.values(MODS()).forEach((m) => m.api.flush(db)); ST.save(db); });
  window.FirmitasApp = {
    fmt, fmtG, pct, esc, sub, sectionSvg, get state() { return state; },
    crumbK, confirmBox, saveDb: () => ST.save(db),
    saveItem: (kind, obj, asNew) => doSave(asNew, obj, kind),
    newItem: (kind) => { const c = curOf(kind); setCur(kind, c ? { projectId: c.projectId, itemId: null } : null); ST.save(db); }
  };
  Object.values(MODS()).forEach((m) => { m.api.init(db); m.api.bind(app); });
  route();
})();
