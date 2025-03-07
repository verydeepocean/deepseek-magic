// Import database instances
import { promptDB, favoritesDB, notesDB } from './db.js';

// Utility functions
function debounce(func, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      clearTimeout(timeoutId);
      func(...args);
    }, delay);
  };
}

// Theme management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.body.setAttribute('data-theme', savedTheme);
  updateThemeButton(savedTheme);
}

function setupThemeButtons() {
  const themeToggle = document.querySelector('.theme-toggle');
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeButton(newTheme);
  });
}

function updateThemeButton(theme) {
  const themeToggle = document.querySelector('.theme-toggle');
  themeToggle.textContent = theme === 'light' ? '☀️' : '🌙';
  themeToggle.title = `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`;
}

// Notifications
function showNotification(message, isError = false) {
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(notification => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  });

  const notification = document.createElement('div');
  notification.className = `notification ${isError ? 'error' : 'success'}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  requestAnimationFrame(() => {
    notification.classList.add('show');
  });

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Create favorite element
function createFavoriteElement(favorite) {
  const div = document.createElement('div');
  div.className = 'prompt-item';
  if (favorite.pinned) {
    div.classList.add('pinned');
    div.draggable = true;
    
    // Add drag event listeners
    div.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', favorite.id);
      div.classList.add('dragging');
    });
    
    div.addEventListener('dragend', () => {
      div.classList.remove('dragging');
    });
    
    div.addEventListener('dragover', (e) => {
      e.preventDefault();
      const draggingElement = document.querySelector('.dragging');
      if (draggingElement && draggingElement !== div) {
        const container = div.parentElement;
        const afterElement = getDragAfterElement(container, e.clientY);
        if (afterElement) {
          container.insertBefore(draggingElement, afterElement);
        } else {
          container.appendChild(draggingElement);
        }
      }
    });
    
    div.addEventListener('drop', async (e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData('text/plain');
      const container = div.parentElement;
      const pinnedElements = Array.from(container.children);
      
      // Update order in storage
      try {
        const favorites = await chrome.runtime.sendMessage({ type: 'GET_FAVORITES' });
        if (favorites.status === 'ok') {
          const updatedFavorites = favorites.favorites.map(f => {
            if (f.pinned) {
              const element = pinnedElements.find(el => el.querySelector('.favorite-title').href === f.url);
              if (element) {
                return {
                  ...f,
                  order: pinnedElements.indexOf(element)
                };
              }
            }
            return f;
          });
          
          // Update each favorite with new order
          for (const favorite of updatedFavorites) {
            if (favorite.pinned) {
              await chrome.runtime.sendMessage({
                type: 'UPDATE_FAVORITE',
                favorite: favorite
              });
            }
          }
        }
      } catch (error) {
        console.error('Error updating favorites order:', error);
        showNotification('Error updating order! ❌', true);
      }
    });
  }
  
  const title = document.createElement('a');
  title.className = 'prompt-title favorite-title';
  title.href = favorite.url;
  title.target = '_blank';
  title.textContent = favorite.title || 'Untitled Chat';
  
  const description = document.createElement('p');
  description.className = 'favorite-description';
  if (favorite.description) {
    const truncatedDescription = favorite.description.length > 200 
      ? favorite.description.substring(0, 200) + '...' 
      : favorite.description;
    description.innerHTML = sanitizeAndRenderHTML(truncatedDescription);
  }
  
  const tags = document.createElement('div');
  tags.className = 'prompt-tags';
  if (favorite.tags && favorite.tags.length > 0) {
    favorite.tags.forEach(tag => {
      const tagSpan = document.createElement('span');
      tagSpan.className = 'tag clickable';
      // Clean tag text from any remove buttons or special characters
      tagSpan.textContent = tag.replace(/[×✕✖✗✘]/g, '').trim();
      tagSpan.onclick = (e) => {
        e.stopPropagation();
        const searchInput = document.getElementById('favoritesSearchInput');
        if (searchInput) {
          // Clean tag text from any remove buttons or special characters
          const cleanTag = tag.replace(/[×✕✖✗✘]/g, '').trim();
          
          // Get current search query
          let currentQuery = searchInput.value.trim();
          
          // If the tag is already in the search query (with or without #), don't add it again
          const tagWithHash = `#${cleanTag}`;
          if (!currentQuery.includes(tagWithHash)) {
            // Add the tag to the existing search query with #
            const newQuery = currentQuery ? `${currentQuery} ${tagWithHash}` : tagWithHash;
            searchInput.value = newQuery;
            // Trigger the search with the combined query
            loadFavorites(newQuery);
          }
        }
      };
      tags.appendChild(tagSpan);
    });
  }
  
  const date = document.createElement('small');
  date.textContent = new Date(favorite.date).toLocaleString();
  if (favorite.edited) {
    date.textContent += ' (edited ' + new Date(favorite.edited).toLocaleString() + ')';
  }
  
  const buttonsDiv = document.createElement('div');
  buttonsDiv.className = 'prompt-buttons';
  
  const pinBtn = document.createElement('button');
  pinBtn.className = 'btn';
  pinBtn.textContent = favorite.pinned ? '📌' : '📍';
  pinBtn.title = favorite.pinned ? 'Unpin from top' : 'Pin to top';
  pinBtn.onclick = async (e) => {
    e.stopPropagation();
    try {
      // Check if we're trying to pin and if we've reached the limit
      if (!favorite.pinned) {
        const response = await chrome.runtime.sendMessage({ type: 'GET_FAVORITES' });
        if (response.status === 'ok') {
          const pinnedCount = response.favorites.filter(f => f.pinned).length;
          if (pinnedCount >= 10) {
            showNotification('Maximum number of pinned items (10) reached! 📌', true);
            return;
          }
        }
      }

      const updatedFavorite = {
        ...favorite,
        pinned: !favorite.pinned,
        edited: new Date()
      };
      
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_FAVORITE',
        favorite: updatedFavorite
      });
      
      if (response.status === 'error') {
        throw new Error(response.error);
      }
      
      await loadFavorites();
      showNotification(updatedFavorite.pinned ? 'Chat pinned to top! 📌' : 'Chat unpinned! 📍');
      
    } catch (error) {
      console.error('Error updating pin state:', error);
      showNotification('Error updating pin state! ❌', true);
    }
  };
  
  const historyBtn = document.createElement('button');
  historyBtn.className = 'btn';
  historyBtn.textContent = '💬';
  historyBtn.title = 'View chat history';
  
  // Add new event listener for history button
  historyBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('History button clicked');
    
    const modal = document.getElementById('chatHistoryModal');
    const modalContent = document.getElementById('chatHistoryContent');
    const updateButton = document.getElementById('updateChatBtn');
    
    // Clear previous content
    modalContent.innerHTML = '';
    
    if (favorite.messages && favorite.messages.length > 0) {
      favorite.messages.forEach(message => {
        const messageElement = createMessageElement(message);
        modalContent.appendChild(messageElement);
      });
      
      // Add last updated info if available
      if (favorite.metadata?.lastUpdated) {
        const lastUpdated = document.createElement('div');
        lastUpdated.className = 'last-updated';
        lastUpdated.textContent = `Last updated: ${new Date(favorite.metadata.lastUpdated).toLocaleString()}`;
        modalContent.appendChild(lastUpdated);
      }
    } else {
      modalContent.textContent = 'No chat history available.';
    }
    
    // Show modal
    modal.style.display = 'block';
    requestAnimationFrame(() => {
      modal.classList.add('show');
      modal.querySelector('.modal').classList.add('show');
    });
    
    // Remove old event listener if exists
    const oldUpdateHandler = updateButton._updateHandler;
    if (oldUpdateHandler) {
      updateButton.removeEventListener('click', oldUpdateHandler);
    }
    
    // Add new update button handler with automatic tab management
    const updateHandler = async function() {
      let tempTab = null; // Declare tempTab outside try block
      try {
        // Create temporary tab
        tempTab = await chrome.tabs.create({ 
          url: favorite.url, 
          active: false 
        });

        console.log('Created temporary tab:', tempTab.id);

        // Wait for tab to load
        await new Promise((resolve) => {
          chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tempTab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          });
        });

        // Wait a bit for content script to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Try to get chat content with retries
        let response = null;
        let retryCount = 5; // Increase retry count
        
        while (retryCount > 0) {
          try {
            // First ensure content script is ready
            await chrome.scripting.executeScript({
              target: { tabId: tempTab.id },
              files: ['content.js']
            });

            // Wait a bit after injection
            await new Promise(resolve => setTimeout(resolve, 500));

            // Try to get chat content
            response = await chrome.tabs.sendMessage(tempTab.id, { type: 'GET_CHAT_INFO' });
            
            if (response && response.status === 'ok' && response.messages && response.messages.length > 0) {
              break;
            }
            
            console.log(`Attempt ${6 - retryCount} failed, retrying...`);
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

        // Update favorite with new messages
        favorite.messages = response.messages;
        favorite.metadata = {
          ...favorite.metadata,
          lastUpdated: new Date().toISOString()
        };

        // Save to storage
        await chrome.runtime.sendMessage({
          type: 'UPDATE_FAVORITE',
          favorite: favorite
        });

        // Refresh display
        modalContent.innerHTML = '';
        response.messages.forEach(message => {
          const messageElement = createMessageElement(message);
          modalContent.appendChild(messageElement);
        });

        // Update last updated info
        const lastUpdated = document.createElement('div');
        lastUpdated.className = 'last-updated';
        lastUpdated.textContent = `Last updated: ${new Date().toLocaleString()}`;
        modalContent.appendChild(lastUpdated);

        showNotification('Chat history updated! 🔄');

      } catch (error) {
        console.error('Error updating chat:', error);
        showNotification(`Failed to update chat history: ${error.message} ❌`, true);
      } finally {
        // Close temporary tab if it exists
        if (tempTab && tempTab.id) {
          try {
            await chrome.tabs.remove(tempTab.id);
          } catch (error) {
            console.error('Error closing temporary tab:', error);
          }
        }
      }
    };
    
    // Store handler reference for future cleanup
    updateButton._updateHandler = updateHandler;
    updateButton.addEventListener('click', updateHandler);
  });
  
  const editBtn = document.createElement('button');
  editBtn.className = 'btn';
  editBtn.textContent = '✏️';
  editBtn.title = 'Edit favorite';
  editBtn.onclick = (e) => {
    e.stopPropagation();
    currentEditingFavorite = favorite;
    const modal = document.getElementById('editFavoriteModal');
    modal.dataset.favoriteId = favorite.id;
    showModal('editFavoriteModal');
  };
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn';
  deleteBtn.textContent = '🗑️';
  deleteBtn.title = 'Delete favorite';
  deleteBtn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Are you sure you want to remove this favorite?')) {
      try {
        console.log('Starting favorite deletion for ID:', favorite.id);
        deleteBtn.disabled = true;
        deleteBtn.textContent = '⌛';
        
        const response = await chrome.runtime.sendMessage({ 
          type: 'DELETE_FAVORITE',
          id: favorite.id
        });
        
        console.log('Delete favorite response:', response);
        
        if (response.status === 'error') {
          throw new Error(response.error || 'Failed to delete favorite');
        }
        
        div.classList.add('removing');
        setTimeout(() => {
          loadFavorites();
          showNotification('Favorite removed successfully! 🗑️');
        }, 300);
      } catch (error) {
        console.error('Error removing favorite:', error);
        showNotification('Error removing favorite: ' + error.message, true);
        deleteBtn.disabled = false;
        deleteBtn.textContent = '🗑️';
        div.classList.remove('removing');
      }
    }
  };
  
  buttonsDiv.appendChild(pinBtn);
  buttonsDiv.appendChild(historyBtn);
  buttonsDiv.appendChild(editBtn);
  buttonsDiv.appendChild(deleteBtn);
  
  div.appendChild(title);
  if (favorite.description) div.appendChild(description);
  if (favorite.tags && favorite.tags.length > 0) div.appendChild(tags);
  div.appendChild(date);
  div.appendChild(buttonsDiv);
  
  return div;
}

// Helper function to determine drag position
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.prompt-item.pinned:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Function to safely render HTML content
function sanitizeAndRenderHTML(html) {
  // Create a temporary div for safe HTML processing
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Remove elements with class e0558cb1
  temp.querySelectorAll('.e0558cb1').forEach(el => el.remove());
  
  // Process code blocks
  temp.querySelectorAll('pre code').forEach(block => {
    block.className = block.className || 'language-plaintext';
  });
  
  // Process inline code
  temp.querySelectorAll('code:not(pre code)').forEach(code => {
    code.className = 'inline-code';
  });
  
  // Process images
  temp.querySelectorAll('img').forEach(img => {
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
  });
  
  return temp.innerHTML;
}

