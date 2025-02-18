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
  document.querySelector(`.theme-btn[data-theme="${savedTheme}"]`)?.classList.add('active');
}

function setupThemeButtons() {
  const themeButtons = document.querySelectorAll('.theme-btn');
  themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      
      // Update active state
      themeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
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
  }
  
  const title = document.createElement('a');
  title.className = 'prompt-title favorite-title';
  title.href = favorite.url;
  title.target = '_blank';
  title.textContent = favorite.title || 'Untitled Chat';
  
  const description = document.createElement('p');
  description.className = 'favorite-description';
  description.textContent = favorite.description || '';
  
  const tags = document.createElement('div');
  tags.className = 'prompt-tags';
  if (favorite.tags && favorite.tags.length > 0) {
    favorite.tags.forEach(tag => {
      const tagSpan = document.createElement('span');
      tagSpan.className = 'tag';
      tagSpan.textContent = tag;
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
      let tempTab = null;
      try {
        updateButton.disabled = true;
        updateButton.textContent = 'Updating...';
        
        // Create a temporary tab with the favorite URL
        tempTab = await chrome.tabs.create({ 
          url: favorite.url,
          active: false // Open in background
        });
        
        // Wait for the page to load completely
        await new Promise(resolve => {
          chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tempTab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          });
        });
        
        // Add small delay to ensure page is fully initialized
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Inject content script
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tempTab.id },
            files: ['content.js']
          });
          console.log('Content script injected');
        } catch (err) {
          console.log('Content script already loaded or injection failed:', err);
        }
        
        // Add delay to ensure content script is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Request chat content from content script with retries
        let response = null;
        let retryCount = 3;
        
        while (retryCount > 0) {
          try {
            response = await chrome.tabs.sendMessage(tempTab.id, { type: 'GET_CHAT_INFO' });
            if (response && response.status === 'ok' && response.messages) {
              break;
            }
          } catch (error) {
            console.log(`Attempt ${4 - retryCount} failed:`, error);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          retryCount--;
        }
        
        if (!response || response.status !== 'ok' || !response.messages) {
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
        if (tempTab) {
          try {
            await chrome.tabs.remove(tempTab.id);
          } catch (err) {
            console.error('Error closing temporary tab:', err);
          }
        }
        updateButton.disabled = false;
        updateButton.textContent = 'Update Chat';
      }
    };
    
    // Store handler reference for future cleanup
    updateButton._updateHandler = updateHandler;
    updateButton.addEventListener('click', updateHandler);
  });
  
  const openBtn = document.createElement('button');
  openBtn.className = 'btn';
  openBtn.textContent = '🔗';
  openBtn.title = 'Open chat';
  openBtn.onclick = (e) => {
    e.stopPropagation();
    window.open(favorite.url, '_blank');
  };

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
        deleteBtn.disabled = true;
        deleteBtn.textContent = '⌛';
        
        await chrome.runtime.sendMessage({ 
          type: 'DELETE_FAVORITE',
          id: favorite.id
        });
        
        div.classList.add('removing');
        setTimeout(() => {
          loadFavorites();
          showNotification('Favorite removed successfully! 🗑️');
        }, 300);
      } catch (error) {
        console.error('Error removing favorite:', error);
        showNotification('Error removing favorite! ❌', true);
        deleteBtn.disabled = false;
        deleteBtn.textContent = '🗑️';
        div.classList.remove('removing');
      }
    }
  };
  
  buttonsDiv.appendChild(pinBtn);
  buttonsDiv.appendChild(historyBtn);
  buttonsDiv.appendChild(openBtn);
  buttonsDiv.appendChild(editBtn);
  buttonsDiv.appendChild(deleteBtn);
  
  div.appendChild(title);
  if (favorite.description) div.appendChild(description);
  if (favorite.tags && favorite.tags.length > 0) div.appendChild(tags);
  div.appendChild(date);
  div.appendChild(buttonsDiv);
  
  return div;
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
  
  // Process links to open in new tab
  temp.querySelectorAll('a').forEach(link => {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
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
  messageDiv.className = `chat-message ${message.type}`;

  const header = document.createElement('div');
  header.className = 'message-header';
  header.textContent = message.type === 'user' ? 'You' : 'Assistant';
  messageDiv.appendChild(header);

  const content = document.createElement('div');
  content.className = 'message-content';
  
  // Use the html content if available, otherwise fallback to text content
  if (message.html) {
    // Sanitize and render HTML content
    content.innerHTML = sanitizeAndRenderHTML(message.html);
  } else if (message.content) {
    // If html is not available, try to parse content as HTML
    content.innerHTML = sanitizeAndRenderHTML(message.content);
  } else {
    content.textContent = 'No content available';
  }
  
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

// Load favorites
async function loadFavorites(searchQuery = '', retryCount = 3) {
  try {
    // Try to get favorites with retries
    let response = null;
    let attempts = retryCount;
    
    while (attempts > 0) {
      try {
        response = await chrome.runtime.sendMessage({ type: 'GET_FAVORITES' });
        
        if (response && response.status === 'ok') {
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
    
    if (!response || response.status !== 'ok') {
      throw new Error('Failed to load favorites after multiple attempts');
    }
    
    const favorites = response.favorites || [];
    const favoritesList = document.getElementById('favoritesList');
    favoritesList.innerHTML = '';
    
    if (favorites.length === 0) {
      favoritesList.innerHTML = '<div class="no-items">No favorite chats yet</div>';
      return;
    }
    
    // Filter favorites if search query exists
    const filteredFavorites = searchQuery
      ? favorites.filter(f => 
          f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.url.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : favorites;
    
    if (filteredFavorites.length === 0) {
      favoritesList.innerHTML = '<div class="no-items">No matches found</div>';
      return;
    }
    
    // Sort favorites: pinned first, then by date
    filteredFavorites
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.date) - new Date(a.date);
      })
      .forEach(favorite => {
        const element = createFavoriteElement(favorite);
        favoritesList.appendChild(element);
      });
    
  } catch (error) {
    console.error('Error loading favorites:', error);
    showNotification('Error loading favorites! ❌', true);
    
    // Show error state in the list
    const favoritesList = document.getElementById('favoritesList');
    favoritesList.innerHTML = '<div class="no-items error">Failed to load favorites. Please try again.</div>';
  }
}

// Setup favorites search
const favoritesSearchInput = document.getElementById('favoritesSearchInput');
if (favoritesSearchInput) {
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

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      
      // Update active states
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(`${target}-tab`).classList.add('active');
      
      // Show/hide Add Prompt button based on active tab
      if (target === 'favorites') {
        addPromptButton.style.display = 'none';
        loadFavorites();
      } else {
        addPromptButton.style.display = 'flex';
        loadPrompts(); // Load prompts when switching to prompts tab
      }
    });
  });
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message in popup:', message.type);
  
  if (message.type === 'REFRESH_FAVORITES') {
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
  const input = container.querySelector('input');
  let tags = new Set();

  function addTag(tag) {
    tag = tag.trim().toLowerCase();
    if (tag && !tags.has(tag)) {
      tags.add(tag);
      const tagElement = document.createElement('span');
      tagElement.className = 'tag';
      tagElement.innerHTML = `
        ${tag}
        <button class="tag-remove" data-tag="${tag}">×</button>
      `;
      container.insertBefore(tagElement, input);
    }
    input.value = '';
  }

  function removeTag(tag) {
    tags.delete(tag);
    const tagElement = container.querySelector(`[data-tag="${tag}"]`)?.parentElement;
    if (tagElement) tagElement.remove();
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input.value);
    } else if (e.key === 'Backspace' && input.value === '') {
      const tagElements = container.querySelectorAll('.tag');
      if (tagElements.length > 0) {
        const lastTag = tagElements[tagElements.length - 1];
        const tag = lastTag.textContent.trim().slice(0, -1); // Remove × button
        removeTag(tag);
      }
    }
  });

  container.addEventListener('click', (e) => {
    if (e.target.classList.contains('tag-remove')) {
      const tag = e.target.dataset.tag;
      removeTag(tag);
    }
  });

  return {
    setTags: (newTags = []) => {
      tags = new Set();
      container.querySelectorAll('.tag').forEach(tag => tag.remove());
      newTags.forEach(tag => addTag(tag));
    },
    getTags: () => Array.from(tags)
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

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.style.display = 'block';
  
  // Set values when opening edit modal
  if (modalId === 'editModal' && currentEditingPrompt) {
  const titleInput = document.getElementById('editPromptTitle');
  const editInput = document.getElementById('editPromptInput');
    const editTagsManager = setupTagsInput(document.getElementById('editPromptTags'));

  titleInput.value = currentEditingPrompt.title || '';
  editInput.value = currentEditingPrompt.text || '';
    editTagsManager.setTags(currentEditingPrompt.tags || []);
  updateCharCounter(editInput, 5000);
  } else if (modalId === 'editFavoriteModal' && currentEditingFavorite) {
    const titleInput = document.getElementById('editFavoriteTitle');
    const editInput = document.getElementById('editFavoriteDescription');
    const editTagsManager = setupTagsInput(document.getElementById('editFavoriteTags'));

    titleInput.value = currentEditingFavorite.title || '';
    editInput.value = currentEditingFavorite.description || '';
    editTagsManager.setTags(currentEditingFavorite.tags || []);
    updateCharCounter(editInput, 5000);
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
    } else if (modalId === 'editFavoriteModal') {
      currentEditingFavorite = null;
    }
  }, 300);
}

