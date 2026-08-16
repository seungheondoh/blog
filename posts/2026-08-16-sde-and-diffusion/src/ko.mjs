// Korean locale. `content.html` is authored in Korean, so this file only carries
// the page chrome — there is no copy overlay to apply. The English overlay in
// en.mjs supplies the translated copy for index.html, which is the default page
// this post is linked from; ko.html is reachable from the language toggle.
export default {
  lang: 'ko',
  output: 'ko.html',
  // content.html is written in this language, so it is emitted verbatim.
  source: true,
  title: 'Interactive Stochastic Differential Equations — Blog',
  // Fills the <h1> and the first index-nav entry.
  heading: 'Interactive Stochastic Differential Equations',
  description:
    '랜덤워크와 브라운 운동, 확률과정과 마르코프성, 이토 미적분과 SDE, 그리고 Fokker–Planck 방정식과 Probability Flow ODE까지, 확산 모델의 수학에 도달하는 확률미분방정식.',
};