function createMessageElement(message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${message.role}`;
  
  // Add data-source attribute for styling
  if (message.metadata && message.metadata.source) {
    messageDiv.setAttribute('data-source', message.metadata.source);
  }
  
  const header = document.createElement('div');
  header.className = 'message-header';
  header.textContent = message.role === 'user' ? 'You' : 'Assistant';
  
  // Add source indicator if available
  if (message.metadata && message.metadata.source) {
    const sourceIndicator = document.createElement('span');
    sourceIndicator.className = `chat-source-indicator ${message.metadata.source}`;
    sourceIndicator.textContent = message.metadata.source === 'deepseek' ? 'DeepSeek' : 'Google AI';
    header.appendChild(sourceIndicator);
  }
  
  const content = document.createElement('div');
  content.className = 'message-content';
  content.innerHTML = message.html || message.content;
  
  messageDiv.appendChild(header);
  messageDiv.appendChild(content);
  
  return messageDiv;
}

function showChatHistory(tabId, favorite) {
  const modal = document.getElementById('chatHistoryModal');
  const modalContent = document.getElementById('chatHistoryContent');
  const updateButton = document.getElementById('updateChatBtn');
  
  // Clear previous content
  modalContent.innerHTML = '';
  
  if (favorite.messages && favorite.messages.length > 0) {
    favorite.messages.forEach(message => {
      const messageElement = createMessageElement(message);
      modalContent.appendChild(messageElement);
    });
    
    // Add last updated info if available
    if (favorite.lastUpdated) {
      const lastUpdated = document.createElement('div');
      lastUpdated.className = 'last-updated';
      lastUpdated.textContent = `Last updated: ${new Date(favorite.lastUpdated).toLocaleString()}`;
      modalContent.appendChild(lastUpdated);
    }
  } else {
    modalContent.textContent = 'No chat history available.';
  }
  
  // Show modal
  modal.style.display = 'block';
  
  // Update button handler
  updateButton.onclick = async () => {
    try {
      updateButton.disabled = true;
      updateButton.textContent = 'Updating...';
      
      // Get current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      // Request chat content from content script
      const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'getChatContent' });
      
      if (response && response.chatContent) {
        // Update favorite with new messages
        favorite.messages = response.chatContent;
        favorite.lastUpdated = new Date().toISOString();
        
        // Save to storage
        await updateFavorite(favorite);
        
        // Refresh display
        showChatHistory(null, favorite);
      }
    } catch (error) {
      console.error('Error updating chat:', error);
      modalContent.innerHTML += '<div class="error">Failed to update chat content.</div>';
    } finally {
      updateButton.disabled = false;
      updateButton.textContent = 'Update Chat';
    }
  };
}

// Add event listeners for chat history modal
document.addEventListener('DOMContentLoaded', () => {
  // ... existing initialization code ...

  // Setup chat history modal close handlers
  const chatHistoryModal = document.getElementById('chatHistoryModal');
  const closeChatHistoryBtn = document.getElementById('closeChatHistoryModal');
  const closeBtn = document.getElementById('closeChatHistoryBtn');

  if (closeChatHistoryBtn) {
    closeChatHistoryBtn.addEventListener('click', function() {
      chatHistoryModal.style.display = 'none';
      chatHistoryModal.classList.remove('show');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      chatHistoryModal.style.display = 'none';
      chatHistoryModal.classList.remove('show');
    });
  }

  // Close modal when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target === chatHistoryModal) {
      chatHistoryModal.style.display = 'none';
      chatHistoryModal.classList.remove('show');
    }
  });
});

// Function to count tag frequencies from a list of items
function countTagFrequencies(items) {
  const tagFrequencies = {};
  
  items.forEach(item => {
    if (item.tags && Array.isArray(item.tags)) {
      item.tags.forEach(tag => {
        // Clean tag from any special characters
        const cleanTag = tag.replace(/[×✕✖✗✘]/g, '').trim().toLowerCase();
        if (cleanTag) {
          tagFrequencies[cleanTag] = (tagFrequencies[cleanTag] || 0) + 1;
        }
      });
    }
  });
  
  return tagFrequencies;
}

// Function to display the most frequent tags
function displayFrequentTags(containerId, tagFrequencies, searchInputId, loadFunction) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Clear previous tags
  container.innerHTML = '';
  
  // Convert to array and sort by frequency
  const sortedTags = Object.entries(tagFrequencies)
    .sort((a, b) => b[1] - a[1]) // Sort by frequency (descending)
    .slice(0, 10); // Take top 10
  
  if (sortedTags.length === 0) return;
  
  // Create and append tag elements
  sortedTags.forEach(([tag, frequency]) => {
    const tagElement = document.createElement('span');
    tagElement.className = 'tag clickable';
    tagElement.textContent = tag;
    
    // Add click handler to filter by this tag
    tagElement.addEventListener('click', () => {
      const searchInput = document.getElementById(searchInputId);
      if (searchInput) {
        // Get current search query
        let currentQuery = searchInput.value.trim();
        
        // Add # to tag
        const tagWithHash = `#${tag}`;
        
        // If the tag is already in the search query (with #), remove it (toggle behavior)
        if (currentQuery.includes(tagWithHash)) {
          // Remove the tag from the query
          const words = currentQuery.split(/\s+/);
          const filteredWords = words.filter(word => word.toLowerCase() !== tagWithHash.toLowerCase());
          currentQuery = filteredWords.join(' ');
          searchInput.value = currentQuery;
          tagElement.classList.remove('active');
        } else {
          // Add the tag to the existing search query
          const newQuery = currentQuery ? `${currentQuery} ${tagWithHash}` : tagWithHash;
          searchInput.value = newQuery;
          tagElement.classList.add('active');
        }
        
        // Trigger the search with the updated query
        loadFunction(searchInput.value.trim());
      }
    });
    
    container.appendChild(tagElement);
  });
}

// Load favorites
async function getFavoritesWithRetry(retryCount) {
  let attempts = retryCount;
  
  while (attempts > 0) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_FAVORITES' });
      
      // Any response with favorites property is valid (even if empty)
      if (response && response.favorites !== undefined) {
        return {
          status: 'ok',
          favorites: Array.isArray(response.favorites) ? response.favorites : []
        };
      }
    } catch (error) {
      console.debug(`Attempt ${retryCount - attempts + 1} failed:`, error);
    }
    
    attempts--;
    if (attempts > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Return empty favorites array instead of throwing error
  return {
    status: 'ok',
    favorites: []
  };
}

async function loadFavorites(searchQuery = '', retryCount = 3) {
  // Get both the tab and the list elements
  const favoritesTab = document.getElementById('favorites-tab');
  const favoritesList = document.getElementById('favoritesList');
  
  // Check if we're in the right context
  if (!favoritesTab || !favoritesList) {
    console.debug('Favorites elements not found - this is normal if not on the favorites tab');
    return;
  }
  
  // Clear the list without showing loading message
  favoritesList.innerHTML = '';
  
  try {
    // Get favorites - this will never throw now
    const favoritesResponse = await getFavoritesWithRetry(retryCount);
    const favorites = favoritesResponse.favorites;
    
    // Try to load tag frequencies, but don't fail if it doesn't work
    try {
      const tagFrequencies = await getCombinedTagFrequencies('favorites');
      displayFrequentTags('favoriteFrequentTags', tagFrequencies, 'favoritesSearchInput', loadFavorites);
    } catch (tagError) {
      console.debug('Failed to load tag frequencies:', tagError);
    }
    
    // Handle empty favorites case
    if (favorites.length === 0) {
      favoritesList.innerHTML = '<div class="no-items">No favorite chats yet</div>';
      return;
    }
    
    // Filter favorites if search query exists
    const filteredFavorites = filterFavoritesByQuery(favorites, searchQuery);
    
    // Handle no search results
    if (filteredFavorites.length === 0) {
      favoritesList.innerHTML = '<div class="no-items">No matches found</div>';
      return;
    }
    
    // Render favorites
    renderFavorites(filteredFavorites, favoritesList);
    
  } catch (error) {
    // This should rarely happen now since getFavoritesWithRetry always returns a valid response
    console.warn('Unexpected error loading favorites:', error);
    favoritesList.innerHTML = '<div class="error-state">Could not load favorites</div>';
  }
}

// Helper function to filter favorites by search query
function filterFavoritesByQuery(favorites, searchQuery) {
  if (!searchQuery) {
    return favorites;
  }
  
  // Split search query into hashtags and regular words
  const searchWords = searchQuery.toLowerCase().split(/\s+/).filter(word => word);
  const hashtagWords = searchWords.filter(word => word.startsWith('#')).map(tag => tag.slice(1)); // Remove # from tags
  const regularWords = searchWords.filter(word => !word.startsWith('#'));
  
  return favorites.filter(f => {
    // If we have hashtags, check if ALL hashtags match tags exactly
    if (hashtagWords.length > 0) {
      const favoriteTags = (f.tags || []).map(tag => tag.toLowerCase());
      const allHashtagsMatch = hashtagWords.every(hashtagWord => 
        favoriteTags.some(tag => tag.includes(hashtagWord))
      );
      if (!allHashtagsMatch) return false;
    }
    
    // If we have regular words, check if ALL words match any field (including tags)
    if (regularWords.length > 0) {
      const favoriteTags = (f.tags || []).map(tag => tag.toLowerCase());
      return regularWords.every(word => {
        return f.title?.toLowerCase().includes(word) ||
               f.url?.toLowerCase().includes(word) ||
               f.description?.toLowerCase().includes(word) ||
               // Search in tags
               favoriteTags.some(tag => tag.includes(word)) ||
               // Search in chat history messages
               (f.messages && f.messages.some(message => 
                 message.content?.toLowerCase().includes(word) || 
                 message.html?.toLowerCase().includes(word)
               ));
      });
    }
    
    // If we only had hashtags and they all matched, return true
    return true;
  });
}

// Helper function to render favorites
function renderFavorites(favorites, container) {
  // Create containers for pinned and unpinned favorites
  const pinnedContainer = document.createElement('div');
  pinnedContainer.className = 'pinned-favorites-container';
  
  const unpinnedContainer = document.createElement('div');
  unpinnedContainer.className = 'unpinned-favorites-container';
  
  // Sort favorites: pinned first, then by date
  favorites
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (a.pinned && b.pinned) {
        // Sort by order if both are pinned
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        // If order is not set, fall back to date
        return new Date(b.date) - new Date(a.date);
      }
      return new Date(b.date) - new Date(a.date);
    })
    .forEach(favorite => {
      const element = createFavoriteElement(favorite);
      if (favorite.pinned) {
        pinnedContainer.appendChild(element);
      } else {
        unpinnedContainer.appendChild(element);
      }
    });

  // Only append containers if they have favorites
  if (pinnedContainer.children.length > 0) {
    container.appendChild(pinnedContainer);
  }
  
  if (unpinnedContainer.children.length > 0) {
    container.appendChild(unpinnedContainer);
  }
}

// Setup favorites search
const favoritesSearchInput = document.getElementById('favoritesSearchInput');
if (favoritesSearchInput) {
  // Убедимся, что это обычное текстовое поле
  favoritesSearchInput.type = 'text';
  favoritesSearchInput.classList.add('search-input');
  favoritesSearchInput.classList.remove('tags-input');
  favoritesSearchInput.setAttribute('autocomplete', 'off');
  favoritesSearchInput.setAttribute('role', 'textbox');
  
  // Удаляем все дочерние элементы
  while (favoritesSearchInput.firstChild) {
    favoritesSearchInput.removeChild(favoritesSearchInput.firstChild);
  }
  
  const debouncedFavoritesSearch = debounce((query) => {
    loadFavorites(query);
  }, 300);

  favoritesSearchInput.addEventListener('input', (e) => {
    debouncedFavoritesSearch(e.target.value.trim());
  });
}

// Function to update tab counts
async function updateTabCounts() {
  try {
    // Get counts from databases
    const [favorites, prompts, notes] = await Promise.all([
      chrome.runtime.sendMessage({ type: 'GET_FAVORITES' }).then(response => response.favorites || []),
      chrome.runtime.sendMessage({ type: 'GET_PROMPTS' }).then(response => response.prompts || []),
      notesDB.getAllNotes()
    ]);

    // Update tab buttons with counts
    const favoritesTab = document.querySelector('[data-tab="favorites"]');
    const promptsTab = document.querySelector('[data-tab="prompts"]');
    const notesTab = document.querySelector('[data-tab="notes"]');

    if (favoritesTab) {
      favoritesTab.textContent = `Favorite Chats (${favorites.length})`;
    }
    if (promptsTab) {
      promptsTab.textContent = `Prompts (${prompts.length})`;
    }
    if (notesTab) {
      notesTab.textContent = `Notes (${notes.length})`;
    }
  } catch (error) {
    console.error('Error updating tab counts:', error);
  }
}

// Setup tabs
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');
  const addPromptButton = document.getElementById('addPromptButton');
  const addNoteButton = document.getElementById('addNoteButton');

  // Update counts initially
  updateTabCounts();

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      
      // Update active states
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(`${target}-tab`).classList.add('active');
      
      // Show/hide buttons based on active tab
      if (target === 'favorites') {
        addPromptButton.style.display = 'none';
        addNoteButton.style.display = 'none';
        loadFavorites();
      } else if (target === 'prompts') {
        addPromptButton.style.display = 'flex';
        addNoteButton.style.display = 'none';
        loadPrompts();
      } else if (target === 'notes') {
        addPromptButton.style.display = 'none';
        addNoteButton.style.display = 'flex';
        loadNotes();
      }

      // Update counts after loading
      updateTabCounts();
    });
  });
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message in popup:', message.type);
  
  if (message.type === 'REFRESH_FAVORITES' || message.type === 'ADD_FAVORITE' || 
      message.type === 'REFRESH_PROMPTS' || message.type === 'ADD_PROMPT' ||
      message.type === 'REFRESH_NOTES' || message.type === 'ADD_NOTE') {
    updateTabCounts();
  }
  
  if (message.type === 'REFRESH_FAVORITES' || message.type === 'ADD_FAVORITE') {
    // Only reload favorites if we're on the favorites tab
    const favoritesTab = document.getElementById('favorites-tab');
    if (favoritesTab && favoritesTab.classList.contains('active')) {
      loadFavorites();
    }
    return true;
  }
  
  if (message.type === 'SHOW_NOTIFICATION') {
    showNotification(message.message, message.isError);
    return true;
  }
});

// Tags management
function setupTagsInput(container) {
  // Check if this is not a search box
  if (!container || container.classList.contains('search-box') || container.classList.contains('search-input')) return null;
  
  const input = container.querySelector('input');
  if (!input) return null;

  // Check if this is not a search input
  if (input.id === 'promptSearchInput' || input.id === 'favoritesSearchInput' || input.id === 'notesSearchInput') return null;

  let tags = new Set();
  const specialTags = ['deepseek', 'gemini', 'chatgpt'];

  function addTag(tag) {
    // Clean tag from any remove buttons or special characters
    tag = tag.replace(/[×✕✖✗✘]/g, '').trim().toLowerCase();
    if (tag && !tags.has(tag)) {
      tags.add(tag);
      const tagElement = document.createElement('span');
      tagElement.className = 'tag';
      tagElement.textContent = tag;
      
      // Add remove button only in edit modals
      if (container.closest('#editModal') || container.closest('#editFavoriteModal') || container.closest('#addPromptModal')) {
        const removeButton = document.createElement('button');
        removeButton.className = 'tag-remove';
        removeButton.textContent = '×';
        removeButton.dataset.tag = tag;
        tagElement.appendChild(removeButton);
      }
      
      container.insertBefore(tagElement, input);
    }
    input.value = '';
  }

  function removeTag(tag) {
    // Clean tag before removing
    tag = tag.replace(/[×✕✖✗✘]/g, '').trim().toLowerCase();
    tags.delete(tag);
    const tagElements = container.querySelectorAll('.tag');
    tagElements.forEach(el => {
      const tagText = el.textContent.replace(/[×✕✖✗✘]/g, '').trim().toLowerCase();
      if (tagText === tag) {
        el.remove();
      }
    });
  }

  // Remove existing event listeners
  input.removeEventListener('keydown', input._keydownHandler);
  container.removeEventListener('click', container._clickHandler);

  // Add keydown event handler
  input._keydownHandler = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tagValue = input.value.trim();
      if (tagValue) {
        addTag(tagValue);
      }
    } else if (e.key === 'Backspace' && input.value === '') {
      const tagElements = container.querySelectorAll('.tag');
      if (tagElements.length > 0) {
        const lastTag = tagElements[tagElements.length - 1];
        const tag = lastTag.textContent.replace(/[×✕✖✗✘]/g, '').trim();
        removeTag(tag);
      }
    }
  };
  input.addEventListener('keydown', input._keydownHandler);

  // Add click event handler for remove buttons only in edit modals
  if (container.closest('#editModal') || container.closest('#editFavoriteModal') || container.closest('#addPromptModal')) {
    container._clickHandler = (e) => {
      if (e.target.classList.contains('tag-remove')) {
        const tag = e.target.dataset.tag;
        removeTag(tag);
      }
    };
    container.addEventListener('click', container._clickHandler);
  }

  return {
    setTags: (newTags = []) => {
      tags = new Set();
      container.querySelectorAll('.tag').forEach(tag => tag.remove());
      // Clean tags before adding
      newTags.forEach(tag => addTag(tag.replace(/[×✕✖✗✘]/g, '').trim()));
    },
    getTags: () => Array.from(tags).map(tag => tag.replace(/[×✕✖✗✘]/g, '').trim())
  };
}

