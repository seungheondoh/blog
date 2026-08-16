/*
 * Wires up the interactive topics using prob-engine.js (RNG, Dist, Stat,
 * Chart2D, Heatmap) and js/engine.js (LA, makeDraggable).
 * Each section is self-contained: it grabs its own canvas/DOM nodes, keeps local
 * state, and re-renders on drag/slider/button events.
 *
 * Every demo draws from a seeded RNG, so dragging a slider back and forth
 * reproduces the same samples instead of reshuffling the picture each frame.
 */
(function () {
  const { LA, RNG, Dist, Stat, Chart2D, Heatmap, PROB_COLORS: C } = window;
  const isEnglish = document.documentElement.lang === 'en';
  // Readout copy is generated at run time, so it cannot go through the build's
  // translation table the way the static markup does. `T` picks the language.
  const tr = (en, ko) => (isEnglish ? en : ko);

  const resizers = [];
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => resizers.forEach((fn) => fn()), 120);
  });

  const fmt = (n, d = 2) => (Object.is(n, -0) ? 0 : n).toFixed(d);
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* ---------------------------------------------------------- scaffolding */

  $$('canvas').forEach((canvas) => {
    const demo = canvas.closest('.topic-demo');
    const readout = demo && demo.querySelector('.readout');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', isEnglish
      ? 'Interactive probability diagram'
      : '확률 개념을 조작하며 살펴보는 인터랙티브 도식');
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
    indexLinks
      .map((l) => document.querySelector(l.getAttribute('href')))
      .filter(Boolean)
      .forEach((s) => obs.observe(s));
  }

  // Builds a chart and registers it for re-fit on resize. Returns null when the
  // canvas is absent, so a section can be removed from content.html without
  // breaking the rest of the file.
  function chart(id, opts, render) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    const ch = new Chart2D(canvas, opts);
    if (render) resizers.push(() => { ch.fit(); render(); });
    return ch;
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
    if (!btn) return null;
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      onToggle(btn.classList.contains('active'));
    });
    return btn;
  }

  // Returns an inert stub when the control is absent, so removing a section from
  // content.html cannot throw and take every later section down with it.
  const NO_SLIDER = { value: '0', _emit() {} };

  function slider(id, onInput, format = (v) => fmt(v)) {
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

  const say = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };
  const dot = (color, text) =>
    `<span style="color:${color}">■</span> ${text}`;

  /* ------------------------------------------------- 1. random variables */

  (function randomVar() {
    const KINDS = {
      die: {
        title: tr('Die face', '주사위 눈'),
        space: ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'],
        values: [1, 2, 3, 4, 5, 6],
        probs: [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6],
        note: tr('A discrete random variable mapping the 6 outcomes of the sample space to 1..6', '표본공간의 6개 결과에 1..6을 대응시킨 이산 확률변수'),
      },
      label: {
        title: tr('Class label', '클래스 레이블'),
        space: ['🐱', '🐶', '🐦'],
        values: [0, 1, 2],
        probs: [0.5, 0.3, 0.2],
        note: tr('A random variable mapping an image outcome to a class index — the Y of a classifier', '이미지라는 결과에 클래스 인덱스를 대응시킨 확률변수 — 분류 모델의 Y'),
      },
      height: {
        title: tr('Height (continuous)', '키 (연속)'),
        continuous: true,
        dist: Dist.gaussian(170, 8),
        note: tr('A continuous random variable whose outcomes span the reals — the probability of any single point is 0', '결과가 실수 전체에 걸쳐 있는 연속 확률변수 — 한 점의 확률은 0이다'),
      },
    };
    let kind = 'die';
    const ch = chart('c-randomvar', { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, () => render());
    if (!ch) return;

    function render() {
      const k = KINDS[kind];
      ch.fit().clear();
      if (k.continuous) {
        ch.setX(140, 200).setY(0, 0.06);
        ch.axes({ xLabel: 'x (cm)', yFormat: (v) => v.toFixed(3) });
        ch.curve((x) => k.dist.pdf(x), { color: C.blue, fill: 'rgba(6,69,173,.12)' });
        ch.area((x) => k.dist.pdf(x), 165, 175);
        ch.label(175, 0.052, tr('P(165 ≤ X ≤ 175) = area', 'P(165 ≤ X ≤ 175) = 면적'), { color: C.orange });
        say('r-randomvar', `${k.note} &nbsp;·&nbsp; E[X] = 170.0 cm`);
        return;
      }
      const n = k.values.length;
      ch.setX(-0.5, n - 0.5).setY(0, 0.62);
      ch.axes({ xTicks: k.values.map((_, i) => i), xFormat: (v) => k.values[Math.round(v)] ?? '', xLabel: 'x' });
      ch.stems(k.values.map((v, i) => [i, k.probs[i]]), { color: C.blue });
      // The sample-space symbol above each stem: the map ω ↦ X(ω).
      k.space.forEach((sym, i) => ch.label(i, k.probs[i], sym, { align: 'center', dy: -12, font: '18px system-ui' }));
      const mean = k.values.reduce((s, v, i) => s + v * k.probs[i], 0);
      say('r-randomvar', `${k.note} &nbsp;·&nbsp; E[X] = ${fmt(mean)}`);
    }

    presetGroup('rv-presets', ({ kind: picked }) => { kind = picked; render(); });
    render();
  })();

  /* ----------------------------------------- 2. probability distributions */

  (function probabilityDistribution() {
    let kind = 'coin';
    let binaryP = 0.7;
    let dieBias = 0;
    const input = document.getElementById('pdemo-param');
    const paramName = document.getElementById('pdemo-param-name');
    const ch = chart('c-probabilitydistribution',
      { xMin: -0.5, xMax: 1.5, yMin: 0, yMax: 1.05 }, render);
    if (!ch || !input) return;

    const binaryKinds = {
      coin: {
        variable: 'X', experiment: tr('a coin flip', '동전 던지기'),
        outcomes: tr(['tails', 'heads'], ['뒷면', '앞면']), values: ['0', '1'],
        mapping: tr('tails→0, heads→1', '뒷면→0, 앞면→1'),
      },
      exam: {
        variable: 'Y', experiment: tr('an exam result', '시험 결과'),
        outcomes: tr(['fail', 'pass'], ['불합격', '합격']), values: ['0', '1'],
        mapping: tr('fail→0, pass→1', '불합격→0, 합격→1'),
      },
    };

    function render() {
      ch.fit().clear();
      if (kind === 'die') {
        const base = (1 - dieBias) / 6;
        const probs = new Array(6).fill(base);
        probs[5] += dieBias;
        ch.setX(-0.6, 5.6).setY(0, 1.05);
        ch.axes({
          xTicks: [0, 1, 2, 3, 4, 5],
          xFormat: (v) => String(Math.round(v) + 1),
          xLabel: tr('die value z', '주사위 값 z'), yLabel: 'P(Z=z)',
        });
        ch.bars(probs.map((value, i) => ({ lo: i - 0.34, hi: i + 0.34, value })),
          { color: 'rgba(6,69,173,.28)', stroke: 'rgba(6,69,173,.75)' });
        probs.forEach((p, i) => ch.label(i, p, fmt(p),
          { align: 'center', dy: -8, font: '11px system-ui', color: C.blue }));
        const mean = probs.reduce((s, p, i) => s + p * (i + 1), 0);
        say('r-probabilitydistribution',
          tr(`<strong>Z remains the same random variable that carries a die face to a number.</strong> `,
            `<strong>Z는 계속 “주사위 눈을 숫자로 옮기는 같은 확률변수”입니다.</strong> `) +
          tr(`But changing the bias changes the probability sitting on each value, so the distribution changes.<br>`,
            `하지만 치우침을 바꾸면 각 값에 놓인 확률이 달라져 분포가 바뀝니다.<br>`) +
          tr(`Possible values of Z = {1,2,3,4,5,6}`, `Z의 가능한 값 = {1,2,3,4,5,6}`) +
          ` &nbsp;·&nbsp; P(Z=6) = ${fmt(probs[5])} ` +
          `&nbsp;·&nbsp; E[Z] = ${fmt(mean)} &nbsp;·&nbsp; ` +
          tr('distribution = ', '분포 = ') +
          (dieBias < 0.01
            ? tr('a fair die', '공정한 주사위')
            : tr('a categorical distribution skewed toward 6', '6 쪽으로 치우친 범주형 분포')));
        return;
      }

      const cfg = binaryKinds[kind];
      const probs = [1 - binaryP, binaryP];
      ch.setX(-0.6, 1.6).setY(0, 1.05);
      ch.axes({
        xTicks: [0, 1], xFormat: (v) => cfg.values[Math.round(v)] ?? '',
        xLabel: tr(`value of ${cfg.variable}`, `${cfg.variable}의 값`), yLabel: `P(${cfg.variable}=x)`,
      });
      ch.bars(probs.map((value, i) => ({ lo: i - 0.28, hi: i + 0.28, value })),
        { color: 'rgba(15,157,88,.28)', stroke: 'rgba(15,157,88,.8)' });
      cfg.outcomes.forEach((name, i) => {
        ch.label(i, probs[i], `${name}  ${fmt(probs[i])}`,
          { align: 'center', dy: -10, font: '12px system-ui', color: C.green });
      });
      say('r-probabilitydistribution',
        `<strong>${cfg.variable}: ${cfg.experiment}</strong> (${cfg.mapping}) &nbsp;·&nbsp; ` +
        `${cfg.variable} ~ Bernoulli(${fmt(binaryP)})<br>` +
        tr(`Alternate between "Coin X" and "Pass/fail Y". The experiments and the random variables differ, but when the success probability p matches, `,
          `“동전 X”와 “합격 여부 Y”를 번갈아 눌러보세요. 실험과 확률변수는 달라도 성공 확률 p가 같으면 `) +
        tr(`<strong>the bars and the Bernoulli distribution are exactly the same.</strong>`,
          `<strong>막대와 Bernoulli 분포는 완전히 같습니다.</strong>`));
    }

    const control = slider('pdemo-param', (v) => {
      if (kind === 'die') dieBias = v;
      else binaryP = v;
      render();
    });
    presetGroup('pdemo-presets', ({ kind: picked }) => {
      kind = picked;
      if (paramName) paramName.textContent = kind === 'die' ? tr('bias toward 6, b', '6 쪽 치우침 b') : tr('success probability p', '성공 확률 p');
      control.value = String(kind === 'die' ? dieBias : binaryP);
      control._emit();
    });
    control._emit();
  })();

  /* ------------------------------------------------------ 2. PMF and PDF */

  (function pmfPdf() {
    // A mildly bimodal density, so binning is visibly lossy at coarse widths.
    const dist = Dist.mixture(
      [Dist.gaussian(-1.1, 0.75), Dist.gaussian(1.4, 0.95)],
      [0.55, 0.45],
    );
    const LO = -4, HI = 5;
    let bw = 1;
    let showCdf = false;
    const ch = chart('c-distribution', { xMin: LO, xMax: HI, yMin: 0, yMax: 0.45 }, () => render());
    if (!ch) return;

    function render() {
      ch.fit().clear();
      if (showCdf) {
        ch.setY(0, 1.05);
        ch.axes({ xLabel: 'x', yLabel: 'F(x) = P(X ≤ x)' });
        ch.curve((x) => dist.cdf(x), { color: C.violet, width: 2.2 });
        ch.hline(1, { color: C.muted, dash: [3, 3], label: '1' });
        say('r-distribution',
          `${dot(C.violet, 'CDF F(x)')} — ` + tr('increases monotonically and converges to 1. An interval probability is read off as F(b) − F(a).', '단조증가하며 1에 수렴. 구간 확률은 F(b) − F(a)로 읽는다.'));
        return;
      }
      ch.setY(0, 0.45);
      ch.axes({ xLabel: 'x', yLabel: 'p(x)', yFormat: (v) => v.toFixed(2) });
      // Bin the density into mass, then divide by width to put the bars back on
      // the density axis — this is what makes bar and curve directly comparable.
      const bins = [];
      for (let lo = LO; lo < HI - 1e-9; lo += bw) {
        const hi = Math.min(lo + bw, HI);
        const mass = dist.cdf(hi) - dist.cdf(lo);
        bins.push({ lo, hi, value: mass / (hi - lo), mass });
      }
      ch.bars(bins, { color: 'rgba(6,69,173,.20)', stroke: 'rgba(6,69,173,.5)' });
      ch.curve((x) => dist.pdf(x), { color: C.orange, width: 2.2 });
      const biggest = bins.reduce((a, b) => (b.mass > a.mass ? b : a), bins[0]);
      say('r-distribution',
        tr(`bin width Δ = ${fmt(bw)} &nbsp;·&nbsp; ${bins.length} bars &nbsp;·&nbsp; `,
          `구간 폭 Δ = ${fmt(bw)} &nbsp;·&nbsp; 막대 ${bins.length}개 &nbsp;·&nbsp; `) +
        tr(`probability of the largest cell = ${fmt(biggest.mass, 3)} (bar height ${fmt(biggest.value, 3)} × Δ) &nbsp;·&nbsp; `,
          `가장 큰 칸의 확률 = ${fmt(biggest.mass, 3)} (막대 높이 ${fmt(biggest.value, 3)} × Δ) &nbsp;·&nbsp; `) +
        `${dot(C.orange, tr('density p(x)', '밀도 p(x)'))} ` +
        tr(`is not a probability but a probability <em>per unit length</em>.`,
          `는 확률이 아니라 <em>단위 길이당</em> 확률이다.`));
    }

    slider('dist-bw', (v) => { bw = v; render(); })._emit();
    toggle('dist-cdf', (on) => { showCdf = on; render(); });
  })();

  /* --------------------------------------------------------- 3. sampling */

  (function sampling() {
    const dist = Dist.mixture(
      [Dist.gaussian(-1.1, 0.75), Dist.gaussian(1.4, 0.95)],
      [0.55, 0.45],
    );
    const LO = -4, HI = 5;
    const MAX = 10000;
    let seed = 7;
    let n = 100;
    let pool = [];

    const refill = () => {
      const rng = RNG(seed);
      pool = Array.from({ length: MAX }, () => dist.sample(rng));
    };
    refill();

    const chHist = chart('c-sampling', { xMin: LO, xMax: HI, yMin: 0, yMax: 0.45 }, () => render());
    const chInv = chart('c-sampling-inv', { xMin: LO, xMax: HI, yMin: 0, yMax: 1.05 }, () => render());
    if (!chHist) return;

    function render() {
      const samples = pool.slice(0, n);
      chHist.fit().clear();
      chHist.setY(0, 0.45);
      chHist.axes({ xLabel: 'x', yLabel: 'density' });
      const bins = Stat.histogram(samples, { lo: LO, hi: HI, bins: 34, density: true });
      chHist.bars(bins, { color: 'rgba(6,69,173,.22)', stroke: 'rgba(6,69,173,.5)' });
      chHist.curve((x) => dist.pdf(x), { color: C.orange, width: 2.2 });
      if (n <= 300) chHist.rug(samples);

      const m = Stat.mean(samples);
      const err = Math.abs(m - dist.mean);
      say('r-sampling',
        tr(`N = ${n} &nbsp;·&nbsp; sample mean = ${fmt(m, 3)} &nbsp;·&nbsp; true E[X] = ${fmt(dist.mean, 3)} `,
          `N = ${n} &nbsp;·&nbsp; 표본평균 = ${fmt(m, 3)} &nbsp;·&nbsp; 참값 E[X] = ${fmt(dist.mean, 3)} `) +
        tr(`&nbsp;·&nbsp; error = ${fmt(err, 3)} &nbsp;·&nbsp; the error shrinks roughly as 1/√N.`,
          `&nbsp;·&nbsp; 오차 = ${fmt(err, 3)} &nbsp;·&nbsp; 오차는 대략 1/√N 로 줄어든다.`));

      if (!chInv) return;
      // Inverse transform: pick u on the vertical axis, read x off the CDF.
      chInv.fit().clear();
      chInv.axes({ xLabel: 'x', yLabel: 'u = F(x)' });
      chInv.curve((x) => dist.cdf(x), { color: C.violet, width: 2 });
      const rng = RNG(seed + 1);
      const us = Array.from({ length: 6 }, () => rng.uniform()).sort((a, b) => a - b);
      // No closed-form quantile for a mixture; bisect the CDF instead.
      const invert = (u) => {
        let lo = LO, hi = HI;
        for (let i = 0; i < 50; i++) {
          const mid = (lo + hi) / 2;
          if (dist.cdf(mid) < u) lo = mid; else hi = mid;
        }
        return (lo + hi) / 2;
      };
      us.forEach((u) => {
        const x = invert(u);
        chInv.curve([[LO, u], [x, u]], { color: 'rgba(249,115,22,.75)', width: 1.3, dash: [3, 3] });
        chInv.curve([[x, u], [x, 0]], { color: 'rgba(249,115,22,.75)', width: 1.3, dash: [3, 3] });
        chInv.points([[x, 0]], { color: C.orange, r: 3.5 });
      });
      say('r-sampling-inv',
        tr(`${us.length} values of u drawn from uniform(0,1) → x obtained as F⁻¹(u). `,
          `uniform(0,1)에서 뽑은 u ${us.length}개 → F⁻¹(u) 로 x를 얻는다. `) +
        tr(`One uniform number is enough to produce a sample from <em>any</em> distribution.`,
          `균등난수 하나만 있으면 <em>어떤</em> 분포에서든 표본을 만들 수 있다는 뜻이다.`));
    }

    slider('samp-n', (v) => { n = Math.round(Math.pow(10, v)); render(); },
      (v) => String(Math.round(Math.pow(10, v))))._emit();
    const btn = document.getElementById('samp-reseed');
    if (btn) btn.addEventListener('click', () => { seed = (seed * 1664525 + 1013904223) >>> 0; refill(); render(); });
  })();

  /* ------------------------------- 4-6, 8. the shared joint-probability grid */

  // One 5x5 joint used by four sections. Each builds its own Heatmap over the
  // same numbers so a reader who edits one sees a familiar shape in the next.
  const JOINT_PRESETS = {
    corr: [
      [0.10, 0.06, 0.03, 0.01, 0.00],
      [0.06, 0.10, 0.06, 0.02, 0.01],
      [0.03, 0.06, 0.10, 0.06, 0.03],
      [0.01, 0.02, 0.06, 0.10, 0.06],
      [0.00, 0.01, 0.03, 0.06, 0.10],
    ],
    indep: (() => {
      const px = [0.30, 0.25, 0.20, 0.15, 0.10];
      const py = [0.10, 0.15, 0.25, 0.30, 0.20];
      return py.map((b) => px.map((a) => a * b));
    })(),
    uniform: Array.from({ length: 5 }, () => new Array(5).fill(0.04)),
  };
  const clone = (m) => m.map((r) => r.slice());

  (function joint() {
    const hm = new Heatmap('joint-heatmap', {
      rows: 5, cols: 5, editable: true, values: clone(JOINT_PRESETS.corr),
      onChange: report,
    });
    if (!hm.el) return;

    function report() {
      const total = hm.p.flat().reduce((a, b) => a + b, 0);
      const biggest = hm.p.flat().reduce((a, b) => Math.max(a, b), 0);
      say('r-joint',
        tr(`Sum of the 25 grid cells = ${fmt(total, 3)} (always renormalized to 1) &nbsp;·&nbsp; largest cell = ${fmt(biggest, 3)}`,
          `격자 25칸의 합 = ${fmt(total, 3)} (항상 1로 정규화됨) &nbsp;·&nbsp; 최대 칸 = ${fmt(biggest, 3)}`) +
        tr(` &nbsp;·&nbsp; drag a cell up or down to change its value; the rest renormalize with it.`,
          ` &nbsp;·&nbsp; 셀을 위아래로 드래그하면 값이 바뀌고 나머지가 함께 재정규화된다.`));
    }
    presetGroup('joint-presets', ({ preset }) => { hm.set(clone(JOINT_PRESETS[preset])); report(); });
    report();
  })();

  (function marginal() {
    const hm = new Heatmap('marginal-heatmap', {
      rows: 5, cols: 5, editable: true, values: clone(JOINT_PRESETS.corr), onChange: report,
    });
    if (!hm.el) return;
    let axis = 'y';

    function report() {
      const mx = hm.marginalX(), my = hm.marginalY();
      const target = axis === 'y' ? mx : my;
      const name = axis === 'y' ? 'P(X)' : 'P(Y)';
      const sumSym = axis === 'y' ? 'Σ_y P(x, y)' : 'Σ_x P(x, y)';
      const bar = (v) => {
        const w = Math.round(v * 260);
        return `<span style="display:inline-block;width:${w}px;height:8px;` +
          `background:${C.orange};border-radius:2px;vertical-align:middle"></span>`;
      };
      say('r-marginal',
        `${name} = ${sumSym} &nbsp;→&nbsp; ` +
        target.map((v, i) => `${i}: ${fmt(v, 3)} ${bar(v)}`).join(' &nbsp; ') +
        tr(` &nbsp;·&nbsp; sum = `, ` &nbsp;·&nbsp; 합 = `) + `${fmt(target.reduce((a, b) => a + b, 0), 3)}`);
    }
    presetGroup('marginal-axis', (d) => { axis = d.axis; report(); });
    report();
  })();

  (function conditional() {
    const hm = new Heatmap('conditional-heatmap', {
      rows: 5, cols: 5, editable: true, values: clone(JOINT_PRESETS.corr), onChange: report,
    });
    if (!hm.el) return;
    hm.dimmed = true;
    let col = 2;

    function report() {
      hm.selectedCol = col;
      hm.render();
      const px = hm.marginalX()[col];
      const cond = hm.conditionalYgivenX(col);
      const bar = (v) => {
        const w = Math.round(v * 200);
        return `<span style="display:inline-block;width:${w}px;height:8px;` +
          `background:${C.orange};border-radius:2px;vertical-align:middle"></span>`;
      };
      say('r-conditional',
        `P(X=${col}) = ${fmt(px, 3)} &nbsp;·&nbsp; P(Y|X=${col}) = ` +
        cond.map((v, i) => `${i}: ${fmt(v, 3)} ${bar(v)}`).join(' &nbsp; ') +
        tr(` &nbsp;·&nbsp; sum = ${fmt(cond.reduce((a, b) => a + b, 0), 3)} — one column detached and divided by that column's total.`,
          ` &nbsp;·&nbsp; 합 = ${fmt(cond.reduce((a, b) => a + b, 0), 3)} — 열 하나를 떼어 그 열의 합으로 나눈 것이다.`));
    }
    slider('cond-x', (v) => { col = Math.round(v); report(); }, (v) => String(Math.round(v)))._emit();
  })();

  (function chainRule() {
    const hm = new Heatmap('chain-heatmap', { rows: 5, cols: 5, values: clone(JOINT_PRESETS.corr) });
    if (!hm.el) return;
    let order = 'xy';

    function report() {
      // The two factorizations reconstruct the same joint but store *different*
      // numbers to get there. Showing those factors is the point — the identity
      // itself is trivial, the asymmetry of the pieces is not.
      const mx = hm.marginalX(), my = hm.marginalY();
      const row = (v) => fmt(v, 2);
      let formula, first, second;
      if (order === 'xy') {
        formula = 'P(x, y) = P(x) · P(y | x)';
        first = `P(X) = [${mx.map(row).join(', ')}]`;
        // The conditional table read column by column: P(Y | X = j).
        second = mx.map((_, j) =>
          `P(Y|X=${j}) = [${hm.conditionalYgivenX(j).map(row).join(', ')}]`).join('<br>');
      } else {
        formula = 'P(x, y) = P(y) · P(x | y)';
        first = `P(Y) = [${my.map(row).join(', ')}]`;
        second = my.map((py, i) =>
          `P(X|Y=${i}) = [${hm.p[i].map((v) => row(py ? v / py : 0)).join(', ')}]`).join('<br>');
      }
      say('r-chainrule',
        `<strong>${formula}</strong><br>${first}<br>${second}<br>` +
        tr(`The two decompositions store different numbers, yet multiplying them gives the <strong>very same joint distribution</strong>. `,
          `두 분해는 저장하는 숫자가 서로 다르지만 곱하면 <strong>똑같은 결합분포</strong>가 나온다. `) +
        tr(`The order is ours to choose, not something the data dictates — an autoregressive model picks left→right `,
          `순서는 우리가 고르는 것이지 데이터가 정해주는 것이 아니다 — 자기회귀 모델이 좌→우 순서를 `) +
        tr(`not because it is the only option but because it is convenient.`,
          `택하는 것도 그것이 유일해서가 아니라 편해서다.`));
    }
    presetGroup('chain-order', (d) => { order = d.order; report(); });

    // Autoregressive strip: P(w1) P(w2|w1) P(w3|w1,w2) ...
    const strip = document.getElementById('chain-tokens');
    if (strip) {
      const tokens = tr(['Probability', ' is', ' the', ' language', ' of', ' learning'],
        ['확률', '은', '머신', '러닝', '의', '언어']);
      const probs = [0.21, 0.62, 0.14, 0.77, 0.58, 0.09];
      let step = 0;
      const draw = () => {
        strip.textContent = '';
        tokens.forEach((tk, i) => {
          const cell = document.createElement('span');
          cell.className = 'token-cell';
          if (i < step) cell.classList.add('conditioned');
          if (i === step) cell.classList.add('current');
          cell.textContent = i <= step ? `${tk} ${probs[i].toFixed(2)}` : '·';
          strip.appendChild(cell);
        });
        const logp = probs.slice(0, step + 1).reduce((s, v) => s + Math.log(v), 0);
        const cond = tokens.slice(0, step).join('') || tr('⟨start⟩', '⟨시작⟩');
        say('r-chain-tokens',
          `P(${tokens[step]} | ${cond}) = ${probs[step].toFixed(2)} &nbsp;·&nbsp; ` +
          tr(`cumulative log P = ${fmt(logp, 3)} &nbsp;·&nbsp; the probability of the whole sentence is the product of these conditionals — `,
            `누적 log P = ${fmt(logp, 3)} &nbsp;·&nbsp; 문장 전체의 확률은 이 조건부들의 곱이다 — `) +
          tr(`which is why a language model can represent the distribution of a whole sentence while only ever predicting the next token.`,
            `언어 모델이 다음 토큰만 예측하고도 문장 전체의 분포를 표현할 수 있는 이유.`));
        step = (step + 1) % tokens.length;
      };
      draw();
      strip.addEventListener('click', draw);
      strip.style.cursor = 'pointer';
      strip.title = tr('Click to advance to the next token', '클릭하면 다음 토큰으로');
    }
    report();
  })();

  (function independence() {
    const box = document.getElementById('indep-heatmap');
    if (!box) return;
    const base = clone(JOINT_PRESETS.corr);
    const hm = new Heatmap('indep-heatmap', { rows: 5, cols: 5, values: clone(base) });
    const res = new Heatmap('indep-residual', { rows: 5, cols: 5, values: clone(base) });
    let t = 0;

    // The independent joint the slider interpolates toward: the outer product of
    // the marginals, which by construction has the same marginals as `base`.
    const independentTarget = hm.productOfMarginals();

    // Residuals are signed and must not be renormalized, so this grid gets its
    // own diverging paint pass instead of Heatmap's sequential render().
    function paintResidual(resid) {
      const maxAbs = Math.max(...resid.flat().map(Math.abs), 1e-9);
      res.cells.forEach((row, i) => row.forEach((cell, j) => {
        const v = resid[res.rows - 1 - i][j];
        const k = clamp(v / maxAbs, -1, 1);
        cell.style.background = k >= 0
          ? `rgba(217,48,37,${0.05 + 0.8 * k})`
          : `rgba(6,69,173,${0.05 + 0.8 * -k})`;
        cell.style.color = Math.abs(k) > 0.55 ? '#fff' : '#333';
        cell.textContent = (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2).slice(1);
      }));
      return maxAbs;
    }

    function render() {
      const mixed = base.map((row, i) =>
        row.map((v, j) => v * (1 - t) + independentTarget[i][j] * t));
      hm.p = mixed.map((r) => r.slice());
      hm.normalize().render();
      const prod = hm.productOfMarginals();
      const resid = hm.p.map((row, i) => row.map((v, j) => v - prod[i][j]));
      const maxAbs = paintResidual(resid);
      say('r-independence',
        tr(`t = ${fmt(t)} &nbsp;·&nbsp; largest residual |P(x,y) − P(x)P(y)| = ${fmt(maxAbs, 4)} &nbsp;·&nbsp; `,
          `t = ${fmt(t)} &nbsp;·&nbsp; 최대 잔차 |P(x,y) − P(x)P(y)| = ${fmt(maxAbs, 4)} &nbsp;·&nbsp; `) +
        (maxAbs < 1e-6
          ? tr('<strong>fully independent</strong> — 5+5 numbers suffice instead of 25.',
            '<strong>완전 독립</strong> — 25개 수 대신 5+5개 수만 기억하면 된다.')
          : tr('A nonzero residual means the joint distribution cannot be recovered as a product of the two marginals.',
            '잔차가 0이 아니면 결합분포를 두 주변분포의 곱으로 복원할 수 없다.')));
    }

    const sl = slider('indep-t', (v) => { t = v; render(); });
    const play = document.getElementById('indep-play');
    if (play && sl) {
      play.addEventListener('click', () => {
        const from = t;
        const t0 = performance.now();
        const step = (now) => {
          const k = clamp((now - t0) / 900, 0, 1);
          const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          t = from + (1 - from) * eased;
          sl.value = String(t);
          sl._emit();
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }
    sl._emit();
  })();

  /* ------------------------------------------------------ 9. expectation */

  (function expectation() {
    const dist = Dist.gaussian(1.2, 1.1);
    const LO = -3, HI = 5.5;
    let samples = [];
    let seed = 11;
    let rng = RNG(seed);

    const chDens = chart('c-expectation', { xMin: LO, xMax: HI, yMin: 0, yMax: 0.42 }, render);
    const chLln = chart('c-expectation-lln', { xMin: 0, xMax: 200, yMin: 0, yMax: 3 }, render);
    if (!chDens) return;

    function render() {
      chDens.fit().clear();
      chDens.axes({ xLabel: 'x', yLabel: 'p(x)' });
      chDens.curve((x) => dist.pdf(x), { color: C.blue, fill: 'rgba(6,69,173,.10)' });
      chDens.rug(samples.slice(-120));
      chDens.vline(dist.mean, { color: C.orange, label: `E[X] = ${fmt(dist.mean)}` });
      if (samples.length) {
        chDens.vline(Stat.mean(samples), { color: C.green, dash: [2, 2], label: `x̄ = ${fmt(Stat.mean(samples))}` });
      }

      if (chLln) {
        chLln.fit().clear();
        chLln.setX(0, Math.max(30, samples.length)).setY(dist.mean - 1.6, dist.mean + 1.6);
        chLln.axes({ xLabel: tr('n (samples)', 'n (표본 수)'), yLabel: tr('running sample mean', '누적 표본평균') });
        chLln.hline(dist.mean, { color: C.orange, dash: [4, 3], label: 'E[X]' });
        if (samples.length > 1) {
          let acc = 0;
          const path = samples.map((v, i) => { acc += v; return [i + 1, acc / (i + 1)]; });
          chLln.curve(path, { color: C.green, width: 1.8 });
        }
      }
      say('r-expectation',
        samples.length
          ? tr(`n = ${samples.length} &nbsp;·&nbsp; sample mean = ${fmt(Stat.mean(samples), 3)} &nbsp;·&nbsp; `,
            `n = ${samples.length} &nbsp;·&nbsp; 표본평균 = ${fmt(Stat.mean(samples), 3)} &nbsp;·&nbsp; `) +
            tr(`E[X] = ${fmt(dist.mean, 3)} &nbsp;·&nbsp; difference = ${fmt(Math.abs(Stat.mean(samples) - dist.mean), 3)}. `,
              `E[X] = ${fmt(dist.mean, 3)} &nbsp;·&nbsp; 차이 = ${fmt(Math.abs(Stat.mean(samples) - dist.mean), 3)}. `) +
            tr(`This convergence is what licenses replacing an expected loss with a minibatch average.`,
              `기대손실을 미니배치 평균으로 대신할 수 있는 근거가 이 수렴이다.`)
          : tr(`E[X] = ∫ x p(x) dx = ${fmt(dist.mean, 3)} — the distribution summarized by a single centre of mass. Press "Draw samples".`,
            `E[X] = ∫ x p(x) dx = ${fmt(dist.mean, 3)} — 분포를 무게중심 하나로 요약한 값. "표본 뽑기"를 눌러보세요.`));
    }

    const play = document.getElementById('exp-play');
    if (play) play.addEventListener('click', () => {
      let added = 0;
      const step = () => {
        for (let i = 0; i < 4 && samples.length < 200; i++) samples.push(dist.sample(rng));
        render();
        if (++added < 25 && samples.length < 200) requestAnimationFrame(step);
      };
      step();
    });
    const reset = document.getElementById('exp-reset');
    if (reset) reset.addEventListener('click', () => {
      samples = [];
      seed = (seed * 1664525 + 1013904223) >>> 0;
      rng = RNG(seed);
      render();
    });
    render();
  })();

  /* --------------------------------------------------------- 10. variance */

  (function variance() {
    let s1 = 0.6, s2 = 1.2;
    const MU = 0;
    const ch = chart('c-variance', { xMin: -6, xMax: 6, yMin: 0, yMax: 0.75 }, render);
    if (!ch) return;

    function render() {
      const d1 = Dist.gaussian(MU, s1);
      const d2 = Dist.gaussian(MU, s2);
      ch.fit().clear();
      ch.setY(0, Math.max(0.75, d1.pdf(MU) * 1.12));
      ch.axes({ xLabel: 'x', yLabel: 'p(x)' });
      ch.curve((x) => d1.pdf(x), { color: C.blue, fill: 'rgba(6,69,173,.10)' });
      ch.curve((x) => d2.pdf(x), { color: C.orange, fill: 'rgba(249,115,22,.10)' });
      ch.vline(MU, { color: C.muted, dash: [3, 3], label: tr('same mean μ = 0', '같은 평균 μ = 0') });
      // ±1σ markers make "spread" a length you can see, not just a number.
      [[s1, C.blue], [s2, C.orange]].forEach(([s, col], k) => {
        const y = (k === 0 ? d1 : d2).pdf(MU + s);
        ch.curve([[MU - s, y], [MU + s, y]], { color: col, width: 1.2, dash: [2, 2] });
        ch.label(MU + s, y, ` ±σ=${fmt(s)}`, { color: col, font: '11px system-ui' });
      });
      say('r-variance',
        `${dot(C.blue, `σ₁ = ${fmt(s1)}, Var = ${fmt(s1 * s1, 3)}`)} &nbsp;·&nbsp; ` +
        `${dot(C.orange, `σ₂ = ${fmt(s2)}, Var = ${fmt(s2 * s2, 3)}`)} &nbsp;·&nbsp; ` +
        tr(`Same mean but different variance means a completely different distribution. Predictive uncertainty lives here, not in the mean.`,
          `평균이 같아도 분산이 다르면 전혀 다른 분포다. 예측의 불확실성은 평균이 아니라 여기에 담긴다.`));
    }
    slider('var-s1', (v) => { s1 = v; render(); })._emit();
    slider('var-s2', (v) => { s2 = v; render(); })._emit();
  })();

  /* -------------------------------------------- 11. covariance & correlation */

  (function covariance() {
    let sx = 1.4, sy = 0.7, rho = 0.6;
    const ch = chart('c-covariance', { xMin: -5, xMax: 5, yMin: -5, yMax: 5 }, render);
    if (!ch) return;
    const rng0 = RNG(23);
    // Draw the standard-normal pairs once; the sliders only re-shape them, so the
    // cloud morphs continuously instead of resampling.
    const z = Array.from({ length: 420 }, () => [rng0.normal(), rng0.normal()]);

    function render() {
      ch.fit().clear();
      // Keep the aspect square so a circle reads as a circle.
      const span = 5;
      ch.setX(-span, span).setY(-span, span);
      ch.axes({ xLabel: 'x', yLabel: 'y' });

      const cov = rho * sx * sy;
      const Sigma = [sx * sx, cov, cov, sy * sy];
      // Cholesky of Sigma maps standard normals to the target covariance.
      const l11 = sx;
      const l21 = cov / sx;
      const l22 = Math.sqrt(Math.max(1e-9, sy * sy - l21 * l21));
      const pts = z.map(([a, b]) => [l11 * a, l21 * a + l22 * b]);
      ch.points(pts, { color: 'rgba(6,69,173,.35)', r: 2.2 });

      // 1σ and 2σ contours, drawn from the eigen-decomposition of Sigma: the
      // ellipse axes ARE the eigenvectors. This is exactly PCA.
      const eig = LA.eig2(Sigma);
      if (eig) {
        const [v1, v2] = eig.vectors;
        const [l1, l2] = eig.values.map((v) => Math.sqrt(Math.max(0, v)));
        [1, 2].forEach((k) => {
          const path = [];
          for (let i = 0; i <= 96; i++) {
            const th = (i / 96) * Math.PI * 2;
            const a = k * l1 * Math.cos(th);
            const b = k * l2 * Math.sin(th);
            path.push([v1[0] * a + v2[0] * b, v1[1] * a + v2[1] * b]);
          }
          ch.curve(path, { color: k === 1 ? C.orange : 'rgba(249,115,22,.45)', width: k === 1 ? 2 : 1.2 });
        });
        ch.curve([[0, 0], [v1[0] * l1 * 2, v1[1] * l1 * 2]], { color: C.red, width: 2 });
        ch.curve([[0, 0], [v2[0] * l2 * 2, v2[1] * l2 * 2]], { color: C.violet, width: 2 });
        say('r-covariance',
          `Cov(X,Y) = ${fmt(cov, 3)} &nbsp;·&nbsp; ρ = ${fmt(rho)} &nbsp;·&nbsp; ` +
          `${dot(C.red, tr(`major axis (eigenvalue ${fmt(eig.values[0], 3)})`, `주축 (고유값 ${fmt(eig.values[0], 3)})`))} &nbsp; ` +
          `${dot(C.violet, tr(`minor axis (eigenvalue ${fmt(eig.values[1], 3)})`, `부축 (고유값 ${fmt(eig.values[1], 3)})`))} ` +
          tr(`&nbsp;·&nbsp; the axes of the ellipse are the eigenvectors of the covariance matrix — <a href="../2026-07-14-linear-algebra/index.html#eigen">what PCA does</a>.`,
            `&nbsp;·&nbsp; 타원의 축이 곧 공분산행렬의 고유벡터다 — <a href="../2026-07-14-linear-algebra/ko.html#eigen">PCA가 하는 일</a>.`));
      }
    }
    slider('cov-sx', (v) => { sx = v; render(); })._emit();
    slider('cov-sy', (v) => { sy = v; render(); })._emit();
    slider('cov-rho', (v) => { rho = v; render(); })._emit();
  })();

  /* ------------------------------------------------------ 12. categorical */

  (function categorical() {
    const LOGITS = [2.1, 1.4, 0.3, -0.4, -1.2];
    const NAMES = ['cat', 'dog', 'bird', 'fish', 'frog'];
    let T = 1;
    const ch = chart('c-categorical', { xMin: -0.6, xMax: 4.6, yMin: 0, yMax: 1.05 }, render);
    if (!ch) return;

    function render() {
      const p = Dist.softmax(LOGITS, T);
      ch.fit().clear();
      ch.axes({
        xTicks: NAMES.map((_, i) => i),
        xFormat: (v) => NAMES[Math.round(v)] ?? '',
        xLabel: 'class',
        yLabel: 'P(Y = k)',
      });
      ch.bars(p.map((v, i) => ({ lo: i - 0.36, hi: i + 0.36, value: v })),
        { color: 'rgba(6,69,173,.28)', stroke: 'rgba(6,69,173,.65)' });
      p.forEach((v, i) => ch.label(i, v, fmt(v, 3), { align: 'center', dy: -5, font: '11px system-ui' }));
      const argmax = p.indexOf(Math.max(...p));
      const ce = -Math.log(p[argmax]);
      say('r-categorical',
        `logits = [${LOGITS.join(', ')}] &nbsp;·&nbsp; T = ${fmt(T)} &nbsp;·&nbsp; ` +
        tr(`sum = ${fmt(p.reduce((a, b) => a + b, 0), 3)} (on the simplex) &nbsp;·&nbsp; `,
          `합 = ${fmt(p.reduce((a, b) => a + b, 0), 3)} (심플렉스 위) &nbsp;·&nbsp; `) +
        `argmax = <strong>${NAMES[argmax]}</strong> (p = ${fmt(p[argmax], 3)}) &nbsp;·&nbsp; ` +
        tr(`with ${NAMES[argmax]} as the correct answer the loss is −log p = ${fmt(ce, 3)}. `,
          `정답이 ${NAMES[argmax]}일 때 손실 −log p = ${fmt(ce, 3)}. `) +
        tr(`As T→0 it approaches one-hot; as T grows it flattens toward the uniform distribution.`,
          `T→0이면 one-hot에 가까워지고, T가 커지면 균등분포로 평평해진다.`));
    }
    slider('cat-temp', (v) => { T = v; render(); })._emit();
  })();

  /* --------------------------------------------------------- 13. gaussian */

  (function gaussian() {
    let mu = 0, sigma = 1;
    let samples = [];
    let seed = 31;
    const ch = chart('c-gaussian', { xMin: -6, xMax: 6, yMin: 0, yMax: 1.0 }, render);
    if (!ch) return;

    function render() {
      const d = Dist.gaussian(mu, sigma);
      ch.fit().clear();
      ch.setY(0, Math.max(0.45, d.pdf(mu) * 1.15));
      ch.axes({ xLabel: 'x', yLabel: 'p(x)' });
      ch.curve((x) => d.pdf(x), { color: C.blue, width: 2.2 });
      // 68 / 95: the intervals everyone quotes, drawn rather than asserted.
      ch.area((x) => d.pdf(x), mu - 2 * sigma, mu + 2 * sigma, { color: 'rgba(6,69,173,.10)' });
      ch.area((x) => d.pdf(x), mu - sigma, mu + sigma, { color: 'rgba(6,69,173,.20)' });
      ch.vline(mu, { color: C.orange, label: `μ = ${fmt(mu)}` });
      ch.rug(samples);
      say('r-gaussian',
        `p(x) = (1/√(2πσ²)) exp(−(x−μ)²/2σ²) &nbsp;·&nbsp; μ = ${fmt(mu)}, σ = ${fmt(sigma)}, Var = ${fmt(sigma * sigma, 3)} ` +
        tr(`&nbsp;·&nbsp; 68% within ±1σ, 95% within ±2σ &nbsp;·&nbsp; `,
          `&nbsp;·&nbsp; ±1σ 안에 68%, ±2σ 안에 95% &nbsp;·&nbsp; `) +
        tr(`−log p(x) = (x−μ)²/2σ² + const — <strong>the square inside the exponent becomes MSE directly.</strong>`,
          `−log p(x) = (x−μ)²/2σ² + const — <strong>지수 안의 제곱이 그대로 MSE가 된다.</strong>`) +
        (samples.length
          ? tr(` Mean of ${samples.length} samples = ${fmt(Stat.mean(samples), 3)}`,
            ` 표본 ${samples.length}개의 평균 = ${fmt(Stat.mean(samples), 3)}`)
          : ''));
    }
    slider('gauss-mu', (v) => { mu = v; render(); })._emit();
    slider('gauss-sigma', (v) => { sigma = v; render(); })._emit();
    const btn = document.getElementById('gauss-sample');
    if (btn) btn.addEventListener('click', () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const rng = RNG(seed);
      const d = Dist.gaussian(mu, sigma);
      samples = Array.from({ length: 60 }, () => d.sample(rng));
      render();
    });
  })();

  /* ---------------------------------------------------------- 14. laplace */

  (function laplace() {
    let b = 1;
    let logScale = false;
    const chD = chart('c-laplace', { xMin: -6, xMax: 6, yMin: 0, yMax: 0.8 }, render);
    const chL = chart('c-laplace-loss', { xMin: -4, xMax: 4, yMin: 0, yMax: 6 }, render);
    if (!chD) return;

    function render() {
      // Matched variance, so the comparison is about shape and not about width:
      // Laplace(b) has variance 2b², Gaussian(σ) has σ².
      const sigma = Math.sqrt(2) * b;
      const g = Dist.gaussian(0, sigma);
      const l = Dist.laplace(0, b);
      chD.fit().clear();
      if (logScale) {
        chD.setY(-9, 0);
        chD.axes({ xLabel: 'x', yLabel: 'log p(x)' });
        chD.curve((x) => Math.log(Math.max(1e-12, g.pdf(x))), { color: C.blue, width: 2 });
        chD.curve((x) => Math.log(Math.max(1e-12, l.pdf(x))), { color: C.orange, width: 2 });
      } else {
        chD.setY(0, Math.max(0.6, l.pdf(0) * 1.15));
        chD.axes({ xLabel: 'x', yLabel: 'p(x)' });
        chD.curve((x) => g.pdf(x), { color: C.blue, width: 2, fill: 'rgba(6,69,173,.08)' });
        chD.curve((x) => l.pdf(x), { color: C.orange, width: 2, fill: 'rgba(249,115,22,.08)' });
      }

      if (chL) {
        chL.fit().clear();
        chL.setY(0, 6);
        chL.axes({ xLabel: tr('x − μ (error)', 'x − μ (오차)'), yLabel: '−log p' });
        const cg = Math.log(sigma * Math.sqrt(2 * Math.PI));
        const cl = Math.log(2 * b);
        chL.curve((x) => (x * x) / (2 * sigma * sigma) + cg, { color: C.blue, width: 2.2 });
        chL.curve((x) => Math.abs(x) / b + cl, { color: C.orange, width: 2.2 });
        chL.label(2.6, (2.6 * 2.6) / (2 * sigma * sigma) + cg, tr(' MSE (squared)', ' MSE (제곱)'), { color: C.blue, font: '11px system-ui' });
        chL.label(2.6, 2.6 / b + cl, tr(' MAE (absolute)', ' MAE (절댓값)'), { color: C.orange, font: '11px system-ui' });
      }
      say('r-laplace',
        `${dot(C.blue, tr(`Gaussian σ = ${fmt(sigma)}`, `가우시안 σ = ${fmt(sigma)}`))} &nbsp; ` +
        `${dot(C.orange, tr(`Laplace b = ${fmt(b)}`, `라플라스 b = ${fmt(b)}`))} ` +
        tr(`— both variances matched at ${fmt(2 * b * b, 3)}. `, `— 분산은 둘 다 ${fmt(2 * b * b, 3)}로 맞췄다. `) +
        tr(`The Laplace has the sharper peak and the heavier tails &nbsp;·&nbsp; `,
          `봉우리는 라플라스가 뾰족하고 꼬리도 더 두껍다 &nbsp;·&nbsp; `) +
        tr(`−log p is a <strong>square (MSE)</strong> for the Gaussian and an <strong>absolute value (MAE)</strong> for the Laplace. `,
          `−log p가 가우시안은 <strong>제곱(MSE)</strong>, 라플라스는 <strong>절댓값(MAE)</strong>이다. `) +
        tr(`That tail thickness is why MAE moves less on data containing outliers.`,
          `이상치가 있는 데이터에서 MAE가 덜 흔들리는 이유가 이 꼬리 두께다.`));
    }
    slider('lap-b', (v) => { b = v; render(); })._emit();
    toggle('lap-log', (on) => { logScale = on; render(); });
  })();

  /* ------------------------------------------------------- 15. likelihood */

  (function likelihood() {
    const SIGMA = 1;
    let data = [-1.2, 0.3, 0.9, 1.8, 2.4];
    const chD = chart('c-likelihood', { xMin: -5, xMax: 6, yMin: 0, yMax: 0.5 }, render);
    const chC = chart('c-likelihood-curve', { xMin: -3, xMax: 5, yMin: 0, yMax: 1 }, render);
    if (!chD) return;

    const logLik = (mu) => data.reduce((s, x) => s + Math.log(Dist.gaussian(mu, SIGMA).pdf(x)), 0);

    function render() {
      const mle = Stat.mean(data);
      chD.fit().clear();
      chD.axes({ xLabel: 'x', yLabel: 'p(x | μ)' });
      const d = Dist.gaussian(mle, SIGMA);
      chD.curve((x) => d.pdf(x), { color: C.blue, fill: 'rgba(6,69,173,.10)' });
      data.forEach((x) => {
        chD.curve([[x, 0], [x, d.pdf(x)]], { color: 'rgba(249,115,22,.8)', width: 1.4 });
        chD.points([[x, d.pdf(x)]], { color: C.orange, r: 4 });
      });
      chD.vline(mle, { color: C.green, label: `μ̂ = x̄ = ${fmt(mle, 3)}` });

      if (chC) {
        chC.fit().clear();
        const lls = [];
        for (let i = 0; i <= 200; i++) {
          const mu = -3 + (i / 200) * 8;
          lls.push([mu, Math.exp(logLik(mu))]);
        }
        const peak = Math.max(...lls.map((p) => p[1]));
        chC.setY(0, peak * 1.15 || 1);
        chC.axes({ xLabel: tr('μ (parameter)', 'μ (파라미터)'), yLabel: 'L(μ)', yFormat: (v) => v.toExponential(0) });
        chC.curve(lls, { color: C.violet, width: 2.2, fill: 'rgba(124,58,237,.10)' });
        chC.vline(mle, { color: C.green, label: 'argmax' });
      }
      say('r-likelihood',
        tr(`${data.length} data points &nbsp;·&nbsp; L(μ) = Π p(xᵢ | μ) &nbsp;·&nbsp; `,
          `데이터 ${data.length}개 &nbsp;·&nbsp; L(μ) = Π p(xᵢ | μ) &nbsp;·&nbsp; `) +
        tr(`maximum μ̂ = ${fmt(mle, 3)} — under a Gaussian the MLE solution is exactly the <strong>sample mean</strong>. `,
          `최대점 μ̂ = ${fmt(mle, 3)} — 가우시안에서 MLE 해는 정확히 <strong>표본평균</strong>이다. `) +
        tr(`The curve below is a function of μ, not of x, so <em>there is no reason for its area to be 1</em> — a likelihood is not a distribution. `,
          `아래 그래프는 μ의 함수이지 x의 함수가 아니므로 <em>넓이가 1일 이유가 없다</em> — 가능도는 분포가 아니다. `) +
        tr(`Click the upper graph to add data.`, `위 그래프를 클릭하면 데이터를 추가할 수 있습니다.`));
    }

    if (chD) {
      chD.canvas.style.cursor = 'crosshair';
      chD.canvas.addEventListener('click', (e) => {
        const [x] = chD.eventXY(e);
        if (x > chD.xMin && x < chD.xMax) {
          if (data.length >= 12) data = data.slice(1);
          data.push(x);
          render();
        }
      });
    }
    render();
  })();

  /* ------------------------------------------------------------- 16. MLE */

  // Same data, two distribution families. The point of the demo is that the
  // MLE solution moves from the sample mean to the median purely because the
  // assumed noise model changed — and that an outlier drags one but not the other.
  (function mle() {
    const BASE = [-1.2, 0.3, 0.9, 1.8, 2.4];
    const SCALE = 1;                       // σ for the Gaussian, b for the Laplace
    let data = BASE.slice();
    let family = 'gauss';

    const chD = chart('c-mle', { xMin: -5, xMax: 10, yMin: 0, yMax: 0.5 }, render);
    const chC = chart('c-mle-curve', { xMin: -4, xMax: 9, yMin: -60, yMax: 0 }, render);
    if (!chD) return;

    const dist = (mu) => (family === 'gauss'
      ? Dist.gaussian(mu, SCALE)
      : Dist.laplace(mu, SCALE));
    const logLik = (mu) => data.reduce((s, x) => s + Math.log(dist(mu).pdf(x)), 0);

    // Closed-form MLE: the mean for a Gaussian, the median for a Laplace.
    const median = (xs) => {
      const s = [...xs].sort((a, b) => a - b);
      const m = s.length >> 1;
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };
    const solve = () => (family === 'gauss' ? Stat.mean(data) : median(data));

    function render() {
      const mle = solve();
      const other = family === 'gauss' ? median(data) : Stat.mean(data);
      const d = dist(mle);

      chD.fit().clear();
      chD.axes({ xLabel: 'x', yLabel: 'p(x | μ̂)' });
      chD.curve((x) => d.pdf(x), { color: C.blue, fill: 'rgba(6,69,173,.10)' });
      data.forEach((x) => {
        chD.curve([[x, 0], [x, d.pdf(x)]], { color: 'rgba(249,115,22,.75)', width: 1.4 });
        chD.points([[x, d.pdf(x)]], { color: C.orange, r: 4 });
      });
      chD.vline(mle, { color: C.green, label: `μ̂ = ${fmt(mle, 2)}` });
      // Label the reference line only once it has separated from the MLE line;
      // when mean and median nearly coincide the two captions would overlap.
      const apart = Math.abs(mle - other) > 3;
      chD.vline(other, {
        color: C.muted,
        dash: [2, 4],
        label: apart ? tr("the other family's solution", '다른 족의 해') : undefined,
      });

      if (chC) {
        chC.fit().clear();
        const pts = [];
        for (let i = 0; i <= 240; i++) {
          const mu = -4 + (i / 240) * 13;
          pts.push([mu, logLik(mu)]);
        }
        const top = Math.max(...pts.map((p) => p[1]));
        const bottom = Math.min(...pts.map((p) => p[1]));
        chC.setY(Math.max(bottom, top - 60), top + (top - bottom) * 0.08 || 1);
        chC.axes({ xLabel: tr('μ (parameter)', 'μ (파라미터)'), yLabel: 'ℓ(μ) = Σ log p(xᵢ | μ)' });
        chC.curve(pts, { color: C.violet, width: 2.2 });
        chC.vline(mle, { color: C.green, label: 'argmax = MLE' });
      }

      const name = family === 'gauss' ? tr('Gaussian', '가우시안') : tr('Laplace', '라플라스');
      const rule = family === 'gauss' ? tr('the sample mean', '표본평균') : tr('the median', '중앙값');
      say('r-mle',
        tr(`${name} assumption &nbsp;·&nbsp; ${data.length} data points &nbsp;·&nbsp; `,
          `${name} 가정 &nbsp;·&nbsp; 데이터 ${data.length}개 &nbsp;·&nbsp; `) +
        `<strong>μ̂ = ${fmt(mle, 3)}</strong> = ${rule} &nbsp;·&nbsp; ℓ(μ̂) = ${fmt(logLik(mle), 2)}<br>` +
        `${dot(C.green, tr(`MLE for this family = ${fmt(mle, 3)}`, `이 족의 MLE = ${fmt(mle, 3)}`))} &nbsp; ` +
        `${dot(C.muted, tr(`for the other family = ${fmt(other, 3)}`, `다른 족이었다면 = ${fmt(other, 3)}`))} ` +
        tr(`&nbsp;— same data, different assumption, different answer.<br>`,
          `&nbsp;— 같은 데이터, 다른 가정, 다른 답.<br>`) +
        tr(`<em>Press "Add an outlier" and only the Gaussian solution is dragged to the right — squared error protests loudly about a distant point, while absolute error protests at a constant rate.</em>`,
          `<em>"이상치 추가"를 누르면 가우시안 해만 오른쪽으로 끌려갑니다 — 제곱오차는 먼 점에 크게 항의하고, 절대오차는 일정하게만 항의하기 때문입니다.</em>`));
    }

    presetGroup('mle-family', ({ family: f }) => { family = f; render(); });
    const outlier = document.getElementById('mle-outlier');
    if (outlier) outlier.addEventListener('click', () => {
      if (data.length < 12) data.push(7 + Math.random() * 2);
      render();
    });
    const reset = document.getElementById('mle-reset');
    if (reset) reset.addEventListener('click', () => { data = BASE.slice(); render(); });

    chD.canvas.style.cursor = 'crosshair';
    chD.canvas.addEventListener('click', (e) => {
      const [x] = chD.eventXY(e);
      if (x > chD.xMin && x < chD.xMax) {
        if (data.length >= 14) data = data.slice(1);
        data.push(x);
        render();
      }
    });
    render();
  })();

  /* ------------------------------------------------ 17. log-likelihood & NLL */

  (function nll() {
    let n = 10;
    const ch = chart('c-nll', { xMin: 0, xMax: 400, yMin: -400, yMax: 20 }, render);
    if (!ch) return;
    const rng = RNG(97);
    // Typical per-sample probability of a continuous observation under its own
    // model — comfortably below 1, which is what makes the product collapse.
    const ps = Array.from({ length: 400 }, () => 0.12 + rng.uniform() * 0.28);

    function render() {
      const use = ps.slice(0, n);
      const product = use.reduce((a, b) => a * b, 1);
      const logSum = use.reduce((s, p) => s + Math.log(p), 0);

      ch.fit().clear();
      ch.setX(0, Math.max(20, n)).setY(Math.min(-20, logSum * 1.15), 5);
      ch.axes({ xLabel: tr('N (data points)', 'N (데이터 수)'), yLabel: 'log L' });
      let acc = 0;
      const path = ps.slice(0, Math.max(2, n)).map((p, i) => { acc += Math.log(p); return [i + 1, acc]; });
      ch.curve(path, { color: C.violet, width: 2 });
      // float64 stops representing the product around 1e-308.
      const underflowAt = Math.ceil(Math.log(5e-324) / Math.log(0.26));
      if (underflowAt <= n) {
        ch.vline(underflowAt, { color: C.red, label: tr(`N ≈ ${underflowAt}: the product underflows to 0`, `N ≈ ${underflowAt}: 곱이 0으로 언더플로`) });
      }
      say('r-nll',
        tr(`N = ${n} &nbsp;·&nbsp; product Π pᵢ = <strong>${product === 0 ? '0 (underflow!)' : product.toExponential(3)}</strong> `,
          `N = ${n} &nbsp;·&nbsp; 곱 Π pᵢ = <strong>${product === 0 ? '0 (언더플로!)' : product.toExponential(3)}</strong> `) +
        tr(`&nbsp;·&nbsp; log sum Σ log pᵢ = ${fmt(logSum, 2)} &nbsp;·&nbsp; NLL = ${fmt(-logSum, 2)}<br>`,
          `&nbsp;·&nbsp; 로그합 Σ log pᵢ = ${fmt(logSum, 2)} &nbsp;·&nbsp; NLL = ${fmt(-logSum, 2)}<br>`) +
        tr(`Because log is strictly increasing, <strong>the argmax does not change</strong>. Turning the product into a sum removes the underflow, `,
          `log는 단조증가 함수라 <strong>argmax가 바뀌지 않는다</strong>. 곱을 합으로 바꾸면 언더플로가 사라지고, `) +
        tr(`and the derivative decomposes term by term — which is why machine learning losses are almost always of NLL form.`,
          `미분도 항별로 분해된다 — 머신러닝의 손실이 거의 예외 없이 NLL 형태인 이유다.`));
    }
    slider('nll-n', (v) => { n = Math.round(v); render(); }, (v) => String(Math.round(v)))._emit();
  })();

  /* ------------------------------------------------------------ 17. bayes */

  (function bayes() {
    const TRUE_P = 0.7;
    const rng = RNG(2024);
    const flips = Array.from({ length: 60 }, () => (rng.uniform() < TRUE_P ? 1 : 0));
    let n = 0;
    // Beta(2,2) prior: a mild "probably near a half" belief, not a flat one.
    const A0 = 2, B0 = 2;
    const ch = chart('c-bayes', { xMin: 0, xMax: 1, yMin: 0, yMax: 8 }, render);
    if (!ch) return;

    const lnGamma = (z) => {
      // Lanczos, enough for plotting a Beta density.
      const g = [76.18009172947146, -86.50532032941677, 24.01409824083091,
        -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
      let x = z, y = z, tmp = x + 5.5;
      tmp -= (x + 0.5) * Math.log(tmp);
      let ser = 1.000000000190015;
      for (let j = 0; j < 6; j++) ser += g[j] / ++y;
      return -tmp + Math.log(2.5066282746310005 * ser / x);
    };
    const betaPdf = (x, a, b) => {
      if (x <= 0 || x >= 1) return 0;
      const lnB = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
      return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - lnB);
    };

    function render() {
      const seen = flips.slice(0, n);
      const heads = seen.reduce((a, b) => a + b, 0);
      const tails = seen.length - heads;
      const a = A0 + heads, b = B0 + tails;

      ch.fit().clear();
      const peak = Math.max(betaPdf(0.5, A0, B0), betaPdf((a - 1) / (a + b - 2) || 0.5, a, b), 2);
      ch.setY(0, peak * 1.2);
      ch.axes({ xLabel: tr('p (probability the coin lands heads)', 'p (동전이 앞면일 확률)'), yLabel: 'density' });
      ch.curve((x) => betaPdf(x, A0, B0), { color: C.muted, width: 1.6, dash: [4, 3] });
      ch.curve((x) => betaPdf(x, a, b), { color: C.violet, width: 2.4, fill: 'rgba(124,58,237,.12)' });
      ch.vline(TRUE_P, { color: C.green, dash: [3, 3], label: tr(`true p = ${TRUE_P}`, `참값 p = ${TRUE_P}`) });
      if (n > 0) ch.vline(heads / n, { color: C.orange, label: `MLE = ${fmt(heads / n, 3)}` });

      const postMean = a / (a + b);
      say('r-bayes',
        tr(`${n} observations (${heads} heads / ${tails} tails) &nbsp;·&nbsp; `,
          `관측 ${n}회 (앞 ${heads} / 뒤 ${tails}) &nbsp;·&nbsp; `) +
        `${dot(C.muted, 'prior Beta(2,2)')} × likelihood → ${dot(C.violet, `posterior Beta(${a}, ${b})`)}<br>` +
        tr(`posterior mean = ${fmt(postMean, 3)} &nbsp;·&nbsp; MLE = ${n ? fmt(heads / n, 3) : 'undefined'} &nbsp;·&nbsp; `,
          `사후평균 = ${fmt(postMean, 3)} &nbsp;·&nbsp; MLE = ${n ? fmt(heads / n, 3) : '정의 안 됨'} &nbsp;·&nbsp; `) +
        (n === 0
          ? tr('With no data the posterior is just the prior.',
            '데이터가 없으면 사후분포는 사전분포 그대로다.')
          : n < 8
            ? tr('When data is scarce the prior pulls the posterior strongly.',
              '데이터가 적을 때는 사전분포가 사후분포를 크게 끌어당긴다.')
            : tr('As data accumulates the prior fades and the posterior narrows around the true value.',
              '데이터가 쌓일수록 사전분포의 영향은 옅어지고 사후분포는 참값 주변으로 좁아진다.')));
    }

    const sl = slider('bayes-n', (v) => { n = Math.round(v); render(); }, (v) => String(Math.round(v)));
    const play = document.getElementById('bayes-play');
    if (play && sl) play.addEventListener('click', () => {
      n = 0;
      const t0 = performance.now();
      const step = (now) => {
        n = Math.min(60, Math.floor((now - t0) / 45));
        sl.value = String(n);
        sl._emit();
        if (n < 60) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    sl._emit();
  })();

  /* ------------------------------------------------------ 18. prior & MAP */

  (function map() {
    // One-dimensional ridge/lasso: the data pulls w toward w_mle, the prior
    // pulls it toward 0, and the two shapes disagree about what happens at 0.
    const W_MLE = 1.6;
    let lambda = 0;
    let prior = 'gaussian';
    const ch = chart('c-map', { xMin: -1, xMax: 3.2, yMin: 0, yMax: 6 }, render);
    if (!ch) return;

    const nllData = (w) => 0.5 * (w - W_MLE) ** 2;
    const penalty = (w) => (prior === 'gaussian' ? 0.5 * lambda * w * w : lambda * Math.abs(w));
    const objective = (w) => nllData(w) + penalty(w);
    // Both have closed forms, which is exactly why they are the textbook pair.
    const solution = () => (prior === 'gaussian'
      ? W_MLE / (1 + lambda)
      : Math.sign(W_MLE) * Math.max(0, Math.abs(W_MLE) - lambda));

    function render() {
      ch.fit().clear();
      ch.setY(0, 6);
      ch.axes({ xLabel: tr('w (parameter)', 'w (파라미터)'), yLabel: tr('objective', '목적함수') });
      ch.curve(nllData, { color: 'rgba(6,69,173,.45)', width: 1.6, dash: [4, 3] });
      ch.curve(penalty, { color: 'rgba(249,115,22,.6)', width: 1.6, dash: [4, 3] });
      ch.curve(objective, { color: C.violet, width: 2.4 });
      const w = solution();
      ch.vline(W_MLE, { color: 'rgba(6,69,173,.6)', dash: [2, 2], label: `MLE = ${W_MLE}` });
      ch.vline(w, { color: C.green, label: `MAP = ${fmt(w, 3)}` });
      ch.points([[w, objective(w)]], { color: C.green, r: 5 });

      const exactlyZero = prior === 'laplace' && Math.abs(w) < 1e-9;
      say('r-map',
        `${dot('rgba(6,69,173,.6)', tr('NLL (data)', 'NLL (데이터)'))} + ` +
        `${dot('rgba(249,115,22,.8)', prior === 'gaussian'
          ? tr('½λw² (Gaussian prior → L2)', '½λw² (가우시안 prior → L2)')
          : tr('λ|w| (Laplace prior → L1)', 'λ|w| (라플라스 prior → L1)'))} ` +
        `= ${dot(C.violet, tr('objective', '목적함수'))}<br>` +
        tr(`λ = ${fmt(lambda)} &nbsp;·&nbsp; solution w = ${fmt(w, 4)} &nbsp;·&nbsp; `,
          `λ = ${fmt(lambda)} &nbsp;·&nbsp; 해 w = ${fmt(w, 4)} &nbsp;·&nbsp; `) +
        (prior === 'gaussian'
          ? tr(`closed form w = w_MLE/(1+λ) — however large λ grows it <strong>only approaches 0, never reaches it</strong>.`,
            `닫힌 해 w = w_MLE/(1+λ) — λ를 아무리 키워도 <strong>0에 점근할 뿐 0이 되지는 않는다</strong>.`)
          : tr(`closed form w = sign(w)·max(0, |w|−λ) — once λ ≥ ${W_MLE} it becomes <strong>exactly 0</strong>. `,
            `닫힌 해 w = sign(w)·max(0, |w|−λ) — λ ≥ ${W_MLE}이면 <strong>정확히 0</strong>이 된다. `) +
            (exactlyZero ? tr('<strong>That is the current state.</strong> ', '<strong>지금이 그 상태입니다.</strong> ') : '') +
            tr('A prior with a sharp peak is what creates sparsity.', '봉우리가 뾰족한 prior가 희소성을 만든다.')));
    }
    presetGroup('map-prior', (d) => { prior = d.prior; render(); });
    slider('map-lam', (v) => { lambda = v; render(); })._emit();
  })();
})();
