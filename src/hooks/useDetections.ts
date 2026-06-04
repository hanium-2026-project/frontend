import { useEffect, useState } from "react";
import type { Detection } from "../types/cv";

/**
 * 카메라 ID로 그 카메라의 현재 YOLO detection 배열을 가져오는 hook.
 *
 * 현재 카메라별 약간 다른 mock detection을 반환한다.
 * 미래에 실제 YOLO 백엔드가 들어오면 이 hook 내부만 다음 중 하나로 교체하면 됨:
 *   1. WebSocket: `ws://.../ws/cv/cameras/{id}/detections/` 구독해서 setDetections
 *   2. polling: GET `/api/cameras/{id}/detections/latest/`를 250ms마다
 *   3. MQTT 등
 *
 * UI 컴포넌트는 이 hook 시그너처(`(cameraId) => Detection[]`)만 신경 쓰면 된다.
 */

// 카메라별 mock detection — 시각적 차이를 위해 bbox 위치/개수 다르게.
const MOCK_DETECTIONS: Record<number, Detection[]> = {
  1: [
    {
      id: "cam1-d0",
      label: "CAR",
      confidence: 0.97,
      bbox: { x: 0.42, y: 0.48, width: 0.18, height: 0.18 },
      plate: "12가 3456",
      trackingId: "t-001",
    },
  ],
  2: [
    {
      id: "cam2-d0",
      label: "CAR",
      confidence: 0.92,
      bbox: { x: 0.55, y: 0.35, width: 0.20, height: 0.20 },
      plate: "34다 5678",
      trackingId: "t-002",
    },
  ],
  3: [
    {
      id: "cam3-d0",
      label: "CAR",
      confidence: 0.95,
      bbox: { x: 0.22, y: 0.45, width: 0.16, height: 0.16 },
      plate: "78나 9012",
      trackingId: "t-003",
    },
    {
      id: "cam3-d1",
      label: "CAR",
      confidence: 0.88,
      bbox: { x: 0.62, y: 0.52, width: 0.18, height: 0.18 },
      plate: "56라 7890",
      trackingId: "t-004",
    },
  ],
};

/**
 * 단일 카메라의 현재 detection 배열.
 * cameraId가 바뀌면 즉시 해당 카메라 detection으로 교체.
 */
export function useDetections(cameraId: number): Detection[] {
  const [detections, setDetections] = useState<Detection[]>(
    () => MOCK_DETECTIONS[cameraId] ?? [],
  );

  useEffect(() => {
    setDetections(MOCK_DETECTIONS[cameraId] ?? []);
    // 미래(WebSocket 예시):
    // const socket = new WebSocket(`${WS_BASE}/cameras/${cameraId}/detections/`);
    // socket.onmessage = (e) => setDetections(JSON.parse(e.data) as Detection[]);
    // return () => socket.close();
  }, [cameraId]);

  return detections;
}
