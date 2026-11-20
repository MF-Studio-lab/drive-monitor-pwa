// Main Application Controller
import { ChartManager } from './charts.js';
import { SensorManager } from './sensors.js';
import { StorageManager } from './storage.js';
import { APIManager } from './api.js';

class DriveMonitorApp {
  constructor() {
    this.charts = new ChartManager();
    this.sensors = new SensorManager();
    this.storage = new StorageManager();
    this.api = new APIManager();
    
    this.isRecording = false;
    this.currentTrip = null;
    this.calibrationData = { x: 0, y: 0, z: 9.81 }; // gravity offset
    this.calibrationSamples = [];
    this.isCalibrating = false;
    
    this.weatherUpdateInterval = null;
    this.roadUpdateInterval = null;
    
    // Comfort settings (configurable weights)
    this.comfortWeights = {
      lateral: 15,
      longitudinal: 10,
      vertical: 5,
      baseScore: 100
    };
    
    this.init().catch(err => {
      console.error('App init failed:', err);
      // Even if init fails, try to show permission modal so user can interact
      this.showModal('permModal');
      document.getElementById('btnStartSensors').style.display = 'inline-flex';
    });
  }

  async init() {
    await this.storage.init();
    this.setupEventListeners();
    await this.charts.init();
    this.loadTrips();
    await this.checkPermissions();
    
    // Start periodic updates
    this.startPeriodicUpdates();
  }

