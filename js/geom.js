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

  // ---------- rectangle plein (plat, fer plat, raidisseur) ----------
  /* h selon z (plan de M_y), b selon y. I_t de Saint-Venant (Roark, tableau 10.7) avec a = grand côté, c = petit côté :
     I_t = a·c³·[1/3 − 0,21·(c/a)·(1 − (c/a)⁴/12)] ; I_w négligé (= 0, prudent). A_v = A (6.2.6(3) g). */
  function rect(h, b) {
    const A = h * b, a = Math.max(h, b), c = Math.min(h, b), q = c / a;
    const It = a * c * c * c * (1 / 3 - 0.21 * q * (1 - Math.pow(q, 4) / 12));
    const f = (x) => String(x).replace('.', ',');
    return finish({
      type: 'RECT', fab: 'hot', name: `Plat ${f(h)} × ${f(b)}`, h, b, t: c, tw: b, tf: h, r: 0,
      A, Iy: b * h * h * h / 12, Iz: h * b * b * b / 12, Wely: b * h * h / 6, Welz: h * b * b / 6, Wply: b * h * h / 4, Wplz: h * b * b / 4,
      It, Iw: 0, Avz: A, Avy: A, hw: 0, cw: 0, cf: 0
    });
  }

  // ---------- cornières (EN 10056-1) ----------
  /* Aile h selon z (verticale), aile b selon y (horizontale), épaisseur t, congé de pied r1 (arrondis d'extrémité
     négligés, < 0,5 % de l'aire). Caractéristiques calculées dans les axes géométriques puis principaux :
     u = axe fort, v = axe faible. Pour le moteur de vérification, y ≡ u et z ≡ v (Iy = Iu, Iz = Iv, W_el minimaux).
     Centre de cisaillement à l'intersection des feuillets moyens des ailes. */
  function angle(h, b, t, r1) {
    r1 = r1 || 0;
    const parts = [
      { A: t * h, y: t / 2, z: h / 2, Iy: t * h ** 3 / 12, Iz: h * t ** 3 / 12, Pyz: 0 },               // aile h
      { A: (b - t) * t, y: t + (b - t) / 2, z: t / 2, Iy: (b - t) * t ** 3 / 12, Iz: t * (b - t) ** 3 / 12, Pyz: 0 }   // aile b
    ];
    if (r1 > 0) {
      const f = fillet(r1);
      parts.push({ A: f.A, y: t + f.c, z: t + f.c, Iy: f.I, Iz: f.I, Pyz: -0.004438 * r1 ** 4 });          // congé de pied
      // arrondis d'extrémité des ailes r2 = r1/2 (EN 10056-1) : matière retirée à l'angle intérieur de chaque bout d'aile
      const r2 = r1 / 2, g = fillet(r2);
      if (r2 < t) {
        parts.push({ A: -g.A, y: t - g.c, z: h - g.c, Iy: -g.I, Iz: -g.I, Pyz: 0.004438 * r2 ** 4 });
        parts.push({ A: -g.A, y: b - g.c, z: t - g.c, Iy: -g.I, Iz: -g.I, Pyz: 0.004438 * r2 ** 4 });
      }
    }
    const A = parts.reduce((s, p) => s + p.A, 0);
    const ey = parts.reduce((s, p) => s + p.A * p.y, 0) / A, ez = parts.reduce((s, p) => s + p.A * p.z, 0) / A;
    // moments du second ordre au centre de gravité : Szz = ∫z² (= I_y), Syy = ∫y² (= I_z), Syz = ∫y·z
    const Szz = parts.reduce((s, p) => s + p.Iy + p.A * (p.z - ez) ** 2, 0);
    const Syy = parts.reduce((s, p) => s + p.Iz + p.A * (p.y - ey) ** 2, 0);
    const Syz = parts.reduce((s, p) => s + p.Pyz + p.A * (p.y - ey) * (p.z - ez), 0);
    // axes principaux : I_axe = nᵀ·M·n (n normale à l'axe), M = [[Syy, Syz], [Syz, Szz]]
    const m = (Syy + Szz) / 2, d = Math.sqrt(((Syy - Szz) / 2) ** 2 + Syz ** 2);
    const Iu = m + d, Iv = m - d;
    const nOf = (lam) => { const v = Math.abs(Syz) > 1e-12 ? [Syz, lam - Syy] : (Syy >= Szz ? (lam === Iu ? [1, 0] : [0, 1]) : (lam === Iu ? [0, 1] : [1, 0])); const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };
    const nU = nOf(Iu), nV = nOf(Iv);                     // normales aux axes u et v (= directions des axes v et u)
    const pts = [[0, 0], [b, 0], [b, t], [t, h], [0, h]].map(([y, z]) => [y - ey, z - ez]);
    const dist = (n) => Math.max(...pts.map((p) => Math.abs(p[0] * n[0] + p[1] * n[1])));
    const Welu = Iu / dist(nU), Welv = Iv / dist(nV);
    // centre de cisaillement (talon des feuillets moyens) dans les axes principaux : u0 le long de l'axe u, v0 le long de v
    const s0 = [t / 2 - ey, t / 2 - ez];
    const eU = nV, eV = nU;                               // direction de l'axe u = normale à l'axe v
    const u0 = s0[0] * eU[0] + s0[1] * eU[1], v0 = s0[0] * eV[0] + s0[1] * eV[1];
    const It = (h + b - t) * t ** 3 / 3;
    const hp = h - t / 2, bp = b - t / 2, Iw = t ** 3 * (hp ** 3 + bp ** 3) / 36;
    const alpha = (() => { let a = Math.atan2(nV[1], nV[0]) * 180 / PI; while (a > 90) a -= 180; while (a <= -90) a += 180; return a; })();   // inclinaison de l'axe u sur l'axe y (aile b), ramenée dans ]−90° ; 90°]
    const f = (x) => String(x).replace('.', ',');
    const Av = Math.min(h, b) * t;                       // aire de cisaillement prudente (aile la plus courte)
    return finish({
      type: 'L', name: `L ${f(h)} × ${f(b)} × ${f(t)}`, h, b, t, r: r1, tw: t, tf: t,
      A, Iy: Iu, Iz: Iv, Wely: Welu, Welz: Welv, Wply: Welu, Wplz: Welv, It, Iw,
      Avz: Av, Avy: Av, hw: h - t, cw: h - t, cf: b - t,
      geo: { ey, ez, Iyg: Szz, Izg: Syy, Iyzg: Syz, alpha, u0, v0, Iu, Iv }
    });
  }

  window.FirmitasGeom = { iSection, ipn, rhs, chs, angle, rect, RHO };
})();
