/*
 * Shared geometry engine for the interactive maths posts: vector/matrix
 * helpers, a 2D plane and an isometric 3D projection, and pointer dragging.
 * No dependencies; loaded before every other engine.
 */
(function () {
  // ---------- vector / matrix math ----------
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const add = (a, b) => a.map((v, i) => v + b[i]);
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const scale = (a, s) => a.map((v) => v * s);
  const norm = (a) => Math.sqrt(dot(a, a));
  const normalize = (a) => {
    const n = norm(a);
    return n < 1e-9 ? a.slice() : scale(a, 1 / n);
  };

  // 2D "cross" (signed area / determinant of two 2D vectors)
  const cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];

  // true 3D cross product
  const cross3 = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];

  // M = [[a,b],[c,d]] as flat [a,b,c,d]; v = [x,y]
  const matVec = (M, v) => [M[0] * v[0] + M[1] * v[1], M[2] * v[0] + M[3] * v[1]];
  const matMul = (A, B) => [
    A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3],
    A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3],
  ];
  const det2 = (M) => M[0] * M[3] - M[1] * M[2];
  const inv2 = (M) => {
    const d = det2(M);
    if (Math.abs(d) < 1e-9) return null;
    return [M[3] / d, -M[1] / d, -M[2] / d, M[0] / d];
  };
  const identity2 = [1, 0, 0, 1];
  const lerpMat2 = (M, t) => [
    1 + (M[0] - 1) * t, M[1] * t,
    M[2] * t, 1 + (M[3] - 1) * t,
  ];

  // closed-form eigen-decomposition of a real 2x2 matrix (assumes real eigenvalues)
  function eig2(M) {
    const [a, b, c, d] = M;
    const tr = a + d;
    const dt = det2(M);
    const disc = tr * tr - 4 * dt;
    if (disc < 0) return null; // complex eigenvalues, not handled
    const s = Math.sqrt(disc);
    const l1 = (tr + s) / 2;
    const l2 = (tr - s) / 2;
    const vecFor = (l) => {
      // (A - lI) v = 0
      let v;
      if (Math.abs(b) > 1e-9) v = [l - d, c];
      else if (Math.abs(c) > 1e-9) v = [b, l - a];
      else v = Math.abs(a - l) < 1e-9 ? [1, 0] : [0, 1];
      return normalize(v);
    };
    return { values: [l1, l2], vectors: [vecFor(l1), vecFor(l2)] };
  }

  // solve [[a,b],[c,d]] [x,y]^T = [e,f]^T
  function solve2(M, rhs) {
    const inv = inv2(M);
    if (!inv) return null;
    return matVec(inv, rhs);
  }

  const LA = { dot, add, sub, scale, norm, normalize, cross2, cross3, matVec, matMul, det2, inv2, identity2, lerpMat2, eig2, solve2 };

  // ---------- 2D plane (canvas coordinate mapper + drawing helpers) ----------
  class Plane2D {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.xMin = opts.xMin ?? -5;
      this.xMax = opts.xMax ?? 5;
      this.yMin = opts.yMin ?? -5;
      this.yMax = opts.yMax ?? 5;
      this.pad = opts.pad ?? 18;
      this._fit();
    }

    _fit() {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.w = rect.width;
      this.h = rect.height;
      const sx = (this.w - 2 * this.pad) / (this.xMax - this.xMin);
      const sy = (this.h - 2 * this.pad) / (this.yMax - this.yMin);
      this.scale = Math.min(sx, sy);
      this.originPx = [
        this.pad + (0 - this.xMin) * this.scale,
        this.h - this.pad - (0 - this.yMin) * this.scale,
      ];
    }

    toPx(p) {
      return [this.originPx[0] + p[0] * this.scale, this.originPx[1] - p[1] * this.scale];
    }

    toMath(px) {
      return [(px[0] - this.originPx[0]) / this.scale, (this.originPx[1] - px[1]) / this.scale];
    }

    clear() {
      this.ctx.clearRect(0, 0, this.w, this.h);
    }

    grid(step = 1) {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = '#ececec';
      ctx.lineWidth = 1;
      for (let x = Math.ceil(this.xMin / step) * step; x <= this.xMax; x += step) {
        const [px0] = this.toPx([x, 0]);
        ctx.beginPath();
        ctx.moveTo(px0, this.toPx([x, this.yMin])[1]);
        ctx.lineTo(px0, this.toPx([x, this.yMax])[1]);
        ctx.stroke();
      }
      for (let y = Math.ceil(this.yMin / step) * step; y <= this.yMax; y += step) {
        const [, py0] = this.toPx([0, y]);
        ctx.beginPath();
        ctx.moveTo(this.toPx([this.xMin, y])[0], py0);
        ctx.lineTo(this.toPx([this.xMax, y])[0], py0);
        ctx.stroke();
      }
      ctx.restore();
    }

    axes() {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = '#bbb';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(this.toPx([this.xMin, 0])[0], this.toPx([this.xMin, 0])[1]);
      ctx.lineTo(this.toPx([this.xMax, 0])[0], this.toPx([this.xMax, 0])[1]);
      ctx.moveTo(this.toPx([0, this.yMin])[0], this.toPx([0, this.yMin])[1]);
      ctx.lineTo(this.toPx([0, this.yMax])[0], this.toPx([0, this.yMax])[1]);
      ctx.stroke();
      ctx.restore();
    }

    arrow(from, to, opts = {}) {
      const ctx = this.ctx;
      const [x0, y0] = this.toPx(from);
      const [x1, y1] = this.toPx(to);
      const color = opts.color || '#222';
      const width = opts.width ?? 2.25;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = width;
      if (opts.dash) ctx.setLineDash(opts.dash);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      const ang = Math.atan2(y1 - y0, x1 - x0);
      const head = opts.head ?? 8;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - head * Math.cos(ang - Math.PI / 7), y1 - head * Math.sin(ang - Math.PI / 7));
      ctx.lineTo(x1 - head * Math.cos(ang + Math.PI / 7), y1 - head * Math.sin(ang + Math.PI / 7));
      ctx.closePath();
      ctx.fill();

      if (opts.label) {
        ctx.font = opts.font || '12px "Helvetica Neue", Arial, sans-serif';
        ctx.fillStyle = opts.labelColor || color;
        const lx = x1 + (opts.labelOffset ? opts.labelOffset[0] : 8 * Math.cos(ang));
        const ly = y1 + (opts.labelOffset ? opts.labelOffset[1] : 8 * Math.sin(ang) - 4);
        ctx.fillText(opts.label, lx, ly);
      }
      ctx.restore();
    }

    point(p, opts = {}) {
      const ctx = this.ctx;
      const [px, py] = this.toPx(p);
      ctx.save();
      ctx.fillStyle = opts.color || '#222';
      ctx.beginPath();
      ctx.arc(px, py, opts.r ?? 4.5, 0, Math.PI * 2);
      ctx.fill();
      if (opts.ring) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (opts.label) {
        ctx.font = opts.font || '12px "Helvetica Neue", Arial, sans-serif';
        ctx.fillStyle = opts.labelColor || opts.color || '#222';
        ctx.fillText(opts.label, px + (opts.dx ?? 8), py + (opts.dy ?? -8));
      }
      ctx.restore();
    }

    segment(p1, p2, opts = {}) {
      const ctx = this.ctx;
      const [x0, y0] = this.toPx(p1);
      const [x1, y1] = this.toPx(p2);
      ctx.save();
      ctx.strokeStyle = opts.color || '#222';
      ctx.lineWidth = opts.width ?? 1.5;
      if (opts.dash) ctx.setLineDash(opts.dash);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.restore();
    }

    circle(center, r, opts = {}) {
      const ctx = this.ctx;
      const [cx, cy] = this.toPx(center);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r * this.scale, 0, Math.PI * 2);
      if (opts.fill) {
        ctx.fillStyle = opts.fill;
        ctx.fill();
      }
      ctx.strokeStyle = opts.stroke || '#222';
      ctx.lineWidth = opts.width ?? 1.5;
      if (opts.dash) ctx.setLineDash(opts.dash);
      ctx.stroke();
      ctx.restore();
    }

    // draws an "infinite" line through p in direction dir, clipped to the plane bounds
    lineThrough(p, dir, opts = {}) {
      const d = normalize(dir);
      const far = Math.max(this.xMax - this.xMin, this.yMax - this.yMin) * 2;
      const p1 = [p[0] - d[0] * far, p[1] - d[1] * far];
      const p2 = [p[0] + d[0] * far, p[1] + d[1] * far];
      this.segment(p1, p2, opts);
    }

    polygon(points, opts = {}) {
      const ctx = this.ctx;
      ctx.save();
      ctx.beginPath();
      points.forEach((p, i) => {
        const [px, py] = this.toPx(p);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      if (opts.fill) {
        ctx.fillStyle = opts.fill;
        ctx.fill();
      }
      if (opts.stroke) {
        ctx.strokeStyle = opts.stroke;
        ctx.lineWidth = opts.width ?? 1.5;
        ctx.stroke();
      }
      ctx.restore();
    }

    text(p, str, opts = {}) {
      const ctx = this.ctx;
      const [px, py] = this.toPx(p);
      ctx.save();
      ctx.font = opts.font || '12px "Helvetica Neue", Arial, sans-serif';
      ctx.fillStyle = opts.color || '#666';
      ctx.fillText(str, px + (opts.dx ?? 0), py + (opts.dy ?? 0));
      ctx.restore();
    }
  }

  // ---------- draggable points on a Plane2D ----------
  // pts: array of objects with mutable .x, .y and a display .color; render(): called after each change
  function makeDraggable(canvas, plane, pts, render, opts = {}) {
    const threshold = opts.threshold ?? 16;
    let active = null;

    function findNear(px) {
      let best = null;
      let bestD = threshold;
      pts.forEach((p) => {
        const [qx, qy] = plane.toPx([p.x, p.y]);
        const d = Math.hypot(px[0] - qx, px[1] - qy);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      });
      return best;
    }

    function posFromEvent(e) {
      const rect = canvas.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    }

    canvas.addEventListener('pointerdown', (e) => {
      const px = posFromEvent(e);
      const p = findNear(px);
      if (p) {
        active = p;
        canvas.setPointerCapture(e.pointerId);
        canvas.classList.add('dragging');
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      const px = posFromEvent(e);
      if (active) {
        const [mx, my] = plane.toMath(px);
        active.x = opts.clamp ? Math.max(plane.xMin, Math.min(plane.xMax, mx)) : mx;
        active.y = opts.clamp ? Math.max(plane.yMin, Math.min(plane.yMax, my)) : my;
        render();
      } else if (opts.hover !== false) {
        canvas.style.cursor = findNear(px) ? 'grab' : 'default';
      }
    });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) =>
      canvas.addEventListener(ev, () => {
        active = null;
        canvas.classList.remove('dragging');
      })
    );
  }

  // ---------- simple isometric 3D helper (for cross product / subspaces sections) ----------
  class Iso3D {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.scale = opts.scale ?? 40;
      this._fit(opts);
    }

    _fit(opts) {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.w = rect.width;
      this.h = rect.height;
      this.origin = opts.origin || [this.w * 0.42, this.h * 0.62];
    }

    // isometric-ish projection: x to the right-down, y up, z to the right-up
    proj(p) {
      const [x, y, z] = p;
      const px = this.origin[0] + (x - z * 0.82) * this.scale;
      const py = this.origin[1] - y * this.scale + z * 0.46 * this.scale;
      return [px, py];
    }

    clear() {
      this.ctx.clearRect(0, 0, this.w, this.h);
    }

    axes(len = 3.2) {
      this.line([0, 0, 0], [len, 0, 0], { color: '#ccc' });
      this.line([0, 0, 0], [0, len, 0], { color: '#ccc' });
      this.line([0, 0, 0], [0, 0, len], { color: '#ccc' });
      this.ctx.save();
      this.ctx.font = '11px "Helvetica Neue", Arial, sans-serif';
      this.ctx.fillStyle = '#999';
      const lx = this.proj([len + 0.15, 0, 0]);
      const ly = this.proj([0, len + 0.15, 0]);
      const lz = this.proj([0, 0, len + 0.15]);
      this.ctx.fillText('x', lx[0], lx[1]);
      this.ctx.fillText('y', ly[0], ly[1]);
      this.ctx.fillText('z', lz[0], lz[1]);
      this.ctx.restore();
    }

    line(p0, p1, opts = {}) {
      const ctx = this.ctx;
      const [x0, y0] = this.proj(p0);
      const [x1, y1] = this.proj(p1);
      ctx.save();
      ctx.strokeStyle = opts.color || '#222';
      ctx.lineWidth = opts.width ?? 1.5;
      if (opts.dash) ctx.setLineDash(opts.dash);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.restore();
    }

    arrow(from, to, opts = {}) {
      const ctx = this.ctx;
      const [x0, y0] = this.proj(from);
      const [x1, y1] = this.proj(to);
      const color = opts.color || '#222';
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = opts.width ?? 2.25;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      const ang = Math.atan2(y1 - y0, x1 - x0);
      const head = 8;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - head * Math.cos(ang - Math.PI / 7), y1 - head * Math.sin(ang - Math.PI / 7));
      ctx.lineTo(x1 - head * Math.cos(ang + Math.PI / 7), y1 - head * Math.sin(ang + Math.PI / 7));
      ctx.closePath();
      ctx.fill();
      if (opts.label) {
        ctx.font = '12px "Helvetica Neue", Arial, sans-serif';
        ctx.fillStyle = color;
        ctx.fillText(opts.label, x1 + 6, y1 - 6);
      }
      ctx.restore();
    }

    // tiled parallelogram grid spanning {u,v} through origin p0 - visualizes a 2D subspace inside R^3
    planeSpan(p0, u, v, opts = {}) {
      const n = opts.range ?? 2;
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = opts.fill || 'rgba(6,69,173,0.08)';
      ctx.strokeStyle = opts.stroke || 'rgba(6,69,173,0.35)';
      ctx.lineWidth = 1;
      const at = (s, t) => [p0[0] + u[0] * s + v[0] * t, p0[1] + u[1] * s + v[1] * t, p0[2] + u[2] * s + v[2] * t];
      const corners = [at(-n, -n), at(n, -n), at(n, n), at(-n, n)].map((p) => this.proj(p));
      ctx.beginPath();
      corners.forEach((c, i) => (i === 0 ? ctx.moveTo(c[0], c[1]) : ctx.lineTo(c[0], c[1])));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      for (let s = -n; s <= n; s++) {
        const a = this.proj(at(s, -n));
        const b = this.proj(at(s, n));
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      for (let t = -n; t <= n; t++) {
        const a = this.proj(at(-n, t));
        const b = this.proj(at(n, t));
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      ctx.restore();
    }

    // parallelogram spanned by u, v from the origin (for cross-product area visualization)
    parallelogram(u, v, opts = {}) {
      const pts = [[0, 0, 0], u, LA.add ? [u[0] + v[0], u[1] + v[1], u[2] + v[2]] : null, v].map((p) => this.proj(p));
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = opts.fill || 'rgba(249,115,22,0.18)';
      ctx.strokeStyle = opts.stroke || 'rgba(249,115,22,0.6)';
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  window.LA = LA;
  window.Plane2D = Plane2D;
  window.Iso3D = Iso3D;
  window.makeDraggable = makeDraggable;
})();
