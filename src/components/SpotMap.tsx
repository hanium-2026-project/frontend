import { MapPin, Navigation } from "lucide-react";
import type { ParkingSpot, RoutePlan } from "../types";
import { StatusPill } from "./StatusPill";

// 맵 가장자리 여백 (mm). 입구/출구 등 y=0, y=1200 좌표가 잘리지 않도록 확보
const PAD = 100;

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
  const viewW = mapWidth + 2 * PAD;
  const viewH = mapHeight + 2 * PAD;

  // mm 좌표 → CSS %. 패딩을 더해 가장자리 요소가 잘리지 않도록 함
  const toLeft = (x: number) => `${((x + PAD) / viewW) * 100}%`;
  // Y축 반전: y=0이 하단(입구), y=mapHeight가 상단(출구)
  const toTop = (y: number) => `${((mapHeight + PAD - y) / viewH) * 100}%`;

  // SVG viewBox도 패딩 적용. Y반전은 mapHeight - y
  const svgY = (y: number) => mapHeight - y;

  return (
    <div className="map-surface">
      <div className="map-grid" aria-label="주차장 지도">

        {/* 경로 polyline — SVG 오버레이로 waypoint를 선으로 연결 */}
        {route && route.waypoints.length > 1 && (
          <svg
            viewBox={`${-PAD} ${-PAD} ${viewW} ${viewH}`}
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
          </svg>
        )}

        {/* 시작 지점 — 주차 칸과 같은 네모 박스 스타일 */}
        {route?.waypoints
          .filter((p) => p.label === "entry")
          .map((p, i) => (
            <div
              key={`entry-${i}`}
              className="spot-node spot-entry"
              style={{ left: toLeft(p.x), top: toTop(p.y) }}
              title="주차장 입구"
            >
              <Navigation size={16} aria-hidden="true" />
              <span>입구</span>
            </div>
          ))}

        {/* 중간 경유 waypoint 점 */}
        {route?.waypoints
          .filter((p) => p.label !== "entry")
          .map((p, i) => (
            <span
              key={`wp-${i}`}
              className="route-point"
              style={{ left: toLeft(p.x), top: toTop(p.y) }}
              title={p.label}
            />
          ))}

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
