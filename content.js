// Register content script
console.log('Content script loaded');

// Function to check if current site is Google AI Studio
function isGoogleAIStudio() {
  return window.location.href.includes('aistudio.google.com');
}

// Function to check if current site is ChatGPT
function isChatGPT() {
  return window.location.href.includes('chatgpt.com');
}

// Function to check if current site is DeepSeek
function isDeepSeek() {
  return window.location.href.includes('chat.deepseek.com');
}

// Function to check if current site is Grok
function isGrok() {
  return window.location.href.includes('grok.com');
}

// Function to check if current site is Claude
function isClaude() {
  return window.location.href.includes('claude.ai');
}

// Function to check if current site is Gemini
function isGemini() {
  return window.location.href.includes('gemini.google.com');
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

// Function to add "Add to Favorites" button to ChatGPT interface
// REMOVED: This function is no longer used as the button was interfering with ChatGPT interface
// Favorites functionality is available through context menu (right-click) instead

// Function to load external CSS file
function loadCSS(file) {
  return new Promise((resolve) => {
    try {
      // Skip loading CSS for Google AI Studio and ChatGPT to prevent layout issues
      if ((file === 'main.css' && (isGoogleAIStudio() || isChatGPT())) || 
          (file === 'settings.css' && (isGoogleAIStudio() || isChatGPT()))) {
        console.log(`Skipping CSS loading for ${isGoogleAIStudio() ? 'Google AI Studio' : 'ChatGPT'} to prevent layout issues`);
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
        console.warn(`Failed to load ${file}: Error loading CSS`);
        resolve(); // Continue without the CSS
      };

      document.head.appendChild(link);
    } catch (error) {
      console.warn(`Error during CSS loading:`, error);
      resolve(); // Continue without the CSS
    }
  });
}

// Function to fix incorrect message labels in Grok
function fixGrokMessageLabels() {
  // Check if we're on Grok
  if (!isGrok()) return;
  
  // Find all message sender labels that might be incorrect
  const messageLabels = document.querySelectorAll('.message-sender');
  
  messageLabels.forEach(label => {
    // Get the parent message container
    const messageContainer = label.closest('.message-container') || 
                            label.closest('.relative.group.flex.flex-col.justify-center.w-full');
    
    if (!messageContainer) return;
    
    // Check if this is a user message or assistant message based on the alignment class
    const isUserMessage = messageContainer.classList.contains('items-end');
    const isAssistantMessage = messageContainer.classList.contains('items-start');
    
    // Apply correct label
    if (isAssistantMessage && label.textContent === 'You') {
      label.textContent = 'Assistant';
    } else if (isUserMessage && label.textContent !== 'You') {
      label.textContent = 'You';
    }
  });
  
  // Fix labels in chat history panel
  fixChatHistoryLabels();
}

// Function to fix message labels in the chat history panel
function fixChatHistoryLabels() {
  // First try very specific match for the exact modal shown in the screenshot
  const chatHistoryModals = document.querySelectorAll('div[role="dialog"]');
  
  for (const modal of chatHistoryModals) {
    const heading = modal.querySelector('h2');
    if (heading && heading.textContent.trim() === 'Chat History') {
      // This is the correct modal - find the messages and fix their labels
      const historyMessages = modal.querySelectorAll('.rounded-xl.p-4.mb-2, div[class*="bg-gray-800"]');
      
      // If no specific class found, try more general approach for the structure
      if (!historyMessages || historyMessages.length === 0) {
        // The structure shown in screenshot has message blocks with padding and margin
        const allDivs = modal.querySelectorAll('div');
        const possibleMessages = Array.from(allDivs).filter(div => {
          // Filter to likely message containers - check computed style
          const style = window.getComputedStyle(div);
          return style.padding !== '0px' && style.marginBottom !== '0px' && 
                 div.querySelector('div:first-child') && // Has a child div for sender
                 div.children.length >= 2; // Has at least 2 children (sender + content)
        });
        
        if (possibleMessages.length >= 2) {
          // Apply alternating labels
          possibleMessages.forEach((message, index) => {
            const senderLabel = message.querySelector('div:first-child');
            if (senderLabel) {
              senderLabel.textContent = index % 2 === 0 ? 'You' : 'Assistant';
            }
          });
          return;
        }
      }
      
      if (historyMessages && historyMessages.length > 0) {
        // Simple alternating pattern for the history panel
        historyMessages.forEach((message, index) => {
          const senderLabel = message.querySelector('div:first-child');
          if (senderLabel) {
            // In chat history, we know it should strictly alternate
            senderLabel.textContent = index % 2 === 0 ? 'You' : 'Assistant';
          }
        });
        return;
      }
    }
  }
  
  // Rest of the existing code as fallback
  // First try direct match for the chat history modal shown in the screenshot
  const chatHistoryHeading = Array.from(document.querySelectorAll('h2')).find(
    h => h.textContent && h.textContent.trim() === 'Chat History'
  );
  
  if (chatHistoryHeading) {
    // Find the modal container
    const modalContainer = chatHistoryHeading.closest('[role="dialog"]') || 
                         chatHistoryHeading.closest('.fixed') || 
                         findAncestorWithClass(chatHistoryHeading, 'fixed');
                         
    if (modalContainer) {
      // Find message blocks within this container - more specific to the structure in the screenshot
      const historyMessages = modalContainer.querySelectorAll('.rounded-xl.p-4.mb-2, .dark\\:bg-gray-800');
      
      if (historyMessages && historyMessages.length > 0) {
        // Simple alternating pattern for the history panel
        historyMessages.forEach((message, index) => {
          const senderLabel = message.querySelector('div:first-child');
          if (senderLabel) {
            // In chat history, we know it should strictly alternate
            // First is always user, second is always assistant
            if (index % 2 === 0) {
              // Even indices (0, 2, 4...) should be "You"
              if (senderLabel.textContent !== 'You') {
                senderLabel.textContent = 'You';
              }
            } else {
              // Odd indices (1, 3, 5...) should be "Assistant"
              if (senderLabel.textContent !== 'Assistant') {
                senderLabel.textContent = 'Assistant';
              }
            }
          }
        });
        return;
      }
    }
  }
  
  // Fallback to other approaches if the direct match fails
  const chatHistoryPanel = document.querySelector('[aria-label="Chat History"]');
  
  if (!chatHistoryPanel) {
    // Try alternative approach - find heading with Chat History text
    const historyHeadings = Array.from(document.querySelectorAll('h2, h3, div')).filter(el => 
      el.textContent && el.textContent.trim() === 'Chat History'
    );
    
    // If found, get the closest parent that might be the panel
    if (historyHeadings.length > 0) {
      // Try to find the parent container that contains the history
      let parent = historyHeadings[0].parentElement;
      for (let i = 0; i < 5 && parent; i++) { // Check up to 5 levels up
        const messages = parent.querySelectorAll('div.rounded-xl.p-4.mb-2, .dark\\:bg-gray-800');
        if (messages && messages.length > 0) {
          fixHistoryMessagesInContainer(messages);
          return;
        }
        parent = parent.parentElement;
      }
    }
    return;
  }
  
  // Find all message containers in the chat history
  const historyMessages = chatHistoryPanel.querySelectorAll('div.rounded-xl.p-4.mb-2, .dark\\:bg-gray-800');
  
  if (!historyMessages || historyMessages.length === 0) return;
  
  fixHistoryMessagesInContainer(historyMessages);
}

// Helper function to find ancestor with a specific class
function findAncestorWithClass(element, className) {
  while (element) {
    if (element.classList && element.classList.contains(className)) {
      return element;
    }
    element = element.parentElement;
  }
  return null;
}

// Helper function to fix messages in a container
function fixHistoryMessagesInContainer(historyMessages) {
  // Process messages in order
  historyMessages.forEach((message, index) => {
    const senderLabel = message.querySelector('div:first-child');
    
    if (!senderLabel) return;
    
    // Attempt to determine if this is user or assistant by content
    const messageContent = message.textContent.replace(senderLabel.textContent, '').trim();
    const isFirstMessage = index === 0;
    
    // Check if this message has characteristics of an assistant message
    // Assistant messages tend to be longer and more structured
    const hasCodeBlocks = message.querySelector('pre') || message.querySelector('code');
    const hasListItems = message.querySelector('ul') || message.querySelector('ol') || messageContent.includes('• ');
    const hasMultipleLines = messageContent.split('\n').filter(line => line.trim().length > 0).length > 2;
    const hasVeryLongContent = messageContent.length > 200;
    
    // Determine whether this looks like an assistant message
    let isLikelyAssistant = hasCodeBlocks || hasListItems || hasMultipleLines || hasVeryLongContent;
    
    // First message is usually from user unless it's very clearly an assistant message
    if (isFirstMessage && !isLikelyAssistant) {
      // First message is typically from the user
      if (senderLabel.textContent !== 'You') {
        senderLabel.textContent = 'You';
      }
    } 
    // For alternate messages, use the simple alternating pattern if we can't clearly determine
    else if (!isFirstMessage) {
      const previousSender = historyMessages[index - 1].querySelector('div:first-child');
      
      if (previousSender && previousSender.textContent === 'You' && senderLabel.textContent === 'You') {
        // If previous was "You", this should be "Assistant"
        senderLabel.textContent = 'Assistant';
      } else if (previousSender && previousSender.textContent === 'Assistant' && senderLabel.textContent === 'Assistant') {
        // If previous was "Assistant", this should be "You"
        senderLabel.textContent = 'You';
      }
    }
  });
}

// Run message label fix on page load and periodically
function initGrokMessageLabelFix() {
  if (!isGrok()) return;
  
  // Fix labels initially after page load
  setTimeout(fixGrokMessageLabels, 2000);
  
  // Fix labels when new messages arrive by running periodically
  setInterval(fixGrokMessageLabels, 1000);
  
  // Also watch for DOM changes to catch new messages immediately
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        fixGrokMessageLabels();
        break;
      }
    }
  });
  
  // Start observing the chat container
  const chatContainer = document.querySelector('.relative.flex.flex-col.items-stretch.h-full');
  if (chatContainer) {
    observer.observe(chatContainer, { childList: true, subtree: true });
  }
}

