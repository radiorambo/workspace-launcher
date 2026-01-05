#!/usr/bin/env bun
/**
 * Workspace Launcher
 *
 * An interactive CLI tool to launch workspaces with custom commands.
 *
 * @author Zero
 * @version 0.3.0
 */

import { $ } from "bun";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, sep } from "path";

// Colors for terminal output
const colors = {
  green: "\x1b[0;32m",
  red: "\x1b[0;31m",
  yellow: "\x1b[1;33m",
  blue: "\x1b[0;34m",
  cyan: "\x1b[0;36m",
  reset: "\x1b[0m",
};

const print = {
  status: (msg) => console.log(`${colors.green}[✓]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[✗]${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.yellow}[i]${colors.reset} ${msg}`),
  workspace: (num, msg) =>
    console.log(`${colors.blue}[${num}]${colors.reset} ${msg}`),
  cyan: (msg) => console.log(`${colors.cyan}${msg}${colors.reset}`),
};

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG_DIR = join(
  process.env.XDG_CONFIG_HOME || join(process.env.HOME, ".config"),
  "workspace-launcher"
);
const CONFIG_PATH = join(CONFIG_DIR, "config.toml");

/**
 * Loads the workspace configuration from the TOML file.
 *
 * @returns {Object} The parsed configuration object.
 * @throws {Error} If the config file is not found.
 */
function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    print.error(`Config file not found: ${CONFIG_PATH}`);
    print.info(`Create directory and copy example config:`);
    console.log(`  mkdir -p ${CONFIG_DIR}`);
    console.log(`  cp workspaces-config.example.toml ${CONFIG_PATH}`);
    process.exit(1);
  }
  return Bun.TOML.parse(readFileSync(CONFIG_PATH, "utf-8"));
}

/**
 * Saves the workspace configuration to the TOML file.
 *
 * @param {Object} config - The configuration object to save.
 */
function saveConfig(config) {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, Bun.TOML.stringify(config));
  print.status("Configuration saved");
}

// ============================================================
// CHROME BOOKMARKS FUNCTIONS
// ============================================================

/**
 * Gets the Chrome bookmarks file path from config.
 *
 * @param {Object} config - The configuration object.
 * @returns {string|null} The path to the bookmarks file or null if not configured.
 */
function getBookmarksFilePath(config) {
  return config.settings?.bookmarks_file || null;
}

/**
 * Loads and parses the Chrome bookmarks file.
 *
 * @param {string} bookmarksPath - Path to the bookmarks file.
 * @returns {Object|null} The parsed bookmarks object or null if not found.
 */
