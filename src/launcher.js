/**
 * Workspace launcher functions
 */

import { $ } from "bun";
import { readFileSync } from "fs";
import { print, CONFIG_PATH, stripInlineComments } from "./utils.js";
import { getBookmarksFilePath, getBookmarksFromFolder } from "./bookmarks.js";

// Global flag for dry run mode
let isDryRun = false;
// Global flag for verbose mode
let isVerbose = false;

/**
 * Sets the dry run mode
 * @param {boolean} value - Whether to enable dry run
 */
export function setDryRun(value) {
  isDryRun = value;
}

/**
 * Sets the verbose mode
 * @param {boolean} value - Whether to enable verbose output
 */
export function setVerbose(value) {
  isVerbose = value;
}

/**
 * Parses a command string into an array of arguments, handling quoted strings
 * @param {string} command - The command string to parse
 * @returns {string[]} - Array of command parts
 */
function parseCommandString(command) {
  if (!command) return [];
  
  const parts = [];
  let current = "";
  let inSingleQuotes = false;
  let inDoubleQuotes = false;
  let escapeNext = false;
  
  for (const char of command) {
    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }
    
    if (char === "\\") {
      escapeNext = true;
      continue;
    }
    
    if (char === "'" && !inDoubleQuotes) {
      inSingleQuotes = !inSingleQuotes;
      continue;
    }
    
    if (char === '"' && !inSingleQuotes) {
      inDoubleQuotes = !inDoubleQuotes;
      continue;
    }
    
    if (char === " " && !inSingleQuotes && !inDoubleQuotes) {
      if (current) {
        parts.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }
  
  if (current) {
    parts.push(current);
  }
  
  return parts;
}

/**
 * Launches all commands in a workspace.
 * @param {Object} workspace - The workspace object to launch.
 * @param {Object} config - The configuration object.
 */
export async function launchWorkspace(workspace, config) {
  console.log("");
  print.info(`Starting: ${workspace.name}`);
  console.log("");

  const commands = workspace.commands || [];
  for (const cmd of commands) {
    // Skip empty lines and lines starting with #
    if (!cmd || cmd.trim().startsWith("#")) continue;
    
    // Strip inline comments
    const cleanCmd = stripInlineComments(cmd);
    if (!cleanCmd) continue;

    // Use bash -c to properly handle commands with spaces and special characters
    try {
      if (isDryRun) {
        print.dryRun(`Would execute: ${cleanCmd}`);
        const displayName = cleanCmd.length > 50 ? cleanCmd.substring(0, 50) + "..." : cleanCmd;
        print.status(`Planned: ${displayName}`);
      } else {
        // Use bash -c for proper shell command parsing
        const shell = $`bash -c ${cleanCmd}`;
        if (!isVerbose) {
          shell.nothrow().quiet();
        } else {
          shell.nothrow();
        }
        await shell;
        const displayName = cleanCmd.length > 50 ? cleanCmd.substring(0, 50) + "..." : cleanCmd;
        print.status(`Launched: ${displayName}`);
      }
    } catch (error) {
      print.error(`Failed to launch: ${cleanCmd}`);
      if (error.message?.includes("command not found")) {
        print.info("Tip: Ensure the application is installed");
      }
      if (isVerbose) {
        console.error(error);
      }
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
      const browserCommand = config.settings?.bookmarks_open_in || "xdg-open";
      
      // Parse command string handling quoted paths
      const commandParts = parseCommandString(browserCommand);
      const isXdgOpen = commandParts[0].endsWith("xdg-open");

      if (isDryRun) {
        if (isXdgOpen) {
          for (let i = 0; i < bookmarks.length; i++) {
            const bookmark = bookmarks[i];
            print.progress(i + 1, bookmarks.length, `[DRY RUN] Would open: ${bookmark.name}`);
          }
        } else {
          print.dryRun(`Would open ${bookmarks.length} bookmarks as tabs`);
          for (let i = 0; i < bookmarks.length; i++) {
            const bookmark = bookmarks[i];
            print.progress(i + 1, bookmarks.length, `[DRY RUN] ${bookmark.name}`);
          }
        }
      } else {
        try {
          if (isXdgOpen) {
            // xdg-open only supports one URL at a time
            for (let i = 0; i < bookmarks.length; i++) {
              const bookmark = bookmarks[i];
              const fullCommand = [...commandParts, bookmark.url];
              
              const shell = $`${fullCommand}`;
              if (!isVerbose) {
                shell.nothrow().quiet();
              } else {
                shell.nothrow();
              }
              await shell;
              
              const displayName = bookmark.name.length > 40
                ? bookmark.name.substring(0, 40) + "..."
                : bookmark.name;
              print.progress(i + 1, bookmarks.length, `Opened: ${displayName}`);
            }
          } else {
            // Other browsers usually support multiple URLs (opening as tabs)
            const urls = bookmarks.map(b => b.url);
            const fullCommand = [...commandParts, ...urls];
            
            const shell = $`${fullCommand}`;
            if (!isVerbose) {
              shell.nothrow().quiet();
            } else {
              shell.nothrow();
            }
            await shell;

            // Print status for each bookmark
            for (let i = 0; i < bookmarks.length; i++) {
              const bookmark = bookmarks[i];
              const displayName = bookmark.name.length > 40
                ? bookmark.name.substring(0, 40) + "..."
                : bookmark.name;
              print.progress(i + 1, bookmarks.length, `Opened: ${displayName}`);
            }
          }
        } catch (error) {
          print.error(`Failed to open bookmarks`);
          print.info("Tip: Check your browser command in config.toml");
          if (isVerbose) {
            console.error(error);
          }
        }
      }
    } else if (workspace.bookmarks_folder) {
      print.error(`No bookmarks found in folder: ${workspace.bookmarks_folder}`);
      print.info("Tip: Check the folder path in your config");
    }
  }
}

/**
 * Opens the config file in the default editor
 * @param {string} customConfigPath - Optional custom config file path
 */
export async function openConfigInEditor(customConfigPath = null) {
  const configPath = customConfigPath || CONFIG_PATH;
  print.info(`Opening config file: ${configPath}`);
  
  if (isDryRun) {
    print.dryRun(`Would open: ${configPath}`);
    return;
  }
  
  try {
    // Try common editors
    const editors = ["$EDITOR", "code", "nano", "vim", "gedit", "gnome-text-editor"];
    
    for (const editor of editors) {
      try {
        if (editor === "$EDITOR") {
          if (process.env.EDITOR) {
            await $`${process.env.EDITOR} ${configPath}`.nothrow();
            print.status("Config opened in editor");
            return;
          }
        } else {
          await $`${editor} ${configPath}`.nothrow().quiet();
          print.status("Config opened in editor");
          return;
        }
      } catch {
        // Try next editor
        continue;
      }
    }
    
    // Fallback: just display the file
    print.info("Could not open editor. Displaying config file:");
    console.log(readFileSync(configPath, "utf-8"));
  } catch (error) {
    print.error("Failed to open config file");
    console.log(readFileSync(configPath, "utf-8"));
  }
}
