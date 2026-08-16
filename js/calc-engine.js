/*
 * Calculus / vector-calculus primitives, shared by the calculus and differential
 * equations posts. Loaded after js/prob-engine.js, whose Chart2D this file
 * extends with scalar- and vector-field drawing.
 *
 * Nothing here is symbolic: derivatives are central differences and integrals
 * are quadrature. That is deliberate — the demos are about what the operators
 * *do*, and a numeric definition keeps every section runnable on any function
 * the reader drags into place.
 */
(function () {
  const Chart2D = window.Chart2D;
  if (!Chart2D) throw new Error('calc-engine.js requires prob-engine.js (Chart2D)');

  /* ------------------------------------------------ numeric differentiation */

  // Central differences. h is chosen well above the sqrt(eps) noise floor for
  // float64 (~1.5e-8) so plots stay smooth rather than speckled.
  const H = 1e-4;

  const ddx = (f, x, h = H) => (f(x + h) - f(x - h)) / (2 * h);
  const d2dx2 = (f, x, h = 1e-3) => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);

  // Partial derivatives of a scalar field f(x, y).
  const dfdx = (f, x, y, h = H) => (f(x + h, y) - f(x - h, y)) / (2 * h);
  const dfdy = (f, x, y, h = H) => (f(x, y + h) - f(x, y - h)) / (2 * h);
  const grad2 = (f, x, y, h = H) => [dfdx(f, x, y, h), dfdy(f, x, y, h)];

  // Hessian of a scalar field, as flat [fxx, fxy, fyx, fyy] to match the 2x2
  // matrix layout LA (engine.js) already uses.
  const hessian2 = (f, x, y, h = 1e-3) => {
    const fxx = (f(x + h, y) - 2 * f(x, y) + f(x - h, y)) / (h * h);
    const fyy = (f(x, y + h) - 2 * f(x, y) + f(x, y - h)) / (h * h);
    const fxy = (f(x + h, y + h) - f(x + h, y - h) - f(x - h, y + h) + f(x - h, y - h)) / (4 * h * h);
    return [fxx, fxy, fxy, fyy];
  };

  // Jacobian of a vector field F(x, y) -> [u, v], flat [ux, uy, vx, vy].
  const jacobian2 = (F, x, y, h = H) => {
    const [ux1, vx1] = F(x + h, y), [ux0, vx0] = F(x - h, y);
    const [uy1, vy1] = F(x, y + h), [uy0, vy0] = F(x, y - h);
    return [(ux1 - ux0) / (2 * h), (uy1 - uy0) / (2 * h),
      (vx1 - vx0) / (2 * h), (vy1 - vy0) / (2 * h)];
  };

  const divergence2 = (F, x, y, h = H) => {
    const J = jacobian2(F, x, y, h);
    return J[0] + J[3]; // ∂u/∂x + ∂v/∂y = trace of the Jacobian
  };

  // 2D scalar curl (the z-component of ∇×F).
  const curl2 = (F, x, y, h = H) => {
    const J = jacobian2(F, x, y, h);
    return J[2] - J[1]; // ∂v/∂x − ∂u/∂y
  };

  const laplacian2 = (f, x, y, h = 1e-3) => {
    const Hs = hessian2(f, x, y, h);
    return Hs[0] + Hs[3]; // trace of the Hessian
  };

  /* ------------------------------------------------------------ quadrature */

  // Composite Simpson; n is forced even.
  function integrate(f, a, b, n = 400) {
    if (n % 2) n += 1;
    const h = (b - a) / n;
    let s = f(a) + f(b);
    for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
    return (s * h) / 3;
  }

  // Running integral F(x) = ∫[a,x] f, returned as sample points for plotting.
  function cumulative(f, a, b, n = 240) {
    const h = (b - a) / n;
    const out = [[a, 0]];
    let acc = 0;
    for (let i = 1; i <= n; i++) {
      const x0 = a + (i - 1) * h, x1 = a + i * h;
      acc += (h / 6) * (f(x0) + 4 * f((x0 + x1) / 2) + f(x1)); // Simpson on the panel
      out.push([x1, acc]);
    }
    return out;
  }

  /* -------------------------------------------------------- ODE integrators */

  // All take f(t, y) with y a number or an array, and return the next state.
  const isVec = (y) => Array.isArray(y);
  const vadd = (a, b, s = 1) => (isVec(a) ? a.map((v, i) => v + s * b[i]) : a + s * b);
  const vscale = (a, s) => (isVec(a) ? a.map((v) => v * s) : a * s);

  const eulerStep = (f, t, y, dt) => vadd(y, vscale(f(t, y), dt));

  const rk4Step = (f, t, y, dt) => {
    const k1 = f(t, y);
    const k2 = f(t + dt / 2, vadd(y, k1, dt / 2));
    const k3 = f(t + dt / 2, vadd(y, k2, dt / 2));
    const k4 = f(t + dt, vadd(y, k3, dt));
    const sum = isVec(y)
      ? k1.map((v, i) => v + 2 * k2[i] + 2 * k3[i] + k4[i])
      : k1 + 2 * k2 + 2 * k3 + k4;
    return vadd(y, sum, dt / 6);
  };

  // Midpoint / RK2 — the intermediate accuracy rung the ODE post compares.
  const rk2Step = (f, t, y, dt) => {
    const k1 = f(t, y);
    const k2 = f(t + dt / 2, vadd(y, k1, dt / 2));
    return vadd(y, k2, dt);
  };

  const STEPPERS = { euler: eulerStep, rk2: rk2Step, rk4: rk4Step };

  // Returns [[t, y], ...]. `method` names a key of STEPPERS.
  function integrateODE(f, y0, t0, t1, dt, method = 'rk4') {
    const step = STEPPERS[method] ?? rk4Step;
    const out = [[t0, y0]];
    let t = t0, y = y0;
    const n = Math.max(1, Math.ceil((t1 - t0) / dt));
    for (let i = 0; i < n; i++) {
      y = step(f, t, y, dt);
      t += dt;
      // Blow-ups are the point of the stability demo, but they must not become
      // NaN and poison every later plot.
      if (!Number.isFinite(isVec(y) ? y[0] : y)) { out.push([t, y]); break; }
      out.push([t, y]);
    }
    return out;
  }

  // Streamline of a stationary 2D field, integrated in both directions.
  function streamline(F, seed, { dt = 0.05, steps = 220, bounds = null } = {}) {
    const path = [];
    for (const dir of [1, -1]) {
      let p = seed.slice();
      const side = [];
      for (let i = 0; i < steps; i++) {
        const f = (t, y) => { const [u, v] = F(y[0], y[1]); return [dir * u, dir * v]; };
        p = rk4Step(f, 0, p, dt);
        if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) break;
        if (bounds && (p[0] < bounds[0] || p[0] > bounds[1] || p[1] < bounds[2] || p[1] > bounds[3])) break;
        side.push(p.slice());
      }
      if (dir === 1) path.push(...side);
      else path.unshift(...side.reverse());
    }
    return path;
  }

  /* ------------------------------------------------- Chart2D field drawing */

  // Diverging blue→white→red ramp for signed scalar fields; `t` in [-1, 1].
  function diverging(t) {
    const k = Math.max(-1, Math.min(1, t));
    if (k >= 0) return [255, Math.round(255 - 150 * k), Math.round(255 - 190 * k)];
    return [Math.round(255 + 210 * k), Math.round(255 + 130 * k), 255];
  }

  // Paints a scalar field as an image. `res` is the pixel step — 3 or 4 keeps
  // this cheap enough to run inside a slider drag.
  Chart2D.prototype.heat = function heat(f, opts = {}) {
    const ctx = this.ctx;
    const res = opts.res ?? 4;
    const w = Math.max(1, Math.round(this.plotW / res));
    const h = Math.max(1, Math.round(this.plotH / res));
    const vals = new Float64Array(w * h);
    let lo = Infinity, hi = -Infinity;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const x = this.toX(this.padL + (i + 0.5) * res);
        const y = this.toY(this.padT + (j + 0.5) * res);
        const v = f(x, y);
        vals[j * w + i] = Number.isFinite(v) ? v : 0;
        if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
      }
    }
    if (opts.min !== undefined) lo = opts.min;
    if (opts.max !== undefined) hi = opts.max;
    const span = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
    const img = ctx.createImageData(w, h);
    const ramp = opts.ramp || diverging;
    for (let k = 0; k < w * h; k++) {
      const [r, g, b] = ramp(vals[k] / span);
      img.data[k * 4] = r; img.data[k * 4 + 1] = g; img.data[k * 4 + 2] = b;
      img.data[k * 4 + 3] = Math.round(255 * (opts.alpha ?? 0.85));
    }
    // Blit through an offscreen canvas so the small buffer scales to the plot.
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    off.getContext('2d').putImageData(img, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, this.padL, this.padT, this.plotW, this.plotH);
    ctx.restore();
    this._heatRange = [lo, hi];
    return this;
  };

  // Marching squares iso-lines for a scalar field.
  Chart2D.prototype.contour = function contour(f, levels, opts = {}) {
    const ctx = this.ctx;
    const n = opts.grid ?? 60;
    const xs = Array.from({ length: n + 1 }, (_, i) => this.xMin + (i / n) * (this.xMax - this.xMin));
    const ys = Array.from({ length: n + 1 }, (_, j) => this.yMin + (j / n) * (this.yMax - this.yMin));
    const g = ys.map((y) => xs.map((x) => f(x, y)));
    ctx.save();
    ctx.strokeStyle = opts.color || 'rgba(60,60,60,.45)';
    ctx.lineWidth = opts.width ?? 1;
    if (opts.dash) ctx.setLineDash(opts.dash);
    const interp = (a, b, va, vb, L) => a + ((L - va) / (vb - va)) * (b - a);
    for (const L of levels) {
      ctx.beginPath();
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const v = [g[j][i], g[j][i + 1], g[j + 1][i + 1], g[j + 1][i]];
          const px = [xs[i], xs[i + 1], xs[i + 1], xs[i]];
          const py = [ys[j], ys[j], ys[j + 1], ys[j + 1]];
          const pts = [];
          for (let e = 0; e < 4; e++) {
            const a = e, b = (e + 1) % 4;
            if ((v[a] < L) === (v[b] < L)) continue;
            if (!Number.isFinite(v[a]) || !Number.isFinite(v[b])) continue;
            // Only x or y varies along any one cell edge, so interpolate both.
            pts.push([interp(px[a], px[b], v[a], v[b], L), interp(py[a], py[b], v[a], v[b], L)]);
          }
          for (let k = 0; k + 1 < pts.length; k += 2) {
            ctx.moveTo(this.px(pts[k][0]), this.py(pts[k][1]));
            ctx.lineTo(this.px(pts[k + 1][0]), this.py(pts[k + 1][1]));
          }
        }
      }
      ctx.stroke();
    }
    ctx.restore();
    return this;
  };

  // Arrow grid for a vector field. Arrows are length-normalized by default so
  // direction stays readable where the field is weak; colour carries magnitude.
  Chart2D.prototype.quiver = function quiver(F, opts = {}) {
    const ctx = this.ctx;
    const nx = opts.nx ?? 15;
    const ny = opts.ny ?? 13;
    const cells = [];
    let maxMag = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const x = this.xMin + ((i + 0.5) / nx) * (this.xMax - this.xMin);
        const y = this.yMin + ((j + 0.5) / ny) * (this.yMax - this.yMin);
        const [u, v] = F(x, y);
        if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
        const m = Math.hypot(u, v);
        maxMag = Math.max(maxMag, m);
        cells.push({ x, y, u, v, m });
      }
    }
    if (!maxMag) return this;
    const cell = Math.min(this.plotW / nx, this.plotH / ny);
    const L = opts.length ?? cell * 0.42;
    ctx.save();
    for (const c of cells) {
      if (c.m < 1e-9) continue;
      const k = opts.scaled ? Math.min(1, c.m / maxMag) : 1;
      const ux = (c.u / c.m) * L * k;
      const uy = (c.v / c.m) * L * k;
      const x0 = this.px(c.x) - ux / 2;
      const y0 = this.py(c.y) + uy / 2;
      const x1 = x0 + ux;
      const y1 = y0 - uy;
      const t = c.m / maxMag;
      ctx.strokeStyle = opts.color || `rgba(6,69,173,${0.25 + 0.6 * t})`;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = opts.width ?? 1.4;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      // Arrow head.
      const a = Math.atan2(y1 - y0, x1 - x0);
      const hs = Math.min(5, L * 0.4);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - hs * Math.cos(a - 0.4), y1 - hs * Math.sin(a - 0.4));
      ctx.lineTo(x1 - hs * Math.cos(a + 0.4), y1 - hs * Math.sin(a + 0.4));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return this;
  };

  Chart2D.prototype.streamlines = function streamlines(F, seeds, opts = {}) {
    const bounds = [this.xMin, this.xMax, this.yMin, this.yMax];
    for (const s of seeds) {
      const path = streamline(F, s, { dt: opts.dt ?? 0.04, steps: opts.steps ?? 200, bounds });
      if (path.length > 1) this.curve(path, { color: opts.color || 'rgba(6,69,173,.5)', width: opts.width ?? 1.4 });
    }
    return this;
  };

  window.Calc = {
    ddx, d2dx2, dfdx, dfdy, grad2, hessian2, jacobian2, divergence2, curl2, laplacian2,
    integrate, cumulative,
    eulerStep, rk2Step, rk4Step, integrateODE, streamline, STEPPERS,
    diverging,
  };
})();
