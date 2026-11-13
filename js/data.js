/* ==========================================================================
   Firmitas — données : aciers, familles de profilés, coefficients normatifs.
   ========================================================================== */
(function () {
  'use strict';
  const G = window.FirmitasGeom, RAW = window.FIRMITAS_SECTIONS;

  // ---------- aciers ----------
  // Limite d'élasticité fy [MPa] selon l'épaisseur nominale t [mm].
  // 'en10025' : normes de produit (NF EN 10025-2 pour S235 à S355 et S450, -3/-4 pour S420 et S460) — choix a) de 3.2.1(1), retenu par l'AN française.
  // 'tab31'   : simplification du tableau 3.1 de l'EN 1993-1-1 (deux paliers, 40 mm).
  const T10025 = [16, 40, 63, 80, 100, 150];
  const STEELS = {
    S235: { en10025: [235, 225, 215, 215, 215, 195], tab31: [235, 215] },
    S275: { en10025: [275, 265, 255, 245, 235, 225], tab31: [275, 255] },
    S355: { en10025: [355, 345, 335, 325, 315, 295], tab31: [355, 335] },
    S420: { en10025: [420, 400, 390, 370, 360, 340], tab31: [420, 390] },
    S460: { en10025: [460, 440, 430, 410, 400, 380], tab31: [460, 430] }
  };
  function fyOf(grade, t, mode) {
    const s = STEELS[grade] || STEELS.S355;
    if (mode === 'tab31') return t <= 40 ? s.tab31[0] : s.tab31[1];
    for (let i = 0; i < T10025.length; i++) if (t <= T10025[i]) return s.en10025[i];
    return s.en10025[s.en10025.length - 1];
  }

  // ---------- familles ----------
  // Sections ajoutées par rapport au classeur (dimensions du catalogue ArcelorMittal, masse recoupée par le calcul)
  const ADDED = [
    ['IPE 550', 550, 210, 11.1, 17.2, 24, 106],
    ['IPE A 360', 357.6, 170, 6.6, 11.5, 18, 50.2], ['IPE A 400', 397, 180, 7, 12, 21, 57.4], ['IPE A 450', 447, 190, 7.6, 13.1, 21, 67.2],
    ['IPE A 500', 497, 200, 8.4, 14.5, 21, 79.4], ['IPE A 550', 547, 210, 9, 15.7, 24, 92.1], ['IPE A 600', 597, 220, 9.8, 17.5, 24, 108],
    ['IPE O 600', 610, 224, 15, 24, 24, 154],
    ['IPE 750 × 147', 753, 265, 13.2, 17, 17, 147], ['IPE 750 × 173', 762, 267, 14.4, 21.6, 17, 173], ['IPE 750 × 220', 779, 266, 16.5, 30, 17, 220]
  ];
  // Dimensions corrigées par rapport au classeur (voir README)
  const FIXED = {
    'IPE 750 × 137': [753, 263, 11.5, 17, 17, 137],
    'IPE 750 × 196': [770, 268, 15.6, 25.4, 17, 196]
  };
  const FAMILIES = [
    { id: 'IPE', re: /^IPE \d+$/ }, { id: 'IPE A', re: /^IPE A / }, { id: 'IPE O', re: /^IPE O / }, { id: 'IPE 750', re: /^IPE 750 ×/ },
    { id: 'IPN', ipn: true },
    { id: 'HE AA', re: /^HE \d+ AA$/ }, { id: 'HE A', re: /^HE \d+ A$/ }, { id: 'HE B', re: /^HE \d+ B$/ }, { id: 'HE M', re: /^HE \d+ M$/ },
    { id: 'HE (lourds)', re: /^HE \d+ ×/ }, { id: 'HL', re: /^HL / }, { id: 'HD', re: /^HD / },
    { id: 'UB', re: /^UB / }, { id: 'UC', re: /^UC / },
    { id: 'SHS (tube carré)', tube: 'shs' }, { id: 'RHS (tube rectangulaire)', tube: 'rhs' }, { id: 'CHS (tube rond)', tube: 'chs' }
  ];

  const num = (n) => parseFloat((n.match(/[\d.]+/) || [0])[0]);
  const iRows = RAW.I.map((r) => (FIXED[r[0]] ? [r[0]].concat(FIXED[r[0]]) : r)).concat(ADDED);
  const addedNames = new Set(ADDED.map((r) => r[0]));
  const CATALOG = {};          // famille → [{name, make()}]
  FAMILIES.forEach((f) => {
    let list;
    if (f.ipn) list = RAW.IPN.map((r) => ({ name: r[0], make: () => G.ipn(r) }));
    else if (f.tube === 'chs') list = RAW.CHS.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([d, t]) => { const s = G.chs(d, t); return { name: s.name, make: (fab) => G.chs(d, t, fab) }; });
    else if (f.tube) list = RAW.RHS.filter(([h, b]) => (f.tube === 'shs') === (h === b)).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
      .map(([h, b, t]) => { const s = G.rhs(h, b, t); return { name: s.name, make: (fab) => G.rhs(h, b, t, fab) }; });
    else {
      list = iRows.filter((r) => f.re.test(r[0])).map((r) => ({ name: r[0], Gnom: r[6], added: addedNames.has(r[0]), fixed: !!FIXED[r[0]], make: () => G.iSection(r[0], r[1], r[2], r[3], r[4], r[5]) }));
      if (/^IPE|^HE [AB M]|^HE AA/.test(f.id)) list.sort((a, b) => num(a.name.replace(/^IPE 750 ×/, '')) - num(b.name.replace(/^IPE 750 ×/, '')));
    }
    CATALOG[f.id] = list;
  });
  function findSection(fam, name, fab) {
    const l = CATALOG[fam] || [];
    const it = l.find((x) => x.name === name) || l[0];
    return it ? it.make(fab) : null;
  }

  // ---------- coefficients ----------
  const ALPHA = { a0: 0.13, a: 0.21, b: 0.34, c: 0.49, d: 0.76 };      // tableau 6.1 / 6.3
  const BC = {
    aa: { label: 'Appuyée – appuyée', K: 9.870, C2: [0.454, 0.630] },
    ae: { label: 'Appuyée – encastrée', K: 15.418, C2: [1.554, 1.645] },
    ee: { label: 'Encastrée – encastrée', K: 22.373, C2: [1.554, 1.645] },
    c: { label: 'Console (encastrée à gauche)', K: 3.516, C2: [0, 0] }
  };
  // NF EN 1993-1-1/NA, tableau 1 : flèches verticales maximales (toutes actions ; actions variables seules)
  const SLS_PRESETS = {
    'an-plancher': { label: 'AN — planchers courants (L/200 ; L/300)', tot: 200, q: 300 },
    'an-toiture': { label: 'AN — toitures en général (L/200 ; L/250)', tot: 200, q: 250 },
    'an-fragile': { label: 'AN — planchers avec cloisons fragiles (L/250 ; L/350)', tot: 250, q: 350 },
    'an-poteaux': { label: 'AN — planchers supportant des poteaux (L/400 ; L/500)', tot: 400, q: 500 },
    xl: { label: 'Classeur d\'origine (L/300 ; L/300)', tot: 300, q: 300 }
  };
  const LOAD_ROWS = [
    { id: 'Gz', cas: 'G', dir: 'z', label: 'G — permanentes', sub: 'plan fort (F<sub>z</sub>)' },
    { id: 'Qz', cas: 'Q', dir: 'z', label: 'Q — variables', sub: 'plan fort (F<sub>z</sub>)' },
    { id: 'Gy', cas: 'G', dir: 'y', label: 'G — permanentes', sub: 'plan faible (F<sub>y</sub>)' },
    { id: 'Qy', cas: 'Q', dir: 'y', label: 'Q — variables', sub: 'plan faible (F<sub>y</sub>)' }
  ];

  window.FIRMITAS_DATA = { E: 210000, Gs: 80770, STEELS, fyOf, FAMILIES, CATALOG, findSection, ALPHA, BC, SLS_PRESETS, LOAD_ROWS, ADDED, FIXED };
})();
