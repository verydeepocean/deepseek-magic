// Register content script
console.log('Content script loaded');

// Function to check if current site is Google AI Studio
function isGoogleAIStudio() {
  return window.location.href.includes('aistudio.google.com');
}

// Function to create isolated container for Google AI Studio
function createIsolatedContainer() {
  // Check if container already exists
  if (document.getElementById('deepseek-isolated-container')) {
    return document.getElementById('deepseek-isolated-container');
  }
  
  // Create an isolated container that won't affect page layout
  const container = document.createElement('div');
  container.id = 'deepseek-isolated-container';
  container.style.cssText = `
    position: fixed !important;
    z-index: 2147483646 !important;
    top: 0 !important;
    left: 0 !important;
    width: 0 !important;
    height: 0 !important;
    overflow: visible !important;
    pointer-events: auto !important;
  `;
  
  document.body.appendChild(container);
  return container;
}

// Function to load external CSS file
function loadCSS(file) {
  return new Promise((resolve) => {
    try {
      // Skip loading CSS for Google AI Studio to prevent layout issues
      if (file === 'main.css' && isGoogleAIStudio()) {
        console.log('Skipping CSS loading for Google AI Studio to prevent layout issues');
        resolve();
        return;
      }

      const existingLink = document.querySelector(`link[href*="${file}"]`);
      if (existingLink) {
        console.log(`${file} is already loaded`);
        resolve();
        return;
      }

      const url = chrome.runtime.getURL(file);
      if (!url) {
        console.warn(`Failed to get URL for ${file}`);
        resolve(); // Continue without the CSS
        return;
      }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
      link.href = url;
      
      link.onload = () => {
        console.log(`Successfully loaded ${file}`);
        resolve();
      };
      
      link.onerror = (error) => {
        console.warn(`Failed to load ${file}:`, error);
        resolve(); // Continue without the CSS
      };

    document.head.appendChild(link);
    } catch (error) {
      console.warn(`Error during CSS loading:`, error);
      resolve(); // Continue without the CSS
    }
  });
}

