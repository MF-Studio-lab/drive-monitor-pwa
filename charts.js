// Chart Manager using uPlot
export class ChartManager {
  constructor() {
    this.uPlot = null;
    this.accelChart = null;
    this.gforceChart = null;
    this.vibeChart = null;
    this.speedChart = null;
    
    // Data buffers (rolling window)
    this.maxPoints = 300; // ~30 seconds at 10Hz
    this.accelData = [[], [], [], []]; // time, ax, ay, az
    this.gforceData = [[], [], [], []]; // time, gx, gy, gz
    this.vibeData = [[], []]; // time, magnitude
    this.speedData = [[], []]; // time, speed
    
    this.colors = {
      x: '#58a6ff',  // blue
      y: '#f78166',  // orange
      z: '#3fb950',  // green
      gx: '#58a6ff',
      gy: '#f78166',
      gz: '#3fb950',
      vibe: '#a371f7',
      speed: '#d29922'
    };
  }

  async init() {
    // Load uPlot from CDN
    if (typeof window.uPlot === 'undefined') {
      await this.loadUPlot();
    }
    this.uPlot = window.uPlot;
    this.createCharts();
    this.createLegends();
  }

  loadUPlot() {
    return new Promise((resolve, reject) => {
      if (window.uPlot) return resolve();
      
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/uplot@1.6.27/dist/uPlot.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load uPlot'));
      document.head.appendChild(script);
    });
  }

  createCharts() {
    const opts = {
      width: 600,
      height: 200,
      title: '',
      axes: [
        { space: 30 }, // x axis (time)
        { space: 40, grid: { stroke: '#30363d' } } // y axis
      ],
      scales: {
        x: { time: true },
        y: { auto: true }
      },
      series: [
        {}, // x axis (time)
        { label: 'X', stroke: this.colors.x, width: 1.5, paths: 'linear' },
        { label: 'Y', stroke: this.colors.y, width: 1.5, paths: 'linear' },
        { label: 'Z', stroke: this.colors.z, width: 1.5, paths: 'linear' }
      ],
      cursor: { show: true, focus: { prox: 16 } },
      legend: { show: false },
      hooks: {
        draw: [this.drawGrid.bind(this)]
      }
    };

    // Acceleration Chart
    this.accelChart = new this.uPlot(
      { ...opts, title: '' },
      this.accelData,
      document.getElementById('accelChart')
    );

    // G-Force Chart
    this.gforceChart = new this.uPlot(
      { 
        ...opts, 
        height: 200,
        series: [
          {},
          { label: '橫向 (Gy)', stroke: this.colors.gx, width: 1.5 },
          { label: '縱向 (Gx)', stroke: this.colors.gy, width: 1.5 },
          { label: '垂直 (Gz)', stroke: this.colors.gz, width: 1.5 }
        ]
      },
      this.gforceData,
      document.getElementById('gforceChart')
    );

    // Vibration Chart (single series, smaller height)
    this.vibeChart = new this.uPlot(
      {
        width: 600,
        height: 160,
        axes: [
          { space: 30 },
          { space: 40, grid: { stroke: '#30363d' } }
        ],
        scales: { x: { time: true }, y: { auto: true, min: 0 } },
        series: [
          {},
          { label: '震動幅度', stroke: this.colors.vibe, width: 1, fill: 'rgba(163,113,247,0.1)', paths: 'linear' }
        ],
        cursor: { show: true },
        legend: { show: false },
        hooks: { draw: [this.drawGrid.bind(this)] }
      },
      this.vibeData,
      document.getElementById('vibeChart')
    );

    // Speed Chart
    this.speedChart = new this.uPlot(
      {
        width: 600,
        height: 160,
        axes: [
          { space: 30 },
          { space: 40, grid: { stroke: '#30363d' } }
        ],
        scales: { x: { time: true }, y: { auto: true, min: 0 } },
        series: [
          {},
          { label: '速度', stroke: this.colors.speed, width: 2, fill: 'rgba(210,153,34,0.15)', paths: 'linear' }
        ],
        cursor: { show: true },
        legend: { show: false },
        hooks: { draw: [this.drawGrid.bind(this)] }
      },
      this.speedData,
      document.getElementById('speedChart')
    );
  }

