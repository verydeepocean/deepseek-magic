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
    description.textContent = favorite.description.length > 200 
      ? favorite.description.substring(0, 200) + '...' 
      : favorite.description;
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
          
          // If the tag is already in the search query, don't add it again
          if (!currentQuery.includes(cleanTag)) {
            // Add the tag to the existing search query
            const newQuery = currentQuery ? `${currentQuery} ${cleanTag}` : cleanTag;
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
    .slice(0, 8); // Take top 8
  
  if (sortedTags.length === 0) return;
  
  // Create and append tag elements
  sortedTags.forEach(([tag, frequency]) => {
    const tagElement = document.createElement('span');
    tagElement.className = 'tag';
    tagElement.textContent = tag;
    
    // Add click handler to filter by this tag
    tagElement.addEventListener('click', () => {
      const searchInput = document.getElementById(searchInputId);
      if (searchInput) {
        // Get current search query
        let currentQuery = searchInput.value.trim();
        
        // If the tag is already in the search query, remove it (toggle behavior)
        if (currentQuery.includes(tag)) {
          // Remove the tag from the query
          const words = currentQuery.split(/\s+/);
          const filteredWords = words.filter(word => word.toLowerCase() !== tag.toLowerCase());
          currentQuery = filteredWords.join(' ');
          searchInput.value = currentQuery;
          tagElement.classList.remove('active');
        } else {
          // Add the tag to the existing search query
          const newQuery = currentQuery ? `${currentQuery} ${tag}` : tag;
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
async function loadFavorites(searchQuery = '', retryCount = 3) {
  try {
    let favoritesResponse = null;
    let attempts = retryCount;
    
    while (attempts > 0) {
      try {
        favoritesResponse = await chrome.runtime.sendMessage({ type: 'GET_FAVORITES' });
        
        if (favoritesResponse && favoritesResponse.status === 'ok') {
          break;
        }
        
        console.log(`Attempt ${retryCount - attempts + 1} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.log(`Attempt ${retryCount - attempts + 1} failed:`, error);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      attempts--;
    }
    
    if (!favoritesResponse || favoritesResponse.status !== 'ok') {
      throw new Error('Failed to load favorites after multiple attempts');
    }
    
    const favorites = favoritesResponse.favorites || [];
    const favoritesList = document.getElementById('favoritesList');
    favoritesList.innerHTML = '';

    // Display frequent tags
    const tagFrequencies = countTagFrequencies(favorites);
    displayFrequentTags('favoriteFrequentTags', tagFrequencies, 'favoritesSearchInput', loadFavorites);

    if (favorites.length === 0) {
      favoritesList.innerHTML = '<div class="no-items">No favorite chats yet</div>';
      return;
    }
    
    // Enhanced filtering with individual words search
    const searchWords = searchQuery.toLowerCase().split(/\s+/).filter(word => word);
    const filteredFavorites = searchQuery
      ? favorites.filter(f => {
          // Check if all search words are found in any of the fields
          return searchWords.every(word => {
            return f.title?.toLowerCase().includes(word) ||
                   f.url?.toLowerCase().includes(word) ||
                   f.description?.toLowerCase().includes(word) ||
                   (f.tags && f.tags.some(tag => tag.toLowerCase().includes(word))) ||
                   // Search in chat history messages
                   (f.messages && f.messages.some(message => 
                     message.content?.toLowerCase().includes(word) || 
                     message.html?.toLowerCase().includes(word)
                   ));
          });
        })
      : favorites;

    if (filteredFavorites.length === 0) {
      favoritesList.innerHTML = '<div class="no-items">No matches found</div>';
      return;
    }

    // Create containers for pinned and unpinned favorites
    const pinnedContainer = document.createElement('div');
    pinnedContainer.className = 'pinned-favorites-container';
    
    const unpinnedContainer = document.createElement('div');
    unpinnedContainer.className = 'unpinned-favorites-container';
    
    // Sort favorites: pinned first, then by date
    filteredFavorites
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
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
      favoritesList.appendChild(pinnedContainer);
    }
    
    if (unpinnedContainer.children.length > 0) {
      favoritesList.appendChild(unpinnedContainer);
    }

  } catch (error) {
    console.error('Error loading favorites:', error);
    showNotification('Error loading favorites! ❌', true);
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

// Setup tabs
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');
  const addPromptButton = document.getElementById('addPromptButton');
  const addNoteButton = document.getElementById('addNoteButton');

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
    });
  });
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message in popup:', message.type);
  
  if (message.type === 'REFRESH_FAVORITES' || message.type === 'ADD_FAVORITE') {
    loadFavorites();
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
          const cleanTag = tag.replace(/[×✕✖✗✘]/g, '').trim();
          
          // Get current search query
          let currentQuery = searchInput.value.trim();
          
          // If the tag is already in the search query, don't add it again
          if (!currentQuery.includes(cleanTag)) {
            // Add the tag to the existing search query
            const newQuery = currentQuery ? `${currentQuery} ${cleanTag}` : cleanTag;
            searchInput.value = newQuery;
            // Trigger the search with the combined query
            loadPrompts(newQuery);
          }
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

    // Display frequent tags
    const tagFrequencies = countTagFrequencies(prompts);
    displayFrequentTags('promptFrequentTags', tagFrequencies, 'promptSearchInput', loadPrompts);

    if (prompts.length === 0) {
      promptsList.innerHTML = '<div class="no-items">No prompts yet</div>';
      return;
    }
    
    // Enhanced filtering with individual words search
    const searchWords = searchQuery.toLowerCase().split(/\s+/).filter(word => word);
    const filteredPrompts = searchQuery 
      ? prompts.filter(p => {
          // Check if all search words are found in any of the fields
          return searchWords.every(word => {
            return p.title?.toLowerCase().includes(word) ||
                   p.text.toLowerCase().includes(word) ||
                   (p.tags && p.tags.some(tag => tag.toLowerCase().includes(word)));
          });
        })
      : prompts;

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
        // Send message to background script to clear all data
        const response = await chrome.runtime.sendMessage({ type: 'CLEAR_ALL_DATA' });
        
        if (response.status === 'error') {
          throw new Error(response.error || 'Failed to clear data');
        }

        // Clear notes database separately since it's handled in popup
        await notesDB.clearAll();
        
        // Refresh all views
        await Promise.all([
          loadFavorites(),
          loadPrompts(),
          loadNotes()
        ]);

        showNotification('All data has been cleared successfully! 🗑️');
      } catch (error) {
        console.error('Error clearing data:', error);
        showNotification('Error clearing data! ❌', true);
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
    const notes = await notesDB.getAllNotes();
    const notesList = document.getElementById('notesList');
    notesList.innerHTML = '';

    // Create containers for pinned and unpinned notes
    const pinnedContainer = document.createElement('div');
    pinnedContainer.className = 'pinned-notes-container';
    
    const unpinnedContainer = document.createElement('div');
    unpinnedContainer.className = 'unpinned-notes-container';

    // Sort notes: pinned first (by order), then by date
    notes.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (a.pinned && b.pinned) {
        // Если есть order, сортируем по нему
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
      }
      return new Date(b.date) - new Date(a.date);
    });

    // Distribute notes to their respective containers
    notes.forEach(note => {
      const noteCard = createNoteCard(note);
      if (note.pinned) {
        pinnedContainer.appendChild(noteCard);
      } else {
        unpinnedContainer.appendChild(noteCard);
      }
    });

    // Only append containers if they have notes
    if (pinnedContainer.children.length > 0) {
      notesList.appendChild(pinnedContainer);
    }
    if (unpinnedContainer.children.length > 0) {
      notesList.appendChild(unpinnedContainer);
    }
  } catch (error) {
    console.error('Error loading notes:', error);
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
      // Only allow dragging from the drag handle (the left edge)
      const rect = card.getBoundingClientRect();
      const dragHandleWidth = 15; // Width of the drag handle
      if (e.clientX - rect.left > dragHandleWidth) {
        e.preventDefault();
        return false;
      }
      
      e.stopPropagation();
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', note.id.toString());
      e.dataTransfer.effectAllowed = 'move';
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
        const cardRect = card.getBoundingClientRect();
        const dragY = e.clientY;
        const threshold = cardRect.top + cardRect.height / 2;
        
        document.querySelectorAll('.note-card.pinned').forEach(note => {
          note.classList.remove('drag-over');
        });
        
        if (dragY < threshold) {
          card.classList.add('drag-over');
        }
      }
    });

    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const draggedNoteId = Number(e.dataTransfer.getData('text/plain'));
      const targetNoteId = Number(note.id);
      
      if (draggedNoteId !== targetNoteId) {
        const pinnedContainer = document.querySelector('.pinned-notes-container');
        const cards = [...pinnedContainer.querySelectorAll('.note-card.pinned')];
        
        const currentOrder = cards.map(card => Number(card.dataset.noteId));
        const draggedIndex = currentOrder.indexOf(draggedNoteId);
        const targetIndex = currentOrder.indexOf(targetNoteId);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
          const cardRect = card.getBoundingClientRect();
          const dropY = e.clientY;
          const threshold = cardRect.top + cardRect.height / 2;
          
          let newIndex = targetIndex;
          if (dropY > threshold) {
            newIndex++;
          }
          
          currentOrder.splice(draggedIndex, 1);
          currentOrder.splice(newIndex, 0, draggedNoteId);
          
          try {
            await notesDB.updateNotesOrder(currentOrder);
            await loadNotes();
          } catch (error) {
            console.error('Error updating notes order:', error);
            showNotification('Error updating notes order', true);
          }
        }
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
    const note = {
      content: content,
      date: new Date().toISOString()
    };
    
    if (currentNoteId) {
      note.id = currentNoteId;
      await notesDB.updateNote(note);
    } else {
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
