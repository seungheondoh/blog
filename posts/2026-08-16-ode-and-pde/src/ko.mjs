// Korean locale. `content.html` is authored in Korean, so this file only carries
// the page chrome — there is no copy overlay to apply. The English overlay in
// en.mjs supplies the translated copy for index.html, which is the default page
// this post is linked from; ko.html is reachable from the language toggle.
export default {
  lang: 'ko',
  output: 'ko.html',
  // content.html is written in this language, so it is emitted verbatim.
  source: true,
  title: 'Interactive Differential Equations — Blog',
  // Fills the <h1> and the first index-nav entry.
  heading: 'Interactive Differential Equations',
  description:
    'ODE와 기울기장, 초기값 문제와 위상 초상, 오일러법·룽게–쿠타와 수치 안정성, 그리고 수송·연속·확산 방정식까지 다루는 미분방정식 입문.',
};
