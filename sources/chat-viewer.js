// Функция для загрузки чанков и восстановления данных
async function loadChatContent(chatId) {
  try {
    // Загружаем метаданные о чанках
    const meta = await new Promise((resolve, reject) => {
      chrome.storage.local.get([`${chatId}_meta`], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[`${chatId}_meta`]);
        }
      });
    });

    if (!meta) {
      throw new Error('Chat content not found');
    }

    // Загружаем все чанки
    const chunkKeys = Array.from({ length: meta.chunks }, (_, i) => `${chatId}_chunk_${i}`);
    const chunks = await new Promise((resolve, reject) => {
      chrome.storage.local.get(chunkKeys, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(Object.values(result));
        }
      });
    });

    // Собираем чанки обратно в строку и парсим JSON
    const serialized = chunks.join('');
    return JSON.parse(serialized);
  } catch (error) {
    console.error('Error loading chat content:', error);
    throw error;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const chatContent = document.getElementById('chatContent');
  const copyBtn = document.querySelector('.copy-btn');
  const generateSummaryBtn = document.querySelector('.generate-summary-btn');
  const themeToggle = document.querySelector('.theme-toggle');
  const title = document.querySelector('.title');
  
  // Получаем параметры URL
  const urlParams = new URLSearchParams(window.location.search);
  const timestamp = urlParams.get('id');
  
  // Конфигурация Google API
  const GOOGLE_API_KEY = 'YOUR_API_KEY'; // Нужно будет заменить на реальный ключ
  const GOOGLE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
  
  // Функция для генерации summary
  async function generateSummary() {
    try {
      // Получаем все сообщения чата
      const chatMessages = document.querySelectorAll('.chat-message');
      if (!chatMessages.length) {
        throw new Error('No chat messages found');
      }

      // Собираем весь текст чата
      const chatText = Array.from(chatMessages)
        .map(msg => {
          const role = msg.classList.contains('user-message') ? 'User' : 'Assistant';
          const content = msg.querySelector('.message-content').textContent.trim();
          return `${role}: ${content}`;
        })
        .join('\n\n');

      // Получаем настройки
      const settings = await new Promise(resolve => {
        chrome.storage.sync.get(['settings'], result => {
          resolve(result.settings || {
            provider: 'openrouter',
            apiKeys: { openrouter: '', google: '' },
            model: 'openai/gpt-4-turbo-preview',
            summaryPrompt: 'Please generate a concise summary of this chat conversation in 2-3 sentences: {text}'
          });
        });
      });

      if (!settings.apiKeys || !settings.apiKeys[settings.provider]) {
        throw new Error('API key not found. Please add it in Settings.');
      }

      const apiKey = settings.apiKeys[settings.provider];

      // Показываем состояние загрузки
      const generateSummaryBtn = document.querySelector('.generate-summary-btn');
      generateSummaryBtn.disabled = true;
      generateSummaryBtn.classList.add('loading');
      generateSummaryBtn.innerHTML = '⌛ Generating...';

      let response;
      let summary;

      if (settings.provider === 'google') {
        // Используем Google AI API
        const apiVersion = 'v1beta';
        const modelId = settings.model;
        
        response = await fetch(`https://generativelanguage.googleapis.com/${apiVersion}/models/${modelId}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: settings.summaryPrompt.replace('{text}', chatText)
              }]
            }]
          })
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('Google AI API error:', error);
          throw new Error(error.error?.message || 'Failed to generate summary');
        }

        const data = await response.json();
        console.log('Google AI API response:', data);

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
          console.error('Invalid Google AI response format:', data);
          throw new Error('Invalid response format from Google AI');
        }

        const content = data.candidates[0].content;
        if (!content.parts || !content.parts[0] || !content.parts[0].text) {
          console.error('Missing text in Google AI response:', content);
          throw new Error('No text generated from Google AI');
        }

        summary = content.parts[0].text;
      } else {
        // Используем OpenRouter API
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://github.com/your-username/deepseek-favorites',
            'X-Title': 'DeepSeek Favorites Extension'
          },
          body: JSON.stringify({
            model: settings.model,
            messages: [
              {
                role: 'user',
                content: settings.summaryPrompt.replace('{text}', chatText)
              }
            ]
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to generate summary');
        }

        const data = await response.json();
        console.log('API Response:', data);

        if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
          throw new Error('Invalid API response format: missing or empty choices array');
        }

        const firstChoice = data.choices[0];
        if (!firstChoice || !firstChoice.message || !firstChoice.message.content) {
          throw new Error('Invalid API response format: missing message content');
        }

        summary = firstChoice.message.content;
      }

      // Обновляем контейнер summary
      const summaryContainer = document.getElementById('summaryContainer');
      summaryContainer.innerHTML = `
        <div class="summary-title">Summary:</div>
        <div class="summary-content">${summary}</div>
      `;
      summaryContainer.classList.add('has-summary');

      // Получаем timestamp из URL
      const urlParams = new URLSearchParams(window.location.search);
      const timestamp = urlParams.get('id');

      // Сохраняем summary в локальное хранилище и в избранное
      await Promise.all([
        // Сохраняем в локальное хранилище
        new Promise(resolve => {
          chrome.storage.local.set({
            [`${timestamp}_summary`]: summary
          }, resolve);
        }),
        // Обновляем в избранном
        new Promise(resolve => {
          chrome.storage.sync.get(['favorites'], (result) => {
            const favorites = result.favorites || [];
            const updatedFavorites = favorites.map(f => {
              if (f.timestamp === timestamp) {
                // Очищаем описание от возможных дубликатов
                const descriptions = summary.split('\n').map(d => d.trim()).filter(Boolean);
                const cleanDescription = [...new Set(descriptions)].join('\n');
                return { ...f, description: cleanDescription };
              }
              return f;
            });

            chrome.storage.sync.set({ favorites: updatedFavorites }, resolve);
          });
        })
      ]);

      // Копируем summary в буфер обмена
      await navigator.clipboard.writeText(summary);

      // Отправляем сообщение в popup для обновления описания
      chrome.runtime.sendMessage({
        action: 'updateDescription',
        timestamp: timestamp,
        description: summary
      });

      // Обновляем описание в родительском окне, если оно существует
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          action: 'updateDescription',
          timestamp: timestamp,
          description: summary
        }, '*');
      }

      // Показываем уведомление об успехе
      showNotification('Summary generated, saved as description and copied to clipboard!');

    } catch (error) {
      console.error('Error generating summary:', error);
      showNotification(error.message || 'Failed to generate summary. Please try again.', true);
    } finally {
      // Возвращаем кнопку в исходное состояние
      const generateSummaryBtn = document.querySelector('.generate-summary-btn');
      generateSummaryBtn.disabled = false;
      generateSummaryBtn.classList.remove('loading');
      generateSummaryBtn.innerHTML = '📝 Generate Summary';
    }
  }

  // Функция для установки темы
  function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    chrome.storage.sync.set({ theme });
  }

  // Загружаем сохраненную тему
  chrome.storage.sync.get(['theme'], (result) => {
    const savedTheme = result.theme || 'light';
    setTheme(savedTheme);
  });

  // Переключение темы
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    setTheme(currentTheme === 'light' ? 'dark' : 'light');
  });

  // Функция для экранирования HTML
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Загружаем данные чата
  try {
    const metaResult = await new Promise(resolve => {
      chrome.storage.local.get([`${timestamp}_meta`], resolve);
    });

    if (metaResult[`${timestamp}_meta`]) {
      const meta = metaResult[`${timestamp}_meta`];
      const chunks = [];
      
      // Загружаем все чанки
      for (let i = 0; i < meta.chunks; i++) {
        const key = `${timestamp}_chunk_${i}`;
        const chunk = await new Promise(resolve => {
          chrome.storage.local.get([key], result => resolve(result[key]));
        });
        chunks.push(chunk);
      }
      
      // Собираем и парсим содержимое
      const chatData = JSON.parse(chunks.join(''));
      
      // Получаем заголовок чата и восстанавливаем summary
      chrome.storage.sync.get(['favorites'], (result) => {
        const favorite = result.favorites.find(f => f.timestamp === timestamp);
        if (favorite) {
          title.textContent = `Chat History: ${favorite.title}`;
          document.title = favorite.title;

          // Восстанавливаем summary если он есть
          if (favorite.description) {
            const summaryContainer = document.getElementById('summaryContainer');
            summaryContainer.innerHTML = `
              <div class="summary-title">Summary:</div>
              <div class="summary-content">${favorite.description}</div>
            `;
            summaryContainer.classList.add('has-summary');
          }
        }
      });
      
      // Отображаем содержимое чата с сохранением HTML
      const chatHtml = chatData.map(message => {
        return `
          <div class="chat-message ${message.type === 'question' ? 'user-message' : 'assistant-message'}">
            <div class="message-header">${message.type === 'question' ? '<strong>User:</strong>' : '<strong>Assistant:</strong>'}</div>
            <div class="message-content">${message.html || message.content}</div>
          </div>
        `;
      }).join('');

      chatContent.innerHTML = chatHtml;

      // Обработчик копирования
      copyBtn.addEventListener('click', () => {
        const textToCopy = chatData.map(message => {
          const role = message.type === 'question' ? 'User' : 'Assistant';
          return `${role}:\n${message.content}\n`;
        }).join('\n');

        navigator.clipboard.writeText(textToCopy).then(() => {
          const originalText = copyBtn.innerHTML;
          copyBtn.innerHTML = '✅ Copied!';
          setTimeout(() => {
            copyBtn.innerHTML = originalText;
          }, 2000);
        }).catch(err => {
          console.error('Failed to copy text: ', err);
          copyBtn.innerHTML = '❌ Error';
          setTimeout(() => {
            copyBtn.innerHTML = originalText;
          }, 2000);
        });
      });

      // Добавляем обработчик для кнопки генерации summary
      generateSummaryBtn.addEventListener('click', generateSummary);
    } else {
      chatContent.innerHTML = '<div class="chat-container"><p>No chat history available</p></div>';
      copyBtn.style.display = 'none';
      generateSummaryBtn.style.display = 'none';
    }
  } catch (error) {
    console.error('Error loading chat:', error);
    chatContent.innerHTML = '<div class="chat-container"><p>Error loading chat history</p></div>';
    copyBtn.style.display = 'none';
    generateSummaryBtn.style.display = 'none';
  }

  // Функция для показа уведомлений
  function showNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.className = `notification ${isError ? 'error' : 'success'}`;
    
    document.body.appendChild(notification);
    
    // Анимация появления
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);
    
    // Удаление через 3 секунды
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Обработчики для кнопок копирования
  function showCopyButton(copyBtn) {
    copyBtn.classList.remove('hidden');
    copyBtn.classList.add('visible');
  }

  function hideCopyButton(copyBtn) {
    copyBtn.classList.remove('visible');
    copyBtn.classList.add('hidden');
  }

  // Добавляем слушатель сообщений от других окон
  window.addEventListener('message', (event) => {
    if (event.data.action === 'updateDescription') {
      const editForm = document.querySelector('.edit-form');
      if (editForm) {
        const descriptionTextarea = editForm.querySelector('.edit-description');
        if (descriptionTextarea) {
          descriptionTextarea.value = event.data.description;
        }
      }
    }
  });
}); 