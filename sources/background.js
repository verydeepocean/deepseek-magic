// Создаем пункт контекстного меню при установке расширения
chrome.runtime.onInstalled.addListener(() => {
  // First remove existing menu if it exists
  chrome.contextMenus.removeAll(() => {
    // Then create new one
    chrome.contextMenus.create({
      id: "addToFavorites",
      title: "Add to Favorites ⭐",
      contexts: ["all"],
      documentUrlPatterns: ["https://chat.deepseek.com/*"]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error creating context menu:', chrome.runtime.lastError);
      } else {
        console.log('Context menu created successfully');
      }
    });
  });
});

// Слушаем сообщения от content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "contentScriptReady") {
    console.log('Content script is ready in tab:', sender.tab.id);
    sendResponse({ status: 'acknowledged' });
  }
});

// Обработчик клика по пункту меню
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "addToFavorites") {
    console.log('Context menu clicked:', info, tab);
    
    try {
      // Проверяем, загружен ли content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "addToFavorites",
        selectionText: info.selectionText || ''
      });
      
      console.log('Message sent successfully:', response);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Если content script не загружен, перезагружаем страницу и пробуем снова
      try {
        await chrome.tabs.reload(tab.id);
        // Ждем 2 секунды после перезагрузки
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const retryResponse = await chrome.tabs.sendMessage(tab.id, {
          action: "addToFavorites",
          selectionText: info.selectionText || ''
        });
        
        console.log('Retry message sent successfully:', retryResponse);
      } catch (retryError) {
        console.error('Error on retry:', retryError);
      }
    }
  }
}); 