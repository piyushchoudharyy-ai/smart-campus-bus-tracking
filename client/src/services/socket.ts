import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    const token = localStorage.getItem('campus_bus_token');

    // Resolve socket server endpoint for production deployments
    const envSocketUrl = import.meta.env.VITE_SOCKET_URL;
    const envApiUrl = import.meta.env.VITE_API_URL;
    
    // If VITE_SOCKET_URL is set, use it. Otherwise, if VITE_API_URL is set, strip /api. Otherwise fallback to window.location.origin
    const socketHost = envSocketUrl
      ? envSocketUrl
      : envApiUrl && envApiUrl.startsWith('http')
      ? envApiUrl.replace(/\/api\/?$/, '')
      : window.location.origin;

    socketInstance = io(socketHost, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'], // Fallback to polling if WebSocket upgrade blocked by proxy
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      autoConnect: true
    });

    socketInstance.on('connect', () => {
      console.log('⚡ Socket connected to:', socketHost, 'ID:', socketInstance?.id);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('⚡ Socket disconnected:', reason);
    });

    socketInstance.on('connect_error', (error) => {
      console.warn('⚡ Socket connection error:', error.message);
    });
  }

  return socketInstance;
}

export function refreshSocketAuth() {
  if (socketInstance) {
    const token = localStorage.getItem('campus_bus_token');
    socketInstance.auth = { token };
    if (!socketInstance.connected) {
      socketInstance.connect();
    }
  }
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
