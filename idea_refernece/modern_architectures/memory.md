# Memory in Modern LLMs

## 궁금한 것

- LLM은 무엇을 “기억”한다고 말할 수 있을까?
- KV Cache는 메모리인가, 아니면 단순한 계산 재사용인가?
- Transformer, RNN, SSM, Mamba는 과거 정보를 어떤 형태로 보관하는가?
- 긴 context를 늘리는 것과 진짜 memory를 갖는 것은 어떻게 다른가?

## 메모리의 여러 의미

### 1. Parameter memory

모델 weight에 들어 있는 지식. 학습이 끝난 뒤에도 남지만, 현재 대화의 특정 내용을 즉시 기록하는 메모리는 아니다.

### 2. Context memory

현재 입력에 포함된 token들. 모델이 볼 수 있는 context window 안에 있는 동안에는 직접 참조할 수 있다.

### 3. KV Cache

Autoregressive decoding에서 이미 계산한 key/value를 저장해 이전 token을 매번 다시 계산하지 않게 한다.

중요한 점은 KV cache가 **새로운 지식을 학습하는 저장소가 아니라, 현재 context의 attention용 중간 표현을 보관하는 캐시**라는 것이다.

문제는 sequence length에 따라 커진다는 점이다. 그래서 GQA, MQA, MLA, quantized KV cache, sliding window 같은 기법이 등장한다.

### 4. Recurrent state

RNN, SSM, Mamba, DeltaNet은 과거 전체를 저장하는 대신 고정 크기의 state에 압축한다.

- 장점: 긴 sequence에서도 memory가 context length에 비례해 커지지 않음
- 단점: 과거 정보가 압축되므로 원문 전체를 정확히 다시 참조하기 어려움

### 5. External memory

RAG의 vector database, document store, tool 결과, 대화 기록처럼 모델 바깥에 저장하는 정보.

모델 weight나 KV cache와 달리, 필요할 때 검색해서 context로 다시 넣어야 한다.

## 구조별 비교

| 구조 | 과거 정보의 형태 | 메모리 크기 | 강점 | 약점 |
|---|---|---:|---|---|
| Full attention | 모든 token의 K/V | context에 비례 | 정확한 재참조 | KV cache가 큼 |
| Sliding window | 최근 local token | 제한적 | 긴 sequence에 효율적 | 먼 과거 접근 제한 |
| RNN/SSM | 고정 크기 state | 거의 일정 | streaming, 긴 sequence | 정보 병목 |
| Mamba/DeltaNet | 선택적으로 갱신되는 state | 거의 일정 | 무엇을 기억할지 학습 | full recall과 trade-off |
| RAG | 외부 문서/검색 결과 | 외부 저장소 | 지식 업데이트 가능 | 검색 품질에 의존 |

## 핵심 구분

> 긴 context는 “많은 것을 눈앞에 펼쳐놓는 것”이고, memory는 “필요한 것을 압축하거나 저장해 나중에 다시 쓰는 것”이다.

이 둘은 같은 문제가 아니다. 긴 context 모델은 더 많은 token을 볼 수 있지만, 실제로 중요한 내용을 안정적으로 기억하고 검색한다는 보장은 없다.

## 글의 방향

1. 사람의 기억과 LLM의 memory를 구분하기
2. KV cache는 왜 cache이지 memory가 아닌가?
3. Transformer의 전체 context 참조와 SSM의 압축 state 비교
4. RAG는 모델의 memory를 확장하는가, 아니면 검색 시스템을 붙이는 것인가?
5. 앞으로의 LLM은 full attention, recurrent state, external memory를 어떻게 조합할까?

## 제목 후보

- LLM은 무엇을 기억하는가
- KV Cache는 메모리가 아니다
- 긴 Context와 진짜 Memory의 차이
- Transformer의 기억, Mamba의 기억, RAG의 기억

## 연결 문서

- [LLM 아키텍처 부품별 변화](./architecture_axes.md)
- [GPT-2부터 현대 LLM까지](./transformer_evolution.md)
- [Filter와 State Space 관점](../filter.md)
