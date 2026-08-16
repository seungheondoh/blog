/*
 * Probability primitives shared by the maths posts. No external dependencies.
 * Loaded after js/engine.js, whose Plane2D / makeDraggable / LA helpers cover
 * anything that is plain 2D geometry.
 *
 * Everything here is deliberately seeded: a reader who drags a slider back and
 * forth should see the same samples, not a new random cloud each frame.
 */
(function () {
  // ---------- seeded RNG ----------

  // mulberry32 — small, fast, good enough for illustration.
  function RNG(seed = 1) {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      uniform: next,
      // Box-Muller. One value per call; the paired value is cached.
      normal: (() => {
        let spare = null;
        return () => {
          if (spare !== null) { const s = spare; spare = null; return s; }
          let u = 0, v = 0;
          while (u === 0) u = next();
          while (v === 0) v = next();
          const r = Math.sqrt(-2 * Math.log(u));
          spare = r * Math.sin(2 * Math.PI * v);
          return r * Math.cos(2 * Math.PI * v);
        };
      })(),
      reseed(s) { a = s >>> 0; },
    };
  }

  // ---------- distributions ----------
  //
  // Each returns { pdf|pmf, cdf, quantile, sample, mean, variance }. `sample`
  // takes an RNG so the caller controls reproducibility.

  const SQRT2PI = Math.sqrt(2 * Math.PI);

  // Abramowitz & Stegun 7.1.26 — enough accuracy for a plot.
  function erf(x) {
    const s = Math.sign(x);
    x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t
      - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }

  // Inverse standard normal CDF (Acklam's rational approximation).
  function probit(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
      1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
      6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
      -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
      3.754408661907416e+00];
    const pl = 0.02425;
    let q, r;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
        / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - pl) return -probit(1 - p);
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
      / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  const gaussian = (mu = 0, sigma = 1) => ({
    kind: 'continuous',
    mu, sigma,
    pdf: (x) => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)) / (sigma * SQRT2PI),
    cdf: (x) => 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2))),
    quantile: (p) => mu + sigma * probit(p),
    sample: (rng) => mu + sigma * rng.normal(),
    mean: mu,
    variance: sigma * sigma,
  });

  const laplace = (mu = 0, b = 1) => ({
    kind: 'continuous',
    mu, b,
    pdf: (x) => Math.exp(-Math.abs(x - mu) / b) / (2 * b),
    cdf: (x) => (x < mu
      ? 0.5 * Math.exp((x - mu) / b)
      : 1 - 0.5 * Math.exp(-(x - mu) / b)),
    quantile: (p) => (p < 0.5
      ? mu + b * Math.log(2 * p)
      : mu - b * Math.log(2 - 2 * p)),
    sample: (rng) => {
      const u = rng.uniform() - 0.5;
      return mu - b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
    },
    mean: mu,
    variance: 2 * b * b,
  });

  const uniform = (lo = 0, hi = 1) => ({
    kind: 'continuous',
    lo, hi,
    pdf: (x) => (x >= lo && x <= hi ? 1 / (hi - lo) : 0),
    cdf: (x) => Math.min(1, Math.max(0, (x - lo) / (hi - lo))),
    quantile: (p) => lo + p * (hi - lo),
    sample: (rng) => lo + rng.uniform() * (hi - lo),
    mean: (lo + hi) / 2,
    variance: (hi - lo) ** 2 / 12,
  });

  const bernoulli = (p = 0.5) => ({
    kind: 'discrete',
    p,
    support: [0, 1],
    pmf: (k) => (k === 1 ? p : k === 0 ? 1 - p : 0),
    cdf: (k) => (k < 0 ? 0 : k < 1 ? 1 - p : 1),
    sample: (rng) => (rng.uniform() < p ? 1 : 0),
    mean: p,
    variance: p * (1 - p),
  });

  // `probs` need not be normalized; it is normalized on construction.
  const categorical = (probs) => {
    const total = probs.reduce((s, v) => s + v, 0);
    const p = probs.map((v) => v / total);
    const cum = p.reduce((acc, v) => (acc.push((acc[acc.length - 1] ?? 0) + v), acc), []);
    const support = p.map((_, i) => i);
    return {
      kind: 'discrete',
      p, support,
      pmf: (k) => p[k] ?? 0,
      cdf: (k) => cum[Math.min(Math.floor(k), cum.length - 1)] ?? 0,
      sample: (rng) => {
        const u = rng.uniform();
        for (let i = 0; i < cum.length; i++) if (u < cum[i]) return i;
        return cum.length - 1;
      },
      mean: p.reduce((s, v, i) => s + i * v, 0),
      get variance() {
        const m = this.mean;
        return p.reduce((s, v, i) => s + v * (i - m) ** 2, 0);
      },
    };
  };

  // Weighted sum of component distributions. `weights` is normalized here too.
  const mixture = (components, weights) => {
    const total = weights.reduce((s, v) => s + v, 0);
    const w = weights.map((v) => v / total);
    const density = (x) => components.reduce((s, c, i) => s + w[i] * c.pdf(x), 0);
    return {
      kind: 'continuous',
      components, weights: w,
      pdf: density,
      cdf: (x) => components.reduce((s, c, i) => s + w[i] * c.cdf(x), 0),
      sample: (rng) => {
        const u = rng.uniform();
        let acc = 0;
        for (let i = 0; i < w.length; i++) {
          acc += w[i];
          if (u < acc) return components[i].sample(rng);
        }
        return components[components.length - 1].sample(rng);
      },
      // P(component = i | x) — the "responsibility" the mixture demo colours by.
      responsibilities: (x) => {
        const num = components.map((c, i) => w[i] * c.pdf(x));
        const denom = num.reduce((s, v) => s + v, 0) || 1;
        return num.map((v) => v / denom);
      },
      get mean() { return components.reduce((s, c, i) => s + w[i] * c.mean, 0); },
    };
  };

  const softmax = (logits, T = 1) => {
    const m = Math.max(...logits);
    const e = logits.map((z) => Math.exp((z - m) / T));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / s);
  };

  const sigmoid = (z) => 1 / (1 + Math.exp(-z));

  const Dist = { gaussian, laplace, uniform, bernoulli, categorical, mixture, softmax, sigmoid, erf, probit };

  // ---------- sample statistics ----------

  const mean = (xs) => xs.reduce((s, v) => s + v, 0) / (xs.length || 1);
  const variance = (xs) => {
    const m = mean(xs);
    return xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length || 1);
  };
  const covariance = (xs, ys) => {
    const mx = mean(xs), my = mean(ys);
    return xs.reduce((s, v, i) => s + (v - mx) * (ys[i] - my), 0) / (xs.length || 1);
  };
  const correlation = (xs, ys) =>
    covariance(xs, ys) / (Math.sqrt(variance(xs) * variance(ys)) || 1);

  // Bins samples into [lo, hi). `density: true` scales counts so the bars
  // integrate to 1, which is what makes a histogram comparable to a PDF.
  function histogram(samples, { lo, hi, bins = 30, density = true } = {}) {
    const width = (hi - lo) / bins;
    const counts = new Array(bins).fill(0);
    for (const x of samples) {
      const i = Math.floor((x - lo) / width);
      if (i >= 0 && i < bins) counts[i]++;
    }
    const scale = density ? 1 / (samples.length * width || 1) : 1;
    return counts.map((c, i) => ({
      lo: lo + i * width,
      hi: lo + (i + 1) * width,
      count: c,
      value: c * scale,
    }));
  }

  const Stat = { mean, variance, covariance, correlation, histogram };

  // ---------- Chart2D ----------
  //
  // Plane2D (engine.js) locks x and y to a single scale, which is right for
  // geometry and wrong here: a density plot's axes carry different units. This
  // is the statistical-chart counterpart — independent x/y scales, an origin in
  // the bottom-left rather than the centre, and axis ticks with labels.

  const COLORS = {
    ink: '#222',
    muted: '#8a8a8a',
    grid: '#ececec',
    axis: '#bbb',
    blue: '#0645ad',
    orange: '#f97316',
    green: '#0f9d58',
    violet: '#7c3aed',
    red: '#d93025',
  };

  class Chart2D {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.xMin = opts.xMin ?? 0;
      this.xMax = opts.xMax ?? 1;
      this.yMin = opts.yMin ?? 0;
      this.yMax = opts.yMax ?? 1;
      // Room for tick labels on the left and below.
      this.padL = opts.padL ?? 44;
      this.padR = opts.padR ?? 14;
      this.padT = opts.padT ?? 16;
      this.padB = opts.padB ?? 30;
      this.fit();
    }

    fit() {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      // Before layout (display:none, etc.) the rect is empty; fall back to the
      // attribute size so a chart in a collapsed <details> still draws.
      this.w = rect.width || this.canvas.width;
      this.h = rect.height || this.canvas.height;
      this.canvas.width = this.w * dpr;
      this.canvas.height = this.h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.plotW = this.w - this.padL - this.padR;
      this.plotH = this.h - this.padT - this.padB;
      return this;
    }

    setY(yMin, yMax) { this.yMin = yMin; this.yMax = yMax; return this; }
    setX(xMin, xMax) { this.xMin = xMin; this.xMax = xMax; return this; }

    px(x) { return this.padL + ((x - this.xMin) / (this.xMax - this.xMin)) * this.plotW; }
    py(y) { return this.padT + this.plotH - ((y - this.yMin) / (this.yMax - this.yMin)) * this.plotH; }
    toPx(x, y) { return [this.px(x), this.py(y)]; }
    // Inverse of px/py, for pointer interaction.
    toX(px) { return this.xMin + ((px - this.padL) / this.plotW) * (this.xMax - this.xMin); }
    toY(py) { return this.yMin + ((this.padT + this.plotH - py) / this.plotH) * (this.yMax - this.yMin); }

    clear() { this.ctx.clearRect(0, 0, this.w, this.h); return this; }

    // Pointer position in data coordinates.
    eventXY(e) {
      const r = this.canvas.getBoundingClientRect();
      return [this.toX(e.clientX - r.left), this.toY(e.clientY - r.top)];
    }

    axes(opts = {}) {
      const ctx = this.ctx;
      const xTicks = opts.xTicks ?? this._ticks(this.xMin, this.xMax);
      const yTicks = opts.yTicks ?? this._ticks(this.yMin, this.yMax);
      const xFmt = opts.xFormat ?? ((v) => String(Math.round(v * 100) / 100));
      const yFmt = opts.yFormat ?? ((v) => String(Math.round(v * 100) / 100));
      ctx.save();
      if (opts.grid !== false) {
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        for (const t of xTicks) {
          ctx.beginPath();
          ctx.moveTo(this.px(t), this.py(this.yMin));
          ctx.lineTo(this.px(t), this.py(this.yMax));
          ctx.stroke();
        }
        for (const t of yTicks) {
          ctx.beginPath();
          ctx.moveTo(this.px(this.xMin), this.py(t));
          ctx.lineTo(this.px(this.xMax), this.py(t));
          ctx.stroke();
        }
      }
      ctx.strokeStyle = COLORS.axis;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      const baseY = this.py(Math.max(this.yMin, Math.min(0, this.yMax)));
      ctx.moveTo(this.px(this.xMin), baseY);
      ctx.lineTo(this.px(this.xMax), baseY);
      ctx.moveTo(this.px(this.xMin), this.py(this.yMin));
      ctx.lineTo(this.px(this.xMin), this.py(this.yMax));
      ctx.stroke();

      ctx.fillStyle = COLORS.muted;
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (const t of xTicks) ctx.fillText(xFmt(t), this.px(t), this.py(this.yMin) + 6);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      if (opts.yTickLabels !== false) {
        for (const t of yTicks) ctx.fillText(yFmt(t), this.padL - 6, this.py(t));
      }
      if (opts.xLabel) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(opts.xLabel, this.w - this.padR, this.h - 2);
      }
      if (opts.yLabel) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(opts.yLabel, 2, 2);
      }
      ctx.restore();
      return this;
    }

    // "Nice" tick positions: 1/2/5 x 10^k, aiming for ~6 ticks.
    _ticks(lo, hi, target = 6) {
      const span = hi - lo;
      if (!(span > 0)) return [lo];
      const raw = span / target;
      const mag = Math.pow(10, Math.floor(Math.log10(raw)));
      const norm = raw / mag;
      const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
      const out = [];
      for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) {
        out.push(Math.abs(t) < step / 1e6 ? 0 : t);
      }
      return out;
    }

    // fn may be a function of x or an array of [x, y] points.
    curve(fn, opts = {}) {
      const ctx = this.ctx;
      const n = opts.samples ?? 240;
      const pts = typeof fn === 'function'
        ? Array.from({ length: n + 1 }, (_, i) => {
          const x = this.xMin + (i / n) * (this.xMax - this.xMin);
          return [x, fn(x)];
        })
        : fn;
      ctx.save();
      if (opts.fill) {
        ctx.beginPath();
        ctx.moveTo(this.px(pts[0][0]), this.py(Math.max(this.yMin, 0)));
        for (const [x, y] of pts) ctx.lineTo(this.px(x), this.py(y));
        ctx.lineTo(this.px(pts[pts.length - 1][0]), this.py(Math.max(this.yMin, 0)));
        ctx.closePath();
        ctx.fillStyle = opts.fill;
        ctx.fill();
      }
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(this.px(x), this.py(y)) : ctx.moveTo(this.px(x), this.py(y))));
      ctx.strokeStyle = opts.color || COLORS.blue;
      ctx.lineWidth = opts.width ?? 2;
      if (opts.dash) ctx.setLineDash(opts.dash);
      ctx.stroke();
      ctx.restore();
      return this;
    }

    // Shades the region under fn between a and b — "probability is area".
    area(fn, a, b, opts = {}) {
      const ctx = this.ctx;
      const n = opts.samples ?? 160;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.px(a), this.py(Math.max(this.yMin, 0)));
      for (let i = 0; i <= n; i++) {
        const x = a + (i / n) * (b - a);
        ctx.lineTo(this.px(x), this.py(fn(x)));
      }
      ctx.lineTo(this.px(b), this.py(Math.max(this.yMin, 0)));
      ctx.closePath();
      ctx.fillStyle = opts.color || 'rgba(249,115,22,.28)';
      ctx.fill();
      ctx.restore();
      return this;
    }

    // items: [{ lo, hi, value }] — histogram bins or binned probability mass.
    bars(items, opts = {}) {
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = opts.color || 'rgba(6,69,173,.22)';
      ctx.strokeStyle = opts.stroke || 'rgba(6,69,173,.55)';
      ctx.lineWidth = 1;
      const gap = opts.gap ?? 1;
      const base = this.py(Math.max(this.yMin, 0));
      for (const it of items) {
        if (!(it.value > 0)) continue;
        const x0 = this.px(it.lo) + gap / 2;
        const x1 = this.px(it.hi) - gap / 2;
        const y = this.py(it.value);
        if (x1 <= x0) continue;
        ctx.fillRect(x0, y, x1 - x0, base - y);
        if (opts.stroke !== false) ctx.strokeRect(x0, y, x1 - x0, base - y);
      }
      ctx.restore();
      return this;
    }

    // A PMF: one stem with a dot per support point.
    stems(points, opts = {}) {
      const ctx = this.ctx;
      const base = this.py(Math.max(this.yMin, 0));
      ctx.save();
      ctx.strokeStyle = opts.color || COLORS.blue;
      ctx.fillStyle = opts.color || COLORS.blue;
      ctx.lineWidth = opts.width ?? 2.5;
      for (const [x, y] of points) {
        ctx.beginPath();
        ctx.moveTo(this.px(x), base);
        ctx.lineTo(this.px(x), this.py(y));
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.px(x), this.py(y), opts.r ?? 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return this;
    }

    points(pts, opts = {}) {
      const ctx = this.ctx;
      ctx.save();
      const r = opts.r ?? 2.5;
      pts.forEach(([x, y], i) => {
        ctx.beginPath();
        ctx.arc(this.px(x), this.py(y), r, 0, Math.PI * 2);
        ctx.fillStyle = typeof opts.color === 'function' ? opts.color(i) : (opts.color || 'rgba(6,69,173,.5)');
        ctx.fill();
        if (opts.stroke) {
          ctx.strokeStyle = opts.stroke;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
      ctx.restore();
      return this;
    }

    // Tick marks along the baseline — individual samples under a density.
    rug(samples, opts = {}) {
      const ctx = this.ctx;
      const base = this.py(Math.max(this.yMin, 0));
      const len = opts.len ?? 7;
      ctx.save();
      ctx.strokeStyle = opts.color || 'rgba(249,115,22,.6)';
      ctx.lineWidth = 1;
      for (const x of samples) {
        if (x < this.xMin || x > this.xMax) continue;
        ctx.beginPath();
        ctx.moveTo(this.px(x), base);
        ctx.lineTo(this.px(x), base - len);
        ctx.stroke();
      }
      ctx.restore();
      return this;
    }

    vline(x, opts = {}) { return this._rule(this.px(x), true, opts); }
    hline(y, opts = {}) { return this._rule(this.py(y), false, opts); }

    _rule(pos, vertical, opts) {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = opts.color || COLORS.orange;
      ctx.lineWidth = opts.width ?? 1.5;
      ctx.setLineDash(opts.dash ?? [4, 3]);
      ctx.beginPath();
      if (vertical) {
        ctx.moveTo(pos, this.py(this.yMin));
        ctx.lineTo(pos, this.py(this.yMax));
      } else {
        ctx.moveTo(this.px(this.xMin), pos);
        ctx.lineTo(this.px(this.xMax), pos);
      }
      ctx.stroke();
      if (opts.label) {
        ctx.setLineDash([]);
        ctx.fillStyle = opts.color || COLORS.orange;
        ctx.font = '11px system-ui, -apple-system, sans-serif';
        ctx.textBaseline = vertical ? 'top' : 'bottom';
        if (vertical) {
          // Flip the label to the left of the rule when it would run off the
          // right edge, rather than letting the canvas clip it.
          const w = ctx.measureText(opts.label).width;
          const flip = pos + 4 + w > this.w - this.padR;
          ctx.textAlign = flip ? 'right' : 'left';
          ctx.fillText(opts.label, pos + (flip ? -4 : 4), this.py(this.yMax) + 2);
        } else {
          ctx.textAlign = 'right';
          ctx.fillText(opts.label, this.px(this.xMax), pos - 3);
        }
      }
      ctx.restore();
      return this;
    }

    label(x, y, str, opts = {}) {
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = opts.color || COLORS.ink;
      ctx.font = opts.font || '12px system-ui, -apple-system, sans-serif';
      ctx.textAlign = opts.align || 'left';
      ctx.textBaseline = opts.baseline || 'bottom';
      ctx.fillText(str, this.px(x) + (opts.dx ?? 0), this.py(y) + (opts.dy ?? 0));
      ctx.restore();
      return this;
    }
  }

  // ---------- Heatmap ----------
  //
  // The joint / marginal / conditional / independence sections all read the same
  // grid differently, so they share one DOM-backed heatmap: cells are real
  // elements (keyboard-reachable, screen-reader friendly) rather than canvas
  // pixels. Values are kept normalized so the grid is always a distribution.

  class Heatmap {
    constructor(container, opts = {}) {
      this.el = typeof container === 'string' ? document.getElementById(container) : container;
      this.rows = opts.rows ?? 5;
      this.cols = opts.cols ?? 5;
      this.editable = opts.editable ?? false;
      this.onChange = opts.onChange || (() => {});
      this.xName = opts.xName ?? 'X';
      this.yName = opts.yName ?? 'Y';
      this.p = opts.values ? opts.values.map((r) => r.slice()) : this.uniform();
      this.normalize();
      this.cells = [];
      this.selectedCol = null;
      this.dimmed = false;
      if (this.el) this._build();
    }

    uniform() {
      const v = 1 / (this.rows * this.cols);
      return Array.from({ length: this.rows }, () => new Array(this.cols).fill(v));
    }

    normalize() {
      const s = this.p.flat().reduce((a, b) => a + b, 0) || 1;
      this.p = this.p.map((r) => r.map((v) => Math.max(0, v) / s));
      return this;
    }

    set(values) { this.p = values.map((r) => r.slice()); this.normalize(); this.render(); return this; }

    marginalX() { // P(X = j), summing over rows
      return Array.from({ length: this.cols }, (_, j) =>
        this.p.reduce((s, row) => s + row[j], 0));
    }

    marginalY() { // P(Y = i), summing over columns
      return this.p.map((row) => row.reduce((a, b) => a + b, 0));
    }

    conditionalYgivenX(j) {
      const denom = this.marginalX()[j] || 1;
      return this.p.map((row) => row[j] / denom);
    }

    // The product of the marginals — what the joint would be under independence.
    productOfMarginals() {
      const mx = this.marginalX(), my = this.marginalY();
      return my.map((py) => mx.map((px) => px * py));
    }

    _build() {
      this.el.textContent = '';
      this.el.style.setProperty('--cols', this.cols);
      this.el.setAttribute('role', 'group');
      this.el.setAttribute('aria-label', document.documentElement.lang === 'en'
        ? `${this.yName} × ${this.xName} joint probability grid`
        : `${this.yName} × ${this.xName} 결합확률 격자`);
      this.cells = [];
      for (let i = 0; i < this.rows; i++) {
        const axis = document.createElement('div');
        axis.className = 'heatmap-axis';
        axis.textContent = `${this.yName}=${this.rows - 1 - i}`;
        this.el.appendChild(axis);
        const rowCells = [];
        for (let j = 0; j < this.cols; j++) {
          const cell = document.createElement('div');
          cell.className = 'heatmap-cell';
          if (this.editable) {
            cell.tabIndex = 0;
            cell.setAttribute('role', 'spinbutton');
            this._wireCell(cell, i, j);
          }
          this.el.appendChild(cell);
          rowCells.push(cell);
        }
        this.cells.push(rowCells);
      }
      // Bottom axis row.
      const corner = document.createElement('div');
      corner.className = 'heatmap-axis';
      this.el.appendChild(corner);
      for (let j = 0; j < this.cols; j++) {
        const axis = document.createElement('div');
        axis.className = 'heatmap-axis';
        axis.textContent = `${this.xName}=${j}`;
        this.el.appendChild(axis);
      }
      this.render();
    }

    // Row i of `cells` is display order (top row = highest Y), so translate.
    _dataRow(i) { return this.rows - 1 - i; }

    _wireCell(cell, i, j) {
      const r = this._dataRow(i);
      const bump = (delta) => {
        this.p[r][j] = Math.max(0, this.p[r][j] + delta);
        this.normalize();
        this.render();
        this.onChange(this);
      };
      let dragging = false;
      let lastY = 0;
      cell.addEventListener('pointerdown', (e) => {
        dragging = true;
        lastY = e.clientY;
        cell.setPointerCapture(e.pointerId);
      });
      cell.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        bump((lastY - e.clientY) * 0.002);
        lastY = e.clientY;
      });
      ['pointerup', 'pointercancel'].forEach((ev) =>
        cell.addEventListener(ev, () => { dragging = false; }));
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') { bump(0.01); e.preventDefault(); }
        if (e.key === 'ArrowDown') { bump(-0.01); e.preventDefault(); }
      });
    }

    // Sequential blue ramp; `max` fixes the scale so animations don't rescale.
    color(v, max) {
      const t = max > 0 ? Math.min(1, v / max) : 0;
      return `rgba(6,69,173,${0.06 + 0.82 * t})`;
    }

    render() {
      if (!this.cells.length) return this;
      const max = Math.max(...this.p.flat(), 1e-9);
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          const v = this.p[this._dataRow(i)][j];
          const cell = this.cells[i][j];
          cell.style.background = this.color(v, max);
          cell.style.color = v / max > 0.55 ? '#fff' : '#333';
          cell.textContent = v.toFixed(2).slice(1);
          cell.classList.toggle('selected', this.selectedCol === j);
          cell.classList.toggle('dimmed', this.dimmed && this.selectedCol !== null && this.selectedCol !== j);
          if (this.editable) {
            cell.setAttribute('aria-label',
              `P(${this.xName}=${j}, ${this.yName}=${this._dataRow(i)}) = ${v.toFixed(3)}`);
            cell.setAttribute('aria-valuenow', v.toFixed(3));
          }
        }
      }
      return this;
    }
  }

  window.RNG = RNG;
  window.Dist = Dist;
  window.Stat = Stat;
  window.Chart2D = Chart2D;
  window.Heatmap = Heatmap;
  window.PROB_COLORS = COLORS;
})();

