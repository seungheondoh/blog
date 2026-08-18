/*
 * Wires up the collapse post's figures. Built on Chart2D (js/prob-engine.js)
 * and the seeded RNG there.
 *
 * Every figure here is a toy the reader can push around — target types, the six
 * collapse patterns, InfoNCE's two forces, DINO's balance, the sketched
 * normality test. None of them is evidence for anything: the post's claims rest
 * on the papers it cites, and these only show what a mechanism does.
 */
(function () {
  const { RNG, Chart2D, PROB_COLORS: C } = window;
  const isEnglish = document.documentElement.lang === 'en';
  // Readouts are generated at run time and so cannot go through the build's
  // translation table the way the static markup does.
  const tx = (en, ko) => (isEnglish ? en : ko);

  const resizers = [];
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => resizers.forEach((fn) => fn()), 120);
  });

  const fmt = (n, d = 3) => (n === null || n === undefined || Number.isNaN(n) ? '—' : (Object.is(n, -0) ? 0 : n).toFixed(d));
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
      ? 'Interactive diagram about representation collapse'
      : '표현 붕괴를 조작하며 살펴보는 인터랙티브 도식');
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
    if (!box) return null;
    const buttons = $$('button', box);
    buttons.forEach((btn) => btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.toggle('active', b === btn));
      onPick(btn.dataset, btn);
    }));
    return box;
  }

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

  /* =========================================================== 1. targets */
  // Two independent training panels. The coordinates are a schematic 2-D
  // output space, not data coordinates or cluster centroids. In the fixed panel
  // every sample has a stationary target vector. In the learned panel the two
  // marks are the representations of two views of the same sample; a shared
  // encoder scale provides one valid path from the bare matching objective to
  // the constant solution. The path is possible, not inevitable.
  (function targets() {
    const ch = chart('c-target', { padL: 14, padR: 14, padT: 14, padB: 14 }, () => render());
    if (!ch) return;
    const outputColor = '#ef7d32';
    const targetColor = '#1769aa';
    const N = 36;
    let epoch = 0;
    // The panels hold still until the reader asks for them to move. Nothing here
    // animates on load, so the section can be read before it is played.
    let running = false;
    let last = performance.now();
    const EPOCHS = 160;
    let fixed, learnedViewA, learnedViewB, fixedTargets;

    function reset() {
      const rng = RNG(17);
      // A jittered ring makes target diversity visible without suggesting that
      // the target is a class label or one of a few cluster centroids.
      fixedTargets = Array.from({ length: N }, (_, i) => {
        const angle = (i / N) * Math.PI * 2;
        const radius = 0.62 + rng.normal() * 0.07;
        return [Math.cos(angle) * radius, Math.sin(angle) * radius];
      });
      const initial = Array.from({ length: N }, () => [rng.normal() * 0.48, rng.normal() * 0.48]);
      fixed = initial.map((v) => v.slice());
      learnedViewA = initial.map((v) => v.slice());
      learnedViewB = initial.map((v) => [
        v[0] + rng.normal() * 0.22,
        v[1] + rng.normal() * 0.22,
      ]);
      epoch = 0;
      last = performance.now();
      render();
    }

    function stats(points, refs) {
      const mean = [points.reduce((s, v) => s + v[0], 0) / N, points.reduce((s, v) => s + v[1], 0) / N];
      const spread = points.reduce((s, v) => s + (v[0] - mean[0]) ** 2 + (v[1] - mean[1]) ** 2, 0) / N;
      const loss = points.reduce((s, v, i) => s + (v[0] - refs[i][0]) ** 2 + (v[1] - refs[i][1]) ** 2, 0) / N;
      return { spread, loss };
    }

    function update(steps) {
      for (let k = 0; k < steps && epoch < EPOCHS; k++, epoch++) {
        fixed.forEach((v, i) => {
          v[0] += 0.045 * (fixedTargets[i][0] - v[0]);
          v[1] += 0.045 * (fixedTargets[i][1] - v[1]);
        });
        // Both branches depend on one shrinking encoder scale. This decreases
        // ||f(x1)-f(x2)|| while also shrinking between-sample variance.
        [learnedViewA, learnedViewB].forEach((view) => view.forEach((v) => {
          v[0] *= 0.968;
          v[1] *= 0.968;
        }));
      }
    }

    function panel(ctx, x, y, w, h, title, subtitle, points, refs) {
      ctx.fillStyle = '#fbfbfa';
      ctx.strokeStyle = '#deddd8';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#20201e'; ctx.font = '600 13px system-ui'; ctx.textAlign = 'left'; ctx.fillText(title, x + 12, y + 22);
      ctx.fillStyle = '#77736c'; ctx.font = '10px system-ui'; ctx.fillText(subtitle, x + 12, y + 39);
      // Map both axes with one radius so the point geometry does not shear as the
      // full-width, side-by-side comparison resizes.
      const top = y + 48, bottom = y + h - 12;
      const cx = x + w / 2, cy = (top + bottom) / 2;
      const r = Math.min((w - 24) / 2, (bottom - top) / 2) * 0.92;
      const px = (v) => cx + v * r;
      const py = (v) => cy - v * r;
      refs.forEach((v, i) => {
        const p = points[i];
        ctx.beginPath(); ctx.moveTo(px(p[0]), py(p[1])); ctx.lineTo(px(v[0]), py(v[1]));
        ctx.strokeStyle = '#b9b6af55'; ctx.lineWidth = 0.8; ctx.stroke();
      });
      refs.forEach((v) => {
        ctx.beginPath(); ctx.arc(px(v[0]), py(v[1]), 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fbfbfa'; ctx.fill();
        ctx.strokeStyle = targetColor + 'bb'; ctx.lineWidth = 1.2; ctx.stroke();
      });
      points.forEach((v) => {
        ctx.beginPath(); ctx.arc(px(v[0]), py(v[1]), 2.8, 0, Math.PI * 2);
        ctx.fillStyle = outputColor + 'dd'; ctx.fill();
      });
    }

    function render() {
      ch.clear();
      const ctx = ch.ctx;
      const gap = 12;
      const w = (ch.w - 28 - gap) / 2;
      const h = ch.h - 28;
      panel(ctx, 14, 14, w, h, tx('Fixed target', '고정된 target'), tx('output → stationary target', '출력 → 움직이지 않는 target'), fixed, fixedTargets);
      panel(ctx, 14 + w + gap, 14, w, h, tx('Learned target', '함께 학습되는 target'), tx('view 1 ↔ moving view 2', 'view 1 ↔ 함께 움직이는 view 2'), learnedViewA, learnedViewB);
      const fs = stats(fixed, fixedTargets);
      const ls = stats(learnedViewA, learnedViewB);
      const learnedSpread = (stats(learnedViewA, learnedViewA).spread + stats(learnedViewB, learnedViewB).spread) / 2;
      say('r-target', `${tx('epoch', 'epoch')} ${epoch} &nbsp; · &nbsp; <span style="color:${targetColor}">■</span> ${tx('fixed', '고정')} loss ${fmt(fs.loss)} / spread ${fmt(fs.spread)} &nbsp; · &nbsp; <span style="color:#d94b45">■</span> ${tx('learned', '학습')} view-match loss ${fmt(ls.loss)} / spread ${fmt(learnedSpread)}`);
    }

    function frame(now) {
      if (running && now - last > 55) {
        update(Math.min(3, Math.floor((now - last) / 55)));
        last = now;
        render();
      }
      requestAnimationFrame(frame);
    }

    const toggle = document.getElementById('tg-toggle');
    const label = () => { if (toggle) toggle.textContent = running ? tx('Pause', '일시정지') : tx('Play', '재생'); };
    if (toggle) toggle.addEventListener('click', () => {
      // Playing again after the run has finished starts it over, so the button
      // never sits there doing nothing.
      if (!running && epoch >= EPOCHS) reset();
      running = !running;
      label();
      last = performance.now();
    });
    const restart = document.getElementById('tg-restart');
    // Restart keeps whatever play state the reader had chosen.
    if (restart) restart.addEventListener('click', () => { const was = running; reset(); running = was; label(); });
    reset();
    label();
    requestAnimationFrame(frame);
  })();

  /* ============================================================== 4. DINO */
  // Centering is a *batch* operation, so a one-vector toy cannot show what it
  // does: the whole point is that subtracting the batch mean removes what every
  // sample has in common and leaves what distinguishes them. This toy therefore
  // runs 64 samples through the teacher head and reports two numbers, because
  // the two forces show up in different ones — usage perplexity across
  // prototypes (centering's business) and mean per-sample entropy (sharpening's).
  (function dino() {
    const ch = chart('c-dino', { padL: 40, padB: 26, padT: 14 }, () => render());
    if (!ch) return;
    const K = 28, N = 64;

    let mode = 'both';
    let logits = null;

    function build() {
      const rng = RNG(5);
      // One prototype is intrinsically attractive to every sample — the
      // "dominant dimension" DINO's centering exists to neutralise.
      const bias = Array.from({ length: K }, () => rng.uniform() * 0.6);
      bias[4] += 1.8;
      logits = Array.from({ length: N }, () => {
        const s = Array.from({ length: K }, () => rng.uniform() * 1.4);
        return s.map((v, k) => v + bias[k]);
      });
    }

    function simulate(tauT, m, iters = 25) {
      if (!logits) build();
      const useC = mode !== 'nocenter';
      const t = mode === 'nosharp' ? 1.0 : tauT;
      let c = new Array(K).fill(0);
      let usage = new Array(K).fill(1 / K);
      let perSample = 0;
      for (let it = 0; it < iters; it++) {
        usage = new Array(K).fill(0);
        perSample = 0;
        const mean = new Array(K).fill(0);
        for (const l of logits) {
          const adj = l.map((v, k) => (useC ? v - c[k] : v) / t);
          const mx = Math.max(...adj);
          const ex = adj.map((v) => Math.exp(v - mx));
          const z = ex.reduce((a, b) => a + b, 0);
          const p = ex.map((v) => v / z);
          for (let k = 0; k < K; k++) { usage[k] += p[k] / N; mean[k] += l[k] / N; }
          perSample += -p.reduce((a, q) => a + (q > 1e-12 ? q * Math.log(q) : 0), 0) / N;
        }
        // The centre is an EMA of the teacher's batch mean; `m` is how slowly
        // it tracks, which is a real knob and not a free parameter.
        c = c.map((v, k) => m * v + (1 - m) * mean[k]);
      }
      return { usage, perSample };
    }

    function render() {
      const tauT = parseFloat(document.getElementById('dn-t').value);
      const m = parseFloat(document.getElementById('dn-m').value);
      const { usage, perSample } = simulate(tauT, m);
      const H = -usage.reduce((a, q) => a + (q > 1e-12 ? q * Math.log(q) : 0), 0);
      const perp = Math.exp(H);

      ch.setX(-0.5, K - 0.5).setY(0, Math.max(0.12, Math.max(...usage) * 1.15));
      ch.clear().axes({ grid: false, yLabel: tx('prototype usage', 'prototype 사용 확률') });
      ch.bars(usage.map((v, i) => ({ lo: i - 0.42, hi: i + 0.42, value: v })),
        { color: 'rgba(124,58,237,.6)', stroke: 'rgba(124,58,237,.9)' });
      ch.hline(1 / K, { color: '#999', dash: [3, 3], label: tx('uniform', '균등') });

      const verdict = mode === 'nocenter'
        ? tx('<strong>every sample picks the same prototype — mode collapse.</strong>',
          '<strong>모든 sample이 같은 prototype을 고릅니다 — mode collapse.</strong>')
        : mode === 'nosharp'
          ? tx('<strong>usage is perfectly flat, but each sample is flat too — no information.</strong>',
            '<strong>usage는 완벽히 균등한데 sample 하나하나도 균등합니다 — 정보량 0.</strong>')
          : tx('spread across prototypes, sharp within a sample.',
            'prototype 전체로는 퍼지고, sample 하나 안에서는 뾰족합니다.');
      say('r-dino', [
        tx(`usage perplexity = ${fmt(perp, 1)} / ${K}`, `usage perplexity = ${fmt(perp, 1)} / ${K}`),
        tx(`per-sample entropy = ${fmt(perSample, 2)} (max ${fmt(Math.log(K), 2)})`,
          `sample당 엔트로피 = ${fmt(perSample, 2)} (최대 ${fmt(Math.log(K), 2)})`),
        verdict,
      ].join(' &nbsp; '));
    }

    slider('dn-t', render);
    slider('dn-m', render);
    presetGroup('dino-presets', (d) => { mode = d.mode; render(); });
    render();
  })();

  /* ============================================================ 5. SIGReg */
  // A 2-D cloud, sketched onto random directions. The statistic is the real
  // Epps-Pulley one, computed in the browser on the sketched marginals. The two
  // halves are separate canvases: the projection and the test it feeds are
  // different pictures, and squeezing them side by side made both too small.
  (function sigreg() {
    const cloud = chart('c-sigreg-cloud', { padL: 34, padR: 16, padT: 14, padB: 26 }, () => render());
    const marg = chart('c-sigreg-marg', { padL: 34, padR: 16, padT: 22, padB: 26 }, () => render());
    if (!cloud || !marg) return;
    let seed = 2;

    function eppsPulley(x) {
      const n = x.length;
      let a = 0, b = 0;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) a += Math.exp(-((x[i] - x[j]) ** 2) / 2);
        b += Math.exp(-(x[i] ** 2) / 4);
      }
      return (1 + n / Math.sqrt(3) + a / n - Math.sqrt(2) * b) / n;
    }

    // Collapse here shrinks the cloud towards a point, which is what the
    // statistic is supposed to notice.
    function model() {
      const col = parseFloat(document.getElementById('sg-c').value);
      const M = Math.round(parseFloat(document.getElementById('sg-m').value));
      const rng = RNG(seed);
      const N = 180;
      const pts = Array.from({ length: N }, () => {
        const u = rng.normal(), v = rng.normal();
        return [u * (1 - col), v * (1 - col * 0.6)];
      });
      const dirs = Array.from({ length: M }, () => {
        const t = rng.uniform() * Math.PI * 2;
        return [Math.cos(t), Math.sin(t)];
      });
      const stats = dirs.map((d) => eppsPulley(pts.map((p) => p[0] * d[0] + p[1] * d[1])));
      const mean = stats.reduce((a, b) => a + b, 0) / M;
      const sd = Math.sqrt(stats.reduce((a, b) => a + (b - mean) ** 2, 0) / M);
      return { col, M, pts, dirs, stats, mean, sd };
    }

    function label(ch, text) {
      const ctx = ch.ctx;
      ctx.save();
      ctx.fillStyle = C.muted;
      ctx.font = '10px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(text, ch.padL, 12);
      ctx.restore();
    }

    function drawCloud({ pts, dirs }) {
      cloud.setX(-3.4, 3.4).setY(-3.4, 3.4);
      cloud.clear().axes({ grid: false });
      const ctx = cloud.ctx;
      ctx.save();
      pts.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(cloud.px(x), cloud.py(y), 2.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(8,145,178,.55)';
        ctx.fill();
      });
      // The direction whose shadow the second panel draws.
      const d0 = dirs[0];
      ctx.strokeStyle = C.orange;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cloud.px(-3.2 * d0[0]), cloud.py(-3.2 * d0[1]));
      ctx.lineTo(cloud.px(3.2 * d0[0]), cloud.py(3.2 * d0[1]));
      ctx.stroke();
      ctx.restore();
      label(cloud, tx('representations and one sketched direction', '표현들과 그중 한 방향'));
    }

    function drawMarginal({ pts, dirs }) {
      const d0 = dirs[0];
      const proj = pts.map((p) => p[0] * d0[0] + p[1] * d0[1]);
      const bins = 26, lo = -3, hi = 3;
      const counts = new Array(bins).fill(0);
      proj.forEach((v) => {
        const b = Math.floor(((v - lo) / (hi - lo)) * bins);
        if (b >= 0 && b < bins) counts[b]++;
      });
      const maxC = Math.max(1, ...counts);

      marg.setX(lo, hi).setY(0, 1);
      marg.clear().axes({ grid: false });
      const ctx = marg.ctx;
      const w = (marg.px(hi) - marg.px(lo)) / bins;
      ctx.save();
      ctx.fillStyle = 'rgba(249,115,22,.6)';
      counts.forEach((c, i) => {
        const top = marg.py((c / maxC) * 0.9);
        ctx.fillRect(marg.px(lo) + i * w, top, Math.max(1, w - 1.5), marg.py(0) - top);
      });
      // N(0,1) reference, scaled to the same peak as the histogram.
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const v = lo + (i / 80) * (hi - lo);
        const y = Math.exp(-v * v / 2) * 0.9;
        if (i) ctx.lineTo(marg.px(v), marg.py(y)); else ctx.moveTo(marg.px(v), marg.py(y));
      }
      ctx.stroke();
      ctx.restore();
      label(marg, tx('that direction’s 1-D shadow vs N(0,1)', '그 방향의 1차원 그림자 vs N(0,1)'));
    }

    function render() {
      const m = model();
      const { col, M, mean, sd } = m;
      drawCloud(m);
      drawMarginal(m);

      say('r-sigreg', [
        tx(`statistic = ${fmt(mean, 3)}`, `통계량 = ${fmt(mean, 3)}`),
        tx(`spread over M = ±${fmt(sd, 3)}`, `M개 방향 간 편차 = ±${fmt(sd, 3)}`),
        col > 0.6
          ? tx('<strong>collapsed — every direction fails the test at once.</strong>',
            '<strong>collapse 상태 — 어느 방향으로 잘라도 동시에 검정을 통과하지 못합니다.</strong>')
          : M < 6
            ? tx('<strong>few directions — the estimate is noisy.</strong>',
              '<strong>방향이 적으면 추정이 요동칩니다.</strong>')
            : '',
      ].filter(Boolean).join(' &nbsp; '));
    }

    slider('sg-c', render);
    slider('sg-m', render, (v) => String(Math.round(v)));
    const re = document.getElementById('sg-reseed');
    if (re) re.addEventListener('click', () => { seed = (seed * 5 + 3) % 9973; render(); });
    render();
  })();

})();