// Character counter
function updateCharCounter(input, limit) {
  if (!input) return;
  
  if (!input.parentElement.querySelector('.char-counter')) {
    const counter = document.createElement('span');
    counter.className = 'char-counter';
    input.parentElement.appendChild(counter);
  }

  const length = input.value.trim().length;
  const counter = input.parentElement.querySelector('.char-counter');
  requestAnimationFrame(() => {
    counter.textContent = `${length}/${limit}`;
    counter.classList.toggle('near-limit', length > limit * 0.9);
    counter.classList.toggle('at-limit', length >= limit);
  });
}

// Modal management
let currentEditingPrompt = null;
let currentEditingFavorite = null;
let currentEditFavoriteTagsManager = null;

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.style.display = 'block';
  
  // Set values when opening edit modal
  if (modalId === 'editModal' && currentEditingPrompt) {
    const titleInput = document.getElementById('editPromptTitle');
    const editInput = document.getElementById('editPromptInput');
    const tagsContainer = document.getElementById('editPromptTags');
    
    titleInput.value = currentEditingPrompt.title || '';
    editInput.value = currentEditingPrompt.text || '';
    
    // Initialize tags manager and set existing tags
    const editTagsManager = setupTagsInput(tagsContainer);
    if (editTagsManager) {
      editTagsManager.setTags(currentEditingPrompt.tags || []);
    }
    
    updateCharCounter(editInput, 5000);
  } else if (modalId === 'addPromptModal') {
    // Clear inputs
    const titleInput = document.getElementById('promptTitle');
    const textInput = document.getElementById('promptInput');
    const tagsContainer = document.getElementById('promptTags');
    
    titleInput.value = '';
    textInput.value = '';
    
    // Initialize empty tags manager for new prompts
    const tagsManager = setupTagsInput(tagsContainer);
    if (tagsManager) {
      tagsManager.setTags([]);
    }
    updateCharCounter(textInput, 5000);
  } else if (modalId === 'editFavoriteModal' && currentEditingFavorite) {
    const titleInput = document.getElementById('editFavoriteTitle');
    const descriptionInput = document.getElementById('editFavoriteDescription');
    
    titleInput.value = currentEditingFavorite.title || '';
    descriptionInput.value = currentEditingFavorite.description || '';
    
    // Initialize tags manager only once
    if (!currentEditFavoriteTagsManager) {
      currentEditFavoriteTagsManager = setupTagsInput(document.getElementById('editFavoriteTags'));
    }
    
    // Clear and set tags
    if (currentEditFavoriteTagsManager) {
      currentEditFavoriteTagsManager.setTags(currentEditingFavorite.tags || []);
    }
  }

  requestAnimationFrame(() => {
    modal.classList.add('show');
    modal.querySelector('.modal').classList.add('show');
  });
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('show');
  modal.querySelector('.modal').classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
    if (modalId === 'editModal') {
      currentEditingPrompt = null;
      // Clear tags when closing edit modal
      const tagsContainer = document.getElementById('editPromptTags');
      const tagsManager = setupTagsInput(tagsContainer);
      if (tagsManager) {
        tagsManager.setTags([]);
      }
    } else if (modalId === 'addPromptModal') {
      // Clear tags when closing add modal
      const tagsContainer = document.getElementById('promptTags');
      const tagsManager = setupTagsInput(tagsContainer);
      if (tagsManager) {
        tagsManager.setTags([]);
      }
    } else if (modalId === 'editFavoriteModal') {
      currentEditingFavorite = null;
      modal.dataset.favoriteId = '';
      if (currentEditFavoriteTagsManager) {
        currentEditFavoriteTagsManager.setTags([]);
        currentEditFavoriteTagsManager = null;
      }
    }
  }, 300);
}

// Create prompt element
function createPromptElement(prompt) {
  const div = document.createElement('div');
  div.className = 'prompt-item';
  if (prompt.pinned) {
    div.classList.add('pinned');
    div.draggable = true;
    div.dataset.promptId = prompt.id;
    
    // Add drag event listeners
    div.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      div.classList.add('dragging');
      e.dataTransfer.setData('text/plain', prompt.id);
    });
    
    div.addEventListener('dragend', (e) => {
      e.stopPropagation();
      div.classList.remove('dragging');
      document.querySelectorAll('.prompt-item.pinned').forEach(prompt => {
        prompt.classList.remove('drag-over');
      });
    });
    
    div.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const draggingElement = document.querySelector('.prompt-item.dragging');
      if (draggingElement && draggingElement !== div) {
        const container = div.parentElement;
        const cardRect = div.getBoundingClientRect();
        const dragY = e.clientY;
        const threshold = cardRect.top + cardRect.height / 2;
        
        document.querySelectorAll('.prompt-item.pinned').forEach(prompt => {
          prompt.classList.remove('drag-over');
        });
        
        if (dragY < threshold) {
          div.classList.add('drag-over');
        }
      }
    });
    
    div.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const draggedId = e.dataTransfer.getData('text/plain');
      const targetId = prompt.id;
      
      if (draggedId !== targetId) {
        const pinnedContainer = document.querySelector('.pinned-prompts-container');
        const cards = [...pinnedContainer.querySelectorAll('.prompt-item.pinned')];
        
        const currentOrder = cards.map(card => card.dataset.promptId);
        const draggedIndex = currentOrder.indexOf(draggedId);
        const targetIndex = currentOrder.indexOf(targetId);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
          const cardRect = div.getBoundingClientRect();
          const dropY = e.clientY;
          const threshold = cardRect.top + cardRect.height / 2;
          
          let newIndex = targetIndex;
          if (dropY > threshold) {
            newIndex++;
          }
          
          currentOrder.splice(draggedIndex, 1);
          currentOrder.splice(newIndex, 0, draggedId);
          
          try {
            // Get all pinned prompts
            const response = await chrome.runtime.sendMessage({ type: 'GET_PROMPTS' });
            if (response.status === 'ok') {
              const prompts = response.prompts;
              const pinnedPrompts = prompts.filter(p => p.pinned);
              
              // Update order for each pinned prompt
              for (let i = 0; i < pinnedPrompts.length; i++) {
                const prompt = pinnedPrompts[i];
                const newOrderIndex = currentOrder.indexOf(prompt.id);
                if (newOrderIndex !== -1) {
                  await chrome.runtime.sendMessage({
                    type: 'UPDATE_PROMPT',
                    prompt: {
                      ...prompt,
                      order: newOrderIndex
                    }
                  });
                }
              }
              
              await loadPrompts();
            }
          } catch (error) {
            console.error('Error updating prompts order:', error);
            showNotification('Error updating order! ❌', true);
          }
        }
      }
      
      document.querySelectorAll('.prompt-item.pinned').forEach(prompt => {
        prompt.classList.remove('drag-over');
      });
    });
  }
  
  const title = document.createElement('h3');
  title.className = 'prompt-title';
  title.textContent = prompt.title || 'Untitled Prompt';
  
  const text = document.createElement('p');
  text.textContent = prompt.text.length > 100 
    ? prompt.text.slice(0, 100) + '...'
    : prompt.text;
  
  const date = document.createElement('small');
  date.textContent = new Date(prompt.date).toLocaleString();
  if (prompt.edited) {
    date.textContent += ' (edited ' + new Date(prompt.edited).toLocaleString() + ')';
  }

  const tags = document.createElement('div');
  tags.className = 'prompt-tags';
  if (prompt.tags && prompt.tags.length > 0) {
    prompt.tags.forEach(tag => {
      const tagSpan = document.createElement('span');
      tagSpan.className = 'tag clickable';
      // Clean tag text from any remove buttons or special characters
      tagSpan.textContent = tag.replace(/[×✕✖✗✘]/g, '').trim();
      tagSpan.onclick = (e) => {
        e.stopPropagation();
        const searchInput = document.getElementById('promptSearchInput');
        if (searchInput) {
          // Clean tag text from any remove buttons or special characters
          const cleanTag = tag.replace(/[×✕✖✗✘]/g, '').trim().toLowerCase();
          console.log('Clicked tag:', cleanTag);
          
          // Get current search query
          let currentQuery = searchInput.value.trim();
          console.log('Current query:', currentQuery);
          
          // If the tag is already in the search query (with #), don't add it again
          const tagWithHash = `#${cleanTag}`;
          console.log('Tag with hash:', tagWithHash);
          
          if (currentQuery.toLowerCase().includes(tagWithHash.toLowerCase())) {
            // Remove the tag if it's already in the search
            const words = currentQuery.split(/\s+/);
            const filteredWords = words.filter(word => 
              word.toLowerCase() !== tagWithHash.toLowerCase()
            );
            currentQuery = filteredWords.join(' ');
            searchInput.value = currentQuery;
            tagSpan.classList.remove('active');
            console.log('Removed tag, new query:', currentQuery);
          } else {
            // Add the tag to the existing search query with #
            const newQuery = currentQuery ? `${currentQuery} ${tagWithHash}` : tagWithHash;
            searchInput.value = newQuery;
            tagSpan.classList.add('active');
            console.log('Added tag, new query:', newQuery);
          }
          
          // Trigger the search with the updated query
          loadPrompts(searchInput.value.trim());
        }
      };
      tags.appendChild(tagSpan);
    });
  }
  
  const buttonsDiv = document.createElement('div');
  buttonsDiv.className = 'prompt-buttons';
  
  const pinBtn = document.createElement('button');
  pinBtn.className = 'btn';
  pinBtn.textContent = prompt.pinned ? '📌' : '📍';
  pinBtn.title = prompt.pinned ? 'Unpin from top' : 'Pin to top';
  pinBtn.onclick = async (e) => {
    e.stopPropagation();
    try {
      // Check if we're trying to pin and if we've reached the limit
      if (!prompt.pinned) {
        const response = await chrome.runtime.sendMessage({ type: 'GET_PROMPTS' });
        if (response.status === 'ok') {
          const pinnedCount = response.prompts.filter(p => p.pinned).length;
          if (pinnedCount >= 10) {
            showNotification('Maximum number of pinned items (10) reached! 📌', true);
            return;
          }
        }
      }

      const updatedPrompt = {
        ...prompt,
        pinned: !prompt.pinned,
        edited: new Date()
      };
      
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_PROMPT',
        prompt: updatedPrompt
      });
      
      if (response.status === 'error') {
        throw new Error(response.error);
      }
      
      await loadPrompts();
      showNotification(updatedPrompt.pinned ? 'Prompt pinned to top! 📌' : 'Prompt unpinned! 📍');
      
    } catch (error) {
      console.error('Error updating pin state:', error);
      showNotification('Error updating pin state! ❌', true);
    }
  };

  const editBtn = document.createElement('button');
  editBtn.className = 'btn';
  editBtn.textContent = '✏️';
  editBtn.title = 'Edit prompt';
  editBtn.onclick = (e) => {
    e.stopPropagation();
    currentEditingPrompt = prompt;
    showModal('editModal');
  };

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn';
  deleteBtn.textContent = '🗑️';
  deleteBtn.title = 'Delete prompt';
  deleteBtn.onclick = async (e) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this prompt?')) {
      try {
        deleteBtn.disabled = true;
        deleteBtn.textContent = '⌛';
        
        const response = await chrome.runtime.sendMessage({
          type: 'DELETE_PROMPT',
          id: prompt.id
        });
        
        if (response.status === 'error') {
          throw new Error(response.error);
        }
        
        div.classList.add('removing');
        setTimeout(() => {
          loadPrompts();
          showNotification('Prompt deleted successfully! 🗑️');
        }, 300);
      } catch (error) {
        console.error('Error deleting prompt:', error);
        showNotification('Error deleting prompt! ❌', true);
        deleteBtn.disabled = false;
        deleteBtn.textContent = '🗑️';
        div.classList.remove('removing');
      }
    }
  };

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn';
  copyBtn.textContent = '📋';
  copyBtn.title = 'Copy to clipboard';
  copyBtn.onclick = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(prompt.text);
    showNotification('Prompt copied to clipboard! 📋');
  };

  buttonsDiv.appendChild(pinBtn);
  buttonsDiv.appendChild(copyBtn);
  buttonsDiv.appendChild(editBtn);
  buttonsDiv.appendChild(deleteBtn);
  
  div.appendChild(title);
  div.appendChild(text);
  div.appendChild(tags);
  div.appendChild(date);
  div.appendChild(buttonsDiv);
  
  return div;
}

