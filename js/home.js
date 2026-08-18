function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const TAG_CLASSES = { Study: 'study', Article: 'article', Essay: 'essay' };
const FILTERS = new Set(['all', ...Object.values(TAG_CLASSES)]);
let activeFilter = 'all';

function tagMarkup(tag) {
  const className = TAG_CLASSES[tag];
  return className ? `<span class="post-tag post-tag--${className}">${tag}</span>` : '';
}

function applyFilter(filter, updateUrl = false) {
  activeFilter = FILTERS.has(filter) ? filter : 'all';
  const list = document.querySelector('#post-list');
  const items = Array.from(list.querySelectorAll('li[data-tag]'));
  let visible = 0;

  items.forEach((item) => {
    const show = activeFilter === 'all' || item.dataset.tag === activeFilter;
    item.hidden = !show;
    if (show) visible += 1;
  });

  document.querySelectorAll('.post-filter').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === activeFilter));
  });

  const empty = document.querySelector('#filter-empty');
  empty.hidden = visible > 0 || items.length === 0;
  empty.textContent = activeFilter === 'all'
    ? 'No posts yet.'
    : `No ${activeFilter[0].toUpperCase()}${activeFilter.slice(1)} posts yet.`;

  if (updateUrl) {
    const url = new URL(window.location.href);
    if (activeFilter === 'all') url.searchParams.delete('tag');
    else url.searchParams.set('tag', activeFilter);
    history.pushState({ tag: activeFilter }, '', url);
  }
}

function initFilters() {
  document.querySelectorAll('.post-filter').forEach((button) => {
    button.addEventListener('click', () => applyFilter(button.dataset.filter, true));
  });

  const requested = new URLSearchParams(window.location.search).get('tag')?.toLowerCase();
  applyFilter(requested || 'all');
  window.addEventListener('popstate', () => {
    const tag = new URLSearchParams(window.location.search).get('tag')?.toLowerCase();
    applyFilter(tag || 'all');
  });
}

// The same byline the post header shows. `readingMinutes` and `author` are
// written into posts.json by build.mjs, so the two never disagree.
function byline(post) {
  const parts = [`Date: <time datetime="${post.date}">${formatDate(post.date)}</time>`];
  if (post.readingMinutes) parts.push(`Estimated Reading Time: ${post.readingMinutes} min`);
  if (post.author) parts.push(`Author: ${post.author}`);
  return parts.join('<span class="post-meta-sep">|</span>');
}

// build.mjs writes the same list into index.html, so the page is complete before
// this runs. Re-rendering keeps a posts.json-only edit visible without a build;
// a failure leaves the static list in place rather than replacing it with an error.
async function loadPosts() {
  const list = document.querySelector('#post-list');
  const prerendered = !list.querySelector('.empty');
  try {
    const res = await fetch('./posts.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load posts.json (${res.status})`);
    const posts = await res.json();

    // Ties keep posts.json's own order — `localeCompare` answers 0 for two posts
    // sharing a date, where a `<`/`-1` comparator would answer inconsistently.
    posts.sort((a, b) => b.date.localeCompare(a.date));

    if (posts.length === 0) {
      list.innerHTML = '<li class="empty">No posts yet.</li>';
      return;
    }

    list.innerHTML = posts
      .map((post) => `
          <li data-tag="${TAG_CLASSES[post.tag] || ''}">
            <time datetime="${post.date}">${formatDate(post.date)}</time>
            <div>
              <a class="post-title" href="${post.url ? post.url : `./post.html?slug=${encodeURIComponent(post.slug)}`}">${post.title}</a>${tagMarkup(post.tag)}
              ${post.summary ? `<p class="post-summary">${post.summary}</p>` : ''}
            </div>
          </li>
        `)
      .join('');
    applyFilter(activeFilter);
  } catch (err) {
    if (!prerendered) list.innerHTML = `<li class="empty">Could not load posts: ${err.message}</li>`;
  }
}

initFilters();
loadPosts();
