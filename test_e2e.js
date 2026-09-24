/**
 * End-to-End Integration Verification Script
 */

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('🧪 Starting End-to-End System Verification...\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  let adminToken = '';
  let driverToken = '';
  let studentToken = '';

  // 1. Health check
  await test('1. Backend Health Check', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    if (data.status !== 'healthy') throw new Error('Health check returned non-healthy status');
  });

  // 2. Auth - Admin Login
  await test('2. Admin Authentication', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@campus.edu', password: 'admin123' })
    });
    const data = await res.json();
    if (!data.success || !data.token || data.user.role !== 'admin') {
      throw new Error(`Admin login failed: ${JSON.stringify(data)}`);
    }
    adminToken = data.token;
  });

  // 3. Auth - Driver Login
  await test('3. Driver Authentication', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'driver1@campus.edu', password: 'driver123' })
    });
    const data = await res.json();
    if (!data.success || !data.token || data.user.role !== 'driver') {
      throw new Error(`Driver login failed: ${JSON.stringify(data)}`);
    }
    driverToken = data.token;
  });

  // 4. Auth - Student Login
  await test('4. Student Authentication', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@campus.edu', password: 'student123' })
    });
    const data = await res.json();
    if (!data.success || !data.token || data.user.role !== 'student') {
      throw new Error(`Student login failed: ${JSON.stringify(data)}`);
    }
    studentToken = data.token;
  });

  // 5. Fetch Buses
  await test('5. Fetch Buses with Live Enriched Telemetry', async () => {
    const res = await fetch(`${BASE_URL}/buses`);
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data) || data.data.length < 3) {
      throw new Error('Failed to retrieve buses');
    }
  });

  // 6. Fetch Routes & Stops
  await test('6. Fetch Routes with Sequence of Stops', async () => {
    const res = await fetch(`${BASE_URL}/routes`);
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data) || data.data.length < 2) {
      throw new Error('Failed to retrieve routes');
    }
    if (!data.data[0].stops || data.data[0].stops.length === 0) {
      throw new Error('Routes do not have stops attached');
    }
  });

  // 7. Active Trips & Live ETA
  await test('7. Active Trips with Calculated ETAs', async () => {
    const res = await fetch(`${BASE_URL}/trips/active`);
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data)) {
      throw new Error('Failed to retrieve active trips');
    }
    if (data.data.length > 0) {
      const first = data.data[0];
      if (!first.upcomingStops || !first.nextStop) {
        throw new Error('Active trip missing ETA calculations');
      }
    }
  });

  // 8. Single Real-Time Location Update (Driver GPS)
  await test('8. Live Location GPS Update via Driver API', async () => {
    const res = await fetch(`${BASE_URL}/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`
      },
      body: JSON.stringify({
        busId: 'bus-101',
        tripId: 'trip-active-101',
        latitude: 12.9362,
        longitude: 77.6080,
        speed: 25.0,
        accuracy: 3.5,
        heading: 60.0,
        timestamp: new Date().toISOString()
      })
    });
    const data = await res.json();
    if (!data.success || !data.data || !data.data.nextStop) {
      throw new Error(`Location update failed: ${JSON.stringify(data)}`);
    }
  });

  // 9. Offline-First Batch Sync
  await test('9. Offline-First Batch Synchronization (IndexedDB to Server)', async () => {
    const now = Date.now();
    const queuedUpdates = [
      {
        busId: 'bus-101',
        tripId: 'trip-active-101',
        latitude: 12.9365,
        longitude: 77.6083,
        speed: 24.0,
        accuracy: 4.0,
        heading: 62.0,
        timestamp: new Date(now - 15000).toISOString()
      },
      {
        busId: 'bus-101',
        tripId: 'trip-active-101',
        latitude: 12.9368,
        longitude: 77.6086,
        speed: 22.0,
        accuracy: 3.8,
        heading: 65.0,
        timestamp: new Date(now - 8000).toISOString()
      },
      {
        busId: 'bus-101',
        tripId: 'trip-active-101',
        latitude: 12.9372,
        longitude: 77.6090,
        speed: 20.0,
        accuracy: 3.2,
        heading: 70.0,
        timestamp: new Date().toISOString()
      }
    ];

    const res = await fetch(`${BASE_URL}/location/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`
      },
      body: JSON.stringify({ updates: queuedUpdates })
    });
    const data = await res.json();
    if (!data.success || data.processedCount === 0) {
      throw new Error(`Batch sync failed: ${JSON.stringify(data)}`);
    }
  });

  // 10. Occupancy Update
  await test('10. Driver Occupancy Passenger Count Update', async () => {
    const res = await fetch(`${BASE_URL}/occupancy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`
      },
      body: JSON.stringify({
        tripId: 'trip-active-101',
        passengerCount: 28
      })
    });
    const data = await res.json();
    if (!data.success || data.data.passengerCount !== 28) {
      throw new Error(`Occupancy update failed: ${JSON.stringify(data)}`);
    }
  });

  // 11. Emergency Protocol Dispatch & Resolution
  let createdEmergencyId = '';
  await test('11. Emergency System Alert Transmission', async () => {
    const res = await fetch(`${BASE_URL}/emergency`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`
      },
      body: JSON.stringify({
        busId: 'bus-101',
        tripId: 'trip-active-101',
        message: 'Engine overheating near Central Library',
        latitude: 12.9362,
        longitude: 77.6080
      })
    });
    const data = await res.json();
    if (!data.success || !data.data.id) {
      throw new Error(`Emergency alert dispatch failed: ${JSON.stringify(data)}`);
    }
    createdEmergencyId = data.data.id;
  });

  await test('12. Admin Emergency Resolution', async () => {
    const res = await fetch(`${BASE_URL}/emergency/${createdEmergencyId}/resolve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(`Emergency resolve failed: ${JSON.stringify(data)}`);
    }
  });

  // 13. Admin Analytics
  await test('13. Operational Fleet Analytics Dashboard Data', async () => {
    const res = await fetch(`${BASE_URL}/analytics`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (!data.success || !data.data.totalBuses || data.data.totalRoutes === 0) {
      throw new Error(`Analytics failed: ${JSON.stringify(data)}`);
    }
  });

  // 14. GPS Simulation Engine Toggle
  await test('14. GPS Simulation Engine (Hackathon Demo Feature)', async () => {
    // Start simulation
    const startRes = await fetch(`${BASE_URL}/simulation/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ speedMultiplier: 1.5 })
    });
    const startData = await startRes.json();
    if (!startData.success || !startData.data.isSimulating) {
      throw new Error('Simulation start failed');
    }

    // Stop simulation
    const stopRes = await fetch(`${BASE_URL}/simulation/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    });
    const stopData = await stopRes.json();
    if (!stopData.success || stopData.data.isSimulating) {
      throw new Error('Simulation stop failed');
    }
  });

  console.log(`\n===============================================`);
  console.log(`📊 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`===============================================`);

  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
