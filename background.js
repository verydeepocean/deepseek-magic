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
  chrome.contextMenus.create({
    id: 'addToFavorites',
    title: 'Add to Favorites',
    contexts: ['page'],
    documentUrlPatterns: ['https://chat.deepseek.com/*']
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

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'addToFavorites') {
    try {
      console.log('Adding to favorites...');
      
      // Ensure database is initialized
      await favoritesDB.ensureInitialized();
      
      // Check if URL already exists in favorites
      const existingFavorites = await favoritesDB.getFavorites();
      const existingFavorite = existingFavorites.find(f => f.url === tab.url);
      
      if (existingFavorite) {
        console.log('Chat already in favorites:', existingFavorite);
        showNotification('This chat is already in favorites! 📌', true);
        return;
      }
      
      // Try to get chat info with retries
      let response = null;
      let retryCount = 3;
      
      while (retryCount > 0) {
        try {
          // Inject content script if needed
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }).catch(err => console.log('Content script already loaded'));
          
          // Add delay between attempts
          if (retryCount < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Get chat content from content script
          response = await chrome.tabs.sendMessage(tab.id, { 
            type: 'GET_CHAT_INFO'
          });
          
          console.log('Received response:', response);
          
          if (response && response.status === 'ok' && response.title) {
            break;
          }
        } catch (error) {
          console.log(`Attempt ${4 - retryCount} failed:`, error);
        }
        retryCount--;
      }
      
      if (!response || response.status !== 'ok' || !response.title) {
        throw new Error('Failed to get chat info after multiple attempts');
      }
      
      // Save to favorites
      const favorite = {
        id: Date.now().toString(),
        url: tab.url,
        title: response.title,
        date: new Date(),
        messages: response.messages,
        metadata: {
          ...response.metadata,
          lastUpdated: new Date()
        }
      };
      
      console.log('Saving favorite:', favorite);
      
      await favoritesDB.addFavorite(favorite);
      console.log('Successfully added to favorites');
      
      // Show success notification
      showNotification('Chat added to favorites! ⭐');
      
      // Notify all extension pages about the update
      chrome.runtime.sendMessage({
        type: 'REFRESH_FAVORITES'
      }).catch(error => {
        console.log('No listeners available for refresh message');
      });
      
    } catch (error) {
      console.error('Error adding to favorites:', error);
      showNotification('Error adding to favorites: ' + error.message, true);
    }
  }
});

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message.type, 'from:', sender.tab ? 'content script' : 'popup');
  
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
    
    // Unknown message type
    console.warn('Unknown message type:', message.type);
    sendResponse({ status: 'error', error: 'Unknown message type' });
    
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ status: 'error', error: error.message });
  }
  
  return true; // Keep message channel open for async response
}); 