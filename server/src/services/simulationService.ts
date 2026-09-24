import { dbHelper } from '../db/index.js';
import { socketEvents } from './socketService.js';
import { ETAService } from './etaService.js';
import { calculateBearing } from '../utils/haversine.js';

interface BusSimulationState {
  busId: string;
  tripId: string;
  routeId: string;
  stops: { latitude: number; longitude: number; sequence: number }[];
  currentStopIndex: number;
  targetStopIndex: number;
  fraction: number; // 0 to 1 between stops
}

class SimulationService {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private simulations: Map<string, BusSimulationState> = new Map();

  public isSimulating(): boolean {
    return this.isRunning;
  }

  public startSimulation(speedMultiplier: number = 1.0) {
    if (this.isRunning) return;

    this.isRunning = true;
    this.initSimulations();

    console.log('GPS Simulation started with speed multiplier:', speedMultiplier);

    this.intervalId = setInterval(() => {
      this.tick();
    }, 2500); // Update every 2.5 seconds
  }

  public stopSimulation() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.simulations.clear();
    console.log('GPS Simulation stopped.');
  }

  private initSimulations() {
    this.simulations.clear();

    const activeTrips = dbHelper.all(`
      SELECT t.id as tripId, t.bus_id as busId, t.route_id as routeId
      FROM trips t
      WHERE t.status = 'active'
    `);

    for (const trip of activeTrips) {
      const stops = dbHelper.all(`
        SELECT latitude, longitude, sequence
        FROM stops
        WHERE route_id = ?
        ORDER BY sequence ASC
      `, [trip.routeId]);

      if (stops.length >= 2) {
        this.simulations.set(trip.busId, {
          busId: trip.busId,
          tripId: trip.tripId,
          routeId: trip.routeId,
          stops,
          currentStopIndex: 0,
          targetStopIndex: 1,
          fraction: 0
        });
      }
    }
  }

  private tick() {
    if (!this.isRunning) return;

    const now = new Date().toISOString();

    for (const [busId, sim] of this.simulations.entries()) {
      // Step fraction forward
      sim.fraction += 0.08;

      if (sim.fraction >= 1.0) {
        sim.fraction = 0;
        sim.currentStopIndex = sim.targetStopIndex;
        sim.targetStopIndex = (sim.targetStopIndex + 1) % sim.stops.length;
      }

      const p1 = sim.stops[sim.currentStopIndex];
      const p2 = sim.stops[sim.targetStopIndex];

      // Linear interpolation
      const lat = p1.latitude + (p2.latitude - p1.latitude) * sim.fraction;
      const lng = p1.longitude + (p2.longitude - p1.longitude) * sim.fraction;
      const heading = calculateBearing(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
      const simulatedSpeed = Math.round(20 + Math.random() * 8); // 20-28 km/h

      // Save to database
      const locId = `sim-loc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      dbHelper.run(`
        INSERT INTO location_updates (id, trip_id, bus_id, latitude, longitude, speed, accuracy, heading, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [locId, sim.tripId, busId, lat, lng, simulatedSpeed, 3.5, heading, now]);

      // Calculate ETAs
      const { upcomingStops, nextStop } = ETAService.calculateRouteETAs(busId, lat, lng, simulatedSpeed);

      // Broadcast
      socketEvents.emitLocationUpdate({
        id: locId,
        busId,
        tripId: sim.tripId,
        latitude: lat,
        longitude: lng,
        speed: simulatedSpeed,
        accuracy: 3.5,
        heading,
        timestamp: now,
        upcomingStops,
        nextStop
      });
    }
  }
}

export const simulationService = new SimulationService();