// Load prompts
async function loadPrompts(searchQuery = '', retryCount = 3) {
  try {
    const promptsResponse = await chrome.runtime.sendMessage({ type: 'GET_PROMPTS' });
    
    if (promptsResponse.status === 'error') {
      if (retryCount > 0 && promptsResponse.error.includes('not initialized')) {
        console.log(`Retrying to load prompts... (${retryCount} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 500));
        return loadPrompts(searchQuery, retryCount - 1);
      }
      throw new Error(promptsResponse.error);
    }
    
    const prompts = promptsResponse.prompts || [];
    const promptsList = document.getElementById('promptsList');
    promptsList.innerHTML = '';

    // Display frequent tags using only prompts frequencies
    const tagFrequencies = await getCombinedTagFrequencies('prompts');
    displayFrequentTags('promptFrequentTags', tagFrequencies, 'promptSearchInput', loadPrompts);

    if (prompts.length === 0) {
      promptsList.innerHTML = '<div class="no-items">No prompts yet</div>';
      return;
    }
    
    // Enhanced filtering with tag-based search
    const filteredPrompts = searchQuery 
      ? prompts.filter(p => {
          // Split search query into words and handle tag-based search
          const searchWords = searchQuery.toLowerCase().split(/\s+/).filter(word => word);
          
          console.log('Search words:', searchWords);
          console.log('Prompt tags:', p.tags);
          
          return searchWords.every(word => {
            if (word.startsWith('#')) {
              // For tag searches, remove the # and check if the prompt has the tag
              const tagToSearch = word.slice(1).toLowerCase();
              console.log('Searching for tag:', tagToSearch);
              
              // Make sure tags exist and is an array
              if (!p.tags || !Array.isArray(p.tags)) {
                console.log('No tags found for prompt');
                return false;
              }
              
              // Clean and lowercase all prompt tags for comparison
              const promptTags = p.tags.map(tag => tag.replace(/[×✕✖✗✘]/g, '').trim().toLowerCase());
              console.log('Prompt tags after cleaning:', promptTags);
              
              const hasTag = promptTags.includes(tagToSearch);
              console.log('Tag found?', hasTag);
              return hasTag;
            } else {
              // For non-tag words, check title, text and tags
              const titleMatch = p.title?.toLowerCase().includes(word) || false;
              const textMatch = p.text.toLowerCase().includes(word);
              
              // Check tags if they exist
              let tagMatch = false;
              if (p.tags && Array.isArray(p.tags)) {
                const promptTags = p.tags.map(tag => tag.replace(/[×✕✖✗✘]/g, '').trim().toLowerCase());
                tagMatch = promptTags.some(tag => tag.includes(word));
              }
              
              return titleMatch || textMatch || tagMatch;
            }
          });
        })
      : prompts;

    console.log('Filtered prompts:', filteredPrompts.length);

    if (filteredPrompts.length === 0) {
      promptsList.innerHTML = '<div class="no-items">No matches found</div>';
      return;
    }

    // Create containers for pinned and unpinned prompts
    const pinnedContainer = document.createElement('div');
    pinnedContainer.className = 'pinned-prompts-container';
    
    const unpinnedContainer = document.createElement('div');
    unpinnedContainer.className = 'unpinned-prompts-container';
    
    // Sort prompts: pinned first (by order), then by date
    filteredPrompts
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        if (a.pinned && b.pinned) {
          // Sort by order if both are pinned
          if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
          }
          // If order is not set, fall back to date
          return new Date(b.date) - new Date(a.date);
        }
        return new Date(b.date) - new Date(a.date);
      })
      .forEach(prompt => {
        const element = createPromptElement(prompt);
        if (prompt.pinned) {
          pinnedContainer.appendChild(element);
        } else {
          unpinnedContainer.appendChild(element);
        }
      });

    // Only append containers if they have prompts
    if (pinnedContainer.children.length > 0) {
      promptsList.appendChild(pinnedContainer);
    }
    
    if (unpinnedContainer.children.length > 0) {
      promptsList.appendChild(unpinnedContainer);
    }

  } catch (error) {
    console.error('Error loading prompts:', error);
    showNotification('Error loading prompts! ❌', true);
  }
}

// Setup search inputs
const setupSearchInputs = () => {
  // Setup prompts search
  const promptSearchInput = document.getElementById('promptSearchInput');
  if (promptSearchInput) {
    const newInput = document.createElement('input');
    newInput.type = 'text';
    newInput.id = 'promptSearchInput';
    newInput.className = 'search-input';
    newInput.placeholder = 'Search prompts...';
    newInput.setAttribute('autocomplete', 'off');
    newInput.setAttribute('role', 'textbox');
    
    promptSearchInput.parentNode.replaceChild(newInput, promptSearchInput);
    
    const debouncedPromptSearch = debounce((query) => {
      // Clean any potential tag remove characters from the search query
      const cleanQuery = query.replace(/[×✕✖✗✘]/g, '').trim();
      loadPrompts(cleanQuery);
    }, 300);

    newInput.addEventListener('input', (e) => {
      debouncedPromptSearch(e.target.value.trim());
    });
  }

  // Setup favorites search
  const favoritesSearchInput = document.getElementById('favoritesSearchInput');
  if (favoritesSearchInput) {
    const newInput = document.createElement('input');
    newInput.type = 'text';
    newInput.id = 'favoritesSearchInput';
    newInput.className = 'search-input';
    newInput.placeholder = 'Search favorites...';
    newInput.setAttribute('autocomplete', 'off');
    newInput.setAttribute('role', 'textbox');
    
    favoritesSearchInput.parentNode.replaceChild(newInput, favoritesSearchInput);
    
    const debouncedFavoritesSearch = debounce((query) => {
      loadFavorites(query);
    }, 300);

    newInput.addEventListener('input', (e) => {
      debouncedFavoritesSearch(e.target.value.trim());
    });
  }

  // Setup notes search
  const notesSearchInput = document.getElementById('notesSearchInput');
  if (notesSearchInput) {
    // Создаем новый элемент input
    const newInput = document.createElement('input');
    newInput.type = 'text';
    newInput.id = 'notesSearchInput';
    newInput.className = 'search-input';
    newInput.placeholder = 'Search notes...';
    newInput.setAttribute('autocomplete', 'off');
    newInput.setAttribute('role', 'textbox');
    
    // Заменяем старый элемент новым
    notesSearchInput.parentNode.replaceChild(newInput, notesSearchInput);
    
    const debouncedNotesSearch = debounce((query) => {
      filterNotes(query);
    }, 300);

    newInput.addEventListener('input', (e) => {
      debouncedNotesSearch(e.target.value.trim());
    });
  }
};

// Initialize search inputs
setupSearchInputs();

// Инициализация базы данных
let db = null;

async function initDatabase() {
  return new Promise((resolve, reject) => {
    console.log('Starting database initialization...');
    const dbRequest = indexedDB.open('deepseekDB', 1);

    dbRequest.onupgradeneeded = function(event) {
      const db = event.target.result;
      console.log('Database upgrade needed, creating stores...');
      
      // Создаем хранилища, если их нет
      if (!db.objectStoreNames.contains('favorites')) {
        console.log('Creating favorites store...');
        db.createObjectStore('favorites', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('prompts')) {
        console.log('Creating prompts store...');
        db.createObjectStore('prompts', { keyPath: 'id' });
      }
      console.log('Stores created successfully');
    };

    dbRequest.onsuccess = function(event) {
      db = event.target.result;
      console.log('Database initialized successfully. Available stores:', Array.from(db.objectStoreNames));
      
      // Проверяем содержимое хранилищ
      const transaction = db.transaction(['favorites', 'prompts'], 'readonly');
      const favoritesStore = transaction.objectStore('favorites');
      const promptsStore = transaction.objectStore('prompts');
      
      favoritesStore.count().onsuccess = function(e) {
        console.log('Number of favorites:', e.target.result);
      };
      
      promptsStore.count().onsuccess = function(e) {
        console.log('Number of prompts:', e.target.result);
      };
      
      resolve(db);
    };

    dbRequest.onerror = function(event) {
      console.error('Database initialization error:', event.target.error);
      reject(new Error('Failed to initialize database'));
    };
  });
}

// Функция для очистки всех данных
async function clearAllData() {
  return new Promise((resolve, reject) => {
    try {
      if (!db) {
        console.error('Database not initialized');
        reject(new Error('Database not initialized'));
        return;
      }

      const storeNames = Array.from(db.objectStoreNames);
      console.log('Attempting to clear stores:', storeNames);

      if (storeNames.length === 0) {
        console.error('No stores found in database');
        reject(new Error('No stores found'));
        return;
      }

      const transaction = db.transaction(storeNames, 'readwrite');
      let completed = 0;

      storeNames.forEach(storeName => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
          console.log(`Successfully cleared store: ${storeName}`);
          completed++;
          if (completed === storeNames.length) {
            resolve();
          }
        };

        request.onerror = (error) => {
          console.error(`Failed to clear store ${storeName}:`, error);
          reject(new Error(`Failed to clear store: ${storeName}`));
        };
      });

      transaction.oncomplete = () => {
        console.log('All stores cleared successfully');
        resolve();
      };

      transaction.onerror = (error) => {
        console.error('Transaction failed:', error);
        reject(new Error('Transaction failed'));
      };
    } catch (error) {
      console.error('Error in clearAllData:', error);
      reject(error);
    }
  });
}

// Initialize
async function initialize() {
  console.log('Initializing popup...');

  // Проверяем наличие отложенного импорта
  try {
    await dataExporter.handlePendingImport();
  } catch (error) {
    console.error('Error handling pending import:', error);
  }

  // Initialize theme - apply it immediately to prevent flash of unthemed content
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.body.setAttribute('data-theme', savedTheme);
  
  // Then set up the rest of the theme functionality
  initTheme();
  setupThemeButtons();
  setupTabs();

  // Load favorites since we start on Favorites tab
  loadFavorites();
  
  // Initialize tag displays with combined frequencies
  await refreshTagDisplays();

  // Initialize settings
  await initSettingsModal();
  
  // Update tab counts after initialization
  await updateTabCounts();

  // Setup settings button
  document.getElementById('openSettingsBtn').addEventListener('click', () => {
    showModal('settingsModal');
  });

  // Hide Add Note and Add Prompt buttons by default since we start on Favorites tab
  const addNoteButton = document.getElementById('addNoteButton');
  if (addNoteButton) {
    addNoteButton.style.display = 'none';
  }

  const addPromptButton = document.getElementById('addPromptButton');
  if (addPromptButton) {
    addPromptButton.style.display = 'none';
  }

  // Setup keyboard shortcuts for note editor
  const noteContent = document.getElementById('noteContent');
  if (noteContent) {
    // Add auto-save on blur
    noteContent.addEventListener('blur', async () => {
      if (contentChanged && !isSaving && !isClosing) {
        await saveNoteContent();
      }
    });

    // Add auto-save when window loses focus
    window.addEventListener('blur', async () => {
      if (contentChanged && !isSaving && !isClosing) {
        await saveNoteContent();
      }
    });

    // Add auto-save before extension closes
    window.addEventListener('beforeunload', async (e) => {
      if (contentChanged && !isSaving && !isClosing) {
        await saveNoteContent();
      }
    });

    noteContent.addEventListener('keydown', function(e) {
      if (e.ctrlKey) {
        const start = this.selectionStart;
        const end = this.selectionEnd;
        const selectedText = this.value.substring(start, end);
        
        // Handle Ctrl+Enter to close the modal
        if (e.key === 'Enter') {
          e.preventDefault();
          closeNoteModal();
          return;
        }
        
        // Only proceed if there is selected text
        if (selectedText) {
          let beforeText = this.value.substring(0, start);
          let afterText = this.value.substring(end);
          
          switch (e.key.toLowerCase()) {
            case 'b': // Bold
              e.preventDefault();
              this.value = beforeText + '**' + selectedText + '**' + afterText;
              this.selectionStart = start + 2;
              this.selectionEnd = end + 2;
              break;
              
            case 'i': // Italic
              e.preventDefault();
              this.value = beforeText + '*' + selectedText + '*' + afterText;
              this.selectionStart = start + 1;
              this.selectionEnd = end + 1;
              break;
              
            case 'h': // Highlight
              e.preventDefault();
              this.value = beforeText + '==' + selectedText + '==' + afterText;
              this.selectionStart = start + 2;
              this.selectionEnd = end + 2;
              break;
          }
        }
      }
    });
  }

  // Setup delete all data handler
  document.querySelector('.delete-btn')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all data? This will delete all your Favorite Chats, Prompts and Notes.')) {
      try {
        showToast('Clearing data...', 'info');
        
        // Force UI refresh immediately
        const promptsContainer = document.getElementById('prompts-tab');
        const favoritesContainer = document.getElementById('favorites-tab');
        const notesContainer = document.getElementById('notes-tab');
        
        // Clear containers with empty state messages
        if (promptsContainer) promptsContainer.innerHTML = '<div class="empty-state">No prompts found</div>';
        if (favoritesContainer) favoritesContainer.innerHTML = '<div class="empty-state">No favorites found</div>';
        if (notesContainer) notesContainer.innerHTML = '<div class="empty-state">No notes found</div>';
        
        // Clear search inputs
        const promptSearchInput = document.getElementById('promptSearchInput');
        const favoritesSearchInput = document.getElementById('favoritesSearchInput');
        const notesSearchInput = document.getElementById('notesSearchInput');
        
        if (promptSearchInput) promptSearchInput.value = '';
        if (favoritesSearchInput) favoritesSearchInput.value = '';
        if (notesSearchInput) notesSearchInput.value = '';

        // Clear all databases in sequence
        console.log('Clearing prompts...');
        await promptDB.clearAll();
        
        console.log('Clearing favorites...');
        await favoritesDB.clearAll();
        
        console.log('Clearing notes...');
        await notesDB.clearAll();

        // Update tab counts after clearing
        await updateTabCounts();

        // Send message to background script
        await chrome.runtime.sendMessage({ type: 'CLEAR_ALL_DATA' });

        // Get active tab
        const activeTab = document.querySelector('.tab-btn.active');
        const activeTabId = activeTab ? activeTab.dataset.tab : 'prompts';
        
        // Refresh tag displays
        await refreshTagDisplays();

        showToast('All data has been cleared successfully! 🗑️', 'success');
        console.log('All data cleared successfully');
      } catch (error) {
        console.error('Error clearing data:', error);
        showToast(`Error clearing data: ${error.message}`, 'error');
        
        // Try to recover
        try {
          await initDatabases();
          const activeTab = document.querySelector('.tab-btn.active');
          const activeTabId = activeTab ? activeTab.dataset.tab : 'prompts';
          
          // Show empty states instead of trying to load data
          const container = document.getElementById(`${activeTabId}-tab`);
          if (container) {
            container.innerHTML = `<div class="empty-state">No ${activeTabId} found</div>`;
          }
          
          await refreshTagDisplays();
        } catch (refreshError) {
          console.error('Error refreshing views:', refreshError);
        }
      }
    }
  });

  // Setup chat history modal handlers
  const chatHistoryModal = document.getElementById('chatHistoryModal');
  const closeChatHistoryBtn = document.getElementById('closeChatHistoryModal');
  const closeBtn = document.getElementById('closeChatHistoryBtn');

  if (closeChatHistoryBtn) {
    closeChatHistoryBtn.addEventListener('click', function() {
      chatHistoryModal.style.display = 'none';
      chatHistoryModal.classList.remove('show');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      chatHistoryModal.style.display = 'none';
      chatHistoryModal.classList.remove('show');
    });
  }

  // Close modal when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target === chatHistoryModal) {
      chatHistoryModal.style.display = 'none';
      chatHistoryModal.classList.remove('show');
    }
  });

  // Setup notes modal handlers
  const noteModal = document.getElementById('noteModal');
  
  // Add Note button handler
  document.getElementById('addNoteButton')?.addEventListener('click', () => {
    openNoteModal();
    noteModal.classList.add('show');
    noteModal.style.display = 'block';
  });

  // Close note modal handler
  document.getElementById('closeNoteModal')?.addEventListener('click', () => {
    closeNoteModal();
  });

  // Close modal when clicking outside
  noteModal?.addEventListener('click', (e) => {
    if (e.target === noteModal) {
      closeNoteModal();
    }
  });

  // Initialize notes database
  notesDB.init().then(() => {
    // Setup tags managers
    const promptTagsManager = setupTagsInput(document.getElementById('promptTags'));
    const editTagsManager = setupTagsInput(document.getElementById('editPromptTags'));
    
    // Setup character counters
    const promptInput = document.getElementById('promptInput');
    if (promptInput) {
      updateCharCounter(promptInput, 5000);
      promptInput.addEventListener('input', () => updateCharCounter(promptInput, 5000));
    }
    
    const editPromptInput = document.getElementById('editPromptInput');
    if (editPromptInput) {
      editPromptInput.addEventListener('input', () => updateCharCounter(editPromptInput, 5000));
    }
    
    // Setup save prompt handler
    document.getElementById('savePrompt')?.addEventListener('click', async () => {
      try {
        const titleInput = document.getElementById('promptTitle');
        const textInput = document.getElementById('promptInput');
        const tagsContainer = document.getElementById('promptTags');
        const title = titleInput.value.trim();
        const text = textInput.value.trim();
        
        if (!text) {
          showNotification('Please enter prompt text! ❌', true);
          return;
        }
        
        // Get tags from the container
        const tags = Array.from(tagsContainer.querySelectorAll('.tag'))
          .map(tag => tag.textContent.trim())
          .filter(tag => tag); // Remove empty tags
        
        const prompt = {
          id: Date.now().toString(),
          title: title || 'Untitled Prompt',
          text: text,
          tags: tags,
          date: new Date()
        };
        
        const response = await chrome.runtime.sendMessage({
          type: 'ADD_PROMPT',
          prompt: prompt
        });
        
        if (response.status === 'error') {
          throw new Error(response.error);
        }
        
        // Clear inputs
        titleInput.value = '';
        textInput.value = '';
        
        // Clear tags
        const tagsManager = setupTagsInput(tagsContainer);
        if (tagsManager) {
          tagsManager.setTags([]);
        }
        updateCharCounter(textInput, 5000);
        
        // Hide modal and refresh list
        hideModal('addPromptModal');
        await loadPrompts();
        showNotification('Prompt saved successfully! ✨');
        
      } catch (error) {
        console.error('Error saving prompt:', error);
        showNotification('Error saving prompt! ❌', true);
      }
    });
    
    // Setup save edit handler
    document.getElementById('saveEdit')?.addEventListener('click', async () => {
      try {
        if (!currentEditingPrompt) {
          throw new Error('No prompt being edited');
        }
        
        const titleInput = document.getElementById('editPromptTitle');
        const textInput = document.getElementById('editPromptInput');
        const tagsContainer = document.getElementById('editPromptTags');
        const title = titleInput.value.trim();
        const text = textInput.value.trim();
        
        if (!text) {
          showNotification('Please enter prompt text! ❌', true);
          return;
        }
        
        // Get tags from the container
        const tags = Array.from(tagsContainer.querySelectorAll('.tag'))
          .map(tag => tag.textContent.trim())
          .filter(tag => tag); // Remove empty tags
        
        const updatedPrompt = {
          ...currentEditingPrompt,
          title: title || 'Untitled Prompt',
          text: text,
          tags: tags,
          edited: new Date(),
          pinned: currentEditingPrompt.pinned // Preserve pinned state
        };
        
        const response = await chrome.runtime.sendMessage({
          type: 'UPDATE_PROMPT',
          prompt: updatedPrompt
        });
        
        if (response.status === 'error') {
          throw new Error(response.error);
        }
        
        // Hide modal and refresh list
        hideModal('editModal');
        await loadPrompts();
        showNotification('Prompt updated successfully! ✨');
        
      } catch (error) {
        console.error('Error updating prompt:', error);
        showNotification('Error updating prompt! ❌', true);
      }
    });
    
    // Setup modal events for edit modal
    document.getElementById('closeModal')?.addEventListener('click', () => hideModal('editModal'));
    document.getElementById('cancelEdit')?.addEventListener('click', () => hideModal('editModal'));
    document.getElementById('editModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'editModal') hideModal('editModal');
    });
    
    // Setup modal events for add prompt modal
    document.getElementById('addPromptButton')?.addEventListener('click', () => showModal('addPromptModal'));
    document.getElementById('closeAddPromptModal')?.addEventListener('click', () => hideModal('addPromptModal'));
    document.getElementById('cancelAddPrompt')?.addEventListener('click', () => hideModal('addPromptModal'));
    document.getElementById('addPromptModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'addPromptModal') hideModal('addPromptModal');
    });
    
    // Setup modal events for edit favorite modal
    document.getElementById('closeFavoriteModal')?.addEventListener('click', () => hideModal('editFavoriteModal'));
    document.getElementById('cancelFavoriteEdit')?.addEventListener('click', () => hideModal('editFavoriteModal'));
    document.getElementById('editFavoriteModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'editFavoriteModal') hideModal('editFavoriteModal');
    });

    // Setup save favorite edit handler
    document.getElementById('saveFavoriteEdit')?.addEventListener('click', async () => {
      try {
        if (!currentEditingFavorite) {
          throw new Error('No favorite being edited');
        }
        
        const titleInput = document.getElementById('editFavoriteTitle');
        const descriptionInput = document.getElementById('editFavoriteDescription');
        const title = titleInput.value.trim();
        const description = descriptionInput.value.trim();
        
        // Get tags from the current tags manager
        const tags = currentEditFavoriteTagsManager ? currentEditFavoriteTagsManager.getTags() : [];
        
        const updatedFavorite = {
          ...currentEditingFavorite,
          title: title || 'Untitled Chat',
          description: description,
          tags: tags,
          edited: new Date()
        };
        
        const response = await chrome.runtime.sendMessage({
          type: 'UPDATE_FAVORITE',
          favorite: updatedFavorite
        });
        
        if (response.status === 'error') {
          throw new Error(response.error);
        }
        
        // Hide modal and refresh list
        hideModal('editFavoriteModal');
        await loadFavorites();
        showNotification('Favorite updated successfully! ✨');
        
      } catch (error) {
        console.error('Error updating favorite:', error);
        showNotification('Error updating favorite! ❌', true);
      }
    });
    
    console.log('Popup initialized');
  });
}

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, starting initialization...');
  initialize();
});

// Error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  showNotification('An error occurred! Please check the console for details. ❌', true);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  showNotification('An error occurred! Please check the console for details. ❌', true);
});

// Listen for notification messages
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    showNotification(event.data.message, event.data.isError);
  }
});

// Notes functionality
let currentNoteId = null;
let isClosing = false;
let lastSavedContent = '';
let contentChanged = false;
let isSaving = false;

async function loadNotes() {
  try {
    const notesList = document.getElementById('notes-tab');
    if (!notesList) {
      console.warn('Notes container not found');
      return;
    }

    // Clear existing content
    notesList.innerHTML = '';

    // Create containers for pinned and unpinned notes
    const pinnedContainer = document.createElement('div');
    pinnedContainer.className = 'pinned-notes';
    
    const unpinnedContainer = document.createElement('div');
    unpinnedContainer.className = 'unpinned-notes';

    try {
      const notes = await notesDB.getAllNotes();
      
      if (!notes || notes.length === 0) {
        notesList.innerHTML = '<div class="empty-state">No notes found</div>';
        return;
      }

      // Sort notes: pinned first (by order), then by date
      notes.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        if (a.pinned && b.pinned) {
          // Sort by order if both are pinned
          if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
          }
          // If order is not set, fall back to date
          return new Date(b.date) - new Date(a.date);
        }
        return new Date(b.date) - new Date(a.date);
      });

      notes.forEach(note => {
        const noteElement = createNoteCard(note);
        if (note.pinned) {
          pinnedContainer.appendChild(noteElement);
        } else {
          unpinnedContainer.appendChild(noteElement);
        }
      });

      // Only append containers if they have content
      if (pinnedContainer.children.length > 0) {
        notesList.appendChild(pinnedContainer);
      }
      
      if (unpinnedContainer.children.length > 0) {
        notesList.appendChild(unpinnedContainer);
      }

    } catch (error) {
      console.error('Error loading notes:', error);
      notesList.innerHTML = '<div class="error-state">Error loading notes. Please try again.</div>';
    }
  } catch (error) {
    console.error('Error in loadNotes:', error);
  }
}

// Function to convert basic markdown to HTML
function convertMarkdownToHtml(text) {
  if (!text) return '';

  // Create a container for the result
  const container = document.createElement('div');
  
  // Split text into lines and process each line
  const lines = text.split('\n');
  
  let inList = false;
  let currentList = null;
  let listType = null; // 'ul' for unordered, 'ol' for ordered
  
  lines.forEach((line, index) => {
    // Process headers first
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      if (inList) {
        container.appendChild(currentList);
        inList = false;
        currentList = null;
        listType = null;
      }
      const level = headerMatch[1].length;
      const headerText = headerMatch[2];
      const header = document.createElement(`h${level}`);
      header.textContent = headerText;
      header.style.marginTop = '0.5em';
      header.style.marginBottom = '0.3em';
      container.appendChild(header);
      return;
    }

    // Process list items
    const unorderedListMatch = line.match(/^\s*\*\s+(.+)$/);
    const orderedListMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    
    if (unorderedListMatch || orderedListMatch) {
      const newListType = unorderedListMatch ? 'ul' : 'ol';
      const listText = (unorderedListMatch || orderedListMatch)[1];
      
      // If we're not in a list or switching list types, create a new list
      if (!inList || listType !== newListType) {
        if (inList) {
          container.appendChild(currentList);
        }
        currentList = document.createElement(newListType);
        currentList.style.marginTop = '0.5em';
        currentList.style.marginBottom = '0.5em';
        currentList.style.paddingLeft = '1.5em';
        inList = true;
        listType = newListType;
      }
      
      const li = document.createElement('li');
      li.textContent = listText;
      currentList.appendChild(li);
      
      // If this is the last line and we're in a list, append the list
      if (index === lines.length - 1) {
        container.appendChild(currentList);
      }
      return;
    } else if (inList) {
      container.appendChild(currentList);
      inList = false;
      currentList = null;
      listType = null;
    }

    // Process regular text
    if (line.trim()) {
      const paragraph = document.createElement('p');
      let currentPosition = 0;
      
      // Process markdown links [text](url)
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let match;
      
      while ((match = linkRegex.exec(line)) !== null) {
        // Add text before the link
        if (match.index > currentPosition) {
          const textNode = document.createTextNode(line.substring(currentPosition, match.index));
          paragraph.appendChild(textNode);
        }
        
        // Create link element
        const link = document.createElement('a');
        link.textContent = match[1]; // Link text
        link.href = match[2].trim(); // URL
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        paragraph.appendChild(link);
        
        currentPosition = match.index + match[0].length;
      }
      
      // Add remaining text after last link
      if (currentPosition < line.length) {
        const textNode = document.createTextNode(line.substring(currentPosition));
        paragraph.appendChild(textNode);
      }
      
      // Process plain URLs in the remaining text
      if (!linkRegex.test(line)) {
        const urlRegex = /https?:\/\/[^\s<>]+/g;
        let urlMatch;
        let lastIndex = 0;
        
        while ((urlMatch = urlRegex.exec(paragraph.textContent)) !== null) {
          // Replace text node with parts
          const originalNode = paragraph.childNodes[paragraph.childNodes.length - 1];
          const beforeText = document.createTextNode(originalNode.textContent.substring(0, urlMatch.index));
          const afterText = document.createTextNode(originalNode.textContent.substring(urlMatch.index + urlMatch[0].length));
          
          const link = document.createElement('a');
          link.href = urlMatch[0];
          link.textContent = urlMatch[0];
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          
          paragraph.replaceChild(afterText, originalNode);
          paragraph.insertBefore(link, afterText);
          paragraph.insertBefore(beforeText, link);
        }
      }
      
      container.appendChild(paragraph);
    }
  });
  
  // Process other markdown elements
  let html = container.innerHTML;
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Highlight
  html = html.replace(/==(.*?)==/g, '<mark>$1</mark>');
  
  // Remove outer divs and preserve paragraphs
  html = html.replace(/<\/?div>/g, '');
  
  return html;
}

function createNoteCard(note) {
  const card = document.createElement('div');
  card.className = 'note-card';
  if (note.pinned) {
    card.classList.add('pinned');
    card.draggable = true;
    card.dataset.noteId = note.id;
    
    // Добавляем обработчики для перетаскивания
    card.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', note.id);
    });

    card.addEventListener('dragend', (e) => {
      e.stopPropagation();
      card.classList.remove('dragging');
      document.querySelectorAll('.note-card.pinned').forEach(note => {
        note.classList.remove('drag-over');
      });
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const draggingCard = document.querySelector('.note-card.dragging');
      if (draggingCard && draggingCard !== card) {
        const container = card.parentElement;
        if (!container) return;

        const rect = card.getBoundingClientRect();
        const threshold = rect.top + rect.height / 2;

        // Удаляем предыдущие индикаторы
        document.querySelectorAll('.note-card.pinned').forEach(note => {
          note.classList.remove('drag-over-top');
          note.classList.remove('drag-over-bottom');
        });

        // Добавляем визуальный индикатор
        if (e.clientY < threshold) {
          card.classList.add('drag-over-top');
        } else {
          card.classList.add('drag-over-bottom');
        }

        // Определяем позицию для вставки
        if (e.clientY < threshold) {
          container.insertBefore(draggingCard, card);
        } else {
          container.insertBefore(draggingCard, card.nextSibling);
        }
      }
    });

    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const container = card.parentElement;
      if (!container) return;

      // Получаем все карточки в текущем порядке после перетаскивания
      const cards = [...container.querySelectorAll('.note-card.pinned')];
      const currentOrder = cards.map(card => Number(card.dataset.noteId));
      
      try {
        // Обновляем порядок в базе данных
        await notesDB.updateNotesOrder(currentOrder);
        // Перезагружаем заметки для обновления отображения
        await loadNotes();
      } catch (error) {
        console.error('Error updating notes order:', error);
        showNotification('Error updating notes order', true);
      }
      
      document.querySelectorAll('.note-card.pinned').forEach(note => {
        note.classList.remove('drag-over');
      });
    });
  }
  
  // Создаем контент заметки
  const content = document.createElement('div');
  content.className = 'note-card-content';
  content.dataset.originalContent = note.content;
  content.innerHTML = convertMarkdownToHtml(note.content);
  
  const header = document.createElement('div');
  header.className = 'note-card-header';
  
  const leftHeader = document.createElement('div');
  leftHeader.className = 'note-card-header-left';
  
  const date = document.createElement('span');
  date.className = 'note-card-date';
  date.textContent = new Date(note.date).toLocaleDateString();
  
  leftHeader.appendChild(date);
  header.appendChild(leftHeader);
  
  const actions = document.createElement('div');
  actions.className = 'note-card-actions';
  
  const pinButton = document.createElement('button');
  pinButton.innerHTML = note.pinned ? '📌' : '📍';
  pinButton.title = note.pinned ? 'Unpin note' : 'Pin note';
  pinButton.onclick = async (e) => {
    e.stopPropagation();
    try {
      // Check if we're trying to pin and if we've reached the limit
      if (!note.pinned) {
        const notes = await notesDB.getAllNotes();
        const pinnedCount = notes.filter(n => n.pinned).length;
        if (pinnedCount >= 10) {
          showNotification('Maximum number of pinned items (10) reached! 📌', true);
          return;
        }
      }

      await notesDB.toggleNotePinned(note.id);
      await loadNotes();
      showNotification(note.pinned ? 'Note unpinned' : 'Note pinned');
    } catch (error) {
      console.error('Error toggling pin status:', error);
      showNotification('Error updating pin status', true);
    }
  };
  
  const viewButton = document.createElement('button');
  viewButton.innerHTML = '👁️';
  viewButton.title = 'View note';
  viewButton.onclick = (e) => {
    e.stopPropagation();
    openViewNoteModal(note);
  };
  
  const editButton = document.createElement('button');
  editButton.innerHTML = '✏️';
  editButton.title = 'Edit note';
  editButton.onclick = (e) => {
    e.stopPropagation();
    openNoteModal({...note, content: content.dataset.originalContent});
  };
  
  const deleteButton = document.createElement('button');
  deleteButton.innerHTML = '🗑️';
  deleteButton.title = 'Delete note';
  deleteButton.onclick = async (e) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this note?')) {
      await notesDB.deleteNote(note.id);
      loadNotes();
    }
  };
  
  actions.appendChild(pinButton);
  actions.appendChild(viewButton);
  actions.appendChild(editButton);
  actions.appendChild(deleteButton);
  
  card.appendChild(header);
  card.appendChild(content);
  card.appendChild(actions);
  
  return card;
}

function openViewNoteModal(note) {
  const modal = document.getElementById('viewNoteModal');
  const contentElement = document.getElementById('viewNoteContent');
  const addNoteButton = document.getElementById('addNoteButton');
  
  // Hide the Add Note button
  if (addNoteButton) {
    addNoteButton.style.display = 'none';
  }
  
  // Convert and set content
  contentElement.innerHTML = convertMarkdownToHtml(note.content);
  
  // Add click handler for edit button
  const editButton = document.getElementById('editNoteFromView');
  editButton.onclick = () => {
    closeViewNoteModal();
    openNoteModal(note);
  };
  
  // Show modal
  modal.style.display = 'block';
  modal.classList.add('show');
  modal.querySelector('.modal').classList.add('show');
}

function closeViewNoteModal() {
  const modal = document.getElementById('viewNoteModal');
  const addNoteButton = document.getElementById('addNoteButton');
  
  // Show Add Note button only if we're on the Notes tab
  if (addNoteButton) {
    const notesTab = document.querySelector('.tab-btn[data-tab="notes"]');
    if (notesTab && notesTab.classList.contains('active')) {
      addNoteButton.style.display = 'flex';
    }
  }
  
  modal.classList.remove('show');
  modal.querySelector('.modal').classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300);
}

function openNoteModal(note = null) {
  const modal = document.getElementById('noteModal');
  const contentInput = document.getElementById('noteContent');
  const addNoteButton = document.getElementById('addNoteButton');
  
  // Update modal header structure
  const modalHeader = modal.querySelector('.modal-header');
  modalHeader.innerHTML = `
    <div class="modal-title-wrapper">
      <button class="view-note-btn" title="View Note">👁️</button>
    </div>
    <button class="modal-close" title="Close">&times;</button>
  `;
  
  // Add click handler for View Note button
  const viewButton = modalHeader.querySelector('.view-note-btn');
  viewButton.onclick = () => {
    closeNoteModal();
    // Use the raw content for preview
    openViewNoteModal({ id: currentNoteId, content: contentInput.value });
  };
  
  // Add click handler for close button
  const closeButton = modalHeader.querySelector('.modal-close');
  closeButton.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeNoteModal();
  };
  
  if (addNoteButton) {
    addNoteButton.style.display = 'none';
  }
  
  currentNoteId = note ? note.id : null;
  // Use the original content for editing
  contentInput.value = note ? note.content : '';
  lastSavedContent = contentInput.value;
  contentChanged = false;
  
  // Add input handler to track changes
  contentInput.addEventListener('input', () => {
    contentChanged = contentInput.value.trim() !== lastSavedContent;
  });
  
  modal.style.display = 'block';
  modal.classList.add('show');
  modal.querySelector('.modal').classList.add('show');
  
  // Focus the input
  contentInput.focus();
}

async function closeNoteModal(event) {
  if (event) {
    event.stopPropagation();
  }
  
  if (isClosing) return;
  isClosing = true;

  try {
    const modal = document.getElementById('noteModal');
    const contentInput = document.getElementById('noteContent');
    const addNoteButton = document.getElementById('addNoteButton');

    // Save only if content has changed and we're not already saving
    if (contentChanged && !isSaving) {
      await saveNoteContent();
    }

    // Show Add Note button if we're on the Notes tab
    const notesTab = document.querySelector('.tab-btn[data-tab="notes"]');
    if (notesTab && notesTab.classList.contains('active') && addNoteButton) {
      addNoteButton.style.display = 'flex';
    }

    modal.classList.remove('show');
    modal.querySelector('.modal').classList.remove('show');

    setTimeout(() => {
      modal.style.display = 'none';
      currentNoteId = null;
      contentInput.value = '';
      lastSavedContent = '';
      contentChanged = false;
      isClosing = false;
    }, 300);

  } catch (error) {
    console.error('Error in closeNoteModal:', error);
    showNotification('Error saving note! ❌', true);
    isClosing = false;
  }
}

// Initialize modal close handlers
document.querySelector('#noteModal .modal-close')?.addEventListener('click', closeNoteModal);
document.querySelector('#viewNoteModal .modal-close')?.addEventListener('click', closeViewNoteModal);

document.getElementById('noteModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'noteModal') {
    closeNoteModal(e);
  }
});

document.getElementById('viewNoteModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'viewNoteModal') {
    closeViewNoteModal();
  }
});

// Handle Escape key for both modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const noteModal = document.getElementById('noteModal');
    const viewNoteModal = document.getElementById('viewNoteModal');
    
    if (noteModal.style.display === 'block') {
      closeNoteModal(e);
    } else if (viewNoteModal.style.display === 'block') {
      closeViewNoteModal();
    }
  }
  
  // Handle Ctrl+Enter to save changes in any open modal
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    
    // Check which modal is open and trigger its save button
    const editModal = document.getElementById('editModal');
    const addPromptModal = document.getElementById('addPromptModal');
    const editFavoriteModal = document.getElementById('editFavoriteModal');
    const noteModal = document.getElementById('noteModal');
    const settingsModal = document.getElementById('settingsModal');
    
    if (editModal && editModal.style.display === 'block') {
      // Trigger Save Changes button in Edit Prompt modal
      document.getElementById('saveEdit')?.click();
    } else if (addPromptModal && addPromptModal.style.display === 'block') {
      // Trigger Save Prompt button in Add Prompt modal
      document.getElementById('savePrompt')?.click();
    } else if (editFavoriteModal && editFavoriteModal.style.display === 'block') {
      // Trigger Save Changes button in Edit Favorite modal
      document.getElementById('saveFavoriteEdit')?.click();
    } else if (noteModal && noteModal.style.display === 'block') {
      // For note modal, save the content
      saveNoteContent().then(() => {
        closeNoteModal(e);
      });
    } else if (settingsModal && settingsModal.style.display === 'block') {
      // Trigger Save Settings button in Settings modal
      document.getElementById('saveSettingsBtn')?.click();
    }
  }
});

function filterNotes(searchText) {
  const noteCards = document.querySelectorAll('.note-card');
  const searchLower = searchText.toLowerCase();
  
  noteCards.forEach(card => {
    const content = card.querySelector('.note-card-content').textContent.toLowerCase();
    const matches = content.includes(searchLower);
    card.style.display = matches ? 'block' : 'none';
  });
}

// Setup notes search
document.getElementById('notesSearchInput')?.addEventListener('input', (e) => filterNotes(e.target.value));

// Add new saveNoteContent function
async function saveNoteContent() {
  const contentInput = document.getElementById('noteContent');
  if (!contentInput || isSaving) return;

  const content = contentInput.value.trim();
  if (!content || content === lastSavedContent) return;

  try {
    isSaving = true;
    
    if (currentNoteId) {
      // Получаем существующую заметку, чтобы сохранить её свойства
      const existingNote = await notesDB.getNote(currentNoteId);
      const note = {
        id: currentNoteId,
        content: content,
        date: new Date().toISOString(),
        pinned: existingNote ? existingNote.pinned : false,
        order: existingNote ? existingNote.order : undefined
      };
      await notesDB.updateNote(note);
    } else {
      const note = {
        content: content,
        date: new Date().toISOString(),
        pinned: false
      };
      const savedNote = await notesDB.addNote(note);
      currentNoteId = savedNote.id;
    }
    
    lastSavedContent = content;
    contentChanged = false;
    await loadNotes();
  } catch (error) {
    console.error('Error saving note:', error);
  } finally {
    isSaving = false;
  }
}

// Settings management
const DEFAULT_SETTINGS = {
  provider: 'openrouter',
  apiKeys: {
    openrouter: '',
    google: ''
  },
  model: '',
  titlePrompt: 'Generate a concise and descriptive title for this content.',
  summaryPrompt: 'Summarize the key points of this content in 2-3 sentences.',
  tagsPrompt: 'Generate 3-5 relevant tags for this content, separated by commas.'
};

// Models available for each provider
const PROVIDER_MODELS = {
  openrouter: [
    { id: 'google/gemini-2.0-flash-001', name: 'gemini-2.0-flash-001' },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek-V3' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini' },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'The Meta Llama 3.3' }
  ],
  google: [
    { id: 'gemini-2.0-flash-001', name: 'gemini-2.0-flash' },
    { id: 'gemini-2.0-pro-exp-02-05', name: 'gemini-2.0-pro' },
    { id: 'gemini-2.0-flash-thinking-exp-01-21', name: 'gemini-2.0-flash-thinking-exp' },
    { id: 'gemini-2.0-flash-exp', name: 'gemini-2.0-flash-exp' }
  ]
};

// Load settings from storage
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('settings', (result) => {
      const settings = result.settings || DEFAULT_SETTINGS;
      resolve(settings);
    });
  });
}

// Save settings to storage
async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings }, () => {
      resolve();
    });
  });
}

// Toggle API key visibility with eye icon animation
document.getElementById('toggleApiKeyVisibility').addEventListener('click', () => {
  const apiKeyInput = document.getElementById('apiKeyInput');
  const eyeIcon = document.querySelector('.eye-icon');
  
  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    // Change to "eye-off" icon
    eyeIcon.innerHTML = `
      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
    `;
  } else {
    apiKeyInput.type = 'password';
    // Change back to "eye" icon
    eyeIcon.innerHTML = `
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
    `;
  }
});

// Create a toast notification system
function createToastSystem() {
  // Create container if it doesn't exist
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 70px; /* Adjusted for better centering */
      transform: translateX(-50%);
      z-index: 9999;
      width: auto;
      max-width: 90%;
      pointer-events: none; /* Allow clicking through the container */
      display: flex;
      flex-direction: column;
      align-items: center;
    `;
    document.body.appendChild(toastContainer);
  }
  
  return {
    show: function(message, type = 'info', duration = 3000) {
      return new Promise((resolve) => {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.textContent = message;
        toast.style.cssText = `
          margin-bottom: 10px;
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.3s ease;
          pointer-events: auto;
          text-align: center;
          min-width: 200px;
          max-width: 280px;
          width: fit-content;
          margin-left: auto;
          margin-right: auto;
        `;
        
        // Add to container
        toastContainer.appendChild(toast);
        
        // Show with animation
        setTimeout(() => {
          toast.style.opacity = '1';
          toast.style.transform = 'translateY(0)';
        }, 10);
        
        // Auto hide after duration
        const hideTimeout = setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(20px)';
          
          // Remove after animation completes
          setTimeout(() => {
            if (toast.parentNode) {
              toastContainer.removeChild(toast);
            }
            resolve();
          }, 300);
        }, duration);
        
        // Store timeout for potential early cleanup
        toast._hideTimeout = hideTimeout;
      });
    }
  };
}

// Initialize toast system
const toast = createToastSystem();

// Check connection to API with improved UI feedback
async function checkConnection(provider, apiKey) {
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  
  // Validate input
  if (!apiKey || apiKey.trim() === '') {
    await toast.show('Please enter an API key', 'error');
    return false;
  }
  
  // Disable button and show loading state
  testConnectionBtn.disabled = true;
  testConnectionBtn.classList.add('testing');
  
  // Show loading toast
  const loadingToast = document.createElement('div');
  loadingToast.className = 'toast-notification loading';
  loadingToast.textContent = 'Connecting...';
  loadingToast.style.marginBottom = '10px';
  document.getElementById('toast-container').appendChild(loadingToast);
  
  // Animate in
  setTimeout(() => {
    loadingToast.style.opacity = '1';
    loadingToast.style.transform = 'translateY(0)';
  }, 10);
  
  try {
    let isValid = false;
    let responseData = null;
    
    if (provider === 'openrouter') {
      try {
        // First, validate the API key format
        if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
          throw new Error('Invalid OpenRouter API key format. Keys should start with "sk-"');
        }
        
        // Test the connection to OpenRouter
        const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `API returned status ${response.status}`);
        }
        
        responseData = await response.json();
        isValid = true;
      } catch (error) {
        throw new Error(`OpenRouter connection failed: ${error.message}`);
      }
    } else if (provider === 'google') {
      try {
        // Validate Google AI API key format
        if (!apiKey.startsWith('AIza') || apiKey.length < 30) {
          throw new Error('Invalid Google AI API key format. Keys should start with "AIza"');
        }
        
        // Test connection to Google AI API (Gemini)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `API returned status ${response.status}`);
        }
        
        responseData = await response.json();
        isValid = true;
      } catch (error) {
        throw new Error(`Google AI connection failed: ${error.message}`);
      }
    }
    
    // Remove loading toast
    loadingToast.style.opacity = '0';
    loadingToast.style.transform = 'translateY(20px)';
    setTimeout(() => {
      if (loadingToast.parentNode) {
        document.getElementById('toast-container').removeChild(loadingToast);
      }
    }, 300);
    
    if (isValid) {
      // Display success message with additional info if available
      let successMessage = 'Connection successful!';
      
      if (provider === 'openrouter' && responseData?.data?.name) {
        successMessage += ` Connected as: ${responseData.data.name}`;
      } else if (provider === 'google' && responseData?.models?.length > 0) {
        successMessage += ` Found ${responseData.models.length} available models`;
      }
      
      await toast.show(successMessage, 'success');
      return true;
    } else {
      await toast.show('Connection failed. Check your API key.', 'error');
      return false;
    }
  } catch (error) {
    // Remove loading toast
    loadingToast.style.opacity = '0';
    loadingToast.style.transform = 'translateY(20px)';
    setTimeout(() => {
      if (loadingToast.parentNode) {
        document.getElementById('toast-container').removeChild(loadingToast);
      }
    }, 300);
    
    await toast.show(`Error: ${error.message}`, 'error');
    console.error('Connection test error:', error);
    return false;
  } finally {
    // Re-enable button and remove testing class
    testConnectionBtn.disabled = false;
    testConnectionBtn.classList.remove('testing');
  }
}

