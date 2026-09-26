# 편집 기준 (2026-09-11)

- 사용자가 지정한 분류: **Agents and Reinforcement Learning은 Article**이다. Study로 분류하지 않는다.
- 사용자가 유지하도록 지정한 그림: **그림 1. 성공한 episode를 학습 단위로 자르면**. 실행 기록·토큰·mask 상호작용을 유지한다.
- 수식 설명의 참고 방향: [What are Diffusion Models?](https://lilianweng.github.io/posts/2021-07-11-diffusion-models/). 정의 → 유도 → 항의 의미 → 손계산 → 그림으로 연결한다.
- Python 의사코드는 representation-collapse의 논문 Algorithm 스타일(위아래 선, caption, 절제된 문법 강조)을 따른다.
- 정의부터 읽는 구성을 유지한다. 참고 방향은 Lilian Weng의 [Harness Engineering for Self-Improvement](https://lilianweng.github.io/posts/2026-07-04-harness/): 개념 정의, 방법의 관계, 관련 연구와 한계를 연결하는 article.
- 최댓값 코드의 별도 해설과 본문 반복 참조는 제거한다. 그림 1의 실행 기록 안에서만 독립적인 예시로 유지한다. 모든 확률 모형에 코드 이야기를 붙이지 않는다.
- 그림은 하나의 개념을 설명한다. 가정한 확률과 실제 실행 결과, 보상 출처와 gradient 적용 위치를 구별한다.
- 2026-09-11: 한국어 본문의 유도와 데이터 규모를 보강했다. 영어판은 공유 그림과 Algorithm 표시를 동기화했으며, 한국어에 추가한 설명 전체의 재번역은 별도 작업이다.
- 아래 기록은 이전 개정 이력이다. 현재 그림 1은 사용자가 유지하도록 지정한 성공 episode의 토큰·mask 기록, 그림 2·3은 두 행동 확률 모형, 그림 4는 clipping 계산, 그림 5는 그룹 보상, 그림 6은 학습 신호, 그림 7은 첫 batch의 정책 지연을 다룬다.

# Agent와 RL — 자료조사

## 현재 개정판 (2026-09-08)

최신 UI 정리: 용어표와 LLM–policy 정의를 첫 본문 절로 이동했다. 인용 표기는 저자·연도 중심이며 주장에 필요한 절·수식·표 번호를 유지한다. 실행 loop, 합성 effort 곡선, 규칙 기반 실패 triage 인터랙티브는 삭제했다. 남은 그림은 7개이며 1–7로 재번호를 부여했다. 아래 열 개 그림과 786개 실행 검사는 삭제 전 이력이다. 현재 브라우저 검사는 21개 절·7개 그림·43개 컨트롤 설정과 5개 화면 폭을 확인한다.

최신 개정은 용어와 구현 사이의 연결에 집중했다. Environment·state·observation·context, episode·rollout·trajectory, group·batch·minibatch·microbatch·optimizer step을 최댓값 문제의 실행 기록으로 구별한다. Loss 절은 수집 버퍼, 다음 토큰 정렬, tensor shape, target mask, stop-gradient, reduction과 분산·누적 평균의 차이까지 설명한다. 코드 블록은 명시된 가정 아래의 교육용 핵심 계산이며 완전한 학습기나 학습 실험 결과가 아니다.

현재 인용 원칙은 **주장별로 읽을 절·수식·표와 인용 목적을 연결하는 한국어 해설**이다. 반복되는 독립 요약 블록을 본문 논증으로 통합했다. DeepSeekMath 식 (3)·§4.1.2, PPO 식 (7)·Algorithm 1, DAPO §3.3 식 (12), Dr. GRPO §3.1–3.2, Search-R1 §3.1의 masking, GLM-5 §4.1.2의 TITO를 서로 다른 구현 선택에 연결한다. 특히 DAPO의 그룹 내 토큰 평균과 다중 문제 batch의 전역 토큰 평균을 구분한다.

본문 원본은 `src/content.html`(한국어)이고, 생성 페이지는 **영어 `index.html`과 한국어 `ko.html`** 두 개다. 영어는 `src/en.mjs`의 번역 overlay가 같은 구조 위에 덮어써서 만들며, 두 페이지가 구조적으로 어긋날 수 없다. 수식과 그림 마크업은 언어마다 복제하지 않고 `{{formula}}` 자리로만 표시한다. `interactive.js`는 두 페이지가 공유하며 `document.documentElement.lang`을 보는 `tx(en, ko)`로 문구를 고른다.

이 디렉터리에서 `node build.mjs`를 실행하면 공통 렌더러로 이 글만 빌드한다. 블로그 루트의 전체 빌드와 달리 다른 글이나 목록을 수정하지 않는다. `index.html`과 `ko.html` 직접 편집은 피한다.

이번 개정에서는 history와 압축 context, Q-learning 적용 가능성, 실패 보상과 음의 advantage, clipping과 KL, 길이 비용의 해석을 정정했다. 토큰 loss 손계산·reduction 비교, 장기 credit assignment, potential shaping, RLHF/RLVR/DPO의 위치, pass@k·불확실성·반증 가능한 실험 설계를 추가했다. 영어 직접인용 블록 44개는 출처를 유지한 한국어 요약으로 바꾸었다. 아래의 직접인용 원칙과 과거 심사 기록은 이전 버전의 이력이며 현재의 집필 규칙이 아니다.

검증: `node check-math.mjs`는 본문의 작은 확률 모형을 완전 열거하여 baseline 편향과 leave-one-out, pass@k 기대값, PPO 부호, GRPO 계산, shaping의 소거를 확인한다. `node check-browser.mjs`는 localhost:8765의 블로그와 디버깅 포트 9224의 Chrome을 사용해 수식·앵커·컨트롤·화면 너비를 검사한다. 실제 LLM 학습이나 성능 실험은 수행하지 않았다.

조사일: 2026-09-07. 단계: 한국어 HTML 초안, 인터랙티브 그림, 3라운드 심사 반영, 영어판(`src/en.mjs`) 추가 완료. `src/content.html`이 본문 원본이며 `index.html`(영어)과 `ko.html`(한국어)은 `node build.mjs`가 생성한다. **생성 파일을 직접 고치지 말고, `src/`를 고친 뒤 반드시 재빌드한다.** 재빌드를 빠뜨리면 `interactive.js`가 존재하지 않는 요소를 참조해 그림 전체가 죽는다(실제로 발생했다). `outline.ko.md`와 `review.md`는 집필 설계 및 검토 이력이다.

## 그림의 원칙

현재 본문과 열 개 그림의 교육용 시나리오는 **비어 있지 않은 정수 배열의 최댓값 찾기**다. 입력 길이 1~100, 원소 −1000~1000을 가정한다.

- v0: best를 0으로 초기화한다. [-2, -5, -8]에서 0을 반환해 실패한다.
- v1: 첫 원소를 그대로 반환한다. 음수 예제는 맞지만 [1, 3, 2]에서 1을 반환해 회귀한다. 예제 하나에 맞추는 오류를 보여 주려고 일부러 만든 수정이다.
- v2: best를 nums[0]으로 초기화하고 반복문을 유지한다. 세 예제를 통과하며 본문에서 불변식으로 정당성을 설명한다.

그림 1은 표시한 함수 자체를 실행한다. 이전의 결제 할인·번역 예시는 제거했다. 그림 2는 같은 문제를 바로 올바르게 수정하는 별도의 경로이며, 그림 3·4의 후속 성공 확률은 교육용 가정이다. 실제 LLM 측정치가 아니다. 786개 입력의 정답 함수 검사, 초기 실패·회귀·최종 통과·workflow의 검사 생략을 브라우저에서 확인한다.

## 과거 인용 형식 (최신 원칙은 위 참조)

본문의 모든 인용은 원문 직접인용이며 36건이다. 각 인용 바로 앞에 **「~에 따르면」 또는 「~는 …라고 적는다」 형태의 귀속 문장**을 두고, 논문은 괄호로 저자·연도를 붙인다(예: `Dr. GRPO 논문(Liu et al., 2025) §3.1은 …`). 연속된 인용의 두 번째부터는 「같은 abstract는」·「같은 절은」으로 출처를 이어 준다. 인용 블록 자체는 영어 원문 + 한국어 번역(이 글에서 제공) + 절 단위 출처의 형식을 쓴다. Qwen3의 distillation은 §3.3이 아니라 §4.5(단계), §4.7 Table 21(GPU 시간), §4.3(thinking budget)이다.

## 조사 범위와 결론

원 논문과 OpenAI, Anthropic, Google/Gemini, Moonshot/Kimi, Z.ai/GLM, Qwen, DeepSeek의 공식 자료를 선별했다. 검색 과정에서 나온 개인 블로그·요약 사이트·커뮤니티 글은 근거에서 제외했다. 논문 전체의 재현성 검증이나 모든 최신 발표의 전수 조사는 아니다. 아래에서는 원리 설명에 필요한 논문과 실제 학습 설계를 공개한 자료를 우선한다.

이 글의 작업 정의: LLM 기반 에이전트는 주어진 목표와 제약 안에서 모델이 행동과 도구 사용을 선택하고, 실행 결과를 관측해 다음 선택을 조정하며, 완료 또는 중단까지 실행을 이어 가는 시스템이다. [OpenAI 가이드](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/), [Anthropic 가이드](https://www.anthropic.com/engineering/building-effective-agents), [Google Cloud의 핵심 개념](https://cloud.google.com/resources/core-concepts-ai-agents)의 공통 요소를 종합했다. 공동으로 승인된 단일 정의라고 주장하지 않으며, 더 넓은 RL의 agent 개념과 이 글의 LLM 범위를 구분한다. RL은 정책을 결과에 따라 개선하는 방법이지 Agent의 필요조건이 아니다.

실무 방향에 관한 종합 판단: 검증 가능한 과제와 실행 환경, 초기 정책의 기본 능력, rollout 기록의 정확성, 보상과 평가의 분리, 정책 지연 관리가 함께 필요하다. 이를 만족하지 않은 채 PPO를 GRPO로 교체하는 것만으로 문제가 해결되지는 않는다. 이는 아래 자료의 종합 해석이지 단일 논문의 정리나 모든 환경에서의 우열 증명이 아니다.

## 1. 개념과 알고리즘의 핵심 논문

| 우선순위 | 원문 | 글에서 담당할 역할 | 읽을 부분 / 주의점 |
| --- | --- | --- | --- |
| 필수 | Williams (1992), [Simple statistical gradient-following algorithms for connectionist reinforcement learning](https://link.springer.com/article/10.1007/BF00992696) | REINFORCE, 확률적인 행동과 기대 보상의 gradient | log-derivative 직관과 baseline. 현대 장기 trajectory 표기는 글에서 별도로 유도한다. |
| 필수 | Schulman et al. (2017), [Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347) | 수집 정책과 업데이트 정책, clipped surrogate | §2–5. Clipping은 모든 확률 변화나 KL을 강제로 제한하는 보장이 아니다. |
| 필수 보조 | Schulman et al. (2015/ICLR 2016), [High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) | value, advantage, bias–variance | TD residual에서 GAE로 이어지는 부록. PPO와 GAE는 같은 알고리즘이 아니다. |
| 필수 | Shao et al. (2024), [DeepSeekMath](https://arxiv.org/html/2402.03300v3) | GRPO의 원 출처 | §4.1. 그룹 보상으로 baseline을 추정하고 별도 value model을 생략한다. 원형에는 KL 항과 normalization이 있다. |
| 필수 | Yao et al. (ICLR 2023), [ReAct](https://arxiv.org/abs/2210.03629) | reasoning–action–observation 연결 | Agent의 작동 구조를 설명한다. ReAct를 RL 알고리즘이라고 부르지 않는다. |
| 필수 연결 | Jin et al. (2025), [Search-R1](https://arxiv.org/html/2503.09516v1) | PPO/GRPO를 실제 환경 상호작용에 연결 | §3과 §5. 검색 결과는 context에 쓰되 정책 loss에서 mask한다. 검색 QA 실험을 모든 Agent에 일반화하지 않는다. |
| 배경 | Ouyang et al. (NeurIPS 2022), [Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) | SFT–reward model–PPO, RLHF의 위치 | RLHF의 보상 출처와 Agentic RL의 상호작용 구조는 서로 다른 분류축이다. |
| 배경 | DeepSeek-AI (2025), [DeepSeek-R1](https://arxiv.org/abs/2501.12948) | reasoning RL의 의미와 cold start | 단일 응답 reasoning의 성공이 곧 multi-turn tool-use 학습의 증명은 아니다. |
| 심화 | Espeholt et al. (ICML 2018), [IMPALA](https://arxiv.org/abs/1802.01561) | actor–learner 분리와 policy lag, V-trace | 비동기 RL의 오래된 핵심 문제를 연결한다. 현행 모든 LLM 학습이 V-trace를 쓴다는 뜻은 아니다. |
| 심화 | Liu et al. (2025), [Understanding R1-Zero-Like Training: A Critical Perspective](https://arxiv.org/html/2503.20783v1) | Dr. GRPO, 길이·문제별 normalization의 영향 | §3. 정규화는 표기상의 사소한 차이가 아니라 sample weighting을 바꾼다. |

REINFORCE → PPO → GRPO는 교육적 전개 순서다. 뒤에 나온 방법이 앞의 방법을 모든 조건에서 대체한다는 역사나 성능 순위로 쓰지 않는다.

### Agent 이해 파트 보강: ReAct, self-critique, reflection

- [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629), Yao et al., ICLR 2023: reasoning trace와 task action을 interleave하여 관측에 따라 계획을 갱신한다. Reasoning·acting·observation 관계의 중심 원문이다. 특정 benchmark의 성능을 일반적인 Agent 성능 보장으로 확대하지 않는다.
- [Self-Refine: Iterative Refinement with Self-Feedback](https://arxiv.org/abs/2303.17651), Madaan et al., NeurIPS 2023: 초기 출력, feedback, refinement를 반복하는 대표 사례. 추론 시 self-feedback으로 결과를 수정하는 것과 추가 weight 학습을 구분한다.
- [Reflexion: Language Agents with Verbal Reinforcement Learning](https://arxiv.org/abs/2303.11366), Shinn et al., NeurIPS 2023: task feedback을 언어적 reflection으로 바꾸어 episodic memory에 저장하고 다음 시도에 활용한다. 원문은 weight update 대신 언어 피드백을 쓰는 점을 명시한다. 본문의 REINFORCE/PPO와 동일한 학습 절차로 소개하지 않는다.

집필 원칙: reasoning·self-critique는 기능, tool calling은 행동 interface, observation은 환경에서 받은 정보, ReAct는 이들을 연결하는 패턴으로 설명한다. 모든 Agent가 별도 planner·critic·memory 모듈을 갖춰야 한다는 분류는 피한다. 생성된 자기평가와 외부 검증을 구분하고, 언어적 self-critic과 RL value critic도 별개로 설명한다. 실행 시 context/memory 적응, distillation 데이터 수집, RL weight update의 연결은 저자의 교육적 종합이다.

## 2. 지정 조직의 공식 자료

### OpenAI

- [Introducing deep research](https://openai.com/index/introducing-deep-research/) (2025-02): “How it works”에서 browsing/reasoning 과제의 end-to-end RL과 다단계 탐색·되돌아가기를 설명한다. Agent trajectory를 직접 학습하는 산업 사례로 사용한다.
- [Introducing Codex](https://openai.com/index/introducing-codex/) (2025-05): 실제 코딩 과제와 환경에서 RL을 적용하고 테스트를 반복하는 학습을 설명한다. 글의 coding 예제를 뒷받침한다.
- 이 발표들로부터 최신 비공개 모델의 정확한 PPO/GRPO variant, reward mixture, rollout schedule을 추정하지 않는다. InstructGPT의 PPO를 오늘의 모든 OpenAI 모델에 대입하지 않는다.

### Anthropic

- [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (2024-12): workflow의 사전 정의된 제어 흐름과 agent의 동적 제어를 구분한다. 이는 실무적 정의이며 유일한 학술적 정의로 제시하지 않는다.
- [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) (2025-09): context, memory, compaction을 Agent 시스템의 설계 변수로 연결한다.
- [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) (2026-01): transcript와 실제 outcome, model과 harness, grader 유형 및 반복 시행을 구분한다. RL 보상과 별도의 평가를 설계하는 근거다.
- 위 자료는 시스템 설계·평가의 근거다. Claude의 비공개 RL optimizer를 설명하는 자료로 사용하지 않는다.

### Google / Gemini

- [Build with Gemini Deep Research](https://blog.google/innovation-and-ai/technology/developers-tools/deep-research-agent-gemini-api/) (2025-12): 검색을 위한 multi-step RL을 명시한다. 검색 Agent의 산업 사례로 사용하되 구체적 objective는 이 글만으로 확인할 수 없다.
- 코딩 중심의 주 예제 옆에 검색 사례를 배치해 Agentic RL을 코드 실행에만 한정하지 않는다.

### Moonshot / Kimi

- [Kimi K2: Open Agentic Intelligence](https://www.kimi.ai/blog/kimi-k2) (2025-07): “Agentic Capabilities”에서 도구·환경·사용자 시뮬레이션을 통한 데이터 합성과 general RL을 설명한다. verifiable reward와 rubric 기반 judge를 구분하는 자료다.

### Z.ai / GLM

- [GLM-5 technical report](https://arxiv.org/html/2602.15763v1) (2026-02), §3.3, §3.6, §4.1–4.2: 비동기 rollout과 학습의 분리, 주기적 weight 동기화, 생성 당시 token ID/log-probability 보존, policy version 기반 stale sample 처리를 다룬다.
- 환경에서 돌아온 토큰을 정책 loss에서 제외하며, 환경 자체의 고장과 모델의 실패를 구별한다. On/off-policy의 현실적인 의미를 설명하는 핵심 사례다.
- §4.1의 그룹 중심 보상 식은 그 자체로 완전한 정책 gradient 식이 아니다. 교육용 objective는 원 논문에서 다시 유도하고, §4.1.2의 masking을 PPO clipping과 동일시하지 않는다.
- [공식 저장소](https://github.com/zai-org/GLM-5)에서 보고서 출처를 교차 확인했다.

### Qwen

- [Qwen3-Coder: Agentic Coding in the World](https://qwenlm.github.io/blog/qwen3-coder/) (2025-07): long-horizon Agent RL과 실행 환경의 확장을 설명한다.
- [Qwen3-Coder-Next technical report](https://arxiv.org/html/2603.00729v1) (2026-03), §2 및 §4.2.4: 실행 가능한 과제 합성, 초기 학습과 RL, 최종 성공 보상과 추가 penalty, 정답 commit 접근 등 reward hacking 사례를 다룬다.
- 교육적으로 중요한 점: 실패한 시도는 유용할 수 있으나, 틀린 테스트·불가능한 환경·정답 누출은 정책 개선의 근거를 손상시킨다. 특정 penalty나 SFT/RL 분할 방식을 보편 법칙으로 만들지 않는다.

### DeepSeek

- [DeepSeek-V3.2 technical report](https://arxiv.org/html/2512.02556v1) (2025-12), §3.1–3.2: GRPO 확장, off-policy negative sequence masking, sampling 및 MoE routing의 일관성, thinking과 tool use의 결합, agentic task synthesis를 연결한다.
- minibatch 재사용과 training/inference 구현 차이 둘 다 off-policyness를 만든다고 명시한다. “PPO/GRPO는 on-policy인데 왜 off-policy 보정이 등장하는가”의 직접적인 근거다.
- 이번 구성의 기술적 중심은 학습 안정화 항목을 직접 확인한 V3.2다. 모델의 최신성보다 설명하려는 학습 절차의 공개 수준을 기준으로 선정했다.

## 3. 집필에서 반드시 구분할 개념

아래는 원문들을 바탕으로 정리한 교육적 정의 및 수학적 해설 원칙이다.

1. **Agent와 학습법**: 관측–행동 loop가 Agent를 규정한다. RL은 가능한 학습법이다. 고정 pretrained 모델과 prompting으로도 Agent를 구성할 수 있다.
2. **Model과 system**: 정책 외에 tool interface, 실행 환경, context 구성, 상태 저장, 종료 조건을 다룬다. 별도 planner, 장기 memory, 다중 Agent는 필수 구성요소가 아니다.
3. **추론 중 적응과 parameter 학습**: 새 tool 결과가 context를 바꾸는 것과 optimizer가 weight를 바꾸는 것을 다른 loop로 표시한다.
4. **관측과 상태**: 실제 환경 상태 s_t를 모델이 전부 보는 것은 아니다. 정책은 history 또는 구성된 context h_t에 조건화한다. context를 곧 완전한 Markov state라고 가정하지 않는다.
5. **Token과 환경 행동**: tool call 하나는 여러 토큰으로 구성될 수 있다. 생성 토큰의 log probability 합과 tool-level action probability의 관계를 제시한다.
6. **Observation과 reward**: 실패 로그는 다음 행동을 위한 관측이며 자동으로 scalar reward가 되지는 않는다. reward는 별도 정의한다.
7. **On-policy와 off-policy**: 데이터 생성 행동 정책 μ와 평가·개선 대상 정책 π의 관계다. 데이터가 최근이라는 말이나 사람이 썼다는 말만으로 분류하지 않는다.
8. **Online과 offline**: 학습 과정에서 환경 데이터를 새로 수집하는가의 축이다. Online off-policy RL도 가능하다. 고정 문제 목록에서 매번 새 trajectory를 생성하면 offline RL과 다르다.
9. **네 정책의 역할**: πθ는 현재 learner, πold는 수집 시점 snapshot, μ는 실제 behavior/sampling distribution, πref는 정규화 기준이다. 단순 동기 예제에서는 μ=πold로 시작하고 뒤에서 차이를 설명한다.
10. **PPO clipping**: surrogate의 유리한 방향 증가를 제한한다. parameter 변화·각 확률비·실제 KL의 hard bound나 단조 성능 향상을 보장하지 않는다.
11. **GRPO의 이득과 비용**: value model이 없어도 그룹 rollout 비용이 있다. terminal reward를 모든 생성 토큰에 나눠 적용하는 것은 세밀한 causal credit assignment를 해결하지 않는다.
12. **Zero-variance group**: 보상이 모두 같으면 centered reward의 정책 신호가 0이다. KL 등 별도 항까지 모두 0이라는 뜻은 아니다.
13. **Reward와 correctness**: verifier는 선택한 조건을 측정한다. hidden tests도 완전한 correctness 증명이 아니다. judge와 process reward도 오차를 갖는다.

## 4. Best practice를 제시할 방식

“현재 최고의 알고리즘”이라는 하나의 순위 대신 아래 의사결정 순서를 제안한다. 이는 공개 자료를 종합한 저자의 실험 시작점이다.

| 먼저 확인할 조건 | 권장 시작점 | 근거 / 한계 |
| --- | --- | --- |
| 도구 호출과 기본 성공이 가능한가 | pretrained/instruct baseline → 필요하면 SFT·성공 trajectory 학습 | ReAct, Kimi, Qwen. Cold start는 실무 선택이며 모든 RL의 필요조건은 아니다. |
| 보상과 환경을 신뢰할 수 있는가 | 실행 가능한 task, 검증기, 격리된 평가셋부터 구성 | Anthropic evals, Qwen, GLM. 데이터 분할은 task/repository 누출까지 고려한다. |
| 초기 실험에서 버그 원인을 좁힐 수 있는가 | 동기식 또는 지연이 제한된 수집부터 시작 | 구현 복잡도를 관리하기 위한 제안. 비동기보다 항상 빠르거나 우수하다는 주장 아님. |
| 같은 과제를 여러 번 실행할 비용이 있는가 | 그룹 기반 방법을 baseline으로 비교 | GRPO는 critic 비용을 줄이지만 multi-turn 그룹 수집은 비싸다. |
| 긴 과제에서 value 추정이 유용한가 | PPO+value/GAE와 동일 예산에서 비교 | critic 품질과 편향을 측정한다. 긴 과제라는 이유만으로 PPO 우세를 단정하지 않는다. |
| 비동기 처리량이 필요한가 | 실제 rollout log-prob, token ID, policy version, staleness 기록 | GLM/DeepSeek. 보정·필터링 임계값은 실험 대상이다. |
| 학습 보상만 상승하는가 | held-out 성공률, 회귀, 비용, reward exploit 함께 점검 | Qwen과 Anthropic. reward 상승만으로 능력 개선을 결론 내리지 않는다. |

필수 관측 지표 후보: held-out 성공률, 반복 시행 분산, token/tool 비용, timeout과 인프라 실패율, entropy, KL, ratio 분포, 유효 그룹 비율, clipping/masking 비율, rollout policy lag. 전부를 독자에게 설정 숙제로 주지 않고 실패 현상과 연결한다.

상황 의존적 기법으로 분리할 것: KL 제거, 비대칭 clipping, reward std normalization 제거, dynamic sampling, 길이 penalty, process reward, stale trajectory 제거. 보편 권장값이나 검증되지 않은 하이퍼파라미터는 제시하지 않는다.

## 5. 추가 조사: Distillation, reasoning effort, tool calling

### Distillation을 학습 파이프라인의 중심에 두기

- Agarwal et al., [On-Policy Distillation of Language Models: Learning from Self-Generated Mistakes](https://arxiv.org/abs/2306.13649) (ICLR 2024, GKD): 학생이 만든 sequence의 prefix에서 교사 분포를 이용하는 학습을 설명한다. 교사의 정답 sequence만 따라가는 학습과 학생이 실제로 방문하는 prefix 사이의 분포 차이를 다루는 핵심 논문으로 추가한다. 원 실험은 일반 언어 과제이며 multi-turn Agent 전체의 보장을 제공하지 않는다.
- [Qwen3 Technical Report](https://arxiv.org/html/2505.09388v1), §3.3과 distillation ablation: 교사 출력 기반 off-policy 단계 이후 학생 생성 sequence의 logits를 교사와 맞추는 on-policy 단계를 설명한다. 약 1/10 GPU 시간의 비교 결과는 특정 8B 모델과 math/code 실험의 결과이며 모든 Agent 학습으로 일반화하지 않는다. Thinking-mode fusion과 thinking budget도 같은 보고서에서 연결한다.
- [Qwen3-Coder-Next](https://arxiv.org/html/2603.00729v1), §4.2.5: RL 등을 통해 특화된 전문가들의 능력을 한 deployment 모델로 distill한다. 큰 교사→작은 학생만 distillation인 것은 아니다.
- [GLM-5](https://arxiv.org/html/2602.15763v1), §3.5: 앞선 학습 단계의 checkpoint를 교사로 삼아 능력을 회복하는 on-policy cross-stage distillation. teacher/student log-prob 차이가 신호가 되어 해당 단계에서는 group size 1도 사용한다. 이것을 일반적인 outcome-GRPO의 group size 1로 설명하면 안 된다.

구분할 세 경로:

| 경로 | 누가 trajectory를 생성하는가 | 학생이 받는 신호 | 실무 조건 |
| --- | --- | --- | --- |
| 교사 trajectory → SFT | 교사 | 관측된 교사 행동의 likelihood | 교사 결과를 실제 환경에서 검증하고 tool schema와 context 형식을 맞춘다. API 텍스트만으로도 구성 가능하다. |
| On-policy distillation | 학생 | 학생 prefix에 대한 교사의 분포·점수 | dense token KL에는 적절한 logits 접근과 vocabulary 정렬이 필요하다. scalar judge만 있으면 같은 목적함수가 아니다. |
| 환경 보상 RL | 학생/rollout policy | 과제 성공·실패 또는 별도 평가 보상 | verifier와 exploration이 필요하다. Distillation과 병행하거나 전후로 배치할 수 있다. |

교사의 비공개 내부 reasoning이 API에서 모두 제공된다고 가정하지 않는다. 반환된 설명/요약을 내부 사고 trace와 동일시하지 않는다. 관측 가능한 tool call, 결과, 최종 산출물 및 사용 가능한 분포 신호를 기준으로 데이터 경로를 설명한다.

On-policy라는 말은 trajectory의 출처를 말하며 반드시 환경 보상 RL을 뜻하지 않는다. 교사가 생성한 성공 기록에 SFT를 적용하는 것은 학생 기준 off-policy 데이터 학습이지만, 이를 importance-corrected off-policy RL과 동일시하지 않는다.

### Reasoning effort와 계산 예산

- [OpenAI reasoning guide](https://developers.openai.com/api/docs/guides/reasoning): effort는 사고량을 유도하는 모델 의존적 제어다. 고정 token 수나 출력 verbosity와 일치하지 않는다.
- [Anthropic effort](https://platform.claude.com/docs/en/build-with-claude/effort): 사고뿐 아니라 응답 및 tool call에도 영향을 미친다. thinking mode와 effort는 별도 제어다.
- [Gemini thinking](https://ai.google.dev/gemini-api/docs/thinking): 모델별 thinking 제어를 확인하는 공식 문서. 다른 회사의 low/high를 같은 계산량으로 환산하지 않는다.

글의 종합 해석: 내부 reasoning token 예산, 외부 tool/turn 예산, 여러 후보를 만드는 병렬 sampling 예산을 분리한다. Test-time compute를 늘리는 것과 RL로 weight를 업데이트하는 것도 다르다. 동일 effort 라벨보다 성공률–지연–비용 곡선으로 비교한다. 비용을 reward에 넣는 예시는 교육용 설계이며 특정 업체의 실제 reward 식으로 소개하지 않는다.

### Tool calling의 구조와 학습

- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling): 도구 제공 → 모델 호출 생성 → application 실행 → tool output 반환 → 추가 호출/최종 응답의 loop. 구조화된 인자와 실제 실행을 구분한다.
- [Anthropic advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use): 도구 검색으로 필요한 명세를 찾는 방식, 코드에서 여러 도구를 조합하는 programmatic calling, 사용 예제의 역할을 설명한다.
- 기본 구조화 function call, 텍스트/코드 기반 action, programmatic orchestration을 비교하되 배타적인 학습법 분류로 만들지 않는다. MCP는 연결 interface이며 독립적인 reasoning/RL 알고리즘이 아니다.
- valid JSON/schema 준수, 정확한 인자, 적절한 도구 선택, 호출 시점, 실패 복구, 종료는 서로 다른 능력이다. 학습 및 평가에서도 나눈다.

## 6. 다음 단계

한국어 본문과 9개 교육용 그림을 localhost에서 검토한다. `node build.mjs`로 생성하며 현재 한국어 locale의 출력은 `index.html`이다. 공개 manifest에는 아직 등록하지 않았고 외부로 배포하지 않았다. 번역 시 한국어 출력·언어 링크를 기존 다국어 게시글 구조에 맞춰 조정한다.

## 7. 기존 게시글과의 포맷 정합성

기준 폴더: `posts/2026-08-17-representation-collapse/`, `posts/2026-08-16-ode-and-pde/`. 참고문헌 선별 내역은 기존 글처럼 [review.md](review.md)에 기록한다.

현재 파일은 집필 준비 자료다. 본문 단계의 파일 구조는 아래 규칙을 사용한다.

| 파일 | 역할 |
| --- | --- |
| `src/content.html` | 한국어 본문·수식·데모 markup의 단일 원본 |
| `src/shell.html` | 기존 페이지 shell과 공통 CSS·KaTeX 로딩 |
| `src/ko.mjs` | 한국어 제목·설명·페이지 메타데이터 |
| `interactive.js` | 이 글의 데모 로직; 필요한 공통 engine만 사용 |
| `style.css` | 공통 스타일로 표현되지 않는 이 글 전용 조정 |
| `ko.html` | 빌드 생성 파일; 직접 편집하지 않음 |
| `src/en.mjs`, `index.html` | 한국어 확정 후 번역 단계에서 추가 |

본문은 `la-hero` 도입, `la-layout`/`la-index` 목차, `section.topic`으로 구성한다. 절은 한국어 제목과 `span.en` 영문명, `topic-lead`, `topic-body`와 `topic-text`를 사용한다. 직관 문단은 `interp`, 핵심 정의는 `definition`, 독립 수식은 `formula`, 짧은 주의는 `hint`를 따른다. 수식 delimiter는 inline `\(…\)`, block `\[…\]`로 통일한다. 표는 기존 `cmp` 계열을 재사용한다.

참고문헌은 마지막 `section#refs`에 주제별 `h3` + `ul.refs`로 묶는다. 각 항목은 **저자/기관. (연도). 논문·문서 제목. 확인된 학회/저널 또는 Technical report. 이 글에서 뒷받침하는 내용 한 문장** 순서로 쓴다. ArXiv 등록 연도와 학회 연도가 다르면 구분하고 미확인 학회는 적지 않는다. 본문에서는 관련 주장 바로 옆에 원문 링크를 둔다. 기술보고서의 자체 평가를 독립 재현 결과로 표현하지 않는다.
