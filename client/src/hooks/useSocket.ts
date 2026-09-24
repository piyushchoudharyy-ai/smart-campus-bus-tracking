import { useEffect } from 'react';
import { getSocket } from '../services/socket.js';
import { notificationService } from '../services/notificationService.js';
import type { CampusNotification } from '../types.js';

interface SocketEventHandlers {
  onLocationUpdate?: (data: any) => void;
  onBusStatusChanged?: (data: { busId: string; status: string; metadata?: any }) => void;
  onTripStarted?: (data: any) => void;
  onTripEnded?: (data: { tripId: string; busId: string }) => void;
  onEmergencyCreated?: (alert: any) => void;
  onEmergencyResolved?: (data: { alertId: string; busId: string }) => void;
  onOccupancyUpdated?: (data: { tripId: string; busId: string; passengerCount: number; capacity: number }) => void;
  onNotification?: (notification: CampusNotification) => void;
}

export function useSocket(handlers: SocketEventHandlers = {}, deps: any[] = []) {
  useEffect(() => {
    const socket = getSocket();

    const handleLocation = (data: any) => {
      handlers.onLocationUpdate?.(data);
    };

    const handleBusStatus = (data: any) => {
      handlers.onBusStatusChanged?.(data);
    };

    const handleTripStart = (data: any) => {
      handlers.onTripStarted?.(data);
    };

    const handleTripEnd = (data: any) => {
      handlers.onTripEnded?.(data);
    };

    const handleEmergency = (data: any) => {
      notificationService.playAlertSound('emergency');
      notificationService.show('🚨 CAMPUS EMERGENCY ALERT', {
        body: `Bus ${data.busNumber || data.busId}: ${data.message}`
      });
      handlers.onEmergencyCreated?.(data);
    };

    const handleEmergencyResolve = (data: any) => {
      handlers.onEmergencyResolved?.(data);
    };

    const handleOccupancy = (data: any) => {
      handlers.onOccupancyUpdated?.(data);
    };

    const handleNotif = (notif: CampusNotification) => {
      if (notif.type === 'emergency') {
        notificationService.playAlertSound('emergency');
      } else if (notif.type === 'approaching') {
        notificationService.playAlertSound('approaching');
      }
      notificationService.show(notif.title, { body: notif.message });
      handlers.onNotification?.(notif);
    };

    socket.on('bus:location_updated', handleLocation);
    socket.on('bus:status_changed', handleBusStatus);
    socket.on('trip:started', handleTripStart);
    socket.on('trip:ended', handleTripEnd);
    socket.on('emergency:created', handleEmergency);
    socket.on('emergency:resolved', handleEmergencyResolve);
    socket.on('occupancy:updated', handleOccupancy);
    socket.on('notification:new', handleNotif);

    return () => {
      socket.off('bus:location_updated', handleLocation);
      socket.off('bus:status_changed', handleBusStatus);
      socket.off('trip:started', handleTripStart);
      socket.off('trip:ended', handleTripEnd);
      socket.off('emergency:created', handleEmergency);
      socket.off('emergency:resolved', handleEmergencyResolve);
      socket.off('occupancy:updated', handleOccupancy);
      socket.off('notification:new', handleNotif);
    };
  }, deps);

  return getSocket();
}
