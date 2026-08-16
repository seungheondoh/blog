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

  /* ------------------------------------------------------- 1. what is an ODE */

  (function odeIntro() {
    const EQS = {
      exp: { f: (t, x) => 0.8 * x, label: 'ẋ = 0.8x', note: tx('Exponential growth — the solution is Ce^{0.8t}', '지수 성장 — 해는 Ce^{0.8t}') },
      logistic: { f: (t, x) => x * (1 - x), label: 'ẋ = x(1 − x)', note: tx('Logistic — converges to x = 1; x = 0 is unstable', '로지스틱 — x = 1로 수렴, x = 0은 불안정') },
      decay: { f: (t, x) => -x + Math.sin(t), label: 'ẋ = −x + sin t', note: tx('Forced decay — forgets the initial condition and converges to a periodic solution', '강제 감쇠 — 초기 조건을 잊고 주기 해로 수렴') },
      sat: { f: (t, x) => t - x, label: 'ẋ = t − x', note: tx('Every solution is asymptotic to the line x = t − 1', '해가 모두 직선 x = t − 1에 점근') },
    };
    let kind = 'exp';
    const ch = chart('c-odeintro', { xMin: 0, xMax: 4, yMin: -2.2, yMax: 2.2 }, render);
    if (!ch) return;

    function render() {
      const { f, label, note } = EQS[kind];
      ch.fit().clear();
      slopeField(ch, f);
      ch.axes({ grid: false, xLabel: 't', yLabel: 'x' });
      const colors = [C.blue, C.orange, C.green, C.violet, C.red];
      [-1.5, -0.6, 0.15, 0.8, 1.6].forEach((x0, i) => {
        const sol = Calc.integrateODE(f, x0, 0, 4, 0.01, 'rk4')
          .map(([t, x]) => [t, clamp(x, -8, 8)]);
        ch.curve(sol, { color: colors[i], width: 2 });
        ch.points([[0, x0]], { color: colors[i], r: 3.5 });
      });
      say('r-odeintro',
        `<strong>${label}</strong> &nbsp;·&nbsp; ${note}<br>` +
        tx(`The short segments in the background are the direction field — all the equation tells us is <strong>the slope at each point</strong>. `,
          `배경의 짧은 선분이 기울기장입니다 — 방정식이 말해주는 것은 <strong>각 점에서의 기울기뿐</strong>입니다. `) +
        tx(`The coloured curves are solutions from different initial values, and every one is exactly tangent to the segment at its position.`,
          `색색의 곡선은 서로 다른 초기값에서 출발한 해이며, 모두 자기 위치의 선분에 정확히 접합니다.`));
    }
    presetGroup('ode-presets', ({ eq }) => { kind = eq; render(); });
    render();
  })();

  /* --------------------------------------------------------------- 2. IVP */

  (function ivp() {
    const EQS = {
      normal: { f: (t, x) => x * (1 - x) + 0.3 * Math.sin(2 * t), label: 'ẋ = x(1−x) + 0.3 sin 2t' },
      blowup: { f: (t, x) => x * x, label: 'ẋ = x²' },
      nonunique: { f: (t, x) => Math.sign(x) * Math.sqrt(Math.abs(x)), label: 'ẋ = sign(x)·√|x|' },
    };
    let kind = 'normal';
    const pt = { x: 0.3, y: 0.6 };
    const ch = chart('c-ivp', { xMin: 0, xMax: 3, yMin: -2, yMax: 2.4 }, render);
    if (!ch) return;

    function render() {
      const { f, label } = EQS[kind];
      ch.fit().clear();
      slopeField(ch, f);
      ch.axes({ grid: false, xLabel: 't', yLabel: 'x' });
      // Integrate forward and backward from the dragged initial condition.
      const fwd = Calc.integrateODE(f, pt.y, pt.x, 3, 0.005, 'rk4');
      const bwd = Calc.integrateODE((t, x) => -f(-t, x), pt.y, -pt.x, 0, 0.005, 'rk4')
        .map(([t, x]) => [-t, x]).reverse();
      const path = [...bwd, ...fwd].map(([t, x]) => [t, clamp(x, -6, 6)]);
      ch.curve(path, { color: C.blue, width: 2.4 });

      let extra = '';
      if (kind === 'nonunique' && Math.abs(pt.y) < 0.08) {
        // Both x ≡ 0 and x = (t−t0)²/4 solve this from the same point.
        ch.curve([[0, 0], [3, 0]], { color: C.orange, width: 2.4, dash: [6, 4] });
        const branch = [];
        for (let t = pt.x; t <= 3; t += 0.02) branch.push([t, ((t - pt.x) ** 2) / 4]);
        ch.curve(branch, { color: C.green, width: 2.4 });
        extra = tx('<br><strong>Two solutions emerge from the same initial point</strong> — √|x| violates the Lipschitz condition at the origin, so uniqueness is not guaranteed.',
          '<br><strong>같은 초기점에서 두 해가 나옵니다</strong> — √|x|는 원점에서 립시츠 조건을 어기므로 유일성이 보장되지 않습니다.');
      }
      if (kind === 'blowup' && pt.y > 0.05) {
        const tStar = pt.x + 1 / pt.y;   // solution x = 1/(1/x0 − (t−t0))
        if (tStar < 3) ch.vline(tStar, { color: C.red, label: tx(`blows up at t* = ${fmt(tStar, 2)}`, `t* = ${fmt(tStar, 2)} 에서 폭발`) });
        extra = tx(`<br>The solution \\(x = 1/(1/x_0 - (t-t_0))\\) <strong>diverges to infinity at the finite time t*</strong>. The equation is perfectly well behaved while the solution disappears.`,
          `<br>해는 \\(x = 1/(1/x_0 - (t-t_0))\\)로 <strong>유한 시간 t* 에서 무한대로 발산</strong>합니다. 방정식은 멀쩡한데 해가 사라집니다.`);
      }
      ch.points([[pt.x, pt.y]], { color: '#111', r: 5.5 });
      say('r-ivp',
        `<strong>${label}</strong> &nbsp;·&nbsp; ` +
        tx(`initial condition x(${fmt(pt.x, 2)}) = ${fmt(pt.y, 2)}<br>`, `초기조건 x(${fmt(pt.x, 2)}) = ${fmt(pt.y, 2)}<br>`) +
        tx(`Drag the point and the solution through it is selected — the equation gives a <em>family</em> of curves and the initial condition picks one.${extra}`,
          `점을 드래그하면 그 점을 지나는 해가 선택됩니다 — 방정식은 곡선의 <em>무리</em>를 주고, 초기조건이 그중 하나를 고릅니다.${extra}`));
    }
    presetGroup('ivp-presets', ({ eq }) => {
      kind = eq;
      if (kind === 'nonunique') { pt.x = 0.3; pt.y = 0; }
      if (kind === 'blowup') { pt.x = 0.2; pt.y = 0.6; }
      render();
    });
    draggablePoint(ch, pt, render);
    render();
  })();

  /* ------------------------------------------------------- 3. autonomous */

  (function autonomous() {
    const EQS = {
      auto: { f: (t, x) => x * (1 - x), label: 'ẋ = x(1 − x)' },
      nonauto: { f: (t, x) => x * Math.cos(t), label: 'ẋ = x·cos t' },
    };
    let kind = 'auto';
    const ch = chart('c-autonomous', { xMin: 0, xMax: 8, yMin: -0.6, yMax: 2 }, render);
    if (!ch) return;

    function render() {
      const { f, label } = EQS[kind];
      ch.fit().clear();
      slopeField(ch, f, { nt: 26, nx: 14 });
      ch.axes({ grid: false, xLabel: 't', yLabel: 'x' });
      const colors = [C.blue, C.orange, C.green, C.violet];
      // Same initial value, different start times — the tell for autonomy.
      [0, 1.6, 3.2, 4.8].forEach((t0, i) => {
        const sol = Calc.integrateODE(f, 0.25, t0, 8, 0.01, 'rk4').map(([t, x]) => [t, clamp(x, -3, 4)]);
        ch.curve(sol, { color: colors[i], width: 2 });
        ch.points([[t0, 0.25]], { color: colors[i], r: 4 });
      });
      say('r-autonomous',
        `<strong>${label}</strong> — ${kind === 'auto' ? tx('autonomous', '자율계') : tx('non-autonomous', '비자율계')}<br>` +
        tx(`All four curves start from <strong>the same value x = 0.25</strong>, differing only in their starting time. `,
          `네 곡선은 모두 <strong>같은 값 x = 0.25</strong>에서 출발하되 출발 시각만 다릅니다. `) +
        (kind === 'auto'
          ? tx('Being autonomous, the four curves are merely <strong>translations of one another</strong> and share a shape — each horizontal row of the direction field is identical too. "When" does not matter, only "where".',
            '자율계이므로 네 곡선은 <strong>서로를 평행이동한 것</strong>일 뿐 모양이 같습니다 — 기울기장의 각 가로줄도 동일합니다. "언제"는 중요하지 않고 "어디"만 중요합니다.')
          : tx('Being non-autonomous, <strong>the shape itself differs</strong> with the starting time, because the slope at the same height changes from instant to instant — the reason a diffusion model\'s network must take the time t as an input.',
            '비자율계라 출발 시각에 따라 <strong>모양 자체가 다릅니다.</strong> 같은 높이라도 시각마다 기울기가 달라지기 때문입니다 — 확산 모델의 신경망이 시각 t를 입력으로 받아야 하는 이유입니다.')));
    }
    presetGroup('auto-presets', ({ kind: k }) => { kind = k; render(); });
    render();
  })();

  /* ---------------------------------------------------- 4. phase portrait */

  (function phase() {
    const SYS = {
      sink: { F: (x, y) => [-x + 0.3 * y, -0.5 * y - 0.2 * x], label: tx('Stable node', '안정 마디'), fp: [0, 0] },
      saddle: { F: (x, y) => [x + 0.4 * y, -y], label: tx('Saddle', '안장'), fp: [0, 0] },
      spiral: { F: (x, y) => [-0.25 * x - y, x - 0.25 * y], label: tx('Spiral', '나선'), fp: [0, 0] },
      cycle: {
        F: (x, y) => { const r2 = x * x + y * y; return [y + x * (1 - r2), -x + y * (1 - r2)]; },
        label: tx('Limit cycle', '극한 순환'), fp: [0, 0],
      },
      lotka: {
        // Shifted so the centre sits inside the visible window.
        F: (x, y) => [(x + 2) * (1 - (y + 2) * 0.5), -(y + 2) * (1 - (x + 2) * 0.5)],
        label: tx('Predator–prey', '포식자–피식자'), fp: [0, 0],
      },
    };
    let kind = 'sink';
    let seeds = [];
    const ch = chart('c-phase', { xMin: -3, xMax: 3, yMin: -2.4, yMax: 2.4 }, render);
    if (!ch) return;

    function render() {
      const { F, label, fp } = SYS[kind];
      ch.fit().clear();
      ch.quiver(F, { nx: 17, ny: 14, scaled: true, color: 'rgba(60,60,60,.45)' });
      ch.axes({ grid: false, xLabel: 'x', yLabel: 'y' });
      seeds.forEach((s) => {
        const path = Calc.streamline(F, s, { dt: 0.02, steps: 500, bounds: [ch.xMin, ch.xMax, ch.yMin, ch.yMax] });
        if (path.length > 1) ch.curve(path, { color: C.orange, width: 2 });
        ch.points([s], { color: C.orange, r: 4 });
      });
      ch.points([fp], { color: C.green, r: 5.5 });

      const J = Calc.jacobian2(F, fp[0], fp[1]);
      const eig = LA.eig2(J);
      let verdict;
      if (!eig) {
        // Complex pair: classify from the trace, which is 2·Re(λ).
        const tr = J[0] + J[3];
        verdict = tr < -1e-6
          ? tx('<strong>Stable spiral</strong> — the eigenvalues are complex, so it rotates while winding inward',
            '<strong>안정 나선</strong> — 고유값이 복소수라 회전하며 감겨 들어갑니다')
          : tr > 1e-6 ? tx('<strong>Unstable spiral</strong> — it rotates while unwinding outward',
            '<strong>불안정 나선</strong> — 회전하며 풀려 나갑니다')
          : tx('<strong>Centre</strong> — pure rotation, closed orbits', '<strong>중심</strong> — 순수 회전, 닫힌 궤도');
      } else {
        const [l1, l2] = eig.values;
        verdict = (l1 < 0 && l2 < 0)
          ? tx('<strong>Stable node</strong> — drawn in from every direction', '<strong>안정 마디</strong> — 모든 방향에서 빨려 들어갑니다')
          : (l1 > 0 && l2 > 0) ? tx('<strong>Unstable node</strong>', '<strong>불안정 마디</strong>')
          : tx('<strong>Saddle</strong> — attracted along one direction and repelled along another',
            '<strong>안장</strong> — 한 방향은 끌리고 다른 방향은 밀려납니다');
        verdict += ` &nbsp;·&nbsp; λ = ${fmt(l1, 2)}, ${fmt(l2, 2)}`;
      }
      say('r-phase',
        `<strong>${label}</strong> &nbsp;·&nbsp; ` +
        tx(`Jacobian at the origin J = [[${fmt(J[0], 2)}, ${fmt(J[1], 2)}], [${fmt(J[2], 2)}, ${fmt(J[3], 2)}]]<br>`,
          `원점 야코비안 J = [[${fmt(J[0], 2)}, ${fmt(J[1], 2)}], [${fmt(J[2], 2)}, ${fmt(J[3], 2)}]]<br>`) +
        `${verdict}<br>` +
        (kind === 'cycle' ? tx('The fixed point is unstable, yet trajectories converge to <strong>a closed loop of radius 1</strong> — a limit cycle. ',
            '고정점은 불안정하지만 궤적이 <strong>반지름 1의 닫힌 고리</strong>로 수렴합니다 — 극한 순환입니다. ')
          : kind === 'lotka' ? tx('The trajectories draw closed loops and <strong>circulate forever</strong> — predator and prey populations oscillate out of phase. ',
            '궤적이 닫힌 고리를 그리며 <strong>영원히 순환</strong>합니다 — 포식자와 피식자 개체수가 위상차를 두고 진동합니다. ') : '') +
        tx(`Click the figure to draw the trajectory starting there (${seeds.length} so far).`,
          `그림을 클릭하면 그 점에서 출발한 궤적이 그려집니다 (${seeds.length}개).`));
    }
    presetGroup('phase-presets', ({ sys }) => { kind = sys; seeds = []; render(); });
    ch.canvas.style.cursor = 'crosshair';
    ch.canvas.addEventListener('click', (e) => {
      const [x, y] = ch.eventXY(e);
      if (seeds.length >= 8) seeds.shift();
      seeds.push([x, y]);
      render();
    });
    const clr = document.getElementById('phase-clear');
    if (clr) clr.addEventListener('click', () => { seeds = []; render(); });
    render();
  })();

  /* -------------------------------------------------------------- 5. euler */

  (function euler() {
    // ẋ = t − x. Chosen because its Euler error is *monotone* in Δt across the
    // whole slider range, so the "halve Δt, halve the error" claim in the prose
    // holds wherever the reader drags. Oscillatory forcing makes the error
    // change sign at coarse Δt, which would contradict the text on screen.
    const f = (t, x) => t - x;
    const X0 = 1.4, T = 4;
    let dt = 0.5;
    const ch = chart('c-euler', { xMin: 0, xMax: T, yMin: 0.4, yMax: 3.5 }, render);
    if (!ch) return;

    function render() {
      ch.fit().clear();
      slopeField(ch, f, { nt: 24, nx: 14, color: 'rgba(90,90,90,.28)' });
      ch.axes({ grid: false, xLabel: 't', yLabel: 'x' });
      const exact = Calc.integrateODE(f, X0, 0, T, 0.002, 'rk4');
      ch.curve(exact, { color: '#8c8c8c', width: 2.4 });
      const approx = Calc.integrateODE(f, X0, 0, T, dt, 'euler');
      ch.curve(approx, { color: C.orange, width: 2 });
      approx.forEach(([t, x]) => ch.points([[t, x]], { color: C.orange, r: 3.2 }));
      // Show one step's tangent explicitly.
      if (approx.length > 1) {
        const [t0, x0] = approx[0];
        const s = f(t0, x0);
        ch.curve([[t0, x0], [t0 + dt, x0 + s * dt]], { color: C.red, width: 2.4 });
      }
      const err = Math.abs(approx[approx.length - 1][1] - exact[exact.length - 1][1]);
      say('r-euler',
        tx(`Δt = ${fmt(dt, 3)} &nbsp;·&nbsp; steps = ${approx.length - 1} &nbsp;·&nbsp; `,
          `Δt = ${fmt(dt, 3)} &nbsp;·&nbsp; 걸음 수 = ${approx.length - 1} &nbsp;·&nbsp; `) +
        `${dot('#8c8c8c', tx('true solution', '참 해'))} vs ${dot(C.orange, tx('Euler approximation', '오일러 근사'))} &nbsp;·&nbsp; ` +
        tx(`<strong>final error = ${fmt(err, 5)}</strong><br>`, `<strong>최종 오차 = ${fmt(err, 5)}</strong><br>`) +
        `${dot(C.red, tx('the red line', '빨간 선'))} ` +
        tx(`is the tangent of the first step — it reads only the slope at the start and goes straight. `,
          `이 첫 걸음의 접선입니다 — 출발점의 기울기만 읽고 직진합니다. `) +
        tx(`<strong>Halving Δt roughly halves the error</strong> (first-order accuracy). `,
          `<strong>Δt를 절반으로 줄이면 오차도 대략 절반이 됩니다</strong>(1차 정확도). `) +
        tx(`Note that the approximation is displaced <strong>systematically</strong> to one side of the true solution — a bias, not a random error.`,
          `근사가 참 해의 한쪽으로 <strong>체계적으로</strong> 치우치는 것에 주목하세요 — 무작위 오차가 아니라 편향입니다.`));
    }
    slider('eul-dt', (v) => { dt = v; render(); }, (v) => fmt(v, 3))._emit();
  })();

  /* -------------------------------------------------------- 6. Runge-Kutta */

  (function rk() {
    // Same ODE as the Euler section, for the same reason: a monotone error curve
    // means the log–log plot is a clean straight line whose slope is the order,
    // rather than a line with sign-change dips in it.
    const f = (t, x) => t - x;
    const X0 = 1.4, T = 4;
    let dt = 0.5;
    const ch = chart('c-rk', { xMin: 0, xMax: T, yMin: 0.4, yMax: 3.5 }, render);
    const chE = chart('c-rk-error', { xMin: -2.4, xMax: 0.2, yMin: -14, yMax: 1 }, render);
    if (!ch) return;

    const truth = Calc.integrateODE(f, X0, 0, T, 0.0005, 'rk4');
    const truthEnd = truth[truth.length - 1][1];
    const errAt = (h, method) => {
      const s = Calc.integrateODE(f, X0, 0, T, h, method);
      return Math.abs(s[s.length - 1][1] - truthEnd);
    };

    function render() {
      ch.fit().clear();
      ch.axes({ xLabel: 't', yLabel: 'x' });
      ch.curve(truth, { color: '#8c8c8c', width: 2.6 });
      const styles = [['euler', C.orange, tx('Euler', '오일러')], ['rk2', C.green, tx('Midpoint', '중점법')], ['rk4', C.violet, 'RK4']];
      styles.forEach(([m, col]) => ch.curve(Calc.integrateODE(f, X0, 0, T, dt, m), { color: col, width: 1.9 }));

      if (chE) {
        chE.fit().clear();
        chE.axes({ xLabel: 'log₁₀ Δt', yLabel: tx('log₁₀ error', 'log₁₀ 오차') });
        styles.forEach(([m, col]) => {
          const pts = [];
          for (let e = -2.3; e <= 0.1; e += 0.1) {
            const h = Math.pow(10, e);
            const err = errAt(h, m);
            if (err > 0) pts.push([e, clamp(Math.log10(err), -10, 2)]);
          }
          chE.curve(pts, { color: col, width: 2 });
        });
        chE.vline(Math.log10(dt), { color: '#111', dash: [3, 3], width: 1.2 });
      }
      const [e1, e2, e4] = ['euler', 'rk2', 'rk4'].map((m) => errAt(dt, m));
      say('r-rk',
        `Δt = ${fmt(dt, 3)} &nbsp;·&nbsp; ${dot(C.orange, tx(`Euler ${e1.toExponential(2)}`, `오일러 ${e1.toExponential(2)}`))} &nbsp; ` +
        `${dot(C.green, tx(`Midpoint ${e2.toExponential(2)}`, `중점법 ${e2.toExponential(2)}`))} &nbsp; ${dot(C.violet, `RK4 ${e4.toExponential(2)}`)}<br>` +
        tx(`At the same Δt, RK4 is <strong>${(e1 / Math.max(e4, 1e-16)).toExponential(1)}×</strong> more accurate than Euler. `,
          `같은 Δt에서 RK4가 오일러보다 <strong>${(e1 / Math.max(e4, 1e-16)).toExponential(1)}배</strong> 정확합니다. `) +
        tx(`In the log–log graph below, <strong>the slope of the line is the order of accuracy</strong> — they separate as 1, 2 and 4.`,
          `아래 로그–로그 그래프에서 <strong>직선의 기울기가 곧 정확도 차수</strong>입니다 — 1, 2, 4로 갈라집니다.`));
    }
    slider('rk-dt', (v) => { dt = v; render(); }, (v) => fmt(v, 3))._emit();
  })();

  /* ------------------------------------------------------- 7. stability */

  (function stability() {
    let dt = 0.3, lam = -3;
    const ch = chart('c-stability', { xMin: 0, xMax: 6, yMin: -2.2, yMax: 2.2 }, render);
    if (!ch) return;

    function render() {
      const crit = 2 / Math.abs(lam);
      ch.fit().clear();
      ch.axes({ xLabel: 't', yLabel: 'x' });
      ch.hline(0, { color: C.muted, dash: [3, 3] });
      ch.curve((t) => Math.exp(lam * t), { color: '#8c8c8c', width: 2.4 });

      // Forward Euler: x_{n+1} = (1 + λΔt) x_n
      const fw = [], bw = [];
      let xf = 1, xb = 1;
      for (let n = 0; n * dt <= 6; n++) {
        fw.push([n * dt, clamp(xf, -50, 50)]);
        bw.push([n * dt, clamp(xb, -50, 50)]);
        xf *= (1 + lam * dt);
        xb /= (1 - lam * dt);
      }
      ch.curve(fw, { color: C.orange, width: 2 });
      fw.forEach((p) => ch.points([p], { color: C.orange, r: 2.6 }));
      ch.curve(bw, { color: C.violet, width: 1.8, dash: [5, 3] });

      const amp = Math.abs(1 + lam * dt);
      say('r-stability',
        tx(`λ = ${fmt(lam, 1)} &nbsp;·&nbsp; Δt = ${fmt(dt, 2)} &nbsp;·&nbsp; critical value 2/|λ| = <strong>${fmt(crit, 3)}</strong><br>`,
          `λ = ${fmt(lam, 1)} &nbsp;·&nbsp; Δt = ${fmt(dt, 2)} &nbsp;·&nbsp; 임계값 2/|λ| = <strong>${fmt(crit, 3)}</strong><br>`) +
        tx(`amplification |1 + λΔt| = <strong>${fmt(amp, 3)}</strong> &nbsp;·&nbsp; `,
          `증폭률 |1 + λΔt| = <strong>${fmt(amp, 3)}</strong> &nbsp;·&nbsp; `) +
        `${dot('#8c8c8c', tx('true solution', '참 해'))} &nbsp; ${dot(C.orange, tx('forward Euler', '전진 오일러'))} &nbsp; ` +
        `${dot(C.violet, tx('backward Euler', '후진 오일러'))}<br>` +
        (amp > 1
          ? tx('<strong>Unstable!</strong> The amplification exceeds 1, so it flips sign every step and explodes — even though the true solution heads quietly to 0. This is a matter of <em>stability</em>, not accuracy. Backward Euler (violet) is fine at the same Δt.',
            '<strong>불안정!</strong> 증폭률이 1을 넘어 매 걸음 부호를 뒤집으며 폭발합니다. 참 해는 얌전히 0으로 가는데도 그렇습니다 — 정확도가 아니라 <em>안정성</em>의 문제입니다. 후진 오일러(보라)는 같은 Δt에서도 멀쩡합니다.')
          : tx('Δt is below the critical value, so it is stable. Push Δt past the critical value or make λ more negative — that the allowed Δt narrows as λ grows is the <strong>stiffness problem</strong>.',
            'Δt가 임계값 아래라 안정적입니다. Δt를 임계값 너머로 밀거나 λ를 더 음수로 만들어보세요 — λ가 커질수록 허용되는 Δt가 좁아지는 것이 <strong>강성 문제</strong>입니다.')) +
        tx(`<br>The same calculation gives the learning-rate bound η &lt; 2/λ<sub>max</sub>(H) for gradient descent.`,
          `<br>같은 계산이 경사하강법의 학습률 상한 η &lt; 2/λ<sub>max</sub>(H)를 줍니다.`));
    }
    slider('stab-dt', (v) => { dt = v; render(); })._emit();
    slider('stab-lam', (v) => { lam = v; render(); }, (v) => fmt(v, 1))._emit();
  })();

  /* ----------------------------------------------------------- 8. flows */

  (function flows() {
    const FIELDS = {
      incompressible: { F: (x, y) => [-y, x], label: tx('Rotation (∇·f = 0)', '회전 (∇·f = 0)') },
      contract: { F: (x, y) => [-0.6 * x, -0.6 * y], label: tx('Contraction (∇·f = −1.2)', '수축 (∇·f = −1.2)') },
      shear: { F: (x, y) => [0.8 * y, 0], label: tx('Shear (∇·f = 0)', '전단 (∇·f = 0)') },
    };
    let kind = 'incompressible', t = 0;
    const ch = chart('c-flows', { xMin: -3, xMax: 3, yMin: -2.4, yMax: 2.4 }, render);
    if (!ch) return;

    // Push a point through the flow for time t (t may be negative).
    const advect = (p, time, F) => {
      if (Math.abs(time) < 1e-9) return p.slice();
      const dir = Math.sign(time);
      const f = (s, y) => { const [u, v] = F(y[0], y[1]); return [dir * u, dir * v]; };
      const sol = Calc.integrateODE(f, p.slice(), 0, Math.abs(time), 0.01, 'rk4');
      return sol[sol.length - 1][1];
    };

    function render() {
      const { F, label } = FIELDS[kind];
      ch.fit().clear();
      ch.quiver(F, { nx: 15, ny: 12, scaled: true, color: 'rgba(60,60,60,.32)' });
      ch.axes({ grid: false, xLabel: 'x', yLabel: 'y' });
      // A grid of material points, carried by the flow.
      for (let i = -2; i <= 2; i++) {
        for (const dir of [0, 1]) {
          const line = [];
          for (let s = -2; s <= 2; s += 0.1) {
            line.push(advect(dir ? [i, s] : [s, i], t, F));
          }
          ch.curve(line, { color: 'rgba(160,160,160,.65)', width: 1 });
        }
      }
      const sq = [[0.4, 0.4], [1.4, 0.4], [1.4, 1.4], [0.4, 1.4], [0.4, 0.4]];
      const dense = [];
      for (let i = 0; i < 4; i++) {
        for (let s = 0; s < 1; s += 0.05) {
          const a = sq[i], b = sq[i + 1];
          dense.push([a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s]);
        }
      }
      dense.push(dense[0]);
      const moved = dense.map((p) => advect(p, t, F));
      ch.curve(moved, { color: C.orange, width: 2.4 });

      // Shoelace area of the transported square.
      let area = 0;
      for (let i = 0; i < moved.length - 1; i++) {
        area += moved[i][0] * moved[i + 1][1] - moved[i + 1][0] * moved[i][1];
      }
      area = Math.abs(area) / 2;
      const div = Calc.divergence2(F, 0.9, 0.9);
      say('r-flows',
        `<strong>${label}</strong> &nbsp;·&nbsp; t = ${fmt(t, 2)} &nbsp;·&nbsp; ∇·f = ${fmt(div, 2)} &nbsp;·&nbsp; ` +
        tx(`area of the orange square = <strong>${fmt(area, 4)}</strong> (initially 1.000)<br>`,
          `주황 사각형의 넓이 = <strong>${fmt(area, 4)}</strong> (처음 1.000)<br>`) +
        (Math.abs(div) < 1e-6
          ? tx('The divergence is 0, so <strong>the shape distorts but the area is exactly preserved</strong> — an incompressible flow.',
            '발산이 0이라 <strong>모양은 찌그러져도 넓이는 정확히 보존</strong>됩니다 — 비압축 흐름입니다.')
          : tx(`The divergence is ${div > 0 ? 'positive, so it expands' : 'negative, so it contracts'}. Compare with the prediction e^(∇·f · t) = ${fmt(Math.exp(div * t), 4)}.`,
            `발산이 ${div > 0 ? '양수라 팽창' : '음수라 수축'}합니다. 예측값 e^(∇·f · t) = ${fmt(Math.exp(div * t), 4)}와 비교해보세요.`)) +
        tx(` Turn t negative and it returns exactly to its original place — <strong>a flow is always invertible</strong>.`,
          ` t를 음수로 돌리면 정확히 원래 자리로 돌아옵니다 — <strong>흐름은 언제나 가역</strong>입니다.`));
    }
    presetGroup('flow-presets', ({ field }) => { kind = field; render(); });
    const sl = slider('flow-t', (v) => { t = v; render(); });
    const play = document.getElementById('flow-play');
    if (play) play.addEventListener('click', () => playback(sl, 2600, 0, 2));
    sl._emit();
  })();

  /* ------------------------------------------------------ 9. what is a PDE */

  (function pdeIntro() {
    const u0 = (x) => Math.exp(-((x - 0.35) ** 2) / 0.006) + 0.7 * Math.exp(-((x - 0.62) ** 2) / 0.002);
    let kind = 'transport', t = 0;
    const ch = chart('c-pdeintro', { xMin: 0, xMax: 1, yMin: -0.4, yMax: 1.5 }, render);
    const chST = chart('c-pdeintro-st', { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, render);
    if (!ch) return;

    // Closed-form-ish evaluation so the space–time panel is cheap to paint.
    const solve = (x, time) => {
      if (kind === 'transport') return u0(x - 0.45 * time);
      if (kind === 'wave') return 0.5 * u0(x - 0.45 * time) + 0.5 * u0(x + 0.45 * time);
      // Heat: convolve the two initial Gaussians with the heat kernel.
      const k = 1 + 55 * time;
      return Math.exp(-((x - 0.35) ** 2) / (0.006 * k)) / Math.sqrt(k)
        + 0.7 * Math.exp(-((x - 0.62) ** 2) / (0.002 * k)) / Math.sqrt(k);
    };

    function render() {
      ch.fit().clear();
      ch.axes({ xLabel: 'x', yLabel: 'u' });
      ch.curve((x) => u0(x), { color: 'rgba(140,140,140,.75)', width: 1.5, dash: [4, 3] });
      ch.curve((x) => solve(x, t), { color: C.blue, width: 2.4, fill: 'rgba(6,69,173,.10)' });

      if (chST) {
        chST.fit().clear();
        chST.heat((x, tt) => solve(x, tt), {
          res: 3, alpha: 0.95, min: 0, max: 1.2,
          ramp: (v) => { const k = clamp(v, 0, 1); return [255 - 210 * k, 255 - 186 * k, 255 - 82 * k]; },
        });
        chST.axes({ grid: false, xLabel: 'x', yLabel: 't' });
        chST.hline(t, { color: C.orange, width: 1.6, dash: [] });
      }
      say('r-pdeintro',
        `t = ${fmt(t, 2)} &nbsp;·&nbsp; ` +
        (kind === 'transport' ? tx('<strong>Transport</strong> — the shape does not change in the slightest and is carried bodily to the right. The <strong>slanted stripes</strong> in the space–time picture are the characteristics. Rewinding restores it perfectly.',
            '<strong>수송</strong> — 모양이 조금도 변하지 않고 통째로 오른쪽으로 실려갑니다. 시공간 그림의 <strong>기울어진 줄무늬</strong>가 특성곡선입니다. 되감으면 완벽히 복원됩니다.')
          : kind === 'heat' ? tx('<strong>Diffusion</strong> — the peaks blur and the narrow ones vanish first. It spreads as you move upward in the space–time picture, and <strong>rewinding does not restore it</strong> (irreversible).',
            '<strong>확산</strong> — 봉우리가 뭉개지고 좁은 것이 먼저 사라집니다. 시공간 그림에서 위로 갈수록 번지며, <strong>되감아도 복원되지 않습니다</strong>(비가역).')
          : tx('<strong>Wave</strong> — the initial shape splits into two and propagates in opposite directions. It moves at finite speed and is reversible.',
            '<strong>파동</strong> — 초기 모양이 좌우 두 개로 갈라져 반대 방향으로 전파합니다. 유한한 속도로 움직이며 가역적입니다.')));
    }
    presetGroup('pde-presets', ({ eq }) => { kind = eq; render(); });
    const sl = slider('pde-t', (v) => { t = v; render(); });
    const play = document.getElementById('pde-play');
    if (play) play.addEventListener('click', () => playback(sl, 2600));
    sl._emit();
  })();

  /* ------------------------------------------------------- 10. transport */

  (function transport() {
    const u0 = (x) => Math.exp(-((x - 0.3) ** 2) / 0.004) + 0.6 * Math.max(0, 1 - Math.abs(x - 0.6) / 0.08);
    let c = 1, t = 0;
    const wrap = (x) => x - Math.floor(x);
    const ch = chart('c-transport', { xMin: 0, xMax: 1, yMin: -0.2, yMax: 1.35 }, render);
    const chST = chart('c-transport-st', { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, render);
    if (!ch) return;

    function render() {
      ch.fit().clear();
      ch.axes({ xLabel: 'x', yLabel: 'u' });
      ch.curve((x) => u0(x), { color: 'rgba(140,140,140,.7)', width: 1.4, dash: [4, 3] });
      ch.curve((x) => u0(wrap(x - c * t)), { color: C.blue, width: 2.4, fill: 'rgba(6,69,173,.10)', samples: 500 });
      if (chST) {
        chST.fit().clear();
        chST.heat((x, tt) => u0(wrap(x - c * tt)), {
          res: 3, alpha: 0.95, min: 0, max: 1.1,
          ramp: (v) => { const k = clamp(v, 0, 1); return [255 - 210 * k, 255 - 186 * k, 255 - 82 * k]; },
        });
        chST.axes({ grid: false, xLabel: 'x', yLabel: 't' });
        chST.hline(t, { color: C.orange, width: 1.6, dash: [] });
      }
      say('r-transport',
        tx(`c = ${fmt(c, 2)} &nbsp;·&nbsp; t = ${fmt(t, 2)} &nbsp;·&nbsp; displacement ct = ${fmt(c * t, 3)}<br>`,
          `c = ${fmt(c, 2)} &nbsp;·&nbsp; t = ${fmt(t, 2)} &nbsp;·&nbsp; 이동거리 ct = ${fmt(c * t, 3)}<br>`) +
        tx(`The solution is <strong>u(t,x) = u₀(x − ct)</strong> — the shape does not change at all. `,
          `해는 <strong>u(t,x) = u₀(x − ct)</strong> — 모양이 조금도 변하지 않습니다. `) +
        tx(`The slope of the stripes in the space–time picture below is the speed, and along those lines <strong>u is constant</strong> (the characteristics). `,
          `아래 시공간 그림의 줄무늬 기울기가 곧 속도이며, 그 선을 따라가면 <strong>u가 상수</strong>입니다(특성곡선). `) +
        tx(`Negative c flows left, and rewinding t restores it perfectly — transport loses no information.`,
          `c를 음수로 하면 왼쪽으로 흐르고, t를 되감으면 완벽하게 복원됩니다 — 수송은 정보를 잃지 않습니다.`));
    }
    slider('tr-c', (v) => { c = v; render(); })._emit();
    const sl = slider('tr-t', (v) => { t = v; render(); });
    const play = document.getElementById('tr-play');
    if (play) play.addEventListener('click', () => playback(sl, 2600));
    sl._emit();
  })();

  /* ------------------------------------------------------ 11. continuity */

  (function continuity() {
    const VS = {
      const: { v: () => 0.35, label: tx('Constant speed v = 0.35', '일정 속도 v = 0.35') },
      squeeze: { v: (x) => 0.9 * (0.5 - x), label: tx('Gather to a point v = 0.9(0.5 − x)', '한 점으로 모음 v = 0.9(0.5 − x)') },
      spread: { v: (x) => 0.7 * (x - 0.5), label: tx('Push apart v = 0.7(x − 0.5)', '밀어냄 v = 0.7(x − 0.5)') },
    };
    let kind = 'const', t = 0;
    const N = 4000;
    const ch = chart('c-continuity', { xMin: 0, xMax: 1, yMin: 0, yMax: 6 }, render);
    if (!ch) return;
    const rng0 = RNG(5);
    const x0s = Array.from({ length: N }, () => 0.28 + 0.075 * rng0.normal());

    function render() {
      const { v, label } = VS[kind];
      // Transport each particle deterministically; the histogram is then the
      // solution of the continuity equation for that velocity field.
      const xs = x0s.map((x) => {
        const sol = Calc.integrateODE((s, y) => v(y), x, 0, Math.max(t, 1e-9), 0.01, 'rk4');
        return sol[sol.length - 1][1];
      });
      ch.fit().clear();
      ch.axes({ xLabel: 'x', yLabel: 'ρ' });
      ch.bars(densityBars(xs, 0, 1, 60), { color: 'rgba(6,69,173,.28)', stroke: 'rgba(6,69,173,.55)' });
      ch.curve((x) => gaussPdf(x, 0.28, 0.075), { color: 'rgba(140,140,140,.8)', width: 1.4, dash: [4, 3] });
      const mass = densityBars(xs, 0, 1, 60).reduce((s, b) => s + b.value * (b.hi - b.lo), 0);
      const sd = Math.sqrt(xs.reduce((s, x) => s + (x - xs.reduce((a, b) => a + b, 0) / N) ** 2, 0) / N);
      say('r-continuity',
        `<strong>${label}</strong> &nbsp;·&nbsp; t = ${fmt(t, 2)} &nbsp;·&nbsp; ` +
        tx(`standard deviation = ${fmt(sd, 4)} &nbsp;·&nbsp; `, `표준편차 = ${fmt(sd, 4)} &nbsp;·&nbsp; `) +
        tx(`<strong>total mass = ${fmt(mass, 4)}</strong> (always 1)<br>`, `<strong>총 질량 = ${fmt(mass, 4)}</strong> (언제나 1)<br>`) +
        (kind === 'squeeze' ? tx('The velocity field converges to a point, so the density <strong>piles up and sharpens</strong> — a region where ∇·v &lt; 0. ',
            '속도장이 한 점으로 수렴하니 밀도가 <strong>쌓여 뾰족해집니다</strong> — ∇·v < 0인 구간입니다. ')
          : kind === 'spread' ? tx('The velocity field pushes apart, so the density <strong>thins</strong> — ∇·v &gt; 0. ',
            '속도장이 밀어내니 밀도가 <strong>옅어집니다</strong> — ∇·v > 0입니다. ')
          : tx('With constant speed ∇·v = 0, so <strong>the shape is carried along unchanged</strong> — the transport equation. ',
            '속도가 일정하면 ∇·v = 0이라 <strong>모양이 그대로 실려갑니다</strong> — 수송방정식입니다. ')) +
        tx(`However the shape changes, the total mass under the curve is <strong>conserved at 1</strong>.`,
          `모양이 어떻게 변하든 곡선 아래 총 질량은 <strong>1로 보존</strong>됩니다.`));
    }
    presetGroup('cont-presets', ({ v }) => { kind = v; render(); });
    const sl = slider('cont-t', (v) => { t = v; render(); });
    const play = document.getElementById('cont-play');
    if (play) play.addEventListener('click', () => playback(sl, 2600));
    sl._emit();
  })();

  /* ----------------------------------------------------------- 12. heat */

  (function heat() {
    // Work in Fourier space: each mode decays as exp(-α k² t), which is both the
    // exact solution and exactly the point the section is making.
    const K = 26;
    const coef = Array.from({ length: K }, (_, i) => {
      const k = i + 1;
      // A square-ish bump: odd harmonics with 1/k amplitude.
      return (k % 2 ? 1 : 0) * (1.1 / k) * Math.sin(k * 1.1);
    });
    let alpha = 1, t = 0;
    const ch = chart('c-heat', { xMin: 0, xMax: Math.PI * 2, yMin: -1.2, yMax: 1.2 }, render);
    const chF = chart('c-heat-freq', { xMin: 0.5, xMax: K + 0.5, yMin: 0, yMax: 1.2 }, render);
    if (!ch) return;

    const u = (x, time) => coef.reduce((s, c, i) => {
      const k = i + 1;
      return s + c * Math.sin(k * x) * Math.exp(-alpha * k * k * time * 0.08);
    }, 0);

    function render() {
      ch.fit().clear();
      ch.axes({ xLabel: 'x', yLabel: 'u' });
      ch.hline(0, { color: C.muted, dash: [3, 3] });
      ch.curve((x) => u(x, 0), { color: 'rgba(140,140,140,.75)', width: 1.4, dash: [4, 3] });
      ch.curve((x) => u(x, t), { color: C.blue, width: 2.4 });

      if (chF) {
        chF.fit().clear();
        chF.axes({ xLabel: tx('k (frequency)', 'k (주파수)'), yLabel: tx('|coefficient|', '|계수|') });
        chF.bars(coef.map((c, i) => ({
          lo: i + 0.6, hi: i + 1.4,
          value: Math.abs(c) * Math.exp(-alpha * (i + 1) ** 2 * t * 0.08),
        })), { color: 'rgba(6,69,173,.35)', stroke: 'rgba(6,69,173,.6)' });
        chF.curve(coef.map((c, i) => [i + 1, Math.abs(c)]),
          { color: 'rgba(140,140,140,.8)', width: 1.4, dash: [3, 3] });
      }
      // Which modes survive? Report the highest with >5% of its initial size.
      let alive = 0;
      coef.forEach((c, i) => { if (Math.exp(-alpha * (i + 1) ** 2 * t * 0.08) > 0.05 && Math.abs(c) > 1e-6) alive = i + 1; });
      say('r-heat',
        `α = ${fmt(alpha, 2)} &nbsp;·&nbsp; t = ${fmt(t, 2)} &nbsp;·&nbsp; ` +
        tx(`highest surviving frequency k ≈ <strong>${alive}</strong><br>`, `살아남은 최고 주파수 k ≈ <strong>${alive}</strong><br>`) +
        tx(`Each mode decays as <strong>e^(−αk²t)</strong> — k enters the exponent <em>squared</em>, so `,
          `각 모드는 <strong>e^(−αk²t)</strong>로 감쇠합니다 — 지수에 k가 <em>제곱</em>으로 들어가므로 `) +
        tx(`high frequencies (the fine structure) die overwhelmingly faster. This is why diffusion is irreversible: `,
          `고주파(세부 구조)가 압도적으로 빨리 죽습니다. 그래서 확산은 비가역입니다: `) +
        tx(`reviving the lost high frequencies would require multiplying by e^(+αk²t), which blows up even the faintest noise.`,
          `사라진 고주파를 되살리려면 e^(+αk²t)를 곱해야 하는데, 그것은 미세한 잡음까지 폭발시킵니다.`));
    }
    slider('heat-a', (v) => { alpha = v; render(); })._emit();
    const sl = slider('heat-t', (v) => { t = v; render(); });
    const play = document.getElementById('heat-play');
    if (play) play.addEventListener('click', () => playback(sl, 2800));
    sl._emit();
  })();

  /* -------------------------------------------------- 13. particle to density */

  (function particleDensity() {
    const v = (x) => 0.9 * (0.55 - x) + 0.25;
    let N = 200, t = 0;
    const chP = chart('c-particle', { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, render);
    const chD = chart('c-particle-density', { xMin: 0, xMax: 1, yMin: 0, yMax: 7 }, render);
    if (!chP) return;
    const rng0 = RNG(17);
    const pool = Array.from({ length: 4000 }, () => 0.25 + 0.07 * rng0.normal());
    const jitter = Array.from({ length: 4000 }, () => rng0.uniform());

    const move = (x, time) => {
      if (time < 1e-9) return x;
      const sol = Calc.integrateODE((s, y) => v(y), x, 0, time, 0.01, 'rk4');
      return sol[sol.length - 1][1];
    };

    function render() {
      const xs = pool.slice(0, N).map((x) => move(x, t));
      chP.fit().clear();
      chP.axes({ grid: false, yTicks: [], yTickLabels: false, xLabel: 'x' });
      xs.forEach((x, i) => chP.points([[x, 0.2 + 0.6 * jitter[i]]], { color: 'rgba(6,69,173,.55)', r: 2.2 }));

      if (chD) {
        chD.fit().clear();
        chD.axes({ xLabel: 'x', yLabel: 'ρ' });
        chD.bars(densityBars(xs, 0, 1, 48), { color: 'rgba(6,69,173,.25)', stroke: 'rgba(6,69,173,.5)' });
        // Reference: transport a fine ensemble, which approximates the PDE solution.
        const fine = pool.map((x) => move(x, t));
        chD.curve(densityBars(fine, 0, 1, 90).map((b) => [(b.lo + b.hi) / 2, b.value]),
          { color: C.orange, width: 2.2 });
      }
      say('r-particle',
        `N = ${N} &nbsp;·&nbsp; t = ${fmt(t, 2)} &nbsp;·&nbsp; ` +
        `${dot('rgba(6,69,173,.7)', tx('histogram of N particles', 'N개 입자의 히스토그램'))} vs ` +
        `${dot(C.orange, tx('solution of the continuity equation (N → ∞)', '연속방정식의 해 (N → ∞)'))}<br>` +
        (N < 40
          ? tx('N is small, so the histogram is <strong>lumpy</strong> — the noise of a finite sample.',
            'N이 작아 히스토그램이 <strong>울퉁불퉁</strong>합니다 — 유한 표본의 잡음입니다.')
          : N > 800
            ? tx('N is large, so the two curves <strong>almost coincide</strong> — the language of particles and the language of densities are saying the same thing.',
              'N이 크니 두 곡선이 <strong>거의 겹칩니다</strong> — 입자의 언어와 밀도의 언어가 같은 것을 말하고 있습니다.')
            : tx('The larger N, the more the histogram converges onto the orange curve.',
              'N을 늘릴수록 히스토그램이 주황 곡선에 수렴합니다.')) +
        tx(` Note that the <strong>shape of the density changes</strong> even though the individual particles move deterministically.`,
          ` 개별 입자는 결정론적으로 움직이는데도 밀도의 <strong>모양이 변한다</strong>는 점에 주목하세요.`));
    }
    slider('pd-n', (v) => { N = Math.round(Math.pow(10, v)); render(); },
      (v) => String(Math.round(Math.pow(10, v))))._emit();
    const sl = slider('pd-t', (v) => { t = v; render(); });
    const play = document.getElementById('pd-play');
    if (play) play.addEventListener('click', () => playback(sl, 2600));
    sl._emit();
  })();

})();
