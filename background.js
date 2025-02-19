// Initialize database
const favoritesDB = {
  db: null,
  initialized: false,
  
  async init() {
    if (this.initialized) return;
    
    try {
      // Open IndexedDB
      const request = indexedDB.open('favoritesDB', 1);
      
      return new Promise((resolve, reject) => {
        request.onerror = () => {
          this.initialized = false;
          reject(new Error('Failed to open database'));
        };
        
        request.onsuccess = (event) => {
          this.db = event.target.result;
          this.initialized = true;
          resolve();
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          // Create favorites store if it doesn't exist
          if (!db.objectStoreNames.contains('favorites')) {
            db.createObjectStore('favorites', { keyPath: 'id' });
          }
        };
      });
    } catch (error) {
      this.initialized = false;
  console.error('Error initializing database:', error);
      throw error;
    }
  },
  
  async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
    return this.initialized;
  },
  
  async addFavorite(favorite) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['favorites'], 'readwrite');
      const store = transaction.objectStore('favorites');
      
      const request = store.add(favorite);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to add favorite'));
    });
  },
  
  async getFavorites() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['favorites'], 'readonly');
      const store = transaction.objectStore('favorites');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get favorites'));
    });
  },
  
  async deleteFavorite(id) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['favorites'], 'readwrite');
      const store = transaction.objectStore('favorites');
      
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete favorite'));
    });
  },
  
  async updateFavorite(favorite) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['favorites'], 'readwrite');
      const store = transaction.objectStore('favorites');
      
      const request = store.put(favorite);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to update favorite'));
    });
  }
};

const promptsDB = {
  db: null,
  initialized: false,
  
  async init() {
    if (this.initialized) return;
    
    try {
      const request = indexedDB.open('promptsDB', 1);
      
      return new Promise((resolve, reject) => {
        request.onerror = () => {
          this.initialized = false;
          reject(new Error('Failed to open prompts database'));
        };
        
        request.onsuccess = (event) => {
          this.db = event.target.result;
          this.initialized = true;
          resolve();
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          if (!db.objectStoreNames.contains('prompts')) {
            const store = db.createObjectStore('prompts', { keyPath: 'id' });
            store.createIndex('title', 'title', { unique: false });
            store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
          }
        };
      });
    } catch (error) {
      this.initialized = false;
      console.error('Error initializing prompts database:', error);
      throw error;
    }
  },
  
  async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
    return this.initialized;
  },
  
  async addPrompt(prompt) {
    if (!this.db) {
      throw new Error('Prompts database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['prompts'], 'readwrite');
      const store = transaction.objectStore('prompts');
      
      const request = store.add(prompt);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to add prompt'));
    });
  },
  
  async updatePrompt(prompt) {
    if (!this.db) {
      throw new Error('Prompts database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['prompts'], 'readwrite');
      const store = transaction.objectStore('prompts');
      
      const request = store.put(prompt);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to update prompt'));
    });
  },
  
  async deletePrompt(id) {
    if (!this.db) {
      throw new Error('Prompts database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['prompts'], 'readwrite');
      const store = transaction.objectStore('prompts');
      
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete prompt'));
    });
  },
  
  async getPrompts() {
    if (!this.db) {
      throw new Error('Prompts database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['prompts'], 'readonly');
      const store = transaction.objectStore('prompts');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get prompts'));
    });
  }
};

// Initialize databases when extension starts
Promise.all([
  favoritesDB.init(),
  promptsDB.init()
]).catch(error => {
  console.error('Error initializing databases:', error);
});

// Log when background script loads
console.log('Background script loaded');

// Create context menu item
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated');
  
  // Remove existing menu items first
  chrome.contextMenus.removeAll(() => {
    // Create new menu item
    chrome.contextMenus.create({
      id: 'addToFavorites',
      title: 'Add to Favorites ⭐',
      contexts: ['page', 'selection'],
      documentUrlPatterns: ['https://chat.deepseek.com/*']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error creating context menu:', chrome.runtime.lastError);
      } else {
        console.log('Context menu created successfully');
      }
    });
  });
});