// Function to show connection status with auto-hide
function showConnectionStatus(message, type) {
  return new Promise((resolve) => {
    const connectionStatus = document.getElementById('connectionStatus');
    
    // Функция для сброса состояния
    const resetStatus = () => {
      connectionStatus.classList.remove('show');
      connectionStatus._isResetting = true;
      
      setTimeout(() => {
        if (connectionStatus._isResetting) {
          connectionStatus.textContent = '';
          connectionStatus.className = 'connection-status';
          connectionStatus._isResetting = false;
        }
        resolve();
      }, 300);
    };
    
    // Очищаем все предыдущие состояния и таймеры
    if (connectionStatus._hideTimeout) {
      clearTimeout(connectionStatus._hideTimeout);
      connectionStatus._hideTimeout = null;
    }
    
    if (connectionStatus._hideAnimation) {
      clearTimeout(connectionStatus._hideAnimation);
      connectionStatus._hideAnimation = null;
    }
    
    if (connectionStatus._showDelay) {
      clearTimeout(connectionStatus._showDelay);
      connectionStatus._showDelay = null;
    }
    
    // Если элемент уже показывается, сначала скроем его
    if (connectionStatus.classList.contains('show')) {
      connectionStatus.classList.remove('show');
      connectionStatus._hideAnimation = setTimeout(() => {
        updateAndShowStatus();
      }, 300);
    } else {
      updateAndShowStatus();
    }
    
    function updateAndShowStatus() {
      // Сбрасываем флаг сброса
      connectionStatus._isResetting = false;
      
      // Обновляем статус
      connectionStatus.textContent = message;
      connectionStatus.className = 'connection-status';
      if (type) {
        connectionStatus.classList.add(type);
      }
      
      // Показываем с небольшой задержкой
      connectionStatus._showDelay = setTimeout(() => {
        if (!connectionStatus._isResetting) {
          connectionStatus.classList.add('show');
          
          // Автоматическое скрытие для success и error
          if (type === 'success' || type === 'error') {
            connectionStatus._hideTimeout = setTimeout(() => {
              if (!connectionStatus._isResetting) {
                resetStatus();
              }
            }, 3000);
          } else {
            resolve();
          }
        }
      }, 50);
    }
  });
}

