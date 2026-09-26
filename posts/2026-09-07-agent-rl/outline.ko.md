# 구성 검토안 — 에이전트는 어떻게 경험에서 배우는가

상태: 사용자 검토 대기. 한국어 원고 작성 전 설계안.

가제: **에이전트와 강화학습**

영문명: **Agents and Reinforcement Learning**. 도입에서 LLM의 도구 사용부터 REINFORCE·PPO·GRPO, distillation까지의 범위를 설명한다.

독자: 확률·미분·신경망 학습의 기초를 아는 대학 2학년. 수학적 생략은 가정을 밝혀 처리하고, 연구자가 읽어도 개념적 오류가 없는 수준을 목표로 한다.

분량 제안: 한국어 55–70분의 긴 튜토리얼 한 편. 본문 3개 부분, 13개 절과 선택형 수식 부록. 주 예제는 “실패한 테스트를 고치는 coding agent”, 전이 예제는 검색 Agent. Distillation, reasoning effort, tool calling에 관한 추가 요청을 반영했다. 아래 분량과 그림은 아직 제안이다.

기존 게시물의 한국어 source, 절별 직관·정의·수식·demo 구성과 공유 figure 스타일을 따른다. 출처는 주장 가까이에 붙이고, 실제 연구 결과와 브라우저의 교육용 toy simulation을 명확히 구분한다.