// Initialize content script
async function initializeContentScript() {
  console.log('Initializing content script...');
  
  // First check if we're on a supported site
  if (isGoogleAIStudio()) {
    // For Google AI Studio, only add the button without loading styles
    console.log('Google AI Studio detected - handling initialization');
    // Wait for the page to fully load
    setTimeout(addFavoriteButtonToGoogleAI, 2000);
    
    // Also add a mutation observer to handle dynamic changes
    const observer = new MutationObserver((mutations) => {
      addFavoriteButtonToGoogleAI();
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
  } else if (isChatGPT()) {
    // For ChatGPT, do not add any UI buttons to avoid interfering with the interface
    // Favorite functionality is available through context menu (right-click)
    console.log('ChatGPT detected - favorites available via context menu only');
  } else if (isGrok()) {
    // For Grok, only add the favorite button without loading any styles
    console.log('Grok detected - only adding favorite button');
    // Wait for the page to fully load
    setTimeout(addFavoriteButtonToGrok, 2000);
    
    // Also add a mutation observer to handle dynamic changes
    const observer = new MutationObserver((mutations) => {
      addFavoriteButtonToGrok();
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
    
    // Initialize the message label fix
    initGrokMessageLabelFix();
  } else if (isClaude()) {
    // For Claude, only add the favorite button without loading any styles
    console.log('Claude detected - only adding favorite button');
    // Wait for the page to fully load
    setTimeout(addFavoriteButtonToClaude, 2000);
    
    // Also add a mutation observer to handle dynamic changes
    const observer = new MutationObserver((mutations) => {
      addFavoriteButtonToClaude();
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
  } else if (isGemini()) {
    // For Gemini, only add the favorite button without loading any styles
    console.log('Gemini detected - only adding favorite button');
    // Wait for the page to fully load
    setTimeout(addFavoriteButtonToGemini, 2000);
    
    // Also add a mutation observer to handle dynamic changes
    const observer = new MutationObserver((mutations) => {
      addFavoriteButtonToGemini();
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
  } else if (isDeepSeek()) {
    // For DeepSeek, load our styles
    console.log('DeepSeek detected - loading styles');
    await loadCSS('main.css');
    await loadCSS('settings.css');
  }
  
  // Notify the background script that content is loaded
  await notifyBackgroundScript();
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
  } else if (url.includes('chatgpt.com')) {
    return 'chatgpt';
  } else if (url.includes('grok.com')) {
    return 'grok';
  } else if (url.includes('claude.ai')) {
    return 'claude';
  } else if (url.includes('gemini.google.com')) {
    return 'gemini';
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
  console.log('Starting to extract Google AI Studio chat content...');
  
  // Find all chat turn containers with updated selectors
  const userMessages = document.querySelectorAll('.chat-turn-container.render.user');
  const assistantMessages = document.querySelectorAll('.chat-turn-container.model.render');
  
  console.log(`Found ${userMessages.length} user messages and ${assistantMessages.length} assistant messages with primary selectors`);
  
  // If no messages found with these selectors, try alternative selectors
  if ((!userMessages || userMessages.length === 0) && (!assistantMessages || assistantMessages.length === 0)) {
    // Try to find all message containers with more generic selectors
    const allTurns = document.querySelectorAll('.chat-turn, [role="region"][aria-label*="chat"], [data-message-id]');
    
    if (allTurns && allTurns.length > 0) {
      // Process each message container
      allTurns.forEach(turn => {
        // Try to determine if user or assistant
        const isUser = turn.classList.contains('user') || 
                      turn.getAttribute('aria-label')?.includes('User') ||
                      turn.querySelector('.user-message, .human-message, [role="user"]');
        
        // Get content
        const contentElement = turn.querySelector('.content, .message-content, .text-content, .chat-turn-content') || turn;
        
        if (contentElement) {
          // Clean the content
          const clone = contentElement.cloneNode(true);
          const buttonsToRemove = clone.querySelectorAll('button, [role="button"]');
          buttonsToRemove.forEach(button => button.remove());
          
          // Add to messages
          const position = Array.from(document.body.querySelectorAll('*')).indexOf(turn);
          messages.push({
            role: isUser ? 'user' : 'assistant',
            position: position,
            content: clone.textContent.trim(),
            html: clone.innerHTML.trim()
          });
        }
      });
      
      // Sort by position
      messages.sort((a, b) => a.position - b.position);
      
      if (messages.length > 0) {
        // Get chat title
        const titleElement = document.querySelector('title');
        const title = titleElement ? titleElement.textContent.trim() : 'Google AI Chat';
        
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
    }
  }
  
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

  // Create an array of all message elements with their roles and positions
  const allMessages = [];
  
  // Add user messages to the array
  userMessages.forEach(elem => {
    const cleanContent = cleanMessageContent(elem);
    // Use parentNode to get the entire chat turn for better position calculation
    const container = elem.closest('.chat-turn') || elem;
    const position = Array.from(document.body.querySelectorAll('*')).indexOf(container);
    allMessages.push({
      role: 'user',
      position: position,
      ...cleanContent
    });
  });
  
  // Add assistant messages to the array
  assistantMessages.forEach(elem => {
    const cleanContent = cleanMessageContent(elem);
    // Use parentNode to get the entire chat turn for better position calculation
    const container = elem.closest('.chat-turn') || elem;
    const position = Array.from(document.body.querySelectorAll('*')).indexOf(container);
    allMessages.push({
      role: 'assistant',
      position: position,
      ...cleanContent
    });
  });
  
  // Sort all message elements by their DOM position
  allMessages.sort((a, b) => a.position - b.position);
  
  console.log(`After primary extraction: found ${allMessages.length} messages in total`);
  
  // If still no messages found, try even more aggressive selectors
  if (allMessages.length === 0 || allMessages.length === 1) {
    console.log('Using aggressive selectors to find all messages');
    
    // Try to find all possible message containers using a variety of selectors
    // This includes potential selectors used in different Google AI Studio versions
    const possibleSelectors = [
      '.chat-turn-root', // Main chat turn container
      '.chat-turn-container', // Chat turn container
      '.chat-turn', // Another chat turn class
      '.message-container', // Generic message container
      '[role="region"]', // ARIA role for regions
      '[data-testid*="chat-turn"]', // Test IDs
      '[data-testid*="message"]',
      '[aria-label*="chat"]', // ARIA labels
      '.gemini-chat-turn', // Specific to Gemini-like interfaces
      '.model-response', // Model responses
      '.user-input, .user-query', // User inputs
      '.chat-message', // Generic chat message class
      '.conversation-turn', // Another conversation turn class
      '.ai-response-container', // AI response containers
      '.human-query-container', // Human query containers
      '.message-thread-item', // Thread items
      '.user-message-container', // User message containers
      '.assistant-message-container', // Assistant message containers
      '.prompt-response', // Prompt responses
      '.prompt-text, .response-text', // Prompt and response texts
      '[role="listitem"]', // List items in a chat
      '.chat-bubble' // Chat bubbles
    ];
    
    // Create a unified selector
    const unifiedSelector = possibleSelectors.join(', ');
    const potentialMessages = document.querySelectorAll(unifiedSelector);
    
    // Already processed DOM elements (to avoid duplicates)
    const processedElements = new Set(allMessages.map(m => m.domElement).filter(Boolean));
    
    // Process each potential message container
    potentialMessages.forEach(element => {
      // Skip if already processed
      if (processedElements.has(element)) return;
      
      // Try to determine the role (user vs assistant)
      const isUserTurn = 
        element.classList.contains('user') || 
        element.getAttribute('data-testid')?.includes('user') ||
        element.getAttribute('aria-label')?.includes('User') ||
        element.classList.contains('user-query') ||
        element.classList.contains('user-input') ||
        element.querySelector('.user-avatar, .human-avatar');
      
      // Skip containers without substantial content
      const textContent = element.textContent.trim();
      if (!textContent || textContent.length < 5) return;
      
      // Skip UI elements that aren't actual messages (buttons, etc.)
      if (element.tagName === 'BUTTON' || 
          element.getAttribute('role') === 'button' ||
          (element.children.length === 0 && element.textContent.length < 10)) {
        return;
      }
      
      // Clean the content 
      const clone = element.cloneNode(true);
      const buttonsToRemove = clone.querySelectorAll('button, [role="button"], svg, .action-button, .copy-button');
      buttonsToRemove.forEach(button => button.remove());
      
      // Add to messages with DOM position for sorting
      const position = Array.from(document.body.querySelectorAll('*')).indexOf(element);
      
      allMessages.push({
        role: isUserTurn ? 'user' : 'assistant',
        position: position,
        content: clone.textContent.trim(),
        html: clone.innerHTML.trim(),
        domElement: element // Store reference to avoid duplicates
      });
      
      // Mark as processed
      processedElements.add(element);
    });
    
    // Sort again by DOM position
    allMessages.sort((a, b) => a.position - b.position);
    
    // Filter out references to DOM elements before returning
    allMessages = allMessages.map(({ domElement, ...rest }) => rest);
    
    console.log(`After aggressive selectors: found ${allMessages.length} messages in total`);
  }
  
  // Additional method: Find pairs of elements that might represent Q&A pairs
  // This is useful for interfaces where the chat is displayed as paired elements
  if (allMessages.length === 0 || allMessages.length < 2) {
    console.log('Using Q&A pair detection to find messages');
    
    // Look for sequences where a user message is followed by an assistant message
    const userPrompts = document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]');
    
    userPrompts.forEach(prompt => {
      // Skip if not visible or very small
      if (prompt.offsetHeight === 0 || prompt.value?.length < 3) return;
      
      // Find the closest response container (usually follows the prompt)
      let responseContainer = null;
      let current = prompt.parentElement;
      
      // Look up to 5 levels up to find a common container
      for (let i = 0; i < 5 && current; i++) {
        // Try to find a response element that's a sibling or child of a sibling
        const siblings = Array.from(current.parentElement?.children || []);
        const index = siblings.indexOf(current);
        
        // Check elements that follow the current one in the DOM
        if (index !== -1 && index < siblings.length - 1) {
          for (let j = index + 1; j < siblings.length; j++) {
            const potentialResponse = siblings[j].querySelector('.ai-response, .model-response, .assistant-message') || siblings[j];
            
            if (potentialResponse && potentialResponse.textContent.trim().length > 10) {
              responseContainer = potentialResponse;
              break;
            }
          }
        }
        
        if (responseContainer) break;
        current = current.parentElement;
      }
      
      // If we found a prompt-response pair
      if (responseContainer) {
        // Get prompt text (value for inputs, textContent for contenteditable)
        const promptText = prompt.value || prompt.textContent.trim();
        
        if (promptText && promptText.length > 0) {
          // Add the user message
          const userPosition = Array.from(document.body.querySelectorAll('*')).indexOf(prompt);
          allMessages.push({
            role: 'user',
            position: userPosition,
            content: promptText,
            html: promptText
          });
          
          // Add the assistant response
          const assistantPosition = Array.from(document.body.querySelectorAll('*')).indexOf(responseContainer);
          
          // Clean the response content
          const clone = responseContainer.cloneNode(true);
          const buttonsToRemove = clone.querySelectorAll('button, [role="button"], svg, .action-button, .copy-button');
          buttonsToRemove.forEach(button => button.remove());
          
          allMessages.push({
            role: 'assistant',
            position: assistantPosition,
            content: clone.textContent.trim(),
            html: clone.innerHTML.trim()
          });
        }
      }
    });
    
    // Sort again by position
    allMessages.sort((a, b) => a.position - b.position);
    
    console.log(`After Q&A pair detection: found ${allMessages.length} messages in total`);
  }
  
  // Get chat title
  const titleElement = document.querySelector('title');
  const title = titleElement ? titleElement.textContent.trim() : 'Google AI Chat';
  
  const result = {
    status: 'ok',
    title,
    messages: allMessages,
    metadata: {
      source: 'google-ai',
      url: window.location.href,
      savedAt: new Date().toISOString()
    }
  };
  
  console.log(`Final message count: ${allMessages.length}, message sample:`, 
    allMessages.length > 0 ? 
      [allMessages[0], allMessages.length > 1 ? allMessages[allMessages.length-1] : null] : 
      'No messages found');
  
  return result;
}

// Function to get chat content from ChatGPT
function getChatGPTContent() {
  const messages = [];
  
  // Try multiple selector strategies to find conversation elements
  const userElements = document.querySelectorAll('.relative.max-w-\\[var\\(--user-chat-width\\,70\\%\\)\\].rounded-3xl.bg-token-message-surface');
  const assistantElements = document.querySelectorAll('.markdown');
  
  // If no elements found with either selector, try alternative approach
  if ((!userElements || userElements.length === 0) && (!assistantElements || assistantElements.length === 0)) {
    // Alternative: Look for all message elements and determine role based on structure
    const allMessageElements = document.querySelectorAll('[data-message-author-role]');
    
    if (!allMessageElements || allMessageElements.length === 0) {
      return { status: 'error', error: 'No messages found' };
    }
    
    // Process each message element in DOM order
    allMessageElements.forEach(elem => {
      const role = elem.getAttribute('data-message-author-role');
      const contentElement = elem.querySelector('.markdown') || elem.querySelector('.text-token-text-primary');
      
      if (contentElement) {
        messages.push({
          role: role,
          content: contentElement.textContent.trim(),
          html: contentElement.outerHTML
        });
      }
    });
  } else {
    // Create an array of all message elements with their roles and positions
    const allMessages = [];
    
    // Add user messages to the array
    userElements.forEach(elem => {
      const contentElement = elem.querySelector('.text-token-text-primary') || elem;
      if (contentElement) {
        // Find the position in the DOM
        const position = Array.from(document.body.querySelectorAll('*')).indexOf(elem);
        allMessages.push({
          elem: contentElement,
          role: 'user',
          position: position,
          content: contentElement.textContent.trim(),
          html: contentElement.outerHTML
        });
      }
    });
    
    // Add assistant messages to the array
    assistantElements.forEach(elem => {
      const messageElement = elem.closest('[data-message-author-role="assistant"]');
      if (messageElement) {
        // Find the position in the DOM
        const position = Array.from(document.body.querySelectorAll('*')).indexOf(messageElement);
        allMessages.push({
          elem: elem,
          role: 'assistant',
          position: position,
          content: elem.textContent.trim(),
          html: elem.outerHTML
        });
      }
    });
    
    // Sort all message elements by their DOM position
    allMessages.sort((a, b) => a.position - b.position);
    
    // Create messages array with the correct order
    allMessages.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content,
        html: msg.html
      });
    });
  }
  
  // If still no messages found, try another approach with more general selectors
  if (messages.length === 0) {
    // Try finding all message containers regardless of role
    const messageContainers = document.querySelectorAll('.flex.items-start.gap-4.whitespace-pre-wrap');
    
    if (messageContainers && messageContainers.length > 0) {
      // Process each message container in DOM order
      messageContainers.forEach(container => {
        // Check for user avatar or assistant icon to determine role
        const isUser = container.querySelector('img[alt="User"]') !== null || 
                       container.querySelector('.user-avatar') !== null;
        
        // Find the text content element
        const contentElement = container.querySelector('.whitespace-pre-wrap') || 
                             container.querySelector('div[class*="prose"]') ||
                             container;
        
        if (contentElement) {
          messages.push({
            role: isUser ? 'user' : 'assistant',
            content: contentElement.textContent.trim(),
            html: contentElement.innerHTML.trim()
          });
        }
      });
    }
  }
  
  // If still no messages found, return error
  if (messages.length === 0) {
    return { status: 'error', error: 'No messages found' };
  }
  
  // Get chat title
  const titleElement = document.querySelector('title');
  const title = titleElement ? titleElement.textContent.trim().replace(' - ChatGPT', '') : 'ChatGPT Conversation';
  
  return {
    status: 'ok',
    title,
    messages,
    metadata: {
      source: 'chatgpt',
      url: window.location.href,
      savedAt: new Date().toISOString()
    }
  };
}

// Function to get chat content from Grok
function getGrokChatContent() {
  const messages = [];
  
  // Find all user messages using the correct selector
  const userMessages = document.querySelectorAll('div.relative.group.flex.flex-col.justify-center.w-full.max-w-3xl.md\\:px-4.pb-2.gap-2.items-end');
  
  // Find all assistant messages
  const assistantMessages = document.querySelectorAll('div.relative.group.flex.flex-col.justify-center.w-full.max-w-3xl.md\\:px-4.pb-2.gap-2.items-start');
  
  if ((!userMessages || userMessages.length === 0) && (!assistantMessages || assistantMessages.length === 0)) {
    return { status: 'error', error: 'No messages found' };
  }

  // Create an ordered list of all message blocks with their roles
  const allMessageBlocks = [];
  
  // Add user messages
  userMessages.forEach(elem => {
    const position = Array.from(document.body.querySelectorAll('*')).indexOf(elem);
    
    allMessageBlocks.push({
      element: elem,
      role: 'user',
      position: position
    });
  });
  
  // Add assistant messages
  assistantMessages.forEach(elem => {
    const position = Array.from(document.body.querySelectorAll('*')).indexOf(elem);
    
    allMessageBlocks.push({
      element: elem,
      role: 'assistant',
      position: position
    });
  });
  
  // Sort by position in the DOM to maintain conversation order
  allMessageBlocks.sort((a, b) => a.position - b.position);
  
  // Process in order of appearance
  allMessageBlocks.forEach(block => {
    const contentElement = block.element.querySelector('.whitespace-pre-wrap') || block.element;
    
    if (contentElement) {
      let content = contentElement.textContent.trim();
      let html = contentElement.innerHTML.trim();
      
      // For assistant messages, clean up content by removing extra images and empty lines
      if (block.role === 'assistant') {
        // Create a temporary element to manipulate the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Remove all images, svg elements, and any spacer/separator elements
        tempDiv.querySelectorAll('img, svg, hr, br, .spacer, [role="separator"]').forEach(el => el.remove());
        
        // Update cleaned HTML
        html = tempDiv.innerHTML.trim();
        
        // Get cleaned text content and remove empty lines by splitting and filtering
        const rawText = tempDiv.textContent;
        const lines = rawText.split('\n').map(line => line.trim()).filter(line => line !== '');
        content = lines.join('\n');
      }
      
      messages.push({
        role: block.role,
        content: content,
        html: html
      });
    }
  });

  // Get chat title
  const titleElement = document.querySelector('title');
  const title = titleElement ? titleElement.textContent.trim().replace(' - Grok', '').trim() : 'Grok Conversation';
  
  return {
    status: 'ok',
    title,
    messages,
    metadata: {
      source: 'grok',
      url: window.location.href,
      savedAt: new Date().toISOString()
    }
  };
}

// Function to get chat content from Claude
function getClaudeChatContent() {
  const messages = [];
  
  // Find all user questions using data-testid attribute
  const userQuestions = document.querySelectorAll('[data-testid="user-message"]');
  
  // Find all assistant responses using data-is-streaming attribute
  const assistantResponses = document.querySelectorAll('[data-is-streaming="false"]');
  
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

  // Get chat title from the document title
  const title = document.title.replace(' | Claude', '').trim() || 'Claude Chat';

  return {
    status: 'ok',
    title,
    messages,
    metadata: {
      source: 'claude',
      url: window.location.href,
      savedAt: new Date().toISOString()
    }
  };
}

// Function to get chat content from Gemini
function getGeminiChatContent() {
  const messages = [];
  
  // Find user queries based on the provided selector
  const userQueries = document.querySelectorAll('.user-query-container');
  
  // Find model responses based on the provided selector
  const modelResponses = document.querySelectorAll('.model-response-text');
  
  if (userQueries.length === 0 && modelResponses.length === 0) {
    return { status: 'error', error: 'No messages found' };
  }
  
  // Create an array to store all messages in order
  const allMessages = [];
  
  // Set to track already processed content to avoid duplicates
  const processedContent = new Set();
  
  // Process user queries
  userQueries.forEach(elem => {
    const content = elem.textContent.trim();
    
    // Skip if this exact content has already been processed
    if (processedContent.has(content)) return;
    
    processedContent.add(content);
    
    const position = Array.from(document.body.querySelectorAll('*')).indexOf(elem);
    allMessages.push({
      element: elem,
      role: 'user',
      position: position,
      content: content
    });
  });
  
  // Process model responses
  modelResponses.forEach(elem => {
    const content = elem.textContent.trim();
    
    // Skip if this exact content has already been processed
    if (processedContent.has(content)) return;
    
    processedContent.add(content);
    
    const position = Array.from(document.body.querySelectorAll('*')).indexOf(elem);
    allMessages.push({
      element: elem,
      role: 'assistant',
      position: position,
      content: content
    });
  });
  
  // Sort by position in the DOM to maintain conversation order
  allMessages.sort((a, b) => a.position - b.position);
  
  // Process in order of appearance
  allMessages.forEach(message => {
    const contentElement = message.element;
    
    if (contentElement) {
      let content = message.content;
      let html = contentElement.innerHTML.trim();
      
      // For assistant messages, clean up content
      if (message.role === 'assistant') {
        // Create a temporary element to manipulate the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Remove unnecessary elements
        tempDiv.querySelectorAll('img, svg, hr, .spacer, [role="separator"]').forEach(el => el.remove());
        
        // Update cleaned HTML
        html = tempDiv.innerHTML.trim();
        
        // Get cleaned text content and remove empty lines
        const rawText = tempDiv.textContent;
        const lines = rawText.split('\n').map(line => line.trim()).filter(line => line !== '');
        content = lines.join('\n');
      }
      
      messages.push({
        role: message.role,
        content: content,
        html: html
      });
    }
  });
  
  // Get chat title
  const titleElement = document.querySelector('title');
  const title = titleElement ? titleElement.textContent.trim().replace(' - Gemini', '').trim() : 'Gemini Conversation';
  
  return {
    status: 'ok',
    title,
    messages,
    metadata: {
      source: 'gemini',
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
        console.log('Processing GET_CHAT_INFO request');
        const service = getCurrentService();
        console.log('Detected service:', service);
        let response;

        switch (service) {
          case 'deepseek':
            console.log('Getting DeepSeek chat content');
            response = getDeepSeekChatContent();
            break;
          case 'google-ai':
            console.log('Getting Google AI Studio chat content');
            response = getGoogleAIChatContent();
            break;
          case 'chatgpt':
            console.log('Getting ChatGPT chat content');
            response = getChatGPTContent();
            break;
          case 'grok':
            console.log('Getting Grok chat content');
            response = getGrokChatContent();
            break;
          case 'claude':
            console.log('Getting Claude chat content');
            response = getClaudeChatContent();
            break;
          case 'gemini':
            console.log('Getting Gemini chat content');
            response = getGeminiChatContent();
            break;
          default:
            console.log('Unsupported chat service');
            response = { status: 'error', error: 'Unsupported chat service' };
        }
        
        console.log('GET_CHAT_INFO response status:', response.status);
        if (response.status === 'ok') {
          console.log('Messages count:', response.messages?.length || 0);
          if (response.messages && response.messages.length > 0) {
            console.log('First message:', response.messages[0].role);
            console.log('Last message:', response.messages[response.messages.length - 1].role);
          } else {
            console.log('No messages found');
          }
        } else {
          console.log('Error in response:', response.error);
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

// Shared notification function for all platforms
function showNotification(message, isError = false) {
  console.log('Showing notification:', message, 'isError:', isError, 'current site:', window.location.href);
  
  if (isGoogleAIStudio()) {
    console.log('Using Google AI Studio specific notification');
    showGoogleAIStudioNotification(message, isError);
  } else if (isChatGPT()) {
    // For ChatGPT, use simple notification
    const notificationDiv = document.createElement('div');
    notificationDiv.textContent = message;
    notificationDiv.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:10px 15px;background:' + 
      (isError ? '#f8d7da' : '#d4edda') + ';color:' + (isError ? '#721c24' : '#155724') + 
      ';border-radius:4px;z-index:10000;box-shadow:0 2px 10px rgba(0,0,0,0.1);';
    document.body.appendChild(notificationDiv);
    setTimeout(() => {
      if (document.body.contains(notificationDiv)) {
        document.body.removeChild(notificationDiv);
      }
    }, 3000);
  } else if (isGrok()) {
    showGrokNotification(message, isError);
  } else if (isClaude()) {
    // For Claude, use simple notification
    const notificationDiv = document.createElement('div');
    notificationDiv.textContent = message;
    notificationDiv.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:10px 15px;background:' + 
      (isError ? '#f8d7da' : '#d4edda') + ';color:' + (isError ? '#721c24' : '#155724') + 
      ';border-radius:4px;z-index:10000;box-shadow:0 2px 10px rgba(0,0,0,0.1);';
    document.body.appendChild(notificationDiv);
    setTimeout(() => {
      if (document.body.contains(notificationDiv)) {
        document.body.removeChild(notificationDiv);
      }
    }, 3000);
  } else if (isGemini()) {
    showGeminiNotification(message, isError);
  } else {
    // For DeepSeek, use a DOM-based notification
    showDeepSeekNotification(message, isError);
  }
}

// Special function for DeepSeek notifications using Shadow DOM
function showDeepSeekNotification(message, isError = false) {
  console.log('showDeepSeekNotification called with message:', message, 'isError:', isError);
  
  // Create host element
  const host = document.createElement('div');
  host.id = 'deepseek-notification-host';
  host.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483647;
    max-width: 300px;
    width: 280px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
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
      width: 240px;
      box-sizing: border-box;
      text-align: left;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
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

// Special function for Google AI Studio notifications using Shadow DOM
function showGoogleAIStudioNotification(message, isError = false) {
  console.log('showGoogleAIStudioNotification called with message:', message, 'isError:', isError);
  
  try {
    // Если есть существующий элемент уведомления, удаляем его
    const existingNotification = document.getElementById('deepseek-notification-host');
    if (existingNotification) {
      console.log('Removing existing notification element');
      existingNotification.remove();
    }
    
    // Create host element
    const host = document.createElement('div');
    host.id = 'deepseek-notification-host';
    host.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      max-width: 300px;
      width: 280px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
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
        width: 240px;
        box-sizing: border-box;
        text-align: left;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
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
      
      .close-btn {
        position: absolute;
        top: 5px;
        right: 5px;
        background: transparent;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 16px;
        opacity: 0.7;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
      }
      
      .close-btn:hover {
        opacity: 1;
      }
    `;
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : 'success'}`;
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '×';
    closeBtn.onclick = () => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (host && host.parentNode) {
          host.parentNode.removeChild(host);
          console.log('Notification closed by user');
        }
      }, 300);
    };
    notification.appendChild(closeBtn);
    
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
    
    // Auto-hide after 4 seconds (longer time for user to read)
    setTimeout(() => {
      if (notification) {
        notification.classList.remove('show');
        setTimeout(() => {
          if (host && host.parentNode) {
            host.parentNode.removeChild(host);
            console.log('Removed notification host from DOM');
          }
        }, 300); // Wait for fade out animation
      }
    }, 4000);
  } catch (error) {
    console.error('Error showing notification:', error);
    
    // Fallback to simple notification if shadow DOM fails
    try {
      const simpleNotification = document.createElement('div');
      simpleNotification.textContent = message;
      simpleNotification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${isError ? 'rgba(220, 53, 69, 0.95)' : 'rgba(25, 135, 84, 0.95)'};
        color: white;
        border-radius: 8px;
        z-index: 2147483647;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-family: sans-serif;
      `;
      document.body.appendChild(simpleNotification);
      
      setTimeout(() => {
        if (document.body.contains(simpleNotification)) {
          document.body.removeChild(simpleNotification);
        }
      }, 4000);
    } catch (fallbackError) {
      console.error('Even fallback notification failed:', fallbackError);
    }
  }
}

// Function to show notification in Grok
function showGrokNotification(message, isError = false) {
  console.log('showGrokNotification called with message:', message, 'isError:', isError);
  
  // Create a host element for the shadow DOM
  const host = document.createElement('div');
  host.id = 'deepseek-notification-host';
  host.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483647;
    max-width: 300px;
    width: 280px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  `;
  
  // Create shadow DOM
  const shadow = host.attachShadow({ mode: 'closed' });
  
  // Add styles
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
      width: 240px;
      box-sizing: border-box;
      text-align: left;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
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

// Function to show notification in Gemini
function showGeminiNotification(message, isError = false) {
  // Check if there is already a notification
  const existingNotification = document.getElementById('deepseek-gemini-notification');
  if (existingNotification) {
    document.body.removeChild(existingNotification);
  }
  
  // Create host element
  const host = document.createElement('div');
  host.id = 'deepseek-notification-host';
  host.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483647;
    max-width: 300px;
    width: 280px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
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
      width: 240px;
      box-sizing: border-box;
      text-align: left;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
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

// Function to add "Add to Favorites" button to Grok interface
function addFavoriteButtonToGrok() {
  // Check if we're on Grok
  if (!isGrok()) return;
  
  // Check if button already exists
  if (document.getElementById('deepseek-add-favorite-btn')) return;
  
  // Find the header element where we'll add our button
  const headerElement = document.querySelector('header');
  if (!headerElement) {
    console.log('Grok header element not found');
    return;
  }
  
  // Create button
  const favoriteButton = document.createElement('button');
  favoriteButton.id = 'deepseek-add-favorite-btn';
  favoriteButton.innerHTML = '⭐ Add to Favorites';
  favoriteButton.style.cssText = `
    background-color: #1D9BF0;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 12px;
    margin-right: 10px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 5px;
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 10000;
  `;
  
  // Add click event
  favoriteButton.addEventListener('click', async () => {
    try {
      // Disable button to prevent multiple clicks
      favoriteButton.disabled = true;
      favoriteButton.style.opacity = '0.7';
      favoriteButton.innerHTML = '⏳ Adding...';
      
      // Get chat content
      const chatContent = getGrokChatContent();
      
      // Send to background script with retries
      let success = false;
      let lastError = null;
      
      // Try sending message up to 3 times
      for (let i = 0; i < 3; i++) {
        try {
          console.log(`Attempt ${i+1} to send message to background script`);
          const response = await chrome.runtime.sendMessage({
            type: 'ADD_TO_FAVORITES',
            data: chatContent
          });
          
          if (response && response.status === 'ok') {
            success = true;
            showNotification('Added to Favorites! ⭐');
            break;
          } else {
            lastError = response?.error || 'Unknown error';
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`Attempt ${i+1} failed:`, error);
          lastError = error.message;
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      if (!success) {
        showNotification('Error adding to favorites: ' + lastError, true);
      }
      
      // Re-enable button
      favoriteButton.disabled = false;
      favoriteButton.style.opacity = '1';
      favoriteButton.innerHTML = '⭐ Add to Favorites';
    } catch (error) {
      console.error('Error adding to favorites:', error);
      showNotification('Error adding to favorites: ' + error.message, true);
      
      // Re-enable button
      favoriteButton.disabled = false;
      favoriteButton.style.opacity = '1';
      favoriteButton.innerHTML = '⭐ Add to Favorites';
    }
  });
  
  // Add button to header
  headerElement.appendChild(favoriteButton);
  console.log('Added favorite button to Grok interface');
}

// Function to add "Add to Favorites" button to Claude interface
function addFavoriteButtonToClaude() {
  // We no longer add the fixed button for Claude.ai
  // The "Add to Favorites" functionality is now available through the context menu only
  return;
}

// Function to add "Add to Favorites" button to Gemini interface
function addFavoriteButtonToGemini() {
  // Check if we're on Gemini
  if (!isGemini()) return;
  
  // Check if button already exists
  if (document.getElementById('deepseek-add-favorite-btn')) return;
  
  // Find the header element where we'll add our button
  const headerElement = document.querySelector('header');
  if (!headerElement) {
    console.log('Gemini header element not found');
    return;
  }
  
  // Create button
  const favoriteButton = document.createElement('button');
  favoriteButton.id = 'deepseek-add-favorite-btn';
  favoriteButton.innerHTML = '⭐ Add to Favorites';
  favoriteButton.style.cssText = `
    background-color: #8E24AA;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 12px;
    margin-right: 10px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 5px;
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 10000;
  `;
  
  // Add click event
  favoriteButton.addEventListener('click', async () => {
    try {
      // Disable button to prevent multiple clicks
      favoriteButton.disabled = true;
      favoriteButton.style.opacity = '0.7';
      favoriteButton.innerHTML = '⏳ Adding...';
      
      // Get chat content
      const chatContent = getGeminiChatContent();
      
      // Send to background script with retries
      let success = false;
      let lastError = null;
      
      // Try sending message up to 3 times
      for (let i = 0; i < 3; i++) {
        try {
          console.log(`Attempt ${i+1} to send message to background script`);
          const response = await chrome.runtime.sendMessage({
            type: 'ADD_TO_FAVORITES',
            data: chatContent
          });
          
          if (response && response.status === 'ok') {
            success = true;
            showNotification('Added to Favorites! ⭐');
            break;
          } else {
            lastError = response?.error || 'Unknown error';
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`Attempt ${i+1} failed:`, error);
          lastError = error.message;
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      if (!success) {
        showNotification('Error adding to favorites: ' + lastError, true);
      }
      
      // Re-enable button
      favoriteButton.disabled = false;
      favoriteButton.style.opacity = '1';
      favoriteButton.innerHTML = '⭐ Add to Favorites';
    } catch (error) {
      console.error('Error adding to favorites:', error);
      showNotification('Error adding to favorites: ' + error.message, true);
      
      // Re-enable button
      favoriteButton.disabled = false;
      favoriteButton.style.opacity = '1';
      favoriteButton.innerHTML = '⭐ Add to Favorites';
    }
  });
  
  // Add button to header
  headerElement.appendChild(favoriteButton);
  console.log('Added favorite button to Gemini interface');
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