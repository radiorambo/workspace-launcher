#!/usr/bin/env bun
/**
 * Workspace Launcher
 *
 * An interactive CLI tool to launch workspaces with custom commands.
 *
 * @author Zero
 * @version 0.3.0
 */

import { showMenu, selectAndLaunchWorkspaces } from "./src/ui.js";
import { addWorkspace, editWorkspace, deleteWorkspace } from "./src/management.js";
import { setupGracefulShutdown, VERSION, colors } from "./src/utils.js";

// Setup graceful shutdown
setupGracefulShutdown();

// Parse command line arguments
const args = process.argv.slice(2);

// Show help
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
${colors.cyan}Workspace Launcher v${VERSION}${colors.reset}

Usage:
  wl                          Show interactive menu
  wl launch                   Launch workspace (supports multiple: 1,3,5 or 1-3)
  wl launch --dry-run         Preview what would be launched without executing
  wl launch -v                Launch with verbose output
  wl add                      Add a new workspace
  wl edit                     Edit an existing workspace
  wl delete                   Delete workspace (supports multiple: 1,3,5 or 1-3)
  wl --config <path>, -c <path>  Use custom config file
  wl --version, -V            Show version
  wl --help, -h               Show this help message

Selection formats:
  1,3,5       Select workspaces 1, 3, and 5
  1-3         Select workspaces 1, 2, and 3
  1,3-5,7     Select workspaces 1, 3, 4, 5, and 7
`);
  process.exit(0);
}

// Show version
if (args.includes("--version") || args.includes("-V")) {
  console.log(`${colors.cyan}Workspace Launcher v${VERSION}${colors.reset}`);
  process.exit(0);
}

// Parse --config / -c flag
let customConfigPath = null;
const configIndex = args.indexOf("--config");
if (configIndex === -1) {
  const shortConfigIndex = args.indexOf("-c");
  if (shortConfigIndex !== -1) {
    customConfigPath = args[shortConfigIndex + 1];
  }
} else {
  customConfigPath = args[configIndex + 1];
}

// Check for flags
const dryRun = args.includes("--dry-run");
const verbose = args.includes("-v") || args.includes("--verbose");

// Remove flags and config path from args for processing
const cleanArgs = args.filter((arg, index) => {
  if (arg === "--config" || arg === "-c") return false;
  const prevArg = args[index - 1];
  if (prevArg === "--config" || prevArg === "-c") return false;
  return !arg.startsWith("-");
});

// Route to appropriate function
if (cleanArgs[0] === "launch") {
  await selectAndLaunchWorkspaces(cleanArgs[1] || null, dryRun, verbose, customConfigPath);
} else if (cleanArgs[0] === "add") {
  if (dryRun) {
    console.log(`${colors.gray}[DRY RUN] Would open add workspace dialog${colors.reset}`);
    process.exit(0);
  }
  await addWorkspace(customConfigPath);
} else if (cleanArgs[0] === "edit") {
  if (dryRun) {
    console.log(`${colors.gray}[DRY RUN] Would open edit workspace dialog${colors.reset}`);
    process.exit(0);
  }
  await editWorkspace(customConfigPath);
} else if (cleanArgs[0] === "delete") {
  if (dryRun) {
    console.log(`${colors.gray}[DRY RUN] Would open delete workspace dialog${colors.reset}`);
    process.exit(0);
  }
  await deleteWorkspace(customConfigPath);
} else {
  await showMenu(customConfigPath);
}
