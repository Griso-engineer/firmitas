/* ==========================================================================
   Firmitas — module « Soudures » : interface, schéma de convention, fiche NDC
   ========================================================================== */
(function () {
  'use strict';
  const C = window.FirmitasWeldCalc, D = window.FIRMITAS_DATA;
  const A = () => window.FirmitasApp, DR = window.FirmitasSpliceDraw;
  const { T, svgWrap, rect, INK, MUTED, ACC, BEAM, RED, DIM } = DR.util;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
  const fmtG = (x, d = 3) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { maximumFractionDigits: d }) : '—');
  const pct = (r) => (Number.isFinite(r) ? Math.round(r * 100) + ' %' : '∞');
  const sub = (s) => esc(s).replace(/_([A-Za-z0-9,.]+)/g, '<sub>$1</sub>');
  const bar = (r) => `<div class="bar"><i class="${!(r <= 1) ? 'ko' : r > 0.9 ? 'hi' : ''}" style="width:${Math.min(100, (Number.isFinite(r) ? r : 1) * 100)}%"></i></div>`;
  const pill = (r) => (r == null ? '<span class="pill na">—</span>' : r <= 1 ? '<span class="pill ok">OK</span>' : '<span class="pill ko">NON</span>');
  const fU = (v, u) => (u === 'mm' ? fmtG(v, 1) : fmt(v, 1));
  let st = null, dirty = false, db = null, uid = 0;
  const get = (p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), st);
  function set(p, v) { const ks = p.split('.'); let a = st; ks.slice(0, -1).forEach((k) => { if (a[k] == null) a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }
  const inp = (p, o = {}) => `<input type="${o.type || 'number'}" data-wp="${p}" value="${esc(get(p))}"${(o.type || 'number') === 'number' ? ' step="any"' : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>`;
  const sel = (p, opts, o = {}) => { const v = String(get(p)); return `<select data-wp="${p}"${o.rr ? ' data-rr="1"' : ''}>${opts.map((x) => `<option value="${esc(x[0])}"${String(x[0]) === v ? ' selected' : ''}>${esc(x[1])}</option>`).join('')}</select>`; };
  const chk = (p, label) => `<label class="check"><input type="checkbox" data-wp="${p}"${get(p) ? ' checked' : ''}> ${label}</label>`;
  const field = (label, control, unit, hint) => `<label class="field"><span>${label}${unit ? ` <span class="u">[${unit}]</span>` : ''}</span>${control}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  const blockHead = (n, t, p) => `<div class="block-head"><span class="num">${n}</span><h2>${t}</h2><p>${p || ''}</p></div>`;
  const grades = () => Object.keys(D.STEELS).map((x) => [x, x]);
  const LOADK = ['FL', 'FN', 'FT'];

  function init(database) { db = database; st = db.draft_soudure ? C.upgrade(db.draft_soudure) : C.defaultState(); dirty = !!db.draftDirty_soudure; }
  function flush(dbx) { dbx.draft_soudure = st; dbx.draftDirty_soudure = dirty; }
  let saveT = null;
  function persist() { clearTimeout(saveT); saveT = setTimeout(() => { flush(db); A().saveDb(); }, 250); }

  // ======================================================================
  //  SCHÉMA : coupe perpendiculaire au cordon, conventions
  // ======================================================================
  function convention(s, R, W = 420, H = 330) {
    const nw = +s.nw >= 2 ? 2 : 1, dir = s.mode === 'dir';
    const id = 'wa' + (++uid), idr = 'wr' + uid;
    const mk = (i, c) => `<marker id="${i}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L10,5L0,10z" fill="${c}"/></marker>`;
    const xs = 200, ws = 22, yb = 236, z = 52;          // pièce attachée centrée en x = xs, largeur ws ; dessus de la pièce support à y = yb
    let g = '';
    g += rect(40, yb, 340, 30, `fill="${BEAM}" stroke="${INK}" stroke-width=".9"`);
    g += rect(xs - ws / 2, 74, ws, yb - 74, `fill="${BEAM}" stroke="${INK}" stroke-width=".9"`);
    const tri = (sg) => { const x0 = xs + sg * ws / 2; return `<path d="M${x0},${yb} L${x0 + sg * z},${yb} L${x0},${yb - z} Z" fill="${ACC}" fill-opacity=".75" stroke="${INK}" stroke-width="1"/>`; };
    g += tri(1); if (nw === 2) g += tri(-1);
    // gorge du cordon 1
    const x0 = xs + ws / 2, xm = x0 + z / 2, ym = yb - z / 2;
    g += `<line x1="${x0}" y1="${yb}" x2="${xm}" y2="${ym}" stroke="${RED}" stroke-width="1.4" stroke-dasharray="4 2"/>`;
    g += T(xm + 6, ym - 2, 'a', { fs: 11, fw: 800, col: RED });
    g += T(x0 + z + 6, yb - 6, 'cordon 1', { fs: 9.5, col: MUTED });
    if (nw === 2) g += T(xs - ws / 2 - z - 6, yb - 6, 'cordon 2', { fs: 9.5, col: MUTED, a: 'end' });
    g += T(52, yb + 19, 'pièce support (1)', { fs: 9.5, col: INK });
    g += T(xs + ws / 2 + 6, 90, 'pièce attachée (2)', { fs: 9.5, col: INK });
    // efforts
    g += `<line x1="${xs}" y1="72" x2="${xs}" y2="34" stroke="#c0392b" stroke-width="2.4" marker-end="url(#${idr})"/>` + T(xs + 8, 44, 'F_N > 0'.replace('_N', '<tspan baseline-shift="sub" font-size="75%">N</tspan>'), { fs: 10.5, fw: 800, col: '#c0392b' });
    g += `<line x1="${xs - 92}" y1="140" x2="${xs - 18}" y2="140" stroke="#16a085" stroke-width="2.4" marker-end="url(#${id})"/>` + T(xs - 92, 132, 'F_T > 0'.replace('_T', '<tspan baseline-shift="sub" font-size="75%">T</tspan>'), { fs: 10.5, fw: 800, col: '#16a085' });
    g += `<circle cx="${xs}" cy="180" r="7" fill="#fff" stroke="${DIM}" stroke-width="1.6"/><circle cx="${xs}" cy="180" r="2" fill="${DIM}"/>`;
    g += T(xs + 46, 178, 'F_L : le long du cordon'.replace('_L', '<tspan baseline-shift="sub" font-size="75%">L</tspan>'), { fs: 10, fw: 800, col: DIM });
    g += `<line x1="${xs + 9}" y1="178" x2="${xs + 42}" y2="175" stroke="${DIM}" stroke-width=".6"/>`;
    g += T(8, 16, 'Convention — coupe perpendiculaire au cordon', { fw: 800, fs: 11.5 });
    g += T(8, 30, dir ? 'méthode directionnelle : la direction de chaque effort compte' : 'méthode simplifiée : seule la résultante compte, quelle que soit la direction', { fw: 500, fs: 9.5, col: MUTED });
    const lines = [
      'Efforts linéiques [N/mm = kN/m] sur l\'assemblage, partagés',
      nw === 2 ? 'à parts égales entre les 2 cordons (F_T de sens opposé pour le cordon 2).' : 'par l\'unique cordon. Cordon d\'angle à 90°.'
    ];
    lines.forEach((l, i) => { g += T(8, H - 26 + i * 13, l.replace(/_T/g, '<tspan baseline-shift="sub" font-size="75%">T</tspan>'), { fs: 9, fw: 500, col: MUTED }); });
    return svgWrap(W, H, g, mk(id, '#16a085') + mk(idr, '#c0392b'));
  }

  // ======================================================================
  //  PAGE
  // ======================================================================
  function render(app) {
    const { p } = A().crumbK('soudure');
    app.innerHTML = `<div class="page">
      <div class="actionbar">
        <div class="grow"><span class="crumb">${p ? `Projet <b>${esc(p.name)}</b> ›` : 'Hors projet ›'} <b id="wCrumb">${esc(st.name || 'Sans nom')}</b></span><span class="dirty" id="wDirty">${dirty ? 'modifié · non enregistré' : ''}</span></div>
        <span id="wVerdict"></span>
        <div class="btn-group"><button class="btn" data-wact="new">Nouveau</button><button class="btn" data-wact="save">Enregistrer</button><button class="btn" data-wact="saveas">Enregistrer sous…</button></div>
        <button class="btn primary" data-wact="report">Fiche NDC ↗</button>
      </div>
      ${blockHead('01', 'Méthode', 'Simplifiée : la résultante des efforts linéiques est comparée à F<sub>w,Rd</sub> quelle que soit sa direction (4.5.3.3). Directionnelle : les efforts sont décomposés dans la section de gorge, il faut préciser leur direction (4.5.3.2).')}
      <div class="chips">${[['simple', 'Simplifiée (4.5.3.3)'], ['dir', 'Directionnelle (4.5.3.2)']].map(([k, l]) => `<button type="button" class="chip${(st.mode || 'simple') === k ? ' on' : ''}" data-wact="mode" data-v="${k}">${l}</button>`).join('')}</div>
      ${blockHead('02', 'Pièces & cordon', 'f<sub>u</sub> et β<sub>w</sub> de la pièce la plus faible (4.5.3.2(6), tableau 4.1) ; f<sub>u</sub> minimal de la norme de produit selon l\'épaisseur.')}
      <div class="cols2"><div>
        <div class="fields">${field('Repère', inp('name', { type: 'text', ph: 'ex. Cordon platine P1' }))}</div>
        <div class="sub-title">Pièces assemblées</div>
        <div class="fields">
          ${field('Acier pièce support (1)', sel('p1.grade', grades()))}${field('Épaisseur t<sub>1</sub>', inp('p1.t'), 'mm')}
          ${field('Acier pièce attachée (2)', sel('p2.grade', grades()))}${field('Épaisseur t<sub>2</sub>', inp('p2.t'), 'mm')}
        </div>
        <div class="sub-title">Cordon</div>
        <div class="fields">
          ${field('Gorge a', inp('a'), 'mm')}
          ${field('Cordons', sel('nw', [['1', '1 cordon'], ['2', '2 cordons (de part et d\'autre)']], { rr: true }))}
          ${field('Longueur L', inp('L', { ph: 'facultatif' }), 'mm', 'Pour ℓ<sub>eff</sub> et le joint long')}
          ${field('γ<sub>M2</sub>', inp('gam.M2'))}
        </div>
        <div style="margin:12px 0;display:flex;gap:18px;flex-wrap:wrap">${chk('craters', 'Déduire 2·a aux extrémités (cratères)')}${chk('lap', 'Assemblage par recouvrement (joint long, 4.11)')}</div>
        <div id="wInfo" class="muted" style="font-size:12.5px;line-height:1.6"></div>
      </div>
      <div class="fig" id="wFig"></div></div>
      ${blockHead('03', 'Efforts linéiques ELU', 'Efforts par unité de longueur sur l\'assemblage, en N/mm (= kN/m). Une ligne par combinaison ; l\'enveloppe est vérifiée. Collage depuis Excel possible.')}
      <div class="tbl-wrap"><table class="grid">
        <thead><tr><th class="rowh">Combinaison</th><th>F<sub>L</sub> [N/mm]<br><small>le long du cordon</small></th><th>F<sub>N</sub> [N/mm]<br><small>⊥ pièce support</small></th><th>F<sub>T</sub> [N/mm]<br><small>∥ pièce support</small></th><th>Taux</th><th></th></tr></thead>
        <tbody>${st.loads.map((x, i) => `<tr><td><input type="text" data-wp="loads.${i}.name" value="${esc(x.name)}" style="min-width:150px;text-align:left"></td>${LOADK.map((k, j) => `<td><input type="number" step="any" data-wp="loads.${i}.${k}" data-lr="${i}" data-lc="${j}" value="${esc(x[k])}"></td>`).join('')}<td class="ro" id="wRate${i}"></td><td>${st.loads.length > 1 ? `<button class="btn sm ghost" data-wact="delLoad" data-i="${i}">✕</button>` : ''}</td></tr>`).join('')}</tbody>
      </table></div>
      <div style="margin:8px 0 14px"><button class="btn sm" data-wact="addLoad">+ Ajouter une combinaison</button></div>
      ${blockHead('04', 'Vérifications', 'NF EN 1993-1-8 § 4.5 et 4.11.')}
      <div id="wResults"></div>
    </div>`;
    refresh();
  }

  function refresh() {
    const E = C.computeEnv(st), R = E.runs[E.govIdx] || E.runs[0];
    const v = $('#wVerdict');
    if (v) v.innerHTML = !E.valid ? '<span class="verdict ko">— <small>données invalides</small></span>' : `<span class="verdict ${E.max <= 1 ? 'ok' : 'ko'}">${pct(E.max)} <small>${E.max <= 1 ? 'vérifié*' : 'non vérifié'}</small></span>`;
    const dd = $('#wDirty'); if (dd) dd.textContent = dirty ? 'modifié · non enregistré' : '';
    const cn = $('#wCrumb'); if (cn) cn.textContent = st.name || 'Sans nom';
    const fig = $('#wFig'); if (fig) fig.innerHTML = convention(st, R);
    E.perLoad.forEach((m, i) => { const c = $('#wRate' + i); if (c) c.innerHTML = `<b style="color:${m > 1 ? 'var(--c-red)' : 'inherit'}">${pct(m)}</b>${E.runs.length > 1 && i === E.govIdx ? ' ◂' : ''}`; });
    const box = $('#wResults'), info = $('#wInfo');
    if (!E.valid) { const w = E.runs.find((r) => !r.valid).warnings; if (box) box.innerHTML = w.map((x) => `<p class="note warn">${sub(x)}</p>`).join(''); if (info) info.innerHTML = ''; return; }
    const M = R.mat, G = R.geo;
    if (info) info.innerHTML = `Pièce la plus faible : <b style="color:var(--ink)">${esc(M.w.grade)}, t = ${fmtG(M.w.t, 1)} mm</b> — f<sub>u</sub> = ${M.w.fu} MPa, β<sub>w</sub> = ${fmtG(M.w.bw, 2)}<br>
      f<sub>vw,d</sub> = f<sub>u</sub>/(√3·β<sub>w</sub>·γ<sub>M2</sub>) = ${fmt(G.fvwd, 1)} MPa · F<sub>w,Rd</sub> = f<sub>vw,d</sub>·a${G.bLw < 1 ? '·β<sub>Lw,1</sub>' : ''} = <b style="color:var(--ink)">${fmt(G.FwRd, 1)} N/mm</b><br>
      ${G.leff != null ? `ℓ<sub>eff</sub> = ${fmtG(G.leff, 1)} mm${G.bLw < 1 ? ` · β<sub>Lw,1</sub> = ${fmt(G.bLw, 3)}` : ''}` : 'Longueur non renseignée : ℓ<sub>eff</sub> et joint long non vérifiés'}`;
    if (!box) return;
    const multi = st.loads.length > 1;
    const rows = E.rows.map((c) => `<tr${E.gov === c ? ' class="gov"' : ''}><td>${sub(c.label)}</td><td class="f">${c.ref}</td>${multi ? `<td class="f">${esc(c.name)}</td>` : ''}<td class="num">${fU(c.Ed, c.unit)}</td><td class="num">${fU(c.Rd, c.unit)}</td><td class="f">${c.unit}</td><td class="num"><span class="ratio">${pct(c.geo ? c.rg : c.r)}</span></td><td style="width:100px">${bar(c.r)}</td><td>${pill(c.r)}</td></tr>`).join('');
    const warns = [...new Set(E.runs.flatMap((r) => r.warnings))], infos = [...new Set(E.runs.flatMap((r) => r.info))];
    const dir = st.mode === 'dir';
    const stress = dir ? `<div class="sub-title" style="margin-top:22px">Contraintes dans la gorge${multi ? ' — ' + esc(R.loadName) : ''}</div>
      <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Cordon</th><th class="num">σ⊥ [MPa]</th><th class="num">τ⊥ [MPa]</th><th class="num">τ∥ [MPa]</th><th class="num">σ<sub>eq</sub> [MPa]</th><th class="num">Taux</th></tr></thead><tbody>
      ${R.dir.welds.map((x, i) => `<tr${i === R.dir.wi ? ' class="gov"' : ''}><td>${i + 1}</td><td class="num">${fmt(x.sn, 1)}</td><td class="num">${fmt(x.tn, 1)}</td><td class="num">${fmt(x.tl, 1)}</td><td class="num">${fmt(x.eq, 1)}</td><td class="num">${pct(x.r)}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">Cordon 1 : σ⊥ = (F<sub>N</sub> − F<sub>T</sub>)/(n·√2·a), τ⊥ = (F<sub>N</sub> + F<sub>T</sub>)/(n·√2·a), τ∥ = F<sub>L</sub>/(n·a), n = nombre de cordons ; cordon 2 : F<sub>T</sub> changé de signe. Limites : f<sub>u</sub>/(β<sub>w</sub>·γ<sub>M2</sub>) = ${fmt(G.lim1, 1)} MPa et 0,9·f<sub>u</sub>/γ<sub>M2</sub> = ${fmt(G.lim2, 1)} MPa (|σ⊥| retenu, compression comprise).</p>` : '';
    box.innerHTML = `${warns.map((w) => `<p class="note warn">${sub(w)}</p>`).join('')}${infos.map((w) => `<p class="note">${sub(w)}</p>`).join('')}
      <div class="kpis k3">
        <div class="kpi ${E.max <= 1 ? 'hero' : 'bad'}"><b>Taux maximal</b><span>${pct(E.max)}</span><small>${E.max <= 1 ? 'Vérifié pour les critères traités*' : 'Cordon non vérifié'}${multi ? ' · ' + esc(st.loads[E.govIdx].name) : ''}</small></div>
        <div class="kpi"><b>Méthode simplifiée</b><span>${pct(Math.max(...E.runs.map((r) => r.simple.r)))}</span><small>F<sub>w,Rd</sub> = ${fmt(G.FwRd, 0)} N/mm${!dir ? ' · retenue' : ''}</small></div>
        <div class="kpi"><b>Méthode directionnelle</b><span>${pct(Math.max(...E.runs.map((r) => r.dir.r)))}</span><small>${dir ? 'retenue' : 'pour comparaison'}</small></div>
      </div>
      <div class="tbl-wrap" style="margin-top:18px"><table class="tbl"><thead><tr><th>Critère</th><th>Réf. EC3</th>${multi ? '<th>Combinaison</th>' : ''}<th class="num">E<sub>d</sub></th><th class="num">R<sub>d</sub></th><th>Unité</th><th class="num">Taux</th><th></th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      ${stress}
      <p class="note">* Critères traités : résistance du cordon d'angle (méthode retenue), gorge minimale, longueur efficace minimale, joint long par recouvrement. Hors champ : soudures bout à bout (pleine pénétration : résistance de la pièce la plus faible), cordons d'angle hors 90°, répartition des efforts le long d'un cordon non uniformément chargé, fatigue.</p>`;
  }

  // ======================================================================
  //  FICHE NDC
  // ======================================================================
  function page(state, project, idx, total, opts) {
    const s = C.upgrade(JSON.parse(JSON.stringify(state)));
    const E = C.computeEnv(s), R = E.runs[E.govIdx] || E.runs[0];
    if (!E.valid) return `<section class="rp-page"><p>${esc(s.name)} : données invalides.</p></section>`;
    const M = R.mat, G = R.geo, multi = s.loads.length > 1, dir = s.mode === 'dir';
    const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const head = `<header class="rp-head"><div class="l"><b>${esc(project || 'Note de calcul')}</b>Vérification de soudure — NF EN 1993-1-8 § 4${opts && opts.ref ? ' · ' + esc(opts.ref) : ''}</div><div class="r">${!opts || opts.logo ? '<div class="logo-s">tracés</div>' : ''}${esc(s.name)} · ${date} · p. 1</div></header>`;
    let n = 0; const H2 = (t) => `<h2><span class="n">${++n}</span>${t}</h2>`;
    const kv = (a, b) => `<div><span>${a}</span><b>${b}</b></div>`;
    const chkRows = E.rows.map((c) => `<tr${E.gov === c ? ' class="gov"' : ''}><td>${sub(c.label)}</td><td>${c.ref}</td>${multi ? `<td>${esc(c.name)}</td>` : ''}<td class="num">${fU(c.Ed, c.unit)}</td><td class="num">${fU(c.Rd, c.unit)}</td><td>${c.unit}</td><td class="num">${pct(c.geo ? c.rg : c.r)}</td><td>${c.r <= 1 ? '<span class="rp-ok">OK</span>' : '<span class="rp-ko">Non vérifié</span>'}</td></tr>`).join('');
    const infos = [...new Set(E.runs.flatMap((r) => r.warnings.concat(r.info)))];
    return `<section class="rp-page">${head}
      <div class="rp-title"><h1>${esc(s.name)} — cordon d'angle a = ${fmtG(G.a, 1)} mm${total > 1 ? ` (${idx + 1}/${total})` : ''}</h1>
      <p>${G.nw === 2 ? '2 cordons' : '1 cordon'} · méthode ${dir ? 'directionnelle (4.5.3.2)' : 'simplifiée (4.5.3.3)'} · NF EN 1993-1-8 avec annexe nationale française</p></div>
      ${H2('Hypothèses')}
      <div class="rp-kv">
        ${kv('Pièce support (1)', `${esc(M.m1.grade)}, t = ${fmtG(M.m1.t, 1)} mm, f<sub>u</sub> = ${M.m1.fu} MPa`)}${kv('Pièce attachée (2)', `${esc(M.m2.grade)}, t = ${fmtG(M.m2.t, 1)} mm, f<sub>u</sub> = ${M.m2.fu} MPa`)}
        ${kv('Pièce la plus faible', `f<sub>u</sub> = ${M.w.fu} MPa, β<sub>w</sub> = ${fmtG(M.w.bw, 2)}, γ<sub>M2</sub> = ${fmtG(+s.gam.M2, 2)}`)}${kv('Résistance', `F<sub>w,Rd</sub> = ${fmt(G.FwRd, 1)} N/mm`)}
        ${kv('Longueur', G.leff != null ? `L = ${fmtG(G.Lw, 0)} mm, ℓ<sub>eff</sub> = ${fmtG(G.leff, 0)} mm${G.bLw < 1 ? `, β<sub>Lw,1</sub> = ${fmt(G.bLw, 3)}` : ''}` : 'non renseignée')}${kv('Cordons', G.nw === 2 ? '2, efforts partagés à parts égales' : '1')}
      </div>
      <div style="margin-top:4pt;max-width:120mm">${convention(s, R, 420, 330)}</div>
      ${H2(multi ? 'Efforts linéiques ELU' : 'Effort linéique ELU')}
      <table><thead><tr><th>Combinaison</th><th class="num">F<sub>L</sub> [N/mm]</th><th class="num">F<sub>N</sub> [N/mm]</th><th class="num">F<sub>T</sub> [N/mm]</th><th class="num">Taux</th></tr></thead><tbody>${s.loads.map((x, i) => `<tr${i === E.govIdx ? ' class="gov"' : ''}><td>${esc(x.name)}</td>${LOADK.map((k) => `<td class="num">${fmtG(+x[k] || 0, 1)}</td>`).join('')}<td class="num">${pct(E.perLoad[i])}</td></tr>`).join('')}</tbody></table>
      ${H2('Vérifications')}
      <table><thead><tr><th>Critère</th><th>Réf.</th>${multi ? '<th>Combinaison</th>' : ''}<th class="num">E<sub>d</sub></th><th class="num">R<sub>d</sub></th><th>Unité</th><th class="num">Taux</th><th>Statut</th></tr></thead><tbody>${chkRows}</tbody></table>
      ${dir ? `<p style="font-size:7.6pt">Contraintes${multi ? ' (' + esc(R.loadName) + ')' : ''} : ${R.dir.welds.map((x, i) => `cordon ${i + 1} : σ⊥ = ${fmt(x.sn, 1)}, τ⊥ = ${fmt(x.tn, 1)}, τ∥ = ${fmt(x.tl, 1)} MPa`).join(' ; ')}.</p>` : ''}
      ${infos.length ? `<p style="font-size:7.6pt"><b>Remarques :</b> ${infos.map(sub).join(' ')}</p>` : ''}
      <div class="rp-concl"><span>Conclusion — cordon a = ${fmtG(G.a, 1)} mm</span><b class="${E.max <= 1 ? 'rp-ok' : 'rp-ko'}">${E.max <= 1 ? 'Vérifié' : 'Non vérifié'} — taux max. ${pct(E.max)}</b></div>
      <p style="font-size:7.4pt;color:#555;margin-top:5pt">Critères couverts : NF EN 1993-1-8 § 4.5.2 (gorge ≥ 3 mm), 4.5.1 (longueur efficace), ${dir ? '4.5.3.2 (méthode directionnelle, éq. 4.1)' : '4.5.3.3 (méthode simplifiée)'}, 4.11 (joint long par recouvrement). Hors champ : soudures bout à bout, cordons hors 90°, fatigue.</p>
    </section>`;
  }

  // ======================================================================
  //  ÉVÉNEMENTS
  // ======================================================================
  function bind(app) {
    const onEdit = (e) => {
      const t = e.target; if (!t.dataset || !t.dataset.wp || t.closest('.modal')) return;
      if (e.type === 'input' && (t.tagName === 'SELECT' || t.type === 'checkbox')) return;
      const p = t.dataset.wp;
      set(p, t.type === 'checkbox' ? t.checked : t.value);
      dirty = true; persist();
      if (t.dataset.rr && e.type === 'change') { const y = window.scrollY; render(app); window.scrollTo(0, y); return; }
      refresh();
    };
    app.addEventListener('input', onEdit);
    app.addEventListener('change', onEdit);
    app.addEventListener('paste', (e) => {
      const t = e.target; if (!t.dataset || t.dataset.lr == null || !t.dataset.wp) return;
      const txt = (e.clipboardData || window.clipboardData).getData('text');
      if (!/[\t\n]/.test(txt)) return;
      e.preventDefault();
      const r0 = +t.dataset.lr, c0 = +t.dataset.lc;
      txt.replace(/\r/g, '').split('\n').filter((l) => l.trim().length).forEach((line, i) => {
        const r = r0 + i;
        while (st.loads.length <= r) st.loads.push({ name: 'ELU ' + (st.loads.length + 1), FL: 0, FN: 0, FT: 0 });
        line.split('\t').forEach((cell, j) => { const k = LOADK[c0 + j]; if (k) st.loads[r][k] = cell.trim().replace(/\s/g, '').replace(',', '.'); });
      });
      dirty = true; persist(); const y = window.scrollY; render(app); window.scrollTo(0, y);
    });
    app.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-wact]'); if (!b) return;
      const a = b.dataset.wact, y = window.scrollY;
      if (a === 'mode') { st.mode = b.dataset.v; dirty = true; persist(); render(app); window.scrollTo(0, y); }
      else if (a === 'addLoad') { const L = st.loads[st.loads.length - 1]; st.loads.push(Object.assign({}, L, { name: 'ELU ' + (st.loads.length + 1) })); dirty = true; persist(); render(app); window.scrollTo(0, y); }
      else if (a === 'delLoad') { st.loads.splice(+b.dataset.i, 1); dirty = true; persist(); render(app); window.scrollTo(0, y); }
      else if (a === 'save' || a === 'saveas') { const ok = await A().saveItem('soudure', st, a === 'saveas'); if (ok) { dirty = false; persist(); render(app); window.scrollTo(0, y); } }
      else if (a === 'new') {
        if (dirty && !(await A().confirmBox('Nouvelle soudure', 'Les modifications non enregistrées seront perdues. Continuer ?'))) return;
        st = C.defaultState(); st.name = 'Nouvelle soudure'; A().newItem('soudure'); dirty = false; persist(); render(app);
      }
      else if (a === 'report') window.FirmitasReport.open([{ state: st, project: A().crumbK('soudure').p ? A().crumbK('soudure').p.name : '' }]);
    });
  }
  function load(state) { st = C.upgrade(state); dirty = false; persist(); }

  const api = { init, render, bind, page, load, flush, get state() { return st; }, get dirty() { return dirty; }, summary: C.summary };
  window.FirmitasModules = window.FirmitasModules || {};
  window.FirmitasModules.soudure = { kind: 'soudure', route: 'soudure', title: 'Soudures', short: 'soudure', ref: 'NF EN 1993-1-8 § 4 + AN', api, upgrade: C.upgrade };
})();
