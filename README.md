# blog

Plain HTML/CSS/JS blog. Markdown posts are rendered client-side — no build step, no dependencies.

Hand-written interactive posts that ship in more than one language are the one exception: their pages are generated from a single source by `build.mjs`. It is plain Node with no dependencies, and what it emits is still static HTML. See [Multi-language posts](#multi-language-posts).

## Add a new post

1. Create `posts/YYYY-MM-DD-slug/index.md`. Put any images for that post in the same folder.
2. Add an entry to `posts.json`:
   ```json
   { "slug": "YYYY-MM-DD-slug", "title": "...", "date": "YYYY-MM-DD", "tag": "Study", "summary": "..." }
   ```
   Use `Study` for learning notes and tutorials, `Article` for analytical or
   argument-driven writing, and `Essay` for personal reflections.
3. Commit and push.

The `index.md` body should **not** start with a top-level `# Heading` — the page title comes from `posts.json` and is rendered separately. Start with `##` for in-post subheadings.

## Multi-language posts

A post opts into the build by adding a `src/` folder. `posts/2026-08-16-linear-algebra` is the reference example:

```
posts/<slug>/
  src/content.html   structure + copy, written in the source language
  src/shell.html     page chrome, with {{lang}} {{title}} {{description}}
                     {{seo}} {{content}} placeholders
  src/ko.mjs         the source language — chrome only, `source: true`
  src/en.mjs         a translation overlay: headings, prose, UI strings
  ko.html            GENERATED — do not edit
  index.html         GENERATED — do not edit
```

Build every such post from the blog root:

```
node build.mjs
```

`content.html` is the single source of structure. The source-language page is emitted from it verbatim; every other language is the *same markup* with its copy swapped in, so the pages cannot drift apart structurally. Equations and demo markup are never duplicated per language — a translated section body uses `{{formula}}` to mark where the source's equations land.

The build fails, rather than shipping a half-translated page, when:

- a `<section id>` in `content.html` has no entry in a locale's `topics` (or vice versa),
- a translated body asks for more `{{formula}}` slots than the source provides,
- or a generated non-source page still contains source-language characters.

It also warns about translation entries that no longer match anything, which is how you find stale copy after editing `content.html`.

To edit: change prose in `src/content.html` (source language) or `src/en.mjs` (translation), then rerun `node build.mjs`. Never edit the generated `.html` files — they carry a banner saying so, and the next build overwrites them.

Each generated article shows a collapsed update log below its byline. It starts
with the publication date automatically. To record later changes, add an
`updates` array to a locale module:

```js
updates: [
  { date: 'YYYY-MM-DD', note: 'Published.' },
  { date: 'YYYY-MM-DD', note: 'Expanded the examples.' },
],
```

## Search engines

`node build.mjs` also emits everything a crawler needs, so none of it is
maintained by hand:

- `{{seo}}` in each shell expands to the page's canonical URL, `hreflang` links
  to every language (plus `x-default`), Open Graph / Twitter card tags, and a
  `BlogPosting` JSON-LD record carrying the title, description, date, author and
  reading time.
- The default-language page is canonical at its **directory** (`…/<slug>/`), not
  at `…/<slug>/index.html`, so the two spellings do not compete as duplicates.
- `index.html`'s post list is written into the file as static HTML from
  `posts.json`. `js/home.js` still re-renders it at run time — a `posts.json`
  edit shows up without a build — but a crawler that does not run JavaScript now
  sees the full list.
- `sitemap.xml` is regenerated with a `lastmod` per post and `xhtml:link`
  alternates pairing the language versions.

The sharing card (`og:image`) is the one piece that is **not** part of the build,
because rasterizing text needs a browser and `build.mjs` has to stay runnable
with nothing but node. After adding a post:

```
node og-images.mjs
```

It writes `posts/<slug>/og.png` (and `og.png` at the root) at 1200×630 from
`posts.json`, using Chrome in headless mode. Commit the PNGs. `build.mjs` emits
`og:image` only for posts whose file exists and prints a `note:` for the ones
missing it, so a forgotten run leaves a text-only card rather than one pointing
at a 404.

All absolute URLs come from `SITE` at the top of `build.mjs`; moving the site is
a one-line change there followed by a rebuild.

Two things live outside this repo:

- `seungheondoh.github.io/robots.txt` lists `…/blog/sitemap.xml`. Crawlers read
  robots.txt only from the domain root, so `blog/robots.txt` alone is ignored.
- Submitting the sitemap in Google Search Console is what actually gets the
  posts crawled promptly; the files above only make that possible.

## Local preview

Fetching local `.md`/`.json` files requires an HTTP server (not `file://`):

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Structure

```
index.html            post list
post.html             single post view (?slug=...)
styles.css            site-wide styles (matches seungheondoh.github.io)
posts.json            manifest: slug, title, date, tags, summary
posts/<slug>/         one folder per post — index.md + assets
build.mjs             generates multi-language interactive posts from posts/<slug>/src/

js/markdown.js        tiny markdown -> HTML renderer
js/home.js            renders the post list from posts.json
js/post.js            renders a single post

css/post.css          chrome shared by the interactive maths posts
css/components.css    demo components (heatmap, bar rack, field legend, …)
js/engine.js          LA math helpers, Plane2D, Iso3D, makeDraggable
js/prob-engine.js     RNG, distributions, Chart2D, Heatmap
js/calc-engine.js     numeric calculus, ODE solvers, field drawing on Chart2D
```

## Shared engines

The interactive maths posts (linear algebra → probability → information theory →
calculus → differential equations) share one stack. Each layer only depends on
the ones above it, and a post's shell loads exactly the layers it uses:

| file | provides | depends on |
| --- | --- | --- |
| `js/engine.js` | `LA`, `Plane2D`, `Iso3D`, `makeDraggable` | — |
| `js/prob-engine.js` | `RNG`, `Dist`, `Stat`, `Chart2D`, `Heatmap` | `engine.js` |
| `js/calc-engine.js` | `Calc`, plus `Chart2D.heat/contour/quiver/streamlines` | `prob-engine.js` |

`Plane2D` locks the x and y scales together, which is right for geometry;
`Chart2D` scales them independently, which is right for statistical charts. Both
exist on purpose.

Each post keeps its own `interactive.js` (the per-section wiring) and, where it
genuinely needs one, a small local `style.css`.