// Function to show notification
function showNotification(message, isError = false) {
  console.log('Showing notification:', message, 'isError:', isError);
  
  const notificationOptions = {
    type: 'basic',
    iconUrl: '/icons/deepseek1.png',
    title: isError ? 'Error' : 'Success',
    message: message,
    priority: 2,
    requireInteraction: false
  };
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '/icons/deepseek1.png',
    title: isError ? 'Error' : 'Success',
    message: message
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.error('Error showing notification:', chrome.runtime.lastError);
    } else {
      console.log('Notification shown successfully, id:', notificationId);
    }
  });
}

// Function to send notification to content script
async function sendContentNotification(tabId, message, isError = false) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_NOTIFICATION',
      message,
      isError
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

// Handle content script ready message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message.type, 'from:', sender.tab ? 'content script' : 'popup');
  
  try {
    // Handle content script ready message
    if (message.type === 'CONTENT_SCRIPT_READY') {
      console.log('Content script is ready in tab:', sender.tab?.id);
      sendResponse({ status: 'ok' });
      return true;
    }
    
    // Handle show context menu message
    if (message.type === 'SHOW_CONTEXT_MENU') {
      console.log('Received context menu data:', message.data);
      sendResponse({ status: 'ok' });
      return true;
    }
    
    // Handle refresh favorites message
    if (message.type === 'REFRESH_FAVORITES') {
      console.log('Refreshing favorites');
      
      // If favorites are provided in the message, update the database state
      if (message.favorites) {
        console.log('Updating favorites state with:', message.favorites);
      }
      
      sendResponse({ status: 'ok' });
      return true;
    }
    
    // Handle get favorites message
    if (message.type === 'GET_FAVORITES') {
      // Use async response
      favoritesDB.getFavorites().then(favorites => {
        sendResponse({ status: 'ok', favorites });
      }).catch(error => {
        sendResponse({ status: 'error', error: error.message });
      });
      return true; // Will respond asynchronously
    }
    
    // Handle delete favorite message
    if (message.type === 'DELETE_FAVORITE') {
      if (!message.id) {
        sendResponse({ status: 'error', error: 'No favorite ID provided' });
        return true;
      }
      
      favoritesDB.deleteFavorite(message.id).then(async () => {
        // Get updated favorites list to ensure proper state
        const updatedFavorites = await favoritesDB.getFavorites();
        console.log('Updated favorites after deletion:', updatedFavorites);
        
        sendResponse({ status: 'ok' });
        
        // Notify other parts of the extension
        chrome.runtime.sendMessage({ 
          type: 'REFRESH_FAVORITES',
          favorites: updatedFavorites
        }).catch(() => {
          console.log('No listeners for refresh message');
        });
      }).catch(error => {
        console.error('Error deleting favorite:', error);
        sendResponse({ status: 'error', error: error.message });
      });
      return true;
    }
    
    // Handle get prompts message
    if (message.type === 'GET_PROMPTS') {
      (async () => {
        try {
          // Ensure database is initialized
          const isInitialized = await promptsDB.ensureInitialized();
          if (!isInitialized) {
            throw new Error('Prompts database not initialized');
          }
          
          const prompts = await promptsDB.getPrompts();
          sendResponse({ status: 'ok', prompts });
        } catch (error) {
          console.error('Error getting prompts:', error);
          sendResponse({ status: 'error', error: error.message });
        }
      })();
      return true;
    }
    
    // Handle add prompt message
    if (message.type === 'ADD_PROMPT') {
      promptsDB.addPrompt(message.prompt).then(() => {
        sendResponse({ status: 'ok' });
      }).catch(error => {
        sendResponse({ status: 'error', error: error.message });
      });
      return true;
    }
    
    // Handle update prompt message
    if (message.type === 'UPDATE_PROMPT') {
      promptsDB.updatePrompt(message.prompt).then(() => {
        sendResponse({ status: 'ok' });
      }).catch(error => {
        sendResponse({ status: 'error', error: error.message });
      });
      return true;
    }
    
    // Handle delete prompt message
    if (message.type === 'DELETE_PROMPT') {
      promptsDB.deletePrompt(message.id).then(() => {
        sendResponse({ status: 'ok' });
      }).catch(error => {
        sendResponse({ status: 'error', error: error.message });
      });
      return true;
    }
    
    // Handle update favorite message
    if (message.type === 'UPDATE_FAVORITE') {
      if (!message.favorite) {
        sendResponse({ status: 'error', error: 'No favorite data provided' });
        return true;
      }
      
      favoritesDB.updateFavorite(message.favorite).then(() => {
        sendResponse({ status: 'ok' });
      }).catch(error => {
        sendResponse({ status: 'error', error: error.message });
      });
      return true;
    }
    
    // Handle clear all data message
    if (message.type === 'CLEAR_ALL_DATA') {
      (async () => {
        try {
          console.log('Clearing all databases...');
          
          // Close existing connections
          if (favoritesDB.db) {
            favoritesDB.db.close();
            favoritesDB.db = null;
            favoritesDB.initialized = false;
          }
          if (promptsDB.db) {
            promptsDB.db.close();
            promptsDB.db = null;
            promptsDB.initialized = false;
          }
          
          // Delete both databases
          await Promise.all([
            new Promise((resolve, reject) => {
              const request = indexedDB.deleteDatabase('favoritesDB');
              request.onsuccess = () => {
                console.log('Favorites database deleted successfully');
                resolve();
              };
              request.onerror = () => reject(new Error('Failed to delete favorites database'));
            }),
            new Promise((resolve, reject) => {
              const request = indexedDB.deleteDatabase('promptsDB');
              request.onsuccess = () => {
                console.log('Prompts database deleted successfully');
                resolve();
              };
              request.onerror = () => reject(new Error('Failed to delete prompts database'));
            })
          ]);
          
          console.log('All databases cleared successfully');
          
          // Reinitialize databases
          await Promise.all([
            favoritesDB.init(),
            promptsDB.init()
          ]);
          
          sendResponse({ status: 'ok' });
          
          // Notify other parts of the extension
          chrome.runtime.sendMessage({ 
            type: 'REFRESH_FAVORITES'
          }).catch(() => {
            console.log('No listeners for refresh message');
          });
          
        } catch (error) {
          console.error('Error clearing databases:', error);
          sendResponse({ status: 'error', error: error.message });
        }
      })();
      return true;
    }
    
    // Unknown message type
    console.warn('Unknown message type:', message.type);
    sendResponse({ status: 'error', error: 'Unknown message type' });
    
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ status: 'error', error: error.message });
  }
  
  return true;
});

