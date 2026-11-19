// Storage Manager - IndexedDB for trip persistence
export class StorageManager {
  constructor() {
    this.db = null;
    this.dbName = 'DriveMonitorDB';
    this.version = 1;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Trips store
        if (!db.objectStoreNames.contains('trips')) {
          const tripStore = db.createObjectStore('trips', { keyPath: 'id' });
          tripStore.createIndex('startTime', 'startTime', { unique: false });
        }
        
        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  async saveTrip(trip) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('trips', 'readwrite');
      const store = tx.objectStore('trips');
      const request = store.put(trip);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllTrips() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('trips', 'readonly');
      const store = tx.objectStore('trips');
      const index = store.index('startTime');
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result.reverse()); // newest first
      request.onerror = () => reject(request.error);
    });
  }

  async getTrip(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('trips', 'readonly');
      const store = tx.objectStore('trips');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTrip(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('trips', 'readwrite');
      const store = tx.objectStore('trips');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('trips', 'readwrite');
      const store = tx.objectStore('trips');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Settings
  async setSetting(key, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSetting(key, defaultValue = null) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value ?? defaultValue);
      request.onerror = () => reject(request.error);
    });
  }
}