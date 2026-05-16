export type SpotStatus = "vacant" | "occupied" | "reserved" | "disabled";

export interface Vehicle {
  vehicle_id: number;
  license_plate: string;
  vehicle_type: string;
  is_registered: boolean;
  discount_type: string;
}

export interface ParkingLot {
  lot_id: number;
  name: string;
  address: string;
  total_capacity: number;
  lot_width: number;
  lot_height: number;
  vacant_count?: number;
  occupied_count?: number;
  reserved_count?: number;
}

export interface ParkingSpot {
  spot_id: number;
  lot_id: number;
  section: string;
  spot_type: string;
  status: SpotStatus;
  coord_x: number;
  coord_y: number;
}

export interface Camera {
  camera_id: number;
  lot_id: number;
  spot_id: number | null;
  location_desc: string;
  status: "online" | "offline" | "maintenance";
  last_heartbeat: string | null;
}

export interface EntryExit {
  transaction_id: number;
  vehicle_id: number;
  license_plate: string;
  spot_id: number;
  spot_label: string;
  entry_time: string;
  exit_time: string | null;
}

export interface Waypoint {
  x: number;
  y: number;
  label: string;
}

export interface RoutePlan {
  route_id: number;
  vehicle_id: number;
  target_spot_id: number;
  start_x: number;
  start_y: number;
  waypoints: Waypoint[];
  policy_name: string;
  created_at: string;
}

export interface DashboardState {
  lots: ParkingLot[];
  summary: {
    total_spots: number;
    vacant: number;
    occupied: number;
    reserved: number;
    disabled: number;
    cameras_online: number;
    cameras_offline: number;
  };
  cameras: Camera[];
  recent_transactions: Array<{
    transaction_id: number;
    license_plate: string;
    spot_id: number;
    entry_time: string;
    exit_time: string | null;
  }>;
}
