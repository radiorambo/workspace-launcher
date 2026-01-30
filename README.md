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
  - **Bookmark Folders**: Opens all bookmarks from a Chrome/Brave bookmarks folder.
- **Workspace Management**: Add, edit, and delete workspaces directly from the CLI.
- **TOML Configuration**: Simple and portable configuration file.

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
   chmod +x workspace-launcher.js
   ```

3. **(Optional) Create a symlink**:
   ```bash
   sudo ln -s $(pwd)/workspace-launcher.js /usr/local/bin/wl
   ```

## 🚀 Usage

### Interactive Menu

Simply run the script to see the main menu:

```bash
./workspace-launcher.js
# or
bun run start
# or if symlinked
wl
```

### CLI Arguments

You can also bypass the menu using command-line arguments:

- **Launch workspaces**: `wl launch` (supports multiple: `wl launch 1,3,5` or `wl launch 1-3,5`)
- **Add a workspace**: `wl add`
- **Delete a workspace**: `wl delete`
- **View version**: `wl --version`
- **View help**: `wl --help`

### Dry Run Mode

Preview what commands will be executed without actually running them:

```bash
wl launch --dry-run
```

### Verbose Mode

See full command output instead of quiet mode:

```bash
wl launch -v
```

## ⚙️ Configuration

The workspaces are stored in `config.toml` in the `~/.config/workspace-launcher/` directory.

On first run, if no config exists, the tool will automatically copy from `config.example.toml`.

### Example Configuration

```toml
[settings]
# Path to your browser's bookmarks file (supports environment variables)
bookmarks_file = "${HOME}/.config/BraveSoftware/Brave-Browser/Default/Bookmarks"
bookmarks_open_in_browser = "flatpak run com.brave.Browser --profile-directory=Default --new-window"

[[workspaces]]
id = 1
name = "Web Development"
commands = [
  "flatpak run com.brave.Browser --profile-directory=Default --new-window https://github.com",
  "code ~/projects/my-app",
]

[[workspaces]]
id = 2
name = "Reading List"
bookmarks_folder = "Bookmarks bar/Reading"
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