// Populate model select based on provider
function populateModelSelect(provider) {
  const modelSelect = document.getElementById('modelSelect');
  modelSelect.innerHTML = '';
  
  PROVIDER_MODELS[provider].forEach(model => {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.name;
    modelSelect.appendChild(option);
  });
}

// Initialize settings modal
async function initSettingsModal() {
  const settings = await loadSettings();
  const connectionStatus = document.getElementById('connectionStatus');
  
  // Set initial values
  document.getElementById('providerSelect').value = settings.provider;
  populateModelSelect(settings.provider);
  document.getElementById('apiKeyInput').value = settings.apiKeys[settings.provider] || '';
  document.getElementById('modelSelect').value = settings.model || PROVIDER_MODELS[settings.provider][0].id;
  document.getElementById('titlePromptInput').value = settings.titlePrompt || DEFAULT_SETTINGS.titlePrompt;
  document.getElementById('summaryPromptInput').value = settings.summaryPrompt || DEFAULT_SETTINGS.summaryPrompt;
  document.getElementById('tagsPromptInput').value = settings.tagsPrompt || DEFAULT_SETTINGS.tagsPrompt;
  
  // Setup AI description generation
  document.getElementById('generateDescriptionBtn')?.addEventListener('click', async () => {
    try {
      if (!currentEditingFavorite) {
        throw new Error('No favorite being edited');
      }

      const settings = await loadSettings();
      if (!settings.apiKeys[settings.provider] || !settings.model) {
        showNotification('Please configure API settings first! ⚙️', true);
        return;
      }

      const generateBtn = document.getElementById('generateDescriptionBtn');
      generateBtn.disabled = true;
      generateBtn.innerHTML = '<svg class="ai-icon" viewBox="0 0 24 24" width="16" height="16"><path d="M12 4V2C6.48 2 2 6.48 2 12h2c0-4.41 3.59-8 8-8zm6 2h-2c0 3.31-2.69 6-6 6s-6-2.69-6-6H4c0 4.41 3.59 8 8 8s8-3.59 8-8zm-6 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>';

      // Get chat history text
      const chatHistory = currentEditingFavorite.messages
        ?.map(msg => `${msg.role}: ${msg.content}`)
        .join('\n\n') || '';

      if (!chatHistory) {
        throw new Error('No chat history available');
      }

      // Prepare the prompt
      const prompt = `${settings.summaryPrompt}\n\nChat History:\n${chatHistory}`;

      // Call the AI API
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_TEXT',
        prompt: prompt,
        provider: settings.provider,
        model: settings.model,
        apiKey: settings.apiKeys[settings.provider]
      });

      if (response.status === 'error') {
        throw new Error(response.error);
      }

      // Update the description field
      const descriptionInput = document.getElementById('editFavoriteDescription');
      descriptionInput.value = response.text.trim();

      showNotification('Description generated successfully! ✨');
    } catch (error) {
      console.error('Error generating description:', error);
      showNotification(`Error generating description: ${error.message || 'Failed to generate description'} ❌\nTry using a different model or check your API settings.`, true);
    } finally {
      const generateBtn = document.getElementById('generateDescriptionBtn');
      generateBtn.disabled = false;
      generateBtn.innerHTML = '<svg class="ai-icon" viewBox="0 0 24 24" width="16" height="16"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
    }
  });
  
  // Clear connection status
  connectionStatus.textContent = '';
  connectionStatus.className = 'connection-status';
  
  // Show connection status if API key is present
  const currentApiKey = settings.apiKeys[settings.provider];
  if (currentApiKey && currentApiKey.trim() !== '') {
    connectionStatus.textContent = 'API key saved. Click "Test Connection" to verify.';
    connectionStatus.className = 'connection-status';
  }
  
  // Create a debounced save function
  const saveSettingsDebounced = debounce(async () => {
    try {
      const provider = document.getElementById('providerSelect').value;
      const apiKey = document.getElementById('apiKeyInput').value;
      const model = document.getElementById('modelSelect').value;
      const titlePrompt = document.getElementById('titlePromptInput').value;
      const summaryPrompt = document.getElementById('summaryPromptInput').value;
      const tagsPrompt = document.getElementById('tagsPromptInput').value;
      
      // Update settings object
      settings.provider = provider;
      settings.apiKeys[provider] = apiKey;
      settings.model = model;
      settings.titlePrompt = titlePrompt;
      settings.summaryPrompt = summaryPrompt;
      settings.tagsPrompt = tagsPrompt;
      
      // Save to storage
      await saveSettings(settings);
      
      // Show subtle notification
      connectionStatus.textContent = 'Settings saved';
      connectionStatus.className = 'connection-status success';
      
      // Clear the notification after 2 seconds
      setTimeout(() => {
        if (apiKey && apiKey.trim() !== '') {
          connectionStatus.textContent = 'API key saved. Click "Test Connection" to verify.';
          connectionStatus.className = 'connection-status';
        } else {
          connectionStatus.textContent = '';
          connectionStatus.className = 'connection-status';
        }
      }, 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
      
      // Show error notification
      connectionStatus.textContent = 'Error saving settings';
      connectionStatus.className = 'connection-status error';
    }
  }, 1000);
  
  // Add auto-save to all input fields
  document.getElementById('providerSelect').addEventListener('change', () => {
    const provider = document.getElementById('providerSelect').value;
    populateModelSelect(provider);
    
    // Update API key field with the saved key for the selected provider
    const savedApiKey = settings.apiKeys[provider] || '';
    document.getElementById('apiKeyInput').value = savedApiKey;
    
    // Update model selection
    const savedModel = settings.model && PROVIDER_MODELS[provider].some(m => m.id === settings.model) 
      ? settings.model 
      : PROVIDER_MODELS[provider][0].id;
    document.getElementById('modelSelect').value = savedModel;
    
    // Update connection status
    if (savedApiKey && savedApiKey.trim() !== '') {
      connectionStatus.textContent = 'API key saved. Click "Test Connection" to verify.';
      connectionStatus.className = 'connection-status';
    } else {
      connectionStatus.textContent = '';
      connectionStatus.className = 'connection-status';
    }
    
    // Auto-save settings
    saveSettingsDebounced();
  });
  
  document.getElementById('modelSelect').addEventListener('change', saveSettingsDebounced);
  document.getElementById('apiKeyInput').addEventListener('input', () => {
    // Clear connection status when API key is changed
    connectionStatus.textContent = 'Changes not saved yet';
    connectionStatus.className = 'connection-status';
    saveSettingsDebounced();
  });
  document.getElementById('titlePromptInput').addEventListener('input', saveSettingsDebounced);
  document.getElementById('summaryPromptInput').addEventListener('input', saveSettingsDebounced);
  document.getElementById('tagsPromptInput').addEventListener('input', saveSettingsDebounced);
  
  // Test connection button
  document.getElementById('testConnectionBtn').addEventListener('click', async () => {
    const provider = document.getElementById('providerSelect').value;
    const apiKey = document.getElementById('apiKeyInput').value;
    
    // Save settings before testing connection
    settings.provider = provider;
    settings.apiKeys[provider] = apiKey;
    await saveSettings(settings);
    
    // Test the connection
    await checkConnection(provider, apiKey);
  });
  
  // Toggle API key visibility with stored handler
  const toggleHandler = () => {
    const apiKeyInput = document.getElementById('apiKeyInput');
    const eyeIcon = document.querySelector('.eye-icon');
    
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      // Change to "eye-off" icon
      eyeIcon.innerHTML = `
        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
      `;
    } else {
      apiKeyInput.type = 'password';
      // Change back to "eye" icon
      eyeIcon.innerHTML = `
        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
      `;
    }
  };
  
  const toggleBtn = document.getElementById('toggleApiKeyVisibility');
  toggleBtn._toggleHandler = toggleHandler; // Store the handler
  toggleBtn.addEventListener('click', toggleHandler);
  
  // Close button
  document.getElementById('closeSettingsModal').addEventListener('click', () => {
    hideModal('settingsModal');
  });
  
  // Additional close button in footer
  document.getElementById('closeSettingsBtn').addEventListener('click', () => {
    hideModal('settingsModal');
  });
  
  // Close when clicking outside the modal
  document.getElementById('settingsModal').addEventListener('click', (e) => {
    if (e.target.id === 'settingsModal') {
      hideModal('settingsModal');
    }
  });

  // Setup AI title generation
  document.getElementById('generateTitleBtn')?.addEventListener('click', async () => {
    try {
      if (!currentEditingFavorite) {
        throw new Error('No favorite being edited');
      }

      const settings = await loadSettings();
      if (!settings.apiKeys[settings.provider] || !settings.model) {
        showNotification('Please configure API settings first! ⚙️', true);
        return;
      }

      const generateBtn = document.getElementById('generateTitleBtn');
      generateBtn.disabled = true;
      generateBtn.innerHTML = '<svg class="ai-icon" viewBox="0 0 24 24" width="16" height="16"><path d="M12 4V2C6.48 2 2 6.48 2 12h2c0-4.41 3.59-8 8-8zm6 2h-2c0 3.31-2.69 6-6 6s-6-2.69-6-6H4c0 4.41 3.59 8 8 8s8-3.59 8-8zm-6 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>';

      // Get chat history text
      const chatHistory = currentEditingFavorite.messages
        ?.map(msg => `${msg.role}: ${msg.content}`)
        .join('\n\n') || '';

      if (!chatHistory) {
        throw new Error('No chat history available');
      }

      // Prepare the prompt
      const prompt = `${settings.titlePrompt}\n\nChat History:\n${chatHistory}`;

      // Call the AI API
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_TEXT',
        prompt: prompt,
        provider: settings.provider,
        model: settings.model,
        apiKey: settings.apiKeys[settings.provider]
      });

      if (response.status === 'error') {
        throw new Error(response.error);
      }

      // Update the title field
      const titleInput = document.getElementById('editFavoriteTitle');
      titleInput.value = response.text.trim();

      showNotification('Title generated successfully! ✨');
    } catch (error) {
      console.error('Error generating title:', error);
      showNotification(`Error generating title: ${error.message || 'Failed to generate title'} ❌\nTry using a different model or check your API settings.`, true);
    } finally {
      const generateBtn = document.getElementById('generateTitleBtn');
      generateBtn.disabled = false;
      generateBtn.innerHTML = '<svg class="ai-icon" viewBox="0 0 24 24" width="16" height="16"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
    }
  });
}

