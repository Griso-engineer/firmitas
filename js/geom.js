/* ==========================================================================
   Firmitas — caractéristiques géométriques des sections (unités : mm).
   Profils en I à ailes parallèles (laminés ou reconstitués soudés), tubes
   rectangulaires / carrés (EN 10210-2 finis à chaud, EN 10219-2 formés à froid),
   tubes ronds. Les caractéristiques sont calculées depuis les dimensions :
   aucune valeur tabulée ne peut donc être incohérente avec la géométrie.
   ========================================================================== */
(function () {
  'use strict';
  const PI = Math.PI;
  const RHO = 7850;                       // kg/m³
  // congé de rayon r (carré r×r moins quart de cercle)
  const fillet = (r) => ({
    A: r * r * (1 - PI / 4),
    c: r * (10 - 3 * PI) / (12 - 3 * PI),                       // distance du centre de gravité aux faces
    I: Math.pow(r, 4) * (1 / 3 - PI / 16 - 1 / (3 * (12 - 3 * PI)))   // inertie propre
  });

  function finish(S) {
    S.iy = Math.sqrt(S.Iy / S.A); S.iz = Math.sqrt(S.Iz / S.A);
    S.G = S.A * RHO / 1e6;                // kg/m
    return S;
  }

  // ---------- I à ailes parallèles ----------
  function iSection(name, h, b, tw, tf, r, fab) {
    r = r || 0;
    const hi = h - 2 * tf, f = fillet(r);
    const A = 2 * b * tf + hi * tw + 4 * f.A;
    const Iy = (b * h * h * h - (b - tw) * hi * hi * hi) / 12 + 4 * (f.I + f.A * Math.pow(hi / 2 - f.c, 2));
    const Iz = (2 * tf * b * b * b + hi * tw * tw * tw) / 12 + 4 * (f.I + f.A * Math.pow(tw / 2 + f.c, 2));
    const Wply = tw * h * h / 4 + (b - tw) * (h - tf) * tf + 4 * f.A * (hi / 2 - f.c);
    const Wplz = b * b * tf / 2 + hi * tw * tw / 4 + 4 * f.A * (tw / 2 + f.c);
    let It;
    if (r > 0) {
      // formule du catalogue ArcelorMittal (congés inclus)
      const D = (Math.pow(r + tw / 2, 2) + Math.pow(r + tf, 2) - r * r) / (2 * r + tf);
      It = 2 / 3 * (b - 0.63 * tf) * Math.pow(tf, 3) + (h - 2 * tf) * Math.pow(tw, 3) / 3 + 2 * (tw / tf) * (0.145 + 0.1 * r / tf) * Math.pow(D, 4);
    } else It = (2 * b * Math.pow(tf, 3) + (h - tf) * Math.pow(tw, 3)) / 3;
    const Avz = Math.max(A - 2 * b * tf + (tw + 2 * r) * tf, hi * tw);       // 6.2.6(3) a), η = 1
    return finish({
      type: 'I', fab: fab || 'rolled', name, h, b, tw, tf, r, t: tf,
      A, Iy, Iz, Wely: 2 * Iy / h, Welz: 2 * Iz / b, Wply, Wplz, It,
      Iw: tf * b * b * b * Math.pow(h - tf, 2) / 24,
      Avz, Avy: A - hi * tw, hw: hi,
      cw: hi - 2 * r, cf: (b - tw) / 2 - r
    });
  }

  // ---------- IPN (ailes inclinées) : valeurs tabulées ----------
  function ipn(row) {
    const [name, h, b, tw, tf, r, A, Iy, Wely, Wply, Avz, Iz, Welz, Wplz, It] = row;
    const hi = h - 2 * tf;
    return finish({
      type: 'I', fab: 'rolled', tab: true, name, h, b, tw, tf, r, t: tf,
      A, Iy, Iz, Wely, Welz, Wply, Wplz, It,
      Iw: Iz * Math.pow(h - tf, 2) / 4,
      Avz, Avy: A - hi * tw, hw: hi,
      cw: hi - 2 * r, cf: (b - tw) / 2 - r
    });
  }

  // ---------- tube rectangulaire / carré ----------
  function rhs(h, b, t, fab) {
    fab = fab || 'hot';
    let ro, ri;
    if (fab === 'cold') { ro = t <= 6 ? 2 * t : t <= 10 ? 2.5 * t : 3 * t; ri = ro - t; }   // EN 10219-2
    else { ro = 1.5 * t; ri = t; }                                                         // EN 10210-2
    const fo = fillet(ro), fi = fillet(ri);
    const A = 2 * t * (b + h - 2 * t) - 4 * (fo.A - fi.A);
    const I = (B, H) => {
      const ho = H / 2 - fo.c, hin = (H - 2 * t) / 2 - fi.c;
      return B * H * H * H / 12 - (B - 2 * t) * Math.pow(H - 2 * t, 3) / 12 - 4 * (fo.I + fo.A * ho * ho) + 4 * (fi.I + fi.A * hin * hin);
    };
    const Wp = (B, H) => B * H * H / 4 - (B - 2 * t) * Math.pow(H - 2 * t, 2) / 4 - 4 * fo.A * (H / 2 - fo.c) + 4 * fi.A * ((H - 2 * t) / 2 - fi.c);
    const Iy = I(b, h), Iz = I(h, b);
    const rc = (ro + ri) / 2;
    const hp = 2 * ((b - t) + (h - t)) - 2 * rc * (4 - PI);
    const Ah = (b - t) * (h - t) - rc * rc * (4 - PI);
    const It = t * t * t * hp / 3 + 2 * (2 * Ah * t / hp) * Ah;
    const sq = Math.abs(h - b) < 1e-9;
    const f = (x) => String(x).replace('.', ',');
    return finish({
      type: 'RHS', fab, name: (sq ? 'SHS ' : 'RHS ') + f(h) + ' × ' + f(b) + ' × ' + f(t), h, b, tw: t, tf: t, r: ri, t,
      A, Iy, Iz, Wely: 2 * Iy / h, Welz: 2 * Iz / b, Wply: Wp(b, h), Wplz: Wp(h, b), It, Iw: 0,
      Avz: A * h / (b + h), Avy: A * b / (b + h), hw: h - 2 * t,
      cw: h - 3 * t, cf: b - 3 * t
    });
  }

  // ---------- tube rond ----------
  function chs(d, t, fab) {
    const di = d - 2 * t;
    const A = PI * (d * d - di * di) / 4, I = PI * (Math.pow(d, 4) - Math.pow(di, 4)) / 64;
    const Wpl = (d * d * d - di * di * di) / 6;
    const f = (x) => String(x).replace('.', ',');
    return finish({
      type: 'CHS', fab: fab || 'hot', name: 'CHS ' + f(d) + ' × ' + f(t), h: d, b: d, d, tw: t, tf: t, r: 0, t,
      A, Iy: I, Iz: I, Wely: 2 * I / d, Welz: 2 * I / d, Wply: Wpl, Wplz: Wpl, It: 2 * I, Iw: 0,
      Avz: 2 * A / PI, Avy: 2 * A / PI, hw: di, cw: d, cf: d
    });
  }

  window.FirmitasGeom = { iSection, ipn, rhs, chs, RHO };
})();
