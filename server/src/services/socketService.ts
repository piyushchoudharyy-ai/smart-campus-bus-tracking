import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { verifyToken } from '../utils/jwt.js';

let io: SocketIOServer | null = null;

export function initSocketIO(server: HTTPServer, allowedOrigins: string | string[]) {
  io = new SocketIOServer(server, {
    cors: {
      origin: allowedOrigins === '*' ? true : allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingInterval: 10000,
    pingTimeout: 5000
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (token) {
      const payload = verifyToken(token as string);
      if (payload) {
        (socket as any).user = payload;
      }
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    console.log(`Socket client connected: ${socket.id} (User: ${user?.email || 'Guest/Anonymous'})`);

    // Join role room if authenticated
    if (user?.role) {
      socket.join(`role:${user.role}`);
    }

    // Allow subscribing to specific bus
    socket.on('subscribe:bus', (busId: string) => {
      socket.join(`bus:${busId}`);
    });

    socket.on('unsubscribe:bus', (busId: string) => {
      socket.leave(`bus:${busId}`);
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io has not been initialized');
  }
  return io;
}

export const socketEvents = {
  emitLocationUpdate(data: any) {
    if (!io) return;
    io.emit('bus:location_updated', data);
    if (data.busId) {
      io.to(`bus:${data.busId}`).emit('bus:location_updated', data);
    }
  },

  emitBusStatusChanged(busId: string, status: string, metadata?: any) {
    if (!io) return;
    io.emit('bus:status_changed', { busId, status, metadata });
  },

  emitTripStarted(trip: any) {
    if (!io) return;
    io.emit('trip:started', trip);
  },

  emitTripEnded(tripId: string, busId: string) {
    if (!io) return;
    io.emit('trip:ended', { tripId, busId });
  },

  emitBusDelayed(busId: string, reason: string, delayMinutes: number) {
    if (!io) return;
    io.emit('bus:delayed', { busId, reason, delayMinutes });
  },

  emitEmergencyCreated(alert: any) {
    if (!io) return;
    io.emit('emergency:created', alert);
    io.to('role:admin').emit('notification:new', {
      type: 'emergency',
      title: '🚨 CAMPUS EMERGENCY ALERT',
      message: `Emergency reported for Bus ${alert.busNumber || alert.busId}: ${alert.message}`
    });
  },

  emitEmergencyResolved(alertId: string, busId: string) {
    if (!io) return;
    io.emit('emergency:resolved', { alertId, busId });
  },

  emitOccupancyUpdated(tripId: string, busId: string, passengerCount: number, capacity: number) {
    if (!io) return;
    io.emit('occupancy:updated', { tripId, busId, passengerCount, capacity });
  },

  emitNotification(notification: any) {
    if (!io) return;
    if (notification.role) {
      io.to(`role:${notification.role}`).emit('notification:new', notification);
    } else if (notification.userId) {
      // In a real multi-user app we could map user sockets, but for campus broadcast:
      io.emit('notification:new', notification);
    } else {
      io.emit('notification:new', notification);
    }
  }
};
