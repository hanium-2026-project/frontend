import { Plus, Save } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { createVehicle, listVehicles, updateVehicle } from "../api/parking";
import type { Vehicle } from "../types";

const emptyForm = {
  license_plate: "",
  vehicle_type: "sedan",
  is_registered: true,
  discount_type: "none"
};

export function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");

  const refresh = () => listVehicles().then(setVehicles).catch((error) => setMessage(error.message));

  useEffect(() => {
    refresh();
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    createVehicle(form)
      .then((vehicle) => {
        setSelected(vehicle);
        setForm(emptyForm);
        setMessage("등록 완료");
        refresh();
      })
      .catch((error) => setMessage(error.message));
  };

  const saveSelected = () => {
    if (!selected) return;
    updateVehicle(selected.vehicle_id, selected)
      .then((vehicle) => {
        setSelected(vehicle);
        setMessage("수정 완료");
        refresh();
      })
      .catch((error) => setMessage(error.message));
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <h1>차량 관리</h1>
          <p>차량 등록 정보와 할인 유형을 관리합니다.</p>
        </div>
      </header>

      <div className="content-grid two">
        <section className="panel">
          <div className="panel-heading">
            <h2>차량 목록</h2>
          </div>
          <div className="vehicle-list">
            {vehicles.map((vehicle) => (
              <button
                key={vehicle.vehicle_id}
                className={selected?.vehicle_id === vehicle.vehicle_id ? "active vehicle-row" : "vehicle-row"}
                onClick={() => setSelected(vehicle)}
              >
                <span>{vehicle.license_plate}</span>
                <strong>{vehicle.vehicle_type}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>차량 등록</h2>
          </div>
          <form className="form-grid" onSubmit={submit}>
            <label>
              차량 번호
              <input value={form.license_plate} onChange={(event) => setForm({ ...form, license_plate: event.target.value })} required />
            </label>
            <label>
              차량 유형
              <select value={form.vehicle_type} onChange={(event) => setForm({ ...form, vehicle_type: event.target.value })}>
                <option value="sedan">sedan</option>
                <option value="suv">suv</option>
                <option value="compact">compact</option>
                <option value="ev">ev</option>
                <option value="disabled">disabled</option>
              </select>
            </label>
            <label>
              할인 유형
              <select value={form.discount_type} onChange={(event) => setForm({ ...form, discount_type: event.target.value })}>
                <option value="none">none</option>
                <option value="compact">compact</option>
                <option value="ev">ev</option>
                <option value="disabled">disabled</option>
                <option value="resident">resident</option>
              </select>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={form.is_registered} onChange={(event) => setForm({ ...form, is_registered: event.target.checked })} />
              등록 차량
            </label>
            <button type="submit" className="primary-button">
              <Plus size={17} aria-hidden="true" />
              등록
            </button>
          </form>

          {selected && (
            <div className="selected-editor">
              <h3>차량 상세</h3>
              <label>
                차량 번호
                <input value={selected.license_plate} onChange={(event) => setSelected({ ...selected, license_plate: event.target.value })} />
              </label>
              <label>
                차량 유형
                <select value={selected.vehicle_type} onChange={(event) => setSelected({ ...selected, vehicle_type: event.target.value })}>
                  <option value="sedan">sedan</option>
                  <option value="suv">suv</option>
                  <option value="compact">compact</option>
                  <option value="ev">ev</option>
                  <option value="disabled">disabled</option>
                </select>
              </label>
              <button className="primary-button" onClick={saveSelected}>
                <Save size={17} aria-hidden="true" />
                저장
              </button>
            </div>
          )}
          {message && <p className="form-message">{message}</p>}
        </section>
      </div>
    </div>
  );
}