// Update context menu handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('Context menu clicked:', info.menuItemId);
  
  if (info.menuItemId === 'addToFavorites') {
    try {
      console.log('Attempting to add to favorites for tab:', tab.id);
      
      // Ensure database is initialized
      await favoritesDB.ensureInitialized();
      
      // Inject content script if not already injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        console.log('Content script injected successfully');
      } catch (error) {
        console.log('Content script already injected or injection failed:', error);
      }
      
      // Get chat info from content script
      console.log('Requesting chat info from content script...');
      const response = await chrome.tabs.sendMessage(tab.id, { 
        type: 'GET_CHAT_INFO'
      }).catch(error => {
        console.error('Error sending message to content script:', error);
        throw new Error('Failed to communicate with page. Please refresh and try again.');
      });
      
      console.log('Received response from content script:', response);
      
      if (response && response.status === 'ok') {
        // Format current date
        const now = new Date();
        const formattedDate = now.toLocaleString('ru-RU', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

        const favorite = {
          id: Date.now().toString(),
          title: response.title,
          url: tab.url,
          timestamp: formattedDate,
          date: now.toISOString(),
          messages: response.messages,
          metadata: {
            ...response.metadata,
            savedAt: formattedDate
          }
        };

        console.log('Created favorite object:', favorite);

        // Check if already in favorites
        const favorites = await favoritesDB.getFavorites();
        const exists = favorites.some(f => f.url === favorite.url);

        if (!exists) {
          await favoritesDB.addFavorite(favorite);
          console.log('Successfully added to favorites');
          await sendContentNotification(tab.id, 'Added to Favorites! ⭐');
        } else {
          console.log('Chat already in favorites');
          await sendContentNotification(tab.id, 'Already in Favorites! 🔔', true);
        }
      } else {
        throw new Error(response?.error || 'Failed to get chat info');
      }
    } catch (error) {
      console.error('Error in addToFavorites:', error);
      await sendContentNotification(tab.id, 'Error saving to favorites! ❌', true);
    }
  }
}); 