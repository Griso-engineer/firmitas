/* ==========================================================================
   Firmitas — module « Boulons » : interface, schéma de disposition, fiche NDC
   ========================================================================== */
(function () {
  'use strict';
  const C = window.FirmitasBoltCalc, D = window.FIRMITAS_DATA;
  const A = () => window.FirmitasApp, DR = window.FirmitasSpliceDraw;
  const { T, sb, svgWrap, dimH, dimV, rect, INK, MUTED, ACC, RED } = DR.util;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
  const fmtG = (x, d = 3) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { maximumFractionDigits: d }) : '—');
  const pct = (r) => (Number.isFinite(r) ? Math.round(r * 100) + ' %' : '∞');
  const sub = (s) => esc(s).replace(/_([A-Za-z0-9,.]+)/g, '<sub>$1</sub>');
  const bar = (r) => `<div class="bar"><i class="${!(r <= 1) ? 'ko' : r > 0.9 ? 'hi' : ''}" style="width:${Math.min(100, (Number.isFinite(r) ? r : 1) * 100)}%"></i></div>`;
  const pill = (r) => (r == null ? '<span class="pill na">—</span>' : r <= 1 ? '<span class="pill ok">OK</span>' : '<span class="pill ko">NON</span>');
  const fU = (v, u) => (u === 'kN' ? fmt(v / 1e3, 2) : u === 'kN·m' ? fmt(v / 1e6, 3) : u === 'mm' ? fmtG(v, 1) : fmt(v, 1));
  let st = null, dirty = false, db = null, uid = 0;
  const get = (p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), st);
  function set(p, v) { const ks = p.split('.'); let a = st; ks.slice(0, -1).forEach((k) => { if (a[k] == null) a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }
  const inp = (p, o = {}) => `<input type="${o.type || 'number'}" data-bp="${p}" value="${esc(get(p))}"${(o.type || 'number') === 'number' ? ' step="any"' : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>`;
  const sel = (p, opts, o = {}) => { const v = String(get(p)); return `<select data-bp="${p}"${o.rr ? ' data-rr="1"' : ''}>${opts.map((x) => `<option value="${esc(x[0])}"${String(x[0]) === v ? ' selected' : ''}>${esc(x[1])}</option>`).join('')}</select>`; };
  const chk = (p, label, rr) => `<label class="check"><input type="checkbox" data-bp="${p}"${get(p) ? ' checked' : ''}${rr ? ' data-rr="1"' : ''}> ${label}</label>`;
  const field = (label, control, unit, hint) => `<label class="field"><span>${label}${unit ? ` <span class="u">[${unit}]</span>` : ''}</span>${control}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  const blockHead = (n, t, p) => `<div class="block-head"><span class="num">${n}</span><h2>${t}</h2><p>${p || ''}</p></div>`;
  const chips = (p, opts) => `<div class="chips">${opts.map(([k, l]) => `<button type="button" class="chip${String(get(p)) === k ? ' on' : ''}" data-bact="chip" data-p="${p}" data-v="${k}">${l}</button>`).join('')}</div>`;
  const LOADK = ['Fv', 'Ft', 'Mb', 'Fb'];
  const HOLE_OPTS = [['normal', 'Normaux'], ['oversize', 'Surdimensionnés'], ['slotShortT', 'Oblongs courts ⊥ effort'], ['slotLongT', 'Oblongs longs ⊥ effort']];
  const GRP = [['bolt', 'Boulon'], ['geo', 'Pinces et entraxes'], ['plate', 'Pièce'], ['tap', 'Taraudage'], ['tq', 'Serrage']];

  function init(database) { db = database; st = db.draft_boulons ? C.upgrade(db.draft_boulons) : C.defaultState(); dirty = !!db.draftDirty_boulons; }
  function flush(dbx) { dbx.draft_boulons = st; dbx.draftDirty_boulons = dirty; }
  let saveT = null;
  function persist() { clearTimeout(saveT); saveT = setTimeout(() => { flush(db); A().saveDb(); }, 250); }

  // ======================================================================
  //  SCHÉMA : disposition autour du boulon vérifié (vue sur la pièce)
  // ======================================================================
  function layout(s, R, W = 420, H = 320) {
    const d0 = R.bear.d0, num = (v) => parseFloat(String(v).replace(',', '.')) || 0;
    const e1 = num(s.e1), e2 = num(s.e2), p1 = num(s.p1), p2 = num(s.p2);
    const end = s.pos1 === 'end', edge = s.pos2 === 'edge', hasP2 = !edge || p2 > 0;
    // repère : boulon vérifié en (0, 0) ; x = direction de l'effort (bord d'extrémité à gauche), y vers le haut
    const xL = end ? -e1 : -p1 - 1.6 * d0;
    const yB = edge ? -e2 : -p2 - 1.6 * d0, yT = hasP2 ? p2 + 1.4 * d0 : 2.6 * d0;
    const xR = Math.max(p1 * 0.9, 3 * d0, 1.2 * (yT - yB) + xL);
    const k = Math.min((W - 130) / (xR - xL), (H - 132) / (yT - yB));
    const X = (x) => 70 + (x - xL) * k, Y = (y) => 74 + (yT - y) * k;
    const id = 'ba' + (++uid);
    const zig = (x1, y1, x2, y2) => { const n = 6, dx = (x2 - x1) / n, dy = (y2 - y1) / n; let p = `M${x1},${y1}`; for (let i = 1; i <= n; i++) p += ` L${x1 + dx * i + (i % 2 ? 4 : -4) * (dy ? 1 : 0)},${y1 + dy * i + (i % 2 ? 4 : -4) * (dx ? 1 : 0)}`; return p; };
    let g = rect(X(xL), Y(yT), (xR - xL) * k, (yT - yB) * k, `fill="${ACC}" fill-opacity=".35" stroke="none"`);
    // bords : trait plein pour un bord libre, zigzag pour une pièce qui continue
    g += end ? `<line x1="${X(xL)}" y1="${Y(yT)}" x2="${X(xL)}" y2="${Y(yB)}" stroke="${INK}" stroke-width="1.4"/>` : `<path d="${zig(X(xL), Y(yT), X(xL), Y(yB))}" fill="none" stroke="${MUTED}" stroke-width=".9"/>`;
    g += `<path d="${zig(X(xR), Y(yT), X(xR), Y(yB))}" fill="none" stroke="${MUTED}" stroke-width=".9"/>`;
    g += edge ? `<line x1="${X(xL)}" y1="${Y(yB)}" x2="${X(xR)}" y2="${Y(yB)}" stroke="${INK}" stroke-width="1.4"/>` : `<path d="${zig(X(xL), Y(yB), X(xR), Y(yB))}" fill="none" stroke="${MUTED}" stroke-width=".9"/>`;
    g += `<path d="${zig(X(xL), Y(yT), X(xR), Y(yT))}" fill="none" stroke="${MUTED}" stroke-width=".9"/>`;
    // boulons voisins
    const r = Math.max(4, d0 / 2 * k);
    const nb = [];
    if (!end) nb.push([-p1, 0]);
    if (p1 > 0 && p1 < xR) nb.push([p1, 0]);
    if (hasP2) nb.push([0, p2]);
    if (!edge) nb.push([0, -p2]);
    nb.forEach(([x, y]) => { g += `<circle cx="${X(x)}" cy="${Y(y)}" r="${r}" fill="#fff" stroke="${MUTED}" stroke-width="1" stroke-dasharray="3 2"/>`; });
    g += `<circle cx="${X(0)}" cy="${Y(0)}" r="${r}" fill="${RED}" fill-opacity=".85" stroke="${INK}" stroke-width="1.2"/>`;
    // effort du boulon sur la pièce (vers le bord d'extrémité)
    // effort sur le boulon, dirigé vers le bord d'extrémité (gauche)
    const la = p1 > 0 ? Math.min(46, Math.max(20, p1 * k - 2 * r - 6)) : 46;
    g += `<line x1="${X(0) + r + 3 + la}" y1="${Y(0)}" x2="${X(0) + r + 3}" y2="${Y(0)}" stroke="${INK}" stroke-width="2.2" marker-end="url(#${id})"/>`;
    g += T(X(0) + r + 3 + la / 2, Y(0) - r - 4, sb('F_b,Ed'), { fs: 10, fw: 800, a: 'middle' });
    // cotes
    const yd = Y(yB) + 18;
    g += end ? dimH(X(xL), X(0), yd, `e_1 = ${fmtG(e1, 1)}`, { ext: Y(0) }) : dimH(X(-p1), X(0), yd, `p_1 = ${fmtG(p1, 1)}`, { ext: Y(0) });
    const xd = X(xL) - 16;
    g += edge ? dimV(Y(0), Y(yB), xd, `e_2 = ${fmtG(e2, 1)}`, { ext: X(0), left: true }) : dimV(Y(0), Y(-p2), xd, `p_2 = ${fmtG(p2, 1)}`, { ext: X(0), left: true });
    if (edge && p2 > 0) g += dimV(Y(p2), Y(0), xd, `p_2 = ${fmtG(p2, 1)}`, { ext: X(0), left: true });
    g += T(8, 16, 'Disposition — boulon vérifié en rouge', { fw: 800, fs: 11.5 });
    g += T(8, 30, `${end ? 'de rive' : 'intérieur'} dans la direction de l'effort, ${edge ? 'de rive' : 'intérieur'} perpendiculairement`, { fw: 500, fs: 9.5, col: MUTED });
    g += T(8, 43, `d₀ = ${fmtG(d0, 1)} mm · effort dirigé vers le bord d'extrémité`, { fw: 500, fs: 9.5, col: MUTED });
    g += T(8, H - 8, 'trait plein : bord libre · zigzag : pièce continue · tiretés : boulons voisins', { fw: 500, fs: 9, col: MUTED });
    return svgWrap(W, H, g, `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L10,5L0,10z" fill="${INK}"/></marker>`);
  }

  // ======================================================================
  //  PAGE
  // ======================================================================
  function render(app) {
    const { p } = A().crumbK('boulons');
    const custom = st.plate.grade === 'custom';
    app.innerHTML = `<div class="page">
      <div class="actionbar">
        <div class="grow"><span class="crumb">${p ? `Projet <b>${esc(p.name)}</b> ›` : 'Hors projet ›'} <b id="bCrumb">${esc(st.name || 'Sans nom')}</b></span><span class="dirty" id="bDirty">${dirty ? 'modifié · non enregistré' : ''}</span></div>
        <span id="bVerdict"></span>
        <div class="btn-group"><button class="btn" data-bact="new">Nouveau</button><button class="btn" data-bact="save">Enregistrer</button><button class="btn" data-bact="saveas">Enregistrer sous…</button></div>
        <button class="btn primary" data-bact="report">Fiche NDC ↗</button>
      </div>
      ${blockHead('01', 'Boulon', 'Boulon ordinaire (catégorie A / D) : cisaillement, traction, flexion éventuelle et interaction, NF EN 1993-1-8 tableau 3.4.')}
      <div class="cols2"><div>
        <div class="fields">${field('Repère', inp('name', { type: 'text', ph: 'ex. Boulon platine P2' }))}</div>
        <div class="fields" style="margin-top:14px">
          ${field('Diamètre', sel('d', Object.keys(C.SIZES).map((d) => [d, 'M' + d])))}
          ${field('Classe', sel('cls', Object.keys(C.CLASSES).map((x) => [x, x])))}
          ${field('Plans de cisaillement', inp('planes'))}
          ${field('γ<sub>M2</sub>', inp('gam.M2'))}
        </div>
        <div style="margin:12px 0;display:flex;gap:18px;flex-wrap:wrap">${chk('threads', 'Plan(s) de cisaillement dans le filetage')}${chk('csk', 'Tête fraisée (k<sub>2</sub> = 0,63)')}</div>
        <div class="fields wide">
          ${field('Résistance en flexion M<sub>b,Rd</sub>', sel('bend', Object.entries(C.BEND).map(([k, v]) => [k, v.label.replace(/_/g, '')]), { rr: true }))}
          ${st.bend === 'pin' ? field('γ<sub>M0</sub>', inp('gam.M0')) : ''}
        </div>
      </div>
      <div id="bInfo" class="muted" style="font-size:12.5px;line-height:1.7"></div></div>
      ${blockHead('02', 'Pièce & disposition', 'Pièce sur laquelle s\'exerce la pression diamétrale (et sous la tête ou l\'écrou pour le poinçonnement). Positions au sens du tableau 3.4.')}
      <div class="cols2"><div>
        <div class="fields">
          ${field('Acier de la pièce', sel('plate.grade', Object.keys(D.STEELS).map((x) => [x, x]).concat([['custom', 'f_u saisi']]), { rr: true }))}
          ${custom ? field('f<sub>u</sub> de la pièce', inp('plate.fu'), 'MPa') : ''}
          ${field('Épaisseur t', inp('plate.t'), 'mm')}
          ${field('Trous', sel('holes', HOLE_OPTS))}
        </div>
        <div class="sub-title">Dans la direction de l'effort</div>
        ${chips('pos1', [['end', 'Boulon de rive (e<sub>1</sub>)'], ['inner', 'Boulon intérieur (p<sub>1</sub>)']])}
        <div class="sub-title">Perpendiculairement à l'effort</div>
        ${chips('pos2', [['edge', 'Boulon de rive (e<sub>2</sub>)'], ['inner', 'Boulon intérieur (p<sub>2</sub>)']])}
        <div class="fields" style="margin-top:14px">
          ${st.pos1 === 'end' ? field('Pince e<sub>1</sub>', inp('e1'), 'mm') : field('Entraxe p<sub>1</sub>', inp('p1'), 'mm')}
          ${st.pos2 === 'edge' ? field('Pince e<sub>2</sub>', inp('e2'), 'mm') + field('Entraxe p<sub>2</sub>', inp('p2', { ph: '1 seule file' }), 'mm', 'Vide si une seule file') : field('Entraxe p<sub>2</sub>', inp('p2'), 'mm')}
        </div>
      </div>
      <div class="fig" id="bFig"></div></div>
      ${blockHead('03', 'Efforts par boulon ELU', 'F<sub>v,Ed</sub> : cisaillement total du boulon (tous plans) ; F<sub>t,Ed</sub> : traction ; M<sub>b,Ed</sub> : flexion du boulon (facultatif) ; F<sub>b,Ed</sub> : effort de pression diamétrale sur la pièce vérifiée (vide = F<sub>v,Ed</sub>). Collage depuis Excel possible.')}
      <div class="tbl-wrap"><table class="grid">
        <thead><tr><th class="rowh">Combinaison</th><th>F<sub>v,Ed</sub> [kN]</th><th>F<sub>t,Ed</sub> [kN]</th><th>M<sub>b,Ed</sub> [kN·m]</th><th>F<sub>b,Ed</sub> [kN]</th><th>Taux</th><th></th></tr></thead>
        <tbody>${st.loads.map((x, i) => `<tr><td><input type="text" data-bp="loads.${i}.name" value="${esc(x.name)}" style="min-width:150px;text-align:left"></td>${LOADK.map((k, j) => `<td><input type="number" step="any" data-bp="loads.${i}.${k}" data-lr="${i}" data-lc="${j}" value="${esc(x[k])}"${k === 'Fb' ? ' placeholder="= F_v"' : ''}></td>`).join('')}<td class="ro" id="bRate${i}"></td><td>${st.loads.length > 1 ? `<button class="btn sm ghost" data-bact="delLoad" data-i="${i}">✕</button>` : ''}</td></tr>`).join('')}</tbody>
      </table></div>
      <div style="margin:8px 0 14px"><button class="btn sm" data-bact="addLoad">+ Ajouter une combinaison</button></div>
      ${blockHead('04', 'Taraudage', 'Boulon vissé dans une pièce taraudée : longueur en prise minimale pour que le boulon rompe avant l\'arrachement des filets (Dose & Pittner, 1996), et cisaillement des filets sous F<sub>t,Ed</sub>.')}
      <div style="margin-bottom:12px">${chk('tap.on', 'Vérifier un taraudage', true)}</div>
      ${st.tap.on ? `<div class="fields">
        ${field('f<sub>u</sub> de la pièce taraudée (R<sub>m,M</sub>)', inp('tap.fu'), 'MPa')}
        ${field('Angle de filet', inp('tap.ang'), '°', '60° pour un filet métrique ISO')}
        ${field('Longueur en prise m', inp('tap.m', { ph: 'facultatif' }), 'mm', 'Vide : vérification à m = m<sub>min</sub>')}
      </div><div id="bTap" style="margin-top:12px"></div>` : ''}
      ${blockHead('05', 'Serrage', 'Couple de serrage pour une précontrainte donnée (VDI 2230) et contrainte dans le boulon pendant le serrage.')}
      <div style="margin-bottom:12px">${chk('tq.on', 'Calculer le couple de serrage', true)}</div>
      ${st.tq.on ? `<div class="fields">
        ${field('Précontrainte F', inp('tq.F'), 'kN')}
        ${field('µ<sub>G</sub> filets', inp('tq.muT'))}
        ${field('µ<sub>K</sub> sous tête', inp('tq.muH'))}
      </div><p class="note">Les coefficients de frottement dépendent du produit et du lubrifiant : à confirmer par l'entreprise.</p><div id="bTq"></div>` : ''}
      ${blockHead('06', 'Vérifications', 'NF EN 1993-1-8 § 3.5 et 3.6 ; enveloppe des combinaisons.')}
      <div id="bResults"></div>
    </div>`;
    refresh();
  }

  function refresh() {
    const E = C.computeEnv(st), R = E.runs[E.govIdx] || E.runs[0];
    const v = $('#bVerdict');
    if (v) v.innerHTML = !E.valid ? '<span class="verdict ko">— <small>données invalides</small></span>' : `<span class="verdict ${E.max <= 1 ? 'ok' : 'ko'}">${pct(E.max)} <small>${E.max <= 1 ? 'vérifié*' : 'non vérifié'}</small></span>`;
    const dd = $('#bDirty'); if (dd) dd.textContent = dirty ? 'modifié · non enregistré' : '';
    const cn = $('#bCrumb'); if (cn) cn.textContent = st.name || 'Sans nom';
    E.perLoad.forEach((m, i) => { const c = $('#bRate' + i); if (c) c.innerHTML = `<b style="color:${m > 1 ? 'var(--c-red)' : 'inherit'}">${pct(m)}</b>${E.runs.length > 1 && i === E.govIdx ? ' ◂' : ''}`; });
    const box = $('#bResults'), info = $('#bInfo'), fig = $('#bFig');
    if (!E.valid) { const w = E.runs.find((r) => !r.valid).warnings; if (box) box.innerHTML = w.map((x) => `<p class="note warn">${sub(x)}</p>`).join(''); if (info) info.innerHTML = ''; if (fig) fig.innerHTML = ''; return; }
    const B = R.bolt, Q = R.res, Bb = R.bear;
    if (fig) fig.innerHTML = layout(st, R);
    if (info) info.innerHTML = `<b style="color:var(--ink)">M${B.d} ${esc(B.cls)}</b> — f<sub>yb</sub> = ${B.fyb}, f<sub>ub</sub> = ${B.fub} MPa<br>
      A = ${fmt(B.A, 1)} mm², A<sub>s</sub> = ${fmtG(B.As, 1)} mm², d<sub>s</sub> = √(4A<sub>s</sub>/π) = ${fmt(B.ds, 2)} mm, pas P = ${fmtG(B.P, 2)} mm<br>
      d<sub>0</sub> = ${fmtG(B.d0, 1)} mm (EN 1090-2) · α<sub>v</sub> = ${fmtG(Q.av, 1)}<br>
      F<sub>v,Rd</sub> = <b style="color:var(--ink)">${fmt(Q.FvRd / 1e3, 2)} kN</b> · F<sub>t,Rd</sub> = <b style="color:var(--ink)">${fmt(Q.FtRd / 1e3, 2)} kN</b> · M<sub>b,Rd</sub> = <b style="color:var(--ink)">${fmt(Q.MbRd / 1e6, 4)} kN·m</b><br>
      Pièce : f<sub>u</sub> = ${fmtG(R.mat.fu, 0)} MPa, t = ${fmtG(R.mat.t, 1)} mm · α<sub>d</sub> = ${fmt(Bb.ad, 3)}, α<sub>b</sub> = ${fmt(Bb.ab, 3)}, k<sub>1</sub> = ${fmt(Bb.k1, 2)} → F<sub>b,Rd</sub> = <b style="color:var(--ink)">${fmt(Bb.FbRd / 1e3, 2)} kN</b>`;
    const tp = $('#bTap');
    if (tp && R.tap) { const X = R.tap; tp.innerHTML = `<div class="muted" style="font-size:12.5px;line-height:1.7">τ<sub>m,B</sub> = f<sub>ub</sub>/√3 = ${fmt(X.tB, 1)} MPa · τ<sub>m,M</sub> = ${fmt(X.tM, 1)} MPa · α<sub>B</sub> = ${fmt(X.ab, 3)}, α<sub>M</sub> = ${fmt(X.aM, 3)}<br>
      F<sub>B</sub> = A<sub>s</sub>·f<sub>ub</sub> = ${fmt(X.FB / 1e3, 2)} kN · d<sub>τ</sub> = ${fmt(X.dt, 3)} mm · A<sub>τ</sub> = F<sub>B</sub>·(1/τ<sub>m,B</sub> + 1/τ<sub>m,M</sub>) = ${fmt(X.At, 1)} mm²<br>
      Longueur en prise minimale : <b style="color:var(--ink)">m<sub>min</sub> = A<sub>τ</sub>/(π·d<sub>τ</sub>) = ${fmt(X.mmin, 2)} mm</b> (soit ${fmt(X.mmin / B.d, 2)}·d)${X.m > 0 ? '' : ' — contraintes ci-dessous calculées pour m = m<sub>min</sub>'}</div>`; }
    const tq = $('#bTq');
    if (tq && R.tq) { const X = R.tq; tq.innerHTML = `<div class="kpis k3"><div class="kpi"><b>Couple de serrage M<sub>A</sub></b><span>${fmt(X.MA / 1e3, 1)}</span><small>N·m — filets ${fmt(X.MG / 1e3, 1)} + tête ${fmt(X.MK / 1e3, 1)}</small></div>
      <div class="kpi"><b>F / F<sub>p,C</sub></b><span>${pct(X.F / X.FpC)}</span><small>F<sub>p,C</sub> = 0,7·f<sub>ub</sub>·A<sub>s</sub> = ${fmt(X.FpC / 1e3, 1)} kN</small></div>
      <div class="kpi"><b>Contrainte au serrage</b><span>${fmt(X.sred, 0)}</span><small>MPa — σ = ${fmt(X.sig, 0)}, τ = ${fmt(X.tau, 0)} MPa</small></div></div>
      <p class="note">M<sub>A</sub> = F·(0,16·P + 0,58·µ<sub>G</sub>·d<sub>2</sub> + µ<sub>K</sub>·D<sub>Km</sub>/2), d<sub>2</sub> = ${fmt(B.d2, 3)} mm, D<sub>Km</sub> = (s + d<sub>h</sub>)/2 = ${fmt(X.Dkm, 1)} mm. Formule du classeur (F·(µ<sub>G</sub>·1,25·d + µ<sub>K</sub>·1,3·d)/2) : ${fmt(X.MAxl / 1e3, 1)} N·m.</p>`; }
    if (!box) return;
    const multi = st.loads.length > 1;
    const row = (c) => `<tr${E.gov === c ? ' class="gov"' : ''}><td>${sub(c.label)}</td><td class="f">${c.ref}</td>${multi ? `<td class="f">${esc(c.name)}</td>` : ''}<td class="num">${c.ratioOnly ? '—' : fU(c.Ed, c.unit)}</td><td class="num">${c.ratioOnly ? '—' : fU(c.Rd, c.unit)}</td><td class="f">${c.ratioOnly ? '' : c.unit}</td><td class="num"><span class="ratio">${pct(c.geo ? c.rg : c.r)}</span></td><td style="width:100px">${bar(c.r)}</td><td>${pill(c.r)}</td></tr>`;
    const warns = [...new Set(E.runs.flatMap((r) => r.warnings))], infos = [...new Set(E.runs.flatMap((r) => r.info))];
    const gmax = (g) => E.rows.filter((c) => c.grp === g).reduce((a, c) => Math.max(a, c.r), 0);
    box.innerHTML = `${warns.map((w) => `<p class="note warn">${sub(w)}</p>`).join('')}${infos.map((w) => `<p class="note">${sub(w)}</p>`).join('')}
      <div class="kpis">
        <div class="kpi ${E.max <= 1 ? 'hero' : 'bad'}"><b>Taux maximal</b><span>${pct(E.max)}</span><small>${E.max <= 1 ? 'Vérifié pour les critères traités*' : 'Non vérifié'}${multi ? ' · ' + esc(st.loads[E.govIdx].name) : ''}</small></div>
        <div class="kpi${gmax('bolt') > 1 ? ' bad' : ''}"><b>Boulon</b><span>${pct(gmax('bolt'))}</span><small>cisaillement, traction, interaction</small></div>
        <div class="kpi${Math.max(gmax('plate'), gmax('geo')) > 1 ? ' bad' : ''}"><b>Pièce</b><span>${pct(Math.max(gmax('plate'), gmax('geo')))}</span><small>pression diamétrale, pinces</small></div>
        <div class="kpi${gmax('tap') > 1 ? ' bad' : ''}"><b>Taraudage</b><span>${st.tap.on ? pct(gmax('tap')) : '—'}</span><small>${st.tap.on ? 'filets' : 'non vérifié'}</small></div>
        <div class="kpi${gmax('tq') > 1 ? ' bad' : ''}"><b>Serrage</b><span>${st.tq.on ? pct(gmax('tq')) : '—'}</span><small>${st.tq.on ? 'contrainte réduite' : 'non calculé'}</small></div>
      </div>
      ${GRP.filter(([g]) => E.rows.some((c) => c.grp === g)).map(([g, t]) => `<div class="sub-title" style="margin-top:26px">${t}</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Critère</th><th>Réf.</th>${multi ? '<th>Combinaison</th>' : ''}<th class="num">E<sub>d</sub></th><th class="num">R<sub>d</sub></th><th>Unité</th><th class="num">Taux</th><th></th><th></th></tr></thead><tbody>${E.rows.filter((c) => c.grp === g).map(row).join('')}</tbody></table></div>`).join('')}
      <p class="note">* Critères traités : NF EN 1993-1-8 tableau 3.4 (cisaillement, traction, interaction, pression diamétrale avec k<sub>1</sub> et α<sub>b</sub> selon la position, poinçonnement), tableau 3.3 (pinces et entraxes minimaux, bloquants) ; flexion du boulon selon l'approche choisie (interaction ajoutée à celle du tableau 3.4) ; taraudage (Dose & Pittner, avec γ<sub>M2</sub>) ; serrage (VDI 2230). Hors champ : boulons précontraints (glissement), effet de levier, joints longs, rupture en bloc — voir les onglets d'assemblage.</p>`;
  }

  // ======================================================================
  //  FICHE NDC
  // ======================================================================
  function page(state, project, idx, total, opts) {
    const s = C.upgrade(JSON.parse(JSON.stringify(state)));
    const E = C.computeEnv(s), R = E.runs[E.govIdx] || E.runs[0];
    if (!E.valid) return `<section class="rp-page"><p>${esc(s.name)} : données invalides.</p></section>`;
    const B = R.bolt, Q = R.res, Bb = R.bear, multi = s.loads.length > 1;
    const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const head = `<header class="rp-head"><div class="l"><b>${esc(project || 'Note de calcul')}</b>Vérification de boulon — NF EN 1993-1-8 § 3${opts && opts.ref ? ' · ' + esc(opts.ref) : ''}</div><div class="r">${!opts || opts.logo ? '<div class="logo-s">tracés</div>' : ''}${esc(s.name)} · ${date} · p. 1</div></header>`;
    let n = 0; const H2 = (t) => `<h2><span class="n">${++n}</span>${t}</h2>`;
    const kv = (a, b) => `<div><span>${a}</span><b>${b}</b></div>`;
    const chkRows = E.rows.map((c) => `<tr${E.gov === c ? ' class="gov"' : ''}><td>${sub(c.label)}</td><td>${c.ref}</td>${multi ? `<td>${esc(c.name)}</td>` : ''}<td class="num">${c.ratioOnly ? '—' : fU(c.Ed, c.unit)}</td><td class="num">${c.ratioOnly ? '—' : fU(c.Rd, c.unit)}</td><td>${c.ratioOnly ? '' : c.unit}</td><td class="num">${pct(c.geo ? c.rg : c.r)}</td><td>${c.r <= 1 ? '<span class="rp-ok">OK</span>' : '<span class="rp-ko">Non vérifié</span>'}</td></tr>`).join('');
    const infos = [...new Set(E.runs.flatMap((r) => r.warnings.concat(r.info)))];
    return `<section class="rp-page">${head}
      <div class="rp-title"><h1>${esc(s.name)} — boulon M${B.d} ${esc(B.cls)}${total > 1 ? ` (${idx + 1}/${total})` : ''}</h1>
      <p>NF EN 1993-1-8 avec annexe nationale française${s.tap.on ? ' · taraudage (Dose & Pittner)' : ''}${s.tq.on ? ' · serrage (VDI 2230)' : ''}</p></div>
      ${H2('Hypothèses')}
      <div class="rp-kv">
        ${kv('Boulon', `M${B.d} ${esc(B.cls)}, f<sub>yb</sub> = ${B.fyb}, f<sub>ub</sub> = ${B.fub} MPa, A<sub>s</sub> = ${fmtG(B.As, 1)} mm²`)}${kv('Cisaillement', `${Math.max(1, Math.round(+s.planes || 1))} plan(s), ${s.threads ? 'dans le filetage' : 'fût lisse'}, α<sub>v</sub> = ${fmtG(Q.av, 1)}`)}
        ${kv('Résistances', `F<sub>v,Rd</sub> = ${fmt(Q.FvRd / 1e3, 1)} kN, F<sub>t,Rd</sub> = ${fmt(Q.FtRd / 1e3, 1)} kN`)}${kv('Flexion', `${C.BEND[s.bend in C.BEND ? s.bend : 'el'].label.replace(/_([A-Za-z0-9,]+)/g, '<sub>$1</sub>')} = ${fmt(Q.MbRd / 1e6, 4)} kN·m`)}
        ${kv('Pièce', `f<sub>u</sub> = ${fmtG(R.mat.fu, 0)} MPa, t = ${fmtG(R.mat.t, 1)} mm, trous ${HOLE_OPTS.find((h) => h[0] === s.holes) ? HOLE_OPTS.find((h) => h[0] === s.holes)[1].toLowerCase() : 'normaux'}, d<sub>0</sub> = ${fmtG(Bb.d0, 1)} mm`)}${kv('Pression diamétrale', `α<sub>b</sub> = ${fmt(Bb.ab, 3)}, k<sub>1</sub> = ${fmt(Bb.k1, 2)}, F<sub>b,Rd</sub> = ${fmt(Bb.FbRd / 1e3, 1)} kN`)}
        ${R.tap ? kv('Taraudage', `R<sub>m,M</sub> = ${fmtG(+s.tap.fu, 0)} MPa, m<sub>min</sub> = ${fmt(R.tap.mmin, 2)} mm${R.tap.m > 0 ? `, m = ${fmtG(R.tap.m, 1)} mm` : ''}`) : ''}${R.tq ? kv('Serrage', `F = ${fmtG(R.tq.F / 1e3, 1)} kN, µ<sub>G</sub> = ${s.tq.muT}, µ<sub>K</sub> = ${s.tq.muH} → M<sub>A</sub> = ${fmt(R.tq.MA / 1e3, 1)} N·m`) : ''}
      </div>
      <div style="margin-top:4pt;max-width:120mm">${layout(s, R, 420, 300)}</div>
      ${H2(multi ? 'Efforts par boulon ELU' : 'Effort par boulon ELU')}
      <table><thead><tr><th>Combinaison</th><th class="num">F<sub>v,Ed</sub> [kN]</th><th class="num">F<sub>t,Ed</sub> [kN]</th><th class="num">M<sub>b,Ed</sub> [kN·m]</th><th class="num">F<sub>b,Ed</sub> [kN]</th><th class="num">Taux</th></tr></thead><tbody>${s.loads.map((x, i) => `<tr${i === E.govIdx ? ' class="gov"' : ''}><td>${esc(x.name)}</td><td class="num">${fmtG(+x.Fv || 0, 2)}</td><td class="num">${fmtG(+x.Ft || 0, 2)}</td><td class="num">${fmtG(+x.Mb || 0, 4)}</td><td class="num">${String(x.Fb == null ? '' : x.Fb).trim() === '' ? '= F<sub>v,Ed</sub>' : fmtG(+x.Fb, 2)}</td><td class="num">${pct(E.perLoad[i])}</td></tr>`).join('')}</tbody></table>
      ${H2('Vérifications')}
      <table><thead><tr><th>Critère</th><th>Réf.</th>${multi ? '<th>Combinaison</th>' : ''}<th class="num">E<sub>d</sub></th><th class="num">R<sub>d</sub></th><th>Unité</th><th class="num">Taux</th><th>Statut</th></tr></thead><tbody>${chkRows}</tbody></table>
      ${infos.length ? `<p style="font-size:7.6pt"><b>Remarques :</b> ${infos.map(sub).join(' ')}</p>` : ''}
      <div class="rp-concl"><span>Conclusion — boulon M${B.d} ${esc(B.cls)}</span><b class="${E.max <= 1 ? 'rp-ok' : 'rp-ko'}">${E.max <= 1 ? 'Vérifié' : 'Non vérifié'} — taux max. ${pct(E.max)}</b></div>
      <p style="font-size:7.4pt;color:#555;margin-top:5pt">Critères couverts : NF EN 1993-1-8 tableaux 3.3 et 3.4. Hors champ : boulons précontraints (glissement), effet de levier, joints longs, rupture en bloc.</p>
    </section>`;
  }

  // ======================================================================
  //  ÉVÉNEMENTS
  // ======================================================================
  function bind(app) {
    const onEdit = (e) => {
      const t = e.target; if (!t.dataset || !t.dataset.bp || t.closest('.modal')) return;
      if (e.type === 'input' && (t.tagName === 'SELECT' || t.type === 'checkbox')) return;
      const p = t.dataset.bp;
      let v = t.type === 'checkbox' ? t.checked : t.value;
      if (p === 'd') v = +v;
      set(p, v);
      dirty = true; persist();
      if (t.dataset.rr && e.type === 'change') { const y = window.scrollY; render(app); window.scrollTo(0, y); return; }
      refresh();
    };
    app.addEventListener('input', onEdit);
    app.addEventListener('change', onEdit);
    app.addEventListener('paste', (e) => {
      const t = e.target; if (!t.dataset || t.dataset.lr == null || !t.dataset.bp) return;
      const txt = (e.clipboardData || window.clipboardData).getData('text');
      if (!/[\t\n]/.test(txt)) return;
      e.preventDefault();
      const r0 = +t.dataset.lr, c0 = +t.dataset.lc;
      txt.replace(/\r/g, '').split('\n').filter((l) => l.trim().length).forEach((line, i) => {
        const r = r0 + i;
        while (st.loads.length <= r) st.loads.push({ name: 'ELU ' + (st.loads.length + 1), Fv: 0, Ft: 0, Mb: 0, Fb: '' });
        line.split('\t').forEach((cell, j) => { const k = LOADK[c0 + j]; if (k) st.loads[r][k] = cell.trim().replace(/\s/g, '').replace(',', '.'); });
      });
      dirty = true; persist(); const y = window.scrollY; render(app); window.scrollTo(0, y);
    });
    app.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-bact]'); if (!b) return;
      const a = b.dataset.bact, y = window.scrollY;
      if (a === 'chip') { set(b.dataset.p, b.dataset.v); dirty = true; persist(); render(app); window.scrollTo(0, y); }
      else if (a === 'addLoad') { const L = st.loads[st.loads.length - 1]; st.loads.push(Object.assign({}, L, { name: 'ELU ' + (st.loads.length + 1) })); dirty = true; persist(); render(app); window.scrollTo(0, y); }
      else if (a === 'delLoad') { st.loads.splice(+b.dataset.i, 1); dirty = true; persist(); render(app); window.scrollTo(0, y); }
      else if (a === 'save' || a === 'saveas') { const ok = await A().saveItem('boulons', st, a === 'saveas'); if (ok) { dirty = false; persist(); render(app); window.scrollTo(0, y); } }
      else if (a === 'new') {
        if (dirty && !(await A().confirmBox('Nouveau boulon', 'Les modifications non enregistrées seront perdues. Continuer ?'))) return;
        st = C.defaultState(); st.name = 'Nouveau boulon'; A().newItem('boulons'); dirty = false; persist(); render(app);
      }
      else if (a === 'report') window.FirmitasReport.open([{ state: st, project: A().crumbK('boulons').p ? A().crumbK('boulons').p.name : '' }]);
    });
  }
  function load(state) { st = C.upgrade(state); dirty = false; persist(); }

  const api = { init, render, bind, page, load, flush, get state() { return st; }, get dirty() { return dirty; }, summary: C.summary };
  window.FirmitasModules = window.FirmitasModules || {};
  window.FirmitasModules.boulons = { kind: 'boulons', route: 'boulons', title: 'Boulons', short: 'boulon', ref: 'NF EN 1993-1-8 § 3 + AN', api, upgrade: C.upgrade };
})();
