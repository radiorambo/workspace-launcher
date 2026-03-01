/**
 * UI and menu functions for workspace-launcher
 */

import { readFileSync } from "fs";
import { print, loadConfig, getUserInput, sanitizeInput, parseSelection, resolveWorkspaceByKeyword, validateConfig, colors, VERSION, CONFIG_PATH } from "./utils.js";
import { launchWorkspace, setDryRun, setVerbose, openConfigInEditor } from "./launcher.js";
import { addWorkspace, editWorkspace, deleteWorkspace } from "./management.js";

/**
 * Displays the interactive workspace selection menu and launches selected workspaces.
 * @param {string} preSelected - Optional pre-selected IDs (for CLI args)
 * @param {boolean} dryRun - Whether to run in dry-run mode
 * @param {boolean} verbose - Whether to run in verbose mode
 * @param {string} customConfigPath - Optional custom config file path
 */
export async function selectAndLaunchWorkspaces(preSelected = null, dryRun = false, verbose = false, customConfigPath = null) {
  setDryRun(dryRun);
  setVerbose(verbose);
  
  const config = loadConfig(customConfigPath);
  
  // Validate config and show warnings
  const validation = validateConfig(config);
  if (!validation.valid) {
    print.error("Configuration errors:");
    validation.errors.forEach(err => console.log(`  ${colors.red}•${colors.reset} ${err}`));
    console.log("");
    process.exit(1);
  }
  if (validation.warnings.length > 0) {
    print.info("Configuration warnings:");
    validation.warnings.forEach(warn => console.log(`  ${colors.yellow}•${colors.reset} ${warn}`));
    console.log("");
  }
  
  const workspaces = config.workspaces;

  if (dryRun) {
    console.log("");
    print.info("DRY RUN MODE - No commands will be executed");
    console.log("");
  }

  console.log("");
  print.info(`Available Workspaces (${workspaces.length} total):`);
  console.log("");

  workspaces.forEach((workspace) => {
    const hasContent = (workspace.commands?.length > 0) || workspace.bookmarks_folder;
    const keyword = workspace.keyword ? ` ${colors.gray}(${workspace.keyword})${colors.reset}` : "";
    print.workspace(workspace.id, workspace.name + keyword, hasContent);
  });

  let selectedWorkspaces = [];
  let notFoundIds = [];
  
  if (preSelected) {
    // Check if selection looks like numbers (e.g. "1,3,5" or "1-3")
    const isNumeric = /^[\d,\-\s]+$/.test(preSelected);
    
    if (isNumeric) {
      const selectedIds = parseSelection(preSelected);
      if (selectedIds.length === 0) {
        print.error("No valid workspace IDs provided");
        process.exit(1);
      }
      for (const id of selectedIds) {
        const workspace = workspaces.find((w) => w.id === id);
        if (workspace) {
          selectedWorkspaces.push(workspace);
        } else {
          notFoundIds.push(id);
        }
      }
    } else {
      // Treat as workspace keyword
      const match = resolveWorkspaceByKeyword(preSelected, workspaces);
      if (!match) {
        print.error(`No workspace with keyword "${preSelected}"`);
        console.log("");
        print.info("Available workspaces:");
        workspaces.forEach((w) => {
          const kw = w.keyword ? ` ${colors.gray}(${w.keyword})${colors.reset}` : "";
          print.workspace(w.id, w.name + kw, true);
        });
        console.log("");
        process.exit(1);
      }
      selectedWorkspaces = [match];
    }
  } else {
    console.log("");
    process.stdout.write(
      `${colors.yellow}Enter workspace number or name to launch (e.g., 1,3,4 or math): ${colors.reset}`
    );

    const selection = sanitizeInput(await getUserInput());
    const isNumeric = /^[\d,\-\s]+$/.test(selection);
    
    if (isNumeric) {
      const selectedIds = parseSelection(selection);
      for (const id of selectedIds) {
        const workspace = workspaces.find((w) => w.id === id);
        if (workspace) {
          selectedWorkspaces.push(workspace);
        } else {
          notFoundIds.push(id);
        }
      }
    } else {
      const match = resolveWorkspaceByKeyword(selection, workspaces);
      if (!match) {
        print.error(`No workspace with keyword "${selection}"`);
        process.exit(1);
      }
      selectedWorkspaces = [match];
    }
  }

  const launchedWorkspaces = [];

  for (const workspace of selectedWorkspaces) {
    await launchWorkspace(workspace, config);
    launchedWorkspaces.push(workspace);
  }

  console.log("");
  if (launchedWorkspaces.length > 0) {
    if (dryRun) {
      print.info("Planned to launch:");
    } else {
      print.info("Successfully launched:");
    }
    launchedWorkspaces.forEach((workspace) => {
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

  process.exit(0);
}

async function viewConfig(customConfigPath = null) {
  const configPath = customConfigPath || CONFIG_PATH;
  console.log("");
  print.info(`Config file: ${configPath}`);
  console.log("");
  try {
    const content = readFileSync(configPath, "utf-8");
    console.log(content);
  } catch (error) {
    print.error("Failed to read config file");
  }
}

/**
 * Displays the main menu and handles user selection.
 * @param {string} customConfigPath - Optional custom config file path
 */
export async function showMenu(customConfigPath = null) {
  const config = loadConfig(customConfigPath);
  const workspaceCount = config.workspaces?.length || 0;

  console.log("");
  print.cyan(`Workspace Launcher (v${VERSION})`);
  print.gray(`${workspaceCount} workspace(s) configured`);
  console.log("");
  console.log("  1. Launch workspace");
  console.log("  2. Add new workspace");
  console.log("  3. Edit workspace");
  console.log("  4. Delete workspace");
  console.log("  5. View TOML config file");
  console.log("  6. Open config in editor");
  console.log("  7. Exit");
  console.log("");
  process.stdout.write(`${colors.yellow}Select option: ${colors.reset}`);

  const choice = await getUserInput();

  switch (choice) {
    case "1":
      await selectAndLaunchWorkspaces(null, false, false, customConfigPath);
      break;
    case "2":
      await addWorkspace(customConfigPath);
      await showMenu(customConfigPath);
      break;
    case "3":
      await editWorkspace(customConfigPath);
      await showMenu(customConfigPath);
      break;
    case "4":
      await deleteWorkspace(customConfigPath);
      await showMenu(customConfigPath);
      break;
    case "5":
      await viewConfig(customConfigPath);
      await showMenu(customConfigPath);
      break;
    case "6":
      await openConfigInEditor(customConfigPath);
      await showMenu(customConfigPath);
      break;
    case "7":
      console.log("");
      print.status("Goodbye!");
      console.log("");
      process.exit(0);
    default:
      print.error("Invalid option");
      await showMenu(customConfigPath);
  }
}
