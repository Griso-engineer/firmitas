/* ==========================================================================
   Firmitas — plaques rectangulaires en acier d'épaisseur constante appuyées sur 2, 3 ou 4 côtés,
   d'après W. C. Young & R. G. Budynas, Roark's Formulas for Stress and Strain, chapitre 11 :
   tableau 11.4 (§ 11.10) et grandes flèches (§ 11.11).
   σ = β·q·b²/t², y = α·q·b⁴/(E·t³), R = γ·q·b ; coefficients interpolés linéairement en a/b
   (linéairement en b/a entre la dernière valeur finie et a/b = ∞).
   Vérifications : σ_max (ELU) ≤ f_y/γ_M0 (première plastification, critère élastique) ;
   y_max (ELS) ≤ b / limite. Unités internes : N, mm, MPa ; q saisi en kPa, W en kN.
   ========================================================================== */
(function () {
  'use strict';
  const D = window.FIRMITAS_DATA;
  const num = (v, d = 0) => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(x) ? x : d; };
  const INF = Infinity;
  // bords : ss = appui simple, fx = encastré, fr = libre ; bas (z = 0), haut (z = b), gauche, droite
  const E4 = (bottom, top, left, right) => ({ bottom, top, left, right });

  /* Chaque cas : bords, définition de a et b, charges. Chaque charge : r (valeurs de a/b), coefficients c,
     sorties { label, kind: s|y|R|sW|sWe|yW, coef, sign, pos: [x/a − 0,5 … 0,5, z/b 0 … 1] }, ν du tableau. */
  const CASES = [
    // ------------------------------------------------ 4 côtés
    { id: 'c1', group: '4 côtés', label: '4 appuis simples', roark: '1', edges: E4('ss', 'ss', 'ss', 'ss'), ab: 'a ≥ b, a : grand côté', min: 1,
      loads: {
        uni: { label: 'Pression uniforme', roark: '1a', nu: 0.3, r: [1, 1.2, 1.4, 1.6, 1.8, 2, 3, 4, 5, INF],
          c: { b: [.2874, .3762, .4530, .5172, .5688, .6102, .7134, .7410, .7476, .7500], a: [.0444, .0616, .0770, .0906, .1017, .1110, .1335, .1400, .1417, .1421], g: [.420, .455, .478, .491, .499, .503, .505, .502, .501, .500] },
          out: [{ label: 'Contrainte σ_b au centre', kind: 's', coef: 'b', pos: [0, 0.5] }, { label: 'Flèche au centre', kind: 'y', coef: 'a', pos: [0, 0.5] },
            { label: 'Réaction au milieu des grands côtés', kind: 'R', coef: 'g', pos: [0, 0] }] },
        conc: { label: 'Charge concentrée au centre', roark: '1b', nu: 0.3, r: [1, 1.2, 1.4, 1.6, 1.8, 2, INF],
          c: { b: [.435, .650, .789, .875, .927, .958, 1.000], a: [.1267, .1478, .1621, .1715, .1770, .1805, .1851] },
          out: [{ label: 'Contrainte au centre', kind: 'sW', coef: 'b', pos: [0, 0.5] }, { label: 'Flèche au centre', kind: 'yW', coef: 'a', pos: [0, 0.5] }] },
        lin: { label: 'Pression croissant le long du grand côté', roark: '1d', nu: 0.3, r: [1, 1.5, 2, 2.5, 3, 3.5, 4],
          c: { b: [.16, .26, .34, .38, .43, .47, .49], a: [.022, .043, .060, .070, .078, .086, .091] },
          out: [{ label: 'Contrainte maximale', kind: 's', coef: 'b' }, { label: 'Flèche maximale', kind: 'y', coef: 'a' }] },
        lin2: { label: 'Pression croissant le long du petit côté', roark: '1e', nu: 0.3, r: [1, 1.5, 2, 2.5, 3, 3.5, 4],
          c: { b: [.16, .26, .32, .35, .37, .38, .38], a: [.022, .042, .056, .063, .067, .069, .070] },
          out: [{ label: 'Contrainte maximale', kind: 's', coef: 'b' }, { label: 'Flèche maximale', kind: 'y', coef: 'a' }] } } },
    { id: 'c3', group: '4 côtés', label: '3 appuis simples + 1 petit côté encastré', roark: '3', edges: E4('ss', 'ss', 'ss', 'fx'), ab: 'a ≥ b, b : côté encastré', min: 1,
      loads: { uni: { label: 'Pression uniforme', roark: '3a', nu: 0.3, r: [1, 1.5, 2, 2.5, 3, 3.5, 4],
        c: { b: [.50, .67, .73, .74, .75, .75, .75], a: [.030, .071, .101, .122, .132, .137, .139] },
        out: [{ label: 'Contrainte maximale', kind: 's', coef: 'b' }, { label: 'Flèche maximale', kind: 'y', coef: 'a' }] } } },
    { id: 'c4', group: '4 côtés', label: '3 appuis simples + 1 grand côté encastré', roark: '4', edges: E4('fx', 'ss', 'ss', 'ss'), ab: 'a ≥ b, a : côté encastré', min: 1,
      loads: { uni: { label: 'Pression uniforme', roark: '4a', nu: 0.3, r: [1, 1.5, 2, 2.5, 3, 3.5, 4],
        c: { b: [.50, .66, .73, .74, .74, .75, .75], a: [.030, .046, .054, .056, .057, .058, .058] },
        out: [{ label: 'Contrainte maximale', kind: 's', coef: 'b' }, { label: 'Flèche maximale', kind: 'y', coef: 'a' }] } } },
    { id: 'c5', group: '4 côtés', label: 'Grands côtés appuyés, petits côtés encastrés', roark: '5', edges: E4('ss', 'ss', 'fx', 'fx'), ab: 'a ≥ b, a : grands côtés', min: 1,
      loads: { uni: { label: 'Pression uniforme', roark: '5a', nu: 0.3, r: [1, 1.2, 1.4, 1.6, 1.8, 2, INF], infNote: 'α pour a/b → ∞ : limite de la bande simplement appuyée (valeur absente du tableau de Roark)',
        c: { b: [.4182, .5208, .5988, .6540, .6912, .7146, .750], a: [.0210, .0349, .0502, .0658, .0800, .0922, .1421] },
        out: [{ label: 'Contrainte au milieu des petits côtés', kind: 's', coef: 'b', sign: -1, pos: [-0.5, 0.5] }, { label: 'Flèche au centre', kind: 'y', coef: 'a', pos: [0, 0.5] }] } } },
    { id: 'c6', group: '4 côtés', label: 'Grands côtés encastrés, petits côtés appuyés', roark: '6', edges: E4('fx', 'fx', 'ss', 'ss'), ab: 'a ≥ b, a : grands côtés', min: 1,
      loads: { uni: { label: 'Pression uniforme', roark: '6a', nu: 0.3, r: [1, 1.2, 1.4, 1.6, 1.8, 2, INF],
        c: { b: [.4182, .4626, .4860, .4968, .4971, .4973, .500], a: [.0210, .0243, .0262, .0273, .0280, .0283, .0285] },
        out: [{ label: 'Contrainte au milieu des grands côtés', kind: 's', coef: 'b', sign: -1, pos: [0, 0] }, { label: 'Flèche au centre', kind: 'y', coef: 'a', pos: [0, 0.5] }] } } },
    { id: 'c9', group: '4 côtés', label: '3 côtés encastrés + 1 côté appuyé', roark: '9', edges: E4('fx', 'ss', 'fx', 'fx'), ab: 'a : côté appuyé (z = b) ; b : côtés encastrés latéraux', min: 0.25,
      loads: {
        uni: { label: 'Pression uniforme', roark: '9a', nu: 0.2, r: [.25, .5, .75, 1, 1.5, 2, 3],
          c: { b1: [.020, .081, .173, .307, .539, .657, .718], b2: [.004, .018, .062, .134, .284, .370, .422], b3: [.016, .061, .118, .158, .164, .135, .097], b4: [.031, .121, .242, .343, .417, .398, .318],
            g1: [.115, .230, .343, .453, .584, .622, .625], g2: [.123, .181, .253, .319, .387, .397, .386], g3: [.125, .256, .382, .471, .547, .549, .530] },
          out: [{ label: 'σ_b au milieu du côté encastré opposé (z = 0)', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'σ_b en travée (x = 0, z = 0,6 b)', kind: 's', coef: 'b2', pos: [0, 0.6] },
            { label: 'σ_a en travée (x = 0, z = 0,6 b)', kind: 's', coef: 'b3', pos: [0, 0.6] }, { label: 'σ_a sur les côtés encastrés latéraux (z = 0,6 b)', kind: 's', coef: 'b4', sign: -1, pos: [-0.5, 0.6] },
            { label: 'Réaction au milieu du côté encastré (z = 0)', kind: 'R', coef: 'g1', pos: [0, 0] }, { label: 'Réaction au milieu du côté appuyé (z = b)', kind: 'R', coef: 'g2', pos: [0, 1] },
            { label: 'Réaction sur les côtés latéraux (z = 0,6 b)', kind: 'R', coef: 'g3', pos: [0.5, 0.6] }] },
        tri: { label: 'Pression décroissante de l\'encastrement (z = 0) à l\'appui', roark: '9d', nu: 0.2, r: [.25, .5, .75, 1, 1.5, 2, 3],
          c: { b1: [.018, .064, .120, .192, .303, .356, .382], b2: [.019, .068, .124, .161, .181, .168, .132], g1: [.106, .195, .265, .323, .383, .399, .400], g2: [.075, .152, .212, .245, .262, .258, .250] },
          out: [{ label: 'σ_b au milieu du côté encastré (z = 0)', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'σ_a sur les côtés latéraux (z = 0,4 b)', kind: 's', coef: 'b2', sign: -1, pos: [-0.5, 0.4] },
            { label: 'Réaction au milieu du côté encastré (z = 0)', kind: 'R', coef: 'g1', pos: [0, 0] }, { label: 'Réaction sur les côtés latéraux (z = 0,4 b)', kind: 'R', coef: 'g2', pos: [0.5, 0.4] }] } } },
    { id: 'c8', group: '4 côtés', label: '4 côtés encastrés', roark: '8', edges: E4('fx', 'fx', 'fx', 'fx'), ab: 'a ≥ b, a : grand côté', min: 1,
      loads: {
        uni: { label: 'Pression uniforme', roark: '8a', nu: 0.3, r: [1, 1.2, 1.4, 1.6, 1.8, 2, INF],
          c: { b1: [.3078, .3834, .4356, .4680, .4872, .4974, .5000], b2: [.1386, .1794, .2094, .2286, .2406, .2472, .2500], a: [.0138, .0188, .0226, .0251, .0267, .0277, .0284] },
          out: [{ label: 'Contrainte au milieu des grands côtés', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'Contrainte au centre', kind: 's', coef: 'b2', pos: [0, 0.5] },
            { label: 'Flèche au centre', kind: 'y', coef: 'a', pos: [0, 0.5] }] },
        conc: { label: 'Charge concentrée au centre', roark: '8b', nu: 0.3, r: [1, 1.2, 1.4, 1.6, 1.8, 2, INF],
          c: { b1: [-.238, -.078, .011, .053, .068, .067, .067], b2: [.7542, .8940, .9624, .9906, 1.0000, 1.004, 1.008], a: [.0611, .0706, .0754, .0777, .0786, .0788, .0791] },
          out: [{ label: 'Contrainte au centre', kind: 'sW', coef: 'b1', pos: [0, 0.5] }, { label: 'Contrainte au milieu des grands côtés', kind: 'sWe', coef: 'b2', sign: -1, pos: [0, 0] },
            { label: 'Flèche au centre', kind: 'yW', coef: 'a', pos: [0, 0.5] }] } } },
    // ------------------------------------------------ 3 côtés
    { id: 'c2', group: '3 côtés', label: '3 appuis simples + 1 bord libre', roark: '2', edges: E4('ss', 'ss', 'ss', 'fr'), ab: 'b : bord libre ; a : côtés appuyés perpendiculaires', min: 0.5,
      loads: {
        uni: { label: 'Pression uniforme', roark: '2a', nu: 0.3, r: [.5, .667, 1, 1.5, 2, 4],
          c: { b: [.36, .45, .67, .77, .79, .80], a: [.080, .106, .140, .160, .165, .167] },
          out: [{ label: 'Contrainte maximale', kind: 's', coef: 'b' }, { label: 'Flèche maximale', kind: 'y', coef: 'a' }] },
        lin: { label: 'Pression croissant le long du côté a', roark: '2d', nu: 0.3, r: [.5, .667, 1, 1.5, 2, 2.5, 3, 3.5, 4],
          c: { b: [.11, .16, .20, .28, .32, .35, .36, .37, .37], a: [.026, .033, .040, .050, .058, .064, .067, .069, .070] },
          out: [{ label: 'Contrainte maximale', kind: 's', coef: 'b' }, { label: 'Flèche maximale', kind: 'y', coef: 'a' }] } } },
    { id: 'c7', group: '3 côtés', label: '1 côté encastré, le côté opposé libre, 2 appuis simples', roark: '7', edges: E4('fx', 'fr', 'ss', 'ss'), ab: 'a : côté encastré (z = 0) ; b : distance au bord libre', min: 0.25,
      loads: {
        uni: { label: 'Pression uniforme', roark: '7a', nu: 0.2, r: [.25, .5, .75, 1, 1.5, 2, 3],
          c: { b1: [.044, .176, .380, .665, 1.282, 1.804, 2.450], b2: [.048, .190, .386, .565, .730, .688, .434], g1: [.183, .368, .541, .701, .919, 1.018, 1.055], g2: [.131, .295, .526, .832, 1.491, 1.979, 2.401] },
          out: [{ label: 'Contrainte au milieu du côté encastré', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'Contrainte au milieu du bord libre', kind: 's', coef: 'b2', pos: [0, 1] },
            { label: 'Réaction au milieu du côté encastré', kind: 'R', coef: 'g1', pos: [0, 0] }, { label: 'Réaction aux extrémités du bord libre', kind: 'R', coef: 'g2', pos: [0.5, 1] }] },
        tri: { label: 'Pression décroissante de l\'encastrement au bord libre', roark: '7d', nu: 0.2, r: [.25, .5, .75, 1, 1.5, 2, 3],
          c: { b: [.037, .120, .212, .321, .523, .677, .866], g: [.159, .275, .354, .413, .482, .509, .517] },
          out: [{ label: 'Contrainte au milieu du côté encastré', kind: 's', coef: 'b', sign: -1, pos: [0, 0] }, { label: 'Réaction au milieu du côté encastré', kind: 'R', coef: 'g', pos: [0, 0] }] } } },
    { id: 'c10', group: '3 côtés', label: '3 côtés encastrés + 1 bord libre', roark: '10', edges: E4('fx', 'fr', 'fx', 'fx'), ab: 'a : bord libre (z = b) ; b : côtés encastrés latéraux', min: 0.25,
      loads: {
        uni: { label: 'Pression uniforme', roark: '10a', nu: 0.2, r: [.25, .5, .75, 1, 1.5, 2, 3],
          c: { b1: [.020, .081, .173, .321, .727, 1.226, 2.105], b2: [.016, .066, .148, .259, .484, .605, .519], b3: [.031, .126, .286, .511, 1.073, 1.568, 1.982], g1: [.114, .230, .341, .457, .673, .845, 1.012], g2: [.125, .248, .371, .510, .859, 1.212, 1.627] },
          out: [{ label: 'σ_b au milieu du côté encastré opposé au bord libre', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'σ_a au milieu du bord libre', kind: 's', coef: 'b2', pos: [0, 1] },
            { label: 'σ_a aux extrémités du bord libre', kind: 's', coef: 'b3', sign: -1, pos: [-0.5, 1] }, { label: 'Réaction au milieu du côté encastré (z = 0)', kind: 'R', coef: 'g1', pos: [0, 0] },
            { label: 'Réaction aux extrémités du bord libre', kind: 'R', coef: 'g2', pos: [0.5, 1] }] },
        tri: { label: 'Pression décroissante de l\'encastrement au bord libre', roark: '10d', nu: 0.2, r: [.25, .5, .75, 1, 1.5, 2, 3], note: 'γ_2 à a/b = 1,5 : 0,106, valeur telle que publiée par Roark (vraisemblablement une coquille)',
          c: { b1: [.018, .064, .120, .195, .351, .507, .758], b2: [.019, .068, .125, .166, .244, .387, .514], g1: [.106, .195, .265, .324, .406, .458, .505], g2: [.075, .151, .211, .242, .106, .199, .313] },
          out: [{ label: 'σ_b au milieu du côté encastré (z = 0)', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'σ_a sur les côtés latéraux', kind: 's', coef: 'b2', sign: -1, pos: [-0.5, 0.7] },
            { label: 'Réaction au milieu du côté encastré (z = 0)', kind: 'R', coef: 'g1', pos: [0, 0] }, { label: 'Réaction sur les côtés latéraux', kind: 'R', coef: 'g2', pos: [0.5, 0.7] }] } } },
    // ------------------------------------------------ 2 côtés
    { id: 'c11', group: '2 côtés', label: '2 côtés adjacents encastrés, 2 bords libres', roark: '11', edges: E4('fx', 'fr', 'fx', 'fr'), ab: 'a : côté encastré bas (z = 0) ; b : côté encastré gauche (x = 0)', min: 0.125, swap: true,
      loads: { uni: { label: 'Pression uniforme', roark: '11a', nu: 0.2, r: [.125, .25, .375, .5, .75, 1],
        c: { b1: [.050, .182, .353, .631, 1.246, 1.769], b2: [.047, .188, .398, .632, 1.186, 1.769], g1: [.312, .572, .671, .874, 1.129, 1.183], g2: [.127, .264, .413, .557, .829, 1.183] },
        out: [{ label: 'σ_b à l\'extrémité libre du côté encastré bas (x = a, z = 0)', kind: 's', coef: 'b1', sign: -1, pos: [0.5, 0] }, { label: 'σ_a à l\'extrémité libre du côté encastré gauche', kind: 's', coef: 'b2', sign: -1, pos: [-0.5, 1] },
          { label: 'Réaction au même point (côté bas)', kind: 'R', coef: 'g1', pos: [0.5, 0] }, { label: 'Réaction au même point (côté gauche)', kind: 'R', coef: 'g2', pos: [-0.5, 1] }] } } },
    { id: 'b-ss', group: '2 côtés', label: '2 côtés opposés appuyés, 2 bords libres', roark: 'bande', strip: true, edges: E4('ss', 'ss', 'fr', 'fr'), ab: 'b : portée entre les appuis ; a : longueur des bords libres', min: 0,
      loads: { uni: { label: 'Pression uniforme', roark: 'flexion cylindrique', nu: null, strip: (nu) => ({ b: 0.75, a: 5 * 12 * (1 - nu * nu) / 384, g: 0.5 }),
        out: [{ label: 'Contrainte au milieu de la portée', kind: 's', coef: 'b', pos: [0, 0.5] }, { label: 'Flèche maximale', kind: 'y', coef: 'a', pos: [0, 0.5] }, { label: 'Réaction sur chaque appui', kind: 'R', coef: 'g', pos: [0, 0] }] } } },
    { id: 'b-ff', group: '2 côtés', label: '2 côtés opposés encastrés, 2 bords libres', roark: 'bande', strip: true, edges: E4('fx', 'fx', 'fr', 'fr'), ab: 'b : portée entre les encastrements ; a : longueur des bords libres', min: 0,
      loads: { uni: { label: 'Pression uniforme', roark: 'flexion cylindrique', nu: null, strip: (nu) => ({ b1: 0.5, b2: 0.25, a: 12 * (1 - nu * nu) / 384, g: 0.5 }),
        out: [{ label: 'Contrainte sur les encastrements', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'Contrainte au milieu de la portée', kind: 's', coef: 'b2', pos: [0, 0.5] },
          { label: 'Flèche maximale', kind: 'y', coef: 'a', pos: [0, 0.5] }, { label: 'Réaction sur chaque encastrement', kind: 'R', coef: 'g', pos: [0, 1] }] } } },
    { id: 'b-fs', group: '2 côtés', label: '1 côté encastré, le côté opposé appuyé, 2 bords libres', roark: 'bande', strip: true, edges: E4('fx', 'ss', 'fr', 'fr'), ab: 'b : portée ; a : longueur des bords libres', min: 0,
      loads: { uni: { label: 'Pression uniforme', roark: 'flexion cylindrique', nu: null, strip: (nu) => ({ b1: 0.75, b2: 6 * 9 / 128, a: 12 * (1 - nu * nu) / 185, g1: 5 / 8, g2: 3 / 8 }),
        out: [{ label: 'Contrainte sur l\'encastrement', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'Contrainte maximale en travée (z = 0,625 b)', kind: 's', coef: 'b2', pos: [0, 0.625] },
          { label: 'Flèche maximale (z ≈ 0,58 b)', kind: 'y', coef: 'a', pos: [0, 0.58] }, { label: 'Réaction sur l\'encastrement', kind: 'R', coef: 'g1', pos: [0, 0] }, { label: 'Réaction sur l\'appui', kind: 'R', coef: 'g2', pos: [0, 1] }] } } }
  ];
  const CASE = Object.fromEntries(CASES.map((c) => [c.id, c]));

  // grandes flèches (§ 11.11, ν = 0,316) : Q = q·b⁴/(E·t⁴) → y/t et σ·b²/(E·t²) (contrainte totale)
  const LD_Q = [0, 12.5, 25, 50, 75, 100, 125, 150, 175, 200, 250];
  const LARGE = {
    ss: [
      { r: 1, y: [0, .430, .650, .930, 1.13, 1.26, 1.37, 1.47, 1.56, 1.63, 1.77], s: [0, 3.80, 5.80, 8.70, 10.90, 12.80, 14.30, 15.60, 17.00, 18.20, 20.50], where: 'au centre' },
      { r: 1.5, y: [0, .625, .879, 1.18, 1.37, 1.53, 1.68, 1.77, 1.88, 1.96, 2.12], s: [0, 4.48, 6.81, 9.92, 12.25, 14.22, 16.0, 17.50, 18.90, 20.30, 22.80], where: 'au centre' },
      { r: 2, y: [0, .696, .946, 1.24, 1.44, 1.60, 1.72, 1.84, 1.94, 2.03, 2.20], s: [0, 4.87, 7.16, 10.30, 12.60, 14.60, 16.40, 18.00, 19.40, 20.90, 23.60], where: 'au centre', label: '2 à ∞' }],
    fx: [
      { r: 1, y: [0, .165, .32, .59, .80, .95, 1.08, 1.19, 1.28, 1.38, 1.54], s: [0, 3.80, 6.90, 14.70, 21.0, 26.50, 31.50, 36.20, 40.70, 45.00, 53.50], where: 'au milieu des grands côtés' },
      { r: 1.5, y: [0, .28, .51, .825, 1.07, 1.24, 1.40, 1.50, 1.63, 1.72, 1.86], s: [0, 5.75, 11.12, 20.30, 27.8, 35.0, 41.0, 47.0, 52.50, 57.60, 67.00], where: 'au milieu des grands côtés', label: '1,5 à ∞' }]
  };

  // interpolation linéaire en a/b ; entre la dernière valeur finie et ∞ : linéaire en b/a
  function coef(r, vals, x) {
    const n = r.length;
    if (x <= r[0]) return { v: vals[0], clamp: x < r[0] - 1e-9 };
    for (let i = 0; i < n - 1; i++) {
      const r0 = r[i], r1 = r[i + 1];
      if (x <= r1) {
        if (r1 === INF) return { v: vals[i] + (vals[i + 1] - vals[i]) * (1 - r0 / x) };
        return { v: vals[i] + (vals[i + 1] - vals[i]) * (x - r0) / (r1 - r0) };
      }
    }
    return { v: vals[n - 1], clamp: r[n - 1] !== INF };
  }
  const lerp1 = (xs, ys, x) => {
    if (x <= xs[0]) return ys[0];
    for (let i = 0; i < xs.length - 1; i++) if (x <= xs[i + 1]) return ys[i] + (ys[i + 1] - ys[i]) * (x - xs[i]) / (xs[i + 1] - xs[i]);
    return ys[ys.length - 1];
  };
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

  /* Grandes flèches : relation charge–flèche α·Q = w + k·w³ (w = y/t), de tangente à l'origine la théorie
     linéaire (α du tableau 11.4) et k ajusté sur le tableau du § 11.11 ; contrainte s(w) = (β/α)·w + c·w². */
  function largeDefl(tab, al, be, Q) {
    const k = median(tab.y.map((w, i) => (i ? (al * LD_Q[i] - w) / w ** 3 : null)).filter((v) => v != null && v > 0));
    const target = al * Q;
    let w = target;
    for (let it = 0; it < 50; it++) w -= (w + k * w ** 3 - target) / (1 + 3 * k * w * w);
    w = Math.max(0, w);
    const sl = be / al, c = median(tab.y.map((ww, i) => (i ? (tab.s[i] - sl * ww) / (ww * ww) : null)).filter((v) => v != null));
    return { w, s: sl * w + c * w * w, k };
  }

  /* Valeurs d'une charge (q en kPa ou W en kN) : coefficients, sorties. */
  function evalLoad(c, L, g, qkPa, WkN) {
    const { a, b, t, E, nu } = g, q = qkPa / 1000, W = WkN * 1000;
    let cs;
    if (c.strip) cs = Object.fromEntries(Object.entries(L.strip(nu)).map(([k, v]) => [k, { v }]));
    else { cs = {}; Object.entries(L.c).forEach(([k, vals]) => (cs[k] = coef(L.r, vals, a / b))); }
    const out = L.out.map((o) => {
      const k = cs[o.coef].v, sg = o.sign || 1;
      let v, unit, formula;
      if (o.kind === 's') { v = sg * k * q * b * b / (t * t); unit = 'MPa'; formula = `${sg < 0 ? '−' : ''}${o.coef.replace('b', 'β_').replace('g', 'γ_').replace(/_$/, '')}·q·b²/t²`; }
      else if (o.kind === 'y') { v = k * q * b ** 4 / (E * t ** 3); unit = 'mm'; formula = 'α·q·b⁴/(E·t³)'; }
      else if (o.kind === 'R') { v = k * q * b; unit = 'kN/m'; formula = `${o.coef.replace('g', 'γ_').replace(/_$/, '')}·q·b`; }
      else if (o.kind === 'sW') { v = 3 * W / (2 * Math.PI * t * t) * ((1 + nu) * Math.log(2 * b / (Math.PI * g.rop)) + k); unit = 'MPa'; formula = '3W/(2π·t²)·[(1+ν)·ln(2b/(π·r′_o)) + β]'; }
      else if (o.kind === 'sWe') { v = sg * k * W / (t * t); unit = 'MPa'; formula = '−β_2·W/t²'; }
      else if (o.kind === 'yW') { v = k * W * b * b / (E * t ** 3); unit = 'mm'; formula = 'α·W·b²/(E·t³)'; }
      return Object.assign({}, o, { k, v, unit, formula: formula.replace(/β_([0-9])/g, 'β_$1').replace(/γ_([0-9])/g, 'γ_$1') });
    });
    return { cs, out };
  }

  function defaultState() {
    return {
      v: 1, kind: 'plaque', name: 'Plaque T1', cas: 'c1', load: 'uni',
      a: 1500, b: 1000, t: 10, grade: 'S235', nu: 0.3, lim: 150, large: true,
      gam: { M0: 1.0 },
      qu: 7.5, qs: 5, Wu: 15, Ws: 10, ro: 50
    };
  }
  function upgrade(s) {
    const d = defaultState();
    (function merge(dst, src) {
      Object.keys(src).forEach((k) => {
        if (dst[k] === undefined) dst[k] = src[k];
        else if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') merge(dst[k], src[k]);
      });
    })(s, d);
    if (!CASE[s.cas]) s.cas = 'c1';
    if (!CASE[s.cas].loads[s.load]) s.load = 'uni';
    return s;
  }

  function compute(s) {
    const R = { valid: true, warnings: [], info: [], checks: [] };
    const c = CASE[s.cas] || CASE.c1, L = c.loads[s.load] || c.loads.uni, conc = /^conc/.test(s.load);
    R.case = c; R.L = L;
    let a = num(s.a), b = num(s.b);
    const t = num(s.t), nu = num(s.nu, 0.3), lim = num(s.lim, 150), gM0 = num(s.gam && s.gam.M0, 1);
    const qu = num(s.qu), qs = num(s.qs), Wu = num(s.Wu), Ws = num(s.Ws), ro = num(s.ro);
    const bad = [];
    if (!(a > 0) || !(b > 0)) bad.push('côtés a et b');
    if (!(t > 0)) bad.push('épaisseur t');
    if (!(nu >= 0 && nu < 0.5)) bad.push('coefficient de Poisson');
    if (!(gM0 > 0)) bad.push('γ_M0');
    if (!(lim > 0)) bad.push('flèche limite');
    if (conc && !(ro > 0)) bad.push('rayon de la zone chargée');
    if (conc ? (Wu < 0 || Ws < 0) : (qu < 0 || qs < 0)) bad.push('charges (positives attendues)');
    if (bad.length) { R.valid = false; R.warnings.push('Données invalides : ' + bad.join(', ') + '.'); return R; }
    let swapped = false;
    if (c.swap && a > b) { [a, b] = [b, a]; swapped = true; }
    const E = D.E, fy = D.fyOf(s.grade, t, 'en10025');
    const rop = ro < 0.5 * t ? Math.sqrt(1.6 * ro * ro + t * t) - 0.675 * t : ro;   // rayon équivalent (tableau 11.4)
    const g = { a, b, t, E, nu, rop };
    const ratio = a / b;
    R.geo = { a, b, t, ratio, swapped, fy, gM0, lim, rop, E, nu };
    const U = evalLoad(c, L, g, qu, Wu), Sv = evalLoad(c, L, g, qs, Ws);
    R.uls = U.out; R.sls = Sv.out; R.cs = U.cs;
    if (!c.strip) {
      if (Object.values(U.cs).some((x) => x.clamp)) R.warnings.push(`a/b = ${ratio.toFixed(2)} sort du tableau de Roark (${L.r[0]} à ${L.r[L.r.length - 1] === INF ? '∞' : L.r[L.r.length - 1]}) : coefficients pris à la borne.`);
      if (c.min >= 1 && num(s.a) < num(s.b)) R.warnings.push('Pour ce cas, a désigne le grand côté : saisir a ≥ b.');
    }
    if (swapped) R.info.push('a > b : côtés permutés pour rester dans le tableau (cas symétrique).');
    if (L.infNote) R.info.push(L.infNote + '.');
    if (L.note) R.info.push(L.note + '.');
    if (L.nu != null && Math.abs(L.nu - nu) > 0.02) R.info.push(`Coefficients établis pour ν = ${L.nu} (acier : 0,3) : écart attendu de quelques % sur la flèche, jusqu'à 15 % sur les contraintes selon Roark (§ 11.10).`);
    // vérifications
    const add = (o) => { o.r = o.Rd > 0 ? Math.abs(o.Ed) / o.Rd : (Math.abs(o.Ed) > 0 ? Infinity : 0); R.checks.push(o); return o; };
    const sU = U.out.filter((o) => o.unit === 'MPa').reduce((m, o) => (Math.abs(o.v) > Math.abs(m ? m.v : 0) ? o : m), null);
    if (sU) add({ grp: 'uls', id: 'sig', label: 'Contrainte de flexion |σ|_max ≤ f_y/γ_M0 (' + sU.label.charAt(0).toLowerCase() + sU.label.slice(1) + ')', ref: 'Roark 11.4 · élastique', Ed: Math.abs(sU.v), Rd: fy / gM0, unit: 'MPa' });
    const yS = Sv.out.find((o) => o.unit === 'mm');
    if (yS) add({ grp: 'sls', id: 'defl', label: `Flèche ELS ≤ b/${lim}`, ref: 'Roark 11.4 · ELS', Ed: Math.abs(yS.v), Rd: b / lim, unit: 'mm' });
    else R.info.push('Roark ne donne pas la flèche pour ce cas : flèche non vérifiée.');
    // grandes flèches (4 appuis simples ou 4 encastrements, pression uniforme)
    if ((c.id === 'c1' || c.id === 'c8') && s.load === 'uni') {
      const tabs = LARGE[c.id === 'c1' ? 'ss' : 'fx'];
      const tab = ratio >= tabs[tabs.length - 1].r ? tabs[tabs.length - 1] : tabs.reduce((m, x) => (Math.abs(x.r - ratio) < Math.abs(m.r - ratio) ? x : m));
      const al = U.cs.a.v, be = Object.keys(U.cs).filter((k) => k[0] === 'b').reduce((m, k) => Math.max(m, Math.abs(U.cs[k].v)), 0);
      const one = (qkPa) => { const Q = qkPa / 1000 * b ** 4 / (E * t ** 4), L2 = largeDefl(tab, al, be, Q); return { Q, y: L2.w * t, s: L2.s * E * t * t / (b * b), out: Q > LD_Q[LD_Q.length - 1] }; };
      R.large = { uls: one(qu), sls: one(qs), where: tab.where, table: tab.label || String(tab.r).replace('.', ',') };
      if (s.large && R.large.sls.y / t > 0.5) R.info.push(`Flèche ELS supérieure à t/2 : l'effet membrane réduit la flèche à ${R.large.sls.y.toFixed(1)} mm et la contrainte ELU à ${R.large.uls.s.toFixed(0)} MPa si les bords sont retenus dans leur plan (§ 11.11).`);
    } else if (yS && Math.abs(yS.v) > 0.5 * t) R.info.push('Flèche supérieure à t/2 : l\'effet membrane devient significatif, la théorie linéaire surestime flèche et contraintes (§ 11.11).');
    R.max = R.checks.reduce((m, x) => Math.max(m, x.r), 0);
    R.gov = R.checks.reduce((gv, x) => (!gv || x.r > gv.r ? x : gv), null);
    return R;
  }

  function summary(st) {
    try {
      const R = compute(st), c = CASE[st.cas];
      return { type: 'Plaque', sec: `${num(st.a)} × ${num(st.b)} × ${num(st.t)} mm ${st.grade} · ${c ? c.label : ''}`, gov: R.gov ? R.gov.label.replace(/\s*\(.*$/, '') : '', max: R.valid ? R.max : null };
    } catch (e) { return null; }
  }

  window.FirmitasPlateCalc = { CASES, CASE, LARGE, LD_Q, coef, largeDefl, evalLoad, compute, defaultState, upgrade, summary, num };
})();
