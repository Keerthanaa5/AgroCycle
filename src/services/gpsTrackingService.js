/**
 * AgroCycle Real Device GPS Tracking Service
 *
 * Captures real device coordinates via `navigator.geolocation.watchPosition()`,
 * throttles backend transmission (5-10 seconds or > 20m movement),
 * and provides offline queue resilience with retry when connection returns.
 */

const BACKEND_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) || 'http://localhost:5000/api/v1';

class GpsTrackingService {
  constructor() {
    this.watchId = null;
    this.isTracking = false;
    this.currentShipmentId = null;
    this.currentUser = null;
    this.lastSentLocation = null;
    this.lastSentTimestamp = 0;
    this.offlineQueue = [];
    this.listeners = new Set();
    this.throttleIntervalMs = 5000; // 5 seconds throttle
    this.minDistanceChangeMeters = 20; // 20m threshold
    this.gpsStatus = 'IDLE'; // IDLE, ACQUIRING, ACTIVE, PERMISSION_DENIED, OFFLINE_QUEUED
  }

  // Haversine distance in meters
  calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
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

  /**
   * Start tracking real device GPS for the active driver on an assigned shipment
   */
  startTracking(shipmentId, user, onLocationCallback) {
    if (!('geolocation' in navigator)) {
      this.gpsStatus = 'UNSUPPORTED';
      this.notifyListeners({ status: this.gpsStatus, error: 'Geolocation not supported by browser' });
      return false;
    }

    this.currentShipmentId = shipmentId;
    this.currentUser = user;
    if (onLocationCallback) {
      this.listeners.add(onLocationCallback);
    }

    this.isTracking = true;
    this.gpsStatus = 'ACQUIRING';
    this.notifyListeners({ status: this.gpsStatus });

    const options = {
      enableHighAccuracy: true,
      maximumAge: 4000,
      timeout: 10000
    };

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePositionUpdate(position),
      (error) => this.handlePositionError(error),
      options
    );

    // Listen for online events to flush any queued location updates
    window.addEventListener('online', this.handleNetworkReconnect);

    return true;
  }

  /**
   * Stop active device GPS tracking
   */
  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    this.gpsStatus = 'IDLE';
    this.lastSentLocation = null;
    this.lastSentTimestamp = 0;
    this.notifyListeners({ status: this.gpsStatus });
    window.removeEventListener('online', this.handleNetworkReconnect);
  }

  /**
   * Process raw GPS position from browser
   */
  async handlePositionUpdate(position) {
    const coords = position.coords;
    const locationData = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy || 0,
      speed: coords.speed ? Math.round(coords.speed * 3.6) : null, // Convert m/s to km/h
      heading: coords.heading || null,
      timestamp: new Date(position.timestamp || Date.now()).toISOString()
    };

    this.gpsStatus = 'ACTIVE';

    // Notify UI listeners immediately with current position
    this.notifyListeners({
      status: this.gpsStatus,
      location: locationData,
      isOnline: navigator.onLine
    });

    // Check throttling
    const now = Date.now();
    const timeSinceLastSend = now - this.lastSentTimestamp;
    
    let shouldSend = false;
    if (!this.lastSentLocation) {
      shouldSend = true;
    } else if (timeSinceLastSend >= this.throttleIntervalMs) {
      shouldSend = true;
    } else if (this.lastSentLocation) {
      const movedMeters = this.calculateDistanceMeters(
        this.lastSentLocation.latitude,
        this.lastSentLocation.longitude,
        locationData.latitude,
        locationData.longitude
      );
      if (movedMeters >= this.minDistanceChangeMeters) {
        shouldSend = true;
      }
    }

    if (shouldSend && this.currentShipmentId) {
      this.lastSentLocation = locationData;
      this.lastSentTimestamp = now;
      await this.transmitLocationToBackend(locationData);
    }
  }

  handlePositionError(error) {
    console.warn('[GPS Tracking Warning]', error.message);
    if (error.code === error.PERMISSION_DENIED) {
      this.gpsStatus = 'PERMISSION_DENIED';
    } else if (error.code === error.POSITION_UNAVAILABLE) {
      this.gpsStatus = 'POSITION_UNAVAILABLE';
    } else if (error.code === error.TIMEOUT) {
      this.gpsStatus = 'TIMEOUT';
    }
    this.notifyListeners({ status: this.gpsStatus, error: error.message });
  }

  /**
   * Transmit location payload to backend API with offline fallback
   */
  async transmitLocationToBackend(locationData) {
    if (!this.currentShipmentId) return;

    const payload = {
      ...locationData,
      shipmentId: this.currentShipmentId
    };

    // If offline, queue in memory
    if (!navigator.onLine) {
      this.offlineQueue = [payload]; // Keep most recent
      this.gpsStatus = 'OFFLINE_QUEUED';
      this.notifyListeners({ status: this.gpsStatus, queued: true });
      return;
    }

    try {
      const userId = this.currentUser?.userId || this.currentUser?.id;
      const res = await fetch(`${BACKEND_BASE_URL}/shipments/${this.currentShipmentId}/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId || 'usr_driver_ravi_04',
          'x-user-role': 'driver',
          'Authorization': `Bearer ${userId || 'usr_driver_ravi_04'}`
        },
        body: JSON.stringify(locationData)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        console.warn('[GPS Backend Warning]', errorData?.message || res.statusText);
      }
    } catch (err) {
      console.warn('[GPS Network Exception]', err.message);
      this.offlineQueue = [payload];
      this.gpsStatus = 'OFFLINE_QUEUED';
      this.notifyListeners({ status: this.gpsStatus, queued: true });
    }
  }

  handleNetworkReconnect = async () => {
    if (this.offlineQueue.length > 0 && this.currentShipmentId) {
      console.log('[GPS Reconnect] Flushing queued location updates...');
      const latest = this.offlineQueue[this.offlineQueue.length - 1];
      this.offlineQueue = [];
      await this.transmitLocationToBackend(latest);
    }
  };

  notifyListeners(data) {
    for (const listener of this.listeners) {
      try {
        listener(data);
      } catch (e) {
        console.error('[GPS Listener Error]', e);
      }
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getStatus() {
    return {
      isTracking: this.isTracking,
      status: this.gpsStatus,
      lastLocation: this.lastSentLocation,
      queued: this.offlineQueue.length > 0
    };
  }
}

export const gpsTrackingService = new GpsTrackingService();
