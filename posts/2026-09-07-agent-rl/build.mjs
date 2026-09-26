// Build this post with the shared renderer without rebuilding other posts.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const postDir = path.dirname(fileURLToPath(import.meta.url));
const blogDir = path.resolve(postDir, '../..');
const shared = await readFile(path.join(blogDir, 'build.mjs'), 'utf8');
const boundary = "\nconst postsDir = path.join(ROOT, 'posts');";
const rootDeclaration = 'const ROOT = path.dirname(fileURLToPath(import.meta.url));';
if (!shared.includes(boundary) || !shared.includes(rootDeclaration)) {
  throw new Error('Shared renderer changed; update the single-post build adapter.');
}
const renderer = shared.slice(0, shared.indexOf(boundary))
  .replace(rootDeclaration, 'const ROOT = ' + JSON.stringify(blogDir) + ';');
const run = renderer + '\nawait buildPost(' + JSON.stringify(postDir)
  + ', new Map());\nif (problems.length) throw new Error(problems.join("\\n"));\n';
await import('data:text/javascript;base64,' + Buffer.from(run).toString('base64'));
