#!/usr/bin/env bun
/**
 * Workspace Launcher Script (Bun.js Version)
 *
 * An interactive CLI tool to launch multiple workspaces including
 * websites, PWA apps, PDFs, and system applications.
 *
 * @author Zero
 * @version 0.1.0
 */

import { $ } from "bun";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";

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

const CONFIG_PATH = join(dirname(process.argv[1]), "workspaces-config.toml");

/**
 * Loads the workspace configuration from the TOML file.
 *
 * @returns {Object} The parsed configuration object.
 * @throws {Error} If the config file is not found.
 */
function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    print.error(`Config file not found: ${CONFIG_PATH}`);
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
  writeFileSync(CONFIG_PATH, Bun.TOML.stringify(config));
  print.status("Configuration saved");
}

// ============================================================
// LAUNCHER FUNCTIONS
// ============================================================

/**
 * Launches a list of websites in a new Brave browser window.
 *
 * @param {string[]} websites - Array of website URLs.
 * @param {string} [windowName="Learning"] - Name for the browser window.
 */
async function launchWebsites(websites, windowName = "Learning") {
  if (!websites || websites.length === 0) return;

  print.info("Launching websites...");
  await $`flatpak run com.brave.Browser --profile-directory=Default --new-window --window-name=${windowName} ${websites}`
    .nothrow()
    .quiet();
  print.status(`Opened ${websites.length} website(s)`);
}

/**
 * Launches a list of PWA apps using Brave browser.
 *
 * @param {Object[]} pwaApps - Array of PWA app objects { name, id }.
 */
async function launchPWAApps(pwaApps) {
  if (!pwaApps || pwaApps.length === 0) return;

  print.info("Launching PWA apps...");
  for (const app of pwaApps) {
    await $`flatpak run --command=brave com.brave.Browser --profile-directory=Default --app-id=${app.id}`
      .nothrow()
      .quiet();
    print.status(`Launched PWA: ${app.name}`);
    await Bun.sleep(500);
  }
}

/**
 * Launches a list of website apps (site-as-app) using Brave browser.
 *
 * @param {Object[]} websiteApps - Array of website app objects { name, url }.
 */
async function launchWebsiteApps(websiteApps) {
  if (!websiteApps || websiteApps.length === 0) return;

  print.info("Launching website apps...");
  for (const app of websiteApps) {
    await $`flatpak run --command=brave com.brave.Browser --profile-directory=Default --app=${app.url}`
      .nothrow()
      .quiet();
    print.status(`Launched: ${app.name}`);
    await Bun.sleep(500);
  }
}

/**
 * Launches a list of PDF files using GNOME Papers (Evince).
 *
 * @param {Object[]} pdfs - Array of PDF objects { name, path, page }.
 */
async function launchPDFs(pdfs) {
  if (!pdfs || pdfs.length === 0) return;

  print.info("Launching PDFs...");
  for (const pdf of pdfs) {
    if (!existsSync(pdf.path)) {
      print.error(`PDF not found: ${pdf.path}`);
      continue;
    }

    if (pdf.page) {
      await $`flatpak run org.gnome.Papers --page-index=${pdf.page} ${pdf.path}`
        .nothrow()
        .quiet();
      print.status(`Opened: ${pdf.name} (page ${pdf.page})`);
    } else {
      await $`flatpak run org.gnome.Papers ${pdf.path}`.nothrow().quiet();
      print.status(`Opened: ${pdf.name}`);
    }
    await Bun.sleep(500);
  }
}

/**
 * Launches a list of system applications via shell commands.
 *
 * @param {string[]} systemApps - Array of shell commands.
 */
async function launchSystemApps(systemApps) {
  if (!systemApps || systemApps.length === 0) return;

  print.info("Launching system apps...");
  for (const app of systemApps) {
    if (!app || app.trim().startsWith("#")) continue;

    try {
      // Execute the command directly using Bun shell
      await $`${app.split(" ")}`.nothrow().quiet();
      const displayName = app.length > 50 ? app.substring(0, 50) + "..." : app;
      print.status(`Launched: ${displayName}`);
      await Bun.sleep(400);
    } catch (error) {
      print.error(`Failed to launch: ${app}`);
    }
  }
}

