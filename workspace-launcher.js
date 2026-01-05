#!/usr/bin/env bun
/**
 * Workspace Launcher Script (Bun.js Version)
 *
 * An interactive CLI tool to launch workspaces with custom commands.
 *
 * @author Zero
 * @version 0.2.0
 */

import { $ } from "bun";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

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
// LAUNCHER FUNCTIONS
// ============================================================

/**
 * Launches all commands in a workspace.
 *
 * @param {Object} workspace - The workspace object to launch.
 */
async function launchWorkspace(workspace) {
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
      await launchWorkspace(workspace);
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

  const newWorkspace = {
    id: newId,
    name,
    commands,
  };

  config.workspaces.push(newWorkspace);
  saveConfig(config);

  console.log("");
  print.info("Workspace added successfully:");
  console.log(`  ${colors.green}•${colors.reset} ${newId}. ${name}`);
  if (commands.length > 0) {
    print.status(`Added: ${commands.length} command(s)`);
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

Examples:
  wl                  Interactive menu
  wl launch           Select and launch workspace
  wl add              Add a new workspace interactively
  wl delete           Delete one or more workspaces

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