function loadBookmarksFile(bookmarksPath) {
  if (!existsSync(bookmarksPath)) {
    print.error(`Bookmarks file not found: ${bookmarksPath}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(bookmarksPath, "utf-8"));
  } catch (error) {
    print.error(`Failed to parse bookmarks file: ${error.message}`);
    return null;
  }
}

/**
 * Finds a folder in the bookmarks structure by path.
 * Path format: "Bookmarks bar/folder1/subfolder" or "Other bookmarks/folder"
 *
 * @param {Object} bookmarks - The parsed bookmarks object.
 * @param {string} folderPath - The path to the folder (e.g., "Bookmarks bar/test").
 * @returns {Object|null} The folder object or null if not found.
 */
function findBookmarkFolder(bookmarks, folderPath) {
  const parts = folderPath.split("/").map((p) => p.trim());
  const roots = bookmarks.roots;

  // Map common names to root keys
  const rootMap = {
    "Bookmarks bar": roots.bookmark_bar,
    "bookmark_bar": roots.bookmark_bar,
    "Other bookmarks": roots.other,
    "other": roots.other,
    "Mobile bookmarks": roots.synced,
    "synced": roots.synced,
  };

  // Start from the appropriate root
  let current = rootMap[parts[0]];
  if (!current) {
    print.error(`Root folder not found: ${parts[0]}`);
    print.info("Available roots: Bookmarks bar, Other bookmarks, Mobile bookmarks");
    return null;
  }

  // Navigate through the path
  for (let i = 1; i < parts.length; i++) {
    if (!current.children) {
      print.error(`"${parts[i - 1]}" is not a folder`);
      return null;
    }

    const child = current.children.find(
      (c) => c.name === parts[i] && c.type === "folder"
    );

    if (!child) {
      print.error(`Folder not found: ${parts[i]} in ${parts.slice(0, i).join("/")}`);
      return null;
    }
    current = child;
  }

  return current;
}

/**
 * Extracts all URLs from a bookmark folder (including nested folders).
 *
 * @param {Object} folder - The bookmark folder object.
 * @param {boolean} recursive - Whether to include URLs from subfolders.
 * @returns {Array<{name: string, url: string}>} Array of bookmark objects.
 */
function extractUrlsFromFolder(folder, recursive = true) {
  const urls = [];

  if (!folder.children) return urls;

  for (const item of folder.children) {
    if (item.type === "url") {
      urls.push({ name: item.name, url: item.url });
    } else if (item.type === "folder" && recursive) {
      urls.push(...extractUrlsFromFolder(item, recursive));
    }
  }

  return urls;
}

/**
 * Gets all URLs from a bookmarks folder path.
 *
 * @param {string} bookmarksFilePath - Path to the bookmarks file.
 * @param {string} folderPath - Path to the folder within bookmarks.
 * @returns {Array<{name: string, url: string}>} Array of bookmark objects.
 */
function getBookmarksFromFolder(bookmarksFilePath, folderPath) {
  const bookmarks = loadBookmarksFile(bookmarksFilePath);
  if (!bookmarks) return [];

  const folder = findBookmarkFolder(bookmarks, folderPath);
  if (!folder) return [];

  return extractUrlsFromFolder(folder);
}

// ============================================================
// LAUNCHER FUNCTIONS
// ============================================================

/**
 * Launches all commands in a workspace.
 *
 * @param {Object} workspace - The workspace object to launch.
 * @param {Object} config - The configuration object.
 */
async function launchWorkspace(workspace, config) {
  console.log("");
  print.info(`Starting: ${workspace.name}`);
  console.log("");

  const commands = workspace.commands || [];
  for (const cmd of commands) {
    if (!cmd || cmd.trim().startsWith("#")) continue;

    try {
      await $`${cmd.split(" ")}`.nothrow().quiet();
      const displayName = cmd.length > 50 ? cmd.substring(0, 50) + "..." : cmd;
      print.status(`Launched: ${displayName}`);
    } catch (error) {
      print.error(`Failed to launch: ${cmd}`);
    }
  }

  // Handle bookmarks folder if specified
  if (workspace.bookmarks_folder) {
    const bookmarksPath = getBookmarksFilePath(config);
    
    if (!bookmarksPath) {
      print.error("Bookmarks file path not configured in settings");
      print.info("Add 'bookmarks_file' in [settings] section of config");
      return;
    }

    const bookmarks = getBookmarksFromFolder(bookmarksPath, workspace.bookmarks_folder);

    if (bookmarks.length > 0) {
      print.info(`Opening ${bookmarks.length} bookmark(s) from: ${workspace.bookmarks_folder}`);

      // Get browser command from config, fallback to xdg-open
      const browserCommand = config.settings?.bookmarks_open_in_browser || "xdg-open";
      
      // Split command and remove empty parts (handles multiple spaces)
      const commandParts = browserCommand.split(" ").filter((p) => p.trim() !== "");
      const isXdgOpen = commandParts[0].endsWith("xdg-open");

      try {
        if (isXdgOpen) {
          // xdg-open only supports one URL at a time
          for (const bookmark of bookmarks) {
            const fullCommand = [...commandParts, bookmark.url];
            await $`${fullCommand}`.nothrow().quiet();
            
            const displayName = bookmark.name.length > 40
              ? bookmark.name.substring(0, 40) + "..."
              : bookmark.name;
            print.status(`Opened: ${displayName}`);
          }
        } else {
          // Other browsers usually support multiple URLs (opening as tabs)
          const urls = bookmarks.map(b => b.url);
          const fullCommand = [...commandParts, ...urls];
          await $`${fullCommand}`.nothrow().quiet();

          // Print status for each bookmark
          for (const bookmark of bookmarks) {
            const displayName = bookmark.name.length > 40
              ? bookmark.name.substring(0, 40) + "..."
              : bookmark.name;
            print.status(`Opened: ${displayName}`);
          }
        }
      } catch (error) {
        print.error(`Failed to open bookmarks`);
      }
    } else if (workspace.bookmarks_folder) {
      print.error(`No bookmarks found in folder: ${workspace.bookmarks_folder}`);
    }
  }
}

// ============================================================
// INTERACTIVE WORKSPACE SELECTION
// ============================================================

/**
 * Displays the interactive workspace selection menu and launches selected workspaces.
 */
async function selectAndLaunchWorkspaces() {
  const config = loadConfig();
  const workspaces = config.workspaces;

  console.log("");
  print.info("Available Workspaces:");
  console.log("");

  workspaces.forEach((workspace) => {
    print.workspace(workspace.id, workspace.name);
  });

  console.log("");
  process.stdout.write(
    `${colors.yellow}Enter workspace numbers to launch (e.g., 1,3,4): ${colors.reset}`
  );

  // Read user input
  const selection = await new Promise((resolve) => {
    process.stdin.once("data", (data) => {
      resolve(data.toString().trim());
    });
  });

  const selectedIds = selection
    .split(",")
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n));

  const launchedWorkspaces = [];

  for (const id of selectedIds) {
    const workspace = workspaces.find((w) => w.id === id);
    if (workspace) {
      await launchWorkspace(workspace, config);
      launchedWorkspaces.push(workspace);
    } else {
      print.error(`Workspace #${id} not found`);
    }
  }

  console.log("");
  if (launchedWorkspaces.length > 0) {
    print.info("Successfully launched:");
    launchedWorkspaces.forEach((workspace) => {
      console.log(
        `  ${colors.green}•${colors.reset} ${workspace.id}. ${workspace.name}`
      );
    });
  }
  console.log("");

  process.exit(0);
}

