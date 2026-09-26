/* Deterministic, educational simulations. No network calls, no LLM inference.
   Figure 1 retains the coding transcript; later figures isolate mathematical concepts. The numbers below are a
   small explicit model of that task, not measurements of any real system. */
(() => {
  'use strict';
  /* Both language pages share this file; the shell sets <html lang>. tx() picks
     the copy for the page being viewed so the figures never drift apart. */
  const isEnglish = document.documentElement.lang === 'en';
  const tx = (en, ko) => (isEnglish ? en : ko);
  const $ = id => document.getElementById(id);
  const val = id => Number($(id).value);
  const fmt = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : '∞');
  const pct = x => `${Math.round(x * 100)}%`;
  const blue = '#316ba5', orange = '#b96d3c', gray = '#9ba2aa', green = '#2f6b4f';
  const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const text = (x, y, s, anchor = 'start', fill = '') =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}"${fill ? ` fill="${fill}"` : ''}>${s}</text>`;
  const line = (x1, y1, x2, y2, color = '#d8dce0', dash = '') =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  const rect = (x, y, w, h, color, extra = '') =>
    `<rect x="${x}" y="${y}" width="${Math.max(0, w)}" height="${Math.max(0, h)}" rx="3" fill="${color}"${extra ? ' ' + extra : ''}/>`;

  /* Every figure is initialised inside its own guard. A figure whose markup is
     missing or whose model throws can no longer take the whole page down with
     it — the bug that silently blanked every figure once already. */
  function figure(name, ids, init) {
    try {
      const missing = ids.filter(id => !$(id));
      if (missing.length) { console.warn(`[fig ${name}] missing: ${missing.join(', ')}`); return; }
      init();
    } catch (error) {
      console.error(`[fig ${name}]`, error);
    }
  }
  function bind(ids, fn) {
    ids.forEach(id => $(id).addEventListener('input', fn));
    ids.forEach(id => $(id).addEventListener('change', fn));
    fn();
  }
  function bars(id, entries, max = 1) {
    $(id).innerHTML = entries.map(([name, n, color], i) =>
      text(12, 38 + i * 51, name) + rect(180, 20 + i * 51, 370 * Math.min(1, n / max), 24, color)
      + text(560, 38 + i * 51, fmt(n))).join('');
  }
  const rng = seed => { let x = seed >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; };

  // Initial buggy code shown in the trajectory; not an interactive execution lab.
  function initialFindMax(nums) {
    let best = 0;
    for (const x of nums) {
      if (x > best) best = x;
    }
    return best;
  }

  /* ------------------------------------------------------------------ Figure 1
     A direct successful path for the same task, written as the token stream the
     trainer actually sees. Token counts are illustrative but fixed, so the
     masked/unmasked ratio is a real arithmetic consequence of the transcript. */
  const TRACE = [
    { role: 'user', kind: 'obs', tok: 46, label: tx('problem', '문제'), body: tx('Return the maximum of a non-empty integer array. Negative numbers are possible. Do not modify the tests.', '비어 있지 않은 정수 배열에서 최댓값을 반환하세요. 음수도 들어올 수 있습니다. 테스트는 수정하지 마세요.') },
    { role: 'model', kind: 'act', tok: 13, label: tx('run tests', '테스트 실행'), body: 'run_tests()' },
    { role: 'tool', kind: 'obs', tok: 44, label: tx('execution result', '실행 결과'), body: tx('findMax([-2, -5, -8]): expected -2, received 0\nthe other two tests pass', 'findMax([-2, -5, -8]): expected -2, received 0\n다른 두 테스트는 통과') },
    { role: 'model', kind: 'act', tok: 12, label: tx('read the code', '코드 확인'), body: 'read_code()' },
    { role: 'tool', kind: 'obs', tok: 26, label: tx('current code', '현재 코드'), body: initialFindMax.toString().replace(/^    /gm, '') },
    { role: 'model', kind: 'act', tok: 41, label: tx('hypothesis + run request', '가설 + 실행 요청'), body: tx('If best is 0 every negative number loses the comparison. Let me trace the actual values.\nrun_case({nums: [-2, -5, -8], trace: true})', 'best가 0이면 음수는 모두 비교에서 탈락한다. 실제 변화를 확인하자.\nrun_case({nums: [-2, -5, -8], trace: true})') },
    { role: 'tool', kind: 'obs', tok: 33, label: tx('variable trace', '변수 변화'), body: tx('start best=0 → x=-2: best=0 → x=-5: best=0 → x=-8: best=0', '시작 best=0 → x=-2: best=0 → x=-5: best=0 → x=-8: best=0') },
    { role: 'model', kind: 'act', tok: 48, label: tx('reason + code edit', '이유 + 코드 수정'), body: tx('The initial candidate must also be a value inside the array. Start from the first element and keep the loop.\nwrite_code({initial_best: "nums[0]"})', '초기 후보도 배열 안의 값이어야 한다. 첫 원소로 시작하고 반복문은 유지한다.\nwrite_code({initial_best: "nums[0]"})') },
    { role: 'tool', kind: 'obs', tok: 8, label: tx('edit result', '수정 결과'), body: tx('Code saved. Not tested yet.', '코드 저장 완료. 아직 테스트하지 않음.') },
    { role: 'model', kind: 'act', tok: 13, label: tx('re-run everything', '전체 재검사'), body: 'run_tests()' },
    { role: 'tool', kind: 'obs', tok: 15, label: tx('execution result', '실행 결과'), body: '3 passed' },
    { role: 'model', kind: 'act', tok: 11, label: tx('finish', '종료'), body: 'finish({status: "all_tests_passed"})' }
  ];

  const ROLE_LABEL = { user: tx('user', '사용자'), model: tx('model', '모델'), tool: tx('tool', '도구') };

  figure('tokens', ['trace-list', 'token-note', 'trace-sum'], () => {
    const total = TRACE.reduce((s, x) => s + x.tok, 0);
    const trained = TRACE.filter(x => x.kind === 'act').reduce((s, x) => s + x.tok, 0);
    $('trace-list').innerHTML = TRACE.map((seg, i) =>
      `<button type="button" class="seg seg-${seg.kind}" data-i="${i}" aria-pressed="false">`
      + `<span class="seg-role">${ROLE_LABEL[seg.role]} · ${seg.label}</span>`
      + `<code>${esc(seg.body.split('\n')[0]).slice(0, 64)}${seg.body.length > 64 ? '…' : ''}</code>`
      + `<span class="seg-tok">${seg.tok} tok · ${seg.kind === 'act' ? 'mask 1' : 'mask 0'}</span></button>`).join('');
    $('trace-sum').textContent = tx(
      `Of ${total} tokens in total, ${trained} (${pct(trained / total)}) are model-generated tokens that become targets of the policy loss. The remaining ${total - trained} are still used as context but excluded from the target.`,
      `전체 ${total} 토큰 중 정책 loss의 target이 되는 모델 생성 토큰은 ${trained} 토큰(${pct(trained / total)})이다. 나머지 ${total - trained} 토큰은 context로는 그대로 쓰이지만 target에서는 제외한다.`);
    $('trace-list').addEventListener('click', event => {
      const button = event.target.closest('button.seg');
      if (!button) return;
      [...$('trace-list').children].forEach(x => {
        x.classList.toggle('selected', x === button);
        x.setAttribute('aria-pressed', String(x === button));
      });
      const seg = TRACE[Number(button.dataset.i)];
      $('token-note').textContent = seg.kind === 'act'
        ? tx(`${seg.label} · ${seg.tok} tokens · mask=1. The model generated these, so they are targets of \\log π_θ and the advantage multiplies them. They also stay in the context of later generations.`,
            `${seg.label} · ${seg.tok} 토큰 · mask=1. 모델이 생성한 토큰이므로 \\log π_θ 의 target이 되고, advantage가 이 토큰들에 곱해진다. 이후 생성의 context에도 남는다.`)
        : tx(`${seg.label} · ${seg.tok} tokens · mask=0. These were inserted by the environment or the user. They stay as context for the next generation but are excluded from the policy loss target. Put a loss here and you teach the model to memorize test output.`,
            `${seg.label} · ${seg.tok} 토큰 · mask=0. 환경이나 사용자가 넣은 토큰이다. 다음 생성의 context로는 그대로 쓰지만 정책 loss의 target에서는 제외한다. 여기에 loss를 걸면 모델에게 테스트 출력을 외우도록 가르치는 셈이 된다.`);
    });
    $('trace-list').firstElementChild.click();
  });

  /* ------------------------------------------------------------------ Figure 2
     A two-action Bernoulli reward model isolates the score-function estimator.
     Reward probabilities are assumptions, not results of executing the code. */
  const P_TRACE = 0.75, P_BLIND = 0.35;   // check the initial value / patch from the example alone (stipulated follow-on success rates)
  figure('reinforce', ['rf-p', 'rf-n', 'rf-b', 'rf-chart', 'rf-note', 'rf-sample'], () => {
    bind(['rf-p', 'rf-n', 'rf-b'], () => {
      const p = val('rf-p') / 100, n = val('rf-n'), mode = $('rf-b').value;
      const rand = rng(417);
      const draw = () => {
        const traceFirst = rand() < p;
        const reward = rand() < (traceFirst ? P_TRACE : P_BLIND) ? 1 : 0;
        return [traceFirst, reward];
      };
      let firstBatch = null;
      const estimates = Array.from({ length: 160 }, () => {
        const batch = Array.from({ length: n }, draw);
        const sum = batch.reduce((s, [, r]) => s + r, 0);
        /* none: b = 0. mean: the batch mean, which includes the sample's own
           reward and is therefore not action-independent. loo: leave-one-out,
           which is independent of the sample it is subtracted from. */
        const bOf = i => mode === 'none' ? 0
          : mode === 'mean' ? sum / n
            : (sum - batch[i][1]) / Math.max(1, n - 1);
        if (!firstBatch) firstBatch = { batch: batch.slice(0, 8), b: bOf(0) };
        return batch.reduce((s, [a, r], i) => s + (r - bOf(i)) * ((a ? 1 : 0) - p), 0) / n;
      });
      const mean = estimates.reduce((a, b) => a + b, 0) / 160;
      const sd = Math.sqrt(estimates.reduce((s, x) => s + (x - mean) ** 2, 0) / 160);
      const exact = (P_TRACE - P_BLIND) * p * (1 - p);
      /* The self-inclusive batch mean is not action-independent, so it shrinks
         the expected estimator by exactly (N-1)/N. See the appendix. */
      const expected = mode === 'mean' ? exact * (n - 1) / n : exact;
      const lo = Math.min(-0.3, ...estimates), hi = Math.max(0.45, ...estimates);
      const X = x => 65 + (x - lo) / (hi - lo) * 530;
      $('rf-chart').innerHTML = line(65, 160, 595, 160)
        + [-0.2, 0, 0.2, 0.4].filter(t => t >= lo && t <= hi).map(x => line(X(x), 155, X(x), 165) + text(X(x), 185, fmt(x, 1), 'middle')).join('')
        + line(X(exact), 20, X(exact), 160, '#333', '4 3') + text(X(exact), 16, tx('exact gradient', '정확한 gradient'), 'middle')
        + (Math.abs(expected - exact) > 1e-6
          ? line(X(expected), 26, X(expected), 160, orange, '2 3') + text(X(expected), 200, tx(`expectation of this estimator ${fmt(expected)}`, `이 추정량의 기대값 ${fmt(expected)}`), 'middle', orange)
          : '')
        + estimates.map((x, i) => `<circle cx="${X(x)}" cy="${38 + (i % 9) * 12}" r="2.6" fill="${blue}" opacity=".55"/>`).join('')
        + text(12, 200, tx('direction that raises the logit of the action A →', '행동 A의 logit을 올리는 방향 →'), 'start', '#777');
      $('rf-sample').innerHTML = firstBatch.batch.map(([a, r], i) =>
        `<div class="mini-row ${r ? 'ok' : 'no'}"><span>episode ${i + 1}</span><code>${a ? tx('action A', '행동 A') : tx('action B', '행동 B')}</code><span>R=${r}</span></div>`).join('')
        + `<div class="mini-foot">${tx('first 8 of the first batch · baseline applied to the first sample', '첫 batch의 앞 8개 · 첫 샘플에 적용된 baseline')} b=${fmt(firstBatch.b, 2)}</div>`;
      const label = {
        none: tx('none', '없음'),
        mean: tx('batch mean (self-inclusive)', 'batch 평균 (자기 포함)'),
        loo: 'leave-one-out',
      }[mode];
      $('rf-note').textContent = tx(
        `π(A)=${fmt(p, 2)} · N=${n} · baseline: ${label} · exact gradient=${fmt(exact)} · expectation of this estimator=${fmt(expected)} · sample mean over 160 repetitions=${fmt(mean)}, standard deviation=${fmt(sd)}. `,
        `π(A)=${fmt(p, 2)} · N=${n} · baseline: ${label} · 정확한 gradient=${fmt(exact)} · 이 추정량의 기대값=${fmt(expected)} · 160회 반복의 표본 평균=${fmt(mean)}, 표준편차=${fmt(sd)}. `)
        + (mode === 'none'
          ? tx('Without a baseline, the expectation still equals the exact gradient. Compare the standard deviations to inspect the spread.',
              'Baseline 없이도 기대값은 정확한 gradient와 같다. 표본의 흩어짐은 위 표준편차로 확인할 수 있다.')
          : mode === 'mean'
            ? tx(`A mean that includes the sample's own reward depends on that sample's action, so the expectation shrinks by exactly (N−1)/N=${fmt((n - 1) / n, 3)}. Negligible for large N, but 12.5% at N=8.`,
                `자기 보상을 포함한 평균은 자기 행동에도 의존하므로 기대값이 정확히 (N−1)/N=${fmt((n - 1) / n, 3)}배로 줄어든다. N이 크면 무시할 만하지만 N=8에서는 12.5%다.`)
            : tx('A mean with the sample\'s own reward removed is independent of that sample\'s action, so it leaves the expectation unchanged ; its variance depends on the policy and baseline quality.',
                '자기 보상을 뺀 평균은 그 샘플의 행동과 독립이므로 기대값을 바꾸지 않는다. 분산은 정책과 baseline의 품질에 따라 달라진다.'));
    });
  });

  /* ------------------------------------------------------------------ Figure 3
     Reweight 24 sampled one-step outcomes. H controls a separate analytic
     product-weight variance calculation, not the displayed sample or ESS. */
  figure('policy', ['is-mu', 'is-pi', 'is-h', 'is-chart', 'is-note', 'is-sample'], () => {
    bind(['is-mu', 'is-pi', 'is-h'], () => {
      const m = val('is-mu') / 100, p = val('is-pi') / 100, h = val('is-h');
      const rand = rng(9021), N = 24;
      const batch = Array.from({ length: N }, () => {
        const traceFirst = rand() < m;
        return [traceFirst, rand() < (traceFirst ? P_TRACE : P_BLIND) ? 1 : 0];
      });
      const w = a => (a ? p / m : (1 - p) / (1 - m));
      const raw = batch.reduce((s, [, r]) => s + r, 0) / N;
      const corrected = batch.reduce((s, [a, r]) => s + w(a) * r, 0) / N;
      const truth = p * P_TRACE + (1 - p) * P_BLIND;
      const sw = batch.reduce((s, [a]) => s + w(a), 0), sw2 = batch.reduce((s, [a]) => s + w(a) ** 2, 0);
      const ess = sw * sw / sw2;
      bars('is-chart', [
        [tx('uncorrected μ batch mean', '보정 없는 μ batch 평균'), raw, gray],
        [tx('importance-corrected mean', 'importance 보정 평균'), corrected, blue],
        [tx('π\'s true success rate', 'π의 실제 성공률'), truth, orange],
      ], Math.max(1, corrected));
      const varH = (p * p / m + (1 - p) ** 2 / (1 - m)) ** h - 1;
      const counts = [0, 0].map((_, k) => batch.filter(([a]) => (k === 1) === a).length);
      $('is-sample').innerHTML =
        `<div class="mini-row"><span>${tx('action A', '행동 A')}</span><code>${tx(`chosen by μ ${counts[1]}/${N} times · weight ${fmt(w(true), 2)}`, `μ가 ${counts[1]}/${N}회 선택 · 가중치 ${fmt(w(true), 2)}`)}</code><span>${fmt(w(true) * counts[1] / N, 2)}</span></div>`
        + `<div class="mini-row"><span>${tx('action B', '행동 B')}</span><code>${tx(`chosen by μ ${counts[0]}/${N} times · weight ${fmt(w(false), 2)}`, `μ가 ${counts[0]}/${N}회 선택 · 가중치 ${fmt(w(false), 2)}`)}</code><span>${fmt(w(false) * counts[0] / N, 2)}</span></div>`
        + `<div class="mini-foot">${tx(`effective sample size ESS=${fmt(ess, 1)} / ${N} · largest weight=${fmt(Math.max(w(true), w(false)), 2)}`, `유효 표본 수 ESS=${fmt(ess, 1)} / ${N} · 최대 가중치=${fmt(Math.max(w(true), w(false)), 2)}`)}</div>`;
      $('is-note').textContent = tx(
        `The ${N} rollouts collected under μ(A)=${fmt(m, 2)} are reused to evaluate the current policy π(A)=${fmt(p, 2)}. The raw sample mean ${fmt(raw, 2)} estimates μ's expected reward. The corrected estimate is ${fmt(corrected, 2)}; π's exact expected reward is ${fmt(truth, 2)}. A particular corrected sample need not be closer to the truth. If H=${h} such independent decisions follow one another, the variance of the total weight is ${varH > 1e5 ? varH.toExponential(2) : fmt(varH)}.`,
        `수집 정책 μ(A)=${fmt(m, 2)}로 모은 ${N}개 rollout을 지금 정책 π(A)=${fmt(p, 2)}의 평가에 재사용한다. 표본 평균 ${fmt(raw, 2)}는 μ의 기대 보상을 추정한다. 중요도 보정 추정값은 ${fmt(corrected, 2)}, π의 정확한 기대 보상은 ${fmt(truth, 2)}다. 보정은 반복 수집의 기대값에 관한 성질이며, 이 표본에서 반드시 더 가까워지는 것은 아니다. 길이 H=${h}인 독립 결정이 이어지면 전체 weight의 분산은 ${varH > 1e5 ? varH.toExponential(2) : fmt(varH)}이다.`);
    });
  });

  /* ------------------------------------------------------------------ Figure 4
     Evaluate both PPO surrogate terms at the current slider setting.
     The chart range follows the full probability ratio; no simulated optimizer. */
  const P_OLD = 0.31;
  figure('ppo', ['ppo-a', 'ppo-e', 'ppo-p', 'ppo-chart', 'ppo-note', 'ppo-epochs'], () => {
    bind(['ppo-a', 'ppo-e', 'ppo-p'], () => {
      const a = val('ppo-a'), e = val('ppo-e') / 100, pNew = val('ppo-p') / 100, r = pNew / P_OLD;
      const objective = x => Math.min(x * a, Math.max(1 - e, Math.min(1 + e, x)) * a);
      const xMax = Math.max(2, r * 1.1);
      const X = x => 50 + x / xMax * 550, Y = y => 125 - y * (95 / xMax);
      let s = line(50, Y(0), 600, Y(0));
      [1 - e, 1, 1 + e].forEach(x => { s += line(X(x), 20, X(x), 225, x === 1 ? '#ddd' : orange, '4 3') + text(X(x), 244, fmt(x, 2), 'middle'); });
      s += line(X(0), Y(0), X(xMax), Y(xMax * a), gray, '5 4');
      s += `<polyline points="${Array.from({ length: 101 }, (_, i) => `${X(i / 100 * xMax)},${Y(objective(i / 100 * xMax))}`).join(' ')}" fill="none" stroke="${blue}" stroke-width="3"/>`;
      s += `<circle cx="${X(r)}" cy="${Y(objective(r))}" r="5" fill="${orange}"/>`
        + text(12, 16, 'surrogate') + text(590, 244, 'ratio ρ');
      $('ppo-chart').innerHTML = s;
      const clippedRatio = Math.max(1 - e, Math.min(1 + e, r));
      const terms = [
        ['ρ × A', r * a],
        ['clip(ρ) × A', clippedRatio * a],
        [tx('minimum: surrogate', '최솟값: surrogate'), objective(r)],
      ];
      $('ppo-epochs').innerHTML = terms.map(([name, value]) =>
        `<div class="mini-row"><span>${name}</span><code>${fmt(value)}</code></div>`).join('');
      const flat = a > 0 ? r > 1 + e : r < 1 - e;
      $('ppo-note').textContent = tx(
        `at collection π_old=${P_OLD} · now π_θ=${fmt(pNew, 2)} → ρ=${fmt(r, 2)} · A=${a}, ε=${fmt(e, 2)} · objective=${fmt(objective(r))}. ${flat ? 'The favorable direction for this sample lies in the flat region, so there is no gain from pushing further.' : 'This sample still has a slope. At the boundary the derivative is discontinuous.'} Parameter updates shared with other samples change this action's probability too.`,
        `수집 시점 π_old=${P_OLD} · 현재 π_θ=${fmt(pNew, 2)} → ρ=${fmt(r, 2)} · A=${a}, ε=${fmt(e, 2)} · objective=${fmt(objective(r))}. ${flat ? '이 샘플의 유리한 방향은 평평한 구간이므로 더 밀어붙일 이득이 없다.' : '이 샘플은 아직 기울기를 갖는다. 경계에서는 미분이 불연속이다.'} 다른 샘플과 공유하는 파라미터 업데이트는 이 행동의 확률도 함께 바꾼다.`);
    });
  });

  /* ------------------------------------------------------------------ Figure 5
     First-batch timing with four workers and one instantaneous update.
     This model does not estimate steady-state training throughput. */
  const WORKERS = [
    { name: tx('rollout 1', 'rollout 1'), t: 2 },
    { name: tx('rollout 2', 'rollout 2'), t: 3 },
    { name: tx('rollout 3', 'rollout 3'), t: 5 },
    { name: tx('rollout 4', 'rollout 4'), t: null }   // slider-controlled
  ];
  figure('async', ['async-mode', 'async-long', 'async-tau', 'async-chart', 'async-note'], () => {
    bind(['async-mode', 'async-long', 'async-tau'], () => {
      const isAsync = $('async-mode').value === 'async', L = val('async-long'), tau = val('async-tau');
      const times = WORKERS.map(w => w.t ?? L);
      const span = Math.max(12, L + 1), X = t => 150 + t / span * 440;
      /* Async model: the learner updates as soon as two rollouts have landed. */
      const sorted = [...times].sort((a, b) => a - b);
      const updateAt = isAsync ? sorted[1] : Math.max(...times);
      let s = '';
      let discarded = 0, maxLag = 0;
      times.forEach((t, i) => {
        const y = 22 + i * 40;
        const lag = isAsync && t > updateAt ? 1 : 0;
        maxLag = Math.max(maxLag, lag);
        const stale = lag > tau;
        if (stale) discarded++;
        s += text(12, y + 18, WORKERS[i].name)
          + rect(150, y, X(t) - 150, 24, stale ? '#d7dade' : blue)
          + (!isAsync ? rect(X(t), y, X(Math.max(...times)) - X(t), 24, '#eceeef') : '')
          + text(X(t) + 5, y + 17,
            tx(`${t} · lag ${lag}${stale ? ' · discarded' : ''}`, `${t} · lag ${lag}${stale ? ' · 폐기' : ''}`),
            'start', stale ? '#999' : '#555');
      });
      s += line(X(updateAt), 10, X(updateAt), 178, orange, '4 3')
        + text(X(updateAt), 196, `learner → v1 @ t=${updateAt}`, 'middle', orange);
      $('async-chart').innerHTML = s;
      const idle = isAsync ? 0 : 4 * Math.max(...times) - times.reduce((a, b) => a + b, 0);
      $('async-note').textContent = isAsync
        ? tx(`The first update starts at t=${updateAt} from the two rollouts that arrived first. Records arriving later were generated under v0 but reach a v1 learner, so the policy lag is at most ${maxLag} version(s). At an allowed lag of τ=${tau}, ${discarded} sample(s) are discarded. At τ=0 the first update still starts early, but late records are discarded. At τ=1 records one version behind are allowed. Update time is simplified to 0.`,
            `먼저 도착한 두 rollout으로 t=${updateAt}에 첫 업데이트를 시작한다. 이후 도착하는 기록은 v0에서 생성됐지만 v1 learner에 도달하므로 정책 지연은 최대 ${maxLag} version이다. 허용 지연 τ=${tau}에서 폐기되는 샘플은 ${discarded}개다. τ=0에서는 늦은 기록을 버려도 첫 업데이트 시점은 그대로다. τ=1에서는 한 버전 늦은 기록도 허용한다. 업데이트 시간은 0으로 단순화했다.`)
        : tx(`It waits for the longest rollout (t=${Math.max(...times)}) and updates once. The total worker waiting time before the first update is ${idle} units. The collecting policy and the learner are both v0 right up to the update, so the policy lag is 0 and no lag management is needed.`,
            `가장 긴 rollout(t=${Math.max(...times)})을 기다린 뒤 한 번에 업데이트한다. 첫 업데이트까지 대기한 worker 시간의 합은 ${idle} 단위다. 수집 정책과 learner는 업데이트 직전까지 모두 v0이므로 정책 지연은 0이고, 지연 관리 항목도 필요 없다.`);
    });
  });

  /* --------------------------------------------------------------- page glue */
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(document.querySelector('main'), {
      delimiters: [{ left: '\\(', right: '\\)', display: false }, { left: '\\[', right: '\\]', display: true }],
      throwOnError: false
    });
  }
  const links = [...document.querySelectorAll('.la-index a')];
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('active', a.hash === `#${e.target.id}`)); });
    }, { rootMargin: '-10% 0px -70% 0px' });
    document.querySelectorAll('section.topic').forEach(s => observer.observe(s));
  }
})();
