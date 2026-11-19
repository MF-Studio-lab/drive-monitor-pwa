// API Manager - Weather (Open-Meteo) & Road (TDX)
export class APIManager {
  constructor() {
    this.weatherCache = null;
    this.weatherCacheTime = 0;
    this.roadCache = null;
    this.roadCacheTime = 0;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    
    // TDX credentials - user needs to set these
    this.tdxClientId = null;
    this.tdxClientSecret = null;
    this.tdxToken = null;
    this.tdxTokenExpiry = 0;
  }

  // Set TDX credentials (call once at startup)
  setTDXCredentials(clientId, clientSecret) {
    this.tdxClientId = clientId;
    this.tdxClientSecret = clientSecret;
  }

  // ===== Weather API (Open-Meteo) =====
  async updateWeather(lat, lon) {
    const now = Date.now();
    if (this.weatherCache && now - this.weatherCacheTime < this.CACHE_DURATION) {
      return this.weatherCache;
    }

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=Asia%2FTaipei`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.current_weather) {
        const cw = data.current_weather;
        // Map weather code to description
        const weatherCodes = {
          0: { desc: '晴朗', icon: 'clear' },
          1: { desc: '晴時多雲', icon: 'clouds' },
          2: { desc: '部分多雲', icon: 'clouds' },
          3: { desc: '陰天', icon: 'clouds' },
          45: { desc: '霧', icon: 'fog' },
          48: { desc: '凍霧', icon: 'fog' },
          51: { desc: '輕微毛毛雨', icon: 'rain' },
          53: { desc: '中度毛毛雨', icon: 'rain' },
          55: { desc: '大毛毛雨', icon: 'rain' },
          61: { desc: '輕微雨', icon: 'rain' },
          63: { desc: '中雨', icon: 'rain' },
          65: { desc: '大雨', icon: 'rain' },
          71: { desc: '輕微雪', icon: 'snow' },
          73: { desc: '中雪', icon: 'snow' },
          75: { desc: '大雪', icon: 'snow' },
          80: { desc: '輕微陣雨', icon: 'rain' },
          81: { desc: '中陣雨', icon: 'rain' },
          82: { desc: '大陣雨', icon: 'rain' },
          95: { desc: '雷陣雨', icon: 'thunder' }
        };
        
        const wcode = weatherCodes[cw.weathercode] || { desc: '未知', icon: 'clear' };
        
        this.weatherCache = {
          temp: cw.temperature,
          wind: cw.windspeed,
          code: wcode.icon,
          desc: wcode.desc,
          humidity: data.current_weather_relativehumidity || 60, // Not in current_weather
          time: cw.time
        };
        this.weatherCacheTime = now;
        return this.weatherCache;
      }
    } catch (e) {
      console.warn('Weather API error:', e);
    }
    return null;
  }

  // ===== TDX Road Conditions =====
  async getTDXToken() {
    if (!this.tdxClientId || !this.tdxClientSecret) {
      console.warn('TDX credentials not set');
      return null;
    }
    
    const now = Date.now();
    if (this.tdxToken && now < this.tdxTokenExpiry) {
      return this.tdxToken;
    }
    
    try {
      const response = await fetch('https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.tdxClientId,
          client_secret: this.tdxClientSecret
        })
      });
      
      const data = await response.json();
      if (data.access_token) {
        this.tdxToken = data.access_token;
        this.tdxTokenExpiry = now + (data.expires_in - 60) * 1000; // 1 min buffer
        return this.tdxToken;
      }
    } catch (e) {
      console.warn('TDX token error:', e);
    }
    return null;
  }

  async updateRoad(lat, lon) {
    const now = Date.now();
    if (this.roadCache && now - this.roadCacheTime < this.CACHE_DURATION) {
      return this.roadCache;
    }
    
    // Try TDX first
    const token = await this.getTDXToken();
    if (token) {
      try {
        // TDX API for road congestion - need to find nearest road section
        // This is a simplified version; real implementation needs road matching
        const url = `https://tdx.transportdata.tw/api/basic/v2/Road/Traffic/Speed/GeoJSON?$format=JSON&$filter=contains(Geometry, '${lon} ${lat}')`;
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
          // Process TDX data
          const speeds = data.features.map(f => f.properties?.Speed || 0).filter(s => s > 0);
          const avgSpeed = speeds.length ? speeds.reduce((a,b)=>a+b,0)/speeds.length : 0;
          
          let congestion = 'low';
          let desc = '車流順暢';
          if (avgSpeed < 20) { congestion = 'high'; desc = '嚴重擁塞'; }
          else if (avgSpeed < 40) { congestion = 'moderate'; desc = '車流量大'; }
          
          this.roadCache = { congestion, desc, avgSpeed: Math.round(avgSpeed), source: 'TDX' };
          this.roadCacheTime = now;
          return this.roadCache;
        }
      } catch (e) {
        console.warn('TDX road API error:', e);
      }
    }
    
    // Fallback: simple heuristic based on time/location
    // In production, you'd use a proper road matching service
    this.roadCache = this.estimateRoadCondition(lat, lon);
    this.roadCacheTime = now;
    return this.roadCache;
  }

  estimateRoadCondition(lat, lon) {
    // Very rough estimation based on hour and urban/rural heuristic
    const hour = new Date().getHours();
    const isUrban = this.isLikelyUrban(lat, lon);
    
    let congestion = 'low';
    let desc = '車流順暢';
    
    if (isUrban) {
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
        congestion = 'moderate';
        desc = '尖峰時段車多';
      } else if (hour >= 22 || hour <= 5) {
        congestion = 'low';
        desc = '夜間車流稀少';
      }
    }
    
    return { congestion, desc, avgSpeed: isUrban ? 40 : 70, source: 'estimate' };
  }

  isLikelyUrban(lat, lon) {
    // Major Taiwan cities bounding boxes (rough)
    const cities = [
      { name: '台北', lat: [25.0, 25.2], lon: [121.4, 121.6] },
      { name: '新北', lat: [24.9, 25.2], lon: [121.3, 121.6] },
      { name: '桃園', lat: [24.9, 25.1], lon: [121.1, 121.4] },
      { name: '台中', lat: [24.1, 24.3], lon: [120.5, 120.8] },
      { name: '台南', lat: [22.9, 23.1], lon: [120.1, 120.3] },
      { name: '高雄', lat: [22.5, 22.8], lon: [120.2, 120.4] },
      { name: '基隆', lat: [25.1, 25.2], lon: [121.7, 121.8] },
      { name: '新竹', lat: [24.7, 24.9], lon: [120.9, 121.1] },
      { name: '嘉義', lat: [23.4, 23.6], lon: [120.4, 120.6] }
    ];
    
    return cities.some(c => 
      lat >= c.lat[0] && lat <= c.lat[1] && lon >= c.lon[0] && lon <= c.lon[1]
    );
  }

  // ===== Reverse Geocoding (OpenStreetMap Nominatim) =====
  async reverseGeocode(lat, lon) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=zh-TW`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'DriveMonitor/1.0 (https://github.com/your-repo)' }
      });
      const data = await response.json();
      
      if (data.display_name) {
        // Simplify address for display
        const addr = data.address;
        const parts = [];
        if (addr.road) parts.push(addr.road);
        if (addr.suburb) parts.push(addr.suburb);
        else if (addr.city_district) parts.push(addr.city_district);
        else if (addr.county) parts.push(addr.county);
        else if (addr.city) parts.push(addr.city);
        return parts.join('、') || data.display_name.split(',').slice(0,3).join(', ');
      }
    } catch (e) {
      console.warn('Geocode error:', e);
    }
    return null;
  }
}