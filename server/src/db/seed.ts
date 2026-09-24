import bcrypt from 'bcryptjs';
import { db, initDatabase } from './index.js';

export function seedData() {
  initDatabase();

  console.log('Seeding demo campus transportation data...');

  // Clean existing data
  db.exec(`
    DELETE FROM notifications;
    DELETE FROM emergency_alerts;
    DELETE FROM occupancy;
    DELETE FROM location_updates;
    DELETE FROM trips;
    DELETE FROM stops;
    DELETE FROM drivers;
    DELETE FROM routes;
    DELETE FROM buses;
    DELETE FROM users;
  `);

  const passwordHash = bcrypt.hashSync('admin123', 10);
  const driverPasswordHash = bcrypt.hashSync('driver123', 10);
  const studentPasswordHash = bcrypt.hashSync('student123', 10);

  // 1. Insert Users
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('u-admin', 'Campus Transport Admin', 'admin@campus.edu', '+91 98765 43210', passwordHash, 'admin');
  insertUser.run('u-driver1', 'Ramesh Kumar', 'driver1@campus.edu', '+91 98111 22334', driverPasswordHash, 'driver');
  insertUser.run('u-driver2', 'Suresh Patel', 'driver2@campus.edu', '+91 98222 33445', driverPasswordHash, 'driver');
  insertUser.run('u-driver3', 'Anil Sharma', 'driver3@campus.edu', '+91 98333 44556', driverPasswordHash, 'driver');
  insertUser.run('u-student1', 'Priya Sharma', 'student@campus.edu', '+91 98444 55667', studentPasswordHash, 'student');
  insertUser.run('u-student2', 'Rahul Verma', 'rahul@campus.edu', '+91 98555 66778', studentPasswordHash, 'student');

  // 2. Insert Buses
  const insertBus = db.prepare(`
    INSERT INTO buses (id, bus_number, registration_number, capacity, status)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertBus.run('bus-101', 'Bus 101 - Blue Line', 'KA-01-CB-1011', 40, 'On Time');
  insertBus.run('bus-202', 'Bus 202 - Green Express', 'KA-01-CB-2022', 35, 'On Time');
  insertBus.run('bus-303', 'Bus 303 - Red Loop', 'KA-01-CB-3033', 45, 'Not Started');
  insertBus.run('bus-404', 'Bus 404 - North Shuttle', 'KA-01-CB-4044', 30, 'Completed');
  insertBus.run('bus-505', 'Bus 505 - Tech Rapid', 'KA-01-CB-5055', 50, 'Not Started');

  // 3. Insert Drivers
  const insertDriver = db.prepare(`
    INSERT INTO drivers (id, user_id, license_number, assigned_bus_id)
    VALUES (?, ?, ?, ?)
  `);

  insertDriver.run('drv-1', 'u-driver1', 'DL-KA-2020-009121', 'bus-101');
  insertDriver.run('drv-2', 'u-driver2', 'DL-KA-2019-004312', 'bus-202');
  insertDriver.run('drv-3', 'u-driver3', 'DL-KA-2022-007788', 'bus-303');

  // 4. Insert Routes
  const insertRoute = db.prepare(`
    INSERT INTO routes (id, name, description, status, color)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertRoute.run('route-1', 'Route 1: Main Campus Ring', 'Connects Main Gate, Central Library, Engineering Quad, and Student Cafeteria', 'active', '#2563EB');
  insertRoute.run('route-2', 'Route 2: Hostel Express', 'Direct high-frequency link between North/South Hostels and Academic Quads', 'active', '#16A34A');
  insertRoute.run('route-3', 'Route 3: Tech & Innovation Loop', 'Connects Science Complex, Innovation Hub, and Bio-Research Labs', 'active', '#DC2626');

  // 5. Insert Stops
  const insertStop = db.prepare(`
    INSERT INTO stops (id, route_id, name, latitude, longitude, sequence)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Route 1 Stops
  insertStop.run('stop-1-1', 'route-1', 'Main Campus Gate', 12.9340, 77.6050, 1);
  insertStop.run('stop-1-2', 'route-1', 'Central Library', 12.9355, 77.6072, 2);
  insertStop.run('stop-1-3', 'route-1', 'Engineering Quad & Labs', 12.9372, 77.6090, 3);
  insertStop.run('stop-1-4', 'route-1', 'Cafeteria & Food Court', 12.9385, 77.6075, 4);
  insertStop.run('stop-1-5', 'route-1', 'Sports Complex & Gym', 12.9398, 77.6045, 5);
  insertStop.run('stop-1-6', 'route-1', 'Health Center & Pharmacy', 12.9345, 77.6080, 6);

  // Route 2 Stops
  insertStop.run('stop-2-1', 'route-2', 'North Hostels (Blocks A & B)', 12.9412, 77.6025, 1);
  insertStop.run('stop-2-2', 'route-2', 'South Hostels (Blocks C & D)', 12.9325, 77.6030, 2);
  insertStop.run('stop-2-3', 'route-2', 'Central Library', 12.9355, 77.6072, 3);
  insertStop.run('stop-2-4', 'route-2', 'Engineering Quad & Labs', 12.9372, 77.6090, 4);
  insertStop.run('stop-2-5', 'route-2', 'Student Cafeteria', 12.9385, 77.6075, 5);

  // Route 3 Stops
  insertStop.run('stop-3-1', 'route-3', 'Main Campus Gate', 12.9340, 77.6050, 1);
  insertStop.run('stop-3-2', 'route-3', 'Science & Biotech Complex', 12.9360, 77.6110, 2);
  insertStop.run('stop-3-3', 'route-3', 'Tech Innovation Hub', 12.9380, 77.6125, 3);
  insertStop.run('stop-3-4', 'route-3', 'Cafeteria & Food Court', 12.9385, 77.6075, 4);

  // 6. Insert Active Trips
  const insertTrip = db.prepare(`
    INSERT INTO trips (id, bus_id, driver_id, route_id, start_time, status)
    VALUES (?, ?, ?, ?, datetime('now', '-25 minutes'), ?)
  `);

  insertTrip.run('trip-active-101', 'bus-101', 'drv-1', 'route-1', 'active');
  insertTrip.run('trip-active-202', 'bus-202', 'drv-2', 'route-2', 'active');

  // 7. Initial Location Updates
  const insertLocation = db.prepare(`
    INSERT INTO location_updates (id, trip_id, bus_id, latitude, longitude, speed, accuracy, heading, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  // Bus 101 near Central Library moving towards Engineering Quad
  insertLocation.run('loc-1', 'trip-active-101', 'bus-101', 12.9358, 77.6075, 24.5, 4.2, 45.0);
  // Bus 202 near North Hostels moving towards South Hostels
  insertLocation.run('loc-2', 'trip-active-202', 'bus-202', 12.9405, 77.6028, 20.0, 3.8, 185.0);

  // 8. Initial Occupancy
  const insertOccupancy = db.prepare(`
    INSERT INTO occupancy (id, trip_id, passenger_count, timestamp)
    VALUES (?, ?, ?, datetime('now'))
  `);

  insertOccupancy.run('occ-1', 'trip-active-101', 26);
  insertOccupancy.run('occ-2', 'trip-active-202', 18);

  // 9. Initial Notifications
  const insertNotif = db.prepare(`
    INSERT INTO notifications (id, user_id, role, type, title, message, read)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertNotif.run('notif-1', null, 'student', 'trip', 'Trip Started', 'Bus 101 has commenced Route 1 (Main Campus Ring).', 0);
  insertNotif.run('notif-2', null, 'student', 'approaching', 'Bus Approaching', 'Bus 101 is approaching Central Library (~2 min away).', 0);
  insertNotif.run('notif-3', 'u-admin', 'admin', 'info', 'System Online', 'GPS Tracking engine and Socket.io gateway online.', 0);

  console.log('Seed data inserted successfully!');
}

// If run directly
if (process.argv[1]?.endsWith('seed.ts')) {
  seedData();
}