// Initialize content script
async function initializeContentScript() {
  console.log('Initializing content script...');
  
  // For Google AI Studio, create isolated container and use isolated styles
  if (isGoogleAIStudio()) {
    console.log('Google AI Studio detected - using isolated styles');
    createIsolatedContainer();
    
    // Add notification styles with more specific selectors and !important to ensure they don't get overridden
    if (!document.getElementById('deepseek-notification-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'deepseek-notification-styles';
      styleElement.textContent = `
        /* Ensure styles only apply to our extension elements with high specificity */
        .deepseek-notification {
          position: fixed !important;
          bottom: 20px !important;
          right: 20px !important;
          padding: 12px 20px !important;
          border-radius: 8px !important;
          font-size: 16px !important;
          z-index: 2147483647 !important;
          opacity: 0 !important;
          transform: translateY(10px) !important;
          transition: opacity 0.3s ease, transform 0.3s ease !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
          width: 225px !important;
          box-sizing: border-box !important;
          pointer-events: auto !important;
          text-align: left !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }

        .deepseek-notification.success {
          background: rgba(25, 135, 84, 0.95) !important;
          color: white !important;
          backdrop-filter: blur(8px) !important;
          -webkit-backdrop-filter: blur(8px) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
        }

        .deepseek-notification.error {
          background: rgba(220, 53, 69, 0.95) !important;
          color: white !important;
          backdrop-filter: blur(8px) !important;
          -webkit-backdrop-filter: blur(8px) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
        }

        .deepseek-notification.show {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }

        /* Ensure notification content is properly styled */
        .deepseek-notification .title {
          font-weight: 600 !important;
          font-size: 16px !important;
          line-height: 1.4 !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        .deepseek-notification .description {
          font-size: 14px !important;
          line-height: 1.4 !important;
          margin: 4px 0 0 0 !important;
          padding: 0 !important;
        }
      `;
      document.head.appendChild(styleElement);
    }
  } else {
    // For other sites like DeepSeek, load the full CSS
    try {
      await loadCSS('main.css');
      await loadCSS('settings.css');
    } catch (error) {
      console.warn('CSS loading error:', error);
    }
  }

  // Notify background script that content script is ready
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' });
      if (response?.status === 'ok') {
        console.log('Successfully connected to background script');
      }
  } catch (error) {
      console.warn('Initial connection to background script failed:', error);
  }
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

// Helper function to determine the current chat service
function getCurrentService() {
  const url = window.location.href;
  if (url.includes('chat.deepseek.com')) {
    return 'deepseek';
  } else if (url.includes('aistudio.google.com')) {
    return 'google-ai';
  }
  return null;
}

// Function to get chat content from DeepSeek
function getDeepSeekChatContent() {
  const messages = [];
  
  // Find all user questions
  const userQuestions = document.querySelectorAll('.fbb737a4');
  // Find all assistant responses
  const assistantResponses = document.querySelectorAll('.ds-markdown.ds-markdown--block');
  
  if ((!userQuestions || userQuestions.length === 0) && (!assistantResponses || assistantResponses.length === 0)) {
    return { status: 'error', error: 'No messages found' };
  }

  // Process messages in pairs to maintain order
  const maxLength = Math.max(userQuestions.length, assistantResponses.length);
  for (let i = 0; i < maxLength; i++) {
    // Add user message if exists
    if (i < userQuestions.length) {
      const userContent = userQuestions[i];
      if (userContent) {
        messages.push({
          role: 'user',
          content: userContent.textContent.trim(),
          html: userContent.innerHTML.trim()
        });
      }
    }

    // Add assistant message if exists
    if (i < assistantResponses.length) {
      const assistantContent = assistantResponses[i];
      if (assistantContent) {
        messages.push({
          role: 'assistant',
          content: assistantContent.textContent.trim(),
          html: assistantContent.innerHTML.trim()
        });
      }
    }
  }

  // Get chat title using the correct selector
  const titleElement = document.querySelector('.d8ed659a');
  const title = titleElement ? titleElement.textContent.trim() : document.title.replace(' - DeepSeek Chat', '').trim() || 'DeepSeek Chat';

  return {
    status: 'ok',
    title,
    messages,
    metadata: {
      source: 'deepseek',
      url: window.location.href,
      savedAt: new Date().toISOString()
    }
  };
}

// Function to get chat content from Google AI Studio
function getGoogleAIChatContent() {
  const messages = [];
  
  // Find all chat turn containers
  const chatTurns = document.querySelectorAll('.chat-turn-container.render');
  
  // Helper function to clean message content
  function cleanMessageContent(element) {
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true);
    
    // Remove action buttons
    const buttonsToRemove = clone.querySelectorAll('button, [role="button"]');
    buttonsToRemove.forEach(button => button.remove());

    return {
      content: clone.textContent.trim(),
      html: clone.innerHTML.trim()
    };
  }

  // Process messages in order of appearance
  chatTurns.forEach(messageEl => {
    const isUser = messageEl.classList.contains('user');
    const cleanContent = cleanMessageContent(messageEl);
    messages.push({
      role: isUser ? 'user' : 'assistant',
      ...cleanContent
    });
  });

  // Get chat title from the page title or use default
  const title = document.title
    .replace(/ - Google AI Studio$/, '')
    .replace(/ \| Google AI Studio$/, '')
    .replace(/Google AI Studio - /, '')
    .replace(/Google AI Studio \| /, '')
    .trim() || 'Google AI Chat';

  return {
    status: 'ok',
      title,
    messages,
      metadata: {
      source: 'google-ai',
        url: window.location.href,
      savedAt: new Date().toISOString()
    }
  };
}

// Single message listener for all message types
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);

  try {
    switch (message.type) {
      case 'GET_CHAT_INFO':
        const service = getCurrentService();
        let response;

        switch (service) {
          case 'deepseek':
            response = getDeepSeekChatContent();
            break;
          case 'google-ai':
            response = getGoogleAIChatContent();
            break;
          default:
            response = { status: 'error', error: 'Unsupported chat service' };
        }

        sendResponse(response);
        break;

      case 'SHOW_NOTIFICATION':
        console.log('Showing notification:', message.message, 'isError:', message.isError);
        showNotification(message.message, message.isError);
        sendResponse({ status: 'ok' });
        break;

      case 'CONTENT_SCRIPT_READY':
        sendResponse({ status: 'ok' });
        break;

      default:
        console.warn('Unknown message type:', message.type);
        sendResponse({ status: 'error', error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ status: 'error', error: error.message });
  }

  return true; // Keep the message channel open for async response
});

