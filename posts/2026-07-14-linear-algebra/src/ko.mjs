// Korean locale. `content.html` is authored in Korean, so this file only carries
// the page chrome — there is no copy overlay to apply.
export default {
  lang: 'ko',
  output: 'ko.html',
  // content.html is written in this language, so it is emitted verbatim.
  source: true,
  title: 'Interactive Linear Algebra — Blog',
  // Fills the <h1> and the first index-nav entry.
  heading: 'Interactive Linear Algebra',
  description:
    '벡터, 내적/외적, 선형변환, 고유값/고유벡터, 4개의 부분공간, 기저 변환, 그리고 PyTorch einsum/permute/view/reshape까지 다루는 선형대수.',
};
