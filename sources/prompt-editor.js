document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('backBtn');
  const saveBtn = document.getElementById('saveBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const promptTitle = document.getElementById('promptTitle');
  const promptText = document.getElementById('promptText');
  const promptTags = document.getElementById('promptTags');
  const lightThemeBtn = document.getElementById('lightTheme');
  const darkThemeBtn = document.getElementById('darkTheme');

  // Получаем ID промпта из URL, если он есть
  const urlParams = new URLSearchParams(window.location.search);
  const promptId = urlParams.get('id');
  let currentPrompt = null;

  // Загружаем промпт для редактирования, если есть ID
  if (promptId) {
    chrome.storage.sync.get(['prompts'], (result) => {
      const prompts = result.prompts || [];
      currentPrompt = prompts.find(p => p.id === promptId);
      
      if (currentPrompt) {
        promptTitle.value = currentPrompt.title || '';
        promptText.value = currentPrompt.text || '';
        promptTags.value = (currentPrompt.tags || []).join(' ');
      }
    });
  }

  // Добавляем стили
  const globalStyle = document.createElement('style');
  globalStyle.textContent = `
    :root {
      --bg-color: #f8f9fa;
      --text-color: #1a1a1a;
      --border-color: #e9ecef;
      --btn-bg: white;
      --btn-color: #495057;
      --btn-border: #dee2e6;
      --btn-hover-bg: #f8f9fa;
      --btn-hover-border: #ced4da;
      --description-color: #6c757d;
      --shadow-color: rgba(0,0,0,0.05);
    }

    [data-theme="dark"] {
      --bg-color: #212529;
      --text-color: #f8f9fa;
      --border-color: #343a40;
      --btn-bg: #343a40;
      --btn-color: #e9ecef;
      --btn-border: #495057;
      --btn-hover-bg: #495057;
      --btn-hover-border: #6c757d;
      --description-color: #adb5bd;
      --shadow-color: rgba(0,0,0,0.2);
    }

    body {
      min-width: 350px;
      max-width: 800px;
      width: auto;
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: var(--bg-color);
      color: var(--text-color);
      transition: all 0.3s ease;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 2px solid var(--border-color);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .back-btn {
      padding: 8px 12px;
      border: 1px solid var(--btn-border);
      border-radius: 4px;
      background: var(--btn-bg);
      color: var(--btn-color);
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s ease;
    }

    .back-btn:hover {
      background: var(--btn-hover-bg);
      border-color: var(--btn-hover-border);
    }

    h1 {
      font-size: 18px;
      margin: 0;
      color: var(--text-color);
    }

    .theme-btn {
      width: 28px;
      height: 28px;
      padding: 0;
      border-radius: 4px;
      border: 1px solid var(--btn-border);
      background: var(--btn-bg);
      color: var(--btn-color);
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
    }

    .theme-btn:hover {
      background: var(--btn-hover-bg);
      border-color: var(--btn-hover-border);
    }

    .theme-btn.active {
      background: var(--btn-hover-bg);
      border-color: var(--btn-hover-border);
      box-shadow: inset 0 2px 4px var(--shadow-color);
    }

    .editor-container {
      padding: 16px;
      background: var(--btn-bg);
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      color: var(--text-color);
      font-size: 14px;
    }

    .form-group input,
    .form-group textarea {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--bg-color);
      color: var(--text-color);
      font-size: 14px;
      box-sizing: border-box;
    }

    .form-group textarea {
      resize: vertical;
      min-height: 200px;
    }

    .form-group input:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #0d6efd;
      box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.15);
    }

    .button-group {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 20px;
    }

    .btn {
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-primary {
      background: #0d6efd;
      color: white;
      border: none;
    }

    .btn-primary:hover {
      background: #0b5ed7;
    }

    .btn-secondary {
      background: var(--btn-bg);
      color: var(--btn-color);
      border: 1px solid var(--btn-border);
    }

    .btn-secondary:hover {
      background: var(--btn-hover-bg);
      border-color: var(--btn-hover-border);
    }
  `;
  document.head.appendChild(globalStyle);

  // Функция сохранения промпта
  function savePrompt() {
    const title = promptTitle.value.trim();
    const text = promptText.value.trim();
    const tags = promptTags.value.trim().split(/\s+/).filter(tag => tag.length > 0);

    if (!title || !text) {
      alert('Пожалуйста, заполните название и текст промпта');
      return;
    }

    chrome.storage.sync.get(['prompts'], (result) => {
      const prompts = result.prompts || [];
      
      if (promptId && currentPrompt) {
        // Обновляем существующий промпт, сохраняя состояние закрепления
        const updatedPrompts = prompts.map(p => {
          if (p.id === promptId) {
            return {
              ...p,
              title,
              text,
              tags,
              updatedAt: new Date().toISOString(),
              pinned: p.pinned || false // Сохраняем состояние закрепления
            };
          }
          return p;
        });
        
        chrome.storage.sync.set({ prompts: updatedPrompts }, () => {
          window.close();
        });
      } else {
        // Создаем новый промпт
        const newPrompt = {
          id: Date.now().toString(),
          title,
          text,
          tags,
          createdAt: new Date().toISOString(),
          pinned: false // Новые промпты по умолчанию не закреплены
        };
        
        prompts.push(newPrompt);
        chrome.storage.sync.set({ prompts }, () => {
          window.close();
        });
      }
    });
  }

  // Функция установки темы
  function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    chrome.storage.sync.set({ theme });
    
    // Обновляем активную кнопку
    lightThemeBtn.classList.toggle('active', theme === 'light');
    darkThemeBtn.classList.toggle('active', theme === 'dark');
  }

  // Загружаем сохраненную тему
  chrome.storage.sync.get(['theme'], (result) => {
    const savedTheme = result.theme || 'light';
    setTheme(savedTheme);
  });

  // Обработчики событий
  saveBtn.addEventListener('click', savePrompt);
  cancelBtn.addEventListener('click', () => window.close());
  backBtn.addEventListener('click', () => window.close());
  lightThemeBtn.addEventListener('click', () => setTheme('light'));
  darkThemeBtn.addEventListener('click', () => setTheme('dark'));

  // Обработчик клавиш
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.close();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      savePrompt();
    }
  });
}); 