  setupEventListeners() {
    // Sensor data callback
    this.sensors.onData((data) => this.handleSensorData(data));
    
    // GPS callback
    this.sensors.onGPS((gps) => this.handleGPSData(gps));
    
    // Permission changes
    this.sensors.onPermissionChange((perms) => this.updatePermissionUI(perms));
    
    // Comfort settings sliders
    this.setupComfortSettings();
    
    // Visibility change - pause/resume
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isRecording) {
        // Keep recording in background if possible
      }
    });
  }

  setupComfortSettings() {
    const inputs = ['lateralWeight', 'longWeight', 'vertWeight', 'baseScore'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', (e) => {
          const value = parseInt(e.target.value);
          document.getElementById(id + 'Value').textContent = value;
          switch (id) {
            case 'lateralWeight': this.comfortWeights.lateral = value; break;
            case 'longWeight': this.comfortWeights.longitudinal = value; break;
            case 'vertWeight': this.comfortWeights.vertical = value; break;
            case 'baseScore': this.comfortWeights.baseScore = value; break;
          }
        });
      }
    });
  }

  async checkPermissions() {
    const perms = await this.sensors.checkPermissions();
    this.updatePermissionUI(perms);
    
    if (!perms.sensors || !perms.gps) {
      this.showModal('permModal');
      document.getElementById('btnStartSensors').style.display = 'inline-flex';
    } else {
      this.hideModal('permModal');
      document.getElementById('btnStartSensors').style.display = 'none';
      await this.sensors.start();
      this.startCalibration();
    }
  }

  async requestPermissions() {
    const perms = await this.sensors.requestPermissions();
    this.updatePermissionUI(perms);
    
    if (perms.sensors && perms.gps) {
      this.hideModal('permModal');
      document.getElementById('btnStartSensors').style.display = 'none';
      await this.sensors.start();
      this.startCalibration();
    } else {
      document.getElementById('btnStartSensors').style.display = 'inline-flex';
    }
  }

  async startSensors() {
    await this.requestPermissions();
  }

  updatePermissionUI(perms) {
    document.getElementById('sensorStatus').classList.toggle('active', perms.sensors);
    document.getElementById('gpsStatus').classList.toggle('active', perms.gps);
  }

  handleSensorData(data) {
    // Apply calibration offset
    const ax = data.acceleration.x - this.calibrationData.x;
    const ay = data.acceleration.y - this.calibrationData.y;
    const az = data.acceleration.z - this.calibrationData.z;
    
    // Calculate G-forces (1G = 9.81 m/s²)
    const gx = ax / 9.81;
    const gy = ay / 9.81;
    const gz = az / 9.81;
    
    // Combined G-force (magnitude of net acceleration, excluding gravity)
    // gz is calibrated acceleration including gravity (~1.0 at rest)
    // We want net G-force: sqrt(gx² + gy² + (gz-1)²)
    // At rest: gx=0, gy=0, gz=1.0 → combinedG=0
    const combinedG = Math.sqrt(gx*gx + gy*gy + (gz-1)*(gz-1));
    
    // Update UI
    document.getElementById('gforceValue').textContent = Math.max(0, combinedG).toFixed(2);
    
    // Peak G tracking
    const peakEl = document.getElementById('peakG');
    const currentPeak = parseFloat(peakEl.textContent.match(/[\d.]+/)?.[0] || 0);
    if (combinedG > currentPeak) {
      peakEl.textContent = `峰值: ${Math.max(0, combinedG).toFixed(2)} G`;
    }
    
    // Update charts
    const timestamp = Date.now();
    this.charts.updateAccel(timestamp, ax, ay, az);
    // G-force chart shows NET G-force (excluding gravity, rest=0)
    // gz is calibrated acceleration including gravity (~1.0 at rest)
    // Net vertical = gz - 1
    this.charts.updateGForce(timestamp, gx, gy, gz - 1);
    
    // Vibration analysis (high-frequency components)
    this.updateVibration(ax, ay, az, timestamp);
    
    // Comfort score calculation
    this.updateComfort(gx, gy, gz);
    
    // Store if recording
    if (this.isRecording && this.currentTrip) {
      this.currentTrip.sensorData.push({
        t: timestamp,
        ax, ay, az,
        gx, gy, gz,
        rot: data.rotation,
        interval: data.interval
      });
    }
  }

  handleGPSData(gps) {
    const speedKmh = gps.speed * 3.6; // m/s to km/h
    
    document.getElementById('speedValue').textContent = speedKmh.toFixed(1);
    document.getElementById('coords').textContent = 
      `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`;
    
    // Max speed tracking
    const maxEl = document.getElementById('maxSpeed');
    const currentMax = parseFloat(maxEl.textContent.match(/[\d.]+/)?.[0] || 0);
    if (speedKmh > currentMax) {
      maxEl.textContent = `最高: ${speedKmh.toFixed(1)} km/h`;
    }
    
    // Update speed chart
    this.charts.updateSpeed(Date.now(), speedKmh);
    
    // Store if recording
    if (this.isRecording && this.currentTrip) {
      this.currentTrip.gpsData.push({
        t: Date.now(),
        lat: gps.latitude,
        lon: gps.longitude,
        speed: speedKmh,
        accuracy: gps.accuracy,
        heading: gps.heading,
        altitude: gps.altitude
      });
    }
    
    // Reverse geocode for address (throttled)
    if (!this._lastGeocode || Date.now() - this._lastGeocode > 10000) {
      this._lastGeocode = Date.now();
      this.api.reverseGeocode(gps.latitude, gps.longitude).then(addr => {
        document.getElementById('address').textContent = addr || '無法取得地址';
      });
    }
    
    // Update weather/road for new location
    this.api.updateWeather(gps.latitude, gps.longitude).then(w => this.renderWeather(w));
    this.api.updateRoad(gps.latitude, gps.longitude).then(r => this.renderRoad(r));
  }

  updateVibration(ax, ay, az, timestamp) {
    // Simple vibration magnitude (net acceleration excluding gravity)
    // az includes gravity (~9.81 at rest), so subtract 9.81 for net vertical
    const netAz = az - 9.81;
    this.charts.updateVibration(timestamp, Math.sqrt(ax*ax + ay*ay + netAz*netAz));
  }

  updateComfort(gx, gy, gz) {
    // Comfort score: 100 - penalty for lateral/longitudinal/vertical jerk
    // gz is calibrated acceleration including gravity (~1.0 at rest)
    // Net vertical deviation = |gz - 1|
    const lateralG = Math.abs(gy);
    const longG = Math.abs(gx);
    const vertG = Math.abs(gz - 1); // deviation from 1G (rest state)
    
    // Use configurable weights
    const w = this.comfortWeights;
    const penalty = (lateralG * w.lateral) + (longG * w.longitudinal) + (vertG * w.vertical);
    const score = Math.max(0, Math.min(w.baseScore, w.baseScore - penalty));
    
    document.getElementById('comfortValue').textContent = Math.round(score);
    
    const labelEl = document.getElementById('comfortLabel');
    if (score >= 80) labelEl.textContent = '平穩';
    else if (score >= 60) labelEl.textContent = '略顯顛簸';
    else if (score >= 40) labelEl.textContent = '顛簸';
    else labelEl.textContent = '劇烈顛簸';
    
    const valEl = document.getElementById('comfortValue');
    if (score >= 80) valEl.style.color = 'var(--success)';
    else if (score >= 60) valEl.style.color = 'var(--warning)';
    else valEl.style.color = 'var(--danger)';
  }

  renderWeather(w) {
    if (!w) return;
    const icons = { clear: '☀️', clouds: '☁️', rain: '🌧️', snow: '❄️', thunder: '⛈️', fog: '🌫️' };
    document.getElementById('weatherIcon').textContent = icons[w.code] || '🌡️';
    document.getElementById('weatherTemp').textContent = `${w.temp}°C`;
    document.getElementById('weatherDesc').textContent = w.desc;
    document.getElementById('humidity').textContent = `濕度: ${w.humidity}%`;
    document.getElementById('wind').textContent = `風速: ${w.wind} m/s`;
  }

  renderRoad(r) {
    if (!r) {
      document.getElementById('roadStatus').textContent = '無資料';
      document.getElementById('roadStatus').className = 'road-status unknown';
      return;
    }
    const statusEl = document.getElementById('roadStatus');
    const detailEl = document.getElementById('roadDetails');
    
    if (r.congestion === 'low') {
      statusEl.textContent = '暢順';
      statusEl.className = 'road-status good';
    } else if (r.congestion === 'moderate') {
      statusEl.textContent = '車多';
      statusEl.className = 'road-status moderate';
    } else {
      statusEl.textContent = '擁塞';
      statusEl.className = 'road-status poor';
    }
    detailEl.textContent = r.desc || '';
  }

  startCalibration() {
    this.showModal('calibModal');
    document.getElementById('calibStatus').textContent = '請將手機平放靜止，點擊開始校準';
    document.getElementById('calibBar').style.setProperty('--progress', '0%');
  }

  async startCalibrationProcess() {
    if (this.isCalibrating) return;
    this.isCalibrating = true;
    
    const btn = document.querySelector('#calibModal .btn-primary');
    btn.disabled = true;
    btn.textContent = '校準中...';
    
    this.calibrationSamples = [];
    const startTime = Date.now();
    const duration = 3000; // 3 seconds
    
    const collectSample = (data) => {
      this.calibrationSamples.push({
        x: data.acceleration.x,
        y: data.acceleration.y,
        z: data.acceleration.z
      });
      
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / duration) * 100);
      document.getElementById('calibBar').style.setProperty('--progress', `${progress}%`);
      document.getElementById('calibStatus').textContent = `校準中... ${Math.ceil((duration - elapsed)/1000)}秒`;
      
      if (elapsed >= duration) {
        this.sensors.offTempData(collectSample);
        this.finishCalibration();
      }
    };
    
    this.sensors.onTempData(collectSample);
  }

  finishCalibration() {
    if (this.calibrationSamples.length === 0) {
      document.getElementById('calibStatus').textContent = '校準失敗：無資料';
      this.isCalibrating = false;
      return;
    }
    
    // Average the samples (phone at rest should read ~0, 0, 9.81)
    const sum = this.calibrationSamples.reduce((a, s) => ({
      x: a.x + s.x, y: a.y + s.y, z: a.z + s.z
    }), { x: 0, y: 0, z: 0 });
    
    this.calibrationData = {
      x: sum.x / this.calibrationSamples.length,
      y: sum.y / this.calibrationSamples.length,
      z: sum.z / this.calibrationSamples.length - 9.81 // remove gravity
    };
    
    document.getElementById('calibStatus').textContent = 
      `校準完成！偏移: X=${this.calibrationData.x.toFixed(2)}, Y=${this.calibrationData.y.toFixed(2)}, Z=${this.calibrationData.z.toFixed(2)}`;
    
    this.isCalibrating = false;
    
    const btn = document.querySelector('#calibModal .btn-primary');
    btn.disabled = false;
    btn.textContent = '重新校準';
    btn.onclick = () => this.startCalibrationProcess();
    
    setTimeout(() => this.hideModal('calibModal'), 2000);
  }

  start() {
    if (this.isRecording) return;
    
    this.isRecording = true;
    this.currentTrip = {
      id: Date.now(),
      startTime: Date.now(),
      endTime: null,
      sensorData: [],
      gpsData: [],
      metadata: {
        maxSpeed: 0,
        maxG: 0,
        avgComfort: 100,
        distance: 0
      }
    };
    
    document.getElementById('btnStart').disabled = true;
    document.getElementById('btnStop').disabled = false;
    document.getElementById('recStatus').classList.add('active');
    
    // Reset peak values
    document.getElementById('peakG').textContent = '峰值: 0.00 G';
    document.getElementById('maxSpeed').textContent = '最高: 0 km/h';
  }

  async stop() {
    if (!this.isRecording || !this.currentTrip) return;
    
    this.isRecording = false;
    this.currentTrip.endTime = Date.now();
    
    // Calculate metadata
    this.calculateTripMetadata();
    
    // Save to storage
    await this.storage.saveTrip(this.currentTrip);
    
    // Reset UI
    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnStop').disabled = true;
    document.getElementById('recStatus').classList.remove('active');
    
    // Reload trips list
    this.loadTrips();
    
    this.currentTrip = null;
  }

  calculateTripMetadata() {
    if (!this.currentTrip) return;
    
    const gps = this.currentTrip.gpsData;
    if (gps.length < 2) return;
    
    let maxSpeed = 0;
    let maxG = 0;
    let totalComfort = 0;
    let comfortCount = 0;
    let distance = 0;
    
    for (let i = 1; i < gps.length; i++) {
      maxSpeed = Math.max(maxSpeed, gps[i].speed);
      
      // Haversine distance
      const R = 6371000;
      const lat1 = gps[i-1].lat * Math.PI/180;
      const lat2 = gps[i].lat * Math.PI/180;
      const dLat = (gps[i].lat - gps[i-1].lat) * Math.PI/180;
      const dLon = (gps[i].lon - gps[i-1].lon) * Math.PI/180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
      distance += 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    
    const sensor = this.currentTrip.sensorData;
    for (const s of sensor) {
      const g = Math.sqrt(s.gx*s.gx + s.gy*s.gy + (s.gz-1)*(s.gz-1));
      maxG = Math.max(maxG, g);
    }
    
    // Comfort average (simplified) - use configurable weights
    for (const s of sensor) {
      const lateralG = Math.abs(s.gy);
      const longG = Math.abs(s.gx);
      const vertG = Math.abs(s.gz - 1); // deviation from 1G
      const w = this.comfortWeights;
      const penalty = (lateralG * w.lateral) + (longG * w.longitudinal) + (vertG * w.vertical);
      totalComfort += Math.max(0, w.baseScore - penalty);
      comfortCount++;
    }
    
    this.currentTrip.metadata = {
      maxSpeed: Math.round(maxSpeed * 10) / 10,
      maxG: Math.round(maxG * 100) / 100,
      avgComfort: comfortCount ? Math.round(totalComfort / comfortCount) : 100,
      distance: Math.round(distance / 1000 * 100) / 100 // km
    };
  }

  async exportData() {
    const trips = await this.storage.getAllTrips();
    if (trips.length === 0) {
      alert('無資料可匯出');
      return;
    }
    
    // Export as JSON
    const json = JSON.stringify(trips, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drive-trips-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    // Also offer CSV
    setTimeout(() => this.exportCSV(trips), 100);
  }

  exportCSV(trips) {
    // Flatten trips to CSV rows
    const rows = ['tripId,tripStart,tripEnd,type,timestamp,lat,lon,speed,ax,ay,az,gx,gy,gz'];
    
    for (const trip of trips) {
      const start = new Date(trip.startTime).toISOString();
      const end = trip.endTime ? new Date(trip.endTime).toISOString() : '';
      
      for (const g of trip.gpsData) {
        rows.push(`${trip.id},${start},${end},gps,${new Date(g.t).toISOString()},${g.lat},${g.lon},${g.speed},,,,,,`);
      }
      for (const s of trip.sensorData) {
        rows.push(`${trip.id},${start},${end},sensor,${new Date(s.t).toISOString()},,,${s.ax},${s.ay},${s.az},${s.gx},${s.gy},${s.gz}`);
      }
    }
    
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drive-trips-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async clearData() {
    if (!confirm('確定要清除所有本地行程資料嗎？此操作無法復原。')) return;
    await this.storage.clearAll();
    this.loadTrips();
  }

  async loadTrips() {
    const trips = await this.storage.getAllTrips();
    const listEl = document.getElementById('tripList');
    
    if (trips.length === 0) {
      listEl.innerHTML = '<div class="trip-empty">尚無歷史行程</div>';
      return;
    }
    
    listEl.innerHTML = trips.map(trip => {
      const start = new Date(trip.startTime);
      const duration = trip.endTime ? 
        ((trip.endTime - trip.startTime) / 60000).toFixed(1) : '進行中';
      const meta = trip.metadata || {};
      
      return `
        <div class="trip-item">
          <div class="trip-info">
            <span class="trip-date">${start.toLocaleString('zh-TW')}</span>
            <span class="trip-meta">
              時長: ${duration}分 | 
              距離: ${meta.distance || 0}km | 
              最高速: ${meta.maxSpeed || 0}km/h | 
              峰值G: ${meta.maxG || 0}G | 
              舒適度: ${meta.avgComfort || 100}分
            </span>
          </div>
          <div class="trip-actions">
            <button class="trip-btn btn-secondary" onclick="app.exportSingleTrip(${trip.id})">匯出</button>
            <button class="trip-btn btn-ghost" onclick="app.deleteTrip(${trip.id})">刪除</button>
          </div>
        </div>
      `;
    }).join('');
  }

  async exportSingleTrip(id) {
    const trips = await this.storage.getAllTrips();
    const trip = trips.find(t => t.id === id);
    if (!trip) return;
    
    const json = JSON.stringify([trip], null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trip-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async deleteTrip(id) {
    if (!confirm('確定刪除此行程？')) return;
    await this.storage.deleteTrip(id);
    this.loadTrips();
  }

  startPeriodicUpdates() {
    // Weather/road updates every 5 minutes
    this.weatherUpdateInterval = setInterval(() => {
      if (this.sensors.lastGPS) {
        this.api.updateWeather(this.sensors.lastGPS.latitude, this.sensors.lastGPS.longitude)
          .then(w => this.renderWeather(w));
        this.api.updateRoad(this.sensors.lastGPS.latitude, this.sensors.lastGPS.longitude)
          .then(r => this.renderRoad(r));
      }
    }, 5 * 60 * 1000);
  }

  showModal(id) {
    document.getElementById(id).classList.remove('hidden');
  }

  hideModal(id) {
    document.getElementById(id).classList.add('hidden');
  }
}

// Global app instance
const app = new DriveMonitorApp();
window.app = app;

// Expose calibration start
// Note: startCalibration, startCalibrationProcess, startSensors are already class methods
// They are accessible via app.methodName() without explicit export
// The following assignments were causing infinite recursion - removed
export { app };