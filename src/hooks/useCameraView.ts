import { useEffect, useState } from "react";
import { listCameras } from "../api/parking";
import type { CameraView } from "../types/cv";

/**
 * 백엔드 `/api/cameras/` 의 실제 카메라 목록을 가져온다.
 *
 * 어느 카메라에 지금 영상이 들어오는지는 서버가 `has_stream` 으로 알려준다.
 * 프론트가 카메라 ID 로 추측하면 파이프라인 설정(--stream-camera-id)이 바뀔 때
 * 화면이 거짓말을 하기 때문이다.
 *
 * 영상이 없는 카메라는 시뮬레이션으로 채우지 않고 kind:"none" 으로 둔다 —
 * 없는 영상을 있는 것처럼 보여주면 시연 중 상황을 오판한다.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";
const streamUrl = (id: number) => `${API_BASE}/cameras/${id}/stream/`;
// has_stream 은 Redis 프레임 키의 TTL 로 판정되므로 주기적으로 다시 물어야
// 파이프라인을 껐다 켠 것이 화면에 반영된다.
const REFRESH_MS = 5000;

function toCameraView(c: {
  camera_id: number;
  location_desc?: string;
  status?: string;
  has_stream?: boolean;
}): CameraView {
  return {
    id: c.camera_id,
    label: `CAM-${String(c.camera_id).padStart(2, "0")}`,
    location: c.location_desc || "위치 미상",
    source: c.has_stream ? { kind: "mjpeg", url: streamUrl(c.camera_id) } : { kind: "none" },
    status: (c.status as CameraView["status"]) ?? "online",
  };
}

/** 등록된 카메라 전체. 5초마다 갱신해 스트림 유무를 최신으로 유지한다. */
export function useCameras(): CameraView[] {
  const [cams, setCams] = useState<CameraView[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      listCameras()
        .then((list) => { if (alive) setCams(list.map(toCameraView)); })
        .catch(() => undefined);        // 백엔드가 죽어도 마지막 목록을 유지
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return cams;
}

/** 단일 카메라 메타. */
export function useCameraView(cameraId: number): CameraView | undefined {
  const cams = useCameras();
  return cams.find((c) => c.id === cameraId);
}
