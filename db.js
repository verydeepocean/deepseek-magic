class PromptDB {
  constructor() {
    this.dbName = 'promptsDB';
    this.dbVersion = 1;
    this.storeName = 'prompts';
    this.db = null;
  }

  async init() {
    if (this.db) {
      console.log(`${this.dbName} already initialized`);
      return;
    }
    
    console.log(`Initializing ${this.dbName}...`);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error(`Error opening ${this.dbName}:`, request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log(`${this.dbName} opened successfully`);
        resolve();
      };

      request.onupgradeneeded = (event) => {
        console.log(`Upgrading ${this.dbName} schema...`);
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          console.log(`Creating ${this.storeName} store...`);
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
          console.log(`${this.storeName} store created successfully`);
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
    if (!this.db) {
      console.log('PromptDB not initialized in addPrompt, initializing now...');
      await this.init();
      console.log('PromptDB initialized in addPrompt:', !!this.db);
    }

    return new Promise((resolve, reject) => {
      try {
        if (!this.db) {
          throw new Error('Database is still null after initialization');
        }
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
    console.log('Getting all prompts...');
    if (!this.db) {
      console.log(`${this.dbName} not initialized, initializing now...`);
      await this.init();
      console.log(`${this.dbName} initialized:`, !!this.db);
    }

    return new Promise((resolve, reject) => {
      try {
        if (!this.db) {
          throw new Error(`${this.dbName} is still null after initialization`);
        }

        console.log('Creating transaction for prompts...');
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const prompts = request.result || [];
          console.log(`Retrieved ${prompts.length} prompts`);
          resolve(prompts);
        };

        request.onerror = () => {
          console.error('Error getting prompts:', request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error('Error in getAllPrompts:', error);
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
    this.dbName = 'favoritesDB';
    this.dbVersion = 1;
    this.storeName = 'favorites';
    this.db = null;
  }

  async init() {
    if (this.db) {
      console.log(`${this.dbName} already initialized`);
      return;
    }
    
    console.log(`Initializing ${this.dbName}...`);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error(`Error opening ${this.dbName}:`, request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log(`${this.dbName} opened successfully`);
        resolve();
      };

      request.onupgradeneeded = (event) => {
        console.log(`Upgrading ${this.dbName} schema...`);
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          console.log(`Creating ${this.storeName} store...`);
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('url', 'url', { unique: false });
          store.createIndex('date', 'date');
          console.log(`${this.storeName} store created successfully`);
        }
      };
    });
  }

  async addFavorite(favorite) {
    if (!this.db) {
      console.log('FavoritesDB not initialized for adding, initializing now...');
      await this.init();
      console.log('FavoritesDB initialized for adding:', this.db ? 'success' : 'failed');
    }

    return new Promise((resolve, reject) => {
      try {
        if (!this.db) {
          throw new Error('FavoritesDB is still null after initialization');
        }

        console.log('Creating transaction for adding favorite...');
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        if (!transaction) {
          throw new Error('Failed to create transaction for adding favorite');
        }

        console.log('Getting store for adding favorite...');
        const store = transaction.objectStore(this.storeName);
        if (!store) {
          throw new Error('Failed to get store for adding favorite');
        }
        
        console.log('Adding favorite to database:', favorite);
        const request = store.add(favorite);

        request.onsuccess = () => {
          console.log('Favorite added successfully:', {
            id: request.result,
            data: favorite
          });
          resolve(favorite);
        };

        request.onerror = () => {
          console.error('Error adding favorite:', request.error);
          reject(request.error);
        };

        transaction.oncomplete = () => {
          console.log('Add favorite transaction completed');
        };

        transaction.onerror = (error) => {
          console.error('Add favorite transaction error:', error);
        };
      } catch (error) {
        console.error('Error in addFavorite:', error);
        reject(error);
      }
    });
  }

  async updateFavorite(favorite) {
    if (!this.db) {
      console.log('FavoritesDB not initialized for updating, initializing now...');
      await this.init();
      console.log('FavoritesDB initialized for updating:', this.db ? 'success' : 'failed');
    }

    return new Promise((resolve, reject) => {
      try {
        if (!this.db) {
          throw new Error('FavoritesDB is still null after initialization');
        }

        console.log('Creating transaction for updating favorite...');
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        if (!transaction) {
          throw new Error('Failed to create transaction for updating favorite');
        }

        console.log('Getting store for updating favorite...');
        const store = transaction.objectStore(this.storeName);
        if (!store) {
          throw new Error('Failed to get store for updating favorite');
        }
        
        console.log('Updating favorite in database:', favorite);
        const request = store.put(favorite);

        request.onsuccess = () => {
          console.log('Favorite updated successfully:', {
            id: favorite.id,
            data: favorite
          });
          resolve(favorite);
        };

        request.onerror = () => {
          console.error('Error updating favorite:', request.error);
          reject(request.error);
        };

        transaction.oncomplete = () => {
          console.log('Update favorite transaction completed');
        };

        transaction.onerror = (error) => {
          console.error('Update favorite transaction error:', error);
        };
      } catch (error) {
        console.error('Error in updateFavorite:', error);
        reject(error);
      }
    });
  }

  async getFavorites() {
    console.log('Getting all favorites...');
    if (!this.db) {
      console.log(`${this.dbName} not initialized, initializing now...`);
      await this.init();
      console.log(`${this.dbName} initialized:`, !!this.db);
    }

    return new Promise((resolve, reject) => {
      try {
        if (!this.db) {
          throw new Error(`${this.dbName} is still null after initialization`);
        }

        console.log('Creating transaction for favorites...');
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const favorites = request.result || [];
          console.log(`Retrieved ${favorites.length} favorites`);
          resolve(favorites);
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
    this.dbName = 'notesDB';
    this.dbVersion = 1;
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
    if (!this.db) {
      console.log('NotesDB not initialized in addNote, initializing now...');
      await this.init();
      console.log('NotesDB initialized in addNote:', !!this.db);
    }

    return new Promise((resolve, reject) => {
      try {
        if (!this.db) {
          throw new Error('NotesDB is still null after initialization');
        }
        
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
          // Update the note object with the generated ID
          const savedNote = {
            ...noteWithDefaults,
            id: request.result
          };
          resolve(savedNote);
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
    console.log('Getting all notes from database');

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const notes = request.result || [];
          console.log(`Retrieved ${notes.length} notes from database`);
          resolve(notes);
        };

        request.onerror = () => {
          console.error('Error getting notes:', request.error);
          reject(request.error);
        };

        transaction.oncomplete = () => {
          console.log('Notes retrieval transaction completed');
        };

        transaction.onerror = (error) => {
          console.error('Notes retrieval transaction error:', error);
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

class DataExporter {
  constructor() {
    this.promptDB = promptDB;
    this.favoritesDB = favoritesDB;
    this.notesDB = notesDB;
  }

  async exportAllData() {
    try {
      console.log('Starting data export...');
      let prompts = [], favorites = [], notes = [];
      
      // Initialize all databases first
      console.log('Initializing all databases...');
      try {
        await Promise.all([
          this.promptDB.init().then(() => {
            console.log('PromptDB initialized successfully');
            console.log('PromptDB state:', {
              dbName: this.promptDB.dbName,
              isInitialized: !!this.promptDB.db
            });
          }).catch(e => {
            console.error('Error initializing promptDB:', e);
            throw e;
          }),
          
          this.favoritesDB.init().then(() => {
            console.log('FavoritesDB initialized successfully');
            console.log('FavoritesDB state:', {
              dbName: this.favoritesDB.dbName,
              isInitialized: !!this.favoritesDB.db
            });
          }).catch(e => {
            console.error('Error initializing favoritesDB:', e);
            throw e;
          }),
          
          this.notesDB.init().then(() => {
            console.log('NotesDB initialized successfully');
            console.log('NotesDB state:', {
              dbName: this.notesDB.dbName,
              isInitialized: !!this.notesDB.db
            });
          }).catch(e => {
            console.error('Error initializing notesDB:', e);
            throw e;
          })
        ]);
      } catch (initError) {
        console.error('Database initialization failed:', initError);
        throw new Error('Failed to initialize databases: ' + initError.message);
      }
      
      // Get data from all databases sequentially to avoid potential memory issues
      console.log('Retrieving data from databases sequentially...');
      
      try {
        console.log('Getting prompts...');
        prompts = await this.promptDB.getAllPrompts();
        console.log('Prompts retrieved:', {
          count: prompts.length,
          sample: prompts[0] ? { id: prompts[0].id, title: prompts[0].title } : null
        });
      } catch (promptsError) {
        console.error('Error getting prompts:', promptsError);
        prompts = [];
      }
      
      try {
        console.log('Getting favorites...');
        favorites = await this.favoritesDB.getFavorites();
        console.log('Favorites retrieved:', {
          count: favorites.length,
          sample: favorites[0] ? { id: favorites[0].id, title: favorites[0].title } : null
        });
      } catch (favoritesError) {
        console.error('Error getting favorites:', favoritesError);
        favorites = [];
      }
      
      try {
        console.log('Getting notes...');
        notes = await this.notesDB.getAllNotes();
        console.log('Notes retrieved:', {
          count: notes.length,
          sample: notes[0] ? { id: notes[0].id, title: notes[0].title } : null
        });
      } catch (notesError) {
        console.error('Error getting notes:', notesError);
        notes = [];
      }
      
      // Get settings
      let settings = {};
      try {
        console.log('Getting settings...');
        settings = await this.getSettings();
        console.log('Settings retrieved successfully');
      } catch (settingsError) {
        console.error('Error getting settings:', settingsError);
      }
      
      const exportData = { prompts, favorites, notes, settings };
      
      console.log('Export data prepared:', {
        promptsCount: prompts.length,
        favoritesCount: favorites.length,
        notesCount: notes.length,
        hasSettings: Object.keys(settings).length > 0
      });
      
      return exportData;
    } catch (error) {
      console.error('Fatal error in exportAllData:', error);
      throw new Error('Export failed: ' + error.message);
    }
  }

  async importAllData(data) {
    let tempDb = null;
    try {
      console.log('Starting data import...');
      
      // Проверяем структуру данных
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data format');
      }
      
      console.log('Import data summary:', {
        promptsCount: data.prompts?.length || 0,
        favoritesCount: data.favorites?.length || 0,
        notesCount: data.notes?.length || 0,
        hasSettings: data.settings ? true : false
      });
      
      // Удаляем существующую временную базу данных, если она есть
      try {
        await new Promise((resolve) => {
          const deleteRequest = indexedDB.deleteDatabase('tempImportDB');
          deleteRequest.onsuccess = () => {
            console.log('Old temporary database deleted successfully');
            resolve();
          };
          deleteRequest.onerror = () => {
            console.log('No old temporary database to delete');
            resolve();
          };
        });
      } catch (e) {
        console.log('Error deleting old database:', e);
        // Продолжаем выполнение, так как это некритичная ошибка
      }

      // Создаем новую временную базу данных для импорта
      console.log('Creating temporary database...');
      tempDb = await new Promise((resolve, reject) => {
        const request = indexedDB.open('tempImportDB', 1);
        
        request.onerror = () => {
          console.error('Error opening temporary database:', request.error);
          reject(request.error);
        };
        
        request.onblocked = () => {
          console.error('Database blocked');
          reject(new Error('Database blocked'));
        };
        
        request.onupgradeneeded = (event) => {
          console.log('Creating import data store...');
          const db = event.target.result;
          if (!db.objectStoreNames.contains('importData')) {
            db.createObjectStore('importData');
          }
        };
        
        request.onsuccess = () => {
          console.log('Temporary database created successfully');
          resolve(request.result);
        };
      });

      // Сохраняем данные
      console.log('Saving import data...');
      await new Promise((resolve, reject) => {
        try {
          const transaction = tempDb.transaction(['importData'], 'readwrite');
          
          transaction.onerror = () => {
            reject(new Error('Transaction failed: ' + transaction.error));
          };
          
          transaction.oncomplete = () => {
            console.log('Data saved successfully');
            resolve();
          };
          
          const store = transaction.objectStore('importData');
          const request = store.put(data, 'pendingImport');
          
          request.onerror = () => {
            reject(new Error('Failed to save data: ' + request.error));
          };
        } catch (error) {
          reject(error);
        }
      });

      // Закрываем базу данных
      if (tempDb) {
        tempDb.close();
        tempDb = null;
      }

      // Ждем немного, чтобы убедиться, что данные сохранились
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('Import data saved successfully, reloading extension...');
      chrome.runtime.reload();
      
      return true;
    } catch (error) {
      console.error('Error in importAllData:', error);
      
      // Пытаемся очистить временную базу данных в случае ошибки
      if (tempDb) {
        tempDb.close();
      }
      try {
        await new Promise((resolve) => {
          const deleteRequest = indexedDB.deleteDatabase('tempImportDB');
          deleteRequest.onsuccess = resolve;
          deleteRequest.onerror = resolve; // Продолжаем даже при ошибке
        });
      } catch (e) {
        console.error('Error cleaning up temporary database:', e);
      }
      
      throw error;
    }
  }

  // Новый метод для обработки импорта после перезагрузки
  async handlePendingImport() {
    let tempDb = null;
    let retryCount = 3;
    
    while (retryCount > 0) {
      try {
        console.log(`Checking for pending import (attempt ${4 - retryCount}/3)...`);
        
        // Открываем временную базу данных
        tempDb = await new Promise((resolve, reject) => {
          const request = indexedDB.open('tempImportDB', 1);
          
          request.onerror = () => {
            console.error('Error opening temporary database:', request.error);
            reject(request.error);
          };
          
          request.onblocked = () => {
            console.error('Database blocked');
            reject(new Error('Database blocked'));
          };
          
          request.onsuccess = () => {
            console.log('Temporary database opened successfully');
            resolve(request.result);
          };
        });

        // Проверяем, существует ли хранилище importData
        if (!tempDb.objectStoreNames.contains('importData')) {
          console.log('No import data store found');
          if (tempDb) {
            tempDb.close();
          }
          return;
        }

        // Получаем сохраненные данные
        const data = await new Promise((resolve, reject) => {
          try {
            const transaction = tempDb.transaction(['importData'], 'readonly');
            
            transaction.onerror = () => {
              reject(new Error('Transaction failed: ' + transaction.error));
            };
            
            const store = transaction.objectStore('importData');
            const request = store.get('pendingImport');
            
            request.onerror = () => {
              reject(new Error('Failed to get data: ' + request.error));
            };
            
            request.onsuccess = () => {
              resolve(request.result);
            };
          } catch (error) {
            reject(error);
          }
        });

        if (!data) {
          console.log('No pending import data found');
          if (tempDb) {
            tempDb.close();
          }
          return;
        }

        // Проверяем структуру данных
        if (typeof data !== 'object') {
          throw new Error('Invalid import data format');
        }

        console.log('Found pending import, starting import process...');
        
        // Инициализируем все базы данных и ждем их готовности
        console.log('Initializing databases for import...');
        try {
          await Promise.all([
            this.promptDB.init(),
            this.favoritesDB.init(),
            this.notesDB.init()
          ]);
          console.log('All databases initialized successfully for import');
        } catch (e) {
          console.error('Error initializing databases for import:', e);
          throw new Error('Failed to initialize databases for import');
        }
        
        // Вместо очистки баз данных, получаем существующие данные и обновляем/добавляем только нужные
        console.log('Starting smart import process...');
        
        // Обработка промптов
        if (Array.isArray(data.prompts) && data.prompts.length > 0) {
          console.log(`Processing ${data.prompts.length} prompts from import file...`);
          
          // Получаем существующие промпты
          const existingPrompts = await this.promptDB.getAllPrompts();
          console.log(`Found ${existingPrompts.length} existing prompts in database`);
          
          // Создаем карту существующих промптов по ID для быстрого поиска
          const existingPromptsMap = new Map();
          existingPrompts.forEach(prompt => {
            existingPromptsMap.set(prompt.id, prompt);
          });
          
          // Создаем карту импортируемых промптов по ID
          const importPromptsMap = new Map();
          data.prompts.forEach(prompt => {
            importPromptsMap.set(prompt.id, prompt);
          });
          
          // Обновляем или добавляем промпты из импорта
          for (const prompt of data.prompts) {
            if (existingPromptsMap.has(prompt.id)) {
              await this.promptDB.updatePrompt(prompt);
              console.log(`Updated existing prompt: ${prompt.id}`);
            } else {
              await this.promptDB.addPrompt(prompt);
              console.log(`Added new prompt: ${prompt.id}`);
            }
          }
          
          console.log('Prompts imported successfully');
        }
        
        // Обработка избранного
        if (Array.isArray(data.favorites) && data.favorites.length > 0) {
          console.log(`Processing ${data.favorites.length} favorites from import file...`);
          
          // Получаем существующие избранные
          const existingFavorites = await this.favoritesDB.getFavorites();
          console.log(`Found ${existingFavorites.length} existing favorites in database`);
          
          // Создаем карту существующих избранных по ID для быстрого поиска
          const existingFavoritesMap = new Map();
          existingFavorites.forEach(favorite => {
            existingFavoritesMap.set(favorite.id, favorite);
          });
          
          // Создаем карту импортируемых избранных по ID
          const importFavoritesMap = new Map();
          data.favorites.forEach(favorite => {
            importFavoritesMap.set(favorite.id, favorite);
          });
          
          // Обновляем или добавляем избранные из импорта
          for (const favorite of data.favorites) {
            if (existingFavoritesMap.has(favorite.id)) {
              await this.favoritesDB.updateFavorite(favorite);
              console.log(`Updated existing favorite: ${favorite.id}`);
            } else {
              await this.favoritesDB.addFavorite(favorite);
              console.log(`Added new favorite: ${favorite.id}`);
            }
          }
          
          console.log('Favorites imported successfully');
        }
        
        // Обработка заметок
        if (Array.isArray(data.notes) && data.notes.length > 0) {
          console.log(`Processing ${data.notes.length} notes from import file...`);
          
          // Получаем существующие заметки
          const existingNotes = await this.notesDB.getAllNotes();
          console.log(`Found ${existingNotes.length} existing notes in database`);
          
          // Создаем карту существующих заметок по ID для быстрого поиска
          const existingNotesMap = new Map();
          existingNotes.forEach(note => {
            existingNotesMap.set(note.id, note);
          });
          
          // Создаем карту импортируемых заметок по ID
          const importNotesMap = new Map();
          data.notes.forEach(note => {
            importNotesMap.set(note.id, note);
          });
          
          // Обновляем или добавляем заметки из импорта
          const batchSize = 50;
          for (let i = 0; i < data.notes.length; i += batchSize) {
            const batch = data.notes.slice(i, i + batchSize);
            await Promise.all(batch.map(note => {
              if (existingNotesMap.has(note.id)) {
                return this.notesDB.updateNote(note);
              } else {
                return this.notesDB.addNote(note);
              }
            }));
          }
          
          console.log('Notes imported successfully');
        }
        
        // Импорт настроек (настройки обычно заменяются полностью)
        if (data.settings && typeof data.settings === 'object') {
          console.log('Importing settings...');
          await this.saveSettings(data.settings);
          console.log('Settings imported successfully');
        }

        // Закрываем и удаляем временную базу данных
        if (tempDb) {
          tempDb.close();
          tempDb = null;
        }
        
        await new Promise((resolve, reject) => {
          const deleteRequest = indexedDB.deleteDatabase('tempImportDB');
          deleteRequest.onsuccess = () => {
            console.log('Temporary database deleted successfully');
            resolve();
          };
          deleteRequest.onerror = (error) => {
            console.error('Error deleting temporary database:', error);
            reject(error);
          };
        });
      
      console.log('Data import completed successfully');
      return true;
    } catch (error) {
        console.error(`Error in handlePendingImport (attempt ${4 - retryCount}/3):`, error);
        
        // Закрываем базу данных если она открыта
        if (tempDb) {
          tempDb.close();
          tempDb = null;
        }
        
        retryCount--;
        if (retryCount > 0) {
          console.log(`Retrying in 1 second... (${retryCount} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      throw error;
      }
    }
  }

  async getSettings() {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(null, (result) => {
          if (chrome.runtime.lastError) {
            console.error('Error getting settings:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          
          const settings = {
            apiKey: result.apiKey || '',
            provider: result.provider || 'openrouter',
            model: result.model || '',
            titlePrompt: result.titlePrompt || '',
            summaryPrompt: result.summaryPrompt || '',
            tagsPrompt: result.tagsPrompt || ''
          };
          
          console.log('Retrieved settings:', { 
            ...settings, 
            apiKey: settings.apiKey ? '[HIDDEN]' : '[EMPTY]' 
          });
          
          resolve(settings);
        });
      } catch (error) {
        console.error('Error in getSettings:', error);
        reject(error);
      }
    });
  }

  async saveSettings(settings) {
    return new Promise((resolve, reject) => {
      try {
        const settingsToSave = {
          apiKey: settings.apiKey || '',
          provider: settings.provider || 'openrouter',
          model: settings.model || '',
          titlePrompt: settings.titlePrompt || '',
          summaryPrompt: settings.summaryPrompt || '',
          tagsPrompt: settings.tagsPrompt || ''
        };
        
        console.log('Saving settings:', { 
          ...settingsToSave, 
          apiKey: settingsToSave.apiKey ? '[HIDDEN]' : '[EMPTY]' 
        });
        
        chrome.storage.local.set(settingsToSave, () => {
          if (chrome.runtime.lastError) {
            console.error('Error saving settings:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }
          resolve();
        });
      } catch (error) {
        console.error('Error in saveSettings:', error);
        reject(error);
      }
    });
  }

  // Новый метод для жесткой очистки всех данных с перезагрузкой расширения
  async hardClearAll() {
    let tempDb = null;
    try {
      console.log('Starting hard clear all process...');
      
      // Удаляем существующую временную базу данных, если она есть
      try {
        await new Promise((resolve) => {
          const deleteRequest = indexedDB.deleteDatabase('tempClearDB');
          deleteRequest.onsuccess = () => {
            console.log('Old temporary clear database deleted successfully');
            resolve();
          };
          deleteRequest.onerror = () => {
            console.log('No old temporary clear database to delete');
            resolve();
          };
        });
      } catch (e) {
        console.log('Error deleting old clear database:', e);
        // Продолжаем выполнение, так как это некритичная ошибка
      }

      // Создаем новую временную базу данных для флага очистки
      console.log('Creating temporary clear database...');
      tempDb = await new Promise((resolve, reject) => {
        const request = indexedDB.open('tempClearDB', 1);
        
        request.onerror = () => {
          console.error('Error opening temporary clear database:', request.error);
          reject(request.error);
        };
        
        request.onblocked = () => {
          console.error('Clear database blocked');
          reject(new Error('Clear database blocked'));
        };
        
        request.onupgradeneeded = (event) => {
          console.log('Creating clear flag store...');
          const db = event.target.result;
          if (!db.objectStoreNames.contains('clearFlag')) {
            db.createObjectStore('clearFlag');
          }
        };
        
        request.onsuccess = () => {
          console.log('Temporary clear database created successfully');
          resolve(request.result);
        };
      });

      // Сохраняем флаг очистки
      console.log('Setting clear flag...');
      await new Promise((resolve, reject) => {
        try {
          const transaction = tempDb.transaction(['clearFlag'], 'readwrite');
          
          transaction.onerror = () => {
            reject(new Error('Transaction failed: ' + transaction.error));
          };
          
          transaction.oncomplete = () => {
            console.log('Clear flag set successfully');
            resolve();
          };
          
          const store = transaction.objectStore('clearFlag');
          const request = store.put(true, 'pendingClear');
          
          request.onerror = () => {
            reject(new Error('Failed to set clear flag: ' + request.error));
          };
        } catch (error) {
          reject(error);
        }
      });

      // Закрываем базу данных
      if (tempDb) {
        tempDb.close();
        tempDb = null;
      }

      // Ждем немного, чтобы убедиться, что флаг сохранился
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('Clear flag set successfully, reloading extension...');
      chrome.runtime.reload();
      
      return true;
    } catch (error) {
      console.error('Error in hardClearAll:', error);
      
      // Пытаемся очистить временную базу данных в случае ошибки
      if (tempDb) {
        tempDb.close();
      }
      try {
        await new Promise((resolve) => {
          const deleteRequest = indexedDB.deleteDatabase('tempClearDB');
          deleteRequest.onsuccess = resolve;
          deleteRequest.onerror = resolve; // Продолжаем даже при ошибке
        });
      } catch (e) {
        console.error('Error cleaning up temporary clear database:', e);
      }
      
      throw error;
    }
  }

  // Метод для проверки и обработки отложенной очистки после перезагрузки
  async handlePendingClear() {
    let tempDb = null;
    let retryCount = 3;
    
    while (retryCount > 0) {
      try {
        console.log(`Checking for pending clear (attempt ${4 - retryCount}/3)...`);
        
        // Открываем временную базу данных
        tempDb = await new Promise((resolve, reject) => {
          const request = indexedDB.open('tempClearDB', 1);
          
          request.onerror = () => {
            console.log('No pending clear found (database error)');
            reject(request.error);
          };
          
          request.onblocked = () => {
            console.error('Clear database blocked');
            reject(new Error('Clear database blocked'));
          };
          
          request.onsuccess = () => {
            console.log('Temporary clear database opened successfully');
            resolve(request.result);
          };
        });

        // Проверяем, существует ли хранилище clearFlag
        if (!tempDb.objectStoreNames.contains('clearFlag')) {
          console.log('No clear flag store found');
          if (tempDb) {
            tempDb.close();
          }
          return false;
        }

        // Получаем сохраненный флаг
        const clearFlag = await new Promise((resolve, reject) => {
          try {
            const transaction = tempDb.transaction(['clearFlag'], 'readonly');
            
            transaction.onerror = () => {
              reject(new Error('Transaction failed: ' + transaction.error));
            };
            
            const store = transaction.objectStore('clearFlag');
            const request = store.get('pendingClear');
            
            request.onerror = () => {
              reject(new Error('Failed to get clear flag: ' + request.error));
            };
            
            request.onsuccess = () => {
              resolve(request.result);
            };
          } catch (error) {
            reject(error);
          }
        });

        if (!clearFlag) {
          console.log('No pending clear flag found');
          if (tempDb) {
            tempDb.close();
          }
          return false;
        }

        console.log('Found pending clear flag, starting clear process...');
        
        // Закрываем базы данных перед очисткой, чтобы потом создать их заново
        console.log('Closing databases before clearing...');
        if (this.promptDB.db) {
          this.promptDB.db.close();
          this.promptDB.db = null;
        }
        if (this.favoritesDB.db) {
          this.favoritesDB.db.close();
          this.favoritesDB.db = null;
        }
        if (this.notesDB.db) {
          this.notesDB.db.close();
          this.notesDB.db = null;
        }
        
        // Инициализируем все базы данных и ждем их готовности
        console.log('Initializing databases for clear...');
        await Promise.all([
          this.promptDB.init(),
          this.favoritesDB.init(),
          this.notesDB.init()
        ]);

        // Очищаем все базы данных
        console.log('Clearing all databases...');
        await Promise.all([
          this.promptDB.clearAll(),
          this.favoritesDB.clearAll(),
          this.notesDB.clearAll()
        ]);

        console.log('All databases cleared successfully');
        
        // Закрываем базы данных после очистки
        console.log('Closing databases after clearing...');
        if (this.promptDB.db) {
          this.promptDB.db.close();
          this.promptDB.db = null;
        }
        if (this.favoritesDB.db) {
          this.favoritesDB.db.close();
          this.favoritesDB.db = null;
        }
        if (this.notesDB.db) {
          this.notesDB.db.close();
          this.notesDB.db = null;
        }

        // Отправляем сообщение в фоновый скрипт о том, что данные были очищены
        try {
          await chrome.runtime.sendMessage({ type: 'CLEAR_ALL_DATA' });
          console.log('Sent CLEAR_ALL_DATA message to background script');
        } catch (messageError) {
          console.error('Error sending message to background script:', messageError);
          // Продолжаем выполнение, так как это некритичная ошибка
        }

        // Показываем сообщение пользователю
        try {
          // Проверяем, определена ли функция showToast в глобальной области видимости
          if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
            window.showToast('All data has been cleared successfully! 🗑️', 'success');
          }
        } catch (toastError) {
          console.error('Error showing toast notification:', toastError);
          // Продолжаем выполнение, так как это некритичная ошибка
        }

        // Удаляем временную базу данных
        if (tempDb) {
          tempDb.close();
        }
        
        await new Promise((resolve) => {
          const deleteRequest = indexedDB.deleteDatabase('tempClearDB');
          deleteRequest.onsuccess = () => {
            console.log('Temporary clear database deleted successfully');
            resolve();
          };
          deleteRequest.onerror = () => {
            console.error('Error deleting temporary clear database:', deleteRequest.error);
            resolve(); // Продолжаем даже при ошибке
          };
        });

        console.log('Clear process completed successfully');

        // Reinitialize databases to make sure they're ready for use
        console.log('Reinitializing databases after clearing...');
        try {
          await Promise.all([
            this.promptDB.init(),
            this.favoritesDB.init(),
            this.notesDB.init()
          ]);
          console.log('All databases reinitialized successfully');
        } catch (reinitError) {
          console.error('Error reinitializing databases:', reinitError);
          // Continue despite error - the app will try to initialize again when needed
        }

        return true;
      } catch (error) {
        console.error(`Error in handlePendingClear (attempt ${4 - retryCount}/3):`, error);
        
        // Закрываем базу данных при ошибке
        if (tempDb) {
          tempDb.close();
          tempDb = null;
        }
        
        // Уменьшаем счетчик попыток и ждем перед следующей попыткой
        retryCount--;
        if (retryCount > 0) {
          console.log(`Retrying in 1 second... (${retryCount} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // Если все попытки не удались, пытаемся очистить временную базу данных
    try {
      await new Promise((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase('tempClearDB');
        deleteRequest.onsuccess = resolve;
        deleteRequest.onerror = resolve; // Продолжаем даже при ошибке
      });
    } catch (e) {
      console.error('Error cleaning up temporary clear database:', e);
    }
    
    return false;
  }
}

// Export the classes and instances
export const promptDB = new PromptDB();
export const favoritesDB = new FavoritesDB();
export const notesDB = new NotesDB();
export const dataExporter = new DataExporter();

// Make DataExporter available globally
window.DataExporter = DataExporter;
window.dataExporter = dataExporter; 