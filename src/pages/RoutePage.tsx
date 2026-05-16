import { Navigation2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { getVehicleRoute, listSpots, listVehicles } from "../api/parking";
import { SpotMap } from "../components/SpotMap";
import type { ParkingSpot, RoutePlan, Vehicle } from "../types";

export function RoutePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [vehicleId, setVehicleId] = useState<number | "">("");
  const [targetSpotId, setTargetSpotId] = useState<number | "">("");
  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([listVehicles(), listSpots()])
      .then(([vehicleData, spotData]) => {
        setVehicles(vehicleData);
        setSpots(spotData);
        setVehicleId(vehicleData[0]?.vehicle_id ?? "");
        setTargetSpotId(spotData[0]?.spot_id ?? "");
      })
      .catch((error) => setMessage(error.message));
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!vehicleId) return;
    getVehicleRoute(Number(vehicleId), targetSpotId ? Number(targetSpotId) : undefined)
      .then((data) => {
        setRoute(data);
        setMessage("경로 생성 완료");
      })
      .catch((error) => setMessage(error.message));
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>경로 추천</h1>
          <p>현재는 휴리스틱 waypoint를 사용하며 RL inference 모듈로 교체 가능한 구조입니다.</p>
        </div>
      </header>

      <section className="panel">
        <form className="simulation-form" onSubmit={submit}>
          <label>
            차량
            <select value={vehicleId} onChange={(event) => setVehicleId(Number(event.target.value))}>
              {vehicles.map((vehicle) => (
                <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                  {vehicle.license_plate}
                </option>
              ))}
            </select>
          </label>
          <label>
            목적 주차 칸
            <select value={targetSpotId} onChange={(event) => setTargetSpotId(Number(event.target.value))}>
              {spots.map((spot) => (
                <option key={spot.spot_id} value={spot.spot_id}>
                  {spot.section}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" type="submit">
            <Navigation2 size={17} aria-hidden="true" />
            조회
          </button>
        </form>
        {message && <p className="form-message">{message}</p>}
      </section>

      <section className="panel map-panel">
        <SpotMap spots={spots} route={route} selectedSpotId={route?.target_spot_id} />
      </section>
    </div>
  );
}
