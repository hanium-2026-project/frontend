# 🚗 Hanium 2026 — AI Smart Parking System

CCTV 기반 차량 인식과 강화학습 기반 주차 공간 배정, RC Car 자동주차 제어를 통합한 AI 스마트 주차 시스템입니다. 차량 인식부터 주차 공간 배정, 경로/제어, 실제 RC Car 주차까지 연결되는 End-to-End 시스템을 세 저장소로 나누어 구현했습니다.

## 📦 Repositories

| Repository | Role |
|---|---|
| **Frontend (현재 저장소)** | 실시간 주차 현황 및 시스템 상태를 제공하는 웹 대시보드 |
| [Backend](https://github.com/hanium-2026-project/backend) | 차량 인식, 주차 상태 관리, RL 기반 주차 공간 배정 및 시스템 orchestration |
| [Hardware](https://github.com/hanium-2026-project/hardware) | Host 기반 차량 제어, ESP32 firmware 및 RC Car 자동주차 |

## 🏗️ System Architecture

```
고정 카메라 (CCTV)
  ↓
YOLO / OpenCV 차량 인식 · Homography 좌표 변환      ← Backend
  ↓
Vehicle Pose (x, y, heading)
  ↓
주차 상태 관리 · RL(PPO) 기반 슬롯 배정             ← Backend
  ↓
Route / Waypoint · 주차 mission
  ↓
HostController 폐루프 제어 → ESP32 → 모터/서보      ← Hardware
  ↓
카메라 재관측 (closed loop)
  ↓
REST API / WebSocket
  ↓
실시간 대시보드                                     ← 이 저장소
```

이 저장소는 Backend가 제공하는 REST API와 `/ws/dashboard/` WebSocket을 받아, 차량 위치·주차면 상태·CCTV 검출 결과·이벤트를 실시간으로 시각화하는 **모니터링 계층**을 담당합니다.

## ✨ Key Features

현재 `main` 코드(`src/pages/DashboardPage.tsx`, `src/App.tsx`) 기준으로 실제 존재하는 기능만 정리했습니다.

- **단일 페이지 실시간 대시보드**: 이전에는 사이드바 + 라우터 기반 다중 페이지(차량관리/주차맵/경로/시뮬레이션)였으나, CV 추적·탐지와 무관한 페이지를 정리하고 대시보드 하나로 단순화했습니다(`App.tsx` 주석 참고). `react-router-dom` 의존성은 향후 페이지 추가를 위해 유지 중입니다.
- **CCTV / 검출 결과 시각화**: `CCTVCanvas` — 카메라 영상과 차량 검출 오버레이를 표시합니다.
- **주차장 지도**: `ParkingMapCanvas` — 슬롯 상태(빈자리/점유/예약)와 배정 경로를 실좌표 기반으로 그립니다.
- **차량 추적**: `TrackMapCanvas`, `useTracker`/`useDetections` 훅 — 추적 중인 차량 정보를 표시합니다.
- **실시간 텔레메트리**: WebSocket(`VITE_WS_URL`, 기본 `ws://localhost:8000/ws/dashboard/`)으로 차량 pose·이벤트를 수신하고, 연결이 끊기면 자동 재접속합니다.
- **Pose Stale 처리**: 관측이 일정 시간(`POSE_STALE_MS`) 이상 끊기면 "오래된 위치"로 표시하고, 더 오래(`POSE_DROP_MS`) 끊기면 지도에서 제거합니다 — 죽은 파이프라인이 정상처럼 보이는 것을 방지하기 위한 의도적 설계입니다.
- **REST 연동**: `src/api/parking.ts`를 통해 대시보드 상태, 슬롯, 거래(입출차) 기록, 차량 목록을 가져옵니다.

## Setup

```bash
npm install
npm run dev
```

로컬 앱은 기본적으로 `http://127.0.0.1:5173/` 에서 실행됩니다. Backend가 `http://localhost:8000`에 떠 있어야 정상 동작합니다.

## Build

```bash
npm run build
```

## 🧰 Tech Stack

React 18, TypeScript, Vite, React Router(의존성 유지, 현재는 단일 페이지), `lucide-react`(아이콘). 별도의 상태관리/차트 라이브러리는 사용하지 않습니다. (`package.json` 기준)

## `viz/` — Standalone 라우팅 데모

저장소에는 SPA와 별개로 `viz/` 디렉터리가 있습니다. Backend 라우팅 API를 Canvas로 시각화하는 독립 HTML/JS 데모(Catmull-Rom 스플라인 경로 보간, 물리 기반 차량 가감속)로, 빌드 단계가 필요 없습니다.

`viz/README.md`에 명시된 대로, 이 디렉터리는 **본격 SPA(위 대시보드)가 들어오기 전 임시 데모이자 Backend 라우팅 API의 시각적 회귀 도구**이며, 향후 정식 컴포넌트로 이식되면 archive될 예정입니다 — 현재 시스템의 핵심 아키텍처가 아니라 보조 데모/검증 도구로 이해하는 것이 정확합니다.

```bash
cd viz
python3 -m http.server 5173
```

## 상세 문서

- Backend REST/WebSocket 계약: [`hanium-2026-project/backend` README](https://github.com/hanium-2026-project/backend#main-apis)
- Backend 엔지니어링 문제 해결 사례: [`hanium-2026-project/backend/docs/engineering-challenges.md`](https://github.com/hanium-2026-project/backend/blob/main/docs/engineering-challenges.md)
- `viz/README.md` — standalone 데모 실행/배포 방법
