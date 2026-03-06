/**
 * Compute estimated KM from raw pickup–drop distance based on trip type.
 * - Outstation: distance × 2 + 75
 * - One-way pickup/drop: distance + 60
 * - Other (local, airport, custom): raw distance
 */
export function getEstimatedKmFromDistance(
  rawDistanceKm: number,
  tripType: string
): { estimatedKm: number; formulaLabel: string } {
  const rounded = Math.round(rawDistanceKm);
  const type = (tripType || '').toLowerCase();

  if (type === 'outstation') {
    const estimated = rounded * 2 + 75;
    return {
      estimatedKm: estimated,
      formulaLabel: `Pickup–drop: ${rounded} km → Outstation (×2 + 75): ${estimated} km`,
    };
  }

  if (type === 'oneway_pickup_drop') {
    const estimated = rounded + 60;
    return {
      estimatedKm: estimated,
      formulaLabel: `Pickup–drop: ${rounded} km → One-way (+60): ${estimated} km`,
    };
  }

  return {
    estimatedKm: rounded,
    formulaLabel: `Pickup–drop: ${rounded} km (used as estimated km)`,
  };
}
