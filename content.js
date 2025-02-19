// Register content script
console.log('Content script loaded');

// Function to load external CSS file
function loadCSS(file) {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = chrome.runtime.getURL(file);
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load ${file}`));
    document.head.appendChild(link);
  });
}

// Initialize content script
async function initializeContentScript() {
  // Add initialization message to verify content script is running
  console.log('Initializing content script...');
  
  try {
    // Load main.css before initializing notifications
    await loadCSS('main.css');
    console.log('Successfully loaded main.css');
  } catch (error) {
    console.warn('Failed to load main.css:', error);
  }

  // Notify background script that content script is ready
  chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' })
    .then(response => {
      if (response?.status === 'ok') {
        console.log('Successfully connected to background script');
      }
    })
    .catch(error => {
      console.warn('Initial connection to background script failed:', error);
    });
}

// Call initialization
initializeContentScript();

// Function to get message content with proper HTML and text
function getMessageContent(element) {
  return {
    text: element.textContent.trim(),
    html: element.innerHTML
  };
}

// Function to notify background script with retry
async function notifyBackgroundScript(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' });
      if (response && response.status === 'ok') {
        console.log('Successfully connected to background script');
        return;
      }
    } catch (error) {
      console.log(`Attempt ${i + 1} failed, retrying in 1 second...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  console.log('Failed to connect to background script after retries');
}

// Initialize connection
notifyBackgroundScript();

function extractMessageContent(messageElement) {
  // Get the message content element
  const contentElement = messageElement.querySelector('.message-content');
  if (!contentElement) return '';
  
  // Clone the content to avoid modifying the original
  const clonedContent = contentElement.cloneNode(true);
  
  // Process code blocks to preserve formatting
  const codeBlocks = clonedContent.querySelectorAll('pre code');
  codeBlocks.forEach(codeBlock => {
    const pre = codeBlock.closest('pre');
    if (pre) {
      pre.innerHTML = codeBlock.outerHTML;
    }
  });

  // Process inline code elements
  const inlineCodes = clonedContent.querySelectorAll('code:not(pre code)');
  inlineCodes.forEach(code => {
    code.classList.add('inline-code');
  });

  return clonedContent.innerHTML;
}

function processMessages() {
  const messages = document.querySelectorAll('.chat-message');
  const chatContent = [];

  messages.forEach((message) => {
    const isUser = message.classList.contains('user');
    const content = extractMessageContent(message);
    
    if (content) {
      chatContent.push({
        type: isUser ? 'user' : 'assistant',
        content: content
      });
    }
  });

  return chatContent;
}

