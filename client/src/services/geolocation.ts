/**
 * Browser Geolocation Service with Battery & Network Optimization
 */

export interface GeolocationFix {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  timestamp: string;
}

export interface GeolocationOptions {
  onLocation: (fix: GeolocationFix) => void;
  onError: (error: GeolocationPositionError | Error) => void;
  minDistanceMeters?: number;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class CampusGeolocationTracker {
  private watchId: number | null = null;
  private lastFix: GeolocationFix | null = null;
  private lastEmitTime: number = 0;
  private isTracking: boolean = false;

  public startTracking(options: GeolocationOptions): boolean {
    if (!('geolocation' in navigator)) {
      options.onError(new Error('Geolocation is not supported by your browser/device.'));
      return false;
    }

    if (
      typeof window !== 'undefined' &&
      !window.isSecureContext &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      options.onError(
        new Error(
          'Geolocation requires HTTPS when accessed over the public internet. Please access this application via https://'
        )
      );
      return false;
    }

    this.stopTracking();
    this.isTracking = true;

    const geoOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 1000
    };

    this.watchId = navigator.geolocation.watchPosition(
      (position: GeolocationPosition) => {
        if (!this.isTracking) return;

        const { latitude, longitude, accuracy, speed, heading } = position.coords;
        const now = Date.now();

        // Convert speed from m/s to km/h if present
        const speedKmh = speed !== null && speed >= 0 ? Math.round(speed * 3.6) : null;

        // Battery & Network Optimization:
        // Filter out insignificant moves (< 4 meters) unless 8 seconds have passed (heartbeat)
        if (this.lastFix) {
          const distanceMoved = calculateDistance(
            this.lastFix.latitude,
            this.lastFix.longitude,
            latitude,
            longitude
          );

          const timeElapsed = now - this.lastEmitTime;

          // If stationary and less than 8 seconds, skip redundant GPS ping
          if (distanceMoved < 4 && (speedKmh === null || speedKmh < 3) && timeElapsed < 8000) {
            return;
          }
        }

        const fix: GeolocationFix = {
          latitude,
          longitude,
          accuracy: Math.round(accuracy * 10) / 10,
          speed: speedKmh,
          heading: heading !== null && !isNaN(heading) ? Math.round(heading) : null,
          timestamp: new Date(position.timestamp).toISOString()
        };

        this.lastFix = fix;
        this.lastEmitTime = now;
        options.onLocation(fix);
      },
      (error: GeolocationPositionError) => {
        console.warn('Geolocation error:', error.message);
        options.onError(error);
      },
      geoOptions
    );

    return true;
  }

  public stopTracking() {
    this.isTracking = false;
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.lastFix = null;
  }

  public getTrackingStatus(): boolean {
    return this.isTracking;
  }
}

export const campusTracker = new CampusGeolocationTracker();
