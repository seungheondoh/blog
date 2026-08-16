/*
 * Wires up the differential equations demos. Built on Chart2D
 * (js/prob-engine.js), the numeric calculus + field drawing in
 * js/calc-engine.js, and LA's eig2 from js/engine.js.
 *
 * The stochastic sections all draw from a seeded RNG so that dragging a slider
 * re-renders the *same* sample paths rather than reshuffling them — otherwise
 * every parameter change would look like noise rather than an effect.
 */
(function () {
  const { LA, RNG, Chart2D, Calc, PROB_COLORS: C } = window;
  const isEnglish = document.documentElement.lang === 'en';
  // Readout copy is generated at run time, so it cannot go through the build's
  // translation table the way the static markup does. `tx` picks the language.
  // (Named `tx` rather than `tr`, which is used locally for a matrix trace.)
  const tx = (en, ko) => (isEnglish ? en : ko);

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
      ? 'Interactive differential equations diagram'
      : '미분방정식 개념을 조작하며 살펴보는 인터랙티브 도식');
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

  // Animates a slider from 0 to 1 over `ms`, driving whatever it is bound to.
  function playback(sl, ms = 2600, from = 0, to = 1) {
    if (!sl || !sl.addEventListener) return;
    const t0 = performance.now();
    const step = (now) => {
      const k = clamp((now - t0) / ms, 0, 1);
      sl.value = String(from + (to - from) * k);
      sl._emit();
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

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
    canvas.addEventListener('pointerdown', (e) => { dragging = true; canvas.setPointerCapture(e.pointerId); set(e); });
    canvas.addEventListener('pointermove', (e) => { if (dragging) set(e); });
    ['pointerup', 'pointercancel'].forEach((ev) => canvas.addEventListener(ev, () => { dragging = false; }));
  }

  // Draws a direction field for a scalar ODE dx/dt = f(t, x) on a t–x chart.
  function slopeField(ch, f, opts = {}) {
    const nt = opts.nt ?? 22, nx = opts.nx ?? 16;
    const ctx = ch.ctx;
    ctx.save();
    ctx.strokeStyle = opts.color || 'rgba(90,90,90,.45)';
    ctx.lineWidth = 1.2;
    const len = Math.min(ch.plotW / nt, ch.plotH / nx) * 0.72;
    for (let i = 0; i < nt; i++) {
      for (let j = 0; j < nx; j++) {
        const t = ch.xMin + ((i + 0.5) / nt) * (ch.xMax - ch.xMin);
        const x = ch.yMin + ((j + 0.5) / nx) * (ch.yMax - ch.yMin);
        const s = f(t, x);
        if (!Number.isFinite(s)) continue;
        // Slope is dx/dt in data units; convert to pixels before normalizing.
        const sx = ch.plotW / (ch.xMax - ch.xMin);
        const sy = ch.plotH / (ch.yMax - ch.yMin);
        let dx = 1, dy = -s * (sy / sx);
        const m = Math.hypot(dx, dy);
        dx = (dx / m) * len / 2; dy = (dy / m) * len / 2;
        const px = ch.px(t), py = ch.py(x);
        ctx.beginPath();
        ctx.moveTo(px - dx, py - dy);
        ctx.lineTo(px + dx, py + dy);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Histogram of samples, returned as Chart2D bar items scaled to a density.
  function densityBars(samples, lo, hi, bins = 46) {
    const w = (hi - lo) / bins;
    const counts = new Array(bins).fill(0);
    for (const v of samples) {
      const i = Math.floor((v - lo) / w);
      if (i >= 0 && i < bins) counts[i]++;
    }
    const scale = 1 / (samples.length * w || 1);
    return counts.map((c, i) => ({ lo: lo + i * w, hi: lo + (i + 1) * w, value: c * scale }));
  }

  const gaussPdf = (x, mu, s) => Math.exp(-((x - mu) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));

  /* ------------------------------------------------------- 14. random walk */

  (function randomWalk() {
    let nPaths = 30, nSteps = 100, seed = 3;
    const ch = chart('c-randomwalk', { xMin: 0, xMax: 100, yMin: -30, yMax: 30 }, render);
    if (!ch) return;

    function render() {
      const rng = RNG(seed);
      const paths = [];
      const ends = [];
      for (let p = 0; p < nPaths; p++) {
        const path = [[0, 0]];
        let s = 0;
        for (let i = 1; i <= nSteps; i++) { s += rng.uniform() < 0.5 ? -1 : 1; path.push([i, s]); }
        paths.push(path);
        ends.push(s);
      }
      const lim = Math.max(12, 3.2 * Math.sqrt(nSteps));
      ch.fit().clear();
      ch.setX(0, nSteps * 1.32).setY(-lim, lim);
      ch.axes({ xLabel: tx('n (steps)', 'n (걸음)'), yLabel: 'Sₙ' });
      paths.forEach((p, i) => ch.curve(p, {
        color: `hsla(${(i * 47) % 360},60%,45%,${nPaths > 80 ? 0.16 : 0.5})`, width: 1,
      }));
      // ±√n envelope: the signature of diffusion.
      ch.curve(Array.from({ length: 80 }, (_, i) => { const n = (i / 79) * nSteps; return [n, Math.sqrt(n)]; }),
        { color: '#555', width: 1.8, dash: [5, 3] });
      ch.curve(Array.from({ length: 80 }, (_, i) => { const n = (i / 79) * nSteps; return [n, -Math.sqrt(n)]; }),
        { color: '#555', width: 1.8, dash: [5, 3] });

      // End-point histogram, drawn sideways in the right margin.
      const bins = densityBars(ends, -lim, lim, 30);
      const maxV = Math.max(...bins.map((b) => b.value), 1e-9);
      const x0 = nSteps * 1.02, w = nSteps * 0.28;
      ch.ctx.save();
      ch.ctx.fillStyle = 'rgba(249,115,22,.35)';
      bins.forEach((b) => {
        const y0 = ch.py(b.lo), y1 = ch.py(b.hi);
        ch.ctx.fillRect(ch.px(x0), y1, (b.value / maxV) * (ch.px(x0 + w) - ch.px(x0)), y0 - y1);
      });
      ch.ctx.restore();
      ch.curve(Array.from({ length: 60 }, (_, i) => {
        const y = -lim + (i / 59) * 2 * lim;
        return [x0 + (gaussPdf(y, 0, Math.sqrt(nSteps)) / maxV) * w, y];
      }), { color: C.red, width: 1.8 });

      const sd = Math.sqrt(ends.reduce((s, v) => s + v * v, 0) / Math.max(1, ends.length));
      say('r-randomwalk',
        tx(`${nPaths} paths · ${nSteps} steps &nbsp;·&nbsp; endpoint standard deviation = <strong>${fmt(sd, 2)}</strong> &nbsp;·&nbsp; `,
          `경로 ${nPaths}개 · 걸음 ${nSteps}회 &nbsp;·&nbsp; 끝점 표준편차 = <strong>${fmt(sd, 2)}</strong> &nbsp;·&nbsp; `) +
        tx(`theory √n = <strong>${fmt(Math.sqrt(nSteps), 2)}</strong><br>`, `이론값 √n = <strong>${fmt(Math.sqrt(nSteps), 2)}</strong><br>`) +
        `${dot('#555', tx('±√n envelope', '±√n 포락선'))} &nbsp; ${dot(C.red, tx('Gaussian', '가우시안'))} — ` +
        tx(`the distance grows in proportion to <strong>the square root of time</strong>, not to time. `,
          `거리가 시간이 아니라 <strong>시간의 제곱근</strong>에 비례해 자랍니다. `) +
        tx(`That the endpoint distribution becomes a smooth bell despite starting from crude discrete ±1 steps is the central limit theorem.`,
          `끝점 분포가 ±1이라는 거친 이산 걸음에서 출발했는데도 매끄러운 종 모양이 되는 것이 중심극한정리입니다.`));
    }
    slider('rw-n', (v) => { nPaths = Math.round(v); render(); }, (v) => String(Math.round(v)))._emit();
    slider('rw-s', (v) => { nSteps = Math.round(v); render(); }, (v) => String(Math.round(v)))._emit();
    const btn = document.getElementById('rw-reseed');
    if (btn) btn.addEventListener('click', () => { seed = (seed * 1664525 + 1013904223) >>> 0; render(); });
  })();

  /* --------------------------------------------------- 15. gaussian noise */

  (function gaussianNoise() {
    let k = 1, totalVar = 1;
    const ch = chart('c-gaussiannoise', { xMin: -5, xMax: 5, yMin: 0, yMax: 1 }, render);
    if (!ch) return;
    const rng0 = RNG(29);
    const M = 6000;
    const draws = Array.from({ length: M * 40 }, () => rng0.normal());

    function render() {
      // Add the same total variance in k independent steps.
      const per = Math.sqrt(totalVar / k);
      const xs = new Array(M).fill(0);
      for (let i = 0; i < M; i++) {
        let s = 0;
        for (let j = 0; j < k; j++) s += per * draws[i * 40 + (j % 40)];
        xs[i] = s;
      }
      const sd = Math.sqrt(xs.reduce((s, v) => s + v * v, 0) / M);
      ch.fit().clear();
      ch.setY(0, 0.75);
      ch.axes({ xLabel: 'x', yLabel: 'density' });
      ch.bars(densityBars(xs, -5, 5, 60), { color: 'rgba(249,115,22,.28)', stroke: 'rgba(249,115,22,.55)' });
      ch.curve((x) => gaussPdf(x, 0, Math.sqrt(totalVar)), { color: '#555', width: 2.4 });
      say('r-gaussiannoise',
        tx(`added in ${k} instalments (variance ${fmt(totalVar / k, 4)} per stage) &nbsp;·&nbsp; `,
          `${k}번에 나눠 더함 (각 단계 분산 ${fmt(totalVar / k, 4)}) &nbsp;·&nbsp; `) +
        tx(`sample standard deviation = ${fmt(sd, 3)} &nbsp;·&nbsp; theory √(total variance) = <strong>${fmt(Math.sqrt(totalVar), 3)}</strong><br>`,
          `표본 표준편차 = ${fmt(sd, 3)} &nbsp;·&nbsp; 이론값 √(총 분산) = <strong>${fmt(Math.sqrt(totalVar), 3)}</strong><br>`) +
        `${dot('#555', tx('added at once', '한 번에 더한 분포'))} vs ${dot(C.orange, tx(`added in ${k} instalments`, `${k}번에 나눠 더한 분포`))} — ` +
        tx(`<strong>they overlap.</strong> `, `<strong>겹칩니다.</strong> `) +
        tx(`Because the sum of Gaussians is Gaussian and only the variances add. `,
          `가우시안은 더해도 가우시안이고 분산만 합해지기 때문입니다. `) +
        tx(`This property is what lets a diffusion model sample an arbitrary x_t from x₀ <strong>in one step, with no intermediate stages</strong>.`,
          `확산 모델이 x₀에서 임의의 x_t를 <strong>중간 단계 없이 한 번에</strong> 샘플링할 수 있는 근거가 이 성질입니다.`));
    }
    slider('gn-k', (v) => { k = Math.round(v); render(); }, (v) => String(Math.round(v)))._emit();
    slider('gn-v', (v) => { totalVar = v; render(); })._emit();
  })();

  /* ------------------------------------------------------- 16. brownian */

  (function brownian() {
    let zoom = 0, seed = 41;
    const ch = chart('c-brownian', { xMin: 0, xMax: 1, yMin: -2, yMax: 2 }, render);
    if (!ch) return;
    const NSTEP = 20000;

    function paths(rng, n) {
      const out = [];
      for (let p = 0; p < n; p++) {
        const dt = 1 / NSTEP, sd = Math.sqrt(dt);
        const arr = new Float64Array(NSTEP + 1);
        for (let i = 1; i <= NSTEP; i++) arr[i] = arr[i - 1] + sd * rng.normal();
        out.push(arr);
      }
      return out;
    }

    function render() {
      const rng = RNG(seed);
      const ps = paths(rng, 6);
      const z = Math.pow(10, zoom);
      const span = 1 / z;
      ch.fit().clear();
      ch.setX(0, span).setY(-2.2 / Math.sqrt(z), 2.2 / Math.sqrt(z));
      ch.axes({ xLabel: 't', yLabel: 'W' });
      ps.forEach((arr, i) => {
        const pts = [];
        const upto = Math.max(2, Math.round(NSTEP * span));
        const stride = Math.max(1, Math.floor(upto / 900));
        for (let j = 0; j <= upto; j += stride) pts.push([j / NSTEP, arr[j]]);
        ch.curve(pts, { color: `hsla(${(i * 61) % 360},60%,45%,.75)`, width: 1.2 });
      });
      ch.curve(Array.from({ length: 60 }, (_, i) => { const t = (i / 59) * span; return [t, Math.sqrt(t)]; }),
        { color: '#555', width: 1.6, dash: [5, 3] });
      ch.curve(Array.from({ length: 60 }, (_, i) => { const t = (i / 59) * span; return [t, -Math.sqrt(t)]; }),
        { color: '#555', width: 1.6, dash: [5, 3] });
      say('r-brownian',
        tx(`zoom ${fmt(z, 1)}× &nbsp;·&nbsp; visible interval [0, ${fmt(span, 4)}] &nbsp;·&nbsp; `,
          `확대 ${fmt(z, 1)}× &nbsp;·&nbsp; 보이는 구간 [0, ${fmt(span, 4)}] &nbsp;·&nbsp; `) + `${dot('#555', '±√t')}<br>` +
        (zoom > 1.5
          ? tx('<strong>Zooming never makes it smooth.</strong> Rescaling t by z and W by √z together makes the picture look essentially the same as at the start — self-similarity, and visual proof of non-differentiability.',
            '<strong>확대해도 매끄러워지지 않습니다.</strong> 축척을 t는 z배, W는 √z배로 함께 조정했더니 그림이 사실상 처음과 같아 보입니다 — 자기 유사성이며, 미분 불가능성의 시각적 증거입니다.')
          : tx('Raise the zoom slider and peer into part of the path. A smooth curve would look more and more like a straight line as you zoom.',
            '확대 슬라이더를 올려 경로 일부를 들여다보세요. 매끄러운 곡선이라면 확대할수록 직선처럼 보여야 합니다.')));
    }
    slider('bm-zoom', (v) => { zoom = v; render(); }, (v) => fmt(Math.pow(10, v), 1))._emit();
    const btn = document.getElementById('bm-reseed');
    if (btn) btn.addEventListener('click', () => { seed = (seed * 1664525 + 1013904223) >>> 0; render(); });
  })();

  /* -------------------------------------------- 17. stochastic processes */

  (function stochProc() {
    let tCut = 0.5, nPaths = 40;
    const ch = chart('c-stochproc', { xMin: 0, xMax: 1.35, yMin: -2.4, yMax: 2.4 }, render);
    if (!ch) return;
    const rng0 = RNG(53);
    const NS = 400;
    const all = Array.from({ length: 200 }, () => {
      const arr = new Float64Array(NS + 1);
      const sd = Math.sqrt(1 / NS);
      for (let i = 1; i <= NS; i++) arr[i] = arr[i - 1] + sd * rng0.normal();
      return arr;
    });

    function render() {
      ch.fit().clear();
      ch.axes({ xLabel: 't', yLabel: 'Xₜ' });
      const idx = Math.round(tCut * NS);
      const shown = all.slice(0, nPaths);
      shown.forEach((arr, i) => {
        const pts = [];
        for (let j = 0; j <= NS; j += 2) pts.push([j / NS, arr[j]]);
        ch.curve(pts, { color: `hsla(${(i * 37) % 360},55%,48%,${nPaths > 100 ? 0.2 : 0.5})`, width: 1 });
      });
      ch.vline(tCut, { color: '#111', width: 2, dash: [] });
      // The vertical slice as a sideways density in the right margin.
      const vals = all.map((a) => a[idx]);
      const bins = densityBars(vals, -2.4, 2.4, 34);
      const maxV = Math.max(...bins.map((b) => b.value), 1e-9);
      ch.ctx.save();
      ch.ctx.fillStyle = 'rgba(249,115,22,.35)';
      bins.forEach((b) => {
        const y0 = ch.py(b.lo), y1 = ch.py(b.hi);
        ch.ctx.fillRect(ch.px(1.03), y1, (b.value / maxV) * (ch.px(1.32) - ch.px(1.03)), y0 - y1);
      });
      ch.ctx.restore();
      ch.curve(Array.from({ length: 60 }, (_, i) => {
        const y = -2.4 + (i / 59) * 4.8;
        return [1.03 + (gaussPdf(y, 0, Math.sqrt(tCut)) / maxV) * 0.29, y];
      }), { color: C.red, width: 1.8 });
      say('r-stochproc',
        tx(`t = ${fmt(tCut, 2)} &nbsp;·&nbsp; ${nPaths} paths &nbsp;·&nbsp; distribution at that instant: N(0, ${fmt(tCut, 2)}), standard deviation ${fmt(Math.sqrt(tCut), 3)}<br>`,
          `t = ${fmt(tCut, 2)} &nbsp;·&nbsp; 경로 ${nPaths}개 &nbsp;·&nbsp; 그 시각의 분포: N(0, ${fmt(tCut, 2)}), 표준편차 ${fmt(Math.sqrt(tCut), 3)}<br>`) +
        tx(`<strong>Read horizontally</strong> it is one sample path (ω fixed); <strong>cut vertically</strong> it is the random variable at that instant (t fixed). `,
          `<strong>가로로 읽으면</strong> 표본 경로 하나(ω 고정), <strong>세로로 자르면</strong> 그 시각의 확률변수(t 고정)입니다. `) +
        tx(`The orange distribution on the right collects the values on the black vertical line, and it widens as the time grows later.`,
          `오른쪽 주황 분포가 검은 세로선 위의 값들을 모은 것이며, 시각이 늦어질수록 넓어집니다.`));
    }
    slider('sp-t', (v) => { tCut = v; render(); })._emit();
    slider('sp-n', (v) => { nPaths = Math.round(v); render(); }, (v) => String(Math.round(v)))._emit();
  })();

  /* -------------------------------------------------------- 18. markov */

  (function markov() {
    let mode = 'markov', seed = 61;
    const ch = chart('c-markov', { xMin: 0, xMax: 1, yMin: -2.5, yMax: 2.5 }, render);
    if (!ch) return;

    function render() {
      const rng = RNG(seed);
      const NS = 300, dt = 1 / NS, sd = Math.sqrt(dt);
      ch.fit().clear();
      ch.axes({ xLabel: 't', yLabel: 'Xₜ' });
      for (let p = 0; p < 8; p++) {
        const hist = [0];
        const pts = [[0, 0]];
        for (let i = 1; i <= NS; i++) {
          const noise = sd * rng.normal();
          let next;
          if (mode === 'markov') {
            next = hist[hist.length - 1] + noise;
          } else {
            // Pull toward the average of the last 40 steps: needs the history.
            const win = hist.slice(-40);
            const avg = win.reduce((a, b) => a + b, 0) / win.length;
            next = hist[hist.length - 1] + noise + 4 * dt * (avg - hist[hist.length - 1]);
          }
          hist.push(next);
          pts.push([i / NS, next]);
        }
        ch.curve(pts, { color: `hsla(${(p * 43) % 360},58%,48%,.7)`, width: 1.2 });
      }
      say('r-markov',
        `<strong>${mode === 'markov' ? tx('Markov (memoryless)', '마르코프 (기억 없음)')
          : tx('With memory (pulled toward the mean of the last 40 steps)', '기억 있음 (최근 40걸음 평균에 끌림)')}</strong><br>` +
        (mode === 'markov'
          ? tx('The next value is determined by <strong>the current value alone</strong>. The memory needed to simulate is constant, and every step-by-step sampler leans on this property.',
            '다음 값이 <strong>현재 값 하나</strong>로만 결정됩니다. 시뮬레이션에 필요한 메모리가 상수이고, 한 걸음씩 진행하는 모든 샘플러가 이 성질에 기댑니다.')
          : tx('The next value depends on <strong>the past 40 steps</strong>. The path becomes smoother, but simulating it requires carrying the whole history, and a local PDE description such as Fokker–Planck no longer holds.',
            '다음 값이 <strong>과거 40걸음</strong>에 의존합니다. 경로는 매끄러워지지만, 시뮬레이션하려면 이력 전체를 들고 있어야 하고 Fokker–Planck 같은 국소 PDE 기술도 성립하지 않습니다.')));
    }
    presetGroup('markov-presets', ({ mode: m }) => { mode = m; render(); });
    const btn = document.getElementById('markov-reseed');
    if (btn) btn.addEventListener('click', () => { seed = (seed * 1664525 + 1013904223) >>> 0; render(); });
    render();
  })();

  /* -------------------------------------------------- 19. drift & diffusion */

  (function driftDiffusion() {
    let theta = 1.5, sigma = 0.8, seed = 71;
    const ch = chart('c-driftdiff', { xMin: 0, xMax: 3, yMin: -2.5, yMax: 2.5 }, render);
    if (!ch) return;

    function render() {
      const rng = RNG(seed);
      const NS = 600, dt = 3 / NS, sq = Math.sqrt(dt);
      ch.fit().clear();
      ch.axes({ xLabel: 't', yLabel: 'Xₜ' });
      const ends = [];
      for (let p = 0; p < 24; p++) {
        let x = 2;
        const pts = [[0, x]];
        for (let i = 1; i <= NS; i++) {
          x += -theta * x * dt + sigma * sq * rng.normal();
          pts.push([i * dt, x]);
        }
        ends.push(x);
        ch.curve(pts, { color: `hsla(${(p * 41) % 360},55%,48%,.5)`, width: 1 });
      }
      // Deterministic drift-only solution and the stationary ±σ band.
      ch.curve((t) => 2 * Math.exp(-theta * t), { color: '#111', width: 2.4 });
      const statSd = theta > 1e-6 ? sigma / Math.sqrt(2 * theta) : Infinity;
      if (Number.isFinite(statSd)) {
        ch.hline(statSd, { color: C.red, dash: [4, 3], label: tx(`stationary ±σ∞ = ±${fmt(statSd, 2)}`, `정상분포 ±σ∞ = ±${fmt(statSd, 2)}`) });
        ch.hline(-statSd, { color: C.red, dash: [4, 3] });
      }
      say('r-driftdiff',
        tx(`θ = ${fmt(theta, 2)} (drift) &nbsp;·&nbsp; σ = ${fmt(sigma, 2)} (diffusion) &nbsp;·&nbsp; `,
          `θ = ${fmt(theta, 2)} (드리프트) &nbsp;·&nbsp; σ = ${fmt(sigma, 2)} (확산) &nbsp;·&nbsp; `) +
        `dX = −θX dt + σ dW<br>` +
        `${dot('#111', tx('deterministic solution with drift alone, 2e^(−θt)', '드리프트만 있을 때의 결정론적 해 2e^(−θt)'))} &nbsp; ` +
        `${dot(C.red, tx('width of the stationary distribution', '정상분포 폭'))}<br>` +
        (sigma < 0.02 ? tx('<strong>Diffusion is 0, so every path collapses onto the black curve</strong> — it is an ODE.',
            '<strong>확산이 0이라 모든 경로가 검은 곡선으로 붕괴</strong>합니다 — ODE입니다.')
          : theta < 0.02 ? tx('<strong>Drift is 0, so it only spreads with no direction</strong> — it is Brownian motion.',
            '<strong>드리프트가 0이라 방향 없이 퍼지기만</strong> 합니다 — 브라운 운동입니다.')
          : tx(`The two forces balance and the distribution stops at width σ/√(2θ) = <strong>${fmt(statSd, 3)}</strong> (the stationary distribution of the OU process). `,
              `두 힘이 균형을 이뤄 분포가 폭 σ/√(2θ) = <strong>${fmt(statSd, 3)}</strong>에서 멈춥니다(OU 과정의 정상분포). `) +
            tx('The forward process of a diffusion model has this form, so <strong>running it long enough reaches a standard Gaussian whatever the data was</strong>.',
              '확산 모델의 순방향 과정이 이 형태라 <strong>충분히 오래 돌리면 데이터가 무엇이었든 표준 가우시안에 도달</strong>합니다.')));
    }
    slider('dd-th', (v) => { theta = v; render(); })._emit();
    slider('dd-sg', (v) => { sigma = v; render(); })._emit();
    const btn = document.getElementById('dd-reseed');
    if (btn) btn.addEventListener('click', () => { seed = (seed * 1664525 + 1013904223) >>> 0; render(); });
  })();

  /* -------------------------------------------------- 20. what is an SDE */

  (function sdeIntro() {
    let g = 0.6, nPaths = 12, seed = 83;
    const ch = chart('c-sdeintro', { xMin: 0, xMax: 3, yMin: -1, yMax: 2.6 }, render);
    if (!ch) return;
    const f = (x) => 1.4 * x * (1 - x / 1.8);

    function render() {
      const rng = RNG(seed);
      const NS = 600, dt = 3 / NS, sq = Math.sqrt(dt);
      ch.fit().clear();
      ch.axes({ xLabel: 't', yLabel: 'Xₜ' });
      for (let p = 0; p < nPaths; p++) {
        let x = 0.3;
        const pts = [[0, x]];
        for (let i = 1; i <= NS; i++) {
          x += f(x) * dt + g * sq * rng.normal();
          pts.push([i * dt, x]);
        }
        ch.curve(pts, { color: `hsla(${(p * 47) % 360},58%,48%,${nPaths > 30 ? 0.25 : 0.55})`, width: 1 });
      }
      const ode = Calc.integrateODE((t, x) => f(x), 0.3, 0, 3, 0.005, 'rk4');
      ch.curve(ode, { color: '#111', width: 2.6 });
      say('r-sdeintro',
        tx(`dX = f(X) dt + g dW &nbsp;·&nbsp; g = ${fmt(g, 2)} &nbsp;·&nbsp; ${nPaths} paths (all from the same initial value 0.3)<br>`,
          `dX = f(X) dt + g dW &nbsp;·&nbsp; g = ${fmt(g, 2)} &nbsp;·&nbsp; 경로 ${nPaths}개 (모두 같은 초기값 0.3)<br>`) +
        `${dot('#111', 'ODE (g = 0)')} ` +
        tx(`— always the same single curve. The coloured ones are SDE paths and <strong>differ every time.</strong><br>`,
          `— 언제나 같은 곡선 하나. 색색은 SDE 경로이며 <strong>매번 다릅니다.</strong><br>`) +
        (g < 0.02
          ? tx('<strong>With g = 0 every path coincides with the black curve</strong> — meaning an SDE contains an ODE as a special case.',
            '<strong>g = 0이라 모든 경로가 검은 곡선과 겹칩니다</strong> — SDE가 ODE를 특수한 경우로 포함한다는 뜻입니다.')
          : tx('The "solution" of an SDE is not one curve but <strong>a distribution over paths</strong>. So from the next section on we handle the distribution at each time rather than individual paths.',
            'SDE의 "해"는 곡선 하나가 아니라 <strong>경로의 분포</strong>입니다. 그래서 다음 절부터는 개별 경로가 아니라 각 시각의 분포를 다룹니다.')));
    }
    slider('sde-g', (v) => { g = v; render(); })._emit();
    slider('sde-n', (v) => { nPaths = Math.round(v); render(); }, (v) => String(Math.round(v)))._emit();
    const btn = document.getElementById('sde-reseed');
    if (btn) btn.addEventListener('click', () => { seed = (seed * 1664525 + 1013904223) >>> 0; render(); });
  })();

  /* -------------------------------------------------------- 21. Ito calculus */

  (function ito() {
    let n = 8, seed = 97;
    const ch = chart('c-ito', { xMin: 0, xMax: 1, yMin: -1.6, yMax: 1.6 }, render);
    if (!ch) return;
    const FINE = 4000;

    function render() {
      const rng = RNG(seed);
      const W = new Float64Array(FINE + 1);
      const sd = Math.sqrt(1 / FINE);
      for (let i = 1; i <= FINE; i++) W[i] = W[i - 1] + sd * rng.normal();

      ch.fit().clear();
      ch.axes({ xLabel: 't', yLabel: 'W' });
      const pts = [];
      for (let i = 0; i <= FINE; i += 4) pts.push([i / FINE, W[i]]);
      ch.curve(pts, { color: C.blue, width: 1.6 });

      // Three Riemann-sum conventions for ∫ W dW over n panels.
      let left = 0, mid = 0, right = 0;
      const step = FINE / n;
      for (let k = 0; k < n; k++) {
        const i0 = Math.round(k * step), i1 = Math.round((k + 1) * step);
        const dW = W[i1] - W[i0];
        left += W[i0] * dW;
        mid += 0.5 * (W[i0] + W[i1]) * dW;
        right += W[i1] * dW;
        // Mark the sample point each convention uses.
        ch.points([[i0 / FINE, W[i0]]], { color: C.orange, r: 3 });
        if (n <= 40) ch.points([[i1 / FINE, W[i1]]], { color: C.green, r: 2.4 });
      }
      const wT = W[FINE];
      say('r-ito',
        tx(`subdivisions n = ${n} &nbsp;·&nbsp; W_T = ${fmt(wT, 3)} &nbsp;·&nbsp; ½W_T² = ${fmt(0.5 * wT * wT, 4)}<br>`,
          `분할 n = ${n} &nbsp;·&nbsp; W_T = ${fmt(wT, 3)} &nbsp;·&nbsp; ½W_T² = ${fmt(0.5 * wT * wT, 4)}<br>`) +
        `${dot(C.orange, tx(`left endpoint (Itô) = ${fmt(left, 4)}`, `왼쪽 끝 (이토) = ${fmt(left, 4)}`))} &nbsp;·&nbsp; ` +
        tx(`midpoint (Stratonovich) = ${fmt(mid, 4)} &nbsp;·&nbsp; `, `중점 (스트라토노비치) = ${fmt(mid, 4)} &nbsp;·&nbsp; `) +
        `${dot(C.green, tx(`right endpoint = ${fmt(right, 4)}`, `오른쪽 끝 = ${fmt(right, 4)}`))}<br>` +
        tx(`Itô's theoretical value ½W_T² − ½T = <strong>${fmt(0.5 * wT * wT - 0.5, 4)}</strong> &nbsp;·&nbsp; `,
          `이토의 이론값 ½W_T² − ½T = <strong>${fmt(0.5 * wT * wT - 0.5, 4)}</strong> &nbsp;·&nbsp; `) +
        tx(`right − left = ${fmt(right - left, 4)} (the quadratic variation → converges to T = 1)<br>`,
          `오른쪽 − 왼쪽 = ${fmt(right - left, 4)} (이차변동 → T = 1로 수렴)<br>`) +
        (n > 100
          ? tx('<strong>However far the partition is refined, the three values never gather into one.</strong> This cannot happen for an ordinary integral, and it is because a Brownian path is too rough — so which point to use <em>must be fixed by convention</em>.',
            '<strong>분할을 아무리 늘려도 세 값이 하나로 모이지 않습니다.</strong> 보통의 적분에서는 있을 수 없는 일이며, 브라운 경로가 너무 거칠기 때문입니다 — 그래서 어느 점을 쓸지 <em>규약으로 정해야</em> 합니다.')
          : tx('Refine the partition. For an ordinary function the three values would go to the same limit, but here they remain separated.',
            '분할을 늘려보세요. 보통의 함수라면 세 값이 같은 극한으로 갔을 텐데, 여기서는 갈라진 채 남습니다.')));
    }
    slider('ito-n', (v) => { n = Math.round(v); render(); }, (v) => String(Math.round(v)))._emit();
    const btn = document.getElementById('ito-reseed');
    if (btn) btn.addEventListener('click', () => { seed = (seed * 1664525 + 1013904223) >>> 0; render(); });
  })();

  /* -------------------------------------------------- 22. quadratic variation */

  (function quadVar() {
    let logN = 1.2, seed = 101;
    const ch = chart('c-quadvar', { xMin: 0, xMax: 1, yMin: -1.6, yMax: 1.6 }, render);
    const chC = chart('c-quadvar-conv', { xMin: 0, xMax: 3.2, yMin: 0, yMax: 1.6 }, render);
    if (!ch) return;
    const FINE = 8192;

    function build(seedv) {
      const rng = RNG(seedv);
      const W = new Float64Array(FINE + 1);
      const sd = Math.sqrt(1 / FINE);
      for (let i = 1; i <= FINE; i++) W[i] = W[i - 1] + sd * rng.normal();
      return W;
    }
    const smooth = (t) => 0.9 * Math.sin(3.1 * t) + 0.4 * t;

    function render() {
      const W = build(seed);
      const n = Math.round(Math.pow(10, logN));
      ch.fit().clear();
      ch.axes({ xLabel: 't', yLabel: 'X' });
      const pts = [];
      for (let i = 0; i <= FINE; i += 8) pts.push([i / FINE, W[i]]);
      ch.curve(pts, { color: C.blue, width: 1.6 });
      ch.curve(smooth, { color: '#8c8c8c', width: 2 });

      const qv = (arrFn, m) => {
        let s = 0;
        for (let k = 0; k < m; k++) {
          const a = arrFn(k / m), b = arrFn((k + 1) / m);
          s += (b - a) ** 2;
        }
        return s;
      };
      const wAt = (t) => W[Math.min(FINE, Math.round(t * FINE))];
      const qvW = qv(wAt, n), qvS = qv(smooth, n);

      if (chC) {
        chC.fit().clear();
        chC.axes({ xLabel: tx('log₁₀ n (subdivisions)', 'log₁₀ n (분할 수)'), yLabel: tx('quadratic variation', '이차변동') });
        const a = [], b = [];
        for (let e = 0; e <= 3.2; e += 0.08) {
          const m = Math.round(Math.pow(10, e));
          a.push([e, qv(wAt, m)]);
          b.push([e, qv(smooth, m)]);
        }
        chC.curve(a, { color: C.blue, width: 2.2 });
        chC.curve(b, { color: '#8c8c8c', width: 2 });
        chC.hline(1, { color: C.red, dash: [4, 3], label: 'T = 1' });
        chC.vline(logN, { color: '#111', dash: [3, 3], width: 1.2 });
      }
      say('r-quadvar',
        tx(`subdivisions n = ${n} &nbsp;·&nbsp; `, `분할 수 n = ${n} &nbsp;·&nbsp; `) +
        `${dot(C.blue, tx(`quadratic variation of the Brownian path = ${fmt(qvW, 4)}`, `브라운 경로의 이차변동 = ${fmt(qvW, 4)}`))} &nbsp;·&nbsp; ` +
        `${dot('#8c8c8c', tx(`smooth curve = ${fmt(qvS, 6)}`, `매끄러운 곡선 = ${fmt(qvS, 6)}`))}<br>` +
        tx(`Brownian <strong>converges to T = 1</strong> while the smooth curve <strong>vanishes to 0.</strong> `,
          `브라운은 <strong>T = 1로 수렴</strong>하고 매끄러운 곡선은 <strong>0으로 사라집니다.</strong> `) +
        tx(`Since (ΔW)² ~ Δt, adding n of them leaves n·(1/n) = 1. `,
          `(ΔW)² ~ Δt이므로 n개를 더하면 n·(1/n) = 1이 남는 것입니다. `) +
        tx(`This one fact produces the rule (dW)² = dt, which becomes the extra term of Itô's lemma.`,
          `이 한 가지 사실이 (dW)² = dt라는 규칙을 낳고, 그것이 이토 보조정리의 추가 항이 됩니다.`));
    }
    slider('qv-n', (v) => { logN = v; render(); }, (v) => String(Math.round(Math.pow(10, v))))._emit();
    const btn = document.getElementById('qv-reseed');
    if (btn) btn.addEventListener('click', () => { seed = (seed * 1664525 + 1013904223) >>> 0; render(); });
  })();

  /* ------------------------------------------------------- 23. Ito's lemma */

  (function itoLemma() {
    const FNS = {
      sq: { phi: (x) => x * x, d2: () => 2, label: 'φ(x) = x²', conv: tx('convex', '볼록') },
      log: { phi: (x) => Math.log(Math.max(x, 1e-6)), d2: (x) => -1 / (x * x), label: 'φ(x) = log x', conv: tx('concave', '오목') },
      exp: { phi: (x) => Math.exp(x), d2: (x) => Math.exp(x), label: 'φ(x) = eˣ', conv: tx('convex', '볼록') },
    };
    let kind = 'sq', g = 0.6;
    const ch = chart('c-itolemma', { xMin: 0, xMax: 2, yMin: 0, yMax: 4 }, render);
    if (!ch) return;

    function render() {
      const { phi, d2, label, conv } = FNS[kind];
      const rng = RNG(107);
      const NS = 400, T = 2, dt = T / NS, sq = Math.sqrt(dt);
      const M = 900;
      const X0 = kind === 'log' ? 1.5 : 0.8;
      // Drift chosen so X stays positive (log needs it).
      const drift = (x) => 0.25 * (1.2 - x);
      const meanY = new Float64Array(NS + 1);
      const paths = [];
      for (let p = 0; p < M; p++) {
        let x = X0;
        const keep = p < 10 ? [[0, phi(x)]] : null;
        meanY[0] += phi(x);
        for (let i = 1; i <= NS; i++) {
          x += drift(x) * dt + g * sq * rng.normal();
          if (kind === 'log') x = Math.max(x, 0.05);
          meanY[i] += phi(x);
          if (keep) keep.push([i * dt, phi(x)]);
        }
        if (keep) paths.push(keep);
      }
      for (let i = 0; i <= NS; i++) meanY[i] /= M;

      ch.fit().clear();
      const lo = Math.min(...meanY) - 0.6, hi = Math.max(...meanY) + 0.8;
      ch.setY(lo, hi);
      ch.axes({ xLabel: 't', yLabel: 'Y = φ(X)' });
      paths.forEach((p, i) => ch.curve(p, { color: `hsla(${(i * 53) % 360},55%,50%,.32)`, width: 1 }));
      ch.curve(Array.from({ length: NS + 1 }, (_, i) => [i * dt, meanY[i]]), { color: C.orange, width: 2.6 });
      // Naive chain rule: apply φ to the deterministic (g = 0) trajectory.
      const ode = Calc.integrateODE((t, x) => drift(x), X0, 0, T, 0.005, 'rk4');
      ch.curve(ode.map(([t, x]) => [t, phi(x)]), { color: '#8c8c8c', width: 2, dash: [5, 3] });

      const gap = meanY[NS] - phi(ode[ode.length - 1][1]);
      const extra = 0.5 * g * g * d2(ode[ode.length - 1][1]);
      say('r-itolemma',
        `<strong>${label}</strong> (${conv}) &nbsp;·&nbsp; g = ${fmt(g, 2)} &nbsp;·&nbsp; ` +
        `${dot('#8c8c8c', tx('ordinary chain-rule prediction φ(x(t))', '보통의 연쇄법칙 예측 φ(x(t))'))} vs ` +
        `${dot(C.orange, tx('actual mean E[φ(X)]', '실제 평균 E[φ(X)]'))}<br>` +
        tx(`final gap = <strong>${fmt(gap, 4)}</strong> &nbsp;·&nbsp; Itô term ½g²φ″ ≈ ${fmt(extra, 4)} (per unit time)<br>`,
          `최종 간격 = <strong>${fmt(gap, 4)}</strong> &nbsp;·&nbsp; 이토 항 ½g²φ″ ≈ ${fmt(extra, 4)} (per unit time)<br>`) +
        (Math.abs(g) < 0.02
          ? tx('With g = 0 the gap disappears — without randomness the ordinary chain rule is exactly right.',
            'g = 0이면 간격이 사라집니다 — 무작위성이 없으면 보통의 연쇄법칙이 그대로 맞습니다.')
          : d2(1) > 0
            ? tx('<strong>The function is convex, so the mean is pushed upward.</strong> It is the Jensen effect created by ½g²φ″ &gt; 0, and the gap grows as g grows.',
              '<strong>볼록 함수라 평균이 위로 밀립니다.</strong> ½g²φ″ > 0이 만드는 젠센 효과이며, g를 키울수록 간격이 커집니다.')
            : tx('<strong>The function is concave, so the mean is pushed downward.</strong> This is exactly the effect producing −σ²/2 in geometric Brownian motion.',
              '<strong>오목 함수라 평균이 아래로 밀립니다.</strong> 기하 브라운 운동에서 −σ²/2가 나타나는 것이 바로 이 효과입니다.')));
    }
    presetGroup('ito-fn', ({ fn }) => { kind = fn; render(); });
    slider('il-g', (v) => { g = v; render(); })._emit();
    render();
  })();

  /* --------------------------------------------------- 24. Euler-Maruyama */

  (function eulerMaruyama() {
    let logDt = -1.7, wrong = false, seed = 113;
    const ch = chart('c-em', { xMin: 0, xMax: 2, yMin: -1.5, yMax: 2.5 }, render);
    const chC = chart('c-em-conv', { xMin: -3, xMax: -0.7, yMin: -3, yMax: 0.5 }, render);
    if (!ch) return;
    const theta = 1.2, sigma = 0.9, X0 = 1.6, T = 2;

    // Exact OU sampling lets us measure discretisation error honestly.
    function simulate(dt, rng, useWrong) {
      const n = Math.round(T / dt);
      let x = X0;
      const pts = [[0, x]];
      for (let i = 1; i <= n; i++) {
        const scale = useWrong ? dt : Math.sqrt(dt);
        x += -theta * x * dt + sigma * scale * rng.normal();
        pts.push([i * dt, x]);
      }
      return pts;
    }

    function render() {
      const dt = Math.pow(10, logDt);
      ch.fit().clear();
      ch.axes({ xLabel: 't', yLabel: 'Xₜ' });
      for (let p = 0; p < 10; p++) {
        const rng = RNG(seed + p);
        ch.curve(simulate(dt, rng, wrong), { color: `hsla(${(p * 47) % 360},55%,48%,.55)`, width: 1 });
      }
      ch.curve((t) => X0 * Math.exp(-theta * t), { color: '#111', width: 2.4 });
      const statSd = sigma / Math.sqrt(2 * theta);
      ch.hline(statSd, { color: C.red, dash: [4, 3] });
      ch.hline(-statSd, { color: C.red, dash: [4, 3] });

      if (chC) {
        // Weak error: |E[X_T] − exact|. Strong-ish error: spread mismatch.
        chC.fit().clear();
        chC.axes({ xLabel: 'log₁₀ Δt', yLabel: tx('log₁₀ error', 'log₁₀ 오차') });
        const exactMean = X0 * Math.exp(-theta * T);
        const exactVar = (sigma * sigma / (2 * theta)) * (1 - Math.exp(-2 * theta * T));
        const weak = [], strong = [];
        for (let e = -3; e <= -0.7; e += 0.15) {
          const h = Math.pow(10, e);
          const M = 900;
          let sum = 0, sum2 = 0;
          for (let p = 0; p < M; p++) {
            const rng = RNG(2000 + p);
            const s = simulate(h, rng, false);
            const v = s[s.length - 1][1];
            sum += v; sum2 += v * v;
          }
          const m = sum / M, vr = sum2 / M - m * m;
          weak.push([e, Math.log10(Math.max(1e-6, Math.abs(m - exactMean)))]);
          strong.push([e, Math.log10(Math.max(1e-6, Math.abs(vr - exactVar)))]);
        }
        chC.curve(weak, { color: C.violet, width: 2 });
        chC.curve(strong, { color: C.orange, width: 2 });
        chC.vline(logDt, { color: '#111', dash: [3, 3], width: 1.2 });
      }
      say('r-em',
        tx(`Δt = ${fmt(dt, 4)} &nbsp;·&nbsp; steps = ${Math.round(T / dt)} &nbsp;·&nbsp; `,
          `Δt = ${fmt(dt, 4)} &nbsp;·&nbsp; 걸음 수 = ${Math.round(T / dt)} &nbsp;·&nbsp; `) +
        `${dot('#111', tx('deterministic solution from drift alone', '드리프트만의 결정론적 해'))} &nbsp; ` +
        `${dot(C.red, tx('width of the stationary distribution', '정상분포 폭'))}<br>` +
        (wrong
          ? tx('<strong>Δt is being used instead of √Δt (a common bug).</strong> The noise becomes far too small and every path collapses onto the deterministic curve — the discretization has turned the SDE into an ODE.',
            '<strong>√Δt 대신 Δt를 쓰고 있습니다 (흔한 버그).</strong> 노이즈가 턱없이 작아져 모든 경로가 결정론적 곡선으로 붕괴합니다 — 이산화가 SDE를 ODE로 바꿔버린 것입니다.')
          : tx('The key is that the noise term has size <strong>σ√Δt</strong>. In the graph below you can see ',
              '노이즈 항의 크기가 <strong>σ√Δt</strong>인 것이 핵심입니다. 아래 그래프에서 ') +
            `${dot(C.violet, tx('weak convergence (mean)', '약수렴(평균)'))}` +
            tx(' and ', '과 ') + `${dot(C.orange, tx('variance error', '분산 오차'))}` +
            tx(' descending with different slopes.', '가 서로 다른 기울기로 내려가는 것을 볼 수 있습니다.')));
    }
    slider('em-dt', (v) => { logDt = v; render(); }, (v) => fmt(Math.pow(10, v), 4))._emit();
    toggle('em-wrong', (on) => { wrong = on; render(); });
    const btn = document.getElementById('em-reseed');
    if (btn) btn.addEventListener('click', () => { seed = (seed * 1664525 + 1013904223) >>> 0; render(); });
  })();

  /* ------------------------------------------------ 25. forward & backward */

  (function forwardBackward() {
    // A two-mode data distribution, blurred by the forward process.
    const MODES = [[-1.5, 0.32, 0.5], [1.3, 0.28, 0.5]];
    let t = 0, noScore = false;
    const ch = chart('c-fb', { xMin: -4, xMax: 4, yMin: 0, yMax: 0.95 }, render);
    if (!ch) return;

    // Forward: variance-preserving blur toward N(0,1).
    const alphaBar = (time) => Math.exp(-3.2 * time);
    const pt = (x, time) => {
      const a = Math.sqrt(alphaBar(time));
      const v = 1 - alphaBar(time);
      return MODES.reduce((s, [mu, sd, w]) =>
        s + w * gaussPdf(x, a * mu, Math.sqrt(a * a * sd * sd + v)), 0);
    };
    const score = (x, time) => {
      const h = 1e-3;
      return (Math.log(Math.max(pt(x + h, time), 1e-12)) - Math.log(Math.max(pt(x - h, time), 1e-12))) / (2 * h);
    };

    function render() {
      ch.fit().clear();
      ch.setY(0, 0.95);
      ch.axes({ xLabel: 'x', yLabel: 'p_t(x)' });
      ch.curve((x) => pt(x, 0), { color: 'rgba(140,140,140,.8)', width: 1.5, dash: [4, 3] });
      ch.curve((x) => pt(x, t), { color: C.blue, width: 2.4, fill: 'rgba(6,69,173,.10)' });
      ch.curve((x) => gaussPdf(x, 0, 1), { color: 'rgba(217,48,37,.55)', width: 1.4, dash: [3, 3] });

      // Score field as arrows along the axis.
      const yArrow = 0.06;
      for (let i = 0; i < 26; i++) {
        const x = -4 + ((i + 0.5) / 26) * 8;
        const s = clamp(noScore ? 0 : score(x, t), -6, 6);
        const L = 0.16 * Math.sign(s) * Math.min(1, Math.abs(s) / 3);
        if (Math.abs(L) < 1e-3) continue;
        ch.curve([[x, yArrow], [x + L * 2.2, yArrow]], { color: C.green, width: 2 });
      }
      say('r-fb',
        `t = ${fmt(t, 2)} &nbsp;·&nbsp; ᾱ(t) = ${fmt(alphaBar(t), 3)} &nbsp;·&nbsp; ` +
        `${dot('rgba(140,140,140,.9)', tx('original data distribution p₀', '원본 데이터 분포 p₀'))} &nbsp; ${dot(C.blue, 'p_t')} &nbsp; ` +
        `${dot('rgba(217,48,37,.8)', 'N(0,1)')} &nbsp; ${dot(C.green, tx('score ∇ₓ log p_t', '스코어 ∇ₓ log p_t'))}<br>` +
        (noScore
          ? tx('<strong>The score is off.</strong> The green arrows have vanished — without that term the reverse SDE is just one more diffusion and cannot restore the peaks.',
            '<strong>스코어를 껐습니다.</strong> 초록 화살표가 사라졌습니다 — 이 항이 없으면 역방향 SDE는 그저 또 한 번의 확산일 뿐이라 봉우리를 복원하지 못합니다.')
          : t < 0.05
            ? tx('The two peaks are sharp, and the score arrows point <strong>toward</strong> each of them.',
              '두 봉우리가 뚜렷하고, 스코어 화살표가 각 봉우리를 <strong>향해</strong> 가리킵니다.')
            : t > 0.85
              ? tx('It has become nearly N(0,1). Starting here and going <strong>back in time along the score</strong> revives the two peaks — that is generation.',
                '거의 N(0,1)이 되었습니다. 여기서 시작해 <strong>스코어를 따라 시간을 거슬러</strong> 내려가면 두 봉우리가 되살아납니다 — 그것이 생성입니다.')
              : tx('Diffusion proceeds and the peaks blur, while the score still points toward where the density is higher.',
                '확산이 진행되며 봉우리가 뭉개지고, 스코어는 여전히 밀도가 높은 쪽을 가리킵니다.')));
    }
    const sl = slider('fb-t', (v) => { t = v; render(); });
    const fw = document.getElementById('fb-forward');
    if (fw) fw.addEventListener('click', () => playback(sl, 2600, 0, 1));
    const rv = document.getElementById('fb-reverse');
    if (rv) rv.addEventListener('click', () => playback(sl, 2600, 1, 0));
    toggle('fb-noscore', (on) => { noScore = on; render(); });
    sl._emit();
  })();

  /* --------------------------------------------- 26. density evolution */

  (function densityEvolution() {
    let N = 300, t = 0.3, seed = 127;
    const chP = chart('c-densevo', { xMin: -4, xMax: 4, yMin: 0, yMax: 1 }, render);
    const chD = chart('c-densevo-p', { xMin: -4, xMax: 4, yMin: 0, yMax: 0.7 }, render);
    if (!chP) return;
    const theta = 1.0, sigma = 1.1, X0 = 2.2;

    function render() {
      const rng = RNG(seed);
      const NS = 240, dt = t / NS, sq = Math.sqrt(Math.max(dt, 0));
      const xs = [], jitter = [];
      for (let p = 0; p < N; p++) {
        let x = X0;
        for (let i = 0; i < NS; i++) x += -theta * x * dt + sigma * sq * rng.normal();
        xs.push(x);
        jitter.push(rng.uniform());
      }
      chP.fit().clear();
      chP.axes({ grid: false, yTicks: [], yTickLabels: false, xLabel: 'x' });
      xs.forEach((x, i) => chP.points([[x, 0.2 + 0.6 * jitter[i]]], { color: 'rgba(6,69,173,.5)', r: 2 }));

      // Exact OU marginal — deterministic, no matter what the paths did.
      const mu = X0 * Math.exp(-theta * t);
      const vr = (sigma * sigma / (2 * theta)) * (1 - Math.exp(-2 * theta * t));
      if (chD) {
        chD.fit().clear();
        chD.axes({ xLabel: 'x', yLabel: 'p_t(x)' });
        chD.bars(densityBars(xs, -4, 4, 46), { color: 'rgba(6,69,173,.25)', stroke: 'rgba(6,69,173,.5)' });
        chD.curve((x) => gaussPdf(x, mu, Math.sqrt(vr)), { color: C.orange, width: 2.6 });
      }
      say('r-densevo',
        `t = ${fmt(t, 2)} &nbsp;·&nbsp; N = ${N} &nbsp;·&nbsp; ` +
        tx(`theoretical marginal N(${fmt(mu, 3)}, ${fmt(vr, 3)}) &nbsp;·&nbsp; `,
          `이론 주변분포 N(${fmt(mu, 3)}, ${fmt(vr, 3)}) &nbsp;·&nbsp; `) +
        tx(`sample mean ${fmt(xs.reduce((a, b) => a + b, 0) / N, 3)}<br>`,
          `표본 평균 ${fmt(xs.reduce((a, b) => a + b, 0) / N, 3)}<br>`) +
        tx(`<strong>Press "Resample" — the individual paths change every time, yet the orange curve does not move in the slightest.</strong> `,
          `<strong>"다시 뽑기"를 눌러보세요 — 개별 경로는 매번 달라지지만 주황 곡선은 조금도 움직이지 않습니다.</strong> `) +
        tx(`The paths are random, but <strong>the density p_t is entirely deterministic</strong>. This shift of perspective is the premise of the next two sections.`,
          `경로는 무작위지만 <strong>밀도 p_t는 완전히 결정론적</strong>입니다. 이 관점 전환이 다음 두 절의 전제입니다.`));
    }
    slider('de-n', (v) => { N = Math.round(Math.pow(10, v)); render(); },
      (v) => String(Math.round(Math.pow(10, v))))._emit();
    slider('de-t', (v) => { t = v; render(); })._emit();
    const btn = document.getElementById('de-reseed');
    if (btn) btn.addEventListener('click', () => { seed = (seed * 1664525 + 1013904223) >>> 0; render(); });
  })();

  /* ------------------------------------------------------ 27. Fokker-Planck */

  (function fokkerPlanck() {
    let theta = 2, g = 0.8, t = 0.2;
    const chP = chart('c-fp', { xMin: -4, xMax: 4, yMin: 0, yMax: 1 }, render);
    const chD = chart('c-fp-density', { xMin: -4, xMax: 4, yMin: 0, yMax: 1.4 }, render);
    if (!chP) return;
    const X0 = 2.5, M = 1200;

    function render() {
      const rng = RNG(131);
      const NS = 260, dt = t / NS, sq = Math.sqrt(Math.max(dt, 0));
      const xs = [], jit = [];
      for (let p = 0; p < M; p++) {
        let x = X0;
        for (let i = 0; i < NS; i++) x += -theta * x * dt + g * sq * rng.normal();
        xs.push(x); jit.push(rng.uniform());
      }
      chP.fit().clear();
      chP.axes({ grid: false, yTicks: [], yTickLabels: false, xLabel: 'x' });
      xs.slice(0, 400).forEach((x, i) => chP.points([[x, 0.2 + 0.6 * jit[i]]], { color: 'rgba(6,69,173,.45)', r: 1.8 }));

      // Exact solution of the FP equation for this linear SDE.
      const mu = theta > 1e-6 ? X0 * Math.exp(-theta * t) : X0;
      const vr = theta > 1e-6
        ? (g * g / (2 * theta)) * (1 - Math.exp(-2 * theta * t))
        : g * g * t;
      const sd = Math.sqrt(Math.max(vr, 1e-9));
      if (chD) {
        chD.fit().clear();
        chD.setY(0, Math.max(1.0, gaussPdf(mu, mu, sd) * 1.1));
        chD.axes({ xLabel: 'x', yLabel: 'p(x, t)' });
        chD.bars(densityBars(xs, -4, 4, 50), { color: 'rgba(6,69,173,.22)', stroke: 'rgba(6,69,173,.45)' });
        chD.curve((x) => gaussPdf(x, mu, sd), { color: C.orange, width: 2.6 });
        if (theta > 1e-6 && g > 1e-6) {
          const statSd = g / Math.sqrt(2 * theta);
          chD.curve((x) => gaussPdf(x, 0, statSd), { color: '#8c8c8c', width: 1.6, dash: [4, 3] });
        }
      }
      say('r-fp',
        `∂p/∂t = −∂/∂x(−θx·p) + ½g²·∂²p/∂x² &nbsp;·&nbsp; θ = ${fmt(theta, 2)}, g = ${fmt(g, 2)}, t = ${fmt(t, 2)}<br>` +
        tx(`mean ${fmt(mu, 3)} &nbsp;·&nbsp; variance ${fmt(vr, 4)} &nbsp;·&nbsp; `,
          `평균 ${fmt(mu, 3)} &nbsp;·&nbsp; 분산 ${fmt(vr, 4)} &nbsp;·&nbsp; `) +
        (g < 0.02 ? tx('<strong>The diffusion term is 0</strong> — the density is carried bodily without blurring (the continuity equation).',
            '<strong>확산 항이 0</strong> — 밀도가 뭉개지지 않고 통째로 실려갑니다(연속방정식).')
          : theta < 0.02 ? tx('<strong>The drift is 0</strong> — it only blurs in place (the diffusion equation).',
            '<strong>드리프트가 0</strong> — 제자리에서 뭉개지기만 합니다(확산방정식).')
          : tx(`The two terms work together, carrying while blurring, and finally stop at `,
              `두 항이 함께 작동해 실려가며 뭉개지고, 결국 `) +
            `${dot('#8c8c8c', tx(`the stationary distribution N(0, ${fmt(g * g / (2 * theta), 3)})`, `정상분포 N(0, ${fmt(g * g / (2 * theta), 3)})`))}` +
            tx('.', '에서 멈춥니다.')) +
        tx(`<br>The particle histogram above and the PDE solution below (orange) coincide — <strong>to one SDE there corresponds exactly one PDE</strong>.`,
          `<br>위 입자 히스토그램과 아래 PDE 해(주황)가 겹칩니다 — <strong>SDE 하나에 PDE 하나가 정확히 대응</strong>합니다.`));
    }
    slider('fp-th', (v) => { theta = v; render(); })._emit();
    slider('fp-g', (v) => { g = v; render(); })._emit();
    const sl = slider('fp-t', (v) => { t = v; render(); });
    const play = document.getElementById('fp-play');
    if (play) play.addEventListener('click', () => playback(sl, 2800, 0.01, 1.5));
    sl._emit();
  })();

  /* ------------------------------------------------------ 28. Kolmogorov */

  (function kolmogorov() {
    let dir = 'forward', t = 0.5;
    const ch = chart('c-kolmogorov', { xMin: -3, xMax: 3, yMin: 0, yMax: 1.2 }, render);
    if (!ch) return;
    const sigma = 0.8;
    // Terminal payoff for the backward equation.
    const payoff = (x) => (x > 0.6 ? 1 : 0);

    function render() {
      ch.fit().clear();
      if (dir === 'forward') {
        ch.setY(0, 1.6);
        ch.axes({ xLabel: 'x', yLabel: 'p(x, t)' });
        const sd = Math.sqrt(0.09 + sigma * sigma * t);
        ch.curve((x) => gaussPdf(x, 0, Math.sqrt(0.09)), { color: 'rgba(140,140,140,.8)', width: 1.5, dash: [4, 3] });
        ch.curve((x) => gaussPdf(x, 0, sd), { color: C.blue, width: 2.6, fill: 'rgba(6,69,173,.10)' });
        say('r-kolmogorov',
          tx(`<strong>Forward equation</strong> ∂p/∂t = ½σ²∂²p/∂x² &nbsp;·&nbsp; t = ${fmt(t, 2)} &nbsp;·&nbsp; width = ${fmt(sd, 3)}<br>`,
            `<strong>전방정식</strong> ∂p/∂t = ½σ²∂²p/∂x² &nbsp;·&nbsp; t = ${fmt(t, 2)} &nbsp;·&nbsp; 폭 = ${fmt(sd, 3)}<br>`) +
          tx(`The initial distribution (grey) spreads <strong>forward along time</strong>. The unknown is a density and it starts from an initial condition.`,
            `초기분포(회색)가 <strong>시간을 따라 앞으로</strong> 퍼집니다. 미지수는 밀도이고, 초기조건에서 출발합니다.`));
      } else {
        // u(x,t) = E[payoff(X_T) | X_t = x] = Φ((x − 0.6)/(σ√(T−t)))
        const rem = Math.max(1e-6, 1 - t);
        const sd = sigma * Math.sqrt(rem);
        const Phi = (z) => 0.5 * (1 + window.Dist.erf(z / Math.SQRT2));
        ch.setY(-0.15, 1.25);
        ch.axes({ xLabel: 'x', yLabel: 'u(x, t)' });
        ch.curve(payoff, { color: 'rgba(140,140,140,.8)', width: 1.8, dash: [4, 3], samples: 600 });
        ch.curve((x) => Phi((x - 0.6) / sd), { color: C.violet, width: 2.6 });
        say('r-kolmogorov',
          `<strong>${tx('Backward equation', '후방정식')}</strong> −∂u/∂t = ½σ²∂²u/∂x² &nbsp;·&nbsp; u(x,t) = E[φ(X_T) | X_t = x] &nbsp;·&nbsp; ` +
          tx(`time remaining T−t = ${fmt(rem, 2)}<br>`, `남은 시간 T−t = ${fmt(rem, 2)}<br>`) +
          tx(`It starts from the terminal condition φ (the grey step) and spreads <strong>backward in time</strong>. The closer t is to T the closer it is to the step, `,
            `종말조건 φ(회색 계단)에서 출발해 <strong>시간을 거슬러</strong> 번집니다. t가 T에 가까울수록 계단에 가깝고, `) +
          tx(`and the further away the smoother — the unknown is an <strong>expectation</strong>, not a density. `,
            `멀수록 매끄러워집니다 — 미지수가 밀도가 아니라 <strong>기대값</strong>입니다. `) +
          tx(`That this value can also be obtained by Monte Carlo is Feynman–Kac.`,
            `이 값을 몬테카를로로도 구할 수 있다는 것이 Feynman–Kac입니다.`));
      }
    }
    presetGroup('kol-dir', (d) => { dir = d.dir; render(); });
    slider('kol-t', (v) => { t = v; render(); })._emit();
  })();

  /* ------------------------------------------- 29. ODE and continuity */

  (function odeContinuity() {
    const v = (x) => 0.8 * Math.sin(1.1 * x) - 0.35 * x;
    let t = 0;
    const chP = chart('c-odecont', { xMin: -4, xMax: 4, yMin: 0, yMax: 1 }, render);
    const chD = chart('c-odecont-p', { xMin: -4, xMax: 4, yMin: 0, yMax: 0.8 }, render);
    if (!chP) return;
    const rng0 = RNG(139);
    const N = 3000;
    const x0s = Array.from({ length: N }, () => 1.2 * rng0.normal());
    const jit = Array.from({ length: N }, () => rng0.uniform());

    const move = (x, time) => {
      if (time < 1e-9) return x;
      const sol = Calc.integrateODE((s, y) => v(y), x, 0, time, 0.01, 'rk4');
      return sol[sol.length - 1][1];
    };

    function render() {
      const xs = x0s.map((x) => move(x, t));
      chP.fit().clear();
      chP.axes({ grid: false, yTicks: [], yTickLabels: false, xLabel: 'x' });
      xs.slice(0, 420).forEach((x, i) => {
        // Colour by local divergence: red compresses (density up), blue expands.
        const d = Calc.ddx(v, x);
        const k = clamp(-d / 1.2, -1, 1);
        const col = k >= 0 ? `rgba(217,48,37,${0.25 + 0.5 * k})` : `rgba(6,69,173,${0.25 + 0.5 * -k})`;
        chP.points([[x, 0.2 + 0.6 * jit[i]]], { color: col, r: 2 });
      });
      if (chD) {
        chD.fit().clear();
        chD.axes({ xLabel: 'x', yLabel: 'ρ' });
        chD.bars(densityBars(xs, -4, 4, 52), { color: 'rgba(6,69,173,.25)', stroke: 'rgba(6,69,173,.5)' });
        chD.curve((x) => gaussPdf(x, 0, 1.2), { color: 'rgba(140,140,140,.8)', width: 1.5, dash: [4, 3] });
      }
      // Log-density correction accumulated along one representative trajectory.
      let acc = 0;
      const steps = 60;
      for (let i = 0; i < steps; i++) {
        const s = (i / steps) * t;
        acc += -Calc.ddx(v, move(0.8, s)) * (t / steps);
      }
      say('r-odecont',
        `t = ${fmt(t, 2)} &nbsp;·&nbsp; ${dot('rgba(217,48,37,.8)', tx('−∇·v &gt; 0: compression (density ↑)', '−∇·v > 0: 압축 (밀도 ↑)'))} &nbsp; ` +
        `${dot('rgba(6,69,173,.8)', tx('−∇·v &lt; 0: expansion (density ↓)', '−∇·v < 0: 팽창 (밀도 ↓)'))}<br>` +
        tx(`log-density correction along the representative trajectory ∫(−∇·v)dt = <strong>${fmt(acc, 4)}</strong><br>`,
          `대표 궤적의 로그밀도 보정 ∫(−∇·v)dt = <strong>${fmt(acc, 4)}</strong><br>`) +
        tx(`<strong>The shape of the density changes even though every particle moves deterministically.</strong> `,
          `<strong>모든 입자가 결정론적으로 움직이는데도 밀도의 모양이 변합니다.</strong> `) +
        tx(`That a distribution deforms without any randomness is the key to the next section. `,
          `무작위성 없이도 분포가 변형된다는 이 사실이 다음 절의 열쇠입니다. `) +
        tx(`And <strong>integrating the divergence alone</strong>, instead of a Jacobian determinant, yields an exact log-likelihood.`,
          `그리고 야코비안 행렬식 대신 <strong>발산만 적분하면</strong> 정확한 로그가능도를 얻습니다.`));
    }
    const sl = slider('oc-t', (v2) => { t = v2; render(); });
    const play = document.getElementById('oc-play');
    if (play) play.addEventListener('click', () => playback(sl, 2600));
    sl._emit();
  })();

  /* ------------------------------------------------ 30. probability flow ODE */

  (function probFlow() {
    // Same forward process as the forward/backward section: VP blur of two modes.
    const MODES = [[-1.5, 0.32, 0.5], [1.3, 0.28, 0.5]];
    let t = 0, N = 400, seed = 149;
    const ch = chart('c-pf', { xMin: 0, xMax: 1.45, yMin: -4, yMax: 4 }, render);
    if (!ch) return;

    const beta = 3.2;
    const alphaBar = (time) => Math.exp(-beta * time);
    const ptDens = (x, time) => {
      const a = Math.sqrt(alphaBar(time));
      const vv = 1 - alphaBar(time);
      return MODES.reduce((s, [mu, sd, w]) =>
        s + w * gaussPdf(x, a * mu, Math.sqrt(a * a * sd * sd + vv)), 0);
    };
    const score = (x, time) => {
      const h = 1e-3;
      return (Math.log(Math.max(ptDens(x + h, time), 1e-14)) - Math.log(Math.max(ptDens(x - h, time), 1e-14))) / (2 * h);
    };

    function render() {
      const rng = RNG(seed);
      const NS = 220;
      const dt = 1 / NS, sq = Math.sqrt(dt);
      // Shared initial samples so the two ensembles differ only in dynamics.
      const inits = Array.from({ length: N }, () => {
        const [mu, sd] = MODES[rng.uniform() < 0.5 ? 0 : 1];
        return mu + sd * rng.normal();
      });
      const stop = Math.round(t * NS);

      const sdePaths = [], odePaths = [];
      const sdeEnd = [], odeEnd = [];
      for (let p = 0; p < N; p++) {
        let xs = inits[p], xo = inits[p];
        const keepS = p < 8 ? [[0, xs]] : null;
        const keepO = p < 8 ? [[0, xo]] : null;
        for (let i = 1; i <= stop; i++) {
          const time = (i - 1) * dt;
          const g = Math.sqrt(beta);
          const f = -0.5 * beta;
          // SDE: dx = f·x dt + g dW
          xs += f * xs * dt + g * sq * rng.normal();
          // PF-ODE: dx = [f·x − ½g²·score] dt   (no noise)
          xo += (f * xo - 0.5 * g * g * score(xo, time)) * dt;
          if (keepS) { keepS.push([i * dt, xs]); keepO.push([i * dt, xo]); }
        }
        sdeEnd.push(xs); odeEnd.push(xo);
        if (keepS) { sdePaths.push(keepS); odePaths.push(keepO); }
      }

      ch.fit().clear();
      ch.axes({ xLabel: 't', yLabel: 'x' });
      sdePaths.forEach((p) => ch.curve(p, { color: 'rgba(6,69,173,.45)', width: 1 }));
      odePaths.forEach((p) => ch.curve(p, { color: 'rgba(249,115,22,.75)', width: 1.4 }));

      // Terminal histograms drawn in the SAME margin band and on a shared
      // scale, so "the two distributions coincide" is something the reader can
      // literally see rather than take on trust. SDE is filled, ODE outlined.
      const bsAll = densityBars(sdeEnd, -4, 4, 34);
      const boAll = densityBars(odeEnd, -4, 4, 34);
      const shared = Math.max(...bsAll.map((b) => b.value), ...boAll.map((b) => b.value), 1e-9);
      const X0PX = 1.06, WPX = 0.34;
      const barW = (v) => (v / shared) * (ch.px(X0PX + WPX) - ch.px(X0PX));
      ch.ctx.save();
      ch.ctx.fillStyle = 'rgba(6,69,173,.35)';
      bsAll.forEach((b) => {
        const y0 = ch.py(b.lo), y1 = ch.py(b.hi);
        ch.ctx.fillRect(ch.px(X0PX), y1, barW(b.value), y0 - y1);
      });
      ch.ctx.strokeStyle = 'rgba(249,115,22,.95)';
      ch.ctx.lineWidth = 1.8;
      ch.ctx.beginPath();
      boAll.forEach((b, i) => {
        const x = ch.px(X0PX) + barW(b.value);
        const y0 = ch.py(b.hi), y1 = ch.py(b.lo);
        if (i === 0) ch.ctx.moveTo(ch.px(X0PX), y1);
        ch.ctx.lineTo(x, y1);
        ch.ctx.lineTo(x, y0);
      });
      ch.ctx.stroke();
      ch.ctx.restore();
      ch.curve([[X0PX, -4], [X0PX, 4]], { color: 'rgba(0,0,0,.25)', width: 1 });

      // How close are the two marginals? Total variation over matching bins.
      const bs = densityBars(sdeEnd, -4, 4, 34), bo = densityBars(odeEnd, -4, 4, 34);
      const tv = 0.5 * bs.reduce(
        (s, b, i) => s + Math.abs(b.value - bo[i].value) * (b.hi - b.lo), 0);
      say('r-pf',
        tx(`t = ${fmt(t, 2)} &nbsp;·&nbsp; ${N} paths &nbsp;·&nbsp; `, `t = ${fmt(t, 2)} &nbsp;·&nbsp; 경로 ${N}개 &nbsp;·&nbsp; `) +
        `${dot('rgba(6,69,173,.8)', tx('SDE paths · endpoint distribution (filled)', 'SDE 경로 · 끝점 분포(채움)'))} &nbsp; ` +
        `${dot(C.orange, tx('PF-ODE paths · endpoint distribution (outline)', 'PF-ODE 경로 · 끝점 분포(외곽선)'))}<br>` +
        tx(`total variation distance between the two endpoint distributions ≈ <strong>${fmt(tv, 4)}</strong> `,
          `두 끝점 분포 사이의 총변동거리 ≈ <strong>${fmt(tv, 4)}</strong> `) +
        tx(`(it approaches 0 as the number of paths grows)<br>`, `(경로 수를 늘리면 0에 가까워집니다)<br>`) +
        (t < 0.05
          ? tx('Press "Play both". The two ensembles start from the same initial sample.',
            '"동시 재생"을 눌러보세요. 두 앙상블이 같은 초기 표본에서 출발합니다.')
          : tx('<strong>The path shapes are utterly unlike each other, yet the two histograms on the right overlap.</strong> ',
              '<strong>경로 모양은 딴판인데 오른쪽 히스토그램 두 개는 겹칩니다.</strong> ') +
            tx('Randomness was never required to produce the distribution — which is why a deterministic ODE sampler can use higher-order solvers, ',
              '무작위성은 분포를 만드는 데 필수가 아니었습니다 — 그래서 결정론적 ODE 샘플러로 고차 솔버를 쓰고, ') +
            tx('compute an exact log-likelihood, and run an image back to noise and regenerate it.',
              '정확한 로그가능도를 계산하고, 이미지를 노이즈로 되돌렸다 다시 생성할 수 있습니다.')));
    }
    const sl = slider('pf-t', (v) => { t = v; render(); });
    slider('pf-n', (v) => { N = Math.round(Math.pow(10, v)); render(); },
      (v) => String(Math.round(Math.pow(10, v))))._emit();
    const play = document.getElementById('pf-play');
    if (play) play.addEventListener('click', () => playback(sl, 3200));
    const btn = document.getElementById('pf-reseed');
    if (btn) btn.addEventListener('click', () => { seed = (seed * 1664525 + 1013904223) >>> 0; render(); });
    sl._emit();
  })();
})();
