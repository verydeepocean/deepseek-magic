# Реализация уведомлений в расширении DeepSeek Favorites

## Основные компоненты

### 1. Файловая структура
- `manifest.json` - конфигурация расширения
- `background.js` - фоновый скрипт для обработки контекстного меню
- `content.js` - скрипт для внедрения на страницу и показа уведомлений
- `popup.js` и `popup.html` - интерфейс всплывающего окна
- `main.css` - стили для всплывающего окна

### 2. Процесс работы

#### Инициализация
1. `manifest.json` определяет:
   - Необходимые разрешения: storage, contextMenus, tabs, activeTab
   - Content script для страниц chat.deepseek.com
   - Background script
   - Popup интерфейс

2. `background.js`:
   - Создает пункт контекстного меню "Add to Favorites ⭐"
   - Обрабатывает клики по меню
   - Отправляет сообщения в content.js

3. `content.js`:
   - Инициализирует стили уведомлений
   - Реализует функцию showNotification
   - Обрабатывает добавление в избранное
   - Сохраняет данные в chrome.storage

4. `main.js` и `popup.html`:
   - Отображают список избранных чатов
   - Имеют собственную реализацию уведомлений
   - Обновляют список при изменениях

## Реализация уведомлений

### CSS стили
```css
.deepseek-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 12px 24px;
  border-radius: 4px;
  font-size: 14px;
  z-index: 2147483647;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.3s ease, transform 0.3s ease;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  max-width: 300px;
  word-wrap: break-word;
  pointer-events: none;
}

.deepseek-notification.success {
  background: #198754;
  color: white;
}

.deepseek-notification.error {
  background: #dc3545;
  color: white;
}

.deepseek-notification.show {
  opacity: 1;
  transform: translateY(0);
}
```

### JavaScript функция показа уведомлений
```javascript
function showNotification(message, isError = false) {
  // Удаляем существующие уведомления
  const existingNotifications = document.querySelectorAll('.deepseek-notification');
  existingNotifications.forEach(notification => notification.remove());

  const notification = document.createElement('div');
  notification.className = `deepseek-notification ${isError ? 'error' : 'success'}`;
  
  // Разделяем заголовок и текст сообщения
  const [title, text] = message.split('\n');
  notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 4px;">${title}</div>
    ${text ? `<div style="font-size: 12px; opacity: 0.9;">${text}</div>` : ''}
  `;
  
  document.documentElement.appendChild(notification);
  
  // Анимация появления
  requestAnimationFrame(() => {
    notification.classList.add('show');
  });
  
  // Удаление через 3 секунды для обычных уведомлений и 5 секунд для ошибок
  const duration = isError ? 5000 : 3000;
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, duration);
}
```

### Использование

1. Успешное добавление в избранное:
```javascript
showNotification(`Added to Favorites! ⭐\n"${chatTitle}"`, false);
```

2. Чат уже в избранном:
```javascript
showNotification(`Already in Favorites! 🔔\n"${chatTitle}"`, true);
```

3. Ошибка при сохранении:
```javascript
showNotification('Error saving to favorites! ❌', true);
```

## Характеристики уведомлений

1. Позиционирование:
   - Правый нижний угол экрана
   - Фиксированное положение

2. Анимация:
   - Плавное появление (slide up)
   - Плавное исчезновение
   - Transition эффекты для opacity и transform

3. Стилизация:
   - Успех: зеленый фон (#198754)
   - Ошибка: красный фон (#dc3545)
   - Белый текст
   - Тень для объемности
   - Скругленные углы

4. Поведение:
   - Автоматическое исчезновение через 3-5 секунд
   - Только одно уведомление одновременно
   - Поддержка заголовка и описания
   - Без возможности взаимодействия (pointer-events: none) 



## Полная реализация системы уведомлений в коде. Для этого нужно три основных компонента:

1. **CSS стили** (добавляются в начале работы расширения):
```javascript
// В content.js
(function initializeNotifications() {
  const notificationStyles = document.createElement('style');
  notificationStyles.textContent = `
    .deepseek-notification {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 24px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 2147483647;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.3s ease, transform 0.3s ease;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      max-width: 300px;
      word-wrap: break-word;
      pointer-events: none;
    }

    .deepseek-notification.success {
      background: #198754;
      color: white;
    }

    .deepseek-notification.error {
      background: #dc3545;
      color: white;
    }

    .deepseek-notification.show {
      opacity: 1;
      transform: translateY(0);
    }
  `;
  document.documentElement.appendChild(notificationStyles);
})();
```

2. **Функция показа уведомлений**:
```javascript
// В content.js
function showNotification(message, isError = false) {
  // Удаляем существующие уведомления
  const existingNotifications = document.querySelectorAll('.deepseek-notification');
  existingNotifications.forEach(notification => notification.remove());

  // Создаем новое уведомление
  const notification = document.createElement('div');
  notification.className = `deepseek-notification ${isError ? 'error' : 'success'}`;
  
  // Разделяем заголовок и текст сообщения
  const [title, text] = message.split('\n');
  notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 4px;">${title}</div>
    ${text ? `<div style="font-size: 12px; opacity: 0.9;">${text}</div>` : ''}
  `;
  
  // Добавляем уведомление на страницу
  document.documentElement.appendChild(notification);
  
  // Анимация появления
  requestAnimationFrame(() => {
    notification.classList.add('show');
  });
  
  // Автоматическое удаление
  const duration = isError ? 5000 : 3000;
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, duration);
}
```

3. **Использование в коде** (примеры из разных частей приложения):
```javascript
// В content.js при добавлении в избранное
async function addToFavorites(chatTitle, messageText = '') {
  try {
    const chatContent = await getChatContent();
    const favorite = {
      title: chatTitle.slice(0, 200),
      url: window.location.href,
      timestamp: new Date().toISOString(),
      description: messageText.slice(0, 500) || '',
      hasContent: true
    };
    
    // Проверяем, нет ли уже такого чата в избранном
    chrome.storage.sync.get(['favorites'], async (result) => {
      const favorites = result.favorites || [];
      
      if (!favorites.some(f => f.url === favorite.url)) {
        // Добавляем новый чат
        favorites.push(favorite);
        chrome.storage.sync.set({ favorites }, () => {
          showNotification(`Added to Favorites! ⭐\n"${chatTitle}"`, false);
        });
      } else {
        // Чат уже в избранном
        showNotification(`Already in Favorites! 🔔\n"${chatTitle}"`, true);
      }
    });
  } catch (error) {
    // Обработка ошибки
    console.error('Error adding to favorites:', error);
    showNotification('Error saving to favorites! ❌', true);
  }
}

// В popup.js при сохранении настроек
function saveSettings() {
  try {
    // Сохранение настроек
    chrome.storage.sync.set({ settings: newSettings }, () => {
      showNotification('Settings saved successfully! 🎉');
    });
  } catch (error) {
    showNotification('Failed to save settings. Please try again.', true);
  }
}

// В других местах приложения
function handleImport() {
  try {
    // Импорт данных
    showNotification('Data imported successfully! 📥');
  } catch (error) {
    showNotification('Error importing data! Please try again. ❌', true);
  }
}
```

Этот код создает полную систему уведомлений, которая:
1. Показывает уведомления в правом нижнем углу
2. Поддерживает успешные (зеленые) и ошибочные (красные) уведомления
3. Имеет анимации появления и исчезновения
4. Автоматически удаляется через заданное время
5. Поддерживает заголовок и описание
6. Гарантирует, что на экране всегда только одно уведомление

Все уведомления создаются единообразно и следуют одному стилю, что обеспечивает консистентный пользовательский опыт во всем приложении.
