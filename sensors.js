// Sensor Manager - DeviceMotion, DeviceOrientation, Geolocation
export class SensorManager {
  constructor() {
    this.onDataCallback = null;
    this.onGPSCallback = null;
    this.onPermChangeCallback = null;
    this.tempDataCallback = null;
    
    this.lastGPS = null;
    this.gpsWatchId = null;
    this.motionHandler = null;
    this.orientationHandler = null;
    
    this.permissions = { sensors: false, gps: false };
    this.accelInterval = null;
    this.lastMotionTime = 0;
  }

  async checkPermissions() {
    const perms = { sensors: false, gps: false };
    
    // Check sensor permission (iOS 13+ requires request)
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        // Just check current permission state without prompting
        // DeviceMotionEvent.requestPermission() will prompt, so we can't use it for checking
        // For now, assume sensors available on iOS if API exists
        perms.sensors = true;
      } catch {
        perms.sensors = false;
      }
    } else {
      // Android or older iOS - assume available if API exists
      perms.sensors = 'DeviceMotionEvent' in window;
    }
    
    // Check GPS permission
    try {
      const perm = await navigator.permissions.query({ name: 'geolocation' });
      perms.gps = perm.state === 'granted';
      perm.onchange = () => this.checkPermissions().then(p => this.notifyPermChange(p));
    } catch {
      // navigator.permissions not supported or geolocation not supported
      // Do NOT assume permission is granted just because API exists
      perms.gps = false;
    }
    
    this.permissions = perms;
    return perms;
  }

  async requestPermissions() {
    const perms = { sensors: false, gps: false };
    
    // Request sensor permission (iOS)
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const perm = await DeviceMotionEvent.requestPermission();
        perms.sensors = perm === 'granted';
      } catch (e) {
        console.warn('Sensor permission denied:', e);
        perms.sensors = false;
      }
    } else {
      perms.sensors = 'DeviceMotionEvent' in window;
    }
    
    // Request GPS permission
    if ('geolocation' in navigator) {
      try {
        await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(), 
            () => reject(), 
            { timeout: 5000, enableHighAccuracy: true }
          );
        });
        perms.gps = true;
      } catch {
        perms.gps = false;
      }
    }
    
    this.permissions = perms;
    this.notifyPermChange(perms);
    return perms;
  }

  notifyPermChange(perms) {
    if (this.onPermChangeCallback) {
      this.onPermChangeCallback(perms);
    }
  }

  async start() {
    if (this.permissions.sensors) {
      this.startMotionSensors();
    }
    if (this.permissions.gps) {
      this.startGPS();
    }
  }

  startMotionSensors() {
    // DeviceMotionEvent - acceleration + rotation rate
    this.motionHandler = (event) => {
      const now = Date.now();
      const interval = this.lastMotionTime ? now - this.lastMotionTime : 0;
      this.lastMotionTime = now;
      
      const acceleration = event.accelerationIncludingGravity || event.acceleration;
      const rotation = event.rotationRate;
      
      if (!acceleration) return;
      
      const data = {
        acceleration: {
          x: acceleration.x || 0,
          y: acceleration.y || 0,
          z: acceleration.z || 0
        },
        rotation: {
          alpha: rotation?.alpha || 0,
          beta: rotation?.beta || 0,
          gamma: rotation?.gamma || 0
        },
        interval
      };
      
      if (this.onDataCallback) this.onDataCallback(data);
      if (this.tempDataCallback) this.tempDataCallback(data);
    };
    
    window.addEventListener('devicemotion', this.motionHandler, { passive: true });
    
    // DeviceOrientationEvent - absolute orientation
    this.orientationHandler = (event) => {
      // event.alpha (z-axis), beta (x-axis), gamma (y-axis) in degrees
      // Can be used for compass heading, tilt detection
    };
    window.addEventListener('deviceorientation', this.orientationHandler, { passive: true });
  }

  startGPS() {
    if (!('geolocation' in navigator)) return;
    
    this.gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.lastGPS = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speed: pos.coords.speed || 0, // m/s
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          altitude: pos.coords.altitude,
          timestamp: pos.timestamp
        };
        if (this.onGPSCallback) this.onGPSCallback(this.lastGPS);
      },
      (err) => {
        console.warn('GPS error:', err.code, err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000
      }
    );
  }

  stop() {
    if (this.motionHandler) {
      window.removeEventListener('devicemotion', this.motionHandler);
      this.motionHandler = null;
    }
    if (this.orientationHandler) {
      window.removeEventListener('deviceorientation', this.orientationHandler);
      this.orientationHandler = null;
    }
    if (this.gpsWatchId !== null) {
      navigator.geolocation.clearWatch(this.gpsWatchId);
      this.gpsWatchId = null;
    }
    this.lastGPS = null;
  }

  onData(cb) { this.onDataCallback = cb; }
  onGPS(cb) { this.onGPSCallback = cb; }
  onPermissionChange(cb) { this.onPermChangeCallback = cb; }
  onTempData(cb) { this.tempDataCallback = cb; }
  offTempData(cb) { if (this.tempDataCallback === cb) this.tempDataCallback = null; }
}