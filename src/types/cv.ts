/**
 * CV(컴퓨터 비전) 도메인 타입.
 *
 * 현재 mock 데이터로 채워지지만, 미래에 실제 YOLO 백엔드 / WebSocket 스트림 /
 * 직접 카메라 영상으로 교체될 때 컴포넌트 측 코드를 안 바꿔도 되도록
 * "수정 안 할 인터페이스"로 미리 정의해둔다.
 *
 * 백엔드 응답 / WS payload 모양만 이 타입에 맞추면 됨.
 */

// ──────────────────────────────────────────────────────────────────────────
// Bounding box & Detection
// ──────────────────────────────────────────────────────────────────────────

/**
 * 정규화된 bounding box (0..1 좌표 — 영상 해상도와 무관).
 *
 * 백엔드는 픽셀 좌표로 줄 수도 있는데, 그 경우 frontend가 영상 크기로 나눠서
 * 정규화한 뒤 넘기는 게 일관성에 좋다. (정규화하면 영상 리사이즈에도 강함)
 */
export interface BoundingBox {
  /** 좌상단 x (0..1) */
  x: number;
  /** 좌상단 y (0..1) */
  y: number;
  /** width (0..1) */
  width: number;
  /** height (0..1) */
  height: number;
}

/**
 * YOLO 한 프레임의 단일 객체 검출 결과.
 *
 * 백엔드/WS가 보내는 형식 예시:
 * {
 *   "id": "f1234-d0",
 *   "label": "car",
 *   "confidence": 0.97,
 *   "bbox": { "x": 0.45, "y": 0.45, "width": 0.18, "height": 0.18 },
 *   "plate": "12가3456",
 *   "trackingId": "t-001"
 * }
 */
export interface Detection {
  /** detection ID (프레임 + 인덱스 조합 등 unique) */
  id: string;
  /** 클래스 라벨 — "car", "truck", "person" 등 */
  label: string;
  /** 신뢰도 (0..1) */
  confidence: number;
  /** 정규화된 bbox */
  bbox: BoundingBox;
  /** 번호판 인식 결과 — OCR 후 채워짐. 없으면 미인식 */
  plate?: string;
  /**
   * 객체 추적 ID — 프레임 간 동일 객체를 잇기 위한 키 (DeepSORT 등).
   * 이 ID로 미니맵에서 추적 경로를 그릴 수 있다.
   */
  trackingId?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Tracking
// ──────────────────────────────────────────────────────────────────────────

/**
 * 차량 한 대의 추적 기록.
 *
 * 미니맵 컴포넌트는 이 타입만 알면 됨. 좌표 변환(영상 픽셀 → 주차장 mm)은
 * hook 또는 백엔드에서 처리해서 이 모양으로 넘긴다.
 */
export interface TrackedVehicle {
  trackingId: string;
  plate?: string;
  /** 현재 위치 — 주차장 좌표계 (mm) */
  position: { x: number; y: number };
  /**
   * 최근 위치 history — 미니맵에 꼬리(trail)를 그리고 싶을 때 사용.
   * t는 epoch ms.
   */
  trail?: Array<{ x: number; y: number; t: number }>;
  /** 마지막 관측 시각 (ISO 8601) */
  lastSeenAt: string;
  /** 마지막으로 추적된 카메라 ID */
  cameraId?: number;
  /**
   * 차량 진행 방향 (도, 0~360°). backend telemetry payload 의 미래 필드.
   * 없으면 undefined — Canvas는 회전 없이 그림.
   */
  headingDeg?: number;
  /**
   * 주차 진행 단계 (예: "APPROACHING" / "ALIGNING" / "PARKED").
   * backend telemetry payload 의 미래 필드. UI 뱃지 표기용.
   */
  parkingPhase?: string;
  /** 현재 상태 문자열 (예: "moving", "arrived"). protocol.VehicleTelemetryMessage.status */
  status?: string;
  /** 목표 spot ID (있으면 미니맵에 하이라이트) */
  targetSpotId?: number | null;
  /**
   * heading 을 무엇으로 구했는지 — FRONT_CUSHION | TRAJECTORY | LAST_VALID.
   * FRONT_CUSHION 이 아니면 마커를 놓치고 과거값으로 버티는 중이라는 뜻이라,
   * 인지 문제를 현장에서 바로 판별하려면 화면에 보여야 한다.
   */
  headingSource?: string;
  /**
   * 최근 pose 가 끊겼는지 (프론트에서 수신 시각으로 판정).
   * 파이프라인이 멈췄는데 마지막 위치가 살아있는 것처럼 보이면 안 된다.
   */
  stale?: boolean;
}

// ──────────────────────────────────────────────────────────────────────────
// Camera
// ──────────────────────────────────────────────────────────────────────────

/**
 * 영상 소스 종류.
 * - `canvas-sim`: 현재 사용중인 Canvas 시뮬레이션 (mock)
 * - `mjpeg`: Motion JPEG 스트림 URL (일반 IP 카메라)
 * - `hls`: HLS 스트림 URL (.m3u8)
 * - `webrtc`: WebRTC peer 연결 (저지연)
 *
 * 미래에 새 종류 추가될 수 있으므로 discriminated union 형태.
 */
export type CameraSource =
  | { kind: "canvas-sim" }
  // 카메라는 등록돼 있지만 지금 들어오는 영상이 없는 상태.
  // 시뮬레이션으로 채우면 없는 영상을 있는 것처럼 보여주게 된다.
  | { kind: "none" }
  | { kind: "mjpeg"; url: string }
  | { kind: "hls"; url: string }
  | { kind: "webrtc"; signalingUrl: string };

/**
 * CCTV 카메라 한 대의 메타데이터 + 영상 소스.
 *
 * UI는 이 타입만 알면 됨. 실제 영상이 들어와도 source.kind만 바뀌면
 * CCTVCanvas/Video 컴포넌트 내부가 그에 맞춰 분기.
 */
export interface CameraView {
  id: number;
  /** "CAM-01" 같은 표시 라벨 */
  label: string;
  /** "입구", "출구 B", "지하 1층" 같은 사람용 위치 설명 */
  location: string;
  source: CameraSource;
  /** 주차장 좌표계 기준 카메라 위치 (미니맵 표시 / 좌표 변환용) */
  position?: { x: number; y: number };
  /** 카메라 시야 방향 (라디안, 0=동쪽). 미니맵에 cone 그릴 때 사용. */
  heading?: number;
  /** 활성 여부 — offline이면 UI에 표시 */
  status?: "online" | "offline" | "maintenance";
}
