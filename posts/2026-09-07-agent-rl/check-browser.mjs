// Requires a local server on 8765 and Chrome debugging on 9224.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const pages = await (await fetch('http://127.0.0.1:9224/json')).json();
const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map(), errors = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const p = pending.get(message.id);
    pending.delete(message.id);
    message.error ? p.reject(message.error) : p.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
    errors.push(message.params.args.map(a => a.value || a.description));
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:8765/posts/2026-09-07-agent-rl/ko.html' });
  for (let i = 0; i < 100; i++) {
    if (await evaluate('!!document.querySelector("#async-note")?.textContent && !!document.querySelector(".katex")')) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const initial = await evaluate('({sections: document.querySelectorAll("section.topic").length, labs: document.querySelectorAll(".lab").length, math: document.querySelectorAll(".katex").length, mathErrors: document.querySelectorAll(".katex-error").length, badAnchors: [...document.querySelectorAll("a[href^=\\"#\\"]")].filter(a => !document.getElementById(a.hash.slice(1))).length, duplicateIds: [...document.querySelectorAll("[id]")].map(e => e.id).filter((id,i,a) => a.indexOf(id) !== i)})');
  assert.equal(initial.sections, 20);
  assert.equal(initial.labs, 5);
  assert.equal(await evaluate('document.querySelectorAll("figure.listing").length'), 3);
  assert.ok(initial.math > 100);
  assert.equal(initial.mathErrors, 0);
  assert.equal(initial.badAnchors, 0);
  assert.deepEqual(initial.duplicateIds, []);
  const removed = await evaluate('["lab-loop", "lab-effort", "lab-triage", "lab-grpo", "lab-distill", "appendix"].every(id => !document.getElementById(id))');
  assert.ok(removed);
  const titles = await evaluate('[...document.querySelectorAll(".lab h3")].map(el => el.textContent)');
  titles.forEach((title, i) => assert.ok(title.startsWith("그림 " + (i + 1) + "."), title));
  const controls = await evaluate('(()=>{let n=0;for(const el of document.querySelectorAll("input[type=range],select")){const original=el.value;const values=el.tagName==="SELECT"?[...el.options].map(o=>o.value):[el.min,el.max];for(const value of values){el.value=value;el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));n++;}el.value=original;el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));}return {n,badSvg:[...document.querySelectorAll("svg")].filter(s=>!s.children.length||/NaN|Infinity/.test(s.innerHTML)).length};})()');
  assert.equal(controls.badSvg, 0);
  const semantics = await evaluate(`(() => {
    const set = (id, value) => { const e = document.getElementById(id); e.value = value; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); };
    const out = { traceSegments: document.querySelectorAll('#trace-list .seg').length };
    set('ppo-p', 95); set('ppo-a', -1);
    out.ppo = document.getElementById('ppo-epochs').textContent;
    out.ratio = document.getElementById('ppo-note').textContent;
    set('async-mode', 'async'); set('async-tau', 0);
    out.async = document.getElementById('async-note').textContent;
    return out;
  })()`);
  assert.equal(semantics.traceSegments, 12);
  assert.ok(semantics.ppo.includes('-3.065'), semantics.ppo);
  assert.ok(semantics.ratio.includes('ρ=3.06'), semantics.ratio);
  assert.ok(semantics.async.includes('첫 업데이트 시점은 그대로'));
  await send('Page.reload');
  for (let i = 0; i < 100; i++) {
    if (await evaluate('!!document.querySelector("#async-note")?.textContent && !!document.querySelector(".katex")')) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const layouts = [];
  for (const width of [1440, 900, 700, 480, 380]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    const layout = await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');
    assert.ok(layout.scroll <= layout.width, JSON.stringify(layout));
    layouts.push(layout);
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await evaluate('document.getElementById("loss-lab").scrollIntoView({behavior:"instant"})');
  await new Promise(resolve => setTimeout(resolve, 200));
  const lossShot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile('/tmp/agent-rl-loss-review.png', Buffer.from(lossShot.data, 'base64'));
  for (const [selector, filename] of [
    ['#tools .listing', 'algorithm'], ['#reinforce', 'math'],
    ['#lab-tokens', 'figure-1'],
  ]) {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({behavior:'instant',block:'start'})`);
    const shot = await send('Page.captureScreenshot', {format:'png'});
    await writeFile(`/tmp/agent-rl-${filename}-review.png`, Buffer.from(shot.data, 'base64'));
  }
  await send('Page.navigate', {url:'http://127.0.0.1:8765/posts/2026-09-07-agent-rl/index.html'});
  for (let i = 0; i < 100; i++) {
    if (await evaluate('document.documentElement.lang === "en" && !!document.querySelector("#async-note")?.textContent && !!document.querySelector(".katex")')) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(await evaluate('document.querySelectorAll(".katex-error").length'), 0);
  assert.equal(await evaluate('document.querySelectorAll("figure.listing").length'), 3);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ initial, removed, titles, controls, layouts, errors }, null, 2));
} finally {
  ws.close();
}
