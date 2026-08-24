import { apiClient } from "./client";
import type { Camera, DashboardState, EntryExit, ParkingLot, ParkingSpot, RoutePlan, Vehicle } from "../types";

export function listVehicles() {
  return apiClient.get<Vehicle[]>("/vehicles/");
}

export function createVehicle(vehicle: Omit<Vehicle, "vehicle_id">) {
  return apiClient.post<Vehicle>("/vehicles/", vehicle);
}

export function updateVehicle(vehicleId: number, vehicle: Partial<Vehicle>) {
  return apiClient.patch<Vehicle>(`/vehicles/${vehicleId}/`, vehicle);
}

export function listLots() {
  return apiClient.get<ParkingLot[]>("/parking-lots/");
}

export function listSpots() {
  return apiClient.get<ParkingSpot[]>("/parking-spots/");
}

export function updateSpotStatus(spotId: number, status: ParkingSpot["status"]) {
  return apiClient.patch<ParkingSpot>(`/parking-spots/${spotId}/set-status/`, { status });
}

export function enterVehicle(payload: { license_plate: string; vehicle_type: string; lot_id?: number }) {
  return apiClient.post<{ transaction: EntryExit; route: RoutePlan; recommended_spot: ParkingSpot }>("/entry/", payload);
}

export function exitVehicle(payload: { license_plate: string }) {
  return apiClient.post<{ transaction: EntryExit }>("/exit/", payload);
}

export function recommendSpot(vehicleType: string, lotId?: number) {
  const params = new URLSearchParams({ vehicle_type: vehicleType });
  if (lotId) params.set("lot_id", String(lotId));
  return apiClient.get<{ recommended_spot: ParkingSpot }>(`/recommendations/spots/?${params.toString()}`);
}

export function getVehicleRoute(vehicleId: number, targetSpotId?: number) {
  const params = new URLSearchParams();
  if (targetSpotId) params.set("target_spot_id", String(targetSpotId));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiClient.get<RoutePlan>(`/vehicles/${vehicleId}/route/${suffix}`);
}

export function listCameras() {
  return apiClient.get<Camera[]>("/cameras/");
}

/** 입출차 거래 전체. dashboard.recent_transactions 와 달리 spot_label 과
 *  로컬 타임존이 포함돼 있어 화면 표시에 그대로 쓸 수 있다. */
export function listTransactions() {
  return apiClient.get<EntryExit[]>("/transactions/");
}

export function getDashboard() {
  return apiClient.get<DashboardState>("/dashboard/");
}