  drawGrid(u) {
    // Custom grid styling already handled by CSS
  }

  createLegends() {
    // Accel Legend
    document.getElementById('accelLegend').innerHTML = `
      <span class="legend-item"><span class="legend-color" style="background:${this.colors.x}"></span>X 軸 (前後)</span>
      <span class="legend-item"><span class="legend-color" style="background:${this.colors.y}"></span>Y 軸 (左右)</span>
      <span class="legend-item"><span class="legend-color" style="background:${this.colors.z}"></span>Z 軸 (上下)</span>
    `;

    // G-Force Legend
    document.getElementById('gforceLegend').innerHTML = `
      <span class="legend-item"><span class="legend-color" style="background:${this.colors.gx}"></span>橫向 G (Gy)</span>
      <span class="legend-item"><span class="legend-color" style="background:${this.colors.gy}"></span>縱向 G (Gx)</span>
      <span class="legend-item"><span class="legend-color" style="background:${this.colors.gz}"></span>垂直 G (Gz)</span>
    `;

    // Vibration Legend
    document.getElementById('vibeLegend').innerHTML = `
      <span class="legend-item"><span class="legend-color" style="background:${this.colors.vibe}"></span>震動合成值</span>
    `;

    // Speed Legend
    document.getElementById('speedLegend').innerHTML = `
      <span class="legend-item"><span class="legend-color" style="background:${this.colors.speed}"></span>車速 (km/h)</span>
    `;
  }

  pushData(buffer, maxLen, ...values) {
    for (let i = 0; i < values.length; i++) {
      buffer[i].push(values[i]);
      if (buffer[i].length > maxLen) buffer[i].shift();
    }
  }

  updateAccel(timestamp, ax, ay, az) {
    this.pushData(this.accelData, this.maxPoints, timestamp, ax, ay, az);
    this.accelChart?.setData(this.accelData);
  }

  updateGForce(timestamp, gx, gy, gz) {
    this.pushData(this.gforceData, this.maxPoints, timestamp, gy, gx, gz); // Note: gy=lateral, gx=longitudinal
    this.gforceChart?.setData(this.gforceData);
  }

  updateVibration(timestamp, magnitude) {
    this.pushData(this.vibeData, this.maxPoints, timestamp, magnitude);
    this.vibeChart?.setData(this.vibeData);
  }

  updateSpeed(timestamp, speed) {
    this.pushData(this.speedData, this.maxPoints, timestamp, speed);
    this.speedChart?.setData(this.speedData);
  }

  // For trip replay - load historical data
  loadTripData(trip) {
    if (!trip) return;
    
    const accelData = [[], [], [], []];
    const gforceData = [[], [], [], []];
    const vibeData = [[], []];
    const speedData = [[], []];
    
    for (const s of trip.sensorData) {
      this.pushData(accelData, s.t, s.ax, s.ay, s.az);
      const g = Math.sqrt(s.gx*s.gx + s.gy*s.gy + (s.gz+1)*(s.gz+1)) - 1;
      this.pushData(gforceData, s.t, s.gy, s.gx, s.gz);
      this.pushData(vibeData, s.t, Math.sqrt(s.ax*s.ax + s.ay*s.ay + s.az*s.az));
    }
    
    for (const g of trip.gpsData) {
      this.pushData(speedData, g.t, g.speed);
    }
    
    this.accelData = accelData;
    this.gforceData = gforceData;
    this.vibeData = vibeData;
    this.speedData = speedData;
    
    this.accelChart?.setData(this.accelData);
    this.gforceChart?.setData(this.gforceData);
    this.vibeChart?.setData(this.vibeData);
    this.speedChart?.setData(this.speedData);
  }

  clear() {
    this.accelData = [[], [], [], []];
    this.gforceData = [[], [], [], []];
    this.vibeData = [[], []];
    this.speedData = [[], []];
    
    this.accelChart?.setData(this.accelData);
    this.gforceChart?.setData(this.gforceData);
    this.vibeChart?.setData(this.vibeData);
    this.speedChart?.setData(this.speedData);
  }

  destroy() {
    this.accelChart?.destroy();
    this.gforceChart?.destroy();
    this.vibeChart?.destroy();
    this.speedChart?.destroy();
  }
}