// Function to get combined tag frequencies from both favorites and prompts
async function getCombinedTagFrequencies(type = 'all') {
  try {
    let items = [];
    
    if (type === 'favorites') {
      const favoritesResponse = await chrome.runtime.sendMessage({ type: 'GET_FAVORITES' });
      if (favoritesResponse && favoritesResponse.status === 'ok') {
        items = favoritesResponse.favorites || [];
      }
    } else if (type === 'prompts') {
      const promptsResponse = await chrome.runtime.sendMessage({ type: 'GET_PROMPTS' });
      if (promptsResponse && promptsResponse.status === 'ok') {
        items = promptsResponse.prompts || [];
      }
    }
    
    return countTagFrequencies(items);
  } catch (error) {
    console.error('Error getting tag frequencies:', error);
    return {};
  }
}

// Function to refresh tag displays with the latest frequencies
async function refreshTagDisplays() {
  try {
    // Get separate frequencies for favorites and prompts
    const favoritesFrequencies = await getCombinedTagFrequencies('favorites');
    const promptsFrequencies = await getCombinedTagFrequencies('prompts');
    
    // Update each tag container with its specific frequencies
    displayFrequentTags('favoriteFrequentTags', favoritesFrequencies, 'favoritesSearchInput', loadFavorites);
    displayFrequentTags('promptFrequentTags', promptsFrequencies, 'promptSearchInput', loadPrompts);
  } catch (error) {
    console.error('Error refreshing tag displays:', error);
  }
}

// Remove any standalone toggle visibility event listener if it exists
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleApiKeyVisibility');
  if (toggleBtn) {
    // Remove any existing handlers
    const oldHandler = toggleBtn._toggleHandler;
    if (oldHandler) {
      toggleBtn.removeEventListener('click', oldHandler);
    }
    
    // Add new handler
    const toggleHandler = () => {
      const apiKeyInput = document.getElementById('apiKeyInput');
      const eyeIcon = toggleBtn.querySelector('.eye-icon');
      
      if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        eyeIcon.innerHTML = `
          <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
        `;
      } else {
        apiKeyInput.type = 'password';
        eyeIcon.innerHTML = `
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
        `;
      }
    };
    
    // Store and add the new handler
    toggleBtn._toggleHandler = toggleHandler;
    toggleBtn.addEventListener('click', toggleHandler);
  }
});

// Remove the standalone event listener
const oldToggleListener = document.getElementById('toggleApiKeyVisibility')?.addEventListener;
if (oldToggleListener) {
  document.getElementById('toggleApiKeyVisibility').removeEventListener('click', oldToggleListener);
}

