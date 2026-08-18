// Korean locale. `content.html` is authored in Korean, so this file only carries
// the page chrome — there is no copy overlay to apply. The English overlay in
// en.mjs supplies the translated copy for index.html, which is the default page
// this post is linked from; ko.html is reachable from the language toggle.
export default {
  lang: 'ko',
  output: 'ko.html',
  // content.html is written in this language, so it is emitted verbatim.
  source: true,
  title: 'Self-Supervised Learning and Collapse — Blog',
  // Fills the <h1> and the first index-nav entry.
  heading: 'Self-Supervised Learning and Collapse',
  description:
    '라벨 없는 데이터에서 학습 문제를 만드는 법부터 representation collapse가 생기는 조건, 관측 단위가 서로 다른 붕괴 유형과 진단법을 살펴본다. SimCLR·BYOL·DINO·VICReg·I-JEPA의 방지 장치를 다섯 가지 설계 패턴으로 비교하고, 전역 표현과 patch 표현의 간극을 짚는다.',
};
