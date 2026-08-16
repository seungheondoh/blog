function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// The same byline the post header shows. `readingMinutes` and `author` are
// written into posts.json by build.mjs, so the two never disagree.
function byline(post) {
  const parts = [`Date: <time datetime="${post.date}">${formatDate(post.date)}</time>`];
  if (post.readingMinutes) parts.push(`Estimated Reading Time: ${post.readingMinutes} min`);
  if (post.author) parts.push(`Author: ${post.author}`);
  return parts.join('<span class="post-meta-sep">|</span>');
}

async function loadPosts() {
  const list = document.querySelector('#post-list');
  try {
    const res = await fetch('./posts.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load posts.json (${res.status})`);
    const posts = await res.json();

    posts.sort((a, b) => (a.date < b.date ? 1 : -1));

    if (posts.length === 0) {
      list.innerHTML = '<li class="empty">No posts yet.</li>';
      return;
    }

    list.innerHTML = posts
      .map((post) => `
          <li>
            <time datetime="${post.date}">${formatDate(post.date)}</time>
            <div>
              <a class="post-title" href="${post.url ? post.url : `./post.html?slug=${encodeURIComponent(post.slug)}`}">${post.title}</a>
              ${post.summary ? `<p class="post-summary">${post.summary}</p>` : ''}
            </div>
          </li>
        `)
      .join('');
  } catch (err) {
    list.innerHTML = `<li class="empty">Could not load posts: ${err.message}</li>`;
  }
}

loadPosts();
