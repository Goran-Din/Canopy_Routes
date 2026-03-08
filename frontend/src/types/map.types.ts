export interface Client {
  id: string;
  tenant_id: string;
  client_name: string;
  service_address: string;
  city: string;
  state: string;
  zip: string;
  address_lat: number | null;
  address_lng: number | null;
  acres: number;
  acreage_confirmed: boolean;
  service_frequency: 'weekly' | 'biweekly';
  client_status: 'confirmed' | 'pending' | 'new' | 'at_risk' | 'inactive';
  geocode_status: 'success' | 'manual' | 'pending' | 'failed';
  annual_revenue: number | null;
  billing_accounts: number;
  snow_service: boolean;
  service_type: 'mow' | 'plow' | 'salt' | 'plow_salt';
  snow_priority: number | null;
  lot_size_sqft: number | null;
  assigned_route_id: string | null;
  assigned_route_label: string | null;
}

export interface RouteSummary {
  total_productive_hrs: number;
  total_drive_hrs: number;
  total_workday_hrs: number;
  capacity_status: 'green' | 'yellow' | 'orange' | 'red';
  stop_count: number;
  total_acres: number;
}

export interface RouteStop {
  id: string;
  route_id: string;
  client_id: string;
  client_name: string;
  sequence_order: number;
  mow_time_hrs: number;
  trim_time_hrs: number;
  productive_time_hrs: number;
  drive_time_from_prev_mins: number;
  acres: number;
  service_frequency: string;
  client_status: string;
  acreage_confirmed: boolean;
  address_lat: number | null;
  address_lng: number | null;
}

// ── Tools types ─────────────────────────────────────────────────

export interface ZoneFitResult {
  geocoded_address: string;
  zone: string;
  day: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  bearing_from_depot: number;
  distance_from_depot_mi: number;
  suggested_route: {
    id: string;
    route_label: string;
    day_of_week: string;
    current_workday_hrs: number;
    projected_workday_hrs: number;
    capacity_status: string;
    crew_code: string | null;
  };
  productive_time_addition_mins: number;
  drive_time_addition_mins: number;
  alternatives: Array<{
    zone: string;
    day: string;
    route_label: string;
    current_workday_hrs: number;
    projected_workday_hrs: number;
    capacity_status: string;
  }>;
  annual_revenue: number | null;
}

export interface RemovalImpactResult {
  before: {
    total_workday_hrs: number;
    capacity_status: string;
    stop_count: number;
    annual_revenue: number;
    total_drive_hrs: number;
  };
  after: {
    total_workday_hrs: number;
    capacity_status: string;
    stop_count: number;
    annual_revenue: number;
    total_drive_hrs: number;
  };
  revenue_delta: number;
  drive_time_saved_mins: number;
}

export interface RouteFStatus {
  stop_count: number;
  total_acres: number;
  status: 'safe' | 'approaching' | 'warning' | 'critical';
  threshold_stops: number;
  threshold_acres: number;
}

export interface RouteWithSummary {
  route: {
    id: string;
    route_label: string;
    day_of_week: string;
    zone_label: string | null;
    crew_id: string | null;
    depot_lat: number;
    depot_lng: number;
  };
  stops: RouteStop[];
  summary: RouteSummary;
}