포맷 기준은 representation-collapse와 ode-and-pde 게시글이다. 아래 Part 구분은 설계 문서용이며 실제 페이지에는 기존 글의 연속된 topic 목차를 사용한다. 각 절은 한국어 제목 + 영문명, 한 문장 요지, 연결된 설명 문단, 필요한 정의·수식·데모 순으로 작성한다. 이 문서의 집필 지시 bullet을 그대로 본문으로 옮기지 않는다. 공통 class·파일 구조·참고문헌 표기는 [README의 포맷 규칙](README.md#7-기존-게시글과의-포맷-정합성), 자료 선별 결과는 [review.md](review.md)를 따른다.

## Part I. 무엇을 에이전트라고 부르는가

### 1. 에이전트란 무엇인가

- 시작 상황: 모델이 수정안을 출력했지만 테스트는 여전히 실패한다. 다음에는 무엇을 해야 할까?
- LLM 호출, 정해진 workflow, 환경에 따라 행동 순서를 바꾸는 Agent를 같은 문제로 비교한다.
- 최소 정의: 목표에 맞춰 관측을 받고, 행동을 선택하며, 결과를 다음 결정에 반영하는 시스템.
- 구성: 정책, 관측/context, 행동 interface와 도구 실행, loop 제어와 종료. 환경은 시스템이 상호작용하는 대상이며 학습 시 reset과 평가가 필요하다.
- planner/memory는 기능 또는 구현 선택이다. 별도 모듈이나 다중 Agent를 필수로 나열하지 않는다.
- 출처: ReAct; Anthropic Building effective agents / evals.

이 절에서 요소의 역할을 먼저 지도처럼 정리한다. 모든 항목을 별도 필수 모듈로 제시하지 않는다. Reasoning과 self-critique는 기능이고, tool calling은 행동 interface이며, ReAct는 기능들을 연결하는 패턴이다.

| 개념 | 역할 | Coding agent의 예 |
| --- | --- | --- |
| Goal / task | 무엇을 완료해야 하는지 정한다 | 기존 동작을 유지하면서 빈 입력 처리 오류 수정 |
| Observation | 환경에서 얻은 정보로 다음 결정을 조건화한다 | 파일 내용, 테스트 실패 로그, 실행 오류 |
| Reasoning / planning | 관측을 해석하고 가설·다음 행동·계획을 만든다 | 입력 경계 조건을 확인하고 관련 함수를 읽기로 결정 |
| Action / act | 시스템이 선택해 실행하는 행동이다 | 파일 읽기·수정, 테스트 실행, 사용자에게 질문, 종료 |
| Tool calling | 도구 이름과 인자를 표현해 실행기에 전달한다 | `run_tests({"path":"tests/test_parser.py"})` |
| Self-critique / reflection | 자신의 결과·접근을 점검하고 수정 방향을 만든다 | 실패 로그에 비춰 수정안이 빈 문자열을 놓쳤는지 검토 |
| Context / memory | 다음 결정이나 시도에 필요한 정보를 보존한다 | 이미 시도한 수정, 관찰한 예외, 실패에서 얻은 메모 |
| Control / termination | 반복·재시도·중단·완료를 제어한다 | 검증 완료 후 종료하거나 실행 예산 초과로 중단 |

읽기·검색처럼 외부 상태를 직접 수정하지 않는 정보 수집도 action이다. Observation은 환경의 완전한 상태나 항상 옳은 사실과 같지 않으며, tool 오류·불완전한 검색 결과도 포함한다. Reasoning은 단순히 긴 설명을 출력하는 것과 다르며 명시적 사고 텍스트를 노출하는 것이 Agent의 필요조건은 아니다.

Figure 1 — **같은 문제, 다른 제어 흐름**: LLM/workflow/agent를 전환하고 테스트 결과를 성공·실패로 바꾼다. 다음 행동을 누가 결정하는지와 실제 파일 상태가 바뀌는 지점을 강조한다.

### 2. LLM과 도구 사용

- LLM을 history/context에서 다음 생성 행동을 선택하는 확률 정책으로 본다.
- 실제 환경 상태와 모델이 보는 관측을 나눈다. 관측 누락과 context 압축을 짧게 연결한다.
- tool call 문자열을 생성하는 것과 runtime이 호출을 실행하는 것을 구별한다.
- 수식은 먼저 a_t ~ πθ(· | h_t) 하나만 보여준다.
- 출처: ReAct; Anthropic context engineering.

이 절의 tool-calling 소절은 충분한 비중으로 작성한다.

- `run_tests`의 이름·설명·인자 schema를 모델에 제공하고, 모델이 호출 객체를 생성하고, runtime이 실행한 뒤 call ID와 결과를 다음 context에 넣는 짧은 의사코드.
- structured function calling, 텍스트 action/코드 실행, programmatic tool orchestration의 차이. MCP는 도구 연결 규약으로 짧게 위치만 잡는다.
- 순차 호출과 독립 호출의 병렬 실행을 나눈다. 코드 수정과 그 결과 테스트처럼 의존하는 행동은 순서를 보존한다.
- 도구 명세 검색, 인자 검증, 오류 결과, 재시도·종료가 정책이 마주하는 관측과 행동 공간을 바꾼다는 점.
- SFT/distillation은 호출 형식·예시를 전달하고 RL은 결과를 통해 선택·시점·복구를 개선할 수 있다는 연결을 예고한다. 두 학습법의 역할이 배타적인 것은 아니다.
- 출처 추가: OpenAI function calling; Anthropic advanced tool use.

Figure 1 확장 — 호출 객체와 실제 실행을 나란히 펼치는 모드. 인자가 schema에 맞더라도 잘못된 파일을 선택할 수 있는 사례로 syntax와 task success를 구분한다.

#### 2.1 추론과 행동: ReAct

- Reasoning만 이어 가면 환경에 대한 잘못된 가정을 확인하지 못할 수 있다. 행동만 나열하면 새 결과에 맞춰 계획을 바꾸기 어려울 수 있다. 이 문제에서 interleaving의 동기를 시작한다.
- 교육용 loop: 관측/context → reasoning·계획 → action 선택 → tool 호출·실행 → 새 observation → 계획 갱신 또는 종료.
- 같은 예제로 `관련 파일 읽기 → 가설 → 수정 → 테스트 실패 관측 → 가설 수정 → 재실행`을 따라간다. 교육용 가설 문장은 예시이며 비공개 모델의 내부 reasoning을 복원한 기록이 아니다.
- 원래 ReAct의 Thought–Action–Observation 표현과 실제 구조화된 tool-call 메시지를 나란히 보여준다. 오늘의 모든 Agent가 그 문자열 형식을 사용하거나 매 action마다 사고 텍스트를 생성하는 것은 아니다.
- ReAct는 reasoning과 acting을 엮는 패턴이다. REINFORCE·PPO·GRPO는 그 행동 정책을 학습하는 방법이며 서로 다른 층위다.
- 출처: [ReAct](https://arxiv.org/abs/2210.03629).

#### 2.2 자기평가와 수정

- `초안 → 비평 → 수정`으로 현재 결과를 개선하는 self-refinement를 설명한다. 비평을 같은 모델이 만들 수도 있고 별도 모델·검증기의 피드백을 사용할 수도 있으며, 후자를 전부 self-critique라고 부르지는 않는다.
- 실패한 시도에서 교훈을 추출해 memory에 저장하고 다음 시도에 활용하는 reflection을 구분한다. 현재 결과의 수정과 시도 간 경험 보존의 차이를 보여준다.
- 모델의 “이제 맞다”는 판단과 실제 테스트 통과를 비교한다. Self-critique는 추가 신호이며 correctness 보장이 아니다. 잘못된 비평으로 맞는 답을 바꾸는 경우도 데모에 포함한다.
- Self-Refine의 반복 피드백과 Reflexion의 episodic memory를 대표 사례로 소개한다. 둘을 모든 구현의 배타적 분류로 쓰지 않는다.
- Reflexion의 제목에 있는 verbal reinforcement learning은 언어 피드백·메모리를 이용하며 weight update를 요구하지 않는다. 이후의 policy-gradient RL과 구분한다.
- self-critique를 만드는 언어 모델, 성공 여부를 판단하는 verifier/reward model, PPO에서 기대 return을 추정하는 value critic은 역할과 출력이 다르다.
- 출처: [Self-Refine](https://arxiv.org/abs/2303.17651), [Reflexion](https://arxiv.org/abs/2303.11366).

Figure 1의 agent 모드 확장 — **실패 후 무엇이 바뀌는가**: reasoning·action·observation을 단계별로 진행하고 self-critique/memory를 켜거나 끈다. 각 단계에서 context·환경 상태·memory·모델 weight 중 무엇이 바뀌는지 표시한다. 이 실행 데모에서는 weight는 고정된다. 기능을 켰다는 이유만으로 자동으로 성공률이 오르는 연출은 피한다.

### 3. 에이전트를 학습하는 이유

- Agent 구축에 RL이 필수라는 전제를 바로잡는다.
- prompting은 실행 지침, SFT는 행동 예시의 확률을 높이는 학습, RL은 결과로 행동 정책을 개선하는 학습으로 비교한다.
- 정답 행동열을 쓰기 어렵지만 완료 여부를 평가할 수 있는 과제에서 RL의 동기를 설명한다.
- 자기 행동이 이후 관측을 바꾸는 문제, 실패 후 복구, 멀리 있는 성공 보상, 여러 유효한 해결 경로를 다룬다.
- 추론 중 context가 바뀌는 loop와 학습 중 weight가 바뀌는 loop를 시각적으로 분리한다.
- 앞 절의 self-critique가 한 시도를 고치는 데 어떻게 도움이 되는지 보여준 뒤, 여러 시도의 결과를 weight에 반영하는 RL과 연결한다. critique나 reflection 기록도 검증 후 distillation/SFT 데이터가 될 수 있지만 저장만으로 parameter 학습이 일어나지는 않는다.
- 출처: OpenAI Codex/deep research; Gemini Deep Research; Qwen.

## Part II. 경험을 gradient로 바꾸는 방법

### 4. 행동의 기록과 보상

- observation, action, reward, episode, trajectory, return을 coding 예제의 실제 항목에 대응한다.
- “테스트 실패 로그”와 “학습 보상 -1”은 같은 데이터가 아님을 명시한다.
- 목표 J(θ)=E_{τ~πθ}[R(τ)]를 정의한다. 먼저 유한 horizon, γ=1, terminal reward로 단순화한다.
- 환경의 비미분 가능성: 테스트 실행을 미분하는 대신 선택 확률을 미분한다.

Figure 2 — **Trajectory 해부하기**: 생성 메시지·tool 결과·최종 검증 결과를 클릭한다. 어떤 토큰이 context에 들어가고 어느 위치에 policy loss가 적용되는지 보여준다. 환경 토큰 mask는 attention에서 지운다는 뜻이 아님을 강조한다.

### 5. 정책 경사와 REINFORCE

- 기대 보상 → trajectory 확률 → log-derivative → 행동별 log probability 합을 작은 단계로 전개한다.
- 기본식:

  ∇J(θ) = E[R(τ) Σ_t ∇log πθ(a_t | h_t)].

- 환경 전이는 θ에 직접 의존하지 않는다는 가정을 밝힌다. continuation return을 쓰는 확장은 부록으로 연결한다.
- “보상이 양수면 무조건 좋다”에서 “이 상황의 평소 기대보다 좋다”로 이동해 baseline과 advantage를 소개한다.
- baseline의 action 독립 조건, 분산 감소와 추정 편향을 구분한다.
- 출처: Williams; GAE.

Figure 3 — **확률을 움직이는 경험**: 읽기/수정/테스트 행동을 갖는 작은 결정 트리에서 여러 episode를 수집하고 한 번 업데이트한다. baseline과 sample 수를 바꾸며 gradient의 평균과 흔들림을 비교한다. LLM 학습을 실행하는 데모가 아닌 toy policy임을 명시한다.

### 6. On-policy와 off-policy

- 행동 정책 μ와 대상 정책 πθ를 먼저 분리한다.
- 예: 예전 정책이 테스트를 실행할 확률 0.2, 현재 정책이 0.6이면 해당 행동의 비율은 3이다.
- 단일 행동/고정 context의 importance sampling 항등식을 먼저 보인다. 이를 장기 trajectory 전체에 그대로 적용하면 확률비의 곱과 높은 분산이 생긴다.
- on/off-policy와 online/offline의 두 축을 표로 설명한다. 오래된 문제 목록에서도 새 rollout을 만들 수 있다.
- πθ, πold, μ, πref를 용도별로 나누고, πref는 수집 정책이 아니라 정규화 기준이라는 점을 강조한다.
- 출처: PPO; IMPALA; DeepSeek-V3.2; GLM-5.

Figure 4 — **누가 만든 데이터인가**: behavior/target 분포를 독립적으로 조정한다. 보정 전·후 기대값과 sample variance를 보여준다. horizon을 늘리면 trajectory weight가 얼마나 불안정해지는지 확인한다. μ=0인 행동을 target이 요구하면 support 문제가 있음을 표시한다.

### 7. 정책의 변화를 제한하기: PPO

- 새 rollout 수집 → old policy 고정 → 몇 번의 update → 재수집을 보여준다.
- REINFORCE에 probability ratio와 clipping이 왜 붙는지 연결한다.
- 핵심식:

  Lclip(θ)=E[min(ρ_t Â_t, clip(ρ_t,1−ε,1+ε) Â_t)],
  ρ_t=πθ(a_t|h_t)/πold(a_t|h_t).

- advantage 부호에 따라 clipping의 유효 방향이 달라진다. unclipped 항과 clipped 항을 모두 그린다.
- value model과 GAE가 advantage를 추정하는 역할을 설명한다. value loss와 선택적인 KL·entropy 항을 policy objective와 구분한다.
- PPO는 통상 on-policy 계열이지만 batch 재사용 중 정책 불일치가 발생한다. importance ratio가 있다고 임의의 오래된 replay를 안전하게 재사용하는 것은 아니다.
- 출처: PPO 원문; GAE.

Figure 5 — **PPO clipping을 손으로 움직이기**: Â의 부호·크기, ε, ratio를 조정한다. 실제 선택된 min 곡선과 gradient가 0이 되는 방향을 표시한다. hard probability bound로 보이는 애니메이션은 만들지 않는다.

### 8. 여러 시도의 보상을 비교하기: GRPO

- 같은 초기 과제에서 G개 trajectory를 얻어 결과를 비교한다.
- 핵심식:

  Â_i=(R_i−mean(R_1,…,R_G))/(std(R_1,…,R_G)+εnum).

- PPO 계열의 surrogate에 group advantage를 넣는 구조로 연결한다. εnum은 clipping ε와 다르다.
- 별도 value model을 줄이는 이득과 그룹 rollout 비용, 모두 성공/실패한 그룹, terminal credit의 거친 배분을 함께 설명한다.
- reward 모델과 value 모델을 혼동하지 않는다. GRPO가 critic-free라는 말은 reward evaluator가 없다는 말이 아니다.
- Dr. GRPO는 “normalization이 sample weighting을 바꾼다”는 짧은 심화 박스의 근거로만 사용한다. 별도 알고리즘 소개 절을 추가하지 않는다.
- 출처: DeepSeekMath; Dr. GRPO.

Figure 6 — **그룹이 학습 신호를 만드는 순간**: 성공·실패 보상을 직접 바꾸면 advantage 막대가 바뀐다. 모두 같은 보상에서는 정책 신호가 사라진다. 선택적으로 trajectory 길이와 normalization을 바꿔 기여도 변화를 비교한다.

## Part III. 실제 Agent System을 학습시키기

### 9. 교사 모델로부터 배우기: Distillation

- 첫 경로: 강한 교사로 trajectory 수집 → 실제 결과 검증·필터 → 학생의 assistant/action 토큰에 SFT. 최종 답만 복사하는 것과 도구 사용 과정까지 학습하는 것을 비교한다.
- 직관 수식: L_SFT=−E_{τ~teacher}[Σ_{k∈생성 토큰} log πstudent(y_k|h_k)]. 이는 관측된 교사 행동을 따라가는 학습이다.
- 문제: 교사가 성공적으로 방문한 history와 학생이 실수하며 방문하는 history는 다르다. Multi-turn에서 차이가 누적된다.
- 둘째 경로: 학생 rollout → 학생 prefix에서 교사 평가 → 분포를 맞추는 on-policy distillation. GKD를 개념의 중심 원문으로 쓴다.
- 직관 식: E_{h~d_student}[D(πteacher(·|h), πstudent(·|h))]. D와 gradient 처리에 따라 알고리즘이 달라지므로 하나의 유일한 OPD loss로 제시하지 않는다. sampled prefix를 고정해 계산하는 local loss와 전체 occupancy 미분을 구별한다.
- dense logits 접근이 가능한 경우와 텍스트 응답만 받는 API 교사를 구분한다. tokenizer가 다르면 token-wise KL을 그대로 계산할 수 없다. 교사 judge의 scalar reward는 distribution distillation과 다른 신호다.
- 셋째 경로: 분야별 RL expert → 하나의 학생/배포 모델. Distillation은 RL 전의 초기화에도, 후의 통합·압축·능력 회복에도 들어간다.
- 출처: GKD; Qwen3 §3.3; Qwen3-Coder-Next §4.2.5; GLM-5 §3.5; DeepSeek-R1.

Figure 8 — **교사가 갔던 길, 학생이 실제로 가는 길**: teacher-generated/student-generated rollout을 전환한다. 학생이 실수해 새 상태로 분기할 때 어느 위치에서 교사의 supervision을 받는지 보여준다. 교사의 신호도 그 상태에서 틀릴 수 있음을 표시한다.

### 10. 여러 턴의 상호작용 학습

- task sampling → 환경 reset → rollout → reward → advantage → masked policy update → 평가의 전체 과정을 재조립한다.
- 모델 생성 토큰과 tool observation의 구분, action/token-level 시간축을 다시 연결한다.
- 같은 초기 과제의 그룹도 실행 후 서로 다른 상태로 분기한다. terminal reward만으로 중요한 과거 행동을 정확히 식별하는 문제가 남는다.
- timeout, context 압축, noisy judge, 환경 crash가 어떤 학습 오류를 만드는지 사례로 설명한다.
- coding 예제를 Search-R1의 검색 loop와 짧게 비교한다.
- 출처: Search-R1; Qwen3-Coder-Next; GLM-5.

### 11. 비동기 학습과 정책 지연

- 오래 걸리는 tool call과 길이가 다른 trajectory 때문에 동기식 batch가 기다리는 문제를 설명한다.
- 비동기 수집으로 처리량을 늘리면 actor와 learner의 policy version이 달라지는 tradeoff를 보여준다.
- log-probability, token ID, generation policy version, sampling 설정을 보존하는 이유를 설명한다.
- PPO의 clipping, DeepSeek의 sequence masking, GLM의 token masking은 같은 동작이 아님을 비교한다.
- 출처: IMPALA; DeepSeek-V3.2 §3.1; GLM-5 §4.1.

Figure 7 — **처리량과 policy lag**: worker별 작업 시간을 조정하고 동기/비동기를 전환한다. learner가 업데이트되는 동안 어느 trajectory가 낡는지 timeline으로 표시한다. 처리량 증가를 성능 증가로 자동 환산하지 않는다.

### 12. 추론에 쓰는 계산량: Reasoning effort

- 같은 weight에서도 추론 계산량과 행동 예산을 달리할 수 있다. effort를 올리는 요청 자체가 학습 update는 아니다.
- 내부 reasoning 길이, 환경 tool/turn 수, 독립 후보 수를 세 축으로 나눈다. 긴 설명, 높은 temperature, 긴 context window와도 다르다.
- 업체별 effort/thinking budget은 구현과 모델에 의존한다. 같은 high가 같은 계산량이나 정확도를 뜻하지 않는다.
- Qwen3의 thinking-mode/budget 학습을 공개 사례로, OpenAI·Anthropic·Gemini 문서를 inference 제어 사례로 연결한다. 공개되지 않은 내부 학습식을 추정하지 않는다.
- 비용을 고려하는 교육용 목적함수 J=E[R_success−λ_tok C_tokens−λ_tool C_tools]를 소개한다. 더 오래 생각하면 항상 성공률이 오르거나, 길이 penalty를 넣으면 항상 효율적 reasoning이 생긴다고 주장하지 않는다.
- 교사의 높은 effort로 얻은 trace가 학생의 배포 예산에 맞지 않을 수 있다. distillation 데이터와 평가에서 목표 예산을 명시한다.

Figure 9 — **생각과 도구 사용에 예산 배분하기**: 내부 계산·tool 예산·후보 수를 조정하고 toy 환경의 성공률과 비용을 비교한다. 실제 모델의 곡선을 구현하게 되면 모델·설정·표본 수를 명시하고, 합성 곡선을 업체 benchmark처럼 표현하지 않는다.

### 13. 실제 학습의 설계와 평가

- 하나의 공개 모델 순위 대신 실험 설계의 선택 순서를 제시한다.
- 신뢰할 수 있는 task/verifier와 초기 정책 → 단순 baseline → 그룹 기반 방법 또는 value 기반 방법 비교 → 안정성 진단 → 필요할 때 비동기 확장.
- 초기 정책이 약하고 좋은 교사를 쓸 수 있으면 검증된 trajectory distillation을 먼저 비교한다. 학생이 자주 이탈하는 상태를 방문하면 OPD 또는 해당 상태의 추가 시연을 검토한다. 직접 RL과 distillation을 같은 환경·평가·총비용 기준으로 비교한다.
- 교사 사용 비용, logits 접근, 실행 환경의 재현성, schema 호환성, 배포 effort를 함께 의사결정 표에 넣는다. 단일한 필수 학습 순서로 고정하지 않는다.
- REINFORCE/PPO/GRPO 비교표의 축: advantage 출처, critic 비용, rollout 비용, 정책 불일치 처리, credit assignment 한계.
- 보상 상승과 실제 held-out task 성공을 분리한다. 성공률과 비용, 반복 시행 신뢰도, regression을 함께 본다.
- 공식 조직 사례는 이 절의 원칙에 연결하는 짧은 표로 정리한다. 회사별 모델 홍보나 leaderboard 재현은 제외한다.
- 출처: 자료조사 README의 조직별 근거와 best-practice 표.

마지막에는 첫 테스트 실패로 돌아간다. 실행 loop에서 다음 행동이 달라지는 이유와, 다음 학습 round에서 그 행동의 확률이 달라지는 이유를 독자가 따로 설명할 수 있도록 끝낸다.

## 선택형 수식 부록

- trajectory probability factorization, log-derivative와 baseline의 기대값 0 조건.
- reward-to-go 및 GAE: δ_t=r_t+γV(h_{t+1})−V(h_t), Â_t=Σ_l(γλ)^l δ_{t+l}. truncation과 실제 terminal을 구분한다.
- tool-level 생성 행동의 log probability는 해당 생성 토큰 log probability의 합이다. observation 텍스트는 다음 조건부 분포의 context가 된다.
- 전체 trajectory importance sampling과 PPO의 local surrogate를 구분한다. 한 토큰 ratio로 장기 occupancy mismatch가 완전히 교정된다고 쓰지 않는다.
- GRPO 원형의 KL 항과 length/group normalization, leave-one-out baseline의 차이는 필요시 추가한다.

## 범위에서 제외하거나 짧게만 다룰 것

- DQN/SAC/TD3 등 전체 RL 알고리즘 역사, Bellman 최적성 증명의 긴 전개.
- DPO/RLHF의 별도 튜토리얼. 용어 간 관계를 설명하는 정도로 제한.
- multi-agent RL, PARL/swarm, robotics, world-model 학습은 후속 글의 주제로 남김.
- 최신 비공개 모델의 optimizer 추정, 검증되지 않은 보편적 최고 recipe.
- production API 튜닝 사용법과 거대한 학습 프레임워크 설치 설명.

## 검토받을 제안

권장안은 **coding agent를 관통 예제로 삼는 한 편의 긴 튜토리얼**, **on/off-policy·distillation·실제 학습 파이프라인에 충분한 비중**, **figure 9개 제안**, **GAE 및 엄밀한 보정은 선택 부록**이다. Figure 번호는 설계 ID이며 구현 때 등장 순서로 정렬한다. 구조와 강조점을 먼저 확정한 뒤 한국어 본문을 작성한다.
> 2026-09-08 최신 집필 결정: 아래 설계안의 과거 예시를 대체하여, 현재 본문과 그림은 '비어 있지 않은 정수 배열의 최댓값 찾기'를 사용한다. best=0의 음수 실패, 첫 원소만 반환하는 예제 과적합, best=nums[0]과 반복문을 유지하는 정답의 세 버전을 비교한다. 현재 원본은 src/content.html이며 이 문서는 설계 이력이다.