// Function to show notification
function showNotification(message, isError = false) {
  console.log('showNotification called with message:', message, 'isError:', isError);
  console.log('Current URL:', window.location.href);
  console.log('isGoogleAIStudio:', isGoogleAIStudio());
  
  // Use special method for Google AI Studio
  if (isGoogleAIStudio()) {
    console.log('Using special notification method for Google AI Studio');
    showGoogleAIStudioNotification(message, isError);
    return;
  }
  
  // Standard notification for other sites
  // Remove any existing notifications
  const existingNotification = document.querySelector('.deepseek-notification');
  if (existingNotification) {
    console.log('Removing existing notification');
    existingNotification.remove();
  }

  // Create notification element with proper scoping
  const notification = document.createElement('div');
  notification.className = `deepseek-notification ${isError ? 'error' : 'success'}`;
  console.log('Created notification element with class:', notification.className);
  
  // Parse message if it's an object with title and description
  if (typeof message === 'object' && message.title) {
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = message.title;
    notification.appendChild(title);
    
    if (message.description) {
      const description = document.createElement('div');
      description.className = 'description';
      description.textContent = message.description;
      notification.appendChild(description);
    }
  } else {
    // Simple string message
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = message;
    notification.appendChild(title);
  }

  // Add to DOM directly to document.body
  console.log('Adding notification directly to document.body');
  document.body.appendChild(notification);

  // Force notification to be visible with high z-index
  notification.style.zIndex = '2147483647';
  
  // Show notification with animation
  console.log('Setting timeout to add show class');
  setTimeout(() => {
    console.log('Adding show class to notification');
    notification.classList.add('show');
    console.log('Notification classes after adding show:', notification.className);
    
    // Force notification to be visible again after adding show class
    notification.style.opacity = '1';
    notification.style.transform = 'translateY(0)';
    
    // Check if notification is actually in the DOM
    const notificationInDOM = document.querySelector('.deepseek-notification');
    console.log('Is notification in DOM?', !!notificationInDOM);
    
    // If notification is not in DOM, try adding it again
    if (!notificationInDOM) {
      console.log('Notification not found in DOM, adding it again');
      document.body.appendChild(notification);
      notification.classList.add('show');
      notification.style.opacity = '1';
      notification.style.transform = 'translateY(0)';
    }
  }, 10);

  // Auto-hide after 3 seconds
  setTimeout(() => {
    console.log('Removing show class from notification');
    notification.classList.remove('show');
    setTimeout(() => {
      console.log('Removing notification from DOM');
      notification.remove();
    }, 300); // Wait for fade out animation
  }, 3000);
}

// Special function for Google AI Studio notifications using Shadow DOM
function showGoogleAIStudioNotification(message, isError = false) {
  console.log('showGoogleAIStudioNotification called with message:', message, 'isError:', isError);
  
  // Create host element
  const host = document.createElement('div');
  host.id = 'deepseek-notification-host';
  host.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483647;
    width: 225px;
    height: auto;
  `;
  
  // Create shadow root
  const shadow = host.attachShadow({ mode: 'open' });
  
  // Create styles
  const style = document.createElement('style');
  style.textContent = `
    .notification {
      position: relative;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 16px;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.3s ease, transform 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      width: 100%;
      box-sizing: border-box;
      text-align: left;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .notification.success {
      background: rgba(25, 135, 84, 0.95);
      color: white;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .notification.error {
      background: rgba(220, 53, 69, 0.95);
      color: white;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .notification.show {
      opacity: 1;
      transform: translateY(0);
    }
    
    .title {
      font-weight: 600;
      font-size: 16px;
      line-height: 1.4;
      margin: 0;
      padding: 0;
    }
    
    .description {
      font-size: 14px;
      line-height: 1.4;
      margin: 4px 0 0 0;
      padding: 0;
    }
  `;
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${isError ? 'error' : 'success'}`;
  
  // Parse message if it's an object with title and description
  if (typeof message === 'object' && message.title) {
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = message.title;
    notification.appendChild(title);
    
    if (message.description) {
      const description = document.createElement('div');
      description.className = 'description';
      description.textContent = message.description;
      notification.appendChild(description);
    }
  } else {
    // Simple string message
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = message;
    notification.appendChild(title);
  }
  
  // Add elements to shadow DOM
  shadow.appendChild(style);
  shadow.appendChild(notification);
  
  // Add host to document
  document.body.appendChild(host);
  console.log('Added notification host to document.body');
  
  // Show notification with animation
  setTimeout(() => {
    notification.classList.add('show');
    console.log('Added show class to notification in shadow DOM');
  }, 10);
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      host.remove();
      console.log('Removed notification host from DOM');
    }, 300); // Wait for fade out animation
  }, 3000);
}

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