// ============================================================
// WORKSPACE MANAGEMENT (Add/Edit/Delete)
// ============================================================

/**
 * Interactively prompts the user to add a new workspace.
 */
async function addWorkspace() {
  const config = loadConfig();
  const newId = Math.max(...config.workspaces.map((w) => w.id), 0) + 1;

  console.log("");
  print.info("Add New Workspace");
  console.log("");

  // Get workspace name
  process.stdout.write(`${colors.cyan}Workspace name: ${colors.reset}`);
  const name = await getUserInput();

  // Get commands
  const commands = [];
  print.cyan("Enter commands (press Enter with empty line to finish):");
  while (true) {
    process.stdout.write(`  Command: `);
    const cmd = await getUserInput();
    if (!cmd) break;
    commands.push(cmd);
  }

  // Get bookmarks folder (optional)
  console.log("");
  print.info("Bookmarks folder (optional):");
  print.cyan("  Format: 'Bookmarks bar/folder/subfolder' or 'Other bookmarks/folder'");
  process.stdout.write(`  Folder path (or press Enter to skip): `);
  const bookmarksFolder = await getUserInput();

  const newWorkspace = {
    id: newId,
    name,
    commands,
  };

  // Only add bookmarks_folder if provided
  if (bookmarksFolder) {
    newWorkspace.bookmarks_folder = bookmarksFolder;
  }

  config.workspaces.push(newWorkspace);
  saveConfig(config);

  console.log("");
  print.info("Workspace added successfully:");
  console.log(`  ${colors.green}•${colors.reset} ${newId}. ${name}`);
  if (commands.length > 0) {
    print.status(`Added: ${commands.length} command(s)`);
  }
  if (bookmarksFolder) {
    print.status(`Bookmarks folder: ${bookmarksFolder}`);
  }
  console.log("");
}

