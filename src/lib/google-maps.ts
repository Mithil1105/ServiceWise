/**
 * Calculate distance between two locations using free APIs
 * Uses OpenStreetMap Nominatim (free geocoding) + Haversine formula (completely free)
 * No API key required!
 */

export interface DistanceResult {
  distance: number; // in kilometers
  duration: number; // in minutes
  error?: string;
}

/**
 * Geocode address using OpenStreetMap Nominatim (completely free, no API key needed)
 */
async function geocodeAddress(address: string): Promise<[number, number] | null> {
  try {
    // Add a small delay to respect Nominatim's rate limit (1 request per second)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ServiceWise/1.0', // Required by Nominatim
      },
    });
    
    const data = await response.json();
    
    if (data && data[0]) {
      return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Calculate distance using Haversine formula (straight-line distance)
 * This is completely free but less accurate than road distance
 */
function calculateDistanceHaversine(
  origin: [number, number], // [lon, lat]
  destination: [number, number] // [lon, lat]
): DistanceResult {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (destination[1] - origin[1]) * Math.PI / 180;
  const dLon = (destination[0] - origin[0]) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(origin[1] * Math.PI / 180) *
      Math.cos(destination[1] * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  // Estimate duration (assuming average speed of 50 km/h)
  const duration = (distance / 50) * 60;
  
  return {
    distance: Math.round(distance),
    duration: Math.round(duration),
  };
}

/**
 * Main function to calculate distance
 * Uses OpenStreetMap Nominatim (free geocoding) + Haversine formula (completely free)
 */
export async function calculateDistance(
  origin: string,
  destination: string
): Promise<DistanceResult> {
  try {
    // Geocode both addresses
    const originCoords = await geocodeAddress(origin);
    const destCoords = await geocodeAddress(destination);
    
    if (!originCoords || !destCoords) {
      return {
        distance: 0,
        duration: 0,
        error: 'Could not find one or both locations. Please check the addresses and try again.',
      };
    }
    
    // Calculate distance using Haversine formula
    return calculateDistanceHaversine(originCoords, destCoords);
  } catch (error) {
    return {
      distance: 0,
      duration: 0,
      error: error instanceof Error ? error.message : 'Failed to calculate distance',
    };
  }
}
