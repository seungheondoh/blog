# Review: Collapse and Self-Supervised Learning

## Recommendation

**현재 판정: Weak Reject (수정 후 재심 권고)**

글은 representation collapse를 중심으로 여러 SSL 방법을 비교하고, 전역 표현과 token 표현의 간극까지 연결한다. 인터랙티브 시각화와 구현상의 주의점은 blog track에 잘 맞는다. 특히 trivial solution의 존재, 실제 optimization dynamics, downstream 성능 저하를 구분한 점은 좋다.

다만 현재 원고는 세 종류의 글을 동시에 쓰려 한다. (1) SSL 입문, (2) collapse taxonomy와 방지법 survey, (3) patch-level regularization에 관한 새로운 관찰과 제안이다. 앞의 둘은 비교적 단단하지만, 셋째 주장이 뒤로 갈수록 증거보다 커진다. 또한 서로 다른 문헌에서 쓰인 `collapse`를 하나의 taxonomy로 묶으면서 정의의 층위가 일정하지 않다. ICLR Blog Track 제출 전에는 아래 major issue를 해결해야 한다.

## Main reference와의 정합성

Main reference는 Shwartz-Ziv and LeCun, [*To Compress or Not to Compress — Self-Supervised Learning and Information Theory: A Review*](https://arxiv.org/abs/2304.09355)이다. 이 논문의 중심 질문은 “collapse를 어떻게 막는가”보다 넓은 “어떤 정보를 압축하고 어떤 정보를 보존해야 하는가”이다.

이 review가 제공하는 가장 중요한 구분은 다음과 같다.

- Joint-embedding SSL은 두 view 사이에서 예측 가능한 정보를 보존하면서, 한 view에만 있는 정보를 압축하려 한다.
- 이 논리는 두 view 각각이 downstream task에 필요한 정보를 거의 충분히 담는다는 **Multiview assumption**에 의존한다.
- 가정이 맞으면 view-specific information의 압축은 바람직한 invariance가 될 수 있다.
- 가정이 깨지면 non-shared information에도 task-relevant information이 들어 있을 수 있다. 이때 표현은 complete collapse를 겪지 않고도 downstream task에 불충분할 수 있다.
- 따라서 “compression = collapse”도 아니고 “많이 퍼진 representation = 좋은 representation”도 아니다.

수정된 본문은 이 구분을 `언제 문제가 되고, 언제 안 되나` 절에 추가했다. 방향은 옳다. 다만 이 논문을 **collapse 유형이나 다섯 방지법의 직접 근거**로 사용해서는 안 된다. 이 논문은 정보이론적 review이며, 본문의 세부 taxonomy를 제안하거나 검증한 논문이 아니다.

## Major issues

### 1. Taxonomy의 분류 기준이 섞여 있다

현재 표의 항목은 같은 수준의 개념이 아니다.

- `complete collapse`는 sample 간 표현이 상수가 되는 상태다.
- `dimensional collapse`는 embedding covariance의 rank가 감소하는 기하학적 상태다.
- `informational collapse`는 문헌에 따라 입력 정보 또는 entropy가 사라지는 더 넓은 개념인데, 본문은 이를 “차원들이 같은 말을 반복함”으로 좁혀 쓴다. 이것은 covariance redundancy에 더 가깝다.
- `mode collapse`는 prototype/code assignment가 있는 방법에서만 정의되는 head-level 현상이다.
- `token collapse`는 한 sample 내부 token의 rank 또는 similarity 문제다.
- `국소 구조 소실`은 본문도 인정하듯 collapse가 아닐 수 있다.

따라서 “Six Ways to Collapse”라는 배타적 taxonomy로 제시하면 과장이다. `Types of Collapse and Related Failures` 정도로 범위를 밝히고, 각 행에 **관측 단위(sample/dimension/prototype/token), 진단 통계, 적용 가능한 모델군**을 명시하는 편이 낫다. 특히 informational collapse의 정의는 main reference의 용법과 충돌하지 않도록 다시 써야 한다.

### 2. “고정 target이면 collapse 방지 장치가 필요 없다”는 문장은 범위를 더 제한해야 한다

수정본은 이를 “상수 target으로의 공동 붕괴”로 좁혀 이전보다 정확해졌다. 그래도 표의 `필요 없음`은 너무 강하다. 고정 pixel target은 단순한 constant-output 해를 최소점에서 배제하지만, 다음을 배제하지는 않는다.

- decoder가 강할 때 encoder가 무시되는 latent/posterior collapse
- learned tokenizer 또는 codebook의 사용 mode가 줄어드는 현상
- reconstruction에는 충분하지만 semantic downstream task에는 불충분한 표현
- 지나치게 국소적인 shortcut

표의 마지막 열은 `별도 장치 불필요`보다 `이 matching loss의 constant solution은 배제됨`으로 바꾸는 것이 정확하다.

### 3. “다섯 가지 방지법”은 유용한 설명 틀이지만 완전한 분류처럼 보인다

negative, stop-gradient/asymmetry, centering–sharpening, variance–covariance regularization, distribution matching은 좋은 교육적 grouping이다. 그러나 서로 배타적이지 않고 실제 방법은 여러 장치를 결합한다. DINO는 stop-gradient/EMA와 centering/sharpening을 함께 쓰고, DINOv2는 iBOT와 KoLeo까지 사용한다. Barlow Twins를 VICReg과 같은 칸에 넣을 때도 작동 원리가 완전히 같지는 않다.

본문은 뒤에서 혼합형을 인정하지만, 앞부분의 “다섯 종류”라는 서술이 독자의 해석을 먼저 고정한다. 처음부터 “이 글에서 비교할 다섯 설계 패턴”이라고 부르고 exhaustive taxonomy가 아님을 밝혀야 한다.

### 4. stop-gradient에 대한 설명이 직관을 사실처럼 말한다

“한 사람을 멈춰 세우면 다른 사람은 그 자리로 가야 한다”는 비유는 stop-gradient가 왜 collapse를 피하는지 설명하지 못한다. target network가 이미 상수라면 student는 그 상수로 갈 수 있고, constant solution은 여전히 loss의 global optimum이다. SimSiam/BYOL의 비붕괴는 predictor, normalization, optimization dynamics, initialization 등이 얽힌 결과다.

본문 후반에는 이 한계를 적어 두었지만 section lead와 첫 문단의 자신감이 더 강하다. 비유를 “gradient의 대칭을 깨뜨린다” 수준으로 제한하고, 충분조건으로 이해하면 안 된다는 문장을 앞에 배치해야 한다.

### 5. patch-level 주장의 증거는 인과 결론을 지지하지 않는다

DINOv2의 iBOT ablation, V-JEPA 2.1, DINOv3, DenseCL, VICRegL은 위치별 또는 local objective가 dense task에 도움이 된다는 정황을 제공한다. 그러나 이들을 합쳐 다음을 결론 내릴 수는 없다.

- global collapse prevention이 token collapse를 유발한다.
- 위치별 감독만이 dense 성능을 움직인다.
- global regularizer를 token 수준으로 옮기면 같은 효과가 난다.

DINOv2 ablation은 masking과 head를 함께 바꾸며, 서로 다른 논문의 수치는 architecture·data·training schedule이 다르다. DINOv3의 Gram anchoring은 collapse prevention이라기보다 장기 학습 중 local consistency 보존으로 해석할 수 있다. 수정본에서 주장을 “위치별 신호가 dense task에 도움이 되며 global metric만으로 효과를 예측할 수 없다”로 좁힌 것은 적절하다. 이 제한을 결론과 index 문구에도 끝까지 유지해야 한다.

### 6. 제안된 token-level SIGReg는 가설이지 결론이 아니다

한 이미지의 token 집합에 isotropic Gaussian prior를 적용하면 다음 문제가 생긴다.

- token은 i.i.d. sample이 아니다. 공간적으로 강하게 상관되어 있다.
- 한 이미지의 patch 수는 작아 projected normality test의 검정력이 낮다.
- 하늘이나 벽처럼 실제로 비슷해야 하는 patch까지 밀어낼 수 있다.
- positional embedding만 보존하는 shortcut이 생길 수 있다.
- 높은 token rank와 좋은 spatial semantics는 동치가 아니다.

본문이 이 한계를 상당 부분 인정하는 점은 좋다. 따라서 이 부분은 “자연스러운 질문”이나 “testable hypothesis”로 명확히 표기하고, 방법 제안처럼 보이는 수식 앞에 실험 설계와 falsification criterion을 함께 두어야 한다. 최소한 random initialization, shuffled positions, supervised ViT, global-only SSL, local-loss SSL을 대조군으로 포함해야 한다.

### 7. 정보이론적 핵심이 글의 나머지와 아직 충분히 연결되지 않는다

main reference를 반영해 Multiview assumption 문단을 추가했지만, 이후의 taxonomy와 metric은 다시 “얼마나 퍼져 있는가”에 집중한다. 독자는 높은 variance/rank가 정보 보존을 뜻한다고 오해할 수 있다. 그러나 noise나 위치 코드만으로도 rank는 높아질 수 있다.

각 metric 절에서 다음 두 질문을 분리해야 한다.

1. representation이 자명하거나 저차원 상태로 무너졌는가?
2. downstream task에 필요한 정보가 남아 있는가?

첫 질문은 label 없이 어느 정도 진단할 수 있지만, 둘째 질문에는 task, probe 또는 명시적인 가정이 필요하다. main reference가 이 구분을 뒷받침한다.

## Claims requiring verification or softer wording

- `complete collapse는 제일 덜 중요하다`: 중요도의 객관적 순위로 입증되지 않았다. “현대 recipe에서는 비교적 쉽게 탐지된다” 정도가 안전하다.
- `셋 다 collapse를 겪지 않는다`(MAE/BEiT/BEST-RQ): 어떤 collapse인지 한정해야 한다. constant joint-embedding collapse를 피한다는 뜻으로만 유효하다.
- `negative가 하는 일이 정확히 uniformity다`: normalized contrastive learning에 대한 Wang–Isola의 분석 범위 안에서 유효하다. 모든 negative-based objective로 일반화하면 안 된다.
- `variance 항이 complete, covariance 항이 informational collapse를 막는다`: VICReg의 설계 의도와 맞지만, covariance penalty가 “information” 자체를 보존한다는 표현은 피해야 한다.
- `Barlow Twins에서 분산 붕괴를 막는 것은 loss가 아니라 normalization`: 구현과 epsilon, batch normalization의 역할을 더 엄밀히 확인해야 한다. 현재 문장은 단일 원인을 단정한다.
- `KoLeo의 주목적은 붕괴 방지가 아니다`: 저자 의도와 기능을 구분해야 한다. ablation에서 classification 변화가 작다는 사실만으로 collapse 방지 역할이 없다고 결론 낼 수 없다.
- `DINO temperature가 높으면 uniform collapse`: 해당 schedule, architecture, teacher setting에서의 관측으로 한정해야 한다.
- `Gram rank가 token collapse에 가장 믿을 만하다`: 비교 benchmark 없이 최상급을 쓰지 않는 편이 좋다.
- `위치별 항을 가진 모델을 이긴 순수 전역 방법은 아직 없다`: 문헌 전체에 대한 부재 주장은 체계적 search protocol 없이는 방어하기 어렵다. 삭제하거나 “이 글에서 검토한 결과 중에는 찾지 못했다”로 바꿔야 한다.

## Presentation and voice

개고 전 원고가 AI처럼 읽힌 가장 큰 이유는 정보가 아니라 리듬이었다. 거의 모든 문단이 굵은 한 줄 결론으로 시작하고, 이어서 비유, 단정, “정확히”, “딱 하나”, “전부”가 반복됐다. 수정된 도입부는 질문이 자연스럽게 이어지고 예외를 먼저 밝히므로 훨씬 낫다.

남은 본문에도 같은 패턴이 많다. 특히 `①`, `②`, `③`으로 문장 안에서 논점을 압축하거나, 모든 문단 첫 문장을 `<strong>`으로 처리하거나, 영어 논문 문장을 길게 직접 인용하는 방식은 줄이는 것이 좋다. 논문 문장은 필요한 주장만 한국어로 paraphrase하고 citation을 붙이면 충분하다. 직접 인용은 저자의 정확한 한정 조건이 중요한 경우에만 남기는 편이 글의 목소리를 살린다.

## Required revision checklist

- [ ] taxonomy를 배타적 “여섯 유형”이 아니라 관측 층위가 다른 collapse/related failure의 지도라고 명시한다.
- [ ] informational collapse와 covariance redundancy의 용어를 분리한다.
- [ ] 고정 target 표의 `방지 장치 필요 없음`을 constant-solution에 한정한다.
- [ ] 다섯 방지법을 exhaustive list가 아닌 다섯 design pattern으로 부른다.
- [ ] stop-gradient 비유를 약화하고 optimization dynamics라는 한계를 앞에 둔다.
- [ ] 모든 최상급과 문헌 부재 주장을 제거하거나 search 범위를 밝힌다.
- [ ] patch-level 절의 결론을 상관/정황 증거 수준으로 유지한다.
- [ ] token-level SIGReg를 명시적인 hypothesis와 실험 계획으로 제시한다.
- [ ] collapse metric과 downstream utility metric을 분리한다.
- [ ] main reference의 Multiview assumption을 결론에서 다시 회수한다.
- [ ] 긴 직접 인용과 문단 첫머리의 반복적인 굵은 선언문을 줄인다.

## Final assessment

이 글의 가장 강한 기여는 새로운 collapse 이론이 아니라, 복잡한 SSL recipe를 **target의 성질, collapse 방지 장치, 통계가 적용되는 level**이라는 세 질문으로 읽게 해 주는 설명 틀이다. 이 범위에 충실하면 좋은 blog track 글이 될 수 있다. 반대로 token-level regularization의 필요성을 보편 법칙처럼 밀면 현재 증거로는 심사에서 방어하기 어렵다.

추천하는 최종 thesis는 다음과 같다.

> Self-supervised learning은 어떤 정보를 view 사이에 보존하고 어떤 정보를 압축할지 정하는 문제다. Collapse 방지 장치는 모든 정보를 보존하는 장치가 아니라, 압축이 자명해로 끝나지 않게 하는 제약이다. 그 제약이 계산되는 level과 downstream task가 요구하는 level이 다르면, 전역 표현이 건강해 보여도 국소 정보는 사라질 수 있다.

이 thesis는 main reference의 정보이론적 관점과 현재 원고의 taxonomy, patch-level 사례를 과장 없이 연결한다.
