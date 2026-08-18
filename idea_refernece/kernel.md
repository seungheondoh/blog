# Kernel

## 궁금한 것

- 커널이 정확히 뭘까?
- 커널은 예전에 중요했던 것 같은데 왜 요즘에는 관련 연구가 잘 안 보일까?
- 정말 사라진 걸까, 아니면 딥러닝 안에 다른 형태로 남아 있을까?

## 지금 생각

커널은 두 데이터가 얼마나 비슷한지를 계산하는 함수라고 일단 생각할 수 있다. 조금 더 정확히는, 데이터를 어떤 특징 공간으로 옮겼다고 가정했을 때 그 공간의 내적을 직접 이동하지 않고 계산한다.

$$
k(x,x') = \langle \phi(x), \phi(x') \rangle
$$

요즘 커널 연구가 덜 보이는 가장 큰 이유는 딥러닝이 **좋은 유사도나 특징 자체를 데이터에서 학습**하기 때문이다. 고전적인 커널 방법은 보통 RBF 같은 커널을 먼저 고르고 그 위에서 학습하지만, 신경망은 표현과 예측기를 함께 학습한다. 이미지·언어·음성 같은 대규모 비정형 데이터에서는 이 방식이 훨씬 강했다.

계산 규모도 이유다. 고전적인 커널 방법은 데이터 $n$개 사이의 $n \times n$ 관계를 다루는 경우가 많아 데이터가 커질수록 부담이 빠르게 증가한다. 반면 신경망은 mini-batch와 GPU를 이용한 대규모 학습 생태계가 잘 만들어졌다.

그래도 커널 연구가 사라진 것은 아니다. 다음과 같은 이름 아래 흩어져 있어 덜 보이는 면도 있다.

- Gaussian process와 불확실성 추정
- Neural Tangent Kernel을 통한 딥러닝 이론
- deep kernel learning
- random features, Nyström approximation 같은 scalable kernel
- MMD, kernel mean embedding 같은 분포 비교 방법
- 과학·의료처럼 데이터가 적고 사전지식이나 불확실성이 중요한 분야

글의 방향은 **“커널은 왜 사라졌나?”로 시작해서 “사라진 게 아니라 주인공 자리에서 내려와 다른 분야 속으로 들어갔다”로 끝내기**가 좋을 것 같다.

## 소스

링크의 `utm_source=chatgpt.com`은 제거함.

- [An Introduction to Deep Kernel Machines](https://compass.blogs.bristol.ac.uk/2023/01/17/an-introduction-to-deep-kernel-machines/)
- [Everything You Wanted to Know about the Kernel Trick](https://www.eric-kim.net/eric-kim-net/posts/1/kernel_trick.html)
- [Kernel Methods — Chen Kai Blog](https://www.chenk.top/en/tags/kernel-methods)
- [Deep Convolutional Representations in RKHS](https://logb-research.github.io/blog/2024/ckn/)

## 나중에 볼 논문

- [Deep Kernel Learning](https://proceedings.mlr.press/v51/wilson16.html)
- [Neural Tangent Kernel](https://papers.nips.cc/paper_files/paper/2018/hash/5a4be1fa34e62bb8a6ec6b91d2462f5a-Abstract.html)
