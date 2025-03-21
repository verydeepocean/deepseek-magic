## Механизм полной перезагрузки расширения при импорте JSON файла

Процесс перезагрузки расширения при импорте JSON файла реализован через следующие ключевые методы и механизмы:

### 1. Инициирование импорта

Импорт начинается в функции `handleImportData()` в файле `popup.js`, которая:
- Создает элемент выбора файла
- Считывает выбранный JSON файл
- Парсит JSON и проверяет его структуру
- Вызывает метод `importAllData()` объекта `dataExporter`

### 2. Сохранение данных перед перезагрузкой

Метод `importAllData(data)` в классе `DataExporter` (файл `db.js`):
- Создает временную базу данных IndexedDB с именем 'tempImportDB'
- Сохраняет импортируемые данные в этой временной базе данных
- Использует ключ 'pendingImport' для хранения данных
- После успешного сохранения данных вызывает метод `chrome.runtime.reload()`

```javascript
console.log('Import data saved successfully, reloading extension...');
chrome.runtime.reload();
```

### 3. Перезагрузка расширения

Метод `chrome.runtime.reload()` - это API Chrome Extensions, который:
- Полностью перезагружает расширение
- Останавливает все скрипты расширения
- Заново инициализирует все компоненты расширения
- Запускает фоновые скрипты и другие компоненты заново

### 4. Обработка импорта после перезагрузки

После перезагрузки расширения:
- Функция `initialize()` в `popup.js` вызывается при загрузке popup
- Она вызывает метод `handlePendingImport()` объекта `dataExporter`

```javascript
async function initialize() {
  console.log('Initializing popup...');
  // Проверяем наличие отложенного импорта
  try {
    await dataExporter.handlePendingImport();
  } catch (error) {
    console.error('Error handling pending import:', error);
  }
  // ...
}
```

### 5. Применение импортированных данных

Метод `handlePendingImport()` в классе `DataExporter` (файл `db.js`):
- Проверяет наличие временной базы данных 'tempImportDB'
- Извлекает сохраненные данные по ключу 'pendingImport'
- Инициализирует основные базы данных расширения
- Очищает существующие данные
- Импортирует новые данные в соответствующие хранилища
- Удаляет временную базу данных после успешного импорта

## Ключевые методы

1. **`chrome.runtime.reload()`** - API Chrome для полной перезагрузки расширения
2. **`importAllData(data)`** - метод для сохранения данных во временное хранилище перед перезагрузкой
3. **`handlePendingImport()`** - метод для обработки отложенного импорта после перезагрузки
4. **`indexedDB.open('tempImportDB', 1)`** - создание временной базы данных для хранения данных между перезагрузками

## Процесс в целом

1. Пользователь выбирает JSON файл для импорта
2. Данные из файла парсятся и проверяются
3. Данные сохраняются во временную базу данных IndexedDB
4. Расширение полностью перезагружается через `chrome.runtime.reload()`
5. После перезагрузки проверяется наличие отложенного импорта
6. Если отложенный импорт найден, данные извлекаются из временной базы данных
7. Существующие данные очищаются, и новые данные импортируются
8. Временная база данных удаляется

Этот механизм обеспечивает полную перезагрузку расширения с сохранением данных для импорта, что позволяет избежать конфликтов и обеспечить чистое состояние расширения после импорта.