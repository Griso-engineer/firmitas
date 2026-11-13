/* ==========================================================================
   Firmitas — rendu 3D simple à tampon de profondeur (z-buffer), sans dépendance.
   Projection axonométrique fixe ; primitives : boîtes et prismes (boulons).
   Le rendu est rastérisé dans un canvas puis renvoyé en image PNG, ce qui garantit
   des parties cachées exactes (aucun organe masqué à tort ni dessiné par-dessus).
   Repère : x le long de la barre, y transversal, z vertical. Unités : mm.
   ========================================================================== */
(function () {
  'use strict';
  function camera(az = -32, el = 24) {
    const a = az * Math.PI / 180, e = el * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), ce = Math.cos(e), se = Math.sin(e);
    return {
      p: (x, y, z) => { const xr = x * ca - y * sa, yr = x * sa + y * ca; return { u: xr, v: -(z * ce + yr * se), d: yr * ce - z * se }; },
      away: [sa * ce, ca * ce, -se]          // gradient de la profondeur : direction qui s'éloigne de l'observateur
    };
  }
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const LIGHT = (() => { const l = [-0.35, -0.55, 0.76]; const n = Math.hypot(...l); return l.map((v) => v / n); })();

  // ---------- primitives → faces (polygones convexes dans le monde, normale sortante) ----------
  function boxFaces(b) {
    const { x0, x1, y0, y1, z0, z1 } = b;
    const P = (x, y, z) => [x, y, z];
    return [
      { v: [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], n: [0, 0, 1] },
      { v: [P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0)], n: [0, 0, -1] },
      { v: [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], n: [0, -1, 0] },
      { v: [P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0)], n: [0, 1, 0] },
      { v: [P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], n: [-1, 0, 0] },
      { v: [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], n: [1, 0, 0] }
    ].map((f) => Object.assign(f, { col: b.col, id: b.id }));
  }
  // prisme à base polygonale régulière (n côtés) : axe 'x' | 'y' | 'z', centre c, rayon r, de a0 à a1 le long de l'axe
  function prismFaces(p) {
    const n = p.n || 6, { c, r, a0, a1, axis } = p;
    const ring = (a) => { const pts = []; for (let i = 0; i < n; i++) { const t = 2 * Math.PI * (i + 0.5) / n, u = r * Math.cos(t), w = r * Math.sin(t); pts.push(axis === 'z' ? [c[0] + u, c[1] + w, a] : axis === 'y' ? [c[0] + u, a, c[2] + w] : [a, c[1] + u, c[2] + w]); } return pts; };
    const A = ring(a0), B = ring(a1);
    const ax = axis === 'z' ? [0, 0, 1] : axis === 'y' ? [0, 1, 0] : [1, 0, 0];
    const faces = [{ v: A.slice().reverse(), n: ax.map((v) => -v) }, { v: B, n: ax }];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, t = 2 * Math.PI * (i + 1) / n;
      const u = Math.cos(t), w = Math.sin(t);
      const nn = axis === 'z' ? [u, w, 0] : axis === 'y' ? [u, 0, w] : [0, u, w];
      faces.push({ v: [A[i], A[j], B[j], B[i]], n: nn });
    }
    return faces.map((f) => Object.assign(f, { col: p.col, id: p.id }));
  }

  // ---------- rendu ----------
  function render(scene, opts = {}) {
    const W = opts.W || 560, H = opts.H || 360, SS = opts.ss || 2, pad = opts.pad == null ? 18 : opts.pad, top = opts.top == null ? 34 : opts.top;
    const cam = camera(opts.az, opts.el);
    const faces = [];
    (scene.boxes || []).forEach((b) => faces.push(...boxFaces(b)));
    (scene.prisms || []).forEach((p) => faces.push(...prismFaces(p)));
    // cadrage
    const pts = []; faces.forEach((f) => f.v.forEach((q) => pts.push(cam.p(q[0], q[1], q[2]))));
    (opts.extra || []).forEach((q) => pts.push(cam.p(q[0], q[1], q[2])));
    if (!pts.length) return { img: '', proj: () => ({ x: 0, y: 0 }), W, H };
    const umin = Math.min(...pts.map((q) => q.u)), umax = Math.max(...pts.map((q) => q.u)), vmin = Math.min(...pts.map((q) => q.v)), vmax = Math.max(...pts.map((q) => q.v));
    const k = Math.min((W - 2 * pad) / Math.max(1e-9, umax - umin), (H - top - pad) / Math.max(1e-9, vmax - vmin));
    const ox = (W - (umax - umin) * k) / 2 - umin * k, oy = top + (H - top - pad - (vmax - vmin) * k) / 2 - vmin * k;
    const proj = (x, y, z) => { const q = cam.p(x, y, z); return { x: ox + q.u * k, y: oy + q.v * k, d: q.d }; };
    const cw = W * SS, ch = H * SS;
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(cw, ch), px = img.data;
    const zb = new Float32Array(cw * ch).fill(Infinity);
    const edgeW = opts.edge == null ? 1.1 * SS : opts.edge * SS;
    const tri = (a, b, c, col) => {
      const minx = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))), maxx = Math.min(cw - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
      const miny = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))), maxy = Math.min(ch - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
      const den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
      if (Math.abs(den) < 1e-9) return;
      for (let y = miny; y <= maxy; y++) {
        for (let x = minx; x <= maxx; x++) {
          const X = x + 0.5, Y = y + 0.5;
          const l1 = ((b.y - c.y) * (X - c.x) + (c.x - b.x) * (Y - c.y)) / den;
          const l2 = ((c.y - a.y) * (X - c.x) + (a.x - c.x) * (Y - c.y)) / den;
          const l3 = 1 - l1 - l2;
          if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
          const d = l1 * a.d + l2 * b.d + l3 * c.d, i = y * cw + x;
          if (d < zb[i]) { zb[i] = d; const o = i * 4; px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2]; px[o + 3] = 255; }
        }
      }
    };
    const line = (a, b, col) => {
      const len = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(len)), hw = edgeW / 2;
      for (let s = 0; s <= n; s++) {
        const t = s / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, d = a.d + (b.d - a.d) * t;
        for (let yy = Math.floor(y - hw); yy <= Math.ceil(y + hw); yy++) for (let xx = Math.floor(x - hw); xx <= Math.ceil(x + hw); xx++) {
          if (xx < 0 || yy < 0 || xx >= cw || yy >= ch) continue;
          const i = yy * cw + xx;
          if (d <= zb[i] + opts.bias) { const o = i * 4; px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2]; px[o + 3] = 255; }
        }
      }
    };
    opts.bias = opts.bias == null ? 0.8 / k * 1 + 0.6 : opts.bias;
    const vis = [];
    faces.forEach((f) => {
      const dot = f.n[0] * cam.away[0] + f.n[1] * cam.away[1] + f.n[2] * cam.away[2];
      if (dot >= -1e-9) return;                                 // face tournée vers l'arrière
      const lam = Math.max(0, f.n[0] * LIGHT[0] + f.n[1] * LIGHT[1] + f.n[2] * LIGHT[2]);
      const base = hex(f.col), sh = 0.62 + 0.45 * lam;
      const col = base.map((c) => Math.min(255, Math.round(c * sh)));
      const P = f.v.map((q) => { const p = proj(q[0], q[1], q[2]); return { x: p.x * SS, y: p.y * SS, d: p.d }; });
      for (let i = 1; i < P.length - 1; i++) tri(P[0], P[i], P[i + 1], col);
      vis.push(P);
    });
    const ec = hex(opts.edgeCol || '#111110');
    vis.forEach((P) => { for (let i = 0; i < P.length; i++) line(P[i], P[(i + 1) % P.length], ec); });
    ctx.putImageData(img, 0, 0);
    return { img: cv.toDataURL('image/png'), proj, W, H, k, cam };
  }

  window.FirmitasR3D = { render, camera };
})();
