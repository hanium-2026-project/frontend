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

// run_pipeline 이 Redis 로 흘린 프레임을 백엔드가 MJPEG 로 중계한다.
// 카메라는 한 프로세스만 열 수 있어서 웹서버가 장치를 직접 못 읽기 때문이다.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";
const streamUrl = (id: number) => `${API_BASE}/cameras/${id}/stream/`;

const MOCK_CAMERAS: CameraView[] = [
  {
    id: 1,
    label: "CAM-01",
    location: "천장캠",
    // 실물 천장 카메라. 파이프라인이 안 돌면 스트림이 안 열리고,
    // 그때는 CCTVCanvas 가 시뮬레이션 화면으로 자동 폴백한다.
    source: { kind: "mjpeg", url: streamUrl(1) },
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
