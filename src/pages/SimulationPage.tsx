import { LogIn, LogOut, Search } from "lucide-react";
import { FormEvent, useState } from "react";
import { enterVehicle, exitVehicle, recommendSpot } from "../api/parking";
import { SpotMap } from "../components/SpotMap";
import { StatusPill } from "../components/StatusPill";
import type { ParkingSpot, RoutePlan } from "../types";

export function SimulationPage() {
  const [licensePlate, setLicensePlate] = useState("12가3456");
  const [vehicleType, setVehicleType] = useState("sedan");
  const [recommended, setRecommended] = useState<ParkingSpot | null>(null);
  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [message, setMessage] = useState("");

  const handleRecommend = () => {
    recommendSpot(vehicleType, 1)
      .then((data) => {
        setRecommended(data.recommended_spot);
        setMessage("추천 완료");
      })
      .catch((error) => setMessage(error.message));
  };

  const handleEntry = (event: FormEvent) => {
    event.preventDefault();
    enterVehicle({ license_plate: licensePlate, vehicle_type: vehicleType, lot_id: 1 })
      .then((data) => {
        setRecommended(data.recommended_spot);
        setRoute(data.route);
        setMessage(`입차 완료: ${data.recommended_spot.section}`);
      })
      .catch((error) => setMessage(error.message));
  };

  const handleExit = () => {
    exitVehicle({ license_plate: licensePlate })
      .then((data) => {
        setMessage(`출차 완료: transaction ${data.transaction.transaction_id}`);
      })
      .catch((error) => setMessage(error.message));
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>입출차 시뮬레이션</h1>
          <p>차량 번호를 입력해 추천, 입차, 출차 흐름을 검증합니다.</p>
        </div>
      </header>

      <section className="panel">
        <form className="simulation-form" onSubmit={handleEntry}>
          <label>
            차량 번호
            <input value={licensePlate} onChange={(event) => setLicensePlate(event.target.value)} required />
          </label>
          <label>
            차량 유형
            <select value={vehicleType} onChange={(event) => setVehicleType(event.target.value)}>
              <option value="sedan">sedan</option>
              <option value="suv">suv</option>
              <option value="compact">compact</option>
              <option value="ev">ev</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
          <button type="button" className="secondary-button" onClick={handleRecommend}>
            <Search size={17} aria-hidden="true" />
            추천
          </button>
          <button type="submit" className="primary-button">
            <LogIn size={17} aria-hidden="true" />
            입차
          </button>
          <button type="button" className="danger-button" onClick={handleExit}>
            <LogOut size={17} aria-hidden="true" />
            출차
          </button>
        </form>
        {message && <p className="form-message">{message}</p>}
      </section>

      <div className="content-grid two">
        <section className="panel">
          <h2>추천 결과</h2>
          {recommended ? (
            <div className="recommend-card">
              <strong>{recommended.section}</strong>
              <span>{recommended.spot_type}</span>
              <StatusPill status={recommended.status} />
            </div>
          ) : (
            <p className="muted">추천 요청 후 주차 칸이 표시됩니다.</p>
          )}
        </section>
        <section className="panel">
          <h2>추천 경로</h2>
          {route ? <SpotMap spots={[recommended!]} route={route} selectedSpotId={recommended?.spot_id} /> : <p className="muted">입차 후 경로가 생성됩니다.</p>}
        </section>
      </div>
    </div>
  );
}
