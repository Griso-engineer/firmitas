/* ==========================================================================
   Firmitas — état par défaut et enregistrement des projets (localStorage).
   Les projets s'exportent / s'importent en fichier .json.
   ========================================================================== */
(function () {
  'use strict';
  const KEY = 'firmitas.v1';

  function defaultState() {
    return {
      v: 1,
      name: 'Poutre P1',
      sec: { kind: 'cat', fam: 'IPE', name: 'IPE 300', fab: 'hot', prs: { h: 500, b: 250, tw: 10, tf: 20 }, tube: { shape: 'rhs', h: 200, b: 100, t: 6, d: 168.3 } },
      steel: { grade: 'S355', fyMode: 'en10025', fyCustom: '', gM0: 1, gM1: 1 },
      L: 6, bc: 'aa', mode: 'charges', pp: true,
      loads: { Gz: { q: 6, P: '', x: '' }, Qz: { q: 9, P: '', x: '' }, Gy: { q: '', P: '', x: '' }, Qy: { q: '', P: '', x: '' } },
      N: { G: '', Q: '' },
      gam: { Gsup: 1.35, Ginf: 1, Q: 1.5 },
      direct: { N: '', Vz: '', Vy: '', My: ['', '', ''], Mz: ['', '', ''], load: 'U', wTot: '', wQ: '' },
      stab: { Lcry: 6, Lcrz: 6, LLT: 3, link: { Lcry: true, Lcrz: true, LLT: false }, k: 1, kw: 1, zgMode: 'top', zg: '', C1mode: 'auto', C1: 1.13, C2: 0.45, restrained: false, sway: false },
      sls: { preset: 'an-plancher', tot: 200, q: 300, Lref: '', fmin: '', psi2: 0.3 }
    };
  }

  // fusion profonde : complète un état ancien avec les champs par défaut
  function upgrade(s) {
    const d = defaultState();
    (function merge(dst, src) {
      Object.keys(src).forEach((k) => {
        if (dst[k] === undefined) dst[k] = src[k];
        else if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') merge(dst[k], src[k]);
      });
    })(s, d);
    return s;
  }

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  function load() {
    let db = null;
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || !Array.isArray(db.projects)) db = { projects: [], current: null, draft: null };
    return db;
  }
  function save(db) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { return false; }
  }
  function usage() {
    try { const s = localStorage.getItem(KEY) || ''; return s.length * 2; } catch (e) { return 0; }
  }

  window.FirmitasStore = { defaultState, upgrade, load, save, usage, uid };
})();
