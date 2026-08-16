#!/usr/bin/env node
// Renders the social sharing card (og:image) for the blog home and for every
// post in posts.json. Run it after adding a post:
//
//   node og-images.mjs
//
// Output is posts/<slug>/og.png plus og.png at the blog root, 1200x630, which
// is what Open Graph consumers expect. build.mjs emits the og:image tag only
// for posts whose file exists, and warns about the ones missing it — so a
// forgotten run degrades to a card without an image rather than a broken one.
//
// This is deliberately NOT part of build.mjs: it needs a browser to rasterize
// text, and build.mjs has to stay runnable with nothing but node.

import { readFile, writeFile, unlink, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const run = promisify(execFile);
const ROOT = path.dirname(fileURLToPath(import.meta.url));

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => existsSync(p));

if (!CHROME) {
  console.error('No Chrome/Chromium found — needed to rasterize the cards.');
  console.error('Install one, or add its path to CHROME in og-images.mjs.');
  process.exit(1);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const prettyDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};

// The card mirrors the site: white ground, the same ink and muted greys, and the
// orange of the favicon as the only colour. Sized in px rather than rem because
// it is rasterized at a fixed 1200x630, never viewed responsively.
const card = ({ title, meta, kicker }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1200px; height: 630px; }
  body {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 76px 84px;
    background: #fff;
    color: #222;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    /* The orange edge reads as a brand mark at thumbnail size, where the
       kicker text below is already too small to make out. */
    border-left: 14px solid #f97316;
  }
  .kicker {
    display: flex;
    align-items: center;
    gap: 16px;
    color: #666;
    font-size: 30px;
    letter-spacing: .01em;
  }
  .dot {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #f97316;
  }
  h1 {
    /* Long maths titles run to three lines; 74px keeps the longest one inside
       the card without shrinking the short ones. */
    font-size: 74px;
    font-weight: 600;
    line-height: 1.18;
    letter-spacing: -.015em;
  }
  .meta {
    padding-top: 28px;
    border-top: 1px solid #ddd;
    color: #666;
    font-size: 28px;
    font-variant-numeric: tabular-nums;
  }
</style>
</head>
<body>
  <p class="kicker"><span class="dot"></span>${escapeHtml(kicker)}</p>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${escapeHtml(meta)}</p>
</body>
</html>
`;

async function shoot(html, out) {
  const dir = await mkdtemp(path.join(tmpdir(), 'og-'));
  const page = path.join(dir, 'card.html');
  await writeFile(page, html);
  await run(CHROME, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1200,630',
    `--screenshot=${out}`,
    pathToFileURL(page).href,
  ]);
  await unlink(page).catch(() => {});
  console.log(`  ${path.relative(ROOT, out)}`);
}

const manifest = JSON.parse(await readFile(path.join(ROOT, 'posts.json'), 'utf8'));

await shoot(card({
  kicker: 'seungheondoh.github.io',
  title: 'Blog — Seungheon Doh',
  meta: 'Notes on music, machine learning, and research',
}), path.join(ROOT, 'og.png'));

for (const post of manifest) {
  const meta = [prettyDate(post.date), post.readingMinutes && `${post.readingMinutes} min read`]
    .filter(Boolean).join('  ·  ');
  await shoot(card({ kicker: 'Blog · Seungheon Doh', title: post.title, meta }),
    path.join(ROOT, 'posts', post.slug, 'og.png'));
}

console.log(`\n${manifest.length + 1} cards written.`);
