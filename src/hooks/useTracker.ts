import { useEffect, useState } from "react";
import type { TrackedVehicle } from "../types/cv";

/**
 * 차량 추적 정보 스토어 hook.
 *
 * 미래 흐름:
 *   YOLO detection → DeepSORT(또는 다른 tracker)로 trackingId 부여 →
 *   영상 픽셀 → 주차장 좌표(mm) 변환 → TrackedVehicle 객체
 *
 * 미니맵 컴포넌트는 이 hook 결과만 받아서 (각 차량의 position + trail) 그리면 된다.
 *
 * 현재는 빈 배열을 반환하고, 인터페이스만 박아둔다.
 * 미래에 실제 추적이 들어오면 이 hook 내부를 다음으로 교체:
 *   - WebSocket `/ws/cv/tracking/` 구독 → setVehicles
 *   - 또는 backend `/api/tracking/active/` polling
 */

export function useTracker(): TrackedVehicle[] {
  const [vehicles, setVehicles] = useState<TrackedVehicle[]>([]);

  useEffect(() => {
    // 미래: WebSocket 구독 또는 polling
    setVehicles([]);
  }, []);

  return vehicles;
}

/**
 * 특정 차량(plate 또는 trackingId)만 추적하고 싶을 때.
 *
 * 미래에 "출입차 기록 클릭 → 그 차량을 추적" 기능에서 사용 예정.
 */
export function useTrackedVehicle(plateOrTrackingId: string | undefined): TrackedVehicle | undefined {
  const all = useTracker();
  if (!plateOrTrackingId) return undefined;
  return all.find(
    (v) => v.plate === plateOrTrackingId || v.trackingId === plateOrTrackingId,
  );
}
