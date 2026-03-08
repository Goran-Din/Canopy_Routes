// api/src/services/profitability.service.ts
// Pure calculation functions for route profitability analysis

export interface CostConfig {
  laborRate: number;
  crewSize: number;
  fuelCostPerMile: number;
  equipmentCostPerHour: number;
  overheadRatePercent: number;
}

export interface RouteProfit {
  routeId: string;
  routeName: string;
  stopCount: number;
  annualRevenue: number;
  annualCost: number;
  annualProfit: number;
  marginPercent: number;
  status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
  weeklyHours: number;
  weeklyMiles: number;
}

const KM_TO_MILES = 0.621371;
const WEEKS_PER_SEASON = 30;

/**
 * Calculate annual cost for a route based on weekly hours/miles and cost config.
 */
export function calcRouteCost(
  weeklyHours: number,
  weeklyMiles: number,
  config: CostConfig
): number {
  const annualHours = weeklyHours * WEEKS_PER_SEASON;
  const annualMiles = weeklyMiles * WEEKS_PER_SEASON;

  const laborCost = annualHours * config.laborRate * config.crewSize;
  const fuelCost = annualMiles * config.fuelCostPerMile;
  const equipmentCost = annualHours * config.equipmentCostPerHour;
  const subtotal = laborCost + fuelCost + equipmentCost;
  const overhead = subtotal * (config.overheadRatePercent / 100);

  return subtotal + overhead;
}

/**
 * Determine margin status label from margin percentage.
 */
export function getMarginStatus(marginPercent: number): RouteProfit['status'] {
  if (marginPercent >= 45) return 'EXCELLENT';
  if (marginPercent >= 35) return 'GOOD';
  if (marginPercent >= 25) return 'FAIR';
  if (marginPercent >= 15) return 'POOR';
  return 'CRITICAL';
}

/**
 * Convert route distance in km to miles.
 */
export function kmToMiles(km: number): number {
  return km * KM_TO_MILES;
}