/**
 * Helper function to get user input from stdin.
 *
 * @returns {Promise<string>} The user's input.
 */
async function getUserInput() {
  return new Promise((resolve) => {
    process.stdin.once("data", (data) => {
      resolve(data.toString().trim());
    });
  });
}

/**
 * Interactively prompts the user to delete one or more workspaces.
 */
async function deleteWorkspace() {
  const config = loadConfig();

  console.log("");
  print.info("Delete Workspace");
  console.log("");

  config.workspaces.forEach((workspace) => {
    print.workspace(workspace.id, workspace.name);
  });

  console.log("");
  process.stdout.write(
    `${colors.yellow}Enter workspace ID(s) to delete (e.g., 1,3,5): ${colors.reset}`
  );
  const input = await getUserInput();

  const idsToDelete = input
    .split(",")
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n));

  if (idsToDelete.length === 0) {
    print.error("No valid workspace IDs provided");
    console.log("");
    return;
  }

  const deletedWorkspaces = [];
  const notFoundIds = [];

  // Delete workspaces in reverse order to avoid index issues
  for (const id of idsToDelete.sort((a, b) => b - a)) {
    const index = config.workspaces.findIndex((w) => w.id === id);
    if (index !== -1) {
      const deleted = config.workspaces.splice(index, 1)[0];
      deletedWorkspaces.push(deleted);
    } else {
      notFoundIds.push(id);
    }
  }

  if (deletedWorkspaces.length > 0) {
    saveConfig(config);
    console.log("");
    print.info("Successfully deleted:");
    deletedWorkspaces.reverse().forEach((workspace) => {
      console.log(
        `  ${colors.green}•${colors.reset} ${workspace.id}. ${workspace.name}`
      );
    });
  }

  if (notFoundIds.length > 0) {
    console.log("");
    notFoundIds.forEach((id) => {
      print.error(`Workspace #${id} not found`);
    });
  }

  console.log("");
}

// ============================================================
// MAIN MENU
// ============================================================

/**
 * Displays the main menu and handles user selection.
 */
async function showMenu() {
  console.log("");
  print.cyan("Workspace Launcher");
  console.log("");
  console.log("  1. Launch workspace");
  console.log("  2. Add new workspace");
  console.log("  3. Delete workspace");
  console.log("  4. View TOML config file");
  console.log("  5. Exit");
  console.log("");
  process.stdout.write(`${colors.yellow}Select option: ${colors.reset}`);

  const choice = await getUserInput();

  switch (choice) {
    case "1":
      await selectAndLaunchWorkspaces();
      break;
    case "2":
      await addWorkspace();
      await showMenu();
      break;
    case "3":
      await deleteWorkspace();
      await showMenu();
      break;
    case "4":
      print.info(`Config file: ${CONFIG_PATH}`);
      console.log(readFileSync(CONFIG_PATH, "utf-8"));
      await showMenu();
      break;
    case "5":
      console.log("");
      print.status("Goodbye!");
      console.log("");
      process.exit(0);
    default:
      print.error("Invalid option");
      await showMenu();
  }
}

// ============================================================
// ENTRY POINT
// ============================================================

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Workspace Launcher

Usage:
  wl                  Show interactive menu
  wl launch           Launch workspace (supports multiple: 1,3,5)
  wl add              Add a new workspace
  wl delete           Delete workspace (supports multiple: 1,3,5)

Config file: ${CONFIG_PATH}
  `);
  process.exit(0);
}

if (args[0] === "launch") {
  await selectAndLaunchWorkspaces();
} else if (args[0] === "add") {
  await addWorkspace();
} else if (args[0] === "delete") {
  await deleteWorkspace();
} else {
  await showMenu();
}
