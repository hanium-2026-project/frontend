# Hanium Parking — Live Routing Viz

백엔드 라우팅 API를 캔버스로 시각화하는 standalone 데모. Catmull-Rom 스플라인 경로 보간 + 물리 기반 차량 가/감속 + 코너 lookahead 감속. 빌드 단계 없는 vanilla HTML/JS.

> 이 디렉토리는 본격 SPA가 들어오기 전 임시 데모이자 백엔드 라우팅 API의 시각적 회귀 도구다. 프론트 컴포넌트로 정식 이식되면 이 폴더는 archive 되거나 `examples/` 같은 위치로 옮겨질 예정.

## 로컬 실행

백엔드가 `http://localhost:8000`에 떠있어야 한다 (backend 레포의 README 참고).

```bash
cd viz
python3 -m http.server 5173
```

브라우저에서 http://localhost:5173 — backend의 `CORS_ALLOWED_ORIGINS`에 5173이 이미 허용돼있다.

## Backend URL 설정

기본값은 `http://localhost:8000/api`. 다른 백엔드를 가리키려면 세 가지 방법:

1. 페이지 상단의 **backend** 입력란에 URL을 적고 `저장` (localStorage에 보존)
2. URL 쿼리: `https://your-viz.vercel.app/?api=https://api.example.com/api`
3. 직접 localStorage: `localStorage.setItem('hanium_api_base', 'https://...')`

## Vercel 배포

### A. CLI로 한 번에

```bash
cd viz
npx vercel        # 첫 배포 (preview)
npx vercel --prod # 운영 배포
```

### B. GitHub 연결로 자동 배포

1. https://vercel.com/new
2. `hanium-2026-project/frontend` 레포 선택
3. **Root Directory** = `viz`
4. Framework Preset = **Other**
5. Build/Output 설정 비워둠 (정적 파일)
6. Deploy

push 시 자동 빌드/배포된다.

## 백엔드 CORS 주의

Vercel 배포 URL은 보통 `https://<project>-<hash>.vercel.app`. 그 origin에서 백엔드 API를 호출하려면 백엔드 `.env`의 `CORS_ALLOWED_ORIGINS`에 그 도메인을 추가해야 한다.

```bash
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,https://<your-viz>.vercel.app
```

## 키 기능

- **물리 모델**: `PHYS.maxSpeed=250mm/s`, `accel=180`, `decel=260` (mm/s²)
- **코너 감속**: 진행 거리 +180mm 윈도우 안의 최대 곡률 보고 미리 감속
- **도착 정지**: `v² = 2·a·d` 역산으로 정지점까지 부드럽게
- **출차 시각화**: 자동(8±2초 dwell) 또는 수동(Active Vehicles의 Exit 버튼)
- **충돌 시연**: 💥 4대 연속 입차 버튼 — 입/출차 차량이 aisle에서 마주치는 시점 확인용
