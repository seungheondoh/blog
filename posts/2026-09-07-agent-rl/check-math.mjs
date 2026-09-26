// Exact enumeration of the small models used in the tutorial; no LLM training.
import assert from 'node:assert/strict';
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, a + ' != ' + b);
const choose = (n, k) => {
  if (n < k) return 0;
  let result = 1;
  for (let j = 1; j <= k; j++) result *= (n - j + 1) / j;
  return result;
};
const p = 0.4, n = 4;
let raw = 0, centered = 0, loo = 0;
for (let bits = 0; bits < 2 ** n; bits++) {
  const actions = Array.from({ length: n }, (_, i) => (bits >> i) & 1);
  const count = actions.reduce((a, b) => a + b, 0);
  const probability = p ** count * (1 - p) ** (n - count);
  const mean = count / n;
  for (const a of actions) {
    const score = a - p; // gradient w.r.t. Bernoulli logit
    raw += probability * a * score / n;
    centered += probability * (a - mean) * score / n;
    loo += probability * (a - (count - a) / (n - 1)) * score / n;
  }
}
close(raw, p * (1 - p));
close(centered, (n - 1) / n * raw);
close(loo, raw);
close(1 - choose(8, 3) / choose(10, 3), 8 / 15);
let expectedPass = 0;
for (let c = 0; c <= 10; c++) {
  expectedPass += choose(10, c) * p ** c * (1-p) ** (10-c)
    * (1 - choose(10-c, 3) / choose(10, 3));
}
close(expectedPass, 1 - (1-p) ** 3);
close(1 - .5 ** 4 - .5 ** 4, .875);
const rewards = [1, 0, 0, 0];
const std = Math.sqrt(rewards.reduce((sum, r) => sum + (r-.25) ** 2, 0) / 4);
close(std, Math.sqrt(3) / 4);
close((1-.25) / std, Math.sqrt(3));
const clip = (ratio, advantage) => Math.min(ratio * advantage, Math.min(1.2, Math.max(.8, ratio)) * advantage);
close(clip(1.3, Math.sqrt(3)), 1.2 * Math.sqrt(3));
close(clip(1.3, -1/Math.sqrt(3)), -1.3/Math.sqrt(3));
close(clip(.7, -1), -.8);
const gamma = .9, phi = [.4, .8, .3, 0], r = [0, 0, 1];
const shaped = r.reduce((sum, reward, t) => sum + gamma ** t * (reward + gamma * phi[t+1] - phi[t]), 0);
const original = r.reduce((sum, reward, t) => sum + gamma ** t * reward, 0);
close(shaped, original - phi[0]);
// Loss-lab: hold advantages fixed while comparing only reduction choices.
const lengths = [2, 4, 4, 6];
const advantages = rewards.map(reward => (reward - .25) / std);
const totalTokens = lengths.reduce((a, b) => a + b, 0);
const weighted = lengths.reduce((sum, length, i) => sum + length * advantages[i], 0);
close(-advantages.reduce((a, b) => a + b, 0) / 4, 0);
close(-weighted / totalTokens, 1 / (2 * Math.sqrt(3)));
close(-weighted / (4 * 6), 1 / (3 * Math.sqrt(3)));
// Zero scalar does not imply zero gradient: change only the successful row's logp.
const responseLoss = delta => -advantages.reduce((sum, adv, i) => sum + clip(Math.exp(i === 0 ? delta : 0), adv), 0) / 4;
const h = 1e-5;
assert.ok(Math.abs((responseLoss(h) - responseLoss(-h)) / (2*h) + Math.sqrt(3)/4) < 1e-8);
// Next-token mask belongs to the target, not the role of the logits position.
const tokenIds = [10, 11, 20, 30, 31, 21];
const generated = [0, 0, 1, 0, 0, 1];
const selectedTargets = tokenIds.slice(1).filter((_, j) => generated[j + 1]);
assert.deepEqual(selectedTargets, [20, 21]);
// Unequal microbatches: average sums with the global denominator, not means equally.
const chunks = [[2, 4], [8]];
close(chunks.reduce((sum, chunk) => sum + chunk.reduce((a, b) => a + b, 0) / 3, 0), 14/3);
assert.notEqual(chunks.reduce((sum, chunk) => sum + chunk.reduce((a, b) => a + b, 0) / chunk.length / 2, 0), 14/3);
console.log('Passed: baseline bias, leave-one-out, GRPO arithmetic, PPO signs, pass@k expectation, shaping, loss reductions, nonzero gradient at zero loss, target shift, microbatch weighting.');
