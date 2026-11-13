/* ==========================================================================
   Firmitas — fiche pour note de calcul (NDC)
   Aperçu A4 à l'écran, puis PDF (impression du navigateur) ou Word (.doc).
   ========================================================================== */
(function () {
  'use strict';
  const E = window.FirmitasEC3, D = window.FIRMITAS_DATA;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
  const fmtG = (x, d = 3) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { maximumFractionDigits: d }) : '—');
  const pct = (r) => (Number.isFinite(r) ? Math.round(r * 100) + ' %' : '∞');
  const ok = (r) => (r <= 1 ? '<span class="rp-ok">OK</span>' : '<span class="rp-ko">Non vérifié</span>');
  const sub = (s) => esc(s).replace(/_([A-Za-z0-9,.]+)/g, '<sub>$1</sub>').replace(/\^([0-9αβ]+)/g, '<sup>$1</sup>');
  const kN = (x) => fmt(x / 1e3, 2), kNm = (x) => fmt(x / 1e6, 2);
  const $ = (s, r = document) => r.querySelector(s);
  let opts = { logo: true, ref: '', annex: false };
  let items = [];

  function head(s, project, page) {
    const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    return `<header class="rp-head"><div class="l"><b>${esc(project || 'Note de calcul')}</b>Vérification d'élément acier — NF EN 1993-1-1${opts.ref ? ' · ' + esc(opts.ref) : ''}</div>
      <div class="r">${opts.logo ? '<div class="logo-s">tracés</div>' : ''}${esc(s.name)} · ${date}${page ? ' · ' + page : ''}</div></header>`;
  }
  function critTable(R, keys) {
    const env = R.env;
    return keys.filter((k) => env.byCrit[k]).map((k) => { const c = E.CRITERIA[k], x = env.byCrit[k]; return `<tr${env.worst.gov === k ? ' class="gov"' : ''}><td>${sub(c.label)}</td><td>${c.ref}</td><td>${esc(x.combo.id)}</td><td class="num">${pct(x.r)}</td><td>${ok(x.r)}</td></tr>`; }).join('');
  }

  function pageFor(s, project, idx, total) {
    const R = E.compute(s);
    const S = R.S;
    if (!S) return `<section class="rp-page">${head(s, project)}<p>Section invalide.</p></section>`;
    const kv = (a, b) => `<div><span>${a}</span><b>${b}</b></div>`;
    let n = 0; const H2 = (t) => `<h2><span class="n">${++n}</span>${t}</h2>`;
    const c = R.env && R.env.worst;
    const svg = window.FirmitasApp.sectionSvg(S, 118);
    const loads = s.mode === 'direct'
      ? `<p>Sollicitations de calcul issues du modèle : N<sub>Ed</sub> = ${fmtG(E.num(s.direct.N), 2)} kN, V<sub>z,Ed</sub> = ${fmtG(E.num(s.direct.Vz), 2)} kN, V<sub>y,Ed</sub> = ${fmtG(E.num(s.direct.Vy), 2)} kN ; M<sub>y,Ed</sub> (gauche / milieu / droite) = ${s.direct.My.map((v) => fmtG(E.num(v), 2)).join(' / ')} kN·m ; M<sub>z,Ed</sub> = ${s.direct.Mz.map((v) => fmtG(E.num(v), 2)).join(' / ')} kN·m.</p>`
      : `<table><thead><tr><th>Charges caractéristiques</th><th class="num">q [kN/m]</th><th class="num">P [kN]</th><th class="num">x<sub>P</sub> [m]</th></tr></thead><tbody>
        ${D.LOAD_ROWS.map((r) => { const v = R.rows[r.id]; return v.q || v.P ? `<tr><td>${r.label} — ${r.sub}</td><td class="num">${fmtG(v.q, 3)}</td><td class="num">${v.P ? fmtG(v.P, 2) : '—'}</td><td class="num">${v.P ? fmtG(R.cases[r.id].c.a, 2) : '—'}</td></tr>` : ''; }).join('')}
        </tbody></table>
        <p style="font-size:7.8pt;color:#555">${s.pp !== false ? `Poids propre inclus dans G (${fmt(R.pp, 3)} kN/m). ` : ''}${E.num(s.N.G) || E.num(s.N.Q) ? `Effort normal N<sub>G</sub> = ${fmtG(E.num(s.N.G), 2)} kN, N<sub>Q</sub> = ${fmtG(E.num(s.N.Q), 2)} kN (compression &gt; 0). ` : ''}Combinaisons ELU (NF EN 1990 éq. 6.10) : ${R.combos.map((x) => esc(x.label)).join(' ; ')}. ELS caractéristique G + Q.</p>`;
    const m = c && c.mem, sc = c && c.sec;
    let p1 = `<section class="rp-page">${head(s, project, 'p. 1')}
      <div class="rp-title"><h1>${esc(s.name || 'Élément')} — ${esc(S.name)} ${R.grade}${total > 1 ? ` (${idx + 1}/${total})` : ''}</h1>
      <p>L = ${fmt(R.L, 2)} m · ${D.BC[s.bc].label.toLowerCase()} · vérification selon NF EN 1990 et NF EN 1993-1-1 avec annexes nationales françaises</p></div>
      ${H2('Hypothèses')}
      <div class="rp-fig">${svg}<div style="flex:1"><div class="rp-kv">
        ${kv('Section', esc(S.name) + (S.type === 'I' ? (S.fab === 'welded' ? ' (PRS soudé)' : ' (laminé)') : S.fab === 'cold' ? ' (formé à froid)' : ' (fini à chaud)'))}${kv('Acier', `${R.grade} — f<sub>y</sub> = ${R.fy} MPa (t = ${fmtG(S.t, 1)} mm)`)}
        ${kv('γ<sub>M0</sub> / γ<sub>M1</sub>', fmt(R.g0, 2) + ' / ' + fmt(R.g1, 2))}${kv('Masse', fmt(S.G, 1) + ' kg/m')}
        ${kv('A / A<sub>v,z</sub>', `${fmt(S.A / 100, 1)} / ${fmt(S.Avz / 100, 1)} cm²`)}${kv('I<sub>y</sub> / I<sub>z</sub>', `${fmtG(S.Iy / 1e4, 0)} / ${fmtG(S.Iz / 1e4, 0)} cm⁴`)}
        ${kv('W<sub>pl,y</sub> / W<sub>el,y</sub>', `${fmtG(S.Wply / 1e3, 1)} / ${fmtG(S.Wely / 1e3, 1)} cm³`)}${kv('W<sub>pl,z</sub> / W<sub>el,z</sub>', `${fmtG(S.Wplz / 1e3, 1)} / ${fmtG(S.Welz / 1e3, 1)} cm³`)}
        ${kv('I<sub>t</sub> / I<sub>w</sub>', `${fmtG(S.It / 1e4, 2)} cm⁴ / ${S.Iw ? fmtG(S.Iw / 1e6, 0) + ' cm⁶' : '—'}`)}${kv('Classe de section', String(R.cls))}
        ${kv('L<sub>cr,y</sub> / L<sub>cr,z</sub>', `${fmt(R.stab.Lcry / 1000, 2)} / ${fmt(R.stab.Lcrz / 1000, 2)} m`)}${kv('Déversement', R.stab.restrained ? 'semelle comprimée maintenue' : `L<sub>LT</sub> = ${fmt(R.stab.LLT / 1000, 2)} m, k = ${fmtG(R.stab.k, 2)}, k<sub>w</sub> = ${fmtG(R.stab.kw, 2)}, z<sub>g</sub> = ${fmtG(R.stab.zg, 1)} mm`)}
      </div></div></div>
      ${H2('Actions')}${loads}
      ${c ? `${H2('Vérifications ELU — résistance des sections (§ 6.2)')}<table><thead><tr><th>Critère</th><th>Réf.</th><th>Comb.</th><th class="num">Taux</th><th>Statut</th></tr></thead><tbody>${critTable(R, E.SEC_KEYS)}</tbody></table>
      ${H2('Vérifications ELU — instabilités (§ 6.3)')}<table><thead><tr><th>Critère</th><th>Réf.</th><th>Comb.</th><th class="num">Taux</th><th>Statut</th></tr></thead><tbody>${critTable(R, E.MEM_KEYS)}</tbody></table>` : ''}
    </section>`;
    const line = (a, b) => `<div><span>${a}</span><b>${b}</b></div>`;
    let p2 = `<section class="rp-page">${head(s, project, 'p. 2')}`;
    if (c) {
      p2 += `<h3 style="margin-top:0">Détail — combinaison dimensionnante ${esc(c.id)} (${esc(c.label)})</h3><div class="rp-calc">
        ${line('Section la plus sollicitée', `x = ${fmt(c.secSt.x, 2)} m : N = ${kN(c.secSt.N)} kN ; M<sub>y</sub> = ${kNm(c.secSt.My)} kN·m ; M<sub>z</sub> = ${kNm(c.secSt.Mz)} kN·m ; V<sub>z</sub> = ${kN(c.secSt.Vz)} kN`)}
        ${line('Maxima sur la barre', `M<sub>y,Ed</sub> = ${kNm(c.diag.Mymax)} kN·m ; M<sub>z,Ed</sub> = ${kNm(c.diag.Mzmax)} kN·m ; V<sub>z,Ed</sub> = ${kN(c.Vzmax)} kN`)}
        ${line('Classe (tableau 5.2)', `${m.cls} — âme c/t = ${fmt(m.cl.web.ct, 1)}${m.cl.flange ? ', semelle c/t = ' + fmt(m.cl.flange.ct, 1) : ''}, ε = ${fmt(m.cl.eps, 3)}`)}
        ${line('N<sub>pl,Rd</sub> ; V<sub>pl,z,Rd</sub>', `${kN(sc.Npl)} kN ; ${kN(sc.Vplz)} kN`)}
        ${line(`M<sub>y,V,Rd</sub> (W<sub>${sc.cls <= 2 ? 'pl' : 'el'}</sub>${sc.rhoz > 0 ? ', ρ = ' + fmt(sc.rhoz, 3) : ''})`, `${kNm(sc.MyRd)} kN·m`)}
        ${line('Flambement y', `L<sub>cr</sub> = ${fmt(m.y.Lcr / 1000, 2)} m ; λ̄ = ${fmt(m.y.lam, 3)} ; courbe ${m.y.curve} ; χ<sub>y</sub> = ${fmt(m.y.chi, 3)} ; N<sub>b,y,Rd</sub> = ${kN(m.y.NbRd)} kN`)}
        ${line('Flambement z', `L<sub>cr</sub> = ${fmt(m.z.Lcr / 1000, 2)} m ; λ̄ = ${fmt(m.z.lam, 3)} ; courbe ${m.z.curve} ; χ<sub>z</sub> = ${fmt(m.z.chi, 3)} ; N<sub>b,z,Rd</sub> = ${kN(m.z.NbRd)} kN`)}
        ${line('Déversement', m.lt.skip ? sub(m.lt.skip) : `C<sub>1</sub> = ${fmt(m.lt.C1, 3)} ; C<sub>2</sub> = ${fmt(m.lt.C2, 3)} ; M<sub>cr</sub> = ${kNm(m.lt.Mcr)} kN·m ; λ̄<sub>LT</sub> = ${fmt(m.lt.lam, 3)} ; courbe ${m.lt.curve} ; χ<sub>LT</sub> = ${fmt(m.lt.chi, 3)} ; M<sub>b,Rd</sub> = ${kNm(m.lt.MbRd)} kN·m`)}
        ${line('Interaction (annexe B)', `C<sub>my</sub> = ${fmt(m.cmy.cm, 3)} ; C<sub>mz</sub> = ${fmt(m.cmz.cm, 3)} ; k<sub>yy</sub> = ${fmt(m.kyy, 3)} ; k<sub>yz</sub> = ${fmt(m.kyz, 3)} ; k<sub>zy</sub> = ${fmt(m.kzy, 3)} ; k<sub>zz</sub> = ${fmt(m.kzz, 3)}`)}
        ${line(`Critère dimensionnant — ${c.gov ? E.CRITERIA[c.gov].ref : ''}`, `${c.gov ? sub(E.CRITERIA[c.gov].label) : '—'} = <b>${fmt(c.max, 3)}</b> ${c.max <= 1 ? '≤ 1' : '&gt; 1'}`)}
      </div>`;
    }
    p2 += `${H2('Vérifications ELS')}
      ${R.sls.rows.length ? `<table><thead><tr><th>Flèche</th><th>Plan</th><th class="num">w [mm]</th><th class="num">Limite</th><th class="num">soit</th><th class="num">Taux</th><th>Statut</th></tr></thead><tbody>
      ${R.sls.rows.map((r) => `<tr><td>${r.label}</td><td>${r.dir === 'z' ? 'fort' : 'faible'}</td><td class="num">${fmt(r.w, 1)}</td><td class="num">L/${r.limRatio} = ${fmt(r.lim, 1)} mm</td><td class="num">${r.w > 0 ? 'L/' + Math.round(r.Lratio) : '—'}</td><td class="num">${pct(r.ratio)}</td><td>${ok(r.ratio)}</td></tr>`).join('')}</tbody></table>` : '<p>Aucune flèche vérifiée.</p>'}
      <p style="font-size:7.8pt;color:#555">Portée de référence ${fmt(R.sls.Lref / 1000, 2)} m, E = 210 000 MPa ; limites NF EN 1993-1-1/NA tableau 1.${R.freq ? ` Fréquence propre de flexion f<sub>1</sub> = ${fmt(R.freq.f, 2)} Hz (masse G + ${fmtG(R.freq.psi, 2)}·Q = ${fmt(R.freq.m, 0)} kg/m)${R.freq.fmin ? ', exigence ' + fmtG(R.freq.fmin, 1) + ' Hz : ' + (R.freq.ratio <= 1 ? 'satisfaite' : 'non satisfaite') : ''}.` : ''}</p>
      ${R.warnings.length ? `<p style="font-size:7.8pt"><b>Remarques :</b> ${R.warnings.map(sub).join(' ')}</p>` : ''}
      <div class="rp-concl"><span>Conclusion — ${esc(S.name)} ${R.grade}, L = ${fmt(R.L, 2)} m</span><b class="${R.valid && R.max <= 1 ? 'rp-ok' : 'rp-ko'}">${!R.valid ? 'Hors domaine — pas de verdict' : (R.max <= 1 ? 'Vérifié' : 'Non vérifié') + ' — taux max. ' + pct(R.max)}</b></div>
      <p style="font-size:7.4pt;color:#555;margin-top:5pt">Critères couverts : NF EN 1993-1-1 § 5.5, 6.2.3 à 6.2.10, 6.3.1 à 6.3.3 (annexe B), 7.2 (AN). Non couverts, à justifier par ailleurs : assemblages, résistance de l'âme aux charges transversales (EN 1993-1-5 § 6), voilement par cisaillement, torsion, section nette, feu, fatigue.</p>
    </section>`;
    let p3 = '';
    if (opts.annex) {
      p3 = `<section class="rp-page">${head(s, project, 'annexe')}${H2('Annexe — combinaisons étudiées')}
        <table><thead><tr><th>N°</th><th>Combinaison</th><th class="num">N [kN]</th><th class="num">M<sub>y</sub> [kN·m]</th><th class="num">M<sub>z</sub> [kN·m]</th><th class="num">V<sub>z</sub> [kN]</th><th>Critère</th><th class="num">Taux</th></tr></thead><tbody>
        ${R.combos.map((x) => `<tr><td>${x.id}</td><td>${esc(x.label)}</td><td class="num">${kN(x.N)}</td><td class="num">${kNm(x.diag.Mymax)}</td><td class="num">${kNm(x.diag.Mzmax)}</td><td class="num">${kN(x.Vzmax)}</td><td>${x.gov ? E.CRITERIA[x.gov].ref : '—'}</td><td class="num">${pct(x.max)}</td></tr>`).join('')}
        </tbody></table></section>`;
    }
    return p1 + p2 + p3;
  }

  const build = () => items.map((it, i) => (it.state && it.state.kind === 'eclisse' ? window.FirmitasSplice.page(it.state, it.project, i, items.length, opts) : pageFor(it.state, it.project, i, items.length))).join('');
  function open(list) {
    items = list;
    const name = list.length === 1 ? (list[0].state.name || 'element') : (list[0].project || 'projet');
    const ov = document.createElement('div');
    ov.className = 'rp-overlay';
    ov.innerHTML = `<div class="rp-bar"><b>Fiche NDC — ${esc(name)}</b>
      <label><input type="text" id="rpRef" placeholder="Réf. affaire / NDC" value="${esc(opts.ref)}" style="width:150px;padding:4px 6px;font-size:12px;border:0"></label>
      <label><input type="checkbox" id="rpLogo"${opts.logo ? ' checked' : ''}> logo tracés</label>
      <label><input type="checkbox" id="rpAnnex"${opts.annex ? ' checked' : ''}> annexe combinaisons</label>
      <button class="btn primary" data-x="pdf">PDF</button><button class="btn" data-x="doc">Word</button><button class="btn" data-x="close">Fermer ✕</button></div>
      <div class="rp-pages"></div>`;
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    const render = () => { $('.rp-pages', ov).innerHTML = build(); };
    render();
    const close = () => { ov.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('change', (e) => {
      if (e.target.id === 'rpLogo') opts.logo = e.target.checked;
      if (e.target.id === 'rpAnnex') opts.annex = e.target.checked;
      if (e.target.id === 'rpRef') opts.ref = e.target.value;
      render();
    });
    ov.addEventListener('click', (e) => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      if (b.dataset.x === 'close') close();
      if (b.dataset.x === 'pdf') { const t = document.title; document.title = 'NDC-' + slug(name); window.print(); document.title = t; }
      if (b.dataset.x === 'doc') exportWord(ov, name);
    });
  }
  const slug = (s) => String(s || 'firmitas').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  function download(fname, blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  function svgToPng(svg) {
    return new Promise((resolve) => {
      const img = new Image(), scale = 3;
      img.onload = () => { const c = document.createElement('canvas'); c.width = img.width * scale; c.height = img.height * scale; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); resolve({ src: c.toDataURL('image/png'), w: img.width, h: img.height }); };
      img.onerror = () => resolve(null);
      const s = svg.cloneNode(true); s.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.outerHTML);
    });
  }
  async function exportWord(ov, name) {
    const clone = $('.rp-pages', ov).cloneNode(true);
    for (const sv of Array.from(clone.querySelectorAll('svg'))) { const png = await svgToPng(sv); if (png) { const im = document.createElement('img'); im.src = png.src; im.width = png.w; im.height = png.h; sv.replaceWith(im); } else sv.remove(); }
    clone.querySelectorAll('.rp-fig').forEach((f) => { const t = document.createElement('table'); const tr = t.insertRow(); Array.from(f.children).forEach((ch) => { const td = tr.insertCell(); td.style.border = '0'; td.style.verticalAlign = 'top'; td.appendChild(ch); }); f.replaceWith(t); });
    clone.querySelectorAll('.rp-kv, .rp-calc').forEach((k) => { const t = document.createElement('table'); Array.from(k.children).forEach((d) => { const tr = t.insertRow(); Array.from(d.children).forEach((x) => { const td = tr.insertCell(); td.innerHTML = x.innerHTML; }); }); k.replaceWith(t); });
    clone.querySelectorAll('.rp-head, .rp-concl').forEach((h) => { const t = document.createElement('table'); t.className = h.classList.contains('rp-head') ? 'hd' : 'cc'; const tr = t.insertRow(); Array.from(h.children).forEach((ch, i) => { const td = tr.insertCell(); td.innerHTML = h.classList.contains('rp-head') ? ch.innerHTML : ch.outerHTML; if (i) td.style.textAlign = 'right'; }); h.replaceWith(t); });
    const pages = Array.from(clone.querySelectorAll('.rp-page')).map((p) => p.innerHTML);
    const css = `body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#111}h1{font-size:15pt;margin:4pt 0}h2{font-size:10.5pt;border-top:1pt solid #111;padding-top:3pt;margin:12pt 0 4pt}h3{font-size:9.5pt;margin:8pt 0 3pt}
      table{border-collapse:collapse;width:100%;font-size:8.5pt;margin:2pt 0 5pt}th,td{border-bottom:.5pt solid #bbb;padding:2pt 4pt;text-align:left;vertical-align:top}th{border-bottom:1pt solid #111}td.num,th.num{text-align:right}
      .n{color:#8b9d99;margin-right:6pt}.logo-s{color:#8b9d99;font-weight:bold;font-size:14pt}table.hd td{border:0;border-bottom:1.2pt solid #111;font-size:8pt;color:#555}table.cc td{border:1pt solid #111;font-size:10pt;padding:5pt}
      .rp-ok{color:#1f7a4d;font-weight:bold}.rp-ko{color:#c62f29;font-weight:bold}tr.gov td{font-weight:bold}p{margin:0 0 4pt}`;
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(name)}</title>
      <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]--><style>@page{size:21cm 29.7cm;margin:1.6cm}${css}</style></head>
      <body>${pages.map((p, i) => (i ? '<br clear="all" style="page-break-before:always">' : '') + p).join('')}</body></html>`;
    download('NDC-' + slug(name) + '.doc', new Blob(['﻿', html], { type: 'application/msword' }));
  }
  window.FirmitasReport = { open };
})();