// Function to get chat content
async function getChatContent() {
  try {
    const chatContent = [];
    
    // Get chat title and metadata
    const titleElement = document.querySelector('.d8ed659a');
    const title = titleElement ? titleElement.textContent.trim() : document.title;
    
    // Get all messages in the chat
    const messages = document.querySelectorAll('[class*="chat-message"]');
    const messageElements = Array.from(messages);
    
    // Sort messages based on their position in the DOM
    messageElements.sort((a, b) => {
      const position = a.compareDocumentPosition(b);
      return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    
    messageElements.forEach(message => {
      // Determine message type (user or assistant)
      const isUser = message.classList.contains('user') || 
                    message.querySelector('[class*="user"]') !== null;
      
      // Find the content container
      const contentContainer = message.querySelector('[class*="markdown"]') || 
                             message.querySelector('[class*="content"]');
      
      if (contentContainer) {
        const content = getMessageContent(contentContainer);
        
        chatContent.push({
          type: isUser ? 'user' : 'assistant',
          content: content.text,
          html: content.html
        });
      }
    });

    // If no messages found through main selector, try alternative selectors
    if (chatContent.length === 0) {
      const alternativeMessages = document.querySelectorAll('.fbb737a4, .ds-markdown.ds-markdown--block');
      const alternativeElements = Array.from(alternativeMessages);
      
      // Sort alternative messages based on DOM position
      alternativeElements.sort((a, b) => {
        const position = a.compareDocumentPosition(b);
        return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
      
      alternativeElements.forEach(message => {
        const isUser = message.classList.contains('fbb737a4');
        const content = getMessageContent(message);
        
        chatContent.push({
          type: isUser ? 'user' : 'assistant',
          content: content.text,
          html: content.html
        });
      });
    }

    return {
      title,
      messages: chatContent,
      metadata: {
        url: window.location.href,
        timestamp: Date.now(),
        messageCount: chatContent.length,
        hasContent: chatContent.length > 0
      }
    };
  } catch (error) {
    console.error('Error getting chat content:', error);
    throw error;
  }
}

// Function to show notifications
function showNotification(message, isError = false) {
  // Remove any existing notifications
  const existingNotifications = document.querySelectorAll('.deepseek-notification');
  existingNotifications.forEach(notification => notification.remove());

  // Create new notification
  const notification = document.createElement('div');
  notification.className = `deepseek-notification ${isError ? 'error' : 'success'}`;
  
  // Split message into title and description if it contains a newline
  const [title, ...descriptionParts] = message.split('\n');
  const description = descriptionParts.join('\n');
  
  // Create notification content
  notification.innerHTML = `
    <div class="title">${title}</div>
    ${description ? `<div class="description">${description}</div>` : ''}
  `;
  
  // Add to page
  document.documentElement.appendChild(notification);
  
  // Trigger animation
  requestAnimationFrame(() => {
    notification.classList.add('show');
  });
  
  // Auto-remove after delay
  const duration = isError ? 5000 : 3000;
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

// Update the message listener to be more robust
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (message.type === 'GET_CHAT_INFO') {
    // Handle async response
    (async () => {
      try {
        console.log('Getting chat content...');
        const chatContent = await getChatContent();
        console.log('Got chat content:', chatContent);
        
        if (!chatContent || !chatContent.title) {
          console.error('No chat content or title found');
          sendResponse({ 
            status: 'error', 
            error: 'Could not find chat title. Please make sure you are on a chat page.' 
          });
          return;
        }
        
        if (!chatContent.messages || chatContent.messages.length === 0) {
          console.error('No chat messages found');
          sendResponse({ 
            status: 'error', 
            error: 'No chat messages found. Please make sure you are on a chat page with messages.' 
          });
          return;
        }
        
        console.log('Sending successful response with chat content');
        sendResponse({ 
          status: 'ok', 
          title: chatContent.title,
          messages: chatContent.messages,
          metadata: chatContent.metadata
        });
      } catch (error) {
        console.error('Error getting chat info:', error);
        sendResponse({ 
          status: 'error', 
          error: error.message || 'Failed to get chat information' 
        });
      }
    })();
    return true; // Keep the message channel open for async response
  }
  
  if (message.type === 'SHOW_NOTIFICATION') {
    try {
      console.log('Showing notification:', message.message, 'isError:', message.isError);
      showNotification(message.message, message.isError);
      sendResponse({ status: 'ok' });
    } catch (error) {
      console.error('Error showing notification:', error);
      sendResponse({ status: 'error', error: error.message });
    }
    return true;
  }
  
  // Unknown message type
  console.warn('Unknown message type:', message.type);
  sendResponse({ status: 'error', error: 'Unknown message type' });
  return true;
});

// Handle right clicks with error handling
document.addEventListener('contextmenu', async (e) => {
  try {
    const chatTitle = document.querySelector('.d8ed659a')?.textContent?.trim() || document.title;
    const chatUrl = window.location.href;

    // Send message to extension with retry
    for (let i = 0; i < 3; i++) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'SHOW_CONTEXT_MENU',
          data: {
            x: e.clientX,
            y: e.clientY,
            url: chatUrl,
            title: chatTitle
          }
        });
        if (response && response.status === 'ok') {
          break;
        }
      } catch (error) {
        if (i === 2) {
          console.log('Failed to send context menu message after retries');
        } else {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
  } catch (error) {
    console.log('Error handling context menu:', error);
  }
}); 