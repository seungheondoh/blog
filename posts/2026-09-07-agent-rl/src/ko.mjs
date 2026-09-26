// Korean is the language content.html is authored in, so this module carries the
// page chrome only. en.mjs holds the English overlay that produces index.html,
// the default page this post is linked from; ko.html is the language toggle.
export default {
  lang: 'ko', output: 'ko.html', source: true,
  title: 'Agents and Reinforcement Learning — Blog',
  heading: 'Agents and Reinforcement Learning',
  description: 'Agent의 실행 구조와 강화학습을 정리한 article. POMDP부터 REINFORCE·PPO·GRPO, 토큰 loss, 장기 credit assignment, distillation과 재현 가능한 평가까지 연결한다.',
  // Timed by the author; the generic estimate reads this post as ~110 min.
  readingMinutes: 40,
  updates: [
    { date: '2026-09-09', note: '블로그 시작.' },
  ],
};
