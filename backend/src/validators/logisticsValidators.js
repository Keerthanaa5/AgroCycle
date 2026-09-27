/**
 * AgroCycle Logistics Input & Coordinate Validators
 */

export function validateCoordinates(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);
    if (isNaN(numLat) || isNaN(numLng)) {
      return { valid: false, message: 'Latitude and longitude must be valid numbers' };
    }
    lat = numLat;
    lng = numLng;
  }

  if (lat < -90 || lat > 90) {
    return { valid: false, message: `Latitude ${lat} is out of bounds (must be between -90 and 90)` };
  }

  if (lng < -180 || lng > 180) {
    return { valid: false, message: `Longitude ${lng} is out of bounds (must be between -180 and 180)` };
  }

  return { valid: true, lat, lng };
}

export function validateLocationPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, message: 'Location payload is required' };
  }

  const { latitude, longitude, accuracy, speed, heading, timestamp } = payload;

  const coordCheck = validateCoordinates(latitude, longitude);
  if (!coordCheck.valid) {
    return coordCheck;
  }

  if (accuracy !== undefined && accuracy !== null) {
    const numAcc = parseFloat(accuracy);
    if (isNaN(numAcc) || numAcc < 0) {
      return { valid: false, message: 'Accuracy must be a non-negative number' };
    }
  }

  if (speed !== undefined && speed !== null) {
    const numSpeed = parseFloat(speed);
    if (isNaN(numSpeed) || numSpeed < 0) {
      return { valid: false, message: 'Speed must be a non-negative number' };
    }
  }

  if (heading !== undefined && heading !== null) {
    const numHeading = parseFloat(heading);
    if (isNaN(numHeading) || numHeading < 0 || numHeading > 360) {
      return { valid: false, message: 'Heading must be between 0 and 360 degrees' };
    }
  }

  if (timestamp) {
    const time = new Date(timestamp).getTime();
    if (isNaN(time)) {
      return { valid: false, message: 'Invalid timestamp format' };
    }
    const now = Date.now();
    // Reject timestamps more than 10 minutes into the future or older than 24 hours
    if (time > now + 10 * 60 * 1000) {
      return { valid: false, message: 'Timestamp is too far into the future' };
    }
    if (time < now - 24 * 60 * 60 * 1000) {
      return { valid: false, message: 'Timestamp is older than 24 hours' };
    }
  }

  return { 
    valid: true, 
    data: {
      latitude: coordCheck.lat,
      longitude: coordCheck.lng,
      accuracy: accuracy !== undefined && accuracy !== null ? parseFloat(accuracy) : 0,
      speed: speed !== undefined && speed !== null ? parseFloat(speed) : null,
      heading: heading !== undefined && heading !== null ? parseFloat(heading) : null,
      timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString()
    }
  };
}
