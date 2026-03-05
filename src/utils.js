/**
 * Utility functions for workspace-launcher
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

import { styleText } from "util";

export const print = {
  status: (msg) => console.log(`${styleText('green', '[✓]')} ${msg}`),
  error: (msg) => console.log(`${styleText('red', '[✗]')} ${msg}`),
  info: (msg) => console.log(`${styleText('yellow', '[i]')} ${msg}`),
  workspace: (num, msg, hasCommands = true) => {
    const color = hasCommands ? 'green' : 'yellow';
    console.log(`${styleText('blue', `[${num}]`)} ${styleText(color, msg)}`);
  },
  cyan: (msg) => console.log(styleText('cyan', msg)),
  gray: (msg) => console.log(styleText('gray', msg)),
  progress: (current, total, msg) => {
    console.log(`${styleText('magenta', `[${current}/${total}]`)} ${msg}`);
  },
  dryRun: (msg) => console.log(`${styleText('gray', '[DRY RUN]')} ${msg}`),
};

export const color = {
  green: (msg) => styleText('green', msg),
  red: (msg) => styleText('red', msg),
  yellow: (msg) => styleText('yellow', msg),
  blue: (msg) => styleText('blue', msg),
  magenta: (msg) => styleText('magenta', msg),
  cyan: (msg) => styleText('cyan', msg),
  gray: (msg) => styleText('gray', msg),
};

// Configuration paths
const getHome = () => process.env.HOME || homedir() || "/tmp";
const configBase = process.env.XDG_CONFIG_HOME || join(getHome(), ".config");
export const CONFIG_DIR = join(configBase, "workspace-launcher");
export const CONFIG_PATH = join(CONFIG_DIR, "config.toml");

/**
 * Expands environment variables in a string
 * @param {string} str - String potentially containing ${VAR} or $VAR
 * @returns {string} - String with environment variables expanded
 */
export function expandEnvVars(str) {
  if (!str || typeof str !== "string") return str;
  
  str = str.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    return process.env[varName] || match;
  });
  
  str = str.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, varName) => {
    return process.env[varName] || match;
  });
  
  return str;
}

/**
 * Expands environment variables in an entire config object
 * @param {Object} config - The configuration object
 * @returns {Object} - Config with environment variables expanded
 */
export function expandConfigEnvVars(config) {
  const expanded = JSON.parse(JSON.stringify(config));
  
  if (expanded.settings) {
    for (const key in expanded.settings) {
      if (typeof expanded.settings[key] === "string") {
        expanded.settings[key] = expandEnvVars(expanded.settings[key]);
      }
    }
  }
  
  if (expanded.workspaces) {
    for (const workspace of expanded.workspaces) {
      if (workspace.commands) {
        workspace.commands = workspace.commands.map(cmd => expandEnvVars(cmd));
      }
      if (workspace.bookmarks_folder) {
        workspace.bookmarks_folder = expandEnvVars(workspace.bookmarks_folder);
      }
    }
  }
  
  return expanded;
}

/**
 * Loads the workspace configuration from the TOML file.
 * @param {string} customConfigPath - Optional custom config file path
 * @returns {Object} The parsed configuration object.
 */
export function loadConfig(customConfigPath = null) {
  const configPath = customConfigPath || CONFIG_PATH;
  
  if (!existsSync(configPath)) {
    print.error(`Config file not found: ${configPath}`);
    process.exit(1);
  }
  
  const rawConfig = Bun.TOML.parse(readFileSync(configPath, "utf-8"));
  return expandConfigEnvVars(rawConfig);
}

/**
 * Parses selection string supporting comma-separated and range formats
 * @param {string} selection - e.g., "1,3,5" or "1-3,5" or "1,3-5,7"
 * @returns {number[]} - Array of IDs
 */
export function parseSelection(selection) {
  if (!selection) return [];
  
  const ids = new Set();
  const parts = selection.split(",").map(s => s.trim());
  
  for (const part of parts) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map(s => parseInt(s.trim()));
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          ids.add(i);
        }
      }
    } else {
      const num = parseInt(part);
      if (!isNaN(num)) {
        ids.add(num);
      }
    }
  }
  
  return [...ids].sort((a, b) => a - b);
}

/**
 * Resolves a workspace by its keyword (case-insensitive exact match)
 * @param {string} keyword - The keyword to search for
 * @param {Object[]} workspaces - Array of workspace objects
 * @returns {Object|null} - Matching workspace or null
 */
export function resolveWorkspaceByKeyword(keyword, workspaces) {
  if (!keyword || !workspaces) return null;
  
  const query = keyword.toLowerCase();
  return workspaces.find(w => w.keyword?.toLowerCase() === query) || null;
}

/**
 * Strips inline comments from a command string
 * @param {string} cmd - Command that may contain inline comments
 * @returns {string} - Command without comments
 */
export function stripInlineComments(cmd) {
  if (!cmd) return "";
  
  let result = "";
  let inSingleQuotes = false;
  let inDoubleQuotes = false;
  
  for (let i = 0; i < cmd.length; i++) {
    const char = cmd[i];
    const prevChar = i > 0 ? cmd[i - 1] : "";
    
    if (char === '"' && !inSingleQuotes && prevChar !== "\\") {
      inDoubleQuotes = !inDoubleQuotes;
    } else if (char === "'" && !inDoubleQuotes && prevChar !== "\\") {
      inSingleQuotes = !inSingleQuotes;
    } else if (char === "#" && !inSingleQuotes && !inDoubleQuotes) {
      break;
    }
    
    result += char;
  }
  
  return result.trim();
}

/**
 * Setup graceful shutdown handlers
 */
export function setupGracefulShutdown() {
  process.on("SIGINT", () => {
    console.log("\n");
    print.status("Cancelled by user");
    console.log("");
    process.exit(0);
  });
  
  process.on("SIGTERM", () => {
    console.log("\n");
    print.status("Terminated");
    process.exit(0);
  });
}
