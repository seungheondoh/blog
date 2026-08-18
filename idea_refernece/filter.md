# Filter

## 궁금한 것

- 필터는 원래 어떤 문제를 풀기 위해 등장했나?
- 아날로그 필터 → 디지털 필터 → CNN의 convolution filter는 어떻게 이어지나?
- Transformer와 Mamba도 필터라고 볼 수 있나?
- 최근 아키텍처들이 signal processing의 아이디어를 다시 가져오는 이유는 무엇인가?

## 아주 짧은 역사

필터의 가장 기본적인 일은 신호에서 원하는 성분은 통과시키고 원하지 않는 성분은 약하게 만드는 것이다.

대략적인 흐름은 다음과 같다.

1. **아날로그 필터**: 저항·커패시터·인덕터로 주파수 성분을 골라냄
2. **푸리에/Laplace 관점**: 시간 영역의 시스템을 주파수 응답으로 분석
3. **디지털 FIR/IIR 필터**: 샘플링된 신호에 이동평균, convolution, feedback을 적용
4. **상태공간 모델과 Kalman filter**: 신호를 숨은 상태의 동역학과 관측 문제로 봄
5. **CNN**: 사람이 설계하던 이미지·음성 필터를 데이터로 학습
6. **SSM/Mamba**: 긴 sequence를 상태공간과 선택적 필터링으로 처리

Stanford의 [The Scientist and Engineer's Guide to Digital Signal Processing](https://ccrma.stanford.edu/~jos/fp/)를 출발점으로 삼으면 필터·주파수 응답·convolution·FIR/IIR를 한 흐름으로 훑을 수 있다.

## CNN의 filter

CNN의 filter는 작은 창을 입력 위에서 이동시키며 내적하는 학습 가능한 가중치다. 초반 층에서는 edge나 방향성 같은 단순 패턴, 뒤로 갈수록 더 복잡한 패턴을 감지하는 식으로 해석할 수 있다.

고전 신호처리와 닮은 점:

- local receptive field
- weight sharing
- convolution/correlation
- translation equivariance

다른 점은 필터 계수를 사람이 주파수 응답으로 설계하지 않고, loss와 backpropagation으로 학습한다는 것이다. 따라서 CNN은 **signal-processing 구조를 가진 representation learner**로 볼 수 있다.

## 현대 아키텍처를 filter 관점에서 보기

### CNN

고정된 크기의 local filter를 여러 층 쌓는다. 지역성의 inductive bias가 강하고 이미지·파형에 잘 맞지만, 먼 위치의 정보를 섞으려면 층을 많이 쌓아야 한다.

### RNN / state-space model

입력의 과거를 hidden state에 압축한다. 이것은 단순한 고정 convolution보다 동적이고, 연속시간 시스템·미분방정식·제어 이론과 가까운 관점이다.

### Transformer

고정된 filter를 한 번 적용하는 대신, 현재 입력으로부터 각 토큰이 무엇을 참고할지 매번 계산한다. 그래서 attention은 **content-dependent global filter**처럼 볼 수 있다.

다만 attention을 고전적인 선형 시불변(LTI) 필터와 동일시하면 안 된다. 고전 필터는 보통 같은 시스템을 반복 적용하지만, attention의 mixing rule은 입력마다 달라지고 모든 위치를 연결한다.

### Mamba / selective SSM

Mamba는 state-space model의 파라미터를 입력에 따라 바꿔 현재 토큰을 얼마나 기억하고 잊을지 선택한다. 논문이 강조하는 핵심은 긴 sequence에서 선형적인 길이 확장, content-based selection, 하드웨어 친화적인 scan이다. [Mamba 논문](https://arxiv.org/abs/2312.00752)

필터 관점에서는 다음처럼 볼 수 있다.

> CNN = 학습된 local filter  
> SSM = 동역학을 가진 recurrent filter  
> Mamba = 입력에 따라 계수가 바뀌는 selective filter  
> Attention = 입력에 따라 연결 범위와 가중치가 바뀌는 global filter

이 비유는 직관을 주지만, Mamba는 단순한 FIR/IIR 필터가 아니다. 비선형 projection, gating, state update, scan이 결합된 sequence architecture다.

## “Signal processing의 revisit”라는 관점

딥러닝이 커지면서 모든 문제를 거대한 attention으로 처리하기 어려워졌다. 긴 context에서는 메모리·추론 비용과 latency가 문제가 된다. 그래서 연구자들이 다시 보는 것은 오래된 필터 그 자체라기보다 다음의 구조적 아이디어다.

- locality와 translation structure
- convolution으로 반복 계산을 빠르게 만드는 방법
- recurrence와 compressed state
- 주파수/다중 스케일 표현
- 안정적인 선형 시스템과 제어 이론
- 데이터 길이에 선형으로 증가하는 계산

즉 현대 아키텍처는 signal processing을 복고적으로 복원하는 것이 아니라, **학습 가능한 필터·상태공간·주파수 구조를 대규모 하드웨어에 맞게 다시 설계하는 중**이라고 보는 편이 좋다.

## 글감 제목 후보

- 필터는 어떻게 신경망이 되었나
- CNN, Attention, Mamba를 하나의 필터 언어로 읽기
- 딥러닝은 왜 다시 신호처리로 돌아가는가
- 고정 필터에서 선택적 상태공간까지

## 다음에 확인할 것

- FIR/IIR와 CNN convolution을 수식으로 어디까지 동일하게 볼 수 있는가?
- S4의 “long convolution”과 Mamba의 selective scan 차이는 무엇인가?
- attention을 adaptive filter로 부르는 것이 유용한가, 단순한 비유인가?
- Mamba의 선택 메커니즘이 Kalman filter나 adaptive filtering과 어떤 점에서 닮고 다른가?
- 오디오·시계열·이미지·언어마다 filter 관점의 유효성이 어떻게 달라지는가?

## 출처

- [The Scientist and Engineer's Guide to Digital Signal Processing](https://ccrma.stanford.edu/~jos/fp/)
- [Mamba: Linear-Time Sequence Modeling with Selective State Spaces](https://arxiv.org/abs/2312.00752)
- [Transformers are RNNs: Fast Autoregressive Transformers with Linear Attention](https://arxiv.org/abs/2006.16236)
