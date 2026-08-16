// Korean locale. `content.html` is authored in Korean, so this file only carries
// the page chrome — there is no copy overlay to apply. The English overlay in
// en.mjs supplies the translated copy for index.html, which is the default page
// this post is linked from; ko.html is reachable from the language toggle.
export default {
  lang: 'ko',
  output: 'ko.html',
  // content.html is written in this language, so it is emitted verbatim.
  source: true,
  title: 'Interactive Probability — Blog',
  // Fills the <h1> and the first index-nav entry.
  heading: 'Interactive Probability',
  description:
    '확률변수, PMF/PDF, 결합·주변·조건부 확률, 기대값과 분산, Bernoulli·Categorical·Gaussian·Laplace·혼합분포, 그리고 MLE·NLL·베이즈·MAP까지 다루는 머신러닝을 위한 확률.',
};