// Add near the beginning of the file, where other event listeners are initialized
document.getElementById('exportDataBtn').addEventListener('click', handleExportData);
document.getElementById('importDataBtn').addEventListener('click', handleImportData);

// Add the handler functions
async function handleExportData() {
  try {
    showToast('Preparing data for export...', 'info');
    
    // Убедимся, что dataExporter доступен
    if (!window.dataExporter) {
      console.error('dataExporter is not available');
      showToast('Error: Export functionality is not available', 'error');
      return;
    }
    
    console.log('Starting export process...');
    
    // Инициализируем базы данных перед экспортом
    try {
      console.log('Initializing databases...');
      await Promise.all([
        promptDB.init(),
        favoritesDB.init(),
        notesDB.init()
      ]);
      console.log('Databases initialized successfully');
    } catch (initError) {
      console.error('Error initializing databases:', initError);
      showToast('Error initializing databases. Please try again.', 'error');
      return;
    }
    
    // Получаем данные
    showToast('Retrieving data...', 'info');
    console.log('Getting export data...');
    const data = await window.dataExporter.exportAllData();
    
    // Проверяем, что данные не пустые
    const isEmpty = 
      (!data.prompts || data.prompts.length === 0) && 
      (!data.favorites || data.favorites.length === 0) && 
      (!data.notes || data.notes.length === 0) &&
      (!data.settings || Object.keys(data.settings).length === 0);
    
    if (isEmpty) {
      console.warn('No data to export');
      showToast('No data to export. Please add some content first.', 'error');
      return;
    }
    
    // Показываем статус экспорта
    showToast('Creating export file...', 'info');
    console.log('Creating export file with data:', {
      promptsCount: data.prompts?.length || 0,
      favoritesCount: data.favorites?.length || 0,
      notesCount: data.notes?.length || 0,
      settingsCount: Object.keys(data.settings || {}).length
    });
    
    // Создаем файл
    const exportData = JSON.stringify(data, null, 2);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Создаем ссылку для скачивания
    const a = document.createElement('a');
    a.href = url;
    a.download = `deepseek_magic_backup_${new Date().toISOString().split('T')[0]}.json`;
    
    // Добавляем ссылку в документ
    document.body.appendChild(a);
    
    // Скачиваем файл
    console.log('Initiating download...');
    a.click();
    
    // Очищаем ресурсы
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Data exported successfully! 📤', 'success');
    console.log('Export completed successfully');
  } catch (error) {
    console.error('Error exporting data:', error);
    showToast(`Error exporting data: ${error.message}`, 'error');
  }
}

async function handleImportData() {
  try {
    // Убедимся, что dataExporter доступен
    if (!window.dataExporter) {
      console.error('dataExporter is not available');
      showToast('Error: Import functionality is not available', 'error');
      return;
    }
    
    // Создаем элемент для выбора файла
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) {
        console.log('No file selected');
        return;
      }
      
      console.log('Reading file:', file.name, file.size, 'bytes');
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          console.log('File read complete, parsing JSON...');
          const fileContent = event.target.result;
          
          // Проверяем, что файл не пустой
          if (!fileContent || fileContent.trim() === '') {
            throw new Error('Import file is empty');
          }
          
          // Парсим JSON
          let data;
          try {
            data = JSON.parse(fileContent);
          } catch (parseError) {
            console.error('JSON parse error:', parseError);
            throw new Error('Invalid JSON format in import file');
          }
          
          console.log('Parsed import data:', {
            hasPrompts: !!data.prompts,
            hasFavorites: !!data.favorites,
            hasNotes: !!data.notes,
            hasSettings: !!data.settings,
            promptsCount: data.prompts?.length || 0,
            favoritesCount: data.favorites?.length || 0,
            notesCount: data.notes?.length || 0
          });
          
          // Проверяем структуру данных
          if (!data || typeof data !== 'object') {
            throw new Error('Invalid data format');
          }
          
          // Проверяем, что есть хотя бы один тип данных
          const hasData = 
            (data.prompts && data.prompts.length > 0) || 
            (data.favorites && data.favorites.length > 0) || 
            (data.notes && data.notes.length > 0) ||
            (data.settings && Object.keys(data.settings).length > 0);
          
          if (!hasData) {
            throw new Error('No valid data found in import file');
          }
          
          // Импортируем данные
          await window.dataExporter.importAllData(data);
          console.log('Data imported successfully');
          
          // Обновляем все представления
          try {
            console.log('Refreshing UI...');
            await Promise.all([
              typeof loadFavorites === 'function' ? loadFavorites() : Promise.resolve(),
              typeof loadPrompts === 'function' ? loadPrompts() : Promise.resolve(),
              typeof loadNotes === 'function' ? loadNotes() : Promise.resolve()
            ]);
            console.log('UI refreshed successfully');
            
            showToast('Data imported successfully! ✨', 'success');
          } catch (refreshError) {
            console.error('Error refreshing UI:', refreshError);
            throw new Error('Failed to update display after import');
          }
        } catch (error) {
          console.error('Error during import:', error);
          showToast(`Import error: ${error.message}`, 'error');
        }
      };
      
      reader.onerror = (error) => {
        console.error('Error reading file:', error);
        showToast('Error reading import file', 'error');
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  } catch (error) {
    console.error('Error importing data:', error);
    showToast(`Error importing data: ${error.message}`, 'error');
  }
}

// Add toast notification function if it doesn't exist
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Trigger reflow
  toast.offsetHeight;
  
  // Add visible class for animation
  toast.classList.add('visible');
  
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// Add toast styles if they don't exist
const style = document.createElement('style');
style.textContent = `
  .toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    padding: 10px 20px;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    z-index: 10000;
    opacity: 0;
    transition: all 0.3s ease;
  }
  
  .toast.visible {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
  
  .toast-success {
    background-color: #4caf50;
  }
  
  .toast-error {
    background-color: #f44336;
  }
  
  .toast-info {
    background-color: #2196f3;
  }
`;
document.head.appendChild(style);

// Добавим функцию для создания тестовых данных
async function createTestData() {
  try {
    console.log('Creating test data...');
    
    // Создаем тестовый промпт
    const testPrompt = {
      id: 'test-prompt-' + Date.now(),
      title: 'Test Prompt',
      text: 'This is a test prompt created for testing export/import functionality.',
      tags: ['test', 'export', 'import'],
      date: new Date().toISOString(),
      pinned: false
    };
    
    // Создаем тестовый избранный чат
    const testFavorite = {
      id: 'test-favorite-' + Date.now(),
      title: 'Test Favorite Chat',
      url: 'https://example.com/chat',
      description: 'This is a test favorite created for testing export/import functionality.',
      tags: ['test', 'export', 'import'],
      date: new Date().toISOString(),
      pinned: false
    };
    
    // Создаем тестовую заметку
    const testNote = {
      content: 'This is a test note created for testing export/import functionality.',
      date: new Date().toISOString(),
      pinned: false
    };
    
    // Сохраняем тестовые данные
    console.log('Saving test prompt...');
    await promptDB.addPrompt(testPrompt);
    
    console.log('Saving test favorite...');
    await favoritesDB.addFavorite(testFavorite);
    
    console.log('Saving test note...');
    await notesDB.addNote(testNote);
    
    console.log('Test data created successfully');
    
    // Обновляем интерфейс
    await Promise.all([
      loadFavorites(),
      loadPrompts(),
      loadNotes()
    ]);
    
    showToast('Test data created successfully! 🧪', 'success');
  } catch (error) {
    console.error('Error creating test data:', error);
    showToast(`Error creating test data: ${error.message}`, 'error');
  }
}

// Добавим кнопку для создания тестовых данных (только для отладки)
document.addEventListener('DOMContentLoaded', () => {
  // Добавляем скрытую кнопку, которую можно активировать через консоль
  const createTestDataBtn = document.createElement('button');
  createTestDataBtn.id = 'createTestDataBtn';
  createTestDataBtn.style.display = 'none';
  createTestDataBtn.textContent = 'Create Test Data';
  createTestDataBtn.addEventListener('click', createTestData);
  document.body.appendChild(createTestDataBtn);
  
  // Добавляем кнопку для проверки содержимого баз данных
  const checkDbBtn = document.createElement('button');
  checkDbBtn.id = 'checkDbBtn';
  checkDbBtn.style.display = 'none';
  checkDbBtn.textContent = 'Check Database Contents';
  checkDbBtn.addEventListener('click', checkDatabaseContents);
  document.body.appendChild(checkDbBtn);
});

// Функция для проверки содержимого баз данных
async function checkDatabaseContents() {
  try {
    console.log('Checking database contents...');
    
    // Проверяем промпты
    console.log('Checking prompts...');
    await promptDB.init();
    const prompts = await promptDB.getAllPrompts();
    console.log('Prompts in database:', prompts);
    
    // Проверяем избранное
    console.log('Checking favorites...');
    await favoritesDB.init();
    const favorites = await favoritesDB.getFavorites();
    console.log('Favorites in database:', favorites);
    
    // Проверяем заметки
    console.log('Checking notes...');
    await notesDB.init();
    const notes = await notesDB.getAllNotes();
    console.log('Notes in database:', notes);
    
    // Выводим сводку
    console.log('Database contents summary:', {
      promptsCount: prompts.length,
      favoritesCount: favorites.length,
      notesCount: notes.length
    });
    
    // Проверяем экспорт
    console.log('Testing export...');
    const exportData = await dataExporter.exportAllData();
    console.log('Export data:', exportData);
    
    showToast('Database check completed. See console for details.', 'info');
  } catch (error) {
    console.error('Error checking database contents:', error);
    showToast(`Error checking database: ${error.message}`, 'error');
  }
}

// Initialize databases when needed
async function initDatabases() {
  try {
    await Promise.all([
      promptDB.init(),
      favoritesDB.init(),
      notesDB.init()
    ]);
    console.log('All databases initialized successfully');
  } catch (error) {
    console.error('Error initializing databases:', error);
    throw error;
  }
}

// Add updateNotesOrder function to notesDB
notesDB.updateNotesOrder = async function(orderedIds) {
  try {
    const notes = await this.getAllNotes();
    const pinnedNotes = notes.filter(note => note.pinned);
    
    // Update order for each pinned note
    for (let i = 0; i < orderedIds.length; i++) {
      const noteId = orderedIds[i];
      const note = pinnedNotes.find(n => n.id === noteId);
      if (note) {
        note.order = i;
        await this.updateNote(note);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error updating notes order:', error);
    throw error;
  }
};

// Add getNote method to notesDB
notesDB.getNote = async function(id) {
  try {
    const notes = await this.getAllNotes();
    return notes.find(note => note.id === id) || null;
  } catch (error) {
    console.error('Error getting note:', error);
    throw error;
  }
};

// Add this function after the existing functions
async function generateTagsWithAI(favorite) {
  const generateBtn = document.getElementById('generateTagsBtn');
  try {
    // Get current settings
    const settings = await loadSettings();
    if (!settings || !settings.apiKeys[settings.provider] || !settings.model) {
      showNotification('Please configure API settings first! ⚙️', true);
      return;
    }

    // Disable button and show loading state
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<svg class="ai-icon spinning" viewBox="0 0 24 24" width="16" height="16"><path d="M12 4V2C6.48 2 2 6.48 2 12h2c0-4.41 3.59-8 8-8zm6 2h-2c0 3.31-2.69 6-6 6s-6-2.69-6-6H4c0 4.41 3.59 8 8 8s8-3.59 8-8zm-6 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>';

    // Get chat history text
    const chatHistory = favorite.messages
      ?.map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n') || '';

    if (!chatHistory) {
      throw new Error('No chat history available');
    }

    // Use the tags prompt template from settings
    const prompt = `${settings.tagsPrompt || 'Generate 3-5 relevant tags for this content, separated by commas.'}\n\nChat History:\n${chatHistory}`;

    // Call the AI API
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_TAGS',
      prompt: prompt,
      settings: {
        provider: settings.provider,
        apiKey: settings.apiKeys[settings.provider],
        model: settings.model
      }
    });

    if (response.status === 'error') {
      throw new Error(response.error);
    }

    // Clear existing tags
    const tagsContainer = document.getElementById('editFavoriteTags');
    const existingTags = tagsContainer.querySelectorAll('.tag');
    
    // Get special tags that we want to preserve
    const specialTags = ['deepseek', 'gemini', 'chatgpt'];
    const preservedTags = Array.from(existingTags)
      .map(tag => tag.textContent.replace(/[×✕✖✗✘]/g, '').trim().toLowerCase())
      .filter(tag => specialTags.includes(tag));

    // Clear existing tags
    existingTags.forEach(tag => tag.remove());

    // Split tags by commas and spaces and clean them
    const tagsList = response.tags
      .split(/[,\s]+/) // Split by commas and/or spaces
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag && tag.length > 0); // Remove empty tags

    // Combine preserved tags with new tags, removing duplicates
    const allTags = [...new Set([...preservedTags, ...tagsList])];

    // Add each tag as a separate element
    allTags.forEach(tag => {
      if (tag) {
        const tagElement = document.createElement('span');
        tagElement.className = 'tag';
        tagElement.textContent = tag;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'tag-remove';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => tagElement.remove();
        
        tagElement.appendChild(removeBtn);
        tagsContainer.insertBefore(tagElement, tagsContainer.querySelector('input'));
      }
    });

    // Update the tags manager with new tags
    if (currentEditFavoriteTagsManager) {
      currentEditFavoriteTagsManager.setTags(allTags);
    } else {
      currentEditFavoriteTagsManager = setupTagsInput(tagsContainer);
      if (currentEditFavoriteTagsManager) {
        currentEditFavoriteTagsManager.setTags(allTags);
      }
    }

    // Update the favorite object with new tags
    if (currentEditingFavorite) {
      currentEditingFavorite.tags = allTags;
      currentEditingFavorite.edited = new Date();
    }

    showNotification('Tags generated successfully! 🏷️');
  } catch (error) {
    console.error('Error generating tags:', error);
    showNotification(`Error generating tags: ${error.message} ❌`, true);
  } finally {
    // Restore button state
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<svg class="ai-icon" viewBox="0 0 24 24" width="16" height="16"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
  }
}

// Add event listener for the generate tags button
document.addEventListener('DOMContentLoaded', () => {
  const generateTagsBtn = document.getElementById('generateTagsBtn');
  if (generateTagsBtn) {
    generateTagsBtn.addEventListener('click', async () => {
      const favoriteId = document.getElementById('editFavoriteModal').dataset.favoriteId;
      if (!favoriteId) {
        showNotification('No favorite selected! ❌', true);
        return;
      }

      const favorites = await chrome.runtime.sendMessage({ type: 'GET_FAVORITES' });
      if (favorites.status === 'ok') {
        const favorite = favorites.favorites.find(f => f.id === favoriteId);
        if (favorite) {
          await generateTagsWithAI(favorite);
        } else {
          showNotification('Favorite not found! ❌', true);
        }
      }
    });
  }
});

