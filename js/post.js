function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

function updateLog(updates, published) {
  const entries = updates?.length ? updates : published
    ? [{ date: published, note: 'Published.' }]
    : [];
  if (!entries.length) return '';
  return `
      <details class="update-log">
        <summary>Update log</summary>
        <ul>${entries.map((update) => `
          <li><time datetime="${update.date}">${formatDate(update.date)}</time><span>${update.note || ''}</span></li>
        `).join('')}</ul>
      </details>`;
}

// Rewrite relative img/a paths so they resolve against the post's own
// folder (posts/<slug>/...) instead of blog/ where post.html lives.
function resolveRelativeUrls(container, baseDir) {
  container.querySelectorAll('img[src], a[href]').forEach((el) => {
    const attr = el.hasAttribute('src') ? 'src' : 'href';
    const val = el.getAttribute(attr);
    if (!val || /^([a-z]+:)?\/\//i.test(val) || val.startsWith('/') || val.startsWith('#') || val.startsWith('mailto:')) {
      return;
    }
    el.setAttribute(attr, baseDir + val.replace(/^\.\//, ''));
  });
}

async function loadPost() {
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');
  const root = document.querySelector('#post-root');

  if (!slug) {
    root.innerHTML = '<p>No post specified.</p>';
    return;
  }

  const baseDir = `./posts/${slug}/`;

  try {
    const [postsRes, mdRes] = await Promise.all([
      fetch('./posts.json', { cache: 'no-cache' }),
      fetch(`${baseDir}index.md`, { cache: 'no-cache' }),
    ]);

    if (!mdRes.ok) throw new Error('Post not found');
    const posts = postsRes.ok ? await postsRes.json() : [];
    const meta = posts.find((p) => p.slug === slug) || {};
    const md = await mdRes.text();

    document.title = meta.title ? `${meta.title} — Blog` : 'Blog';

    root.innerHTML = `
      <h1>${meta.title || slug}</h1>
      <p class="post-meta">
        ${meta.date ? `<time datetime="${meta.date}">${formatDate(meta.date)}</time>` : ''}
      </p>
      ${updateLog(meta.updates, meta.date)}
      <div class="post-content">${renderMarkdown(md)}</div>
    `;

    resolveRelativeUrls(root.querySelector('.post-content'), baseDir);
  } catch (err) {
    root.innerHTML = `<p>Could not load this post: ${err.message}</p>`;
  }
}

loadPost();
