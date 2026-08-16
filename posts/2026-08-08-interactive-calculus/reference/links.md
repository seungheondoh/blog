# References

Shared by the calculus post and the differential equations post that follows it.

## Primary (intuition, Korean)

- https://angeloyeo.github.io/2019/08/25/gradient.html — 그래디언트. 온도장 비유로 "변화가 가장 큰 방향"을 설명. 등고선 직교성은 다루지 않으므로, 본문에서는 방향도함수 \(D_u f = \nabla f\cdot u\)에서 직접 유도했다.
- https://angeloyeo.github.io/2019/08/25/divergence.html — 발산. 미소 상자의 알짜 유출량(단위 부피당 유량)에서 \(\partial P/\partial x + \partial Q/\partial y\)를 유도하는 논증. 본문의 "샘과 싱크" 절이 이 논증을 따른다.
- https://angeloyeo.github.io/2020/07/30/multiple_integral.html — 다중적분. 넓이(직사각형 합) → 부피(직육면체 합)의 확장, 반복적분으로의 환원, 영역이 직사각형이 아닐 때의 상하한 설정.

## Primary (intuition, English)

- https://najeebkhan.github.io//blog/VecCal.html — 벡터 미적분. gradient → Jacobian → Hessian → Laplacian 순서, 그리고 **라플라시안 = 헤시안의 대각합**이라는 정리. 발산과 회전은 다루지 않는다.
- https://najeebkhan.github.io//blog/ODE.html — 미분방정식 입문. 기울기장(direction field)으로 해곡선을 시각화하는 접근, \(F=m\ddot{x}\)와 개체군 모형 \(\dot{P}=kP\). 수치해법과 ML 연결은 없다.

## Target of the follow-up post

- `2605.22586v3.pdf` — Fu & Wang, *A Tutorial on Diffusion Theory: From Differential Equations to Diffusion Models* (INSAIT). 조건부 가우시안 forward path → 조건부 ODE/SDE → 주변화된 forward dynamics → reverse SDE와 **probability-flow ODE** → score matching → DDPM/DDIM/flow matching. 미분방정식 글의 Part VII이 정확히 이 경로를 따른다.
- `lab_one.ipynb` — Euler / Euler–Maruyama 시뮬레이터, Brownian motion, Ornstein–Uhlenbeck 과정, Langevin dynamics, SDE로 분포 변환하기. 본문 Python 스니펫의 어휘(`SDE`, `Simulator`, `EulerMaruyamaSimulator`)를 여기에 맞춘다.
