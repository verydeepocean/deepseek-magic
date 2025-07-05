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
      documentUrlPatterns: [
        'https://chat.deepseek.com/*',
        'https://aistudio.google.com/*',
        'https://chatgpt.com/*',
        'https://grok.com/*',
        'https://claude.ai/*',
        'https://gemini.google.com/*'
      ]
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
    console.log(`Sending notification to tab ${tabId}:`, message, 'isError:', isError);
    
    // Get tab info to check URL
    const tab = await chrome.tabs.get(tabId);
    console.log('Tab URL:', tab.url);
    
    // Send message to content script
    await chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_NOTIFICATION',
      message,
      isError
    });
    
    console.log('Notification message sent successfully');
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
    
    // Handle add to favorites message from button click
    if (message.type === 'ADD_TO_FAVORITES') {
      (async () => {
        try {
          console.log('Attempting to add to favorites from button click');
          
          // Ensure database is initialized
          await favoritesDB.ensureInitialized();
          
          if (!message.data || message.data.status !== 'ok') {
            throw new Error(message.data?.error || 'Invalid chat data');
          }
          
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
            title: message.data.title,
            url: sender.tab.url,
            timestamp: formattedDate,
            date: now.toISOString(),
            messages: message.data.messages,
            metadata: {
              ...message.data.metadata,
              savedAt: formattedDate
            }
          };
          
          // Add tags based on URL
          favorite.tags = [];
          if (sender.tab.url.includes('aistudio.google.com')) {
            favorite.tags.push('aistudio');
          } else if (sender.tab.url.includes('chat.deepseek.com')) {
            favorite.tags.push('deepseek');
          } else if (sender.tab.url.includes('chatgpt.com')) {
            favorite.tags.push('chatgpt');
          } else if (sender.tab.url.includes('grok.com')) {
            favorite.tags.push('grok');
          } else if (sender.tab.url.includes('claude.ai')) {
            favorite.tags.push('claude');
          } else if (sender.tab.url.includes('gemini.google.com')) {
            favorite.tags.push('gemini');
          }
          
          console.log('Created favorite object:', favorite);
          
          // Check if already in favorites
          const favorites = await favoritesDB.getFavorites();
          const exists = favorites.some(f => f.url === favorite.url);
          
          if (!exists) {
            await favoritesDB.addFavorite(favorite);
            console.log('Successfully added to favorites');
            sendResponse({ status: 'ok' });
          } else {
            console.log('Chat already in favorites');
            sendResponse({ status: 'error', error: 'Already in favorites' });
          }
        } catch (error) {
          console.error('Error in ADD_TO_FAVORITES:', error);
          sendResponse({ status: 'error', error: error.message });
        }
      })();
      
      // Signal that response will be sent asynchronously
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
    
    // Handle generate text message
    if (message.type === 'GENERATE_TEXT') {
      generateText(message).then(response => {
        sendResponse(response);
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
    
    // Handle generate tags message
    if (message.type === 'GENERATE_TAGS') {
      handleTagGeneration(message.prompt, message.settings)
        .then(sendResponse)
        .catch(error => sendResponse({ status: 'error', error: error.message }));
      return true; // Will respond asynchronously
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

// Функция для автоматического обновления информации о чате без popup
async function autoUpdateChatHistory(favorite) {
  console.log('Auto-updating chat history for favorite:', favorite.id);
  
  let tempTab = null;
  try {
    // Создать временную вкладку
    tempTab = await chrome.tabs.create({ 
      url: favorite.url, 
      active: false 
    });

    console.log('Created temporary tab for auto-update:', tempTab.id, 'with URL:', favorite.url);

    // Дождаться загрузки страницы
    await new Promise((resolve) => {
      const listener = function(tabId, info) {
        if (tabId === tempTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      
      // Timeout для безопасности, чтобы не зависнуть в ожидании
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 10000); // 10 секунд максимум
    });

    console.log('Temporary tab loaded, waiting before script injection');
    
    // Задержка для инициализации страницы
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Injecting content script into temporary tab');
    
    // Инъекция скрипта содержимого
    await chrome.scripting.executeScript({
      target: { tabId: tempTab.id },
      files: ['content.js']
    });
    
    console.log('Content script injected, waiting before data retrieval');
    
    // Задержка после инъекции
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Пробуем получить содержимое чата с повторными попытками
    let response = null;
    let retryCount = 7; // Увеличиваем количество попыток
    
    while (retryCount > 0) {
      try {
        // Повторная инъекция скрипта содержимого для надежности
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tempTab.id },
            files: ['content.js']
          });
          console.log(`Re-injected content script for attempt ${8 - retryCount}`);
        } catch (injectionError) {
          console.warn('Content script re-injection error:', injectionError);
          // Продолжаем, даже если инъекция не удалась
        }

        // Задержка после инъекции
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Получение содержимого чата
        console.log(`Sending GET_CHAT_INFO message to tab ${tempTab.id} (attempt ${8 - retryCount})`);
        response = await chrome.tabs.sendMessage(tempTab.id, { type: 'GET_CHAT_INFO' });
        
        console.log(`Auto-update attempt ${8 - retryCount} response:`, response?.status);
        
        if (response && response.status === 'ok' && response.messages && response.messages.length > 0) {
          console.log(`Auto-update successful with ${response.messages.length} messages`);
          break;
        }
        
        console.log(`Auto-update attempt ${8 - retryCount} failed or incomplete data, retrying after delay...`);
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (error) {
        console.log(`Auto-update attempt ${8 - retryCount} failed with error:`, error);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      retryCount--;
    }

    if (!response || response.status !== 'ok' || !response.messages || response.messages.length === 0) {
      throw new Error('Failed to get chat content after multiple attempts');
    }

    console.log('Auto-update received complete data, updating favorite');
    
    // Обновляем избранное с новыми сообщениями
    const updatedFavorite = {
      ...favorite,
      messages: response.messages,
      metadata: {
        ...favorite.metadata,
        lastUpdated: new Date().toISOString()
      }
    };

    // Сохраняем обновленное избранное
    await favoritesDB.updateFavorite(updatedFavorite);
    console.log('Successfully auto-updated favorite with', response.messages.length, 'messages');

    // Отправляем уведомление в content script
    try {
      await sendContentNotification(tempTab.id, 'Chat history automatically updated! 🔄');
    } catch (notificationError) {
      console.warn('Could not send notification to tab, it might have been closed:', notificationError);
    }

    // Отправляем сообщение для обновления popup, если он открыт
    try {
      chrome.runtime.sendMessage({
        type: 'REFRESH_FAVORITES'
      });
      console.log('Sent refresh message to popup');
    } catch (refreshError) {
      console.log('No popup open to refresh:', refreshError);
    }

  } catch (error) {
    console.error('Error in autoUpdateChatHistory:', error);
  } finally {
    // Закрываем временную вкладку
    if (tempTab && tempTab.id) {
      try {
        console.log('Closing temporary tab:', tempTab.id);
        await chrome.tabs.remove(tempTab.id);
        console.log('Successfully closed temporary tab for auto-update');
      } catch (error) {
        console.error('Error closing temporary tab:', error);
      }
    }
  }
}

// Update context menu handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('Context menu clicked:', info.menuItemId);
  
  if (info.menuItemId === 'addToFavorites') {
    try {
      console.log('Add to favorites clicked, tab URL:', tab.url);
      
      // Validate URL is from one of our supported sites
      if (!tab.url.includes('chat.deepseek.com') && 
          !tab.url.includes('aistudio.google.com') && 
          !tab.url.includes('chatgpt.com') &&
          !tab.url.includes('grok.com') &&
          !tab.url.includes('claude.ai') &&
          !tab.url.includes('gemini.google.com')) {
        throw new Error('Unsupported website');
      }
      
      // Ensure database is initialized
      await favoritesDB.ensureInitialized();

      // Инъекция content script для гарантии его доступности
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      // Небольшая задержка после инъекции для инициализации скрипта
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Логика с повторными попытками, похожая на кнопку "Update Chat"
      let response = null;
      let retryCount = 5; // Увеличенное количество попыток
      
      while (retryCount > 0) {
        try {
          // Повторная инъекция content script для надежности
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });

          // Небольшая задержка после инъекции
          await new Promise(resolve => setTimeout(resolve, 500));

          // Попытка получить содержимое чата
          response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CHAT_INFO' });
          
          console.log(`Context menu - attempt ${6 - retryCount}`, response);
          
          // Проверка полноты данных
          if (response && response.status === 'ok' && response.messages && response.messages.length > 0) {
            console.log(`Got response with ${response.messages.length} messages`);
            break;
          }
          
          console.log(`Attempt ${6 - retryCount} failed or incomplete data, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.log(`Attempt ${6 - retryCount} failed:`, error);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        retryCount--;
      }
      
      if (!response || response.status !== 'ok' || !response.messages || response.messages.length === 0) {
        throw new Error('Failed to get chat content after multiple attempts');
      }
      
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

        // Add tags based on URL
        favorite.tags = [];
        if (tab.url.includes('aistudio.google.com')) {
          favorite.tags.push('aistudio');
        } else if (tab.url.includes('chat.deepseek.com')) {
          favorite.tags.push('deepseek');
        } else if (tab.url.includes('chatgpt.com')) {
          favorite.tags.push('chatgpt');
        } else if (tab.url.includes('grok.com')) {
          favorite.tags.push('grok');
        } else if (tab.url.includes('claude.ai')) {
          favorite.tags.push('claude');
        } else if (tab.url.includes('gemini.google.com')) {
          favorite.tags.push('gemini');
        }

        console.log('Created favorite object with', favorite.messages.length, 'messages');
        
        // Check if already in favorites
        const favorites = await favoritesDB.getFavorites();
        const exists = favorites.some(f => f.url === favorite.url);
        
        let savedFavorite = null;
        
        if (!exists) {
          // Check if autoGenerateMetadata is enabled
          let settings = await getSettings();
          let shouldAutoGenerate = settings && settings.autoGenerateMetadata;
          
          // If no auto-generation, just save normally
          if (!shouldAutoGenerate) {
            await favoritesDB.addFavorite(favorite);
            console.log('Successfully added to favorites');
            await sendContentNotification(tab.id, 'Added to Favorites! ⭐');
            savedFavorite = favorite;
          } else {
            // First notify that we're adding with auto-generation
            await sendContentNotification(tab.id, 'Adding to Favorites with auto-generation... ⌛');
            
            try {
              // Save first to get an ID
              await favoritesDB.addFavorite(favorite);
              savedFavorite = favorite;
              
              // Prepare chat history text
              const chatHistory = favorite.messages
                ?.map(msg => `${msg.role}: ${msg.content}`)
                .join('\n\n') || '';
              
              if (!chatHistory) {
                throw new Error('No chat history available for generation');
              }
              
              // Auto-generate title
              const titlePrompt = `${settings.titlePrompt || 'Generate a concise and descriptive title for this chat conversation.'}\n\nChat History:\n${chatHistory}`;
              const titleResponse = await generateText({
                prompt: titlePrompt,
                provider: settings.provider,
                model: settings.model,
                apiKey: settings.apiKeys[settings.provider]
              });
              
              if (titleResponse.status === 'ok') {
                const title = titleResponse.text.trim();
                favorite.title = title;
                console.log('Generated title:', title);
                // Update notification
                await sendContentNotification(tab.id, 'Generating title... ✓');
              }
              
              // Small delay between generations
              await new Promise(resolve => setTimeout(resolve, 250));
              
              // Auto-generate description
              const summaryPrompt = `${settings.summaryPrompt || 'Generate a concise description or summary for this chat conversation.'}\n\nChat History:\n${chatHistory}`;
              const summaryResponse = await generateText({
                prompt: summaryPrompt,
                provider: settings.provider,
                model: settings.model,
                apiKey: settings.apiKeys[settings.provider]
              });
              
              if (summaryResponse.status === 'ok') {
                const description = summaryResponse.text.trim();
                favorite.description = description;
                favorite.summary = description;
                console.log('Generated description:', description);
                // Update notification
                await sendContentNotification(tab.id, 'Generating description... ✓');
              }
              
              // Small delay between generations
              await new Promise(resolve => setTimeout(resolve, 250));
              
              // Auto-generate tags
              const tagsPrompt = `${settings.tagsPrompt || 'Generate 3-5 tags for this chat conversation.'}\n\nChat History:\n${chatHistory}`;
              const tagsResponse = await generateText({
                prompt: tagsPrompt,
                provider: settings.provider,
                model: settings.model,
                apiKey: settings.apiKeys[settings.provider]
              });
              
              if (tagsResponse.status === 'ok') {
                const tagsText = tagsResponse.text.trim();
                // Обработка тегов перед возвращением результата
                // Split by commas and clean up
                const processedTags = tagsText.split(/[,\s]+/)
                  .map(tag => tag.trim().toLowerCase())
                  .filter(tag => tag && tag.length > 0)
                  .map(tag => {
                    // Проверяем и корректируем формат тегов
                    const words = tag.split(/\s+/);
                    // Если больше двух слов, берем только первые два
                    if (words.length > 2) {
                      return words.slice(0, 2).join('-');
                    } else if (words.length === 2) {
                      // Если два слова, соединяем их дефисом
                      return words.join('-');
                    }
                    // Одно слово или уже с дефисом оставляем как есть
                    return tag;
                  })
                  .join(', '); // Возвращаем как строку с разделителями-запятыми
                
                // Add the generated tags to the existing tags
                favorite.tags = [...favorite.tags, ...processedTags.split(', ').map(tag => tag.trim())];
                console.log('Generated tags:', processedTags.split(', ').map(tag => tag.trim()));
                // Update notification
                await sendContentNotification(tab.id, 'Generating tags... ✓');
              }
              
              // Update the favorite with all generated data
              favorite.metadata.autoGenerated = true;
              await favoritesDB.updateFavorite(favorite);
              
              // Final notification
              await sendContentNotification(tab.id, 'Added to Favorites with auto-generated metadata! ⭐');
            } catch (error) {
              console.error('Error in auto-generation:', error);
              await sendContentNotification(tab.id, 'Error in auto-generation, saved with basic info. ⚠️');
            }
          }
        } else {
          console.log('Chat already in favorites');
          await sendContentNotification(tab.id, 'Already in Favorites! 🔔', true);
          
          savedFavorite = favorites.find(f => f.url === favorite.url);
        }
        
        // Для Google AI Studio автоматически обновить чат
        if (savedFavorite && tab.url.includes('aistudio.google.com')) {
          console.log('Google AI Studio detected, auto-updating chat history without popup');
          
          // Показать уведомление о начале обновления чата
          await sendContentNotification(tab.id, 'Updating chat history, please wait... ⌛');
          
          // Вызвать функцию для автоматического обновления чата без popup
          // с небольшой задержкой чтобы пользователь увидел уведомление
          setTimeout(() => {
            autoUpdateChatHistory(savedFavorite);
          }, 300);  // Уменьшаем задержку для более быстрого обновления
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

// Helper function to get settings
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('settings', (result) => {
      resolve(result.settings || {});
    });
  });
}

// Function to generate text using AI API
async function generateText(message) {
  const { provider, model, apiKey, prompt } = message;
  const MAX_RETRIES = 2;
  const RETRY_DELAY = 1000; // 1 second

  if (!apiKey || !model) {
    throw new Error('API key and model are required');
  }

  async function makeRequest(retryCount = 0) {
    try {
      let response;
      if (provider === 'openrouter') {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': chrome.runtime.getURL(''),
            'X-Title': 'DeepSeek Magic'
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 500
          })
        });
      } else if (provider === 'google') {
        // Extract model name from the model ID (remove 'models/' prefix if present)
        const modelName = model.replace(/^models\//, '');
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 500
            }
          })
        });
      } else {
        throw new Error('Unsupported provider');
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to generate text');
      }

      const data = await response.json();
      let generatedText;

      if (provider === 'openrouter') {
        generatedText = data.choices[0].message.content;
      } else if (provider === 'google') {
        // Check if we only got metadata without actual response
        if (!data.candidates || data.candidates.length === 0) {
          if (retryCount < MAX_RETRIES) {
            console.log(`No candidates in response, retrying (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1))); // Увеличиваем задержку с каждой попыткой
            return makeRequest(retryCount + 1);
          }
          throw new Error('No response candidates received after retries');
        }

        const candidate = data.candidates[0];
        
        // Try to extract text from all possible locations
        generatedText = 
          (candidate.content?.parts?.[0]?.text) ||
          (candidate.parts?.[0]?.text) ||
          (candidate.text) ||
          (candidate.output);

        if (!generatedText && typeof candidate === 'object') {
          // Для случаев с нестандартной структурой ответа
          const possibleTextLocations = [
            candidate.content?.text,
            candidate.response?.text,
            candidate.generated_text,
            candidate.result
          ];
          
          generatedText = possibleTextLocations.find(text => text);
        }

        if (!generatedText) {
          console.error('Response structure:', JSON.stringify(data, null, 2));
          if (retryCount < MAX_RETRIES) {
            console.log(`No text found in response, retrying (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
            return makeRequest(retryCount + 1);
          }
          throw new Error('Could not extract text from response after retries');
        }
      }

      return {
        status: 'ok',
        text: generatedText
      };
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        console.error(`Error on attempt ${retryCount + 1}:`, error);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return makeRequest(retryCount + 1);
      }
      throw error;
    }
  }

  return makeRequest();
}

// Add this function to handle tag generation
async function handleTagGeneration(prompt, settings) {
  try {
    let response;
    if (settings.provider === 'openrouter') {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`,
          'HTTP-Referer': chrome.runtime.getURL(''),
          'X-Title': 'DeepSeek Magic'
        },
        body: JSON.stringify({
          model: settings.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 100
        })
      });
    } else if (settings.provider === 'google') {
      // Extract model name from the model ID (remove 'models/' prefix if present)
      const modelName = settings.model.replace(/^models\//, '');
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${settings.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 100
          }
        })
      });
    } else {
      throw new Error('Unsupported provider');
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    let tags;
    
    if (settings.provider === 'openrouter') {
      tags = data.choices[0].message.content.trim();
    } else if (settings.provider === 'google') {
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response format from Google AI');
      }
      tags = data.candidates[0].content.parts[0].text.trim();
    }

    if (!tags) {
      throw new Error('No tags generated');
    }

    // Обработка тегов перед возвращением результата
    // Split by commas and clean up
    const processedTags = tags.split(/[,\s]+/)
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag && tag.length > 0)
      .map(tag => {
        // Проверяем и корректируем формат тегов
        const words = tag.split(/\s+/);
        // Если больше двух слов, берем только первые два
        if (words.length > 2) {
          return words.slice(0, 2).join('-');
        } else if (words.length === 2) {
          // Если два слова, соединяем их дефисом
          return words.join('-');
        }
        // Одно слово или уже с дефисом оставляем как есть
        return tag;
      })
      .join(', '); // Возвращаем как строку с разделителями-запятыми

    return { status: 'ok', tags: processedTags };
  } catch (error) {
    console.error('Error generating tags:', error);
    return { status: 'error', error: error.message };
  }
} 