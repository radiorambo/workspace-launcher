# Workspace Launcher

A powerful, interactive CLI tool built with Bun.js to streamline your workflow. Launch multiple "workspaces" including websites, PWA apps, PDFs, and system applications—with a single command.

## 🚀 Features

- **Interactive Menu**: Easy-to-use CLI interface for launching and managing workspaces.
- **Multi-Workspace Support**: Define different workspaces (e.g., "Web Development", "Data Science", "Language Learning").
- **Diverse Resource Types**:
  - **Websites**: Opens multiple URLs in a new Brave browser window.
  - **PWA Apps**: Launches Progressive Web Apps using Brave's app-id.
  - **Website Apps**: Launches any website in "app mode" (no address bar/tabs).
  - **PDFs**: Opens PDF files at specific pages using GNOME Papers (Evince).
  - **System Apps**: Executes any shell command to launch local applications (IDE, Terminal, etc.).
- **Workspace Management**: Add and delete workspaces directly from the CLI.
- **JSON Configuration**: Simple and portable configuration file.

## 🛠️ Prerequisites

- **[Bun.js](https://bun.sh/)**: The fast JavaScript runtime.
- **[Brave Browser](https://brave.com/)**: Used for launching websites and PWAs (installed via Flatpak).
- **[GNOME Papers (Evince)](https://apps.gnome.org/Papers/)**: Used for opening PDFs (installed via Flatpak).
- **Linux OS**: Currently optimized for Linux environments using Flatpak.

## 📦 Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/yourusername/workspace-launcher.git
   cd workspace-launcher
   ```

2. **Make the script executable**:

   ```bash
   chmod +x daily-learning.js
   ```

3. **(Optional) Create a symlink**:
   ```bash
   sudo ln -s $(pwd)/daily-learning.js /usr/local/bin/launch-workspace
   ```

## 🚀 Usage

### Interactive Menu

Simply run the script to see the main menu:

```bash
./daily-learning.js
```

### CLI Arguments

You can also bypass the menu using command-line arguments:

- **Launch workspaces**: `./daily-learning.js launch`
- **Add a workspace**: `./daily-learning.js add`
- **Delete a workspace**: `./daily-learning.js delete`
- **Help**: `./daily-learning.js --help`

## ⚙️ Configuration

The workspaces are stored in `workspaces-config.json` in the same directory as the script.

### Example Configuration

```json
{
  "workspaces": [
    {
      "id": 1,
      "name": "Web Development",
      "websites": ["https://developer.mozilla.org", "https://reactjs.org"],
      "pwaApps": [
        { "name": "Excalidraw", "id": "phemneclclhpndemkenfobkbjonpnmhd" }
      ],
      "websiteApps": [{ "name": "ChatGPT", "url": "https://chat.openai.com" }],
      "pdfs": [
        { "name": "React Docs", "path": "/path/to/react.pdf", "page": 10 }
      ],
      "systemApps": ["code .", "gnome-terminal"]
    }
  ]
}
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
