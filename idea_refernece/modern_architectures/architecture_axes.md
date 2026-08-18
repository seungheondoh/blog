# LLM 아키텍처를 부품별로 보기

모델 이름을 시간순으로 나열하기보다, Transformer를 구성하는 부품이 GPT-2 이후 어떻게 바뀌었는지 추적한다.

## 1. Tokenizer

텍스트를 어떤 단위의 token으로 쪼갤 것인가.

- GPT-2: byte-level BPE
- 이후 계열: BPE, SentencePiece, unigram 계열의 변형
- 최근 관심: vocabulary 크기, 다국어 효율, 숫자·코드 처리, special token, byte fallback

Tokenizer는 단순한 전처리가 아니다. 같은 문장을 몇 token으로 표현하는지가 context length, embedding 비용, 학습 데이터 효율, 다국어 성능에 영향을 준다.

질문: 더 좋은 tokenizer가 모델의 reasoning 자체를 개선하는가, 아니면 같은 context에 더 많은 정보를 넣게 해주는가?

## 2. Positional Encoding

Attention만으로는 token 순서를 알 수 없기 때문에 위치 정보를 주입한다.

- GPT-2: learned absolute positional embedding
- RoPE: query/key를 위치에 따라 회전시켜 상대적 거리 정보를 attention에 반영
- ALiBi 등: attention score에 거리 bias를 더하는 방식
- 최근 방향: 긴 문맥 extrapolation, position interpolation, partial RoPE, sliding/local 구조

질문: 위치 표현은 “순서를 알려주는 장치”인가, 아니면 긴 문맥의 inductive bias를 설계하는 장치인가?

## 3. Attention

각 token이 다른 token을 얼마나 참고할지 정한다.

- MHA: query head마다 독립적인 key/value
- GQA: 여러 query head가 K/V를 공유해 KV cache 절약
- MQA: key/value head를 더 강하게 공유
- MLA: K/V를 latent representation으로 압축
- Sliding Window: 가까운 범위만 참조
- Linear attention: $n \times n$ 행렬 대신 누적 state나 kernel-like update
- Hybrid attention: full attention과 linear/state-space 층을 섞음

핵심 trade-off는 표현력과 메모리다.

질문: full attention이 필요한 정보와 recurrent state로 압축해도 되는 정보는 어떻게 다른가?

## 4. FFN / MLP

Attention이 token 간 정보를 섞는다면, FFN은 각 token의 표현을 변환하고 지식을 저장하는 큰 부분이다.

- GPT-2: dense FFN + GELU
- 현대 계열: SwiGLU/GeGLU 같은 gated activation
- MoE: 여러 expert 중 일부만 token별로 활성화
- Shared expert: 모든 token이 공유하는 기본 expert를 추가

MoE는 “모델 전체 용량”과 “한 token을 처리할 때 쓰는 계산량”을 분리한다.

질문: expert는 지식의 전문 분야를 나누는가, 아니면 단순히 conditional computation을 제공하는가?

## 5. Normalization과 Residual

깊은 Transformer를 안정적으로 학습시키는 부품이다.

- LayerNorm → RMSNorm
- Post-Norm → Pre-Norm 계열
- QK-Norm: attention의 query/key를 별도로 정규화
- residual stream와 여러 gating 변형

겉보기에는 작은 변경이지만 initialization, gradient stability, massive activation, 학습 속도에 영향을 준다.

## 6. Convolution / State Space / Recurrence

모든 현대 LLM이 attention만 사용하는 것은 아니다.

- convolution: local mixing과 효율적인 구현
- SSM/Mamba: hidden state에 긴 문맥을 압축
- DeltaNet: memory state를 delta rule과 gate로 업데이트
- hybrid: full attention은 recall을 담당하고, linear/state 계열은 긴 문맥 효율을 담당

이 축은 이전 `filter.md`의 질문과 직접 연결된다. attention을 global adaptive filter로, SSM을 recurrent filter로 읽어볼 수 있다.

## 7. Output Head와 Vocabulary

- tied / untied input-output embedding
- vocabulary 크기와 embedding 비용
- logits 계산과 vocabulary 병목
- multi-token prediction, speculative decoding과의 결합

현대 LLM의 속도는 Transformer block만이 아니라 마지막 vocabulary projection과 decoding 방식에도 좌우된다.

## 한눈에 보는 변화

| 부품 | GPT-2 시기 | 현대의 주요 방향 |
|---|---|---|
| Tokenizer | byte-level BPE | 다국어·코드·token 효율 최적화 |
| Position | learned absolute | RoPE, relative bias, long-context scaling |
| Attention | MHA | GQA, MLA, local, linear, hybrid |
| FFN | dense GELU | SwiGLU, MoE, shared expert |
| Norm | LayerNorm | RMSNorm, Pre-Norm, QK-Norm |
| Sequence mixing | full attention | attention + convolution/SSM/DeltaNet |
| Output | next-token logits | MTP, speculative decoding 친화 설계 |

## 글의 중심 질문

> Transformer는 무엇이 되었는가?

답은 “attention 모델이 더 커졌다”가 아니라, tokenizer부터 decoding까지 각 부품이 **표현력, 메모리, bandwidth, context length, 학습 안정성** 사이의 trade-off를 조정하는 방향으로 진화했다는 쪽에 가깝다.

## 참고

- [GPT-2부터 현대 LLM까지 연대기 메모](./transformer_evolution.md)
- [전체 LLM 아키텍처 지도](./llm_architecture.md)
- [The Big LLM Architecture Comparison](https://magazine.sebastianraschka.com/p/the-big-llm-architecture-comparison)
- [A Visual Guide to Attention Variants](https://magazine.sebastianraschka.com/p/visual-attention-variants)
