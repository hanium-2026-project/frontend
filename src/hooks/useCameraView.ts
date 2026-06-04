import { useEffect, useState } from "react";
import type { CameraView } from "../types/cv";

/**
 * 카메라 ID로 카메라 메타데이터 + 영상 소스 정보를 가져오는 hook.
 *
 * 현재는 mock 데이터를 반환하지만, 미래에 backend `/api/cameras/{id}/` 응답을
 * 받아서 source.kind를 mjpeg/hls/webrtc로 교체하기만 하면 UI 컴포넌트는 그대로 동작.
 *
 * 백엔드 응답 shape는 CameraView 타입 그대로 맞추면 된다.
 */

const MOCK_CAMERAS: CameraView[] = [
  {
    id: 1,
    label: "CAM-01",
    location: "입구",
    source: { kind: "canvas-sim" },
    position: { x: 150, y: 0 },
    heading: Math.PI / 2,
    status: "online",
  },
  {
    id: 2,
    label: "CAM-02",
    location: "출구",
    source: { kind: "canvas-sim" },
    position: { x: 150, y: 1200 },
    heading: -Math.PI / 2,
    status: "online",
  },
  {
    id: 3,
    label: "CAM-03",
    location: "내부",
    source: { kind: "canvas-sim" },
    position: { x: 600, y: 600 },
    heading: 0,
    status: "online",
  },
];

/** 단일 카메라 메타. cameraId 변경 시 자동 재조회. */
export function useCameraView(cameraId: number): CameraView | undefined {
  const [view, setView] = useState<CameraView | undefined>(
    () => MOCK_CAMERAS.find((c) => c.id === cameraId),
  );

  useEffect(() => {
    // 미래: const ctrl = new AbortController();
    //       fetch(`/api/cameras/${cameraId}/`, { signal: ctrl.signal })
    //         .then(r => r.json()).then(setView);
    //       return () => ctrl.abort();
    setView(MOCK_CAMERAS.find((c) => c.id === cameraId));
  }, [cameraId]);

  return view;
}

/** 사용 가능한 카메라 목록. 필터 칩 렌더링에 사용. */
export function listAvailableCameras(): CameraView[] {
  // 미래: GET /api/cameras/
  return MOCK_CAMERAS;
}
