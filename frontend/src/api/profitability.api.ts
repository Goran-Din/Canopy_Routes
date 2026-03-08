import { http } from './http';

export interface RouteProfit {
  routeId: string;
  routeName: string;
  dayOfWeek: string;
  stopCount: number;
  annualRevenue: number;
  annualCost: number;
  annualProfit: number;
  marginPercent: number;
  status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
  weeklyHours: number;
  weeklyMiles: number;
}

export interface ProfitabilitySummary {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgMarginPercent: number;
  bestRoute: RouteProfit | null;
  routesNeedingReview: number;
}

export interface ProfitabilityData {
  routes: RouteProfit[];
  summary: ProfitabilitySummary;
}

export interface CostConfig {
  id: string;
  laborRate: number;
  crewSize: number;
  fuelCostPerMile: number;
  equipmentCostPerHour: number;
  overheadRatePercent: number;
}

export async function fetchProfitability(seasonId: string): Promise<ProfitabilityData> {
  const res = await http.get('/v1/profitability/routes', { params: { season_id: seasonId } });
  return res.data.data;
}

export async function fetchCostConfig(): Promise<CostConfig> {
  const res = await http.get('/v1/cost-config');
  return res.data.data;
}

export async function updateCostConfig(config: Omit<CostConfig, 'id'>): Promise<CostConfig> {
  const res = await http.put('/v1/cost-config', config);
  return res.data.data;
}
