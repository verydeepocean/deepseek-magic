// Register content script
console.log('Content script loaded');

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

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (message.type === 'GET_CHAT_INFO') {
    // Handle async response
    (async () => {
      try {
        const chatContent = await getChatContent();
        console.log('Got chat content:', chatContent);
        sendResponse({ 
          status: 'ok', 
          title: chatContent.title,
          messages: chatContent.messages,
          metadata: chatContent.metadata
        });
      } catch (error) {
        console.error('Error getting chat info:', error);
        sendResponse({ status: 'error', error: error.message });
      }
    })();
    return true;
  }
  
  if (message.type === 'SHOW_NOTIFICATION') {
    showNotification(message.message, message.isError);
    sendResponse({ status: 'ok' });
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