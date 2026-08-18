# Modern LLM Architecture

## 큰 지도

```text
Modern LLM
                        │
        ┌───────────────┼────────────────┐
        │               │                │
    Attention          FFN             Training
        │               │                │
 MHA → GQA        Dense → MoE      SFT → RL / Reasoning
        │
        ├─ Full Attention
        ├─ Sliding Window
        ├─ MLA
        ├─ Linear Attention
        │     ├─ GLA
        │     ├─ DeltaNet
        │     └─ Gated DeltaNet
        │
        └─ Hybrid Attention
              ├─ Qwen3-Next
              ├─ MiniMax
              └─ 기타 modern hybrid LLM
```

## 이 지도를 읽는 관점

Modern LLM의 변화는 완전히 새로운 블록이 계속 등장한다기보다, 크게 세 축의 trade-off로 볼 수 있다.

- **Attention**: 얼마나 넓은 문맥을, 어떤 방식으로 참고할까?
- **FFN**: 모든 파라미터를 쓸까, 토큰마다 일부 expert만 쓸까?
- **Training**: 다음 토큰 예측 이후에 instruction, preference, reasoning을 어떻게 학습할까?

요즘 아키텍처 연구의 상당 부분은 정확도만이 아니라 KV cache, memory bandwidth, inference latency, long-context 비용을 줄이는 방향으로 진행된다.

## Attention 계열 메모

- **MHA**: query/key/value head가 각각 독립적이다. 표현력은 좋지만 KV cache가 크다.
- **GQA**: 여러 query head가 key/value head를 공유해 KV cache를 줄인다.
- **MLA**: key/value를 latent representation으로 압축해 저장한다. DeepSeek 계열에서 주목받았다.
- **Sliding-window attention**: 가까운 토큰만 보는 층을 사용해 긴 문맥 비용을 줄인다.
- **Linear attention / Delta 계열**: attention의 전역 상호작용을 recurrent state나 kernel-like update로 바꿔 sequence 길이에 더 잘 확장하려 한다.
- **Hybrid attention**: full attention, local attention, linear/state-space 계열을 층별로 섞는다.

## FFN과 Training

MoE는 FFN을 여러 expert로 나누고 router가 토큰마다 일부만 활성화한다. 총 파라미터 수는 늘리면서 토큰당 계산량은 제한하려는 방식이다.

Training 쪽은 아키텍처와 분리되어 보이지만 실제 성능을 크게 좌우한다. SFT, preference optimization, RL, reasoning/post-training을 같은 backbone 위에 조합한다.

## 읽을거리

- [The Big LLM Architecture Comparison](https://magazine.sebastianraschka.com/p/the-big-llm-architecture-comparison)
  - DeepSeek V3/R1, OLMo 2, Gemma 3, Llama 4, Qwen3 등 현대 LLM을 구조적으로 비교한다.
  - MHA→GQA, MLA, MoE, sliding-window attention, normalization 등의 변화가 잘 정리되어 있다.
- [A Visual Guide to Attention Variants](https://magazine.sebastianraschka.com/p/visual-attention-variants)
  - attention 변형을 시각적으로 비교하기 위한 참고 자료.
- [Gated DeltaNet for Linear Attention](https://github.com/rasbt/LLMs-from-scratch/blob/main/ch04/08_deltanet/README.md)
  - Qwen3-Next와 Kimi Linear의 hybrid 구조를 직접 구현하며, Gated DeltaNet의 decay/update gate와 고정 크기 recurrent state를 설명한다.
- [Qwen3-Next — Qwen 공식 글](https://qwen.ai/blog?id=e34c4305036ce60d55a0791b170337c2b70ae51d)
  - Gated DeltaNet + Gated Attention을 3:1로 섞고, sparse MoE와 multi-token prediction을 결합한 설계를 소개한다.
- [Qwen 공식 링크 (사용자가 보낸 원본)](https://qwen.ai/blog?from=research.research-list&id=3425e8f58e31e252f5c53dd56ec47363045a3f6b)

## 다음 질문

- Linear attention은 실제로 attention인가, recurrent filter인가?
- GLA·DeltaNet·Gated DeltaNet은 무엇을 기억하고 무엇을 잊는가?
- Qwen3-Next와 MiniMax 같은 hybrid 구조는 어떤 층을 왜 섞는가?
- MLA와 GQA의 차이는 모델 품질보다 inference memory 문제로 이해해야 하는가?
- 아키텍처 변화와 training recipe의 기여를 어떻게 분리해서 비교할 수 있을까?
