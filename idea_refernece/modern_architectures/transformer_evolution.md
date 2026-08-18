# GPT-2에서 현대 LLM까지

## 한 줄 요약

Transformer의 기본 블록은 크게 바뀌지 않았지만, **위치 표현, attention의 메모리 비용, FFN의 sparsity, 긴 문맥 처리, post-training**이 계속 바뀌었다.

## 대략적인 흐름

| 시기 / 계열 | 주요 변화 | 왜 필요한가 |
|---|---|---|
| GPT-2 (2019) | decoder-only Transformer, MHA, learned positional embedding, dense FFN | 언어 모델의 기본 골격 |
| GPT-3 (2020) | 거의 같은 골격을 훨씬 크게 확장 | scale 자체가 성능을 만든다는 흐름 |
| LLaMA 계열 | RoPE, RMSNorm, SwiGLU, pre-norm 계열의 현대적 기본값 | 학습 안정성·효율·긴 문맥 개선 |
| GQA 계열 | 여러 query head가 K/V를 공유 | KV cache와 inference memory 절약 |
| Mistral / Gemma 계열 | sliding-window 또는 local attention | 긴 입력에서 attention 비용 절약 |
| Mixtral / DeepSeek / Qwen MoE | FFN을 여러 expert로 나누고 일부만 활성화 | 총 capacity는 키우고 token당 계산은 제한 |
| DeepSeek V2/V3 | MLA로 KV를 latent space에 압축 + MoE | KV cache와 대규모 serving 비용 절약 |
| Mamba / SSM | attention 대신 state update·scan | sequence 길이에 선형적인 처리 |
| Qwen3-Next / Kimi Linear | full attention과 Gated DeltaNet을 hybrid로 결합 | recall과 long-context 효율의 절충 |

## 변화의 축

### 1. Attention: 표현력과 메모리의 줄다리기

MHA는 모든 head가 독립적인 K/V를 갖는다. GQA는 K/V를 공유하고, MLA는 K/V를 압축한다. Sliding Window는 볼 수 있는 범위를 줄인다. Linear attention과 Delta 계열은 $n \times n$ attention matrix 대신 recurrent state를 유지한다.

그래서 attention의 역사는 “더 좋은 attention”의 역사라기보다, 다음 질문의 반복에 가깝다.

> 모든 토큰 쌍을 저장하고 비교해야 하는가?

### 2. FFN: Dense에서 MoE로

Transformer block에서 FFN은 많은 파라미터를 차지한다. MoE는 expert를 여러 개 두고 router가 토큰마다 일부 expert만 선택한다. 전체 모델 용량과 실제 token당 계산량을 분리할 수 있다.

### 3. Position: 절대 위치에서 구조적 위치로

GPT-2의 learned absolute position embedding에서 RoPE, ALiBi, sliding/local 구조 등으로 발전했다. 위치 정보는 단순히 “몇 번째 토큰인가”를 알려주는 장치가 아니라, 긴 문맥에서 거리와 extrapolation을 어떻게 다룰지 결정한다.

### 4. Training: architecture와 분리할 수 없는 축

같은 Transformer block이라도 pretraining, SFT, preference optimization, RL, reasoning용 post-training에 따라 모델의 행동이 달라진다. 따라서 현대 LLM 비교에서는 구조 변화와 training recipe를 분리해 보기 어렵다.

## 특히 보고 싶은 연결

- GPT-2의 고정된 MHA에서 Qwen3-Next의 3:1 hybrid attention까지
- CNN의 local filter → SSM의 recurrent filter → DeltaNet의 learned memory update
- MHA/GQA/MLA가 실제로 줄이는 것은 FLOPs보다 KV-cache memory인가?
- MoE의 “총 파라미터”와 “활성 파라미터”를 어떻게 구분해서 봐야 하는가?
- attention을 계속 개선하는 흐름과 attention을 일부 대체하는 흐름은 경쟁인가, hybrid로 수렴하는가?

## 참고 링크

- [The Big LLM Architecture Comparison](https://magazine.sebastianraschka.com/p/the-big-llm-architecture-comparison)
- [A Visual Guide to Attention Variants](https://magazine.sebastianraschka.com/p/visual-attention-variants)
- [Gated DeltaNet for Linear Attention](https://github.com/rasbt/LLMs-from-scratch/blob/main/ch04/08_deltanet/README.md)
- [Qwen3-Next 공식 글](https://qwen.ai/blog?id=e34c4305036ce60d55a0791b170337c2b70ae51d)
- [사용자가 보낸 Qwen 링크](https://qwen.ai/blog?from=research.research-list&id=3425e8f58e31e252f5c53dd56ec47363045a3f6b)
