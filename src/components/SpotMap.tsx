import { MapPin } from "lucide-react";
import type { ParkingSpot, RoutePlan } from "../types";
import { StatusPill } from "./StatusPill";

interface SpotMapProps {
  spots: ParkingSpot[];
  selectedSpotId?: number;
  route?: RoutePlan | null;
  onSelectSpot?: (spot: ParkingSpot) => void;
}

export function SpotMap({ spots, selectedSpotId, route, onSelectSpot }: SpotMapProps) {
  const maxX = Math.max(4, ...spots.map((spot) => spot.coord_x));
  const maxY = Math.max(3, ...spots.map((spot) => spot.coord_y));

  return (
    <div className="map-surface">
      <div className="map-grid" aria-label="주차장 지도">
        {spots.map((spot) => {
          const left = `${(spot.coord_x / (maxX + 1)) * 100}%`;
          const top = `${(spot.coord_y / (maxY + 1)) * 100}%`;
          return (
            <button
              key={spot.spot_id}
              className={`spot-node spot-${spot.status} ${selectedSpotId === spot.spot_id ? "is-selected" : ""}`}
              style={{ left, top }}
              title={`${spot.section} ${spot.status}`}
              onClick={() => onSelectSpot?.(spot)}
            >
              <MapPin size={16} aria-hidden="true" />
              <span>{spot.section}</span>
            </button>
          );
        })}
        {route?.waypoints.map((point, index) => (
          <span
            key={`${point.label}-${index}`}
            className="route-point"
            style={{
              left: `${(point.x / (maxX + 1)) * 100}%`,
              top: `${(point.y / (maxY + 1)) * 100}%`
            }}
            title={point.label}
          />
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
