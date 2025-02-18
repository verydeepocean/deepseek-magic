# DeepSeek Favorites - Chrome Extension

A powerful Chrome extension designed specifically for DeepSeek users to manage and organize their chat conversations. This extension enhances your DeepSeek experience by allowing you to save, organize, and summarize your chat interactions using various AI providers including OpenRouter and Google AI.

## Overview

This extension integrates with DeepSeek's chat interface to provide additional functionality for managing your conversations. It allows you to save important chats, generate summaries, and organize your interactions in a more efficient way.

## Features

- **DeepSeek Integration**
  - Seamlessly works with DeepSeek's chat interface
  - Save and manage your DeepSeek chat conversations
  - Generate summaries of your DeepSeek chats
  - Export and import your favorite DeepSeek conversations

- **Multi-Provider Support**
  - OpenRouter API integration with models:
    - gemini-2.0-flash-001
    - DeepSeek-V3
    - GPT-4o mini
    - The Meta Llama 3.3
  - Google AI API integration with models:
    - gemini-2.0-flash-001
    - gemini-2.0-flash-lite-preview-02-05
    - gemini-2.0-pro-exp-02-05
    - gemini-2.0-flash-thinking-exp-01-21
    - gemini-2.0-flash-exp

- **Chat Management**
  - Save favorite chat conversations
  - Organize chats with titles and descriptions
  - Generate AI-powered summaries of chat conversations
  - Copy chat content to clipboard
  - Filter and search through saved chats

- **Prompt Library**
  - Save and organize frequently used prompts
  - Tag-based organization system
  - Quick search and filtering
  - Pin important prompts

- **User Interface**
  - Clean and modern design
  - Light/Dark theme support
  - Responsive layout
  - Intuitive settings management

- **Data Management**
  - Export/Import functionality for backup
  - Local storage for chat history
  - Sync storage for settings and favorites
  - Secure API key management

## Installation

### Prerequisites
- Google Chrome browser
- Active DeepSeek account and access to DeepSeek chat interface
- API key from OpenRouter or Google AI (for summary generation)

### Steps
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. Navigate to DeepSeek chat interface to start using the extension

### Note
This extension only works with the DeepSeek chat interface. It will not function with other chat applications or websites.

## Configuration

1. Click the extension icon and open Settings (⚙️)
2. Choose your preferred AI provider (OpenRouter or Google AI)
3. Enter your API key for the selected provider
4. Select your preferred model
5. Customize the summary prompt template if needed
6. Save your settings

## Usage

### Working with DeepSeek Chats
- During your chat sessions in DeepSeek, use the extension to save interesting conversations
- Click the extension icon to access your saved chats
- View, edit, and organize your saved DeepSeek conversations
- Generate AI-powered summaries of your chats using OpenRouter or Google AI
- Export your favorite conversations for backup or sharing

### Managing Chat History
- Click on any saved DeepSeek chat to view its content
- Use the "Generate Summary" button to create AI-powered summaries
- Edit chat titles and descriptions for better organization
- Search through your saved DeepSeek chats
- Delete unwanted conversations

### Working with Prompts
- Save and organize your favorite DeepSeek prompts
- Tag prompts for easy categorization
- Use the search function to find specific prompts
- Pin your most-used DeepSeek prompts for quick access
- Edit and delete prompts as needed

### Settings and Customization
- Switch between light and dark themes
- Configure API providers and models
- Customize summary generation
- Export/Import your data for backup

## Development

The extension is built using vanilla JavaScript and Chrome Extension APIs. Key files:

- `popup.js` - Main extension logic
- `chat-viewer.js` - Chat history viewer functionality
- `content.js` - Content script for page interaction
- `background.js` - Background service worker
- `popup.html/css` - Extension UI

## Security

- API keys are stored securely in Chrome's sync storage
- No sensitive data is transmitted except to the configured AI providers
- All communication with AI providers is done via HTTPS

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Thanks to OpenRouter and Google AI for providing the AI models
- Built with Chrome Extension APIs
- Inspired by the need for better AI chat management 