/**
 * Utility functions for workspace-launcher
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "fs";
import { join } from "path";

// Version constant
export const VERSION = "0.3.0";

// Colors for terminal output
export const colors = {
  green: "\x1b[0;32m",
  red: "\x1b[0;31m",
  yellow: "\x1b[1;33m",
  blue: "\x1b[0;34m",
  cyan: "\x1b[0;36m",
  magenta: "\x1b[0;35m",
  gray: "\x1b[0;90m",
  reset: "\x1b[0m",
};

export const print = {
  status: (msg) => console.log(`${colors.green}[✓]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[✗]${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.yellow}[i]${colors.reset} ${msg}`),
  workspace: (num, msg, hasCommands = true) => {
    const color = hasCommands ? colors.green : colors.yellow;
    console.log(`${colors.blue}[${num}]${colors.reset} ${color}${msg}${colors.reset}`);
  },
  cyan: (msg) => console.log(`${colors.cyan}${msg}${colors.reset}`),
  progress: (current, total, msg) => {
    console.log(`${colors.magenta}[${current}/${total}]${colors.reset} ${msg}`);
  },
  dryRun: (msg) => console.log(`${colors.gray}[DRY RUN]${colors.reset} ${msg}`),
};

// Configuration paths
export const CONFIG_DIR = join(
  process.env.XDG_CONFIG_HOME || join(process.env.HOME, ".config"),
  "workspace-launcher"
);
export const CONFIG_PATH = join(CONFIG_DIR, "config.toml");
export const EXAMPLE_CONFIG_PATH = join(process.cwd(), "config.example.toml");

/**
 * Expands environment variables in a string
 * @param {string} str - String potentially containing ${VAR} or $VAR
 * @returns {string} - String with environment variables expanded
 */
export function expandEnvVars(str) {
  if (!str || typeof str !== "string") return str;
  
  // Handle ${VAR} syntax
  str = str.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    return process.env[varName] || match;
  });
  
  // Handle $VAR syntax (at start or after space)
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
  const expanded = JSON.parse(JSON.stringify(config)); // Deep clone
  
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
 * Auto-creates config from example if it doesn't exist
 * @returns {boolean} - True if config was created, false if it already existed
 */
export function autoCreateConfig() {
  if (existsSync(CONFIG_PATH)) {
    return false;
  }
  
  if (!existsSync(EXAMPLE_CONFIG_PATH)) {
    print.error(`Example config not found: ${EXAMPLE_CONFIG_PATH}`);
    return false;
  }
  
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  
  copyFileSync(EXAMPLE_CONFIG_PATH, CONFIG_PATH);
  return true;
}

/**
 * Loads the workspace configuration from the TOML file.
 * @returns {Object} The parsed configuration object.
 * @throws {Error} If the config file is not found.
 */
export function loadConfig() {
  // Try to auto-create config from example
  const wasCreated = autoCreateConfig();
  if (wasCreated) {
    console.log("");
    print.info(`Created config file from example: ${CONFIG_PATH}`);
    print.info("Please edit the config file to customize your workspaces.");
    console.log("");
  }
  
  if (!existsSync(CONFIG_PATH)) {
    print.error(`Config file not found: ${CONFIG_PATH}`);
    print.info(`Create directory and copy example config:`);
    console.log(`  mkdir -p ${CONFIG_DIR}`);
    console.log(`  cp config.example.toml ${CONFIG_PATH}`);
    process.exit(1);
  }
  
  const rawConfig = Bun.TOML.parse(readFileSync(CONFIG_PATH, "utf-8"));
  return expandConfigEnvVars(rawConfig);
}

/**
 * Saves the workspace configuration to the TOML file.
 * @param {Object} config - The configuration object to save.
 */
export function saveConfig(config) {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, Bun.TOML.stringify(config));
  print.status("Configuration saved");
}

