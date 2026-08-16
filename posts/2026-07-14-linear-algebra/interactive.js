/*
 * Wires up the interactive topics using js/engine.js (LA, Plane2D, Iso3D,
 * makeDraggable). Each section is self-contained: grabs its own canvas/DOM
 * nodes, keeps local state, and re-renders on drag/slider/button events.
 */
(function () {
  const { LA, Plane2D, Iso3D, makeDraggable } = window;
  const isEnglish = document.documentElement.lang === 'en';
  const resizers = [];
  const onResize = () => resizers.forEach((fn) => fn());
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(onResize, 120);
  });

  const fmt = (n, d = 2) => (Object.is(n, -0) ? 0 : n).toFixed(d);
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // Canvas drawings are supplemented by the visible readout immediately below
  // each demo. Expose that relationship to assistive technology as well.
  $$('canvas').forEach((canvas) => {
    const demo = canvas.closest('.topic-demo');
    const readout = demo && demo.querySelector('.readout');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', isEnglish ? 'Interactive linear algebra diagram' : '선형대수 개념을 조작하며 살펴보는 인터랙티브 도식');
    if (readout && readout.id) canvas.setAttribute('aria-describedby', readout.id);
  });
  $$('.readout').forEach((readout) => {
    readout.setAttribute('aria-live', 'polite');
    readout.setAttribute('aria-atomic', 'true');
  });

  const indexLinks = $$('.la-index a');
  const indexedSections = indexLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);
  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
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
    indexedSections.forEach((section) => sectionObserver.observe(section));
  }

  function drawWarpedGrid(plane, M, opts = {}) {
    const N = opts.N ?? 5;
    const color = opts.color || '#e2e2e2';
    for (let k = -N; k <= N; k++) {
      plane.segment(LA.matVec(M, [k, -N]), LA.matVec(M, [k, N]), { color, width: 1 });
    }
    for (let k = -N; k <= N; k++) {
      plane.segment(LA.matVec(M, [-N, k]), LA.matVec(M, [N, k]), { color, width: 1 });
    }
  }

  function drawBasisGrid(plane, b1, b2, opts = {}) {
    const N = opts.N ?? 4;
    const color = opts.color || 'rgba(6,69,173,0.4)';
    for (let s = -N; s <= N; s++) {
      const p1 = LA.add(LA.scale(b1, s), LA.scale(b2, -N));
      const p2 = LA.add(LA.scale(b1, s), LA.scale(b2, N));
      plane.segment(p1, p2, { color, width: 1 });
    }
    for (let s = -N; s <= N; s++) {
      const p1 = LA.add(LA.scale(b2, s), LA.scale(b1, -N));
      const p2 = LA.add(LA.scale(b2, s), LA.scale(b1, N));
      plane.segment(p1, p2, { color, width: 1 });
    }
  }

  function initPlane(id, opts) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    return new Plane2D(canvas, opts);
  }

  // ---------- 1. vector basics ----------
  (function initVector() {
    const plane = initPlane('c-vector', { xMin: -6, xMax: 6, yMin: -3.5, yMax: 4.5 });
    if (!plane) return;
    const trig = initPlane('c-vector-trig', { xMin: -1.8, xMax: 1.8, yMin: -1.8, yMax: 1.8, pad: 20 });
    const v = { x: 3, y: 1 };
    const readout = $('#r-vector');
    const trigReadout = $('#r-vector-trig');

    function renderTrig(angleRad) {
      if (!trig) return;
      const c = Math.cos(angleRad);
      const s = Math.sin(angleRad);
      trig.clear();
      trig.grid(0.5);
      trig.axes();
      trig.circle([0, 0], 1, { stroke: '#ccc' });
      trig.arrow([0, 0], [c, s], { color: '#222', width: 1.8 });
      trig.segment([0, 0], [c, 0], { color: '#16a34a', width: 3 });
      trig.text([c / 2, 0], 'cosθ', { color: '#16a34a', dy: 14 });
      trig.segment([c, 0], [c, s], { color: '#0645ad', width: 3 });
      trig.text([c, s / 2], 'sinθ', { color: '#0645ad', dx: 6 });

      let tanStr = '∞';
      if (Math.abs(c) > 0.12) {
        const t = s / c;
        tanStr = fmt(t, 3);
        const tClamped = Math.max(-1.7, Math.min(1.7, t));
        trig.segment([1, -1.8], [1, 1.8], { color: '#eee' });
        trig.segment([1, 0], [1, tClamped], { color: '#dc2626', width: 3 });
        trig.text([1, tClamped / 2], 'tanθ', { color: '#dc2626', dx: 6 });
        trig.segment([0, 0], [1, tClamped], { color: '#ddd', dash: [3, 3] });
      }
      trigReadout.textContent = `cosθ = ${fmt(c, 3)} · sinθ = ${fmt(s, 3)} · tanθ = ${tanStr}`;
    }

    function render() {
      plane.clear();
      plane.grid(1);
      plane.axes();

      const norm = LA.norm([v.x, v.y]);
      const angleRad = Math.atan2(v.y, v.x);
      const angle = (angleRad * 180) / Math.PI;

      // theta arc (math angle -> canvas angle is mirrored because pixel-y is flipped)
      const arcR = Math.min(0.9, norm * 0.4 || 0.9);
      const [cx, cy] = plane.toPx([0, 0]);
      const ctx = plane.ctx;
      ctx.save();
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(cx, cy, arcR * plane.scale, 0, -angleRad, angleRad > 0);
      ctx.stroke();
      ctx.restore();
      plane.text([Math.cos(angleRad / 2) * (arcR + 0.35), Math.sin(angleRad / 2) * (arcR + 0.35)], 'θ', { color: '#f97316' });

      plane.arrow([0, 0], [v.x, v.y], { color: '#222', label: 'v' });
      plane.point([v.x, v.y], { color: '#222', r: 6, ring: true });
      plane.text([v.x * 0.5, v.y * 0.5], 'r', { color: '#0645ad', dx: 6, dy: -6 });

      readout.textContent = `v = (${fmt(v.x)}, ${fmt(v.y)}) · ‖v‖ = ${fmt(norm)} · θ = ${fmt(angle, 1)}°`;
      renderTrig(angleRad);
    }

    makeDraggable(plane.canvas, plane, [v], render, { clamp: true });
    render();
    resizers.push(() => { plane._fit(); if (trig) trig._fit(); render(); });
  })();

  // ---------- 2. operations ----------
  (function initOps() {
    const plane = initPlane('c-ops', { xMin: -6, xMax: 6, yMin: -3.5, yMax: 4.5 });
    if (!plane) return;
    const v = { x: 3, y: 1 };
    const w = { x: 1, y: 2 };
    const kInput = $('#ops-k');
    const kVal = $('#ops-k-val');
    const readout = $('#r-ops');

    function render() {
      const k = parseFloat(kInput.value);
      kVal.textContent = fmt(k, 1);
      plane.clear();
      plane.grid(1);
      plane.axes();
      const sum = LA.add([v.x, v.y], [w.x, w.y]);
      const diff = LA.sub([v.x, v.y], [w.x, w.y]);
      const mid = LA.scale(sum, 0.5);
      plane.segment([v.x, v.y], sum, { color: '#ccc', dash: [4, 4] });
      plane.segment([w.x, w.y], sum, { color: '#ccc', dash: [4, 4] });
      plane.segment([w.x, w.y], [v.x, v.y], { color: '#16a34a', width: 2, dash: [5, 3] });
      plane.text([(v.x + w.x) / 2, (v.y + w.y) / 2], 'v-w', { color: '#16a34a', dy: -8 });
      plane.point(mid, { color: '#9333ea', r: 5, ring: true, label: 'M' });
      plane.arrow([0, 0], [v.x, v.y], { color: '#0645ad', label: 'v' });
      plane.arrow([0, 0], [w.x, w.y], { color: '#f97316', label: 'w' });
      plane.arrow([0, 0], sum, { color: '#222', label: 'v+w' });
      const kv = LA.scale([v.x, v.y], k);
      plane.arrow([0, 0], kv, { color: '#0645ad', width: 1.5, dash: [2, 3], label: 'kv' });
      readout.textContent = `v+w=(${fmt(sum[0])},${fmt(sum[1])}) · v-w=(${fmt(diff[0])},${fmt(diff[1])}) · M=(v+w)/2=(${fmt(mid[0])},${fmt(mid[1])}) · kv=(${fmt(kv[0])},${fmt(kv[1])})`;
    }

    makeDraggable(plane.canvas, plane, [v, w], render, { clamp: true });
    kInput.addEventListener('input', render);
    render();
    resizers.push(() => { plane._fit(); render(); });
  })();

  // ---------- 3. norm ----------
  (function initNorm() {
    const plane = initPlane('c-norm', { xMin: -6, xMax: 6, yMin: -4, yMax: 4 });
    if (!plane) return;
    const v = { x: 3, y: 2 };
    const readout = $('#r-norm');

    function render() {
      plane.clear();
      plane.grid(1);
      plane.circle([0, 0], 1, { stroke: 'rgba(6,69,173,0.45)', dash: [3, 3] });
      plane.polygon([[1, 0], [0, 1], [-1, 0], [0, -1]], { stroke: 'rgba(249,115,22,0.55)' });
      plane.polygon([[1, 1], [-1, 1], [-1, -1], [1, -1]], { stroke: 'rgba(34,34,34,0.35)' });
      plane.axes();
      plane.arrow([0, 0], [v.x, v.y], { color: '#222', width: 2.4, label: 'v' });
      plane.point([v.x, v.y], { color: '#222', r: 5.5, ring: true });

      const n1 = Math.abs(v.x) + Math.abs(v.y);
      const n2 = LA.norm([v.x, v.y]);
      const nInf = Math.max(Math.abs(v.x), Math.abs(v.y));
      readout.textContent = `v = (${fmt(v.x)}, ${fmt(v.y)}) · ‖v‖₁ = ${fmt(n1)} · ‖v‖₂ = ${fmt(n2)} · ‖v‖∞ = ${fmt(nInf)}`;
    }

    makeDraggable(plane.canvas, plane, [v], render, { clamp: true });
    render();
    resizers.push(() => { plane._fit(); render(); });
  })();

  // ---------- 3b. embedding normalization (L2, before/after) ----------
  (function initNormEmbed() {
    const plane = initPlane('c-norm-embed', { xMin: -4, xMax: 4, yMin: -3, yMax: 3 });
    if (!plane) return;
    const pts = [[3, 1], [1, 3], [-2, 2.5], [2.5, -1.5], [0.6, 0.4]];
    const colors = ['#0645ad', '#f97316', '#16a34a', '#dc2626', '#9333ea'];
    const tInput = $('#embed-t');
    const tVal = $('#embed-t-val');
    const readout = $('#r-norm-embed');
    const playBtn = $('#embed-play');
    let animId = null;

    function render() {
      const t = parseFloat(tInput.value);
      tVal.textContent = fmt(t);
      plane.clear();
      plane.grid(1);
      plane.circle([0, 0], 1, { stroke: 'rgba(6,69,173,0.5)', dash: [3, 3] });
      plane.axes();
      pts.forEach((p, i) => {
        const n = LA.normalize(p);
        const cur = [p[0] * (1 - t) + n[0] * t, p[1] * (1 - t) + n[1] * t];
        plane.segment([0, 0], cur, { color: colors[i], width: 1, dash: [2, 2] });
        plane.point(cur, { color: colors[i], r: 6, ring: true });
      });
      readout.textContent = t < 0.5
        ? (isEnglish ? 'Before normalization — embeddings have different magnitudes.' : '정규화 전 — 임베딩마다 크기(길이)가 제각각입니다.')
        : (isEnglish ? 'After normalization — all vectors lie on the unit circle.' : '정규화 후 — 모두 단위원 위, 방향만 남았습니다.');
    }

    tInput.addEventListener('input', render);
    playBtn.addEventListener('click', () => {
      if (animId) return;
      const startT = parseFloat(tInput.value);
      const endT = startT > 0.5 ? 0 : 1;
      const dur = 900;
      const t0 = performance.now();
      function step(now) {
        const p = Math.min(1, (now - t0) / dur);
        tInput.value = startT + (endT - startT) * easeInOutCubic(p);
        render();
        if (p < 1) animId = requestAnimationFrame(step);
        else animId = null;
      }
      animId = requestAnimationFrame(step);
    });

    render();
    resizers.push(() => { plane._fit(); render(); });
  })();

  // ---------- 3c. probability distribution normalization (L1, before/after) ----------
  (function initNormProb() {
    const plane = initPlane('c-norm-prob', { xMin: -0.4, xMax: 2.2, yMin: -0.4, yMax: 2.2 });
    if (!plane) return;
    const pts = [[1.5, 0.5], [0.5, 1.8], [1, 1], [0.3, 1.6], [1.8, 0.4]];
    const colors = ['#0645ad', '#f97316', '#16a34a', '#dc2626', '#9333ea'];
    const tInput = $('#prob-t');
    const tVal = $('#prob-t-val');
    const readout = $('#r-norm-prob');
    const playBtn = $('#prob-play');
    let animId = null;

    function render() {
      const t = parseFloat(tInput.value);
      tVal.textContent = fmt(t);
      plane.clear();
      plane.grid(0.5);
      plane.polygon([[1, 0], [0, 1], [-1, 0], [0, -1]], { stroke: 'rgba(34,34,34,0.25)' });
      plane.segment([1, 0], [0, 1], { color: 'rgba(6,69,173,0.6)', width: 2.5 });
      plane.text([0.5, 0.5], 'Σpᵢ=1', { color: '#0645ad', dx: 8, dy: -8 });
      plane.axes();
      pts.forEach((p, i) => {
        const s = p[0] + p[1];
        const n = [p[0] / s, p[1] / s];
        const cur = [p[0] * (1 - t) + n[0] * t, p[1] * (1 - t) + n[1] * t];
        plane.point(cur, { color: colors[i], r: 6, ring: true });
      });
      readout.textContent = t < 0.5
        ? (isEnglish ? 'Before normalization — positive scores have different sums.' : '정규화 전 — 원시 양수 점수, 합이 제각각입니다.')
        : (isEnglish ? 'After normalization — every point satisfies Σpᵢ=1.' : '정규화 후 — 모두 대각선(Σpᵢ=1) 위, 확률분포가 되었습니다.');
    }

    tInput.addEventListener('input', render);
    playBtn.addEventListener('click', () => {
      if (animId) return;
      const startT = parseFloat(tInput.value);
      const endT = startT > 0.5 ? 0 : 1;
      const dur = 900;
      const t0 = performance.now();
      function step(now) {
        const p = Math.min(1, (now - t0) / dur);
        tInput.value = startT + (endT - startT) * easeInOutCubic(p);
        render();
        if (p < 1) animId = requestAnimationFrame(step);
        else animId = null;
      }
      animId = requestAnimationFrame(step);
    });

    render();
    resizers.push(() => { plane._fit(); render(); });
  })();

  // ---------- 4. dot product ----------
  (function initDot() {
    const plane = initPlane('c-dot', { xMin: -6, xMax: 6, yMin: -3.5, yMax: 4.5 });
    if (!plane) return;
    const r = { x: 2, y: 1 };
    const v = { x: 3, y: 1 };
    const readout = $('#r-dot');

    function render() {
      plane.clear();
      plane.grid(1);
      plane.axes();
      const rr = LA.dot([r.x, r.y], [r.x, r.y]);
      const dot = LA.dot([r.x, r.y], [v.x, v.y]);
      const proj = rr > 1e-9 ? LA.scale([r.x, r.y], dot / rr) : [0, 0];
      plane.segment([v.x, v.y], proj, { color: '#bbb', dash: [4, 4] });
      plane.arrow([0, 0], proj, { color: '#f97316', width: 3, label: 'proj' });
      plane.arrow([0, 0], [r.x, r.y], { color: '#0645ad', label: 'r' });
      plane.arrow([0, 0], [v.x, v.y], { color: '#222', label: 'v' });
      const normR = LA.norm([r.x, r.y]);
      const normV = LA.norm([v.x, v.y]);
      const cosT = normR > 1e-9 && normV > 1e-9 ? dot / (normR * normV) : 0;
      readout.textContent = `r·v = ${fmt(dot)} · cosθ = ${fmt(cosT)} · ${isEnglish ? 'projection length' : 'proj 길이'} = ${fmt(dot / (normR || 1))}`;
    }

    makeDraggable(plane.canvas, plane, [r, v], render, { clamp: true });
    render();
    resizers.push(() => { plane._fit(); render(); });
  })();

  // ---------- 5. cross product ----------
  (function initCross() {
    const plane = initPlane('c-cross2d', { xMin: -1, xMax: 5, yMin: -1, yMax: 5 });
    const iso = document.getElementById('c-cross3d') ? new Iso3D(document.getElementById('c-cross3d'), { scale: 45 }) : null;
    if (!plane || !iso) return;
    const a = { x: 3, y: 0 };
    const b = { x: 1, y: 2 };
    const readout = $('#r-cross');

    function render() {
      plane.clear();
      plane.grid(1);
      plane.axes();
      const sum = LA.add([a.x, a.y], [b.x, b.y]);
      plane.polygon([[0, 0], [a.x, a.y], sum, [b.x, b.y]], { fill: 'rgba(249,115,22,0.18)', stroke: 'rgba(249,115,22,0.6)' });
      plane.arrow([0, 0], [a.x, a.y], { color: '#0645ad', label: 'a' });
      plane.arrow([0, 0], [b.x, b.y], { color: '#f97316', label: 'b' });

      iso.clear();
      iso.axes(3.4);
      const av = [a.x, a.y, 0];
      const bv = [b.x, b.y, 0];
      const c = LA.cross3(av, bv);
      iso.parallelogram(av, bv);
      iso.arrow([0, 0, 0], av, { color: '#0645ad', label: 'a' });
      iso.arrow([0, 0, 0], bv, { color: '#f97316', label: 'b' });
      if (LA.norm(c) > 1e-6) iso.arrow([0, 0, 0], c, { color: '#16a34a', label: 'a×b' });

      const area = Math.abs(LA.cross2([a.x, a.y], [b.x, b.y]));
      readout.textContent = `a×b = (${fmt(c[0])}, ${fmt(c[1])}, ${fmt(c[2])}) · ${isEnglish ? 'area' : '넓이'} = ${fmt(area)}`;
    }

    makeDraggable(plane.canvas, plane, [a, b], render, { clamp: true });
    render();
    resizers.push(() => { plane._fit(); iso._fit({}); render(); });
  })();

  // ---------- 6. linear combination ----------
  (function initCombo() {
    const plane = initPlane('c-combo', { xMin: -6, xMax: 6, yMin: -6, yMax: 6 });
    if (!plane) return;
    const a1 = [1, 3];
    const a2 = [2, 4];
    const c1Input = $('#combo-c1');
    const c2Input = $('#combo-c2');
    const c1Val = $('#combo-c1-val');
    const c2Val = $('#combo-c2-val');
    const readout = $('#r-combo');

    function render() {
      const c1 = parseFloat(c1Input.value);
      const c2 = parseFloat(c2Input.value);
      c1Val.textContent = fmt(c1, 1);
      c2Val.textContent = fmt(c2, 1);
      plane.clear();
      plane.grid(1);
      plane.axes();
      plane.arrow([0, 0], a1, { color: '#ddd', width: 1.5, label: 'a₁' });
      plane.arrow([0, 0], a2, { color: '#ddd', width: 1.5, label: 'a₂' });
      const p1 = LA.scale(a1, c1);
      const result = LA.add(p1, LA.scale(a2, c2));
      plane.arrow([0, 0], p1, { color: '#0645ad', label: 'c₁a₁' });
      plane.segment(p1, result, { color: '#f97316', dash: [4, 4] });
      plane.arrow(p1, result, { color: '#f97316', label: 'c₂a₂' });
      plane.arrow([0, 0], result, { color: '#222', width: 2.6, label: isEnglish ? 'result' : '결과' });
      readout.textContent = `c₁a₁ + c₂a₂ = (${fmt(result[0])}, ${fmt(result[1])})`;
    }

    c1Input.addEventListener('input', render);
    c2Input.addEventListener('input', render);
    render();
    resizers.push(() => { plane._fit(); render(); });
  })();

  // ---------- 7. linear independence, span & basis ----------
  (function initIndependence() {
    const plane = initPlane('c-independence', { xMin: -6, xMax: 6, yMin: -4, yMax: 4 });
    if (!plane) return;
    const v1 = { x: 2, y: 1 };
    const v2 = { x: 1, y: 2 };
    const readout = $('#r-independence');

    function render() {
      const det = LA.det2([v1.x, v1.y, v2.x, v2.y]);
      const independent = Math.abs(det) > 0.06;
      plane.clear();
      plane.grid(1);

      if (independent) {
        plane.polygon([[plane.xMin, plane.yMin], [plane.xMax, plane.yMin], [plane.xMax, plane.yMax], [plane.xMin, plane.yMax]], { fill: 'rgba(6,69,173,0.08)' });
      } else if (LA.norm([v1.x, v1.y]) > 1e-6) {
        plane.lineThrough([0, 0], [v1.x, v1.y], { color: 'rgba(6,69,173,0.55)', width: 3 });
      }
      plane.axes();
      plane.arrow([0, 0], [v1.x, v1.y], { color: '#0645ad', label: 'v₁' });
      plane.arrow([0, 0], [v2.x, v2.y], { color: '#f97316', label: 'v₂' });

      readout.textContent = `v₁=(${fmt(v1.x)},${fmt(v1.y)}), v₂=(${fmt(v2.x)},${fmt(v2.y)}) · det=${fmt(det)} · ${independent ? (isEnglish ? 'independent' : '선형독립') : (isEnglish ? 'dependent' : '선형종속')} · ${isEnglish ? 'span dimension' : 'span 차원'} = ${independent ? 2 : 1}`;
    }

    makeDraggable(plane.canvas, plane, [v1, v2], render, { clamp: true });
    render();
    resizers.push(() => { plane._fit(); render(); });
  })();

  // ---------- 8. linear function ----------
  (function initFunc() {
    const plane = initPlane('c-func', { xMin: -6, xMax: 6, yMin: -3.5, yMax: 4.5 });
    if (!plane) return;
    const r = [2, 1];
    const A = { x: 3, y: 1 };
    const B = { x: 1, y: 2 };
    const readout = $('#r-func');
    const f = (p) => LA.dot(r, p);

    function render() {
      plane.clear();
      plane.grid(1);
      plane.axes();
      const sum = LA.add([A.x, A.y], [B.x, B.y]);
      const dir = [-r[1], r[0]];
      plane.lineThrough([A.x, A.y], dir, { color: 'rgba(6,69,173,0.35)', dash: [3, 3] });
      plane.lineThrough([B.x, B.y], dir, { color: 'rgba(249,115,22,0.35)', dash: [3, 3] });
      plane.lineThrough(sum, dir, { color: 'rgba(34,34,34,0.35)', dash: [3, 3] });
      plane.arrow([0, 0], r, { color: '#999', label: 'r' });
      plane.segment([A.x, A.y], sum, { color: '#ccc', dash: [4, 4] });
      plane.segment([B.x, B.y], sum, { color: '#ccc', dash: [4, 4] });
      plane.arrow([0, 0], [A.x, A.y], { color: '#0645ad', label: 'A' });
      plane.arrow([0, 0], [B.x, B.y], { color: '#f97316', label: 'B' });
      plane.arrow([0, 0], sum, { color: '#222', label: 'A+B' });
      const fa = f([A.x, A.y]);
      const fb = f([B.x, B.y]);
      const fab = f(sum);
      const ok = Math.abs(fa + fb - fab) < 1e-6 ? '✓' : '✗';
      readout.textContent = `f(A)=${fmt(fa)}, f(B)=${fmt(fb)} → f(A)+f(B)=${fmt(fa + fb)} · f(A+B)=${fmt(fab)} ${ok}`;
    }

    makeDraggable(plane.canvas, plane, [A, B], render, { clamp: true });
    render();
    resizers.push(() => { plane._fit(); render(); });
  })();

  // ---------- 8. linear transformation ----------
  (function initTransform() {
    const plane = initPlane('c-transform', { xMin: -6, xMax: 6, yMin: -4, yMax: 4 });
    if (!plane) return;
    const ids = ['tf-a', 'tf-b', 'tf-c', 'tf-d'];
    const inputs = ids.map((id) => $('#' + id));
    const vals = ids.map((id) => $('#' + id + '-val'));
    const readout = $('#r-transform');

    const presets = {
      rotate: [Math.SQRT1_2, -Math.SQRT1_2, Math.SQRT1_2, Math.SQRT1_2],
      shear: [1, 1, 0, 1],
      scale: [1.6, 0, 0, 0.6],
      reflect: [1, 0, 0, -1],
      reset: [2, -3, 1, 1],
    };

    function currentM() {
      return inputs.map((inp) => parseFloat(inp.value));
    }

    function render() {
      const M = currentM();
      inputs.forEach((inp, i) => { vals[i].textContent = fmt(parseFloat(inp.value), 1); });
      plane.clear();
      drawWarpedGrid(plane, M);
      plane.axes();
      plane.arrow([0, 0], [M[0], M[2]], { color: '#0645ad', label: 'A·î' });
      plane.arrow([0, 0], [M[1], M[3]], { color: '#f97316', label: 'A·ĵ' });
      readout.textContent = `A = [[${fmt(M[0], 1)}, ${fmt(M[1], 1)}], [${fmt(M[2], 1)}, ${fmt(M[3], 1)}]] · det(A) = ${fmt(LA.det2(M))}`;
    }

    inputs.forEach((inp) => inp.addEventListener('input', render));
    $$('#transform .preset-row button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = presets[btn.dataset.preset];
        if (!p) return;
        inputs.forEach((inp, i) => { inp.value = p[i]; });
        render();
      });
    });

    render();
    resizers.push(() => { plane._fit(); render(); });
  })();

  // ---------- 9. matrix multiplication ----------
  (function initMultiply() {
    const plane = initPlane('c-multiply', { xMin: -12, xMax: 12, yMin: -8, yMax: 8 });
    if (!plane) return;
    const A = [2, -3, 1, 1]; // same A as sections 8/10
    const B = [1, 2, 3, 4]; // same numbers as sections 6/15
    const AB = LA.matMul(A, B);
    const BA = LA.matMul(B, A);
    const readout = $('#r-multiply');
    const swapBtn = $('#mult-swap');
    const playBtn = $('#mult-play');
    let showBA = false;
    let animId = null;

    function draw(M) {
      plane.clear();
      drawWarpedGrid(plane, M, { N: 8 });
      plane.axes();
      plane.arrow([0, 0], [M[0], M[2]], { color: '#0645ad' });
      plane.arrow([0, 0], [M[1], M[3]], { color: '#f97316' });
    }

    function render() {
      const M = showBA ? BA : AB;
      draw(M);
      swapBtn.textContent = showBA ? (isEnglish ? 'AB ↔ BA (showing BA)' : 'AB ↔ BA 전환 (지금: BA)') : (isEnglish ? 'AB ↔ BA (showing AB)' : 'AB ↔ BA 전환 (지금: AB)');
      readout.textContent = `A=[[2,-3],[1,1]], B=[[1,2],[3,4]] · ${showBA ? 'BA' : 'AB'} = [[${fmt(M[0], 0)},${fmt(M[1], 0)}],[${fmt(M[2], 0)},${fmt(M[3], 0)}]]`;
    }

    function play() {
      if (animId) return;
      const first = showBA ? A : B; // applied first (rightmost factor)
      const second = showBA ? B : A; // applied second (leftmost factor)
      const dur = 900;
      const t0 = performance.now();

      function step(now) {
        const t = Math.min(1, (now - t0) / dur);
        draw(LA.lerpMat2(first, easeInOutCubic(t)));
        if (t < 1) {
          animId = requestAnimationFrame(step);
        } else {
          const t1start = now;
          function step2(now2) {
            const t2 = Math.min(1, (now2 - t1start) / dur);
            draw(LA.matMul(LA.lerpMat2(second, easeInOutCubic(t2)), first));
            if (t2 < 1) animId = requestAnimationFrame(step2);
            else { animId = null; render(); }
          }
          animId = requestAnimationFrame(step2);
        }
      }
      animId = requestAnimationFrame(step);
    }

    swapBtn.addEventListener('click', () => { showBA = !showBA; render(); });
    playBtn.addEventListener('click', play);
    render();
    resizers.push(() => { plane._fit(); render(); });
  })();

  // ---------- 10. inverse ----------
  (function initInverse() {
    const plane = initPlane('c-inverse', { xMin: -6, xMax: 6, yMin: -4, yMax: 4 });
    if (!plane) return;
    const dInput = $('#inv-d');
    const dVal = $('#inv-d-val');
    const readout = $('#r-inverse');
    const playBtn = $('#inv-play');
    let animId = null;

    function baseM() {
      return [2, -3, 1, parseFloat(dInput.value)];
    }

    function draw(M) {
      plane.clear();
      drawWarpedGrid(plane, M);
      plane.axes();
      plane.arrow([0, 0], [M[0], M[2]], { color: '#0645ad', label: 'A·î' });
      plane.arrow([0, 0], [M[1], M[3]], { color: '#f97316', label: 'A·ĵ' });
    }

    function updateReadout(M) {
      const det = LA.det2(M);
      readout.textContent = `A = [[2.0, -3.0], [1.0, ${fmt(M[3])}]] · det(A) = ${fmt(det)} · ${Math.abs(det) < 0.05 ? (isEnglish ? 'A⁻¹ does not exist' : 'A⁻¹ 존재하지 않음') : (isEnglish ? 'A⁻¹ exists' : 'A⁻¹ 존재')}`;
    }

    function render() {
      const M = baseM();
      dVal.textContent = fmt(M[3]);
      draw(M);
      updateReadout(M);
    }

    function play() {
      if (animId) return;
      const A = baseM();
      const det = LA.det2(A);
      if (Math.abs(det) < 0.05) {
        readout.textContent = isEnglish ? 'det(A) ≈ 0 → the transformation cannot be inverted.' : 'det(A) ≈ 0 → 격자가 뭉개져서 되돌릴 수 없습니다 (역행렬 없음).';
        return;
      }
      const Ainv = LA.inv2(A);
      const dur = 900;
      const t0 = performance.now();

      function step(now) {
        const t = Math.min(1, (now - t0) / dur);
        const e = easeInOutCubic(t);
        draw(LA.lerpMat2(A, e));
        if (t < 1) {
          animId = requestAnimationFrame(step);
        } else {
          const t1start = now;
          function step2(now2) {
            const t2 = Math.min(1, (now2 - t1start) / dur);
            const e2 = easeInOutCubic(t2);
            const N = LA.lerpMat2(Ainv, e2);
            draw(LA.matMul(N, A));
            if (t2 < 1) {
              animId = requestAnimationFrame(step2);
            } else {
              animId = null;
              dVal.textContent = fmt(A[3]);
              updateReadout(A); // grid stays at identity (animation's final frame); text still describes A
            }
          }
          animId = requestAnimationFrame(step2);
        }
      }
      animId = requestAnimationFrame(step);
    }

    dInput.addEventListener('input', render);
    playBtn.addEventListener('click', play);
    render();
    resizers.push(() => { plane._fit(); render(); });
  })();

  // ---------- 11. eigenvalues & eigenvectors ----------
  (function initEigen() {
    const plane = initPlane('c-eigen', { xMin: -5, xMax: 5, yMin: -3.5, yMax: 3.5 });
    if (!plane) return;
    const A = [2, 1, 1, 2];
    const eig = LA.eig2(A);
    const tInput = $('#eigen-t');
    const tVal = $('#eigen-t-val');
    const playBtn = $('#eigen-play');
    const q = { x: 2.1, y: 0.7 };
    let animId = null;

    const fan = Array.from({ length: 12 }, (_, i) => {
      const ang = (i / 12) * Math.PI * 2;
      return [2 * Math.cos(ang), 2 * Math.sin(ang)];
    });

    function render() {
      const t = parseFloat(tInput.value);
      tVal.textContent = fmt(t);
      const M = LA.lerpMat2(A, t);
      plane.clear();
      plane.grid(1);
      plane.axes();
      if (eig) {
        eig.vectors.forEach((v) => plane.lineThrough([0, 0], v, { color: '#eee', dash: [3, 3] }));
      }
      fan.forEach((v) => {
        const tv = LA.matVec(M, v);
        plane.arrow([0, 0], tv, { color: 'rgba(6,69,173,0.35)', width: 1.4, head: 5 });
      });
      const tq = LA.matVec(M, [q.x, q.y]);
      plane.arrow([0, 0], tq, { color: '#f97316', width: 2.4, label: 'A·q' });
      plane.point([q.x, q.y], { color: '#f97316', r: 5, ring: true, label: isEnglish ? 'q (drag)' : 'q (드래그)' });
      plane.point([0, 0], { color: '#222', r: 2 });
    }

    makeDraggable(plane.canvas, plane, [q], render, { clamp: true });
    tInput.addEventListener('input', render);
    playBtn.addEventListener('click', () => {
      if (animId) return;
      const dur = 1400;
      const t0 = performance.now();
      function step(now) {
        const t = Math.min(1, (now - t0) / dur);
        tInput.value = easeInOutCubic(t);
        render();
        if (t < 1) animId = requestAnimationFrame(step);
        else animId = null;
      }
      animId = requestAnimationFrame(step);
    });

    render();
    resizers.push(() => { plane._fit(); render(); });
  })();

  // ---------- 12. four fundamental subspaces ----------
  (function initSubspaces() {
    const inPlane = initPlane('c-sub-in', { xMin: -4, xMax: 4, yMin: -4, yMax: 4 });
    const outPlane = initPlane('c-sub-out', { xMin: -4, xMax: 4, yMin: -4, yMax: 4 });
    if (!inPlane || !outPlane) return;
    const A = [1, 2, 3, 6];
    const rowDir = LA.normalize([1, 2]);
    const nullDir = LA.normalize([2, -1]);
    const colDir = LA.normalize([1, 3]);
    const leftNullDir = LA.normalize([3, -1]);
    const v = { x: -1, y: 2.6 };
    const readout = $('#r-sub');

    function render() {
      const vv = [v.x, v.y];
      const vRowMag = LA.dot(vv, rowDir);
      const vRow = LA.scale(rowDir, vRowMag);
      const vNull = LA.sub(vv, vRow);

      inPlane.clear();
      inPlane.grid(1);
      inPlane.axes();
      inPlane.lineThrough([0, 0], rowDir, { color: 'rgba(6,69,173,0.3)', dash: [3, 3] });
      inPlane.lineThrough([0, 0], nullDir, { color: 'rgba(249,115,22,0.3)', dash: [3, 3] });
      inPlane.segment(vRow, vv, { color: '#ccc', dash: [3, 3] });
      inPlane.arrow([0, 0], vRow, { color: '#0645ad', label: isEnglish ? 'row component' : 'row 성분' });
      inPlane.arrow([0, 0], vNull, { color: '#f97316', label: isEnglish ? 'null component' : 'null 성분' });
      inPlane.arrow([0, 0], vv, { color: '#222', width: 2.4, label: 'v' });

      const Av = LA.matVec(A, vv);
      outPlane.clear();
      outPlane.grid(1);
      outPlane.axes();
      outPlane.lineThrough([0, 0], colDir, { color: 'rgba(6,69,173,0.3)', dash: [3, 3] });
      outPlane.lineThrough([0, 0], leftNullDir, { color: 'rgba(249,115,22,0.3)', dash: [3, 3] });
      outPlane.arrow([0, 0], Av, { color: '#222', width: 2.4, label: 'Av' });
      outPlane.point([0, 0], { color: '#f97316', r: 4, label: isEnglish ? 'null component→0' : 'null 성분→0' });

      readout.textContent = `v=(${fmt(v.x)},${fmt(v.y)}) → row=(${fmt(vRow[0])},${fmt(vRow[1])}), null=(${fmt(vNull[0])},${fmt(vNull[1])}) → Av=(${fmt(Av[0])},${fmt(Av[1])})`;
    }

    makeDraggable(inPlane.canvas, inPlane, [v], render, { clamp: true });
    render();
    resizers.push(() => { inPlane._fit(); outPlane._fit(); render(); });
  })();

  // ---------- 13b. orthogonality & projection ----------
  (function initProjection() {
    const plane = initPlane('c-projection', { xMin: -1, xMax: 5, yMin: -1, yMax: 5 });
    if (!plane) return;
    const a = { x: 3, y: 1 };
    const b = { x: 1, y: 3 };
    const readout = $('#r-projection');

    function render() {
      const av = [a.x, a.y];
      const bv = [b.x, b.y];
      const aa = LA.dot(av, av);
      const lambda = aa > 1e-9 ? LA.dot(av, bv) / aa : 0;
      const p = LA.scale(av, lambda);
      const e = LA.sub(bv, p);

      plane.clear();
      plane.grid(1);
      plane.lineThrough([0, 0], av, { color: '#eee' });
      plane.axes();

      plane.segment(p, bv, { color: '#999', dash: [4, 4] });
      // small right-angle marker at p
      if (LA.norm(e) > 0.15) {
        const u1 = LA.normalize(av);
        const u2 = LA.normalize(e);
        const s = 0.22;
        const c1 = LA.add(p, LA.scale(u1, -s));
        const c2 = LA.add(c1, LA.scale(u2, s));
        const c3 = LA.add(p, LA.scale(u2, s));
        plane.segment(c1, c2, { color: '#bbb', width: 1 });
        plane.segment(c2, c3, { color: '#bbb', width: 1 });
      }

      plane.arrow([0, 0], av, { color: '#0645ad', label: 'a' });
      plane.arrow([0, 0], bv, { color: '#222', label: 'b' });
      plane.arrow([0, 0], p, { color: '#f97316', width: 3, label: 'p' });

      readout.textContent = `a=(${fmt(a.x)},${fmt(a.y)}), b=(${fmt(b.x)},${fmt(b.y)}) · λ*=${fmt(lambda)} · p=(${fmt(p[0])},${fmt(p[1])}) · e=(${fmt(e[0])},${fmt(e[1])}) · e·a=${fmt(LA.dot(e, av))}`;
    }

    makeDraggable(plane.canvas, plane, [a, b], render, { clamp: true });
    render();
    resizers.push(() => { plane._fit(); render(); });
  })();

  // ---------- 13. invariance vs. variance ----------
  (function initInvariance() {
    const plane = initPlane('c-invariance', { xMin: -5, xMax: 5, yMin: -3.5, yMax: 3.5 });
    if (!plane) return;
    const A = [2, 1, 1, 2];
    const eig = LA.eig2(A);
    const readout = $('#r-invariance');
    const q = { x: 2.1, y: 0.7 };
    const v = { x: 3, y: 1 };
    const b1 = [1, 1];
    const b2 = [-1, 1];
    let mode = 'transform';

    const fan = Array.from({ length: 12 }, (_, i) => {
      const ang = (i / 12) * Math.PI * 2;
      return [2 * Math.cos(ang), 2 * Math.sin(ang)];
    });

    function renderTransform() {
      plane.clear();
      plane.grid(1);
      plane.axes();
      eig.vectors.forEach((vv) => plane.lineThrough([0, 0], vv, { color: '#eee', dash: [3, 3] }));
      fan.forEach((p) => plane.arrow([0, 0], LA.matVec(A, p), { color: 'rgba(6,69,173,0.35)', width: 1.4, head: 5 }));
      const tq = LA.matVec(A, [q.x, q.y]);
      plane.arrow([0, 0], tq, { color: '#f97316', width: 2.4, label: 'A·q' });
      plane.point([q.x, q.y], { color: '#f97316', r: 5, ring: true, label: isEnglish ? 'q (drag)' : 'q (드래그)' });
      const onEigen = eig.vectors.some((vv) => Math.abs(LA.cross2(vv, LA.normalize([q.x, q.y]))) < 0.05);
      readout.textContent = onEigen
        ? (isEnglish ? 'q is close to an eigenvector direction; A·q remains on the same line.' : 'q는 지금 고유벡터 방향에 가깝습니다 — A·q가 q와 같은 직선 위에 있습니다.')
        : (isEnglish ? 'Only the (1,1) and (1,-1) directions are invariant; move q onto a dashed line.' : '(1,1)과 (1,-1) 방향만 A를 적용해도 그대로입니다 — q를 그 점선 위로 옮겨보세요.');
    }

    function renderBasis() {
      plane.clear();
      plane.grid(1);
      plane.axes();
      drawBasisGrid(plane, b1, b2);
      plane.arrow([0, 0], b1, { color: '#0645ad', label: 'b₁' });
      plane.arrow([0, 0], b2, { color: '#0645ad', label: 'b₂' });
      plane.arrow([0, 0], [v.x, v.y], { color: '#222', width: 2.4, label: 'v' });
      const P = [b1[0], b2[0], b1[1], b2[1]];
      const coord = LA.solve2(P, [v.x, v.y]);
      readout.textContent = coord
        ? (isEnglish ? `Same vector v — standard coordinates (${fmt(v.x)}, ${fmt(v.y)}), basis-B coordinates (${fmt(coord[0])}, ${fmt(coord[1])})` : `같은 화살표 v — 표준좌표 (${fmt(v.x)}, ${fmt(v.y)}), 기저 B 좌표 (${fmt(coord[0])}, ${fmt(coord[1])})`)
        : (isEnglish ? 'The basis vectors are not linearly independent.' : '기저가 선형독립이 아닙니다.');
    }

    function render() {
      if (mode === 'transform') renderTransform();
      else renderBasis();
    }

    makeDraggable(plane.canvas, plane, [q, v], render, { clamp: true });

    $$('#invariance .toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('#invariance .toggle').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        mode = btn.dataset.mode;
        render();
      });
    });

    render();
    resizers.push(() => { plane._fit(); render(); });
  })();

  // ---------- 14. change of basis ----------
  (function initBasis() {
    const plane = initPlane('c-basis', { xMin: -5, xMax: 5, yMin: -3.5, yMax: 3.5 });
    if (!plane) return;
    const v = { x: 3, y: 1 };
    const b1 = { x: 1, y: 1 };
    const b2 = { x: -1, y: 1 };
    const readout = $('#r-basis');

    function render() {
      plane.clear();
      plane.grid(1);
      drawBasisGrid(plane, [b1.x, b1.y], [b2.x, b2.y]);
      plane.axes();
      plane.arrow([0, 0], [b1.x, b1.y], { color: '#0645ad', label: 'b₁' });
      plane.arrow([0, 0], [b2.x, b2.y], { color: '#0645ad', label: 'b₂' });
      plane.arrow([0, 0], [v.x, v.y], { color: '#222', width: 2.4, label: 'v' });

      const P = [b1.x, b2.x, b1.y, b2.y];
      const coord = LA.solve2(P, [v.x, v.y]);
      readout.textContent = coord
        ? (isEnglish ? `v (standard coordinates) = (${fmt(v.x)}, ${fmt(v.y)}) · [v]_B = (${fmt(coord[0])}, ${fmt(coord[1])})` : `v (표준좌표) = (${fmt(v.x)}, ${fmt(v.y)}) · [v]_B (새 기저 좌표) = (${fmt(coord[0])}, ${fmt(coord[1])})`)
        : (isEnglish ? 'b₁ and b₂ are dependent and do not form a basis.' : 'b₁, b₂가 선형독립이 아니어서 기저를 이루지 못합니다.');
    }

    makeDraggable(plane.canvas, plane, [v, b1, b2], render, { clamp: true });
    render();
    resizers.push(() => { plane._fit(); render(); });
  })();

  // ---------- 15. pytorch: einsum / permute / view / reshape ----------
  (function initPytorch() {
    const view = $('#einsum-view');
    if (view) {
      const INFO = {
        dot: {
          title: "torch.einsum('i,i->', a, b)",
          desc: isEnglish ? 'Multiply values sharing index i and sum them → dot product.' : '반복되는 인덱스 i를 곱해서 전부 더한다 → 내적(3번 섹션과 동일).',
          example: 'a = [1, 2, 3]\nb = [4, 5, 6]\nresult = 1*4 + 2*5 + 3*6 = 32',
        },
        outer: {
          title: "torch.einsum('i,j->ij', a, b)",
          desc: isEnglish ? 'No contracted index → multiply every pair to form an outer product.' : '공유하는 인덱스가 없다 → 모든 조합을 곱해서 행렬을 만든다 (외적/outer product).',
          example: 'a = [1, 2]\nb = [3, 4]\nresult = [[3, 4],\n          [6, 8]]',
        },
        matmul: {
          title: "torch.einsum('ij,jk->ik', A, B)",
          desc: isEnglish ? 'Contract index j while preserving i and k → matrix multiplication.' : 'j가 반복(축소)되고 i,k가 남는다 → 행렬곱 (5번 선형결합과 동일한 계산).',
          example: 'A = [[1,2],[3,4]]\nB = [[5,6],[7,8]]\nresult = A @ B = [[19,22],\n                  [43,50]]',
        },
        trace: {
          title: "torch.einsum('ii->', A)",
          desc: isEnglish ? 'Repeat i and preserve no output index → trace, equal to the sum of eigenvalues.' : 'i가 두 번 반복되며 아무 축도 남지 않는다 → 대각합(trace) = 고유값들의 합.',
          example: 'A = [[1,2],[3,4]]\ntrace = 1 + 4 = 5  (= λ₁+λ₂)',
        },
        transpose: {
          title: "torch.einsum('ij->ji', A)",
          desc: isEnglish ? 'Reverse the output-index order without contraction → transpose.' : '인덱스 순서만 바꾸고 아무 것도 더하지 않는다 → 전치(transpose).',
          example: 'A = [[1,2,3],\n     [4,5,6]]\nresult = [[1,4],\n          [2,5],\n          [3,6]]',
        },
      };

      function renderEq(key) {
        const info = INFO[key];
        view.textContent = `${info.title}\n${info.desc}\n\n${info.example}`;
      }

      $$('#einsum-presets button').forEach((btn) => {
        btn.addEventListener('click', () => {
          $$('#einsum-presets button').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          renderEq(btn.dataset.eq);
        });
      });
      renderEq('dot');
    }

    const box = $('#tensor-view-box');
    const tReadout = $('#r-tensor');
    const bufferBox = $('#tensor-buffer');
    if (box) {
      const flat = [1, 2, 3, 4, 5, 6];

      function renderGrid(rows, cols, idxFn, stride) {
        box.innerHTML = '';
        const wrap = document.createElement('div');
        const label = document.createElement('div');
        label.className = 'tensor-label';
        label.textContent = `shape (${rows}, ${cols})`;
        const grid = document.createElement('div');
        grid.className = 'tensor-grid';
        grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        for (let i = 0; i < rows; i++) {
          for (let j = 0; j < cols; j++) {
            const idx = idxFn(i, j);
            const cell = document.createElement('div');
            cell.className = 'tensor-cell';
            cell.textContent = flat[idx];
            const sub = document.createElement('span');
            sub.className = 'buf-idx';
            sub.textContent = idx;
            cell.appendChild(sub);
            grid.appendChild(cell);
          }
        }
        wrap.appendChild(label);
        wrap.appendChild(grid);
        box.appendChild(wrap);

        if (bufferBox) {
          bufferBox.innerHTML = '';
          flat.forEach((val) => {
            const c = document.createElement('div');
            c.className = 'buffer-cell';
            c.textContent = val;
            bufferBox.appendChild(c);
          });
        }

        const contiguous = stride[0] === cols && stride[1] === 1;
        tReadout.textContent = `shape = (${rows}, ${cols}) · stride = (${stride[0]}, ${stride[1]}) · contiguous = ${contiguous}`;
      }

      $('#tensor-reset').addEventListener('click', () => renderGrid(2, 3, (i, j) => i * 3 + j, [3, 1]));
      $('#tensor-view').addEventListener('click', () => renderGrid(3, 2, (i, j) => i * 2 + j, [2, 1]));
      $('#tensor-permute').addEventListener('click', () => renderGrid(3, 2, (i, j) => j * 3 + i, [1, 3]));

      renderGrid(2, 3, (i, j) => i * 3 + j, [3, 1]);
    }
  })();
})();