// Create prompt element
function createPromptElement(prompt) {
  const div = document.createElement('div');
  div.className = 'prompt-item';
  if (prompt.pinned) {
    div.classList.add('pinned');
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
      tagSpan.className = 'tag';
      tagSpan.textContent = tag;
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
    const response = await chrome.runtime.sendMessage({ type: 'GET_PROMPTS' });
    
    if (response.status === 'error') {
      if (retryCount > 0 && response.error.includes('not initialized')) {
        console.log(`Retrying to load prompts... (${retryCount} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 500));
        return loadPrompts(searchQuery, retryCount - 1);
      }
      throw new Error(response.error);
    }
    
    const prompts = response.prompts || [];
  const promptsList = document.getElementById('promptsList');
    promptsList.innerHTML = '';

    if (prompts.length === 0) {
      promptsList.innerHTML = '<div class="no-items">No prompts yet</div>';
      return;
    }
    
    // Filter prompts if search query exists
    const filteredPrompts = searchQuery 
      ? prompts.filter(p => 
          p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : prompts;

    if (filteredPrompts.length === 0) {
      promptsList.innerHTML = '<div class="no-items">No matches found</div>';
      return;
    }
    
    // Sort prompts: pinned first, then by date
    filteredPrompts
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.date) - new Date(a.date);
      })
      .forEach(prompt => {
        const element = createPromptElement(prompt);
          promptsList.appendChild(element);
        });

  } catch (error) {
    console.error('Error loading prompts:', error);
    showNotification('Error loading prompts! ❌', true);
  }
}

// Setup search
const promptSearchInput = document.getElementById('promptSearchInput');
if (promptSearchInput) {
  const debouncedPromptSearch = debounce((query) => {
    loadPrompts(query);
  }, 300);

  promptSearchInput.addEventListener('input', (e) => {
    debouncedPromptSearch(e.target.value.trim());
  });
}

// Initialize
async function initialize() {
  console.log('Initializing popup...');
  
  // Initialize theme
  initTheme();
  setupThemeButtons();
  setupTabs();
  
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

  // Setup initial Add Prompt button visibility and load initial data
  const initialActiveTab = document.querySelector('.tab-btn.active');
  const addPromptButton = document.getElementById('addPromptButton');
  
  if (initialActiveTab) {
    const target = initialActiveTab.dataset.tab;
    if (target === 'favorites') {
      addPromptButton.style.display = 'none';
      loadFavorites();
    } else {
      addPromptButton.style.display = 'flex';
      loadPrompts();
    }
  }
  
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
      const title = titleInput.value.trim();
      const text = textInput.value.trim();
      
      if (!text) {
        showNotification('Please enter prompt text! ❌', true);
        return;
      }
      
      const prompt = {
      id: Date.now().toString(),
        title: title || 'Untitled Prompt',
        text: text,
        tags: promptTagsManager.getTags(),
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
      promptTagsManager.setTags([]);
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
      const title = titleInput.value.trim();
      const text = textInput.value.trim();
      
      if (!text) {
        showNotification('Please enter prompt text! ❌', true);
        return;
      }
      
      const updatedPrompt = {
        ...currentEditingPrompt,
        title: title || 'Untitled Prompt',
        text: text,
        tags: editTagsManager.getTags(),
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
      const editTagsManager = setupTagsInput(document.getElementById('editFavoriteTags'));
      
      const updatedFavorite = {
        ...currentEditingFavorite,
        title: title || 'Untitled Chat',
        description: description,
        tags: editTagsManager.getTags(),
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