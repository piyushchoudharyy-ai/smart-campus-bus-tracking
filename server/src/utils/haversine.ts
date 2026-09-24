/**
 * Haversine formula and GPS utilities for Campus Bus Tracking System
 */

const EARTH_RADIUS_METERS = 6371000; // Earth's mean radius in meters
const DEFAULT_CAMPUS_SPEED_KMH = 22; // Average campus bus speed in km/h

/**
 * Converts degrees to radians
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates distance between two coordinates in meters
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates distance in kilometers
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return calculateDistanceMeters(lat1, lon1, lat2, lon2) / 1000;
}

/**
 * Calculates Estimated Time of Arrival (ETA) in minutes
 * @param distanceKm Distance to stop in kilometers
 * @param currentSpeedKmh Current reported GPS speed in km/h (if available and > 5 km/h)
 * @param stopsBetween Number of intermediate stops to factor in dwell time (approx 45 sec per stop)
 */
export function calculateEtaMinutes(
  distanceKm: number,
  currentSpeedKmh: number | null | undefined,
  stopsBetween: number = 0
): number {
  // Use current speed if moving, otherwise fallback to standard campus transit speed
  const effectiveSpeed =
    currentSpeedKmh && currentSpeedKmh > 5
      ? Math.min(Math.max(currentSpeedKmh, 10), 45) // clamp between 10 and 45 km/h
      : DEFAULT_CAMPUS_SPEED_KMH;

  const transitHours = distanceKm / effectiveSpeed;
  const transitMinutes = transitHours * 60;

  // Add 45 seconds (0.75 min) per intermediate stop
  const dwellTimeMinutes = stopsBetween * 0.75;

  const totalMinutes = Math.round(transitMinutes + dwellTimeMinutes);
  return Math.max(1, totalMinutes); // minimum 1 minute ETA
}

/**
 * Calculates bearing / heading in degrees from point 1 to point 2
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const y = Math.sin(toRadians(lon2 - lon1)) * Math.cos(toRadians(lat2));
  const x =
    Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
    Math.sin(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.cos(toRadians(lon2 - lon1));
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Checks if bus is approaching a stop (within 350 meters)
 */
export function isApproachingStop(
  busLat: number,
  busLon: number,
  stopLat: number,
  stopLon: number,
  thresholdMeters: number = 350
): boolean {
  const dist = calculateDistanceMeters(busLat, busLon, stopLat, stopLon);
  return dist <= thresholdMeters;
}
