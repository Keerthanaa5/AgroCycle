/**
 * AgroCycle Real-Time Socket.IO Client
 *
 * Provides real-time event subscriptions across browser sessions for:
 * 1. Marketplace Listings (listing:created, listing:updated, listing:deleted)
 * 2. Community Posts (agroconnect:created, agroconnect:updated, agroconnect:deleted)
 * 3. Shipment Tracking & Logistics
 * 4. Live Connection Status (connected, reconnecting, offline)
 */

import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SOCKET_URL) || 'http://localhost:5000';

class RealtimeSocketClient {
  constructor() {
    this.socket = null;
    this.activeShipmentId = null;
    this.activeUserId = null;
    this.listeners = new Map();
    this.statusListeners = new Set();
    this.isConnected = false;
    this.connectionStatus = 'offline'; // 'connected' | 'reconnecting' | 'offline'
  }

  connect() {
    if (this.socket && (this.socket.connected || this.socket.connecting)) {
      return this.socket;
    }

    this.setStatus('reconnecting');

    this.socket = io(SOCKET_SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.setStatus('connected');
      console.log(`[Socket Client] Connected to backend (${this.socket.id})`);
      
      if (this.activeShipmentId && this.activeUserId) {
        this.socket.emit('subscribe:shipment', {
          shipmentId: this.activeShipmentId,
          userId: this.activeUserId
        });
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.setStatus('offline');
      console.log(`[Socket Client] Disconnected from backend (${reason})`);
    });

    this.socket.on('connect_error', (error) => {
      this.isConnected = false;
      this.setStatus('offline');
    });

    this.socket.on('reconnect_attempt', () => {
      this.setStatus('reconnecting');
    });

    this.socket.on('reconnect', () => {
      this.isConnected = true;
      this.setStatus('connected');
    });

    // Universal Event Forwarding
    const standardEvents = [
      'listing:created',
      'listing:updated',
      'listing:deleted',
      'agroconnect:created',
      'agroconnect:updated',
      'agroconnect:deleted',
      'subscription:success',
      'subscription:error',
      'shipment:location_update',
      'shipment:status_changed',
      'shipment:stop_progress'
    ];

    standardEvents.forEach(eventName => {
      this.socket.on(eventName, (data) => {
        this.triggerListeners(eventName, data);
      });
    });

    // Catch any dynamic events
    this.socket.onAny((event, ...args) => {
      if (!standardEvents.includes(event)) {
        this.triggerListeners(event, args[0]);
      }
    });

    return this.socket;
  }

  setStatus(status) {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.statusListeners.forEach(cb => {
        try {
          cb(status);
        } catch (e) {
          console.error('[Socket Client] Status callback error:', e);
        }
      });
    }
  }

  onStatusChange(callback) {
    if (typeof callback === 'function') {
      this.statusListeners.add(callback);
      // Immediately notify current status
      callback(this.connectionStatus);
      return () => this.statusListeners.delete(callback);
    }
    return () => {};
  }

  on(event, callback) {
    this.connect();
    this.addListener(event, callback);
    return () => this.removeListener(event, callback);
  }

  off(event, callback) {
    this.removeListener(event, callback);
  }

  subscribeShipment(shipmentId, userId, callbacks = {}) {
    this.connect();
    this.activeShipmentId = shipmentId;
    this.activeUserId = userId;

    if (this.socket && this.socket.connected) {
      this.socket.emit('subscribe:shipment', { shipmentId, userId });
    }

    Object.entries(callbacks).forEach(([event, callback]) => {
      if (typeof callback === 'function') {
        this.addListener(event, callback);
      }
    });

    return () => {
      this.unsubscribeShipment(shipmentId);
      Object.entries(callbacks).forEach(([event, callback]) => {
        if (typeof callback === 'function') {
          this.removeListener(event, callback);
        }
      });
    };
  }

  unsubscribeShipment(shipmentId) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('unsubscribe:shipment', { shipmentId });
    }
    if (this.activeShipmentId === shipmentId) {
      this.activeShipmentId = null;
    }
  }

  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  removeListener(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  triggerListeners(event, data) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try {
          cb(data);
        } catch (e) {
          console.error(`[Socket Listener Error] on ${event}`, e);
        }
      }
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.setStatus('offline');
    }
  }
}

export const realtimeSocketClient = new RealtimeSocketClient();
