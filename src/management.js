/**
 * Workspace management functions (add, edit, delete)
 */

import { input, select, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { print, loadConfig, saveConfig, sanitizeInput, parseSelection, validateWorkspaceName, validateCommand, CONFIG_PATH } from "./utils.js";

/**
 * Interactively prompts the user to add a new workspace.
 * @param {string} customConfigPath - Optional custom config file path
 */
export async function addWorkspace(customConfigPath = null) {
  const config = loadConfig(customConfigPath);
  const newId = Math.max(...config.workspaces.map((w) => w.id), 0) + 1;

  console.log("");
  print.info("Add New Workspace");
  console.log("");

  // Get workspace name with validation
  const name = await input({
    message: "Workspace name:",
    validate: (value) => {
      const validation = validateWorkspaceName(value, config.workspaces);
      return validation.valid ? true : validation.error;
    },
  });

  // Get commands
  const commands = [];
  print.cyan("Enter commands (leave empty and press Enter to finish):");
  while (true) {
    const cmd = sanitizeInput(await input({ message: "  Command:" }));
    if (!cmd) break;
    
    const validation = validateCommand(cmd);
    if (validation.warning) {
      print.error(validation.warning);
      const shouldContinue = await confirm({ message: "Continue with this command?" });
      if (!shouldContinue) continue;
    }
    
    commands.push(cmd);
  }

  // Get bookmarks folder (optional)
  console.log("");
  print.info("Bookmarks folder (optional):");
  print.cyan("  Format: 'Bookmarks bar/folder/subfolder' or 'Other bookmarks/folder'");
  const bookmarksFolder = sanitizeInput(await input({
    message: "Folder path (or press Enter to skip):",
  }));

  const newWorkspace = {
    id: newId,
    name: name.trim(),
    commands,
  };

  // Only add bookmarks_folder if provided
  if (bookmarksFolder) {
    newWorkspace.bookmarks_folder = bookmarksFolder;
  }

  config.workspaces.push(newWorkspace);
  saveConfig(config, customConfigPath);

  console.log("");
  print.info("Workspace added successfully:");
  console.log(`  ${chalk.green("•")} ${newId}. ${name.trim()}`);
  if (commands.length > 0) {
    print.status(`Added: ${commands.length} command(s)`);
  }
  if (bookmarksFolder) {
    print.status(`Bookmarks folder: ${bookmarksFolder}`);
  }
  console.log("");
}

/**
 * Interactively prompts the user to edit an existing workspace.
 * @param {string} customConfigPath - Optional custom config file path
 */
export async function editWorkspace(customConfigPath = null) {
  const config = loadConfig(customConfigPath);

  console.log("");
  print.info("Edit Workspace");
  console.log("");

  // Show workspaces
  config.workspaces.forEach((workspace) => {
    const hasContent = (workspace.commands?.length > 0) || workspace.bookmarks_folder;
    print.workspace(workspace.id, workspace.name, hasContent);
  });

  console.log("");
  const idInput = sanitizeInput(await input({ message: "Enter workspace ID to edit:" }));
  const id = parseInt(idInput);

  if (isNaN(id)) {
    print.error("Invalid workspace ID");
    console.log("");
    return;
  }

  const workspaceIndex = config.workspaces.findIndex((w) => w.id === id);
  if (workspaceIndex === -1) {
    print.error(`Workspace #${id} not found`);
    console.log("");
    return;
  }

  const workspace = config.workspaces[workspaceIndex];

  console.log("");
  print.info(`Editing: ${workspace.name}`);
  console.log("");

  // Edit name
  const newName = sanitizeInput(await input({
    message: `New name (press Enter to keep "${workspace.name}"):`,
  }));
  if (newName) {
    const validation = validateWorkspaceName(newName, config.workspaces.filter(w => w.id !== id));
    if (validation.valid) {
      workspace.name = newName;
    } else {
      print.error(validation.error);
      print.info("Keeping original name");
    }
  }

  // Edit commands
  console.log("");
  print.info("Current commands:");
  if (workspace.commands && workspace.commands.length > 0) {
    workspace.commands.forEach((cmd, index) => {
      console.log(`  ${index + 1}. ${cmd}`);
    });
  } else {
    print.info("  (none)");
  }

  console.log("");
  const cmdOption = await select({
    message: "Command options:",
    choices: [
      { name: "Keep current commands", value: "keep" },
      { name: "Replace all commands", value: "replace" },
      { name: "Add more commands", value: "add" },
      { name: "Clear all commands", value: "clear" },
    ],
  });

  if (cmdOption === "replace" || cmdOption === "add") {
    if (cmdOption === "replace") workspace.commands = [];
    const label = cmdOption === "replace" ? "Enter new commands" : "Enter additional commands";
    print.cyan(`${label} (leave empty and press Enter to finish):`);
    while (true) {
      const cmd = sanitizeInput(await input({ message: "  Command:" }));
      if (!cmd) break;
      
      const validation = validateCommand(cmd);
      if (validation.warning) {
        print.error(validation.warning);
        const shouldContinue = await confirm({ message: "Continue with this command?" });
        if (!shouldContinue) continue;
      }
      
      workspace.commands.push(cmd);
    }
  } else if (cmdOption === "clear") {
    workspace.commands = [];
    print.status("Commands cleared");
  } else {
    print.info("Keeping current commands");
  }

  // Edit bookmarks folder
  console.log("");
  print.info(`Current bookmarks folder: ${workspace.bookmarks_folder || "(none)"}`);
  print.cyan("  Format: 'Bookmarks bar/folder/subfolder' or 'Other bookmarks/folder'");
  const newBookmarksFolder = sanitizeInput(await input({
    message: "New folder path (press Enter to keep, 'clear' to remove):",
  }));
  
  if (newBookmarksFolder.toLowerCase() === "clear") {
    delete workspace.bookmarks_folder;
    print.status("Bookmarks folder removed");
  } else if (newBookmarksFolder) {
    workspace.bookmarks_folder = newBookmarksFolder;
  }

  config.workspaces[workspaceIndex] = workspace;
  saveConfig(config, customConfigPath);

  console.log("");
  print.info("Workspace updated successfully:");
  console.log(`  ${chalk.green("•")} ${workspace.id}. ${workspace.name}`);
  if (workspace.commands?.length > 0) {
    print.status(`Commands: ${workspace.commands.length}`);
  }
  if (workspace.bookmarks_folder) {
    print.status(`Bookmarks folder: ${workspace.bookmarks_folder}`);
  }
  console.log("");
}

/**
 * Interactively prompts the user to delete one or more workspaces.
 * @param {string} customConfigPath - Optional custom config file path
 */
export async function deleteWorkspace(customConfigPath = null) {
  const config = loadConfig(customConfigPath);

  console.log("");
  print.info("Delete Workspace");
  console.log("");

  config.workspaces.forEach((workspace) => {
    const hasContent = (workspace.commands?.length > 0) || workspace.bookmarks_folder;
    print.workspace(workspace.id, workspace.name, hasContent);
  });

  console.log("");
  const idInput = sanitizeInput(await input({
    message: "Enter workspace ID(s) to delete (e.g., 1,3,5 or 1-3):",
  }));

  const idsToDelete = parseSelection(idInput);

  if (idsToDelete.length === 0) {
    print.error("No valid workspace IDs provided");
    console.log("");
    return;
  }

  // Show what will be deleted and ask for confirmation
  const workspacesToDelete = [];
  const notFoundIds = [];

  for (const id of idsToDelete) {
    const workspace = config.workspaces.find((w) => w.id === id);
    if (workspace) {
      workspacesToDelete.push(workspace);
    } else {
      notFoundIds.push(id);
    }
  }

  if (workspacesToDelete.length === 0) {
    print.error("No valid workspaces found to delete");
    console.log("");
    return;
  }

  console.log("");
  print.info("The following workspaces will be deleted:");
  workspacesToDelete.forEach((workspace) => {
    console.log(`  ${chalk.red("•")} ${workspace.id}. ${workspace.name}`);
  });

  console.log("");
  const confirmed = await confirm({ message: "Are you sure?", default: false });

  if (!confirmed) {
    print.info("Deletion cancelled");
    console.log("");
    return;
  }

  // Delete workspaces in reverse order to avoid index issues
  const deletedWorkspaces = [];
  for (const id of idsToDelete.sort((a, b) => b - a)) {
    const index = config.workspaces.findIndex((w) => w.id === id);
    if (index !== -1) {
      const deleted = config.workspaces.splice(index, 1)[0];
      deletedWorkspaces.push(deleted);
    }
  }

  if (deletedWorkspaces.length > 0) {
    saveConfig(config, customConfigPath);
    console.log("");
    print.info("Successfully deleted:");
    deletedWorkspaces.reverse().forEach((workspace) => {
      console.log(
        `  ${chalk.green("•")} ${workspace.id}. ${workspace.name}`
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
