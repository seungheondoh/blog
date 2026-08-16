/*
 * Wires up the information-theory demos. Reuses the probability post's engine
 * (RNG, Dist, Stat, Chart2D, Heatmap) and js/engine.js.
 *
 * Everything in this file is measured in nats unless a demo explicitly says
 * otherwise — that is the convention the post's prose follows, and it keeps the
 * numbers consistent with the loss functions the reader already knows.
 */
(function () {
  const { Dist, Chart2D, Heatmap, PROB_COLORS: C } = window;
  const isEnglish = document.documentElement.lang === 'en';
  // Readout copy is generated at run time, so it cannot go through the build's
  // translation table the way the static markup does. `tr` picks the language.
  const tr = (en, ko) => (isEnglish ? en : ko);

  const resizers = [];
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => resizers.forEach((fn) => fn()), 120);
  });

  const fmt = (n, d = 3) => (Object.is(n, -0) ? 0 : n).toFixed(d);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const say = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  const dot = (color, text) => `<span style="color:${color}">■</span> ${text}`;

  /* ------------------------------------------------- information quantities */

  const EPS = 1e-12;
  const xlogx = (p) => (p > EPS ? p * Math.log(p) : 0);
  const entropy = (p) => -p.reduce((s, v) => s + xlogx(v), 0);
  const crossEntropy = (p, q) =>
    -p.reduce((s, v, i) => s + (v > EPS ? v * Math.log(Math.max(q[i], EPS)) : 0), 0);
  const kl = (p, q) => crossEntropy(p, q) - entropy(p);
  const jsd = (p, q) => {
    const m = p.map((v, i) => 0.5 * (v + q[i]));
    return 0.5 * kl(p, m) + 0.5 * kl(q, m);
  };
  const normalize = (p) => {
    const s = p.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    return p.map((v) => Math.max(0, v) / s);
  };

  // Continuous divergences are evaluated on a fixed grid — fine for plotting,
  // and it keeps forward/reverse KL comparable because both use the same mesh.
  const GRID = (() => {
    const lo = -8, hi = 8, n = 800;
    const step = (hi - lo) / n;
    return { lo, hi, n, step, xs: Array.from({ length: n + 1 }, (_, i) => lo + i * step) };
  })();
  const discretize = (pdf) => {
    const raw = GRID.xs.map((x) => Math.max(0, pdf(x)) * GRID.step);
    return normalize(raw);
  };

  /* ---------------------------------------------------------- scaffolding */

  $$('canvas').forEach((canvas) => {
    const demo = canvas.closest('.topic-demo');
    const readout = demo && demo.querySelector('.readout');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', isEnglish
      ? 'Interactive information theory diagram'
      : '정보이론 개념을 조작하며 살펴보는 인터랙티브 도식');
    if (readout && readout.id) canvas.setAttribute('aria-describedby', readout.id);
  });
  $$('.readout').forEach((r) => {
    r.setAttribute('aria-live', 'polite');
    r.setAttribute('aria-atomic', 'true');
  });

  const indexLinks = $$('.la-index a');
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        indexLinks.forEach((link) => {
          const active = link.getAttribute('href') === `#${entry.target.id}`;
          link.classList.toggle('active', active);
          if (active) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -70% 0px' });
    indexLinks.map((l) => document.querySelector(l.getAttribute('href')))
      .filter(Boolean).forEach((s) => obs.observe(s));
  }

  function chart(id, opts, render) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    const ch = new Chart2D(canvas, opts);
    if (render) resizers.push(() => { ch.fit(); render(); });
    return ch;
  }

  const NO_SLIDER = { value: '0', _emit() {} };
  function slider(id, onInput, format = (v) => fmt(v, 2)) {
    const input = document.getElementById(id);
    const label = document.getElementById(`${id}-val`);
    if (!input) return NO_SLIDER;
    const emit = () => {
      const v = parseFloat(input.value);
      if (label) label.textContent = format(v);
      onInput(v);
    };
    input.addEventListener('input', emit);
    input._emit = emit;
    return input;
  }

  function presetGroup(containerId, onPick) {
    const box = document.getElementById(containerId);
    if (!box) return;
    const buttons = $$('button', box);
    buttons.forEach((btn) => btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.toggle('active', b === btn));
      onPick(btn.dataset, btn);
    }));
  }

  function toggle(id, onToggle) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      onToggle(btn.classList.contains('active'));
    });
  }

  /* ----------------------------------------------------------- BarRack ---- */

  // A row of drag-to-resize probability bars. Three sections reshape a discrete
  // distribution by hand, so the control is shared rather than reimplemented.
  class BarRack {
    constructor(id, opts = {}) {
      this.el = document.getElementById(id);
      this.labels = opts.labels ?? ['A', 'B', 'C', 'D', 'E'];
      this.p = normalize(opts.values ?? this.labels.map(() => 1 / this.labels.length));
      this.onChange = opts.onChange || (() => {});
      this.reference = opts.reference || null; // optional ghost bars behind
      if (this.el) this._build();
    }

    set(values) { this.p = normalize(values); this.render(); return this; }

    _build() {
      this.el.classList.add('bar-rack');
      this.el.style.gridTemplateColumns = `repeat(${this.labels.length}, 1fr)`;
      this.el.textContent = '';
      this.cols = this.labels.map((name, i) => {
        const col = document.createElement('div');
        col.className = 'bar-col';
        col.tabIndex = 0;
        col.setAttribute('role', 'spinbutton');
        const fill = document.createElement('div');
        fill.className = 'bar-fill';
        const label = document.createElement('div');
        label.className = 'bar-label';
        col.append(fill, label);
        this.el.appendChild(col);
        this._wire(col, i);
        return { col, fill, label };
      });
      this.render();
    }

    _wire(col, i) {
      const bump = (d) => {
        this.p[i] = clamp(this.p[i] + d, 0, 1);
        this.p = normalize(this.p);
        this.render();
        this.onChange(this);
      };
      let dragging = false, lastY = 0;
      col.addEventListener('pointerdown', (e) => {
        dragging = true; lastY = e.clientY; col.setPointerCapture(e.pointerId);
      });
      col.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        bump((lastY - e.clientY) * 0.004);
        lastY = e.clientY;
      });
      ['pointerup', 'pointercancel'].forEach((ev) =>
        col.addEventListener(ev, () => { dragging = false; }));
      col.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') { bump(0.02); e.preventDefault(); }
        if (e.key === 'ArrowDown') { bump(-0.02); e.preventDefault(); }
      });
    }

    render() {
      if (!this.cols) return this;
      const max = Math.max(...this.p, 0.05);
      this.cols.forEach(({ fill, label, col }, i) => {
        fill.style.height = `${(this.p[i] / max) * 100}%`;
        label.textContent = `${this.labels[i]} ${this.p[i].toFixed(2)}`;
        col.setAttribute('aria-label', `P(${this.labels[i]}) = ${this.p[i].toFixed(3)}`);
        col.setAttribute('aria-valuenow', this.p[i].toFixed(3));
      });
      return this;
    }
  }

  /* -------------------------------------------------- 1. self-information */

  (function surprise() {
    let p = 0.5;
    let bits = false;
    const ch = chart('c-surprise', { xMin: 0, xMax: 1, yMin: 0, yMax: 6 }, render);
    if (!ch) return;

    function render() {
      const base = bits ? Math.LN2 : 1;
      const unit = bits ? 'bit' : 'nat';
      const I = (v) => -Math.log(Math.max(v, 1e-9)) / base;
      ch.fit().clear();
      ch.setY(0, bits ? 8 : 5.5);
      ch.axes({ xLabel: tr('p (probability of the event)', 'p (사건의 확률)'), yLabel: `I(x) = −log p  [${unit}]` });
      ch.curve((v) => Math.min(I(v), ch.yMax), { color: C.blue, width: 2.2, samples: 600 });
      ch.vline(p, { color: C.orange, label: `p = ${fmt(p, 3)}` });
      ch.points([[p, Math.min(I(p), ch.yMax)]], { color: C.orange, r: 5 });
      say('r-surprise',
        `p = ${fmt(p, 3)} &nbsp;·&nbsp; I = −log p = <strong>${fmt(I(p))} ${unit}</strong> &nbsp;·&nbsp; ` +
        (p > 0.99 ? tr('A near-certain event — its occurrence tells us almost nothing.',
            '거의 확실한 사건 — 일어나도 알려주는 것이 거의 없다.')
          : p < 0.02 ? tr('A very rare event — the mere fact that it happened is a lot of information.',
            '아주 드문 사건 — 일어났다는 사실 자체가 큰 정보다.')
          : tr(`Recording the news that this event occurred takes ${fmt(-Math.log2(p), 2)} bits.`,
            `이 사건이 일어났다는 소식을 적으려면 ${fmt(-Math.log2(p), 2)}비트가 필요하다.`)));
    }
    slider('surp-p', (v) => { p = v; render(); }, (v) => fmt(v, 2))._emit();
    toggle('surp-unit', (on) => { bits = on; render(); });
  })();

  /* --------------------------------------------------------- 2. entropy */

  (function entropyDemo() {
    const LABELS = ['A', 'B', 'C', 'D', 'E'];
    const PRESETS = {
      uniform: [0.2, 0.2, 0.2, 0.2, 0.2],
      peaked: [0.86, 0.06, 0.04, 0.03, 0.01],
      mid: [0.4, 0.25, 0.18, 0.12, 0.05],
    };
    const rack = new BarRack('entropy-bars', { labels: LABELS, values: PRESETS.uniform, onChange: render });
    const chBar = chart('c-entropy', { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, render);
    const chBin = chart('c-entropy-binary', { xMin: 0, xMax: 1, yMin: 0, yMax: 0.75 }, render);
    if (!rack.el) return;

    function render() {
      const p = rack.p;
      const H = entropy(p);
      const Hmax = Math.log(p.length);

      if (chBar) {
        // A meter for H against its ceiling — the number alone is hard to place.
        chBar.fit().clear();
        chBar.setX(0, Hmax * 1.08).setY(0, 1);
        chBar.axes({ yTickLabels: false, yTicks: [], xLabel: 'H (nat)' });
        chBar.bars([{ lo: 0, hi: H, value: 0.62 }], { color: 'rgba(6,69,173,.40)', stroke: 'rgba(6,69,173,.7)' });
        chBar.vline(Hmax, { color: C.orange, label: tr(`max log 5 = ${fmt(Hmax)}`, `최대 log 5 = ${fmt(Hmax)}`) });
        chBar.label(H / 2, 0.62, `H = ${fmt(H)}`, { align: 'center', dy: -8, color: '#123' });
      }
      if (chBin) {
        chBin.fit().clear();
        chBin.axes({ xLabel: 'p', yLabel: 'H(p) [nat]' });
        chBin.curve((x) => -(xlogx(x) + xlogx(1 - x)), { color: C.violet, width: 2.2, fill: 'rgba(124,58,237,.10)' });
        chBin.hline(Math.LN2, { color: C.muted, dash: [3, 3], label: 'log 2' });
        // Mark where this distribution's largest outcome sits on the binary curve.
        const top = Math.max(...p);
        chBin.points([[top, -(xlogx(top) + xlogx(1 - top))]], { color: C.orange, r: 4.5 });
      }
      say('r-entropy',
        tr(`H(p) = ${fmt(H)} nat = ${fmt(H / Math.LN2)} bit &nbsp;·&nbsp; maximum log 5 = ${fmt(Hmax)} &nbsp;·&nbsp; `,
          `H(p) = ${fmt(H)} nat = ${fmt(H / Math.LN2)} bit &nbsp;·&nbsp; 최댓값 log 5 = ${fmt(Hmax)} &nbsp;·&nbsp; `) +
        tr(`${(H / Hmax * 100).toFixed(1)}% of the maximum<br>`, `최댓값 대비 ${(H / Hmax * 100).toFixed(1)}%<br>`) +
        (H > Hmax - 0.01 ? tr('<strong>Uniform — entropy is at its maximum.</strong> This is the hardest state to predict.',
            '<strong>균등분포 — 엔트로피가 최대입니다.</strong> 가장 예측하기 어려운 상태입니다.')
          : H < 0.35 ? tr('<strong>Nearly deterministic</strong> — as good as knowing the outcome in advance, so there is nothing to be surprised by.',
            '<strong>거의 확정적</strong> — 결과를 미리 아는 것이나 마찬가지라 놀랄 일이 없습니다.')
          : tr('The more the bars pile to one side the smaller H becomes; the more evenly they spread the larger it grows.',
            '막대를 한쪽으로 몰수록 H가 줄고, 고르게 펼수록 H가 늘어납니다.')));
    }
    presetGroup('entropy-presets', ({ preset }) => rack.set(PRESETS[preset].slice()) && render());
    render();
  })();

  /* ---------------------------------------------------------- 3. coding */

  (function coding() {
    const LABELS = ['A', 'B', 'C', 'D', 'E'];
    const rack = new BarRack('coding-bars', {
      labels: LABELS, values: [0.5, 0.25, 0.125, 0.0625, 0.0625], onChange: render,
    });
    const strip = document.getElementById('coding-lengths');
    if (!rack.el || !strip) return;

    function render() {
      const p = rack.p;
      strip.textContent = '';
      p.forEach((v, i) => {
        const cell = document.createElement('div');
        cell.className = 'code-cell';
        const bits = -Math.log2(Math.max(v, EPS));
        cell.innerHTML = `${LABELS[i]}<b>${bits.toFixed(2)} bit</b>p=${v.toFixed(3)}`;
        strip.appendChild(cell);
      });
      const avgBits = p.reduce((s, v) => s + (v > EPS ? v * -Math.log2(v) : 0), 0);
      const H = entropy(p);
      say('r-coding',
        tr(`average code length = ${fmt(avgBits)} bit/symbol &nbsp;·&nbsp; entropy H(p) = ${fmt(H / Math.LN2)} bit `,
          `평균 부호 길이 = ${fmt(avgBits)} bit/심볼 &nbsp;·&nbsp; 엔트로피 H(p) = ${fmt(H / Math.LN2)} bit `) +
        tr(`&nbsp;·&nbsp; difference = ${fmt(Math.abs(avgBits - H / Math.LN2), 6)}<br>`,
          `&nbsp;·&nbsp; 차이 = ${fmt(Math.abs(avgBits - H / Math.LN2), 6)}<br>`) +
        tr(`<strong>The two are equal by definition</strong> — entropy is not a metaphor but literally the number of bits needed per symbol. `,
          `<strong>둘은 정의상 같은 값입니다</strong> — 엔트로피는 비유가 아니라 실제로 심볼당 필요한 비트 수입니다. `) +
        tr(`The more frequent the symbol, the shorter the code it receives.`,
          `자주 나오는 심볼일수록 짧은 부호를 받습니다.`));
    }
    render();
  })();

  /* --------------------------------------------------- 4. cross-entropy */

  (function crossEntropyDemo() {
    const LABELS = ['A', 'B', 'C', 'D', 'E'];
    const P = [0.45, 0.25, 0.15, 0.10, 0.05];
    const PRESETS = {
      match: P.slice(),
      uniform: [0.2, 0.2, 0.2, 0.2, 0.2],
      wrong: [0.05, 0.10, 0.15, 0.25, 0.45],
    };
    let q = PRESETS.uniform.slice();
    const ch = chart('c-crossentropy', { xMin: -0.6, xMax: 4.6, yMin: 0, yMax: 0.6 }, render);
    if (!ch) return;

    function render() {
      ch.fit().clear();
      ch.setY(0, 0.6);
      ch.axes({
        xTicks: LABELS.map((_, i) => i),
        xFormat: (v) => LABELS[Math.round(v)] ?? '',
        xLabel: 'symbol', yLabel: 'probability',
      });
      ch.bars(P.map((v, i) => ({ lo: i - 0.38, hi: i + 0.02, value: v })),
        { color: 'rgba(140,140,140,.45)', stroke: 'rgba(120,120,120,.7)' });
      ch.bars(q.map((v, i) => ({ lo: i - 0.02, hi: i + 0.38, value: v })),
        { color: 'rgba(249,115,22,.45)', stroke: 'rgba(249,115,22,.8)' });
      ch.label(-0.4, 0.57, tr('grey = p (true)   orange = q (model)', '회색 = p (참분포)   주황 = q (모델)'), { font: '11px system-ui', color: C.muted });

      const H = entropy(P);
      const CE = crossEntropy(P, q);
      const D = CE - H;
      say('r-crossentropy',
        `${dot('#8c8c8c', `H(p) = ${fmt(H)}`)} &nbsp;·&nbsp; ${dot(C.orange, `H(p,q) = ${fmt(CE)}`)} &nbsp;·&nbsp; ` +
        tr(`excess = ${fmt(D)} nat<br>`, `초과분 = ${fmt(D)} nat<br>`) +
        (D < 1e-6
          ? tr('<strong>q = p — the cross-entropy now equals the entropy.</strong> This is the attainable minimum and it cannot go lower.',
            '<strong>q = p — 크로스엔트로피가 엔트로피와 같아졌습니다.</strong> 이것이 도달 가능한 최솟값이며, 더 내려갈 수 없습니다.')
          : tr(`You are paying <strong>an extra ${fmt(D)} nat</strong> for q differing from p. That excess is the KL divergence of the next section.`,
            `q가 p와 다른 만큼 <strong>${fmt(D)} nat을 추가로</strong> 지불하고 있습니다. 이 초과분이 다음 절의 KL divergence입니다.`)));
    }
    presetGroup('ce-presets', ({ preset }) => { q = PRESETS[preset].slice(); render(); });
    render();
  })();

  /* ------------------------------------------------------------- 5. KL */

  (function klDemo() {
    let shift = 0, width = 1, swapped = false;
    const ch = chart('c-kl', { xMin: -6, xMax: 6, yMin: 0, yMax: 0.65 }, render);
    if (!ch) return;

    function render() {
      const pd = Dist.gaussian(0, 1);
      const qd = Dist.gaussian(shift, width);
      ch.fit().clear();
      ch.setY(0, Math.max(0.55, qd.pdf(shift) * 1.15));
      ch.axes({ xLabel: 'x', yLabel: 'density' });
      ch.curve((x) => pd.pdf(x), { color: '#8c8c8c', width: 2, fill: 'rgba(140,140,140,.10)' });
      ch.curve((x) => qd.pdf(x), { color: C.orange, width: 2, fill: 'rgba(249,115,22,.10)' });

      const p = discretize((x) => pd.pdf(x));
      const q = discretize((x) => qd.pdf(x));
      const [a, b, an, bn] = swapped ? [q, p, 'q', 'p'] : [p, q, 'p', 'q'];
      const H = entropy(a);
      const CE = crossEntropy(a, b);
      const D = CE - H;
      say('r-kl',
        `${dot('#8c8c8c', 'p = N(0,1)')} &nbsp; ${dot(C.orange, `q = N(${fmt(shift, 2)}, ${fmt(width, 2)}²)`)}<br>` +
        `H(${an}) = ${fmt(H)} &nbsp;·&nbsp; H(${an},${bn}) = ${fmt(CE)} &nbsp;·&nbsp; ` +
        `<strong>D<sub>KL</sub>(${an}‖${bn}) = ${fmt(D)}</strong> &nbsp;·&nbsp; ` +
        tr(`Always H(${an},${bn}) = H(${an}) + KL, and KL ≥ 0. `,
          `언제나 H(${an},${bn}) = H(${an}) + KL 이고 KL ≥ 0 입니다. `) +
        (Math.abs(shift) < 0.05 && Math.abs(width - 1) < 0.05
          ? tr('<strong>Right now p = q, so KL is 0.</strong>', '<strong>지금 p = q라 KL이 0입니다.</strong>')
          : tr('Press "Swap direction" to see the value change for the same two distributions.',
            '"방향 바꾸기"를 눌러 같은 두 분포에서 값이 달라지는 것을 확인해보세요.')));
    }
    slider('kl-shift', (v) => { shift = v; render(); })._emit();
    slider('kl-width', (v) => { width = v; render(); })._emit();
    toggle('kl-swap', (on) => { swapped = on; render(); });
  })();

  /* --------------------------------------- KL Monte Carlo approximation */

  (function klApproximationDemo() {
    let shift = 1;
    let sampleCount = 64;
    let seed = 20260730;
    let samples = [];

    const distChart = chart('c-klapprox-dist',
      { xMin: -5, xMax: 7, yMin: 0, yMax: 0.46 }, render);
    const estChart = chart('c-klapprox-est',
      { xMin: -0.6, xMax: 2.6, yMin: -0.5, yMax: 2 }, render);
    if (!distChart || !estChart) return;

    // A tiny deterministic generator keeps redraws stable. Moving a slider
    // changes the distributions, while "Resample" alone changes the sample.
    const uniform = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return (seed + 0.5) / 4294967296;
    };
    const gaussian = () => {
      const u1 = Math.max(uniform(), 1e-12);
      const u2 = uniform();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    };
    const drawSamples = () => {
      samples = Array.from({ length: sampleCount }, gaussian); // x ~ q = N(0,1)
    };
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    const standardError = (xs) => {
      if (xs.length < 2) return 0;
      const m = mean(xs);
      const variance = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
      return Math.sqrt(variance / xs.length);
    };

    function values() {
      const rows = samples.map((x) => {
        // q=N(0,1), p=N(shift,1): log(p/q) = shift*x - shift^2/2.
        const logR = shift * x - 0.5 * shift * shift;
        // Avoid overflow only at a range far outside this demo's controls.
        const r = Math.exp(clamp(logR, -700, 700));
        return [-logR, 0.5 * logR * logR, (r - 1) - logR];
      });
      return [0, 1, 2].map((j) => rows.map((row) => row[j]));
    }

    function render() {
      if (samples.length !== sampleCount) drawSamples();
      const q = Dist.gaussian(0, 1);
      const p = Dist.gaussian(shift, 1);
      const trueKL = 0.5 * shift * shift;
      const ks = values();
      const estimates = ks.map(mean);
      const ses = ks.map(standardError);

      distChart.fit().clear();
      distChart.setX(-5, Math.max(5, shift + 4)).setY(0, 0.46);
      distChart.axes({ xLabel: 'x', yLabel: 'density' });
      distChart.curve((x) => q.pdf(x),
        { color: '#8c8c8c', width: 2, fill: 'rgba(140,140,140,.10)' });
      distChart.curve((x) => p.pdf(x),
        { color: C.orange, width: 2, fill: 'rgba(249,115,22,.10)' });
      const rug = samples.slice(0, Math.min(samples.length, 160)).map((x) => [x, 0.012]);
      distChart.points(rug, { color: 'rgba(6,69,173,.45)', r: 2 });
      distChart.label(-4.7, 0.43, tr('samples drawn from grey q=N(0,1) · orange p=N(δ,1)', '회색 q=N(0,1)에서 표본 추출 · 주황 p=N(δ,1)'),
        { font: '11px system-ui', color: C.muted });

      const all = [trueKL, ...estimates, ...estimates.map((v, i) => v + 2 * ses[i])];
      const lo = Math.min(-0.08, ...estimates.map((v, i) => v - 2 * ses[i]));
      const hi = Math.max(0.3, ...all) * 1.25 + 0.05;
      estChart.fit().clear();
      estChart.setX(-0.6, 2.6).setY(lo, hi);
      estChart.axes({
        xTicks: [0, 1, 2],
        xFormat: (v) => ['k₁', 'k₂', 'k₃'][Math.round(v)] ?? '',
        xLabel: 'estimator', yLabel: 'estimated KL (nat)',
      });
      estChart.hline(trueKL, { color: C.orange, dash: [5, 3], label: tr(`true KL = ${fmt(trueKL)}`, `참 KL = ${fmt(trueKL)}`) });
      const colors = [C.blue, C.violet, C.green];
      estimates.forEach((v, i) => {
        estChart.vline(i, { color: 'rgba(120,120,120,.18)', width: 1 });
        estChart.points([[i, v]], { color: colors[i], r: 6 });
        // Draw ±2 standard errors as a dense vertical stack of points so the
        // interval remains compatible with the shared Chart2D primitive set.
        const band = Array.from({ length: 21 }, (_, j) => [i, v - 2 * ses[i] + (4 * ses[i] * j / 20)]);
        estChart.points(band, { color: colors[i], r: 1.3 });
        estChart.label(i, Math.min(hi * 0.96, v + 2 * ses[i]), fmt(v),
          { align: 'center', dy: -7, font: '11px system-ui', color: colors[i] });
      });

      const negativeK1 = ks[0].filter((v) => v < 0).length;
      say('r-klapprox',
        tr(`true D<sub>KL</sub>(q‖p) = <strong>${fmt(trueKL)}</strong> nat &nbsp;·&nbsp; N = ${sampleCount}<br>`,
          `참 D<sub>KL</sub>(q‖p) = <strong>${fmt(trueKL)}</strong> nat &nbsp;·&nbsp; N = ${sampleCount}<br>`) +
        `${dot(C.blue, tr(`k₁ mean ${fmt(estimates[0])} ± ${fmt(ses[0])}`, `k₁ 평균 ${fmt(estimates[0])} ± ${fmt(ses[0])}`))} &nbsp;·&nbsp; ` +
        `${dot(C.violet, tr(`k₂ mean ${fmt(estimates[1])} ± ${fmt(ses[1])}`, `k₂ 평균 ${fmt(estimates[1])} ± ${fmt(ses[1])}`))} &nbsp;·&nbsp; ` +
        `${dot(C.green, tr(`k₃ mean ${fmt(estimates[2])} ± ${fmt(ses[2])}`, `k₃ 평균 ${fmt(estimates[2])} ± ${fmt(ses[2])}`))}<br>` +
        tr(`negative k₁ samples: <strong>${negativeK1}/${sampleCount}</strong> &nbsp;·&nbsp; `,
          `k₁의 음수 표본: <strong>${negativeK1}/${sampleCount}</strong> &nbsp;·&nbsp; `) +
        tr(`negative k₃ samples: <strong>0/${sampleCount}</strong>. `,
          `k₃의 음수 표본: <strong>0/${sampleCount}</strong>. `) +
        (shift < 0.1
          ? tr('p and q are nearly identical, so all three estimators and the true KL are close to 0.',
            'p와 q가 거의 같아 세 추정량과 참 KL이 모두 0에 가깝습니다.')
          : tr('Press "Resample" repeatedly. Even an unbiased estimator wobbles around the true value on a finite sample.',
            '“다시 뽑기”를 반복해보세요. 불편추정량도 유한한 표본에서는 참값 주변에서 흔들립니다.')));
    }

    slider('klapprox-shift', (v) => { shift = v; render(); })._emit();
    slider('klapprox-n', (v) => {
      sampleCount = Math.round(v);
      drawSamples();
      render();
    }, (v) => String(Math.round(v)))._emit();
    const resample = document.getElementById('klapprox-resample');
    if (resample) resample.addEventListener('click', () => {
      seed = (seed + 0x9e3779b9) >>> 0;
      drawSamples();
      render();
    });
  })();

  /* ------------------------------------------- 6. forward vs reverse KL */

  (function asymmetry() {
    // A two-mode target that a single Gaussian cannot represent — the whole point
    // is what the model gives up when it cannot fit everything.
    const target = Dist.mixture(
      [Dist.gaussian(-2.2, 0.6), Dist.gaussian(2.0, 0.8)],
      [0.5, 0.5],
    );
    const pGrid = discretize((x) => target.pdf(x));
    let mu = 0, sigma = 1, dir = 'forward';
    const ch = chart('c-asymmetry', { xMin: -7, xMax: 7, yMin: 0, yMax: 0.5 }, render);
    if (!ch) return;

    const divergence = (m, s) => {
      const q = discretize((x) => Dist.gaussian(m, s).pdf(x));
      return dir === 'forward' ? kl(pGrid, q) : kl(q, pGrid);
    };

    function render() {
      const qd = Dist.gaussian(mu, sigma);
      ch.fit().clear();
      ch.setY(0, 0.5);
      ch.axes({ xLabel: 'x', yLabel: 'density' });
      ch.curve((x) => target.pdf(x), { color: '#8c8c8c', width: 2, fill: 'rgba(140,140,140,.12)' });
      ch.curve((x) => qd.pdf(x), { color: C.orange, width: 2.2 });
      const D = divergence(mu, sigma);
      say('r-asymmetry',
        `${dot('#8c8c8c', tr('p (two peaks, fixed)', 'p (봉우리 2개, 고정)'))} &nbsp; ${dot(C.orange, `q = N(${fmt(mu, 2)}, ${fmt(sigma, 2)}²)`)} &nbsp;·&nbsp; ` +
        `<strong>${dir === 'forward' ? 'D(p‖q)' : 'D(q‖p)'} = ${fmt(D)}</strong><br>` +
        (dir === 'forward'
          ? tr('Forward KL tries to <strong>cover everywhere</strong> p has mass — the optimum becomes a broad distribution spanning both peaks.',
            'Forward KL은 p의 질량이 있는 곳을 <strong>빠짐없이 덮으려</strong> 합니다 — 최적해가 두 봉우리를 아우르는 넓은 분포가 됩니다.')
          : tr('Reverse KL tries to <strong>avoid</strong> where p is small — the optimum clings narrowly to one peak.',
            'Reverse KL은 p가 작은 곳을 <strong>피하려</strong> 합니다 — 최적해가 한쪽 봉우리에 좁게 달라붙습니다.')));
    }

    const slMu = slider('asym-mu', (v) => { mu = v; render(); });
    const slSig = slider('asym-sigma', (v) => { sigma = v; render(); });
    presetGroup('asym-dir', (d) => { dir = d.dir; render(); });

    const solve = document.getElementById('asym-solve');
    if (solve) solve.addEventListener('click', () => {
      // Coarse grid search then a local refine — the objective is cheap and this
      // avoids getting stuck in the wrong mode for the reverse direction.
      let best = { m: mu, s: sigma, d: Infinity };
      for (let m = -4; m <= 4; m += 0.1) {
        for (let s = 0.25; s <= 3.5; s += 0.05) {
          const d = divergence(m, s);
          if (d < best.d) best = { m, s, d };
        }
      }
      const t0 = performance.now();
      const m0 = mu, s0 = sigma;
      const step = (now) => {
        const k = clamp((now - t0) / 700, 0, 1);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        mu = m0 + (best.m - m0) * e;
        sigma = s0 + (best.s - s0) * e;
        slMu.value = String(mu); slMu._emit();
        slSig.value = String(sigma); slSig._emit();
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    slMu._emit(); slSig._emit();
  })();

  /* -------------------------------------------------------------- 7. JSD */

  (function jsdDemo() {
    let shift = 1.5;
    const ch = chart('c-jsd', { xMin: -6, xMax: 10, yMin: 0, yMax: 0.5 }, render);
    const chC = chart('c-jsd-curve', { xMin: 0, xMax: 8, yMin: 0, yMax: 4 }, render);
    if (!ch) return;

    const at = (d) => {
      const p = discretize((x) => Dist.gaussian(0, 1).pdf(x));
      const q = discretize((x) => Dist.gaussian(d, 1).pdf(x));
      return { kl: kl(p, q), js: jsd(p, q) };
    };

    function render() {
      const pd = Dist.gaussian(0, 1), qd = Dist.gaussian(shift, 1);
      ch.fit().clear();
      ch.setY(0, 0.5);
      ch.axes({ xLabel: 'x', yLabel: 'density' });
      ch.curve((x) => pd.pdf(x), { color: '#8c8c8c', width: 2, fill: 'rgba(140,140,140,.12)' });
      ch.curve((x) => qd.pdf(x), { color: C.orange, width: 2, fill: 'rgba(249,115,22,.12)' });
      ch.curve((x) => 0.5 * (pd.pdf(x) + qd.pdf(x)), { color: C.violet, width: 1.6, dash: [4, 3] });

      const now = at(shift);
      if (chC) {
        chC.fit().clear();
        chC.setY(0, 4);
        chC.axes({ xLabel: tr('separation of the two distributions', '두 분포의 거리'), yLabel: 'divergence (nat)' });
        const ds = Array.from({ length: 60 }, (_, i) => (i / 59) * 8);
        chC.curve(ds.map((d) => [d, Math.min(at(d).kl, 4)]), { color: C.blue, width: 2 });
        chC.curve(ds.map((d) => [d, at(d).js]), { color: C.green, width: 2.2 });
        chC.hline(Math.LN2, { color: C.muted, dash: [3, 3], label: tr('log 2 = 0.693 (JS upper bound)', 'log 2 = 0.693 (JS 상한)') });
        chC.vline(shift, { color: C.orange, width: 1.2 });
      }
      say('r-jsd',
        tr(`separation = ${fmt(shift, 2)} &nbsp;·&nbsp; `, `거리 = ${fmt(shift, 2)} &nbsp;·&nbsp; `) +
        `${dot(C.blue, `KL(p‖q) = ${fmt(now.kl)}`)} &nbsp;·&nbsp; ` +
        `${dot(C.green, `JS(p,q) = ${fmt(now.js)}`)} &nbsp;·&nbsp; ${dot(C.violet, 'm = ½(p+q)')}<br>` +
        (now.js > Math.LN2 - 0.005
          ? tr('<strong>JS has saturated at log 2.</strong> Moving further apart no longer changes the value, so the gradient is 0 — the point at which GAN training stalled.',
            '<strong>JS가 log 2에서 포화되었습니다.</strong> 여기서 더 멀어져도 값이 변하지 않으니 gradient가 0입니다 — GAN 학습이 멈추던 지점입니다.')
          : tr('KL grows quadratically with separation, while JS is pressed against log 2 and rises only gently.',
            'KL은 거리에 따라 제곱으로 커지지만 JS는 log 2에 눌려 완만하게 오릅니다.')));
    }
    slider('jsd-shift', (v) => { shift = v; render(); })._emit();
  })();

  /* --------------------------------------------- 8. mutual information */

  (function mutual() {
    const PRESETS = {
      diag: [
        [0.16, 0.03, 0.01, 0.00, 0.00],
        [0.03, 0.16, 0.03, 0.01, 0.00],
        [0.01, 0.03, 0.16, 0.03, 0.01],
        [0.00, 0.01, 0.03, 0.16, 0.03],
        [0.00, 0.00, 0.01, 0.03, 0.16],
      ],
      indep: (() => {
        const px = [0.30, 0.25, 0.20, 0.15, 0.10];
        const py = [0.10, 0.15, 0.25, 0.30, 0.20];
        return py.map((b) => px.map((a) => a * b));
      })(),
      // Y depends on X through |x-2|, so the relationship is real but has zero
      // linear correlation — the case a correlation coefficient cannot see.
      nonlinear: (() => {
        const m = Array.from({ length: 5 }, () => new Array(5).fill(0.002));
        for (let j = 0; j < 5; j++) m[Math.abs(j - 2)][j] = 0.2;
        return m;
      })(),
    };
    const clone = (m) => m.map((r) => r.slice());
    const hm = new Heatmap('mutual-heatmap', {
      rows: 5, cols: 5, editable: true, values: clone(PRESETS.diag), onChange: render,
    });
    const ch = chart('c-mutual', { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, render);
    if (!hm.el) return;

    function render() {
      const joint = hm.p.flat();
      const mx = hm.marginalX(), my = hm.marginalY();
      const prod = hm.productOfMarginals().flat();
      const I = kl(joint, prod);
      const Hx = entropy(mx), Hy = entropy(my), Hxy = entropy(joint);

      // Pearson correlation of the grid, to contrast with I.
      let exy = 0, ex = 0, ey = 0, ex2 = 0, ey2 = 0;
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
        const w = hm.p[i][j];
        exy += w * j * i; ex += w * j; ey += w * i; ex2 += w * j * j; ey2 += w * i * i;
      }
      const cov = exy - ex * ey;
      const rho = cov / (Math.sqrt((ex2 - ex * ex) * (ey2 - ey * ey)) || 1);

      if (ch) {
        // H(X) and H(Y) as overlapping bars whose intersection is I.
        ch.fit().clear();
        ch.setX(0, Math.max(Hx, Hy) * 2.2).setY(0, 1);
        ch.axes({ yTicks: [], yTickLabels: false, xLabel: 'nat' });
        ch.bars([{ lo: 0, hi: Hx, value: 0.75 }], { color: 'rgba(6,69,173,.30)', stroke: 'rgba(6,69,173,.6)' });
        ch.bars([{ lo: Hx - I, hi: Hx - I + Hy, value: 0.42 }], { color: 'rgba(249,115,22,.30)', stroke: 'rgba(249,115,22,.6)' });
        ch.bars([{ lo: Hx - I, hi: Hx, value: 0.20 }], { color: 'rgba(15,157,88,.55)', stroke: 'rgba(15,157,88,.9)' });
        ch.label(Hx / 2, 0.75, `H(X) = ${fmt(Hx, 2)}`, { align: 'center', dy: -6, font: '11px system-ui' });
        ch.label(Hx - I + Hy / 2, 0.42, `H(Y) = ${fmt(Hy, 2)}`, { align: 'center', dy: -6, font: '11px system-ui' });
        ch.label(Hx - I / 2, 0.20, `I = ${fmt(I, 2)}`, { align: 'center', dy: -6, font: '11px system-ui', color: '#0f9d58' });
      }
      say('r-mutual',
        `<strong>I(X;Y) = ${fmt(I)} nat</strong> &nbsp;·&nbsp; H(X) = ${fmt(Hx)} &nbsp;·&nbsp; H(Y) = ${fmt(Hy)} ` +
        tr(`&nbsp;·&nbsp; H(X,Y) = ${fmt(Hxy)} &nbsp;·&nbsp; check H(X)+H(Y)−H(X,Y) = ${fmt(Hx + Hy - Hxy)}<br>`,
          `&nbsp;·&nbsp; H(X,Y) = ${fmt(Hxy)} &nbsp;·&nbsp; 검산 H(X)+H(Y)−H(X,Y) = ${fmt(Hx + Hy - Hxy)}<br>`) +
        tr(`correlation ρ = ${fmt(rho, 3)} &nbsp;·&nbsp; `, `상관계수 ρ = ${fmt(rho, 3)} &nbsp;·&nbsp; `) +
        (I < 1e-6
          ? tr('<strong>Independent — I is exactly 0.</strong>', '<strong>독립입니다 — I가 정확히 0.</strong>')
          : Math.abs(rho) < 0.05
            ? tr('<strong>The correlation is 0 but I is not.</strong> Mutual information catches the nonlinear dependence the correlation coefficient misses.',
              '<strong>상관은 0인데 I는 0이 아닙니다.</strong> 상관계수가 놓치는 비선형 의존을 상호정보량은 잡아냅니다.')
            : tr('Knowing X reduces the uncertainty about Y by exactly that much.',
              'X를 알면 Y에 대한 불확실성이 그만큼 줄어듭니다.')));
    }
    presetGroup('mutual-presets', ({ preset }) => { hm.set(clone(PRESETS[preset])); render(); });
    render();
  })();

  /* ------------------------------------------------- 9. classification loss */

  (function celoss() {
    const K = 5;
    const OTHERS = [0.4, 0.1, -0.3, -0.6]; // the four non-target logits, fixed
    let z = 2, eps = 0;
    const ch = chart('c-celoss', { xMin: -2, xMax: 12, yMin: 0, yMax: 3 }, render);
    if (!ch) return;

    const target = () => {
      const t = new Array(K).fill(eps / K);
      t[0] += 1 - eps;
      return t;
    };
    const lossAt = (logit) => crossEntropy(target(), Dist.softmax([logit, ...OTHERS], 1));

    function render() {
      const t = target();
      ch.fit().clear();
      ch.setY(0, 3);
      ch.axes({ xLabel: tr('logit of the correct class', '정답 클래스의 logit'), yLabel: tr('cross-entropy loss', '크로스엔트로피 손실') });
      ch.curve(lossAt, { color: C.violet, width: 2.4, samples: 400 });
      const Ht = entropy(t);
      if (eps > 0) ch.hline(Ht, { color: C.orange, dash: [4, 3], label: tr(`lower bound H(p) = ${fmt(Ht)}`, `하한 H(p) = ${fmt(Ht)}`) });
      ch.vline(z, { color: C.green, label: `z = ${fmt(z, 2)}` });
      const L = lossAt(z);
      ch.points([[z, L]], { color: C.green, r: 5 });

      const q = Dist.softmax([z, ...OTHERS], 1);
      say('r-celoss',
        tr(`correct-class probability q_c = ${fmt(q[0], 4)} &nbsp;·&nbsp; loss = ${fmt(L)} &nbsp;·&nbsp; H(p) = ${fmt(Ht)} `,
          `정답 확률 q_c = ${fmt(q[0], 4)} &nbsp;·&nbsp; 손실 = ${fmt(L)} &nbsp;·&nbsp; H(p) = ${fmt(Ht)} `) +
        `&nbsp;·&nbsp; KL(p‖q) = ${fmt(L - Ht)}<br>` +
        (eps === 0
          ? tr('<strong>ε = 0: the lower bound is 0.</strong> Driving the loss to 0 requires q_c = 1, that is a logit growing without bound — the structural reason overconfidence arises.',
            '<strong>ε = 0: 하한이 0입니다.</strong> 손실을 0으로 만들려면 q_c = 1, 즉 logit이 무한히 커져야 합니다 — 과잉 확신이 생기는 구조적 이유입니다.')
          : tr(`<strong>ε = ${fmt(eps, 2)}: the floor has lifted to H(p) = ${fmt(Ht)}.</strong> The minimum now sits at a finite logit, so the model has no reason to race toward infinite confidence.`,
            `<strong>ε = ${fmt(eps, 2)}: 바닥이 H(p) = ${fmt(Ht)}로 들렸습니다.</strong> 최소점이 유한한 logit에 생기므로 모델이 무한한 확신을 향해 달릴 이유가 없어집니다.`)));
    }
    slider('ce-logit', (v) => { z = v; render(); })._emit();
    slider('ce-eps', (v) => { eps = v; render(); })._emit();
  })();

  /* ------------------------------------------------------ 10. perplexity */

  (function perplexity() {
    const TOKENS = tr(['Probability', ' is', ' the', ' language', ' of', ' learning'],
    ['확률', '은', '머신', '러닝', '의', '언어']);
    const V = 50000;
    const PRESETS = {
      good: [0.62, 0.88, 0.41, 0.79, 0.85, 0.33],
      ok: [0.22, 0.45, 0.12, 0.38, 0.40, 0.09],
      uniform: TOKENS.map(() => 1 / V),
    };
    // These are per-token probabilities, not a distribution, so BarRack's
    // normalization would be wrong here — drive plain state instead.
    let probs = PRESETS.good.slice();
    const rack = document.getElementById('ppl-bars');
    const ch = chart('c-perplexity', { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, render);
    if (!rack) return;

    // Build a bar column per token, each independently draggable in (0, 1].
    rack.classList.add('bar-rack');
    rack.style.gridTemplateColumns = `repeat(${TOKENS.length}, 1fr)`;
    const cols = TOKENS.map((name, i) => {
      const col = document.createElement('div');
      col.className = 'bar-col';
      col.tabIndex = 0;
      const fill = document.createElement('div');
      fill.className = 'bar-fill';
      const label = document.createElement('div');
      label.className = 'bar-label';
      col.append(fill, label);
      rack.appendChild(col);
      const bump = (d) => { probs[i] = clamp(probs[i] + d, 1 / V, 1); render(); };
      let dragging = false, lastY = 0;
      col.addEventListener('pointerdown', (e) => { dragging = true; lastY = e.clientY; col.setPointerCapture(e.pointerId); });
      col.addEventListener('pointermove', (e) => { if (dragging) { bump((lastY - e.clientY) * 0.005); lastY = e.clientY; } });
      ['pointerup', 'pointercancel'].forEach((ev) => col.addEventListener(ev, () => { dragging = false; }));
      col.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') { bump(0.02); e.preventDefault(); }
        if (e.key === 'ArrowDown') { bump(-0.02); e.preventDefault(); }
      });
      return { col, fill, label, name };
    });

    function render() {
      cols.forEach(({ fill, label, col, name }, i) => {
        fill.style.height = `${probs[i] * 100}%`;
        label.textContent = `${name} ${probs[i] < 0.001 ? probs[i].toExponential(0) : probs[i].toFixed(2)}`;
        col.setAttribute('aria-label', `q(${name}) = ${probs[i].toPrecision(3)}`);
      });
      const nll = probs.map((p) => -Math.log(p));
      const H = nll.reduce((a, b) => a + b, 0) / nll.length;
      const ppl = Math.exp(H);

      if (ch) {
        ch.fit().clear();
        ch.setX(-0.6, TOKENS.length - 0.4).setY(0, Math.max(2, Math.max(...nll) * 1.15));
        ch.axes({
          xTicks: TOKENS.map((_, i) => i),
          xFormat: (v) => TOKENS[Math.round(v)] ?? '',
          xLabel: 'token', yLabel: '−log q (nat)',
        });
        ch.bars(nll.map((v, i) => ({ lo: i - 0.33, hi: i + 0.33, value: v })),
          { color: 'rgba(124,58,237,.30)', stroke: 'rgba(124,58,237,.7)' });
        ch.hline(H, { color: C.orange, label: tr(`mean = H = ${fmt(H)}`, `평균 = H = ${fmt(H)}`) });
      }
      say('r-perplexity',
        tr(`average cross-entropy H = ${fmt(H)} nat = ${fmt(H / Math.LN2)} bit/token &nbsp;·&nbsp; `,
          `평균 크로스엔트로피 H = ${fmt(H)} nat = ${fmt(H / Math.LN2)} bit/token &nbsp;·&nbsp; `) +
        `<strong>PPL = e^H = ${ppl < 1000 ? fmt(ppl, 2) : ppl.toExponential(2)}</strong><br>` +
        tr(`Reading: this model is at the level of hesitating uniformly among <strong>about ${ppl < 1000 ? Math.round(ppl) : ppl.toExponential(1)}</strong> choices at every token. `,
          `해석: 이 모델은 매 토큰마다 <strong>약 ${ppl < 1000 ? Math.round(ppl) : ppl.toExponential(1)}개</strong>의 선택지를 두고 균등하게 헤매는 것과 같은 수준입니다. `) +
        tr(`A perfect model scores 1; a model that knows nothing scores the vocabulary size ${V.toLocaleString()}.`,
          `완벽한 모델은 1, 아무것도 모르는 모델은 어휘 크기 ${V.toLocaleString()}입니다.`));
    }
    presetGroup('ppl-presets', ({ preset }) => { probs = PRESETS[preset].slice(); render(); });
    render();
  })();

  /* ------------------------------------------------------------ 11. ELBO */

  (function elbo() {
    // A fixed "true posterior" the approximation is chasing. log p(x) is a
    // constant here by construction — that is exactly the point being made.
    const TRUE_POST = Dist.gaussian(0.8, 0.7);
    const LOG_PX = -1.35;
    let mu = 0, sigma = 1.6;
    const ch = chart('c-elbo', { xMin: -4, xMax: 4, yMin: 0, yMax: 0.7 }, render);
    const chBar = chart('c-elbo-bar', { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, render);
    if (!ch) return;

    function render() {
      const q = Dist.gaussian(mu, sigma);
      ch.fit().clear();
      ch.setY(0, Math.max(0.65, TRUE_POST.pdf(TRUE_POST.mu) * 1.12));
      ch.axes({ xLabel: tr('z (latent variable)', 'z (잠재변수)'), yLabel: 'density' });
      ch.curve((x) => TRUE_POST.pdf(x), { color: '#8c8c8c', width: 2, fill: 'rgba(140,140,140,.12)' });
      ch.curve((x) => q.pdf(x), { color: C.orange, width: 2.2 });

      const qg = discretize((x) => q.pdf(x));
      const pg = discretize((x) => TRUE_POST.pdf(x));
      const gap = kl(qg, pg);           // reverse KL — the ELBO gap
      const elboVal = LOG_PX - gap;

      if (chBar) {
        chBar.fit().clear();
        chBar.setX(LOG_PX - 3.2, LOG_PX + 0.5).setY(0, 1);
        chBar.axes({ yTicks: [], yTickLabels: false, xLabel: 'nat' });
        chBar.bars([{ lo: chBar.xMin, hi: elboVal, value: 0.55 }],
          { color: 'rgba(6,69,173,.35)', stroke: 'rgba(6,69,173,.7)' });
        chBar.bars([{ lo: elboVal, hi: LOG_PX, value: 0.55 }],
          { color: 'rgba(249,115,22,.40)', stroke: 'rgba(249,115,22,.8)' });
        chBar.vline(LOG_PX, { color: C.green, label: tr(`log p(x) = ${fmt(LOG_PX, 2)} (fixed)`, `log p(x) = ${fmt(LOG_PX, 2)} (고정)`) });
        chBar.label((chBar.xMin + elboVal) / 2, 0.55, 'ELBO', { align: 'center', dy: -6, font: '11px system-ui' });
        if (gap > 0.08) chBar.label((elboVal + LOG_PX) / 2, 0.55, 'KL', { align: 'center', dy: -6, font: '11px system-ui' });
      }
      say('r-elbo',
        `${dot('#8c8c8c', tr('true posterior p(z|x)', '참 사후분포 p(z|x)'))} &nbsp; ` +
        `${dot(C.orange, tr(`approximate q(z|x) = N(${fmt(mu, 2)}, ${fmt(sigma, 2)}²)`, `근사 q(z|x) = N(${fmt(mu, 2)}, ${fmt(sigma, 2)}²)`))}<br>` +
        `${dot('rgba(6,69,173,.8)', `ELBO = ${fmt(elboVal)}`)} + ${dot(C.orange, `KL = ${fmt(gap)}`)} = ` +
        `${dot(C.green, `log p(x) = ${fmt(LOG_PX)}`)}<br>` +
        (gap < 0.02
          ? tr('<strong>q almost matches the true posterior — the gap has vanished and the bound is tight.</strong>',
            '<strong>q가 참 사후분포와 거의 일치 — 간격이 사라져 하한이 정확해졌습니다.</strong>')
          : tr('The closer q gets to the true posterior, the smaller the orange gap and the higher the ELBO. The key point is that the total is <strong>fixed regardless of q</strong>.',
            'q를 참 사후분포에 맞출수록 주황 간격이 줄고 ELBO가 올라갑니다. 총합은 <strong>q와 무관하게 고정</strong>이라는 점이 핵심입니다.')));
    }
    slider('elbo-mu', (v) => { mu = v; render(); })._emit();
    slider('elbo-sigma', (v) => { sigma = v; render(); })._emit();
  })();

  /* --------------------------------------------------------- 12. InfoNCE */

  (function infonce() {
    const N = 5;
    const PRESETS = {
      // Rows are anchors, columns are candidates; the diagonal is the positive.
      good: Array.from({ length: N }, (_, i) =>
        Array.from({ length: N }, (_, j) => (i === j ? 0.92 : 0.10 + 0.05 * ((i + j) % 3)))),
      random: Array.from({ length: N }, (_, i) =>
        Array.from({ length: N }, (_, j) => 0.35 + 0.12 * Math.sin(i * 2.1 + j * 1.7))),
    };
    const clone = (m) => m.map((r) => r.slice());
    let sim = clone(PRESETS.random);
    let tau = 0.5;

    const hm = new Heatmap('infonce-heatmap', {
      rows: N, cols: N, editable: true, xName: tr('cand', '후보'), yName: tr('anchor', '앵커'),
      values: clone(sim), onChange: null,
    });
    if (!hm.el) return;
    // Similarities are not a distribution: keep raw values instead of renormalizing.
    hm.normalize = function () { return this; };
    hm.p = clone(sim);
    hm.onChange = () => { sim = clone(hm.p); render(); };
    hm.render();

    function render() {
      // Row i is display-flipped by Heatmap, so read anchors back in data order.
      let total = 0;
      for (let i = 0; i < N; i++) {
        const row = hm.p[i];
        const logits = row.map((s) => s / tau);
        const q = Dist.softmax(logits, 1);
        total += -Math.log(Math.max(q[i], EPS));
      }
      const loss = total / N;
      const bound = Math.log(N) - loss;
      hm.render();
      say('r-infonce',
        tr(`N = ${N} &nbsp;·&nbsp; τ = ${fmt(tau, 2)} &nbsp;·&nbsp; <strong>InfoNCE loss = ${fmt(loss)} nat</strong> `,
          `N = ${N} &nbsp;·&nbsp; τ = ${fmt(tau, 2)} &nbsp;·&nbsp; <strong>InfoNCE 손실 = ${fmt(loss)} nat</strong> `) +
        `&nbsp;·&nbsp; log N = ${fmt(Math.log(N))}<br>` +
        tr(`MI lower bound I(X;X⁺) ≥ log N − L = <strong>${fmt(Math.max(0, bound))} nat</strong> &nbsp;·&nbsp; `,
          `MI 하한 I(X;X⁺) ≥ log N − L = <strong>${fmt(Math.max(0, bound))} nat</strong> &nbsp;·&nbsp; `) +
        (bound > Math.log(N) * 0.6
          ? tr('The diagonal (the positive pairs) is sharp, so the loss is low and the bound is close to its ceiling log N.',
            '대각선(양성 쌍)이 뚜렷해 손실이 낮고 하한이 천장 log N에 가깝습니다.')
          : tr('Drag the diagonal cells brighter — the loss falls and the bound rises. ',
            '대각선 셀을 드래그해 밝게 만들어보세요 — 손실이 내려가고 하한이 올라갑니다. ') +
            tr(`The bound can never exceed <strong>log N = ${fmt(Math.log(N))}</strong>. Only a larger batch raises the ceiling.`,
              `하한은 <strong>log N = ${fmt(Math.log(N))}</strong>을 넘을 수 없습니다. 배치를 키워야 천장이 올라갑니다.`)));
    }
    slider('nce-tau', (v) => { tau = v; render(); })._emit();
    presetGroup('nce-presets', ({ preset }) => {
      sim = clone(PRESETS[preset]);
      hm.p = clone(sim);
      render();
    });
    render();
  })();
})();
