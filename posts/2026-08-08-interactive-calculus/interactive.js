/*
 * Wires up the calculus demos. Builds on Chart2D (js/prob-engine.js), the
 * numeric calculus + field drawing in js/calc-engine.js, and LA's eig2 from
 * js/engine.js.
 *
 * Every derivative here is a central difference and every integral is
 * quadrature — see js/calc-engine.js for why. That means each demo works on
 * whatever function the reader selects, with no symbolic special-casing.
 */
(function () {
  const { LA, Chart2D, Calc, PROB_COLORS: C } = window;
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

  /* ---------------------------------------------------------- scaffolding */

  $$('canvas').forEach((canvas) => {
    const demo = canvas.closest('.topic-demo');
    const readout = demo && demo.querySelector('.readout');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', isEnglish
      ? 'Interactive calculus diagram'
      : '미적분 개념을 조작하며 살펴보는 인터랙티브 도식');
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

  // Click / drag a point inside a chart, reported in data coordinates.
  function draggablePoint(ch, state, onMove) {
    if (!ch) return;
    const canvas = ch.canvas;
    canvas.style.cursor = 'crosshair';
    let dragging = false;
    const set = (e) => {
      const [x, y] = ch.eventXY(e);
      state.x = clamp(x, ch.xMin, ch.xMax);
      state.y = clamp(y, ch.yMin, ch.yMax);
      onMove();
    };
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
      set(e);
    });
    canvas.addEventListener('pointermove', (e) => { if (dragging) set(e); });
    ['pointerup', 'pointercancel'].forEach((ev) =>
      canvas.addEventListener(ev, () => { dragging = false; }));
  }

  /* ------------------------------------------------------------ 1. functions */

  (function functions() {
    const FNS = {
      poly: { f: (x, a, b) => a * x * x * x - 3 * a * x + b, label: 'f(x) = a·x³ − 3a·x + b' },
      sin: { f: (x, a, b) => a * Math.sin(2 * x) + b, label: 'f(x) = a·sin(2x) + b' },
      relu: { f: (x, a, b) => Math.max(0, a * x + b), label: 'f(x) = max(0, a·x + b)' },
      sigmoid: { f: (x, a, b) => 3 / (1 + Math.exp(-a * (x - b))), label: 'f(x) = 3·σ(a(x − b))' },
    };
    let kind = 'poly', a = 1, b = 0, compose = false;
    const ch = chart('c-functions', { xMin: -3, xMax: 3, yMin: -4, yMax: 4 }, render);
    if (!ch) return;

    function render() {
      const { f, label } = FNS[kind];
      const g = (u) => Math.tanh(u);          // the outer function when composing
      ch.fit().clear();
      ch.axes({ xLabel: 'x', yLabel: 'y' });
      ch.curve((x) => clamp(f(x, a, b), -10, 10), { color: C.blue, width: 2.2 });
      if (compose) ch.curve((x) => 3 * g(f(x, a, b)), { color: C.orange, width: 2.2 });
      say('r-functions',
        `${dot(C.blue, label)} &nbsp;·&nbsp; a = ${fmt(a, 2)}, b = ${fmt(b, 2)}` +
        (compose
          ? `<br>${dot(C.orange, 'g(f(x)) = 3·tanh(f(x))')} ` + tr(
            `— the outer function squashes the values, <strong>keeping the shape but bounding the range</strong>. This is what stacking layers does.`,
            `— 바깥 함수가 값을 눌러 담아 <strong>모양은 유지하되 범위가 제한</strong>됩니다. 층을 쌓는다는 것이 이런 일입니다.`)
          : tr(`<br>Change the function with the buttons and move a and b. ReLU has a kink at one point but is differentiable everywhere else.`,
            `<br>버튼으로 함수를 바꾸고 a, b를 움직여보세요. ReLU는 한 점에서 꺾이지만 나머지 어디서나 미분 가능합니다.`)));
    }
    presetGroup('fn-presets', ({ fn }) => { kind = fn; render(); });
    slider('fn-a', (v) => { a = v; render(); })._emit();
    slider('fn-b', (v) => { b = v; render(); })._emit();
    toggle('fn-compose', (on) => { compose = on; render(); });
  })();

  /* --------------------------------------------------------------- 2. limits */

  (function limits() {
    const f = (x) => 0.5 * x * x * x - 1.2 * x + 0.4;
    let logH = 0, a = 0.6;
    const ch = chart('c-limits', { xMin: -2.4, xMax: 2.4, yMin: -3, yMax: 3 }, render);
    if (!ch) return;

    function render() {
      const h = Math.pow(10, logH);
      const secant = (f(a + h) - f(a)) / h;
      const exact = Calc.ddx(f, a);
      ch.fit().clear();
      ch.axes({ xLabel: 'x', yLabel: 'f(x)' });
      ch.curve(f, { color: C.blue, width: 2.2 });
      // Tangent (truth) and secant (approximation) through the same point.
      ch.curve((x) => f(a) + exact * (x - a), { color: C.green, width: 1.6, dash: [5, 4] });
      ch.curve((x) => f(a) + secant * (x - a), { color: C.orange, width: 1.8 });
      ch.points([[a, f(a)]], { color: C.green, r: 5 });
      ch.points([[a + h, f(a + h)]], { color: C.orange, r: 4.5 });
      const err = Math.abs(secant - exact);
      say('r-limits',
        `h = ${h < 1e-3 ? h.toExponential(2) : fmt(h, 4)} &nbsp;·&nbsp; ` +
        `${dot(C.orange, tr(`secant slope = ${fmt(secant, 6)}`, `할선 기울기 = ${fmt(secant, 6)}`))} &nbsp;·&nbsp; ` +
        `${dot(C.green, tr(`tangent f′(a) = ${fmt(exact, 6)}`, `접선 f′(a) = ${fmt(exact, 6)}`))} ` +
        tr(`&nbsp;·&nbsp; error = ${err.toExponential(2)}<br>`, `&nbsp;·&nbsp; 오차 = ${err.toExponential(2)}<br>`) +
        (h > 0.3 ? tr('With h large the secant departs visibly from the tangent.', 'h가 크면 할선이 접선과 눈에 띄게 어긋납니다.')
          : h > 1e-5 ? tr('The smaller h gets, the closer the secant converges to the tangent — this limit is the definition of the derivative.',
            'h를 줄일수록 할선이 접선에 수렴합니다 — 이 극한이 도함수의 정의입니다.')
          : tr('<strong>If h is too small the error grows instead.</strong> The two values in the numerator become nearly equal and floating-point digits cancel — which is why automatic differentiation does not use finite differences.',
            '<strong>h가 너무 작으면 오히려 오차가 커집니다.</strong> 분자의 두 값이 거의 같아져 부동소수점 자릿수가 상쇄되기 때문입니다 — 자동미분이 유한차분을 쓰지 않는 이유입니다.')));
    }
    slider('lim-h', (v) => { logH = v; render(); },
      (v) => { const h = Math.pow(10, v); return h < 1e-3 ? h.toExponential(1) : h.toFixed(4); })._emit();
    slider('lim-a', (v) => { a = v; render(); })._emit();
  })();

  /* ---------------------------------------------------------- 3. derivatives */

  (function derivatives() {
    const f = (x) => 0.25 * Math.pow(x, 4) - 1.2 * x * x + 0.4 * x + 1.2;
    let a = -1.6, eta = 0.2;
    const ch = chart('c-derivatives', { xMin: -2.6, xMax: 2.6, yMin: -1.5, yMax: 3.5 }, render);
    const chD = chart('c-derivatives-d', { xMin: -2.6, xMax: 2.6, yMin: -4, yMax: 4 }, render);
    if (!ch) return;
    const slA = { ref: NO_SLIDER };

    function render() {
      const d = Calc.ddx(f, a);
      ch.fit().clear();
      ch.axes({ xLabel: 'x', yLabel: 'f(x)' });
      ch.curve(f, { color: C.blue, width: 2.2 });
      ch.curve((x) => f(a) + d * (x - a), { color: C.orange, width: 1.8 });
      ch.points([[a, f(a)]], { color: C.orange, r: 5.5 });

      if (chD) {
        chD.fit().clear();
        chD.axes({ xLabel: 'x', yLabel: "f′(x)" });
        chD.curve((x) => Calc.ddx(f, x), { color: C.violet, width: 2 });
        chD.hline(0, { color: C.muted, dash: [3, 3] });
        chD.points([[a, d]], { color: C.orange, r: 5 });
        chD.vline(a, { color: 'rgba(249,115,22,.5)', dash: [2, 3] });
      }
      say('r-derivatives',
        `a = ${fmt(a, 2)} &nbsp;·&nbsp; f(a) = ${fmt(f(a))} &nbsp;·&nbsp; <strong>f′(a) = ${fmt(d)}</strong> &nbsp;·&nbsp; ` +
        (Math.abs(d) < 0.05 ? tr('<strong>A critical point</strong> — the slope is 0. Whether it is a minimum, maximum or saddle needs second-order information.',
            '<strong>임계점</strong> — 기울기가 0입니다. 최소·최대·안장 중 어느 것인지는 2차 정보가 있어야 압니다.')
          : d > 0 ? tr('Positive slope → increasing to the right. To decrease, go <strong>left</strong>.',
            '기울기가 양수 → 오른쪽으로 갈수록 증가. 줄이려면 <strong>왼쪽</strong>으로 가야 합니다.')
          : tr('Negative slope → decreasing to the right. To decrease, go <strong>right</strong>.',
            '기울기가 음수 → 오른쪽으로 갈수록 감소. 줄이려면 <strong>오른쪽</strong>으로 가야 합니다.')) +
        tr(`<br>Next step: a − η·f′(a) = ${fmt(a - eta * d)} (η = ${fmt(eta, 2)})`,
          `<br>다음 걸음: a − η·f′(a) = ${fmt(a - eta * d)} (η = ${fmt(eta, 2)})`));
    }
    slA.ref = slider('der-a', (v) => { a = v; render(); });
    slider('der-eta', (v) => { eta = v; render(); })._emit();
    const btn = document.getElementById('der-step');
    if (btn) btn.addEventListener('click', () => {
      a = clamp(a - eta * Calc.ddx(f, a), -2.6, 2.6);
      slA.ref.value = String(a);
      slA.ref._emit();
    });
    slA.ref._emit();
  })();

  /* ---------------------------------------------------------- 4. chain rule */

  (function chainRule() {
    let g = 0.6, L = 20;
    const ch = chart('c-chainrule', { xMin: 0, xMax: 60, yMin: -8, yMax: 8 }, render);
    const chF = chart('c-chainrule-fn', { xMin: -2.5, xMax: 2.5, yMin: -1.6, yMax: 1.6 }, render);
    if (!ch) return;

    function render() {
      // log10 of the accumulated product, so vanishing and exploding are both
      // visible on one axis.
      ch.fit().clear();
      ch.setX(0, Math.max(10, L)).setY(-12, 12);
      ch.axes({ xLabel: tr('layer depth', '층 depth'), yLabel: tr('log₁₀(accumulated gradient)', 'log₁₀(누적 기울기)') });
      const path = Array.from({ length: L + 1 }, (_, k) => [k, k * Math.log10(g)]);
      ch.curve(path, { color: C.violet, width: 2.2 });
      ch.hline(0, { color: C.muted, dash: [3, 3], label: tr('gradient 1 (ideal)', '기울기 1 (이상적)') });
      ch.points([[L, L * Math.log10(g)]], { color: C.orange, r: 5 });

      if (chF) {
        // The concrete two-step case: f then g, with the composed tangent.
        const f1 = (x) => Math.tanh(1.5 * x);
        const g1 = (u) => 0.9 * Math.sin(2 * u);
        const comp = (x) => g1(f1(x));
        const x0 = 0.6;
        chF.fit().clear();
        chF.axes({ xLabel: 'x', yLabel: 'y' });
        chF.curve(f1, { color: 'rgba(140,140,140,.8)', width: 1.6, dash: [4, 3] });
        chF.curve(comp, { color: C.blue, width: 2.2 });
        const dc = Calc.ddx(comp, x0);
        chF.curve((x) => comp(x0) + dc * (x - x0), { color: C.orange, width: 1.6 });
        chF.points([[x0, comp(x0)]], { color: C.orange, r: 4.5 });
      }

      const total = Math.pow(g, L);
      say('r-chainrule',
        tr(`factor per layer ${fmt(g, 2)} &nbsp;·&nbsp; ${L} layers &nbsp;·&nbsp; `,
          `층당 배율 ${fmt(g, 2)} &nbsp;·&nbsp; 층 수 ${L} &nbsp;·&nbsp; `) +
        tr(`<strong>accumulated gradient = ${fmt(g, 2)}^${L} = ${total < 1e-4 || total > 1e4 ? total.toExponential(2) : fmt(total, 4)}</strong><br>`,
          `<strong>누적 기울기 = ${fmt(g, 2)}^${L} = ${total < 1e-4 || total > 1e4 ? total.toExponential(2) : fmt(total, 4)}</strong><br>`) +
        (total < 1e-4
          ? tr('<strong>Vanishing gradient</strong> — essentially no training signal reaches the early layers. Stacking sigmoids (maximum slope 0.25) deeply looks like this.',
            '<strong>기울기 소실</strong> — 앞쪽 층에는 학습 신호가 사실상 도달하지 않습니다. 시그모이드(최대 기울기 0.25)로 깊게 쌓으면 이렇게 됩니다.')
          : total > 1e4
            ? tr('<strong>Exploding gradient</strong> — the updates diverge. Gradient clipping is the countermeasure.',
              '<strong>기울기 폭발</strong> — 업데이트가 발산합니다. gradient clipping이 대응책입니다.')
            : tr('<strong>Stable range</strong> — only with the factor near 1 can depth be increased. A residual connection guarantees that 1 along the identity path.',
              '<strong>안정 구간</strong> — 배율이 1 근처라야 깊이를 늘릴 수 있습니다. 잔차연결이 항등 경로로 이 1을 보장해줍니다.')));
    }
    slider('chain-g', (v) => { g = v; render(); })._emit();
    slider('chain-l', (v) => { L = Math.round(v); render(); }, (v) => String(Math.round(v)))._emit();
  })();

  /* ------------------------------------------------------------- 5. taylor */

  (function taylor() {
    const f = (x) => Math.sin(1.6 * x) + 0.35 * x;
    let N = 1, a = 0;
    const ch = chart('c-taylor', { xMin: -3.6, xMax: 3.6, yMin: -3, yMax: 3 }, render);
    if (!ch) return;

    // Derivatives at `a` by repeated central differencing. Beyond ~6 orders the
    // noise dominates, so the step grows with the order to stay stable.
    function nthDeriv(fn, x, n) {
      if (n === 0) return fn(x);
      const h = 0.35 / Math.max(1, Math.pow(1.25, n));
      let acc = 0;
      // Central formula: sum_k (-1)^k C(n,k) f(x + (n/2 - k) h) / h^n
      for (let k = 0; k <= n; k++) {
        let c = 1;
        for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
        acc += Math.pow(-1, k) * c * fn(x + (n / 2 - k) * h);
      }
      return acc / Math.pow(h, n);
    }

    function render() {
      const coef = [];
      let fact = 1;
      for (let n = 0; n <= N; n++) {
        if (n > 0) fact *= n;
        coef.push(nthDeriv(f, a, n) / fact);
      }
      const poly = (x) => coef.reduce((s, c, n) => s + c * Math.pow(x - a, n), 0);

      ch.fit().clear();
      ch.axes({ xLabel: 'x', yLabel: 'y' });
      ch.curve(f, { color: C.blue, width: 2.2 });
      ch.curve((x) => clamp(poly(x), -20, 20), { color: C.orange, width: 2 });
      ch.vline(a, { color: C.green, dash: [3, 3], label: `a = ${fmt(a, 2)}` });
      ch.points([[a, f(a)]], { color: C.green, r: 5 });

      // How far can we go before the approximation drifts by more than 0.1?
      let reach = 0;
      for (let d = 0.02; d <= 3.5; d += 0.02) {
        if (Math.abs(poly(a + d) - f(a + d)) > 0.1 || Math.abs(poly(a - d) - f(a - d)) > 0.1) break;
        reach = d;
      }
      say('r-taylor',
        `${dot(C.blue, 'f(x) = sin(1.6x) + 0.35x')} &nbsp;·&nbsp; ` +
        `${dot(C.orange, tr(`degree-${N} Taylor polynomial`, `${N}차 테일러 다항식`))} &nbsp;·&nbsp; ` +
        tr(`trustworthy to within 0.1 over ≈ a ± ${fmt(reach, 2)}<br>`,
          `오차 0.1 이내로 믿을 수 있는 범위 ≈ a ± ${fmt(reach, 2)}<br>`) +
        (N === 0 ? tr('Degree 0 = a constant. It matches only the function value.', '0차 = 상수. 함숫값만 맞춥니다.')
          : N === 1 ? tr('Degree 1 = the <strong>tangent</strong>. The approximation gradient descent trusts at every step, with the learning rate deciding "how far do we trust this line."',
            '1차 = <strong>접선</strong>. 경사하강법이 매 걸음 신뢰하는 근사이며, 학습률이 곧 "이 직선을 어디까지 믿을 것인가"입니다.')
          : N === 2 ? tr('Degree 2 = the <strong>tangent parabola</strong>. The approximation used by Newton\'s method, where curvature sets the step for us.',
            '2차 = <strong>접하는 포물선</strong>. 뉴턴법이 쓰는 근사로, 곡률이 보폭을 대신 정해줍니다.')
          : tr(`Degree ${N}. Raising the degree widens the interval of good agreement, but far from a it collapses all the same.`,
            `${N}차. 차수를 올릴수록 근사 구간이 넓어지지만, a에서 멀어지면 결국 무너집니다.`)));
    }
    slider('tay-n', (v) => { N = Math.round(v); render(); }, (v) => String(Math.round(v)))._emit();
    slider('tay-a', (v) => { a = v; render(); })._emit();
  })();

  /* ----------------------------------------------------------- 6. integrals */

  (function integrals() {
    const f = (x) => Math.sin(1.5 * x) + 0.6 * x * Math.exp(-x * x * 0.3);
    let a = -2, b = 2, n = 10;
    const ch = chart('c-integrals', { xMin: -3.2, xMax: 3.2, yMin: -1.6, yMax: 1.6 }, render);
    const chC = chart('c-integrals-cum', { xMin: -3.2, xMax: 3.2, yMin: -1.5, yMax: 1.5 }, render);
    if (!ch) return;

    function render() {
      const lo = Math.min(a, b), hi = Math.max(a, b);
      ch.fit().clear();
      ch.axes({ xLabel: 'x', yLabel: 'f(x)' });
      // Midpoint rectangles: the Riemann sum being taken to its limit.
      const w = (hi - lo) / n;
      const rects = [];
      let riemann = 0;
      for (let i = 0; i < n; i++) {
        const x0 = lo + i * w;
        const mid = x0 + w / 2;
        const v = f(mid);
        riemann += v * w;
        rects.push({ lo: x0, hi: x0 + w, value: v });
      }
      // Bars only draw upward, so split by sign to show the signed area honestly.
      ch.bars(rects.filter((r) => r.value > 0), { color: 'rgba(6,69,173,.22)', stroke: 'rgba(6,69,173,.55)' });
      ch.ctx.save();
      rects.filter((r) => r.value <= 0).forEach((r) => {
        const y0 = ch.py(0), y1 = ch.py(r.value);
        ch.ctx.fillStyle = 'rgba(217,48,37,.20)';
        ch.ctx.strokeStyle = 'rgba(217,48,37,.55)';
        ch.ctx.fillRect(ch.px(r.lo), y0, ch.px(r.hi) - ch.px(r.lo), y1 - y0);
        ch.ctx.strokeRect(ch.px(r.lo), y0, ch.px(r.hi) - ch.px(r.lo), y1 - y0);
      });
      ch.ctx.restore();
      ch.curve(f, { color: C.orange, width: 2.2 });
      ch.hline(0, { color: C.muted, dash: [3, 3] });

      const exact = Calc.integrate(f, lo, hi, 800);
      if (chC) {
        chC.fit().clear();
        chC.axes({ xLabel: 'x', yLabel: 'F(x) = ∫₋₃ˣ f' });
        chC.curve(Calc.cumulative(f, -3.2, 3.2, 300), { color: C.violet, width: 2 });
        chC.vline(lo, { color: 'rgba(15,157,88,.7)', dash: [3, 3] });
        chC.vline(hi, { color: 'rgba(15,157,88,.7)', dash: [3, 3] });
      }
      say('r-integrals',
        tr(`interval [${fmt(lo, 2)}, ${fmt(hi, 2)}] &nbsp;·&nbsp; subdivisions n = ${n} &nbsp;·&nbsp; `,
          `구간 [${fmt(lo, 2)}, ${fmt(hi, 2)}] &nbsp;·&nbsp; 분할 n = ${n} &nbsp;·&nbsp; `) +
        tr(`Riemann sum = ${fmt(riemann, 5)} &nbsp;·&nbsp; <strong>true ≈ ${fmt(exact, 5)}</strong> &nbsp;·&nbsp; error = ${Math.abs(riemann - exact).toExponential(2)}<br>`,
          `리만 합 = ${fmt(riemann, 5)} &nbsp;·&nbsp; <strong>참값 ≈ ${fmt(exact, 5)}</strong> &nbsp;·&nbsp; 오차 = ${Math.abs(riemann - exact).toExponential(2)}<br>`) +
        `${dot('rgba(6,69,173,.7)', tr('above the axis = added as positive', '축 위 = 양수로 더함'))} &nbsp; ` +
        `${dot('rgba(217,48,37,.7)', tr('below the axis = subtracted as negative', '축 아래 = 음수로 깎음'))} &nbsp;·&nbsp; ` +
        tr(`The <strong>slope</strong> of the cumulative curve below is the <strong>value</strong> of the curve above — this is the fundamental theorem of calculus.`,
          `아래 누적 곡선의 <strong>기울기</strong>가 위 곡선의 <strong>값</strong>입니다 — 이것이 미적분학의 기본정리입니다.`));
    }
    slider('int-a', (v) => { a = v; render(); })._emit();
    slider('int-b', (v) => { b = v; render(); })._emit();
    slider('int-n', (v) => { n = Math.round(v); render(); }, (v) => String(Math.round(v)))._emit();
  })();

  /* ------------------------------------------------ 6b. multiple integrals */

  (function multipleIntegrals() {
    // Volume under z = f(x,y) over the unit square.
    const f = (x, y) => 1 + 0.8 * x * y + 0.5 * Math.sin(3 * x) * Math.cos(2 * y);
    let order = 'dydx', s = 0.5;
    const ch = chart('c-multint', { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, render);
    const chS = chart('c-multint-slice', { xMin: 0, xMax: 1, yMin: 0, yMax: 2.5 }, render);
    if (!ch) return;

    function render() {
      ch.fit().clear();
      ch.heat((x, y) => f(x, y), { res: 3, alpha: 0.9, min: 0, max: 2.5 });
      ch.contour((x, y) => f(x, y), [0.6, 0.9, 1.2, 1.5, 1.8, 2.1], { color: 'rgba(40,40,40,.35)' });
      ch.axes({ grid: false, xLabel: 'x', yLabel: 'y' });
      // The slice being integrated first.
      if (order === 'dydx') ch.vline(s, { color: C.green, width: 2.4, dash: [], label: `x = ${fmt(s, 2)}` });
      else ch.hline(s, { color: C.green, width: 2.4, dash: [], label: `y = ${fmt(s, 2)}` });

      const inner = order === 'dydx'
        ? (t) => f(s, t)   // integrate over y at fixed x
        : (t) => f(t, s);  // integrate over x at fixed y
      const sliceArea = Calc.integrate(inner, 0, 1, 300);

      if (chS) {
        chS.fit().clear();
        chS.axes({ xLabel: order === 'dydx' ? 'y' : 'x', yLabel: 'f' });
        chS.curve(inner, { color: C.green, width: 2.2, fill: 'rgba(15,157,88,.16)' });
      }
      // Total volume by nested quadrature, computed both ways to show they agree.
      const volA = Calc.integrate((x) => Calc.integrate((y) => f(x, y), 0, 1, 120), 0, 1, 120);
      const volB = Calc.integrate((y) => Calc.integrate((x) => f(x, y), 0, 1, 120), 0, 1, 120);
      say('r-multint',
        `${order === 'dydx' ? '∫∫ f dy dx' : '∫∫ f dx dy'} &nbsp;·&nbsp; ` +
        tr(`area of the current cross-section = ${fmt(sliceArea, 4)} &nbsp;·&nbsp; `,
          `현재 단면의 넓이 = ${fmt(sliceArea, 4)} &nbsp;·&nbsp; `) +
        tr(`<strong>total volume = ${fmt(order === 'dydx' ? volA : volB, 5)}</strong><br>`,
          `<strong>전체 부피 = ${fmt(order === 'dydx' ? volA : volB, 5)}</strong><br>`) +
        tr(`Computing in the other order also gives ${fmt(volB, 5)} — <strong>the same value</strong> (Fubini's theorem). `,
          `순서를 바꿔 계산해도 ${fmt(volB, 5)} — <strong>같은 값</strong>입니다(푸비니 정리). `) +
        tr(`Collecting and adding cross-sectional areas is the double integral, and one inner integration is the <em>marginalization</em> of the probability article.`,
          `단면 넓이를 모아 더하는 것이 이중적분이고, 안쪽 적분 한 번이 곧 확률 글의 <em>주변화</em>입니다.`));
    }
    presetGroup('mint-order', (d) => { order = d.order; render(); });
    slider('mint-s', (v) => { s = v; render(); })._emit();
  })();

  /* ------------------------------------------------------ 7. partial derivs */

  (function partial() {
    const f = (x, y) => Math.sin(1.2 * x) * Math.cos(1.1 * y) + 0.25 * x * y;
    const pt = { x: 0.9, y: -0.6 };
    const ch = chart('c-partial', { xMin: -3, xMax: 3, yMin: -3, yMax: 3 }, render);
    const chX = chart('c-partial-x', { xMin: -3, xMax: 3, yMin: -2.5, yMax: 2.5 }, render);
    const chY = chart('c-partial-y', { xMin: -3, xMax: 3, yMin: -2.5, yMax: 2.5 }, render);
    if (!ch) return;

    function render() {
      ch.fit().clear();
      ch.heat(f, { res: 3, alpha: 0.75 });
      ch.contour(f, [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2], { color: 'rgba(40,40,40,.3)' });
      ch.axes({ grid: false, xLabel: 'x', yLabel: 'y' });
      const fx = Calc.dfdx(f, pt.x, pt.y);
      const fy = Calc.dfdy(f, pt.x, pt.y);
      // Axis-aligned arrows: each partial is a slope along one axis only.
      const sc = 0.7;
      ch.curve([[pt.x, pt.y], [pt.x + sc * Math.sign(fx) * Math.min(1, Math.abs(fx)), pt.y]],
        { color: C.red, width: 3 });
      ch.curve([[pt.x, pt.y], [pt.x, pt.y + sc * Math.sign(fy) * Math.min(1, Math.abs(fy))]],
        { color: C.violet, width: 3 });
      ch.points([[pt.x, pt.y]], { color: '#111', r: 5 });

      for (const [c, g, lab, dcolor] of [
        [chX, (t) => f(t, pt.y), 'x', C.red],
        [chY, (t) => f(pt.x, t), 'y', C.violet],
      ]) {
        if (!c) continue;
        c.fit().clear();
        c.axes({ xLabel: lab, yLabel: 'f' });
        c.curve(g, { color: C.blue, width: 2 });
        const t0 = lab === 'x' ? pt.x : pt.y;
        const d = Calc.ddx(g, t0);
        c.curve((t) => g(t0) + d * (t - t0), { color: dcolor, width: 1.8 });
        c.points([[t0, g(t0)]], { color: dcolor, r: 4.5 });
      }
      say('r-partial',
        tr(`point (${fmt(pt.x, 2)}, ${fmt(pt.y, 2)}) &nbsp;·&nbsp; f = ${fmt(f(pt.x, pt.y))} &nbsp;·&nbsp; `,
          `점 (${fmt(pt.x, 2)}, ${fmt(pt.y, 2)}) &nbsp;·&nbsp; f = ${fmt(f(pt.x, pt.y))} &nbsp;·&nbsp; `) +
        `${dot(C.red, `∂f/∂x = ${fmt(fx)}`)} &nbsp;·&nbsp; ${dot(C.violet, `∂f/∂y = ${fmt(fy)}`)}<br>` +
        tr(`The same point, yet the two values differ — <strong>the direction of the cut decides the slope.</strong> `,
          `같은 점인데도 두 값이 다릅니다 — <strong>어느 방향으로 자르느냐가 기울기를 정합니다.</strong> `) +
        tr(`The two graphs below are the cross-section in each direction and its tangent.`,
          `아래 두 그래프가 각각 그 방향으로 자른 단면과 그 접선입니다.`));
    }
    draggablePoint(ch, pt, render);
    render();
  })();

  /* ------------------------------------------------------------ 8. gradient */

  (function gradient() {
    let aniso = 1, eta = 0.1;
    const start = { x: -2.2, y: 1.7 };
    let path = [];
    const ch = chart('c-gradient', { xMin: -3, xMax: 3, yMin: -2.4, yMax: 2.4 }, render);
    if (!ch) return;
    const f = (x, y) => 0.5 * (x * x + aniso * y * y);

    function render() {
      ch.fit().clear();
      ch.heat(f, { res: 4, alpha: 0.6, min: 0, max: 6 });
      const levels = [0.1, 0.4, 0.9, 1.6, 2.5, 3.6, 4.9];
      ch.contour(f, levels, { color: 'rgba(40,40,40,.35)' });
      ch.axes({ grid: false, xLabel: 'x', yLabel: 'y' });
      // −∇f at the current point, drawn against the level curve it crosses.
      const g = Calc.grad2(f, start.x, start.y);
      const m = Math.hypot(g[0], g[1]) || 1;
      const L = 0.8;
      ch.curve([[start.x, start.y], [start.x - (g[0] / m) * L, start.y - (g[1] / m) * L]],
        { color: C.red, width: 3 });
      if (path.length > 1) ch.curve(path, { color: C.orange, width: 1.8 });
      path.forEach((p, i) => { if (i % 2 === 0) ch.points([p], { color: 'rgba(249,115,22,.8)', r: 2.2 }); });
      ch.points([[start.x, start.y]], { color: '#111', r: 5 });
      ch.points([[0, 0]], { color: C.green, r: 5 });

      const kappa = Math.max(1, aniso);
      say('r-gradient',
        tr(`point (${fmt(start.x, 2)}, ${fmt(start.y, 2)}) &nbsp;·&nbsp; ∇f = (${fmt(g[0], 2)}, ${fmt(g[1], 2)}) &nbsp;·&nbsp; `,
          `점 (${fmt(start.x, 2)}, ${fmt(start.y, 2)}) &nbsp;·&nbsp; ∇f = (${fmt(g[0], 2)}, ${fmt(g[1], 2)}) &nbsp;·&nbsp; `) +
        `${dot(C.red, tr('−∇f (steepest-descent direction)', '−∇f (최급강하 방향)'))} ` +
        tr(`— <strong>always orthogonal to the contours</strong>.<br>`, `— <strong>언제나 등고선과 직교</strong>합니다.<br>`) +
        tr(`anisotropy = ${fmt(aniso, 1)} (condition number κ ≈ ${fmt(kappa, 1)}) &nbsp;·&nbsp; `,
          `이방성 = ${fmt(aniso, 1)} (조건수 κ ≈ ${fmt(kappa, 1)}) &nbsp;·&nbsp; `) +
        (path.length ? tr(`after ${path.length} steps f = ${fmt(f(start.x, start.y), 5)} &nbsp;·&nbsp; `,
          `${path.length}걸음 후 f = ${fmt(f(start.x, start.y), 5)} &nbsp;·&nbsp; `) : '') +
        (aniso > 6
          ? tr('<strong>You can see the zigzag.</strong> In a long narrow valley −∇f bounces toward the walls rather than the floor — the reason momentum and Adam exist.',
            '<strong>지그재그가 보입니다.</strong> 길쭉한 골짜기에서는 −∇f가 바닥이 아니라 벽을 향해 튕깁니다 — 모멘텀과 Adam이 존재하는 이유입니다.')
          : tr('Raise the anisotropy to make the valley long and narrow.',
            '이방성을 키워 골짜기를 길쭉하게 만들어보세요.')));
    }
    draggablePoint(ch, start, () => { path = []; render(); });
    slider('grad-aniso', (v) => { aniso = v; path = []; render(); },
      (v) => fmt(v, 1))._emit();
    slider('grad-eta', (v) => { eta = v; render(); })._emit();
    const run = document.getElementById('grad-run');
    if (run) run.addEventListener('click', () => {
      path = [[start.x, start.y]];
      let p = [start.x, start.y];
      for (let i = 0; i < 120; i++) {
        const g = Calc.grad2(f, p[0], p[1]);
        p = [p[0] - eta * g[0], p[1] - eta * g[1]];
        if (!Number.isFinite(p[0]) || Math.hypot(p[0], p[1]) > 20) break;
        path.push(p.slice());
        if (Math.hypot(g[0], g[1]) < 1e-3) break;
      }
      start.x = path[path.length - 1][0];
      start.y = path[path.length - 1][1];
      render();
    });
  })();

  /* ------------------------------------------------------------ 9. jacobian */

  (function jacobian() {
    const MAPS = {
      polar: { F: (x, y) => [x * x - y * y, 2 * x * y], label: 'F(x,y) = (x² − y², 2xy)' },
      shear: { F: (x, y) => [x + 0.8 * y, y + 0.3 * x * x], label: 'F(x,y) = (x + 0.8y, y + 0.3x²)' },
      fold: { F: (x, y) => [x * x - 1.2, y], label: tr('F(x,y) = (x² − 1.2, y)  — folds at x=0', 'F(x,y) = (x² − 1.2, y)  — x=0에서 접힌다') },
    };
    let kind = 'polar';
    const pt = { x: 0.8, y: 0.5 };
    const chIn = chart('c-jacobian-in', { xMin: -2, xMax: 2, yMin: -2, yMax: 2 }, render);
    const chOut = chart('c-jacobian-out', { xMin: -4, xMax: 4, yMin: -4, yMax: 4 }, render);
    if (!chIn) return;

    function render() {
      const { F, label } = MAPS[kind];
      chIn.fit().clear();
      chIn.axes({ xLabel: 'x', yLabel: 'y' });
      // Input grid plus the little square whose image we track.
      const e = 0.22;
      const sq = [[pt.x - e, pt.y - e], [pt.x + e, pt.y - e], [pt.x + e, pt.y + e], [pt.x - e, pt.y + e], [pt.x - e, pt.y - e]];
      chIn.curve(sq, { color: C.orange, width: 2 });
      chIn.points([[pt.x, pt.y]], { color: '#111', r: 4.5 });

      chOut.fit().clear();
      // Image of the input grid — the warped coordinate lines.
      for (let k = -4; k <= 4; k++) {
        const t = k / 2;
        chOut.curve(Array.from({ length: 60 }, (_, i) => {
          const u = -2 + (i / 59) * 4; return F(u, t);
        }), { color: 'rgba(180,180,180,.7)', width: 1 });
        chOut.curve(Array.from({ length: 60 }, (_, i) => {
          const u = -2 + (i / 59) * 4; return F(t, u);
        }), { color: 'rgba(180,180,180,.7)', width: 1 });
      }
      chOut.axes({ grid: false, xLabel: 'u', yLabel: 'v' });
      chOut.curve(sq.map(([a, b]) => F(a, b)), { color: C.orange, width: 2 });
      chOut.points([F(pt.x, pt.y)], { color: '#111', r: 4.5 });

      const J = Calc.jacobian2(F, pt.x, pt.y);
      const det = LA.det2(J);
      say('r-jacobian',
        `${label} &nbsp;·&nbsp; ` + tr(`point (${fmt(pt.x, 2)}, ${fmt(pt.y, 2)})<br>`, `점 (${fmt(pt.x, 2)}, ${fmt(pt.y, 2)})<br>`) +
        `J = [[${fmt(J[0], 2)}, ${fmt(J[1], 2)}], [${fmt(J[2], 2)}, ${fmt(J[3], 2)}]] &nbsp;·&nbsp; ` +
        tr(`<strong>det J = ${fmt(det, 3)}</strong> — the orange square's area becomes <strong>${fmt(Math.abs(det), 2)}×</strong>.<br>`,
          `<strong>det J = ${fmt(det, 3)}</strong> — 주황 정사각형의 넓이가 <strong>${fmt(Math.abs(det), 2)}배</strong>가 됩니다.<br>`) +
        (Math.abs(det) < 0.12
          ? tr('<strong>det J ≈ 0</strong> — the dimension collapses locally and the square flattens. No inverse function exists here.',
            '<strong>det J ≈ 0</strong> — 국소적으로 차원이 무너져 정사각형이 납작해집니다. 여기서는 역함수가 존재하지 않습니다.')
          : det < 0
            ? tr('<strong>det J < 0</strong> — the orientation has flipped (a mirror image).',
              '<strong>det J < 0</strong> — 방향이 뒤집혔습니다(거울상).')
            : tr('This area change is exactly how the density thins by |det J| in a normalizing flow.',
              '정규화 흐름에서 밀도가 |det J|만큼 묽어지는 것이 정확히 이 넓이 변화입니다.')));
    }
    presetGroup('jac-presets', ({ map }) => { kind = map; render(); });
    draggablePoint(chIn, pt, render);
    render();
  })();

  /* ------------------------------------------------------------- 10. hessian */

  (function hessian() {
    const SURFS = {
      bowl: { f: (x, y) => 0.5 * (x * x + 0.8 * y * y), label: 'f = ½(x² + 0.8y²)' },
      saddle: { f: (x, y) => 0.5 * (x * x - y * y), label: 'f = ½(x² − y²)' },
      valley: { f: (x, y) => 0.5 * (0.06 * x * x + 3 * y * y), label: 'f = ½(0.06x² + 3y²)' },
      wavy: { f: (x, y) => Math.sin(1.3 * x) * Math.cos(1.2 * y) + 0.15 * (x * x + y * y), label: 'f = sin(1.3x)cos(1.2y) + 0.15(x²+y²)' },
    };
    let kind = 'bowl';
    const pt = { x: 1.1, y: 0.8 };
    const ch = chart('c-hessian', { xMin: -3, xMax: 3, yMin: -2.4, yMax: 2.4 }, render);
    if (!ch) return;

    function render() {
      const { f, label } = SURFS[kind];
      ch.fit().clear();
      ch.heat(f, { res: 4, alpha: 0.6 });
      ch.contour(f, [-1.5, -1, -0.5, -0.2, 0.2, 0.5, 1, 1.6, 2.4, 3.4], { color: 'rgba(40,40,40,.32)' });
      ch.axes({ grid: false, xLabel: 'x', yLabel: 'y' });

      const H = Calc.hessian2(f, pt.x, pt.y);
      const eig = LA.eig2(H);
      if (eig) {
        const [v1, v2] = eig.vectors;
        const [l1, l2] = eig.values;
        // Eigenvector axes, scaled so the more curved direction reads as shorter.
        const s = 1.0;
        ch.curve([[pt.x - v1[0] * s, pt.y - v1[1] * s], [pt.x + v1[0] * s, pt.y + v1[1] * s]],
          { color: C.red, width: 2.6 });
        ch.curve([[pt.x - v2[0] * s, pt.y - v2[1] * s], [pt.x + v2[0] * s, pt.y + v2[1] * s]],
          { color: C.violet, width: 2.6 });
        ch.points([[pt.x, pt.y]], { color: '#111', r: 5 });

        const kappa = Math.abs(l2) > 1e-9 ? Math.abs(l1 / l2) : Infinity;
        const kind2 = (l1 > 1e-6 && l2 > 1e-6)
          ? tr('<strong>local minimum</strong> (curving upward in every direction)', '<strong>국소 최소</strong> (모든 방향으로 위로 휘어짐)')
          : (l1 < -1e-6 && l2 < -1e-6) ? tr('<strong>local maximum</strong>', '<strong>국소 최대</strong>')
          : (l1 * l2 < -1e-12)
            ? tr('<strong>saddle point</strong> — one direction rises while the other falls',
              '<strong>안장점</strong> — 한 방향은 올라가고 다른 방향은 내려갑니다')
            : tr('<strong>degenerate</strong> — one eigenvalue is 0, so second-order information alone cannot decide',
              '<strong>퇴화</strong> — 고유값 하나가 0이라 2차 정보만으로는 판정할 수 없습니다');
        say('r-hessian',
          `${label} &nbsp;·&nbsp; ` + tr(`point (${fmt(pt.x, 2)}, ${fmt(pt.y, 2)})<br>`, `점 (${fmt(pt.x, 2)}, ${fmt(pt.y, 2)})<br>`) +
          `H = [[${fmt(H[0], 2)}, ${fmt(H[1], 2)}], [${fmt(H[2], 2)}, ${fmt(H[3], 2)}]] &nbsp;·&nbsp; ` +
          `${dot(C.red, `λ₁ = ${fmt(l1, 3)}`)} &nbsp; ${dot(C.violet, `λ₂ = ${fmt(l2, 3)}`)}<br>` +
          `${kind2} &nbsp;·&nbsp; ` +
          tr(`condition number κ = ${Number.isFinite(kappa) ? fmt(Math.max(kappa, 1 / kappa), 1) : '∞'}`,
            `조건수 κ = ${Number.isFinite(kappa) ? fmt(Math.max(kappa, 1 / kappa), 1) : '∞'}`) +
          (Math.max(kappa, 1 / kappa) > 10
            ? tr(' — <strong>a large κ elongates the contours and slows gradient descent.</strong>',
              ' — <strong>κ가 크면 등고선이 길쭉해지고 경사하강이 느려집니다.</strong>')
            : ''));
      }
    }
    presetGroup('hess-presets', ({ surf }) => { kind = surf; render(); });
    draggablePoint(ch, pt, render);
    render();
  })();

  /* --------------------------------------------------------- 11. vector field */

  (function vectorField() {
    const POT = (x, y) => 0.5 * (x * x + 0.7 * y * y) - Math.cos(1.4 * x);
    const FIELDS = {
      grad: { F: (x, y) => { const g = Calc.grad2(POT, x, y); return [-g[0], -g[1]]; }, label: tr('−∇f (gradient field)', '−∇f (그래디언트장)') },
      rot: { F: (x, y) => [-y, x], label: tr('F = (−y, x) (rotational field)', 'F = (−y, x) (회전장)') },
      saddle: { F: (x, y) => [x, -y], label: tr('F = (x, −y) (saddle)', 'F = (x, −y) (안장)') },
      spiral: { F: (x, y) => [-y - 0.28 * x, x - 0.28 * y], label: tr('F = (−y − 0.28x, x − 0.28y) (spiral)', 'F = (−y − 0.28x, x − 0.28y) (나선)') },
    };
    let kind = 'grad';
    let seeds = [];
    const ch = chart('c-vectorfield', { xMin: -3, xMax: 3, yMin: -2.4, yMax: 2.4 }, render);
    if (!ch) return;

    function render() {
      const { F, label } = FIELDS[kind];
      ch.fit().clear();
      if (kind === 'grad') {
        ch.contour(POT, [-0.5, 0, 0.6, 1.3, 2.2, 3.2, 4.5], { color: 'rgba(40,40,40,.28)' });
      }
      ch.quiver(F, { nx: 17, ny: 14, scaled: true });
      ch.axes({ grid: false, xLabel: 'x', yLabel: 'y' });
      seeds.forEach((s) => {
        const path = Calc.streamline(F, s, { dt: 0.03, steps: 300, bounds: [ch.xMin, ch.xMax, ch.yMin, ch.yMax] });
        if (path.length > 1) ch.curve(path, { color: C.orange, width: 2 });
        ch.points([s], { color: C.orange, r: 4 });
      });
      say('r-vectorfield',
        `${label} &nbsp;·&nbsp; ` +
        tr(`${seeds.length} streamlines &nbsp;·&nbsp; click the figure to draw the streamline starting there.<br>`,
          `흐름선 ${seeds.length}개 &nbsp;·&nbsp; 그림을 클릭하면 그 점에서 출발하는 흐름선이 그려집니다.<br>`) +
        (kind === 'grad'
          ? tr('<strong>Conservative field</strong> — the streamlines cross the contours and must converge to a minimum. This is why gradient descent does not spin in circles.',
            '<strong>보존장</strong> — 흐름선이 등고선을 가로지르며 반드시 최소점으로 수렴합니다. 경사하강이 빙빙 돌지 않는 이유입니다.')
          : kind === 'rot'
            ? tr('<strong>Non-conservative field</strong> — it cannot be written as the gradient of any scalar function, so the streamlines circle forever. The same structure as oscillating GAN training.',
              '<strong>비보존장</strong> — 어떤 스칼라 함수의 그래디언트로도 쓸 수 없어 흐름선이 영원히 맴돕니다. GAN 학습이 진동하는 상황과 같은 구조입니다.')
            : kind === 'saddle'
              ? tr('Pushed away along one axis and pulled in along the other — the typical flow around a saddle point.',
                '한 축으로는 밀려나고 다른 축으로는 끌려옵니다 — 안장점 주변의 전형적인 흐름입니다.')
              : tr('A convergent component mixed into the rotation winds it inward.',
                '회전에 수렴 성분이 섞여 안쪽으로 감겨 들어갑니다.')));
    }
    presetGroup('vf-presets', ({ field }) => { kind = field; seeds = []; render(); });
    ch.canvas.style.cursor = 'crosshair';
    ch.canvas.addEventListener('click', (e) => {
      const [x, y] = ch.eventXY(e);
      if (seeds.length >= 8) seeds.shift();
      seeds.push([x, y]);
      render();
    });
    const clr = document.getElementById('vf-clear');
    if (clr) clr.addEventListener('click', () => { seeds = []; render(); });
    render();
  })();

  /* ---------------------------------------------------------- 12. divergence */

  (function divergence() {
    // A localized radial blob: outward when amp > 0 (a source), inward when
    // amp < 0 (a sink). Putting one of each side by side is what makes the
    // red/blue contrast in the divergence background legible.
    const blob = (x, y, cx, cy, amp) => {
      const dx = x - cx, dy = y - cy;
      const w = Math.exp(-(dx * dx + dy * dy) / 1.1);
      return [amp * dx * w, amp * dy * w];
    };
    const FIELDS = {
      source: {
        F: (x, y) => {
          const a = blob(x, y, -1.35, 0, 1.6);   // source on the left
          const b = blob(x, y, 1.35, 0, -1.6);   // sink on the right
          return [a[0] + b[0], a[1] + b[1]];
        },
        label: tr('F = one source on the left + one sink on the right', 'F = 왼쪽에 샘 하나 + 오른쪽에 싱크 하나'),
      },
      rot: { F: (x, y) => [-y, x], label: tr('F = (−y, x)  — it rotates, yet the divergence is 0 everywhere', 'F = (−y, x)  — 회전하지만 발산은 어디서나 0') },
      shear: { F: (x, y) => [y, 0], label: tr('F = (y, 0)  — shear, divergence 0', 'F = (y, 0)  — 전단, 발산 0') },
      mixed: { F: (x, y) => [Math.sin(x) - 0.4 * y, Math.cos(0.9 * y) + 0.3 * x], label: 'F = (sin x − 0.4y, cos 0.9y + 0.3x)' },
    };
    let kind = 'source';
    const pt = { x: 1.0, y: 0.5 };
    const ch = chart('c-divergence', { xMin: -3, xMax: 3, yMin: -2.4, yMax: 2.4 }, render);
    if (!ch) return;

    function render() {
      const { F, label } = FIELDS[kind];
      const div = (x, y) => Calc.divergence2(F, x, y);
      ch.fit().clear();
      ch.heat(div, { res: 4, alpha: 0.75 });
      ch.quiver(F, { nx: 16, ny: 13, scaled: true, color: 'rgba(30,30,30,.55)' });
      ch.axes({ grid: false, xLabel: 'x', yLabel: 'y' });

      // A little circle of tracer particles, advected one short step, so the
      // reader sees the volume change that the divergence number reports.
      const r = 0.32, dt = 0.35;
      const ring = [], moved = [];
      for (let i = 0; i <= 48; i++) {
        const th = (i / 48) * Math.PI * 2;
        const p = [pt.x + r * Math.cos(th), pt.y + r * Math.sin(th)];
        ring.push(p);
        const [u, v] = F(p[0], p[1]);
        moved.push([p[0] + u * dt, p[1] + v * dt]);
      }
      ch.curve(ring, { color: '#111', width: 1.6, dash: [3, 3] });
      ch.curve(moved, { color: C.green, width: 2.2 });
      ch.points([[pt.x, pt.y]], { color: '#111', r: 4.5 });

      const d = div(pt.x, pt.y);
      const J = Calc.jacobian2(F, pt.x, pt.y);
      say('r-divergence',
        `${label}<br>` + tr(`point (${fmt(pt.x, 2)}, ${fmt(pt.y, 2)}) &nbsp;·&nbsp; `, `점 (${fmt(pt.x, 2)}, ${fmt(pt.y, 2)}) &nbsp;·&nbsp; `) +
        `∂F₁/∂x = ${fmt(J[0], 3)}, ∂F₂/∂y = ${fmt(J[3], 3)} &nbsp;→&nbsp; <strong>∇·F = ${fmt(d, 3)}</strong> &nbsp;·&nbsp; ` +
        tr(`curl ∇×F = ${fmt(Calc.curl2(F, pt.x, pt.y), 3)}<br>`, `회전 ∇×F = ${fmt(Calc.curl2(F, pt.x, pt.y), 3)}<br>`) +
        `${dot('#111', tr('dashed = the original circle', '점선 = 원래 원'))} → ` +
        `${dot(C.green, tr('green = after flowing one step', '초록 = 한 걸음 흘러간 뒤'))} &nbsp;·&nbsp; ` +
        (Math.abs(d) < 0.05
          ? tr('<strong>Divergence ≈ 0</strong> — the area is preserved. In a rotational field the arrows spin fiercely and yet the divergence is 0. <em>Rotation and divergence measure different things.</em>',
            '<strong>발산 ≈ 0</strong> — 넓이가 보존됩니다. 회전장은 화살표가 격렬히 도는데도 발산이 0입니다. <em>회전과 발산은 서로 다른 것을 잽니다.</em>')
          : d > 0
            ? tr('<strong>Divergence &gt; 0 (source)</strong> — the circle grows. Flow wells up at this point.',
              '<strong>발산 > 0 (샘)</strong> — 원이 커집니다. 흐름이 이 점에서 솟아납니다.')
            : tr('<strong>Divergence &lt; 0 (sink)</strong> — the circle shrinks. Flow is drawn into this point.',
              '<strong>발산 < 0 (싱크)</strong> — 원이 작아집니다. 흐름이 이 점으로 빨려 들어갑니다.')));
    }
    presetGroup('div-presets', ({ field }) => { kind = field; render(); });
    draggablePoint(ch, pt, render);
    render();
  })();

  /* ---------------------------------------------------------- 13. laplacian */

  (function laplacian() {
    // Initial temperature field; diffusion is applied as Gaussian smoothing,
    // which is the exact solution of the heat equation on the whole plane.
    const u0 = (x, y) =>
      1.4 * Math.exp(-((x - 1.1) ** 2 + (y - 0.6) ** 2) / 0.35)
      - 1.1 * Math.exp(-((x + 1.2) ** 2 + (y + 0.5) ** 2) / 0.4)
      + 0.7 * Math.exp(-((x + 0.9) ** 2 + (y - 1.0) ** 2) / 0.5);
    let t = 0;

    // Smoothing the *widths* of the Gaussians reproduces heat-equation evolution
    // in closed form: a Gaussian of variance s spreads to variance s + 4αt.
    const uAt = (time) => {
      const k = 1 + 5.5 * time;
      return (x, y) =>
        (1.4 / k) * Math.exp(-((x - 1.1) ** 2 + (y - 0.6) ** 2) / (0.35 * k))
        - (1.1 / k) * Math.exp(-((x + 1.2) ** 2 + (y + 0.5) ** 2) / (0.4 * k))
        + (0.7 / k) * Math.exp(-((x + 0.9) ** 2 + (y - 1.0) ** 2) / (0.5 * k));
    };

    const ch = chart('c-laplacian', { xMin: -3, xMax: 3, yMin: -2.2, yMax: 2.2 }, render);
    const chS = chart('c-laplacian-slice', { xMin: -3, xMax: 3, yMin: -1.4, yMax: 1.6 }, render);
    if (!ch) return;

    function render() {
      const u = uAt(t);
      const lap = (x, y) => Calc.laplacian2(u, x, y, 0.02);
      ch.fit().clear();
      ch.heat(lap, { res: 4, alpha: 0.8 });
      ch.contour(u, [-0.8, -0.5, -0.25, -0.08, 0.08, 0.25, 0.5, 0.8, 1.1], { color: 'rgba(30,30,30,.45)' });
      ch.axes({ grid: false, xLabel: 'x', yLabel: 'y' });

      if (chS) {
        chS.fit().clear();
        chS.axes({ xLabel: tr('x (cross-section at y = 0.6)', 'x (y = 0.6 단면)'), yLabel: 'u' });
        chS.curve((x) => u0(x, 0.6), { color: 'rgba(140,140,140,.85)', width: 1.6, dash: [4, 3] });
        chS.curve((x) => u(x, 0.6), { color: C.blue, width: 2.4 });
        chS.hline(0, { color: C.muted, dash: [2, 3] });
      }
      // How flat has it got? Peak-to-trough on the slice is a legible proxy.
      let hi = -Infinity, lo = Infinity;
      for (let i = 0; i <= 200; i++) {
        const x = -3 + (i / 200) * 6;
        const v = u(x, 0.6);
        hi = Math.max(hi, v); lo = Math.min(lo, v);
      }
      say('r-laplacian',
        tr(`diffusion time t = ${fmt(t, 2)} &nbsp;·&nbsp; max−min of the cross-section = ${fmt(hi - lo, 3)}<br>`,
          `확산 시간 t = ${fmt(t, 2)} &nbsp;·&nbsp; 단면의 최고−최저 = ${fmt(hi - lo, 3)}<br>`) +
        tr(`background = Δu &nbsp;·&nbsp; `, `배경색 = Δu &nbsp;·&nbsp; `) +
        `${dot('rgb(255,105,65)', tr('red: Δu &lt; 0, a bump above its surroundings → to be shaved away',
          '빨강: Δu < 0, 주변보다 높은 봉우리 → 앞으로 깎임'))} &nbsp; ` +
        `${dot('rgb(45,125,255)', tr('blue: Δu &gt; 0, a dip below its surroundings → to be filled in',
          '파랑: Δu > 0, 주변보다 낮은 골 → 앞으로 채워짐'))}<br>` +
        (t < 0.02
          ? tr('∂u/∂t = αΔu — the sharper the bumps and dips, the larger |Δu| and the faster the change. Press "Play diffusion".',
            '∂u/∂t = αΔu — 봉우리와 골이 뚜렷할수록 |Δu|가 크고 변화가 빠릅니다. "확산 재생"을 눌러보세요.')
          : t > 0.9
            ? tr('<strong>Almost completely flat.</strong> Diffusion erases every structure — the forward process of a diffusion model turning data into Gaussian noise is exactly this smoothing.',
              '<strong>거의 평평해졌습니다.</strong> 확산은 모든 구조를 지웁니다 — 확산 모델의 순방향 과정이 데이터를 가우시안 노이즈로 만드는 것이 바로 이 평활화입니다.')
            : tr('The bumps collapse first and the dips fill in — the rate of change is exactly proportional to the magnitude of the Laplacian.',
              '봉우리가 먼저 무너지고 골이 메워집니다 — 변화 속도가 라플라시안의 크기에 정확히 비례합니다.')));
    }
    const sl = slider('lap-t', (v) => { t = v; render(); });
    const play = document.getElementById('lap-play');
    if (play) play.addEventListener('click', () => {
      const t0 = performance.now();
      const step = (now) => {
        t = clamp((now - t0) / 3000, 0, 1);
        sl.value = String(t);
        sl._emit();
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    sl._emit();
  })();
})();
