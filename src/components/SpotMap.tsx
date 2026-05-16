import { MapPin } from "lucide-react";
import type { ParkingSpot, RoutePlan } from "../types";
import { StatusPill } from "./StatusPill";

interface SpotMapProps {
  spots: ParkingSpot[];
  selectedSpotId?: number;
  route?: RoutePlan | null;
  onSelectSpot?: (spot: ParkingSpot) => void;
  mapWidth?: number;  // mm 단위 주차장 실폭, 기본 1200
  mapHeight?: number; // mm 단위 주차장 실높이, 기본 1200
}

export function SpotMap({
  spots,
  selectedSpotId,
  route,
  onSelectSpot,
  mapWidth = 1200,
  mapHeight = 1200,
}: SpotMapProps) {
  // mm 좌표 → CSS % 변환. Y축은 CSS top이 위→아래라 반전 필요
  const toLeft = (x: number) => `${(x / mapWidth) * 100}%`;
  const toTop = (y: number) => `${((mapHeight - y) / mapHeight) * 100}%`;

  // SVG viewBox는 mm 좌표계 그대로 사용. Y반전은 mapHeight - y로 처리
  const svgY = (y: number) => mapHeight - y;

  return (
    <div className="map-surface">
      <div className="map-grid" aria-label="주차장 지도">

        {/* 경로 polyline — SVG 오버레이로 waypoint를 선으로 연결 */}
        {route && route.waypoints.length > 1 && (
          <svg
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
            preserveAspectRatio="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            <polyline
              points={route.waypoints.map((p) => `${p.x},${svgY(p.y)}`).join(" ")}
              fill="none"
              stroke="#d97706"
              strokeWidth="20"
              strokeDasharray="50,25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {route.waypoints.map((p, i) => (
              <circle
                key={`wp-${i}`}
                cx={p.x}
                cy={svgY(p.y)}
                r="16"
                fill="#d97706"
                stroke="#ffffff"
                strokeWidth="7"
              />
            ))}
          </svg>
        )}

        {/* 주차 칸 */}
        {spots.map((spot) => (
          <button
            key={spot.spot_id}
            className={`spot-node spot-${spot.status} ${selectedSpotId === spot.spot_id ? "is-selected" : ""}`}
            style={{ left: toLeft(spot.coord_x), top: toTop(spot.coord_y) }}
            title={`${spot.section} ${spot.status}`}
            onClick={() => onSelectSpot?.(spot)}
          >
            <MapPin size={16} aria-hidden="true" />
            <span>{spot.section}</span>
          </button>
        ))}
      </div>

      <div className="map-legend">
        <StatusPill status="vacant" />
        <StatusPill status="occupied" />
        <StatusPill status="reserved" />
        <StatusPill status="disabled" />
      </div>
    </div>
  );
}