/**
 * Orchestrates the launching of all components in a workspace.
 *
 * @param {Object} workspace - The workspace object to launch.
 */
async function launchWorkspace(workspace) {
  console.log("");
  print.info(`Starting: ${workspace.name}`);
  console.log("");

  await launchWebsites(workspace.websites, workspace.name.replace(/\s+/g, "-"));
  await launchPWAApps(workspace.pwaApps);
  await launchWebsiteApps(workspace.websiteApps);
  await launchPDFs(workspace.pdfs);
  await launchSystemApps(workspace.systemApps);
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

  // Get websites
  const websites = [];
  print.cyan("Enter websites (press Enter with empty line to finish):");
  while (true) {
    process.stdout.write(`  URL: `);
    const url = await getUserInput();
    if (!url) break;
    websites.push(url);
  }

  // Get PWA apps
  const pwaApps = [];
  print.cyan("PWA apps (press Enter with empty name to finish):");
  while (true) {
    process.stdout.write(`  App name: `);
    const appName = await getUserInput();
    if (!appName) break;
    process.stdout.write(`  App ID: `);
    const appId = await getUserInput();
    pwaApps.push({ name: appName, id: appId });
  }

  // Get website apps
  const websiteApps = [];
  print.cyan("Website apps (press Enter with empty name to finish):");
  while (true) {
    process.stdout.write(`  App name: `);
    const appName = await getUserInput();
    if (!appName) break;
    process.stdout.write(`  App URL: `);
    const appUrl = await getUserInput();
    websiteApps.push({ name: appName, url: appUrl });
  }

  // Get PDFs
  const pdfs = [];
  print.cyan("PDFs (press Enter with empty name to finish):");
  while (true) {
    process.stdout.write(`  PDF name: `);
    const pdfName = await getUserInput();
    if (!pdfName) break;
    process.stdout.write(`  PDF path: `);
    const pdfPath = await getUserInput();
    process.stdout.write(`  Page number (optional): `);
    const page = await getUserInput();
    pdfs.push({ name: pdfName, path: pdfPath, page: page || null });
  }

  // Get system apps
  const systemApps = [];
  print.cyan("System apps (press Enter with empty command to finish):");
  while (true) {
    process.stdout.write(`  Command: `);
    const cmd = await getUserInput();
    if (!cmd) break;
    systemApps.push(cmd);
  }

  const newWorkspace = {
    id: newId,
    name,
    websites,
    pwaApps,
    websiteApps,
    pdfs,
    systemApps,
  };

  config.workspaces.push(newWorkspace);
  saveConfig(config);

  console.log("");
  print.info("Workspace added successfully:");
  console.log(`  ${colors.green}•${colors.reset} ${newId}. ${name}`);
  console.log("");

  // Show summary of what was added
  const summary = [];
  if (websites.length > 0) summary.push(`${websites.length} website(s)`);
  if (pwaApps.length > 0) summary.push(`${pwaApps.length} PWA app(s)`);
  if (websiteApps.length > 0)
    summary.push(`${websiteApps.length} website app(s)`);
  if (pdfs.length > 0) summary.push(`${pdfs.length} PDF(s)`);
  if (systemApps.length > 0) summary.push(`${systemApps.length} system app(s)`);

  if (summary.length > 0) {
    print.status(`Added: ${summary.join(", ")}`);
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
  print.cyan("╔════════════════════════════════════╗");
  print.cyan("║   Workspace Launcher    ║");
  print.cyan("╔════════════════════════════════════╝");
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
  bun run daily-learning.js              Show interactive menu
  bun run daily-learning.js launch       Launch workspace (supports multiple: 1,3,5)
  bun run daily-learning.js add          Add a new workspace
  bun run daily-learning.js delete       Delete workspace (supports multiple: 1,3,5)

Examples:
  ./launch-workspace                        Interactive menu
  ./launch-workspace launch                 Select and launch workspace
  ./launch-workspace add                    Add a new workspace interactively
  ./launch-workspace delete                 Delete one or more workspaces

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
