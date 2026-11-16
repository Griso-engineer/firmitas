/* ==========================================================================
   Firmitas — éléments d'interface communs à la section « Rigidité et résistance »
   (onglets Éclisse et Platines d'about) : jauge de classification, cartes, saisies.
   g : { Sj, rigidLim, pinLim, kb, cls, Lb } (N·mm/rad, mm) — voir FirmitasSpliceCalc.classifyJoint
   ========================================================================== */
(function () {
  'use strict';
  const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');

  // jauge logarithmique articulé / semi-rigide / rigide avec le marqueur S_j,ini (et S_j sécant s'il diffère)
  function gauge(g, Sjs) {
    const Sj = g.Sj / 1e9, rl = g.rigidLim / 1e9, pl = g.pinLim / 1e9;
    const lo = Math.log10(Math.min(pl / 4, Sj / 2)), hi = Math.log10(Math.max(rl * 4, Sj * 2));
    const pos = (v) => Math.max(0, Math.min(100, (Math.log10(v) - lo) / (hi - lo) * 100));
    const sec = Sjs != null && Sjs < g.Sj * 0.999 ? `<div style="position:absolute;left:${pos(Sjs / 1e9)}%;top:0;transform:translateX(-50%);font-size:11px;font-weight:600;color:var(--muted)">▼ S<sub>j</sub></div>` : '';
    return `<div style="position:relative;height:46px;margin:18px 0 6px;max-width:760px">
      <div style="position:absolute;left:0;right:0;top:16px;height:10px;background:linear-gradient(90deg,#f3d6d4 0%,#f3d6d4 ${pos(pl)}%,#f6ead2 ${pos(pl)}%,#f6ead2 ${pos(rl)}%,#d8ecdf ${pos(rl)}%,#d8ecdf 100%)"></div>
      <div style="position:absolute;left:${pos(pl)}%;top:8px;height:26px;border-left:1px solid var(--ink)"></div><div style="position:absolute;left:${pos(pl)}%;top:36px;font-size:11px;transform:translateX(-50%)">0,5·EI/L</div>
      <div style="position:absolute;left:${pos(rl)}%;top:8px;height:26px;border-left:1px solid var(--ink)"></div><div style="position:absolute;left:${pos(rl)}%;top:36px;font-size:11px;transform:translateX(-50%)">${g.kb}·EI/L</div>
      ${sec}<div style="position:absolute;left:${pos(Sj)}%;top:0;transform:translateX(-50%);font-size:11px;font-weight:800">▼ S<sub>j,ini</sub></div>
      <div style="position:absolute;left:2px;top:-14px;font-size:11px;color:var(--muted)">articulé</div><div style="position:absolute;left:50%;top:-14px;font-size:11px;color:var(--muted);transform:translateX(-50%)">semi-rigide</div><div style="position:absolute;right:2px;top:-14px;font-size:11px;color:var(--muted)">rigide</div>
    </div>`;
  }
  // deux premières cartes : rigidité initiale (classification) et limite « rigide »
  function cards(g, extra) {
    return `<div class="kpi ${g.cls === 'rigide' ? 'hero' : ''}"><b>Rigidité initiale</b><span>${fmt(g.Sj / 1e9, 1)}</span><small>MN·m/rad — assemblage <b>${g.cls}</b> (5.2.2.5)${extra || ''}</small></div>
      <div class="kpi"><b>Limite « rigide »</b><span>${fmt(g.rigidLim / 1e9, 1)}</span><small>k<sub>b</sub>·E·I<sub>b</sub>/L<sub>b</sub>, k<sub>b</sub> = ${g.kb} (${g.kb === 8 ? 'ossature contreventée' : 'non contreventée'})</small></div>`;
  }
  // saisies L_b et ossature ; inp / sel / field sont ceux du module appelant (attributs propres à chaque onglet)
  function inputs(inp, sel, field, extra) {
    return `<div class="fields">
      ${field('Portée de la poutre L<sub>b</sub>', inp('rig.Lb'), 'm', 'Pour la limite k<sub>b</sub>·E·I<sub>b</sub>/L<sub>b</sub>')}
      ${field('Ossature', sel('rig.frame', [['braced', 'Contreventée — k_b = 8'], ['unbraced', 'Non contreventée — k_b = 25']]))}
      ${extra || ''}
    </div>`;
  }
  window.FirmitasRigUI = { gauge, cards, inputs };
})();