/**
 * Validates the configuration structure
 * @param {Object} config - The configuration object
 * @returns {Object} - { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateConfig(config) {
  const errors = [];
  const warnings = [];
  
  if (!config) {
    errors.push("Config is empty");
    return { valid: false, errors, warnings };
  }
  
  if (!Array.isArray(config.workspaces)) {
    errors.push("workspaces must be an array");
  } else {
    // Check for duplicate IDs
    const ids = config.workspaces.map(w => w.id);
    const duplicates = ids.filter((item, index) => ids.indexOf(item) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate workspace IDs found: ${[...new Set(duplicates)].join(", ")}`);
    }
    
    // Check each workspace
    for (const workspace of config.workspaces) {
      if (!workspace.id || typeof workspace.id !== "number") {
        errors.push(`Workspace "${workspace.name || "unnamed"}" has invalid or missing ID`);
      }
      
      if (!workspace.name || workspace.name.trim() === "") {
        errors.push(`Workspace #${workspace.id} has empty name`);
      }
      
      if (!workspace.commands && !workspace.bookmarks_folder) {
        warnings.push(`Workspace "${workspace.name}" has no commands or bookmarks_folder`);
      }
      
      if (workspace.commands && !Array.isArray(workspace.commands)) {
        errors.push(`Workspace "${workspace.name}" commands must be an array`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Helper function to get user input from stdin.
 * @returns {Promise<string>} The user's input.
 */
export async function getUserInput() {
  return new Promise((resolve) => {
    process.stdin.once("data", (data) => {
      resolve(data.toString().trim());
    });
  });
}

/**
 * Sanitizes user input to prevent injection
 * @param {string} input - Raw user input
 * @returns {string} - Sanitized input
 */
export function sanitizeInput(input) {
  if (!input) return "";
  // Remove control characters and limit length
  return input
    .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
    .substring(0, 1000); // Limit length
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
      // Range format: "1-5"
      const [start, end] = part.split("-").map(s => parseInt(s.trim()));
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          ids.add(i);
        }
      }
    } else {
      // Single number
      const num = parseInt(part);
      if (!isNaN(num)) {
        ids.add(num);
      }
    }
  }
  
  return [...ids].sort((a, b) => a - b);
}

/**
 * Strips inline comments from a command string
 * @param {string} cmd - Command that may contain inline comments
 * @returns {string} - Command without comments
 */
export function stripInlineComments(cmd) {
  if (!cmd) return "";
  
  // Handle quoted strings to avoid stripping # inside quotes
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
 * Validates a workspace name
 * @param {string} name - The workspace name
 * @param {Object[]} existingWorkspaces - Existing workspaces to check for duplicates
 * @returns {Object} - { valid: boolean, error?: string }
 */
export function validateWorkspaceName(name, existingWorkspaces = []) {
  if (!name || name.trim() === "") {
    return { valid: false, error: "Workspace name cannot be empty" };
  }
  
  if (name.length > 100) {
    return { valid: false, error: "Workspace name too long (max 100 characters)" };
  }
  
  const trimmedName = name.trim();
  const duplicate = existingWorkspaces.find(w => 
    w.name.toLowerCase() === trimmedName.toLowerCase()
  );
  
  if (duplicate) {
    return { valid: false, error: `Workspace "${trimmedName}" already exists` };
  }
  
  return { valid: true };
}

/**
 * Validates a command string
 * @param {string} cmd - The command to validate
 * @returns {Object} - { valid: boolean, warning?: string }
 */
export function validateCommand(cmd) {
  if (!cmd || cmd.trim() === "") {
    return { valid: false };
  }
  
  const trimmedCmd = cmd.trim();
  
  // Check for potentially dangerous commands
  const dangerousPatterns = [
    /^rm\s+-rf\s+\//,
    />\s*\/dev\/null/,
    /:\(\)\{\s*:\|\:&\s*;\s*\}/, // Fork bomb
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmedCmd)) {
      return { 
        valid: true, 
        warning: "This command may be dangerous. Please verify before saving." 
      };
    }
  }
  
  return { valid: true };
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
