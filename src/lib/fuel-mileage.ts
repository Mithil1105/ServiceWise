import type { FuelEntry } from '@/types';

export type FuelMileageAnomaly =
  | 'missing_previous_odometer'
  | 'negative_or_zero_distance'
  | 'non_positive_liters'
  | 'implausibly_high_mileage';

const IMPOSSIBLY_HIGH_KM_PER_L = 40; // Safety valve: values above this are almost certainly wrong.

type Numberish = string | number | null | undefined;
function toNumber(v: Numberish): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export interface FuelEstimatedPoint {
  entryId: string;
  previousEntryId: string | null;
  distanceKm: number;
  liters: number;
  kmPerL: number | null;
  valid: boolean;
  anomalies: FuelMileageAnomaly[];
}

export interface FuelFullTankSegment {
  startEntryId: string;
  endEntryId: string;
  distanceKm: number;
  litersPurchased: number;
  kmPerL: number | null;
  valid: boolean;
  anomalies: FuelMileageAnomaly[];
}

export interface FuelCarMileageSummary {
  carId: string;
  litersTotal: number;
  spendTotal: number;
  estimatedDistanceKm: number; // based on valid estimated-fill intervals
  costPerKm: number | null;
  avgPricePerL: number | null;

  estimatedLast: FuelEstimatedPoint | null; // last valid estimate point
  fullTankLast: FuelFullTankSegment | null; // last valid full-tank segment

  estimatedPoints: FuelEstimatedPoint[];
  fullTankSegments: FuelFullTankSegment[];
}

/**
 * Computes:
 * - Estimated mileage at each fill: based on odometer difference vs previous fill.
 * - Accurate full-tank mileage: between consecutive `is_full_tank=true` boundaries.
 *
 * Note: "Totals distance" is derived only from valid estimated-fill intervals to avoid double counting.
 */
export function computeFuelMileageForCar(entriesAsc: FuelEntry[]): FuelCarMileageSummary {
  const normalized = entriesAsc.map((e) => ({
    ...e,
    odometer_km: toNumber(e.odometer_km),
    fuel_liters: toNumber(e.fuel_liters),
    amount_inr: toNumber(e.amount_inr),
    filled_at: e.filled_at,
  }));

  const litersTotal = normalized.reduce((sum, e) => sum + e.fuel_liters, 0);
  const spendTotal = normalized.reduce((sum, e) => sum + e.amount_inr, 0);

  // Estimated points
  const estimated: FuelEstimatedPoint[] = [];
  for (let i = 1; i < normalized.length; i++) {
    const prev = normalized[i - 1];
    const cur = normalized[i];

    const distanceKm = cur.odometer_km - prev.odometer_km;
    const liters = cur.fuel_liters;
    const anomalies: FuelMileageAnomaly[] = [];

    if (distanceKm <= 0) anomalies.push('negative_or_zero_distance');
    if (liters <= 0) anomalies.push('non_positive_liters');

    let kmPerL: number | null = null;
    const valid = anomalies.length === 0;
    if (valid) {
      const raw = distanceKm / liters;
      if (raw > IMPOSSIBLY_HIGH_KM_PER_L) {
        anomalies.push('implausibly_high_mileage');
      }
      kmPerL = anomalies.includes('implausibly_high_mileage') ? null : raw;
    }

    estimated.push({
      entryId: cur.id,
      previousEntryId: prev.id,
      distanceKm,
      liters,
      kmPerL,
      valid,
      anomalies,
    });
  }

  const lastValidEstimated = [...estimated].reverse().find((p) => p.valid && p.kmPerL != null) ?? null;

  const estimatedDistanceKm = estimated
    .filter((p) => p.valid && p.kmPerL != null)
    .reduce((sum, p) => sum + p.distanceKm, 0);

  // Full-tank segments
  const fullTankSegments: FuelFullTankSegment[] = [];
  const fullTankIdxs = normalized
    .map((e, idx) => ({ e, idx }))
    .filter(({ e }) => !!e.is_full_tank)
    .map(({ idx }) => idx);

  for (let k = 0; k < fullTankIdxs.length - 1; k++) {
    const iStart = fullTankIdxs[k];
    const iEnd = fullTankIdxs[k + 1];

    const start = normalized[iStart];
    const end = normalized[iEnd];

    const distanceKm = end.odometer_km - start.odometer_km;
    // exclude starting boundary fill; include everything after it up to the end boundary fill
    const litersPurchased = normalized
      .slice(iStart + 1, iEnd + 1)
      .reduce((sum, x) => sum + x.fuel_liters, 0);

    const anomalies: FuelMileageAnomaly[] = [];
    if (distanceKm <= 0) anomalies.push('negative_or_zero_distance');
    if (litersPurchased <= 0) anomalies.push('non_positive_liters');

    let kmPerL: number | null = null;
    const valid = anomalies.length === 0;
    if (valid) {
      const raw = distanceKm / litersPurchased;
      if (raw > IMPOSSIBLY_HIGH_KM_PER_L) {
        anomalies.push('implausibly_high_mileage');
      }
      kmPerL = anomalies.includes('implausibly_high_mileage') ? null : raw;
    }

    fullTankSegments.push({
      startEntryId: start.id,
      endEntryId: end.id,
      distanceKm,
      litersPurchased,
      kmPerL,
      valid,
      anomalies,
    });
  }

  const lastValidFullTank = [...fullTankSegments].reverse().find((s) => s.valid && s.kmPerL != null) ?? null;

  const costPerKm = estimatedDistanceKm > 0 ? spendTotal / estimatedDistanceKm : null;
  const avgPricePerL = litersTotal > 0 ? spendTotal / litersTotal : null;

  return {
    carId: entriesAsc[0]?.car_id ?? '',
    litersTotal,
    spendTotal,
    estimatedDistanceKm,
    costPerKm,
    avgPricePerL,
    estimatedLast: lastValidEstimated,
    fullTankLast: lastValidFullTank,
    estimatedPoints: estimated,
    fullTankSegments: fullTankSegments,
  };
}

