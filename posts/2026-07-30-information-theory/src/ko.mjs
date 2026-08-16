// Korean locale. `content.html` is authored in Korean, so this file only carries
// the page chrome — there is no copy overlay to apply.
//
// The English overlay is deferred until the Korean post settles, exactly as with
// the probability post; while it is absent the build emits ko.html only.
export default {
  lang: 'ko',
  output: 'ko.html',
  // content.html is written in this language, so it is emitted verbatim.
  source: true,
  title: 'Interactive Information Theory — Blog',
  // Fills the <h1> and the first index-nav entry.
  heading: 'Interactive Information Theory',
  description:
    '자기정보와 엔트로피, Cross Entropy와 KL Divergence의 차이와 표본 근사, 상호정보량, 분류 손실과 ELBO까지 다루는 머신러닝을 위한 정보이론.',
};
