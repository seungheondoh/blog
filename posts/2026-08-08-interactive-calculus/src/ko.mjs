// Korean locale. `content.html` is authored in Korean, so this file only carries
// the page chrome — there is no copy overlay to apply.
//
// The English overlay is parked in `en.mjs.todo` until the Korean post settles,
// as with the probability and information theory posts; while it is absent the
// build emits ko.html only.
export default {
  lang: 'ko',
  output: 'ko.html',
  // content.html is written in this language, so it is emitted verbatim.
  source: true,
  title: 'Interactive Calculus — Blog',
  // Fills the <h1> and the first index-nav entry.
  heading: 'Interactive Calculus',
  description:
    '함수와 극한, 미분과 연쇄법칙, 테일러 전개와 적분, 그리고 편미분·그래디언트·야코비안·헤시안·벡터장·발산·라플라시안까지 다루는 머신러닝을 위한 미적분.',
};
