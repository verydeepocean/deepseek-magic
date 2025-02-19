class PromptDB {
  constructor() {
    this.dbName = 'PromptStorage';
    this.dbVersion = 1;
    this.storeName = 'prompts';
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { 
            keyPath: 'id'
          });
        }
      };
    });
  }

  async addPrompt(prompt) {
    return new Promise((resolve, reject) => {
      try {
        const store = this.db
          .transaction(this.storeName, 'readwrite')
          .objectStore(this.storeName);
        
        const request = store.add(prompt);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async updatePrompt(prompt) {
    return new Promise((resolve, reject) => {
      try {
        const store = this.db
          .transaction(this.storeName, 'readwrite')
          .objectStore(this.storeName);
        
        const request = store.put(prompt);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async getAllPrompts() {
    return new Promise((resolve, reject) => {
      try {
        const store = this.db
          .transaction(this.storeName, 'readonly')
          .objectStore(this.storeName);
        
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async deletePrompt(id) {
    return new Promise((resolve, reject) => {
      try {
        const store = this.db
          .transaction(this.storeName, 'readwrite')
          .objectStore(this.storeName);
        
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }
}

class FavoritesDB {
  constructor() {
    this.dbName = 'favorites_db';
    this.dbVersion = 1;
    this.storeName = 'favorites';
    this.db = null;
  }

  async init() {
    if (this.db) return;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Error opening database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('url', 'url', { unique: false });
          store.createIndex('date', 'date');
          console.log('Object store created');
        }
      };
    });
  }

  async addFavorite(favorite) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        const request = store.add(favorite);

        request.onsuccess = () => {
          console.log('Favorite added successfully:', favorite);
          resolve(favorite);
        };

        request.onerror = () => {
          console.error('Error adding favorite:', request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error('Error in addFavorite:', error);
        reject(error);
      }
    });
  }

  async getFavorites() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          console.log('Got favorites:', request.result);
          resolve(request.result);
        };

        request.onerror = () => {
          console.error('Error getting favorites:', request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error('Error in getFavorites:', error);
        reject(error);
      }
    });
  }

  async deleteFavorite(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(id);

        request.onsuccess = () => {
          console.log('Favorite deleted successfully:', id);
          resolve();
        };

        request.onerror = () => {
          console.error('Error deleting favorite:', request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error('Error in deleteFavorite:', error);
        reject(error);
      }
    });
  }
}

// Export the classes and instances
export const promptDB = new PromptDB();
export const favoritesDB = new FavoritesDB(); 