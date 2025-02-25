class PromptDB {
  constructor() {
    this.dbName = 'PromptStorage';
    this.dbVersion = 2;
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
          const store = db.createObjectStore(this.storeName, { 
            keyPath: 'id'
          });
          store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        } else if (event.oldVersion < 2) {
          const store = event.target.transaction.objectStore(this.storeName);
          if (!store.indexNames.contains('tags')) {
            store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
          }
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

  async clearAll() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();

        request.onsuccess = () => {
          console.log('Prompts store cleared successfully');
          resolve();
        };

        request.onerror = () => {
          console.error('Error clearing prompts store:', request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error('Error in clearAll:', error);
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

  async clearAll() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();

        request.onsuccess = () => {
          console.log('Favorites store cleared successfully');
          resolve();
        };

        request.onerror = () => {
          console.error('Error clearing favorites store:', request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error('Error in clearAll:', error);
        reject(error);
      }
    });
  }
}

class NotesDB {
  constructor() {
    this.dbName = 'notes_db';
    this.dbVersion = 2;
    this.storeName = 'notes';
    this.db = null;
  }

  async init() {
    if (this.db) return;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Error opening notes database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('Notes database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { 
            keyPath: 'id',
            autoIncrement: true 
          });
          store.createIndex('title', 'title', { unique: false });
          store.createIndex('date', 'date');
          store.createIndex('pinned', 'pinned', { unique: false });
          console.log('Notes store created');
        } else if (event.oldVersion < 2) {
          const store = event.target.transaction.objectStore(this.storeName);
          if (!store.indexNames.contains('pinned')) {
            store.createIndex('pinned', 'pinned', { unique: false });
          }
        }
      };
    });
  }

  async clearAll() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();

        request.onsuccess = () => {
          console.log('Notes store cleared successfully');
          resolve();
        };

        request.onerror = () => {
          console.error('Error clearing notes store:', request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error('Error in clearAll:', error);
        reject(error);
      }
    });
  }

  async addNote(note) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        const noteWithDefaults = {
          ...note,
          date: new Date().toISOString(),
          pinned: note.pinned || false
        };
        
        const request = store.add(noteWithDefaults);

        request.onsuccess = () => {
          console.log('Note added successfully:', noteWithDefaults);
          resolve(noteWithDefaults);
        };

        request.onerror = () => {
          console.error('Error adding note:', request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error('Error in addNote:', error);
        reject(error);
      }
    });
  }

  async updateNote(note) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        const noteWithDefaults = {
          ...note,
          date: new Date().toISOString(),
          pinned: note.pinned !== undefined ? note.pinned : false
        };
        
        const request = store.put(noteWithDefaults);

        request.onsuccess = () => {
          console.log('Note updated successfully:', noteWithDefaults);
          resolve(noteWithDefaults);
        };

        request.onerror = () => {
          console.error('Error updating note:', request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error('Error in updateNote:', error);
        reject(error);
      }
    });
  }

  async getAllNotes() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          console.log('Got notes:', request.result);
          resolve(request.result);
        };

        request.onerror = () => {
          console.error('Error getting notes:', request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error('Error in getAllNotes:', error);
        reject(error);
      }
    });
  }

  async deleteNote(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(id);

        request.onsuccess = () => {
          console.log('Note deleted successfully:', id);
          resolve();
        };

        request.onerror = () => {
          console.error('Error deleting note:', request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error('Error in deleteNote:', error);
        reject(error);
      }
    });
  }

  async toggleNotePinned(id) {
    if (!this.db) await this.init();

    return new Promise(async (resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        const getRequest = store.get(id);
        
        getRequest.onsuccess = async () => {
          const note = getRequest.result;
          if (!note) {
            reject(new Error('Note not found'));
            return;
          }
          
          note.pinned = !note.pinned;
          
          const updateRequest = store.put(note);
          
          updateRequest.onsuccess = () => {
            console.log('Note pin status updated successfully:', note);
            resolve(note);
          };
          
          updateRequest.onerror = () => {
            console.error('Error updating note pin status:', updateRequest.error);
            reject(updateRequest.error);
          };
        };
        
        getRequest.onerror = () => {
          console.error('Error getting note:', getRequest.error);
          reject(getRequest.error);
        };
      } catch (error) {
        console.error('Error in toggleNotePinned:', error);
        reject(error);
      }
    });
  }

  async updateNotesOrder(noteIds) {
    if (!this.db) await this.init();

    return new Promise(async (resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        // Получаем все заметки и обновляем их порядок
        const notes = await Promise.all(noteIds.map(async (id, index) => {
          return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => {
              const note = request.result;
              if (note) {
                note.order = index;
                resolve(note);
              } else {
                reject(new Error(`Note with id ${id} not found`));
              }
            };
            request.onerror = () => reject(request.error);
          });
        }));

        // Сохраняем обновленные заметки
        await Promise.all(notes.map(note => {
          return new Promise((resolve, reject) => {
            const request = store.put(note);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        }));

        resolve();
      } catch (error) {
        console.error('Error updating notes order:', error);
        reject(error);
      }
    });
  }
}

// Export the classes and instances
export const promptDB = new PromptDB();
export const favoritesDB = new FavoritesDB();
export const notesDB = new NotesDB(); 