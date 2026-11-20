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
    // Try to load uPlot from CDN, fallback to simple canvas if fails
    if (typeof window.uPlot === 'undefined') {
      try {
        await this.loadUPlot();
      } catch (e) {
        console.warn('uPlot CDN failed, using fallback canvas renderer:', e);
        this.uPlot = null;
        this.useFallback = true;
        this.createFallbackCharts();
        this.createLegends();
        return;
      }
    }
    this.uPlot = window.uPlot;
    this.useFallback = false;
    this.createCharts();
    this.createLegends();
  }

  loadUPlot() {
    return new Promise((resolve, reject) => {
      if (window.uPlot) return resolve();
      
      const script = document.createElement('script');
      // uPlot uses uPlot.iife.min.js for IIFE (browser) builds
      script.src = 'https://cdn.jsdelivr.net/npm/uplot@1.6.27/dist/uPlot.iife.min.js';
      script.onload = () => {
        // Verify uPlot actually loaded
        if (typeof window.uPlot !== 'undefined') {
          resolve();
        } else {
          reject(new Error('uPlot script loaded but window.uPlot not defined'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load uPlot from CDN'));
      document.head.appendChild(script);
      
      // Timeout fallback
      setTimeout(() => {
        if (typeof window.uPlot === 'undefined') {
          reject(new Error('uPlot load timeout'));
        }
      }, 5000);
    });
  }

  createFallbackCharts() {
    // Simple canvas-based chart renderer as fallback
    this.fallbackCharts = {};
    
    const chartConfigs = [
      { id: 'accelChart', series: ['X', 'Y', 'Z'], colors: [this.colors.x, this.colors.y, this.colors.z] },
      { id: 'gforceChart', series: ['橫向', '縱向', '垂直'], colors: [this.colors.gx, this.colors.gy, this.colors.gz] },
      { id: 'vibeChart', series: ['震動'], colors: [this.colors.vibe] },
      { id: 'speedChart', series: ['速度'], colors: [this.colors.speed] }
    ];
    
    for (const config of chartConfigs) {
      const canvas = document.getElementById(config.id);
      if (canvas) {
        this.fallbackCharts[config.id] = new SimpleChart(canvas, config);
      }
    }
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
        { label: 'X', stroke: this.colors.x, width: 1.5 },
        { label: 'Y', stroke: this.colors.y, width: 1.5 },
        { label: 'Z', stroke: this.colors.z, width: 1.5 }
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
          { label: '震動幅度', stroke: this.colors.vibe, width: 1, fill: 'rgba(163,113,247,0.1)' }
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
          { label: '速度', stroke: this.colors.speed, width: 2, fill: 'rgba(210,153,34,0.15)' }
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
    if (this.useFallback) {
      this.fallbackCharts['accelChart']?.setData(this.accelData);
    } else {
      this.accelChart?.setData(this.accelData);
    }
  }

  updateGForce(timestamp, gx, gy, gz) {
    this.pushData(this.gforceData, this.maxPoints, timestamp, gy, gx, gz); // Note: gy=lateral, gx=longitudinal
    if (this.useFallback) {
      this.fallbackCharts['gforceChart']?.setData(this.gforceData);
    } else {
      this.gforceChart?.setData(this.gforceData);
    }
  }

  updateVibration(timestamp, magnitude) {
    this.pushData(this.vibeData, this.maxPoints, timestamp, magnitude);
    if (this.useFallback) {
      this.fallbackCharts['vibeChart']?.setData(this.vibeData);
    } else {
      this.vibeChart?.setData(this.vibeData);
    }
  }

  updateSpeed(timestamp, speed) {
    this.pushData(this.speedData, this.maxPoints, timestamp, speed);
    if (this.useFallback) {
      this.fallbackCharts['speedChart']?.setData(this.speedData);
    } else {
      this.speedChart?.setData(this.speedData);
    }
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
      const g = Math.sqrt(s.gx*s.gx + s.gy*s.gy + (s.gz-1)*(s.gz-1));
      this.pushData(gforceData, s.t, s.gy, s.gx, s.gz - 1);
      // Vibration: net acceleration excluding gravity
      const netAz = s.az - 9.81;
      this.pushData(vibeData, s.t, Math.sqrt(s.ax*s.ax + s.ay*s.ay + netAz*netAz));
    }
    
    for (const g of trip.gpsData) {
      this.pushData(speedData, g.t, g.speed);
    }
    
    this.accelData = accelData;
    this.gforceData = gforceData;
    this.vibeData = vibeData;
    this.speedData = speedData;
    
    if (this.useFallback) {
      this.fallbackCharts['accelChart']?.setData(this.accelData);
      this.fallbackCharts['gforceChart']?.setData(this.gforceData);
      this.fallbackCharts['vibeChart']?.setData(this.vibeData);
      this.fallbackCharts['speedChart']?.setData(this.speedData);
    } else {
      this.accelChart?.setData(this.accelData);
      this.gforceChart?.setData(this.gforceData);
      this.vibeChart?.setData(this.vibeData);
      this.speedChart?.setData(this.speedData);
    }
  }

  clear() {
    this.accelData = [[], [], [], []];
    this.gforceData = [[], [], [], []];
    this.vibeData = [[], []];
    this.speedData = [[], []];
    
    if (this.useFallback) {
      this.fallbackCharts['accelChart']?.setData(this.accelData);
      this.fallbackCharts['gforceChart']?.setData(this.gforceData);
      this.fallbackCharts['vibeChart']?.setData(this.vibeData);
      this.fallbackCharts['speedChart']?.setData(this.speedData);
    } else {
      this.accelChart?.setData(this.accelData);
      this.gforceChart?.setData(this.gforceData);
      this.vibeChart?.setData(this.vibeData);
      this.speedChart?.setData(this.speedData);
    }
  }

  destroy() {
    if (this.useFallback) {
      for (const chart of Object.values(this.fallbackCharts)) {
        chart?.destroy();
      }
    } else {
      this.accelChart?.destroy();
      this.gforceChart?.destroy();
      this.vibeChart?.destroy();
      this.speedChart?.destroy();
    }
  }
}

// Simple Canvas Chart fallback (no external dependencies)
class SimpleChart {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.config = config;
    this.data = null;
    this.width = canvas.width;
    this.height = canvas.height;
    
    // Make canvas responsive
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.width = rect.width;
    this.height = rect.height;
    this.render();
  }
  
  setData(data) {
    this.data = data;
    this.render();
  }
  
  render() {
    if (!this.data || this.data.length === 0 || this.data[0].length === 0) return;
    
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const padding = { top: 10, right: 10, bottom: 25, left: 45 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    
    // Clear canvas
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, w, h);
    
    // Find Y range across all series (skip time column)
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < this.data.length; i++) {
      for (const val of this.data[i]) {
        if (val < minY) minY = val;
        if (val > maxY) maxY = val;
      }
    }
    if (minY === maxY) {
      minY = minY - 1;
      maxY = maxY + 1;
    }
    
    // Add 10% padding
    const range = maxY - minY;
    minY -= range * 0.1;
    maxY += range * 0.1;
    
    // Draw grid
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartH * i / gridLines);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      
      // Y axis labels
      const val = maxY - (range * 1.2 * i / gridLines);
      ctx.fillStyle = '#8b949e';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(1), padding.left - 5, y + 4);
    }
    
    // Draw X axis
    ctx.beginPath();
    ctx.moveTo(padding.left, h - padding.bottom);
    ctx.lineTo(w - padding.right, h - padding.bottom);
    ctx.stroke();
    
    // Draw series - need timeData first for dynamic time label
    const timeData = this.data[0];
    const maxTime = Math.max(...timeData);
    const minTime = Math.min(...timeData);
    const timeRange = maxTime - minTime || 1;
    
    // X axis label (time) - dynamic based on actual data range
    ctx.fillStyle = '#8b949e';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    const timeSpanSec = (maxTime - minTime) / 1000;
    const timeLabel = timeSpanSec >= 60 
      ? `時間 (最近 ${Math.round(timeSpanSec / 60)} 分鐘)`
      : `時間 (最近 ${Math.round(timeSpanSec)} 秒)`;
    ctx.fillText(timeLabel, w / 2, h - 5);
    
    for (let i = 1; i < this.data.length; i++) {
      const seriesData = this.data[i];
      const color = this.config.colors[i - 1] || '#58a6ff';
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      
      for (let j = 0; j < seriesData.length; j++) {
        const x = padding.left + ((timeData[j] - minTime) / timeRange) * chartW;
        const y = padding.top + ((maxY - seriesData[j]) / (maxY - minY)) * chartH;
        
        if (j === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.stroke();
    }
    
    // Draw legend
    let legendX = padding.left;
    const legendY = padding.top - 5;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < this.config.series.length; i++) {
      const color = this.config.colors[i] || '#58a6ff';
      ctx.fillStyle = color;
      ctx.fillRect(legendX, legendY - 8, 8, 8);
      ctx.fillStyle = '#8b949e';
      ctx.fillText(this.config.series[i], legendX + 12, legendY);
      legendX += this.config.series[i].length * 6 + 30;
    }
  }
  
  destroy() {
    window.removeEventListener('resize', this.resize);
  }
}