/**
 * Workspace management functions (add, edit, delete)
 */

import { print, loadConfig, saveConfig, getUserInput, sanitizeInput, parseSelection, validateWorkspaceName, validateCommand, CONFIG_PATH } from "./utils.js";

/**
 * Interactively prompts the user to add a new workspace.
 */
export async function addWorkspace() {
  const config = loadConfig();
  const newId = Math.max(...config.workspaces.map((w) => w.id), 0) + 1;

  console.log("");
  print.info("Add New Workspace");
  console.log("");

  // Get workspace name with validation
  let name = "";
  while (true) {
    process.stdout.write(`${print.colors.cyan}Workspace name: ${print.colors.reset}`);
    const input = sanitizeInput(await getUserInput());
    const validation = validateWorkspaceName(input, config.workspaces);
    
    if (validation.valid) {
      name = input.trim();
      break;
    } else {
      print.error(validation.error);
    }
  }

  // Get commands
  const commands = [];
  print.cyan("Enter commands (press Enter with empty line to finish):");
  while (true) {
    process.stdout.write(`  Command: `);
    const cmd = sanitizeInput(await getUserInput());
    if (!cmd) break;
    
    const validation = validateCommand(cmd);
    if (validation.warning) {
      print.error(validation.warning);
      process.stdout.write(`  Continue with this command? (y/n): `);
      const confirm = (await getUserInput()).toLowerCase();
      if (confirm !== "y" && confirm !== "yes") {
        continue;
      }
    }
    
    commands.push(cmd);
  }

  // Get bookmarks folder (optional)
  console.log("");
  print.info("Bookmarks folder (optional):");
  print.cyan("  Format: 'Bookmarks bar/folder/subfolder' or 'Other bookmarks/folder'");
  process.stdout.write(`  Folder path (or press Enter to skip): `);
  const bookmarksFolder = sanitizeInput(await getUserInput());

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
  console.log(`  ${print.colors.green}•${print.colors.reset} ${newId}. ${name}`);
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
 */
export async function editWorkspace() {
  const config = loadConfig();

  console.log("");
  print.info("Edit Workspace");
  console.log("");

  // Show workspaces
  config.workspaces.forEach((workspace) => {
    const hasContent = (workspace.commands?.length > 0) || workspace.bookmarks_folder;
    print.workspace(workspace.id, workspace.name, hasContent);
  });

  console.log("");
  process.stdout.write(
    `${print.colors.yellow}Enter workspace ID to edit: ${print.colors.reset}`
  );
  const input = sanitizeInput(await getUserInput());
  const id = parseInt(input);

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
  process.stdout.write(`${print.colors.cyan}New name (press Enter to keep "${workspace.name}"): ${print.colors.reset}`);
  const newName = sanitizeInput(await getUserInput());
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
  print.cyan("Command options:");
  console.log("  1. Keep current commands");
  console.log("  2. Replace all commands");
  console.log("  3. Add more commands");
  console.log("  4. Clear all commands");
  process.stdout.write(`${print.colors.yellow}Select option: ${print.colors.reset}`);
  const cmdOption = await getUserInput();

  switch (cmdOption) {
    case "2": // Replace
      workspace.commands = [];
      print.cyan("Enter new commands (press Enter with empty line to finish):");
      while (true) {
        process.stdout.write(`  Command: `);
        const cmd = sanitizeInput(await getUserInput());
        if (!cmd) break;
        
        const validation = validateCommand(cmd);
        if (validation.warning) {
          print.error(validation.warning);
          process.stdout.write(`  Continue with this command? (y/n): `);
          const confirm = (await getUserInput()).toLowerCase();
          if (confirm !== "y" && confirm !== "yes") {
            continue;
          }
        }
        
        workspace.commands.push(cmd);
      }
      break;

    case "3": // Add more
      print.cyan("Enter additional commands (press Enter with empty line to finish):");
      while (true) {
        process.stdout.write(`  Command: `);
        const cmd = sanitizeInput(await getUserInput());
        if (!cmd) break;
        
        const validation = validateCommand(cmd);
        if (validation.warning) {
          print.error(validation.warning);
          process.stdout.write(`  Continue with this command? (y/n): `);
          const confirm = (await getUserInput()).toLowerCase();
          if (confirm !== "y" && confirm !== "yes") {
            continue;
          }
        }
        
        workspace.commands.push(cmd);
      }
      break;

    case "4": // Clear
      workspace.commands = [];
      print.status("Commands cleared");
      break;

    default:
      print.info("Keeping current commands");
  }

  // Edit bookmarks folder
  console.log("");
  print.info(`Current bookmarks folder: ${workspace.bookmarks_folder || "(none)"}`);
  print.cyan("  Format: 'Bookmarks bar/folder/subfolder' or 'Other bookmarks/folder'");
  process.stdout.write(`  New folder path (press Enter to keep, 'clear' to remove): `);
  const newBookmarksFolder = sanitizeInput(await getUserInput());
  
  if (newBookmarksFolder.toLowerCase() === "clear") {
    delete workspace.bookmarks_folder;
    print.status("Bookmarks folder removed");
  } else if (newBookmarksFolder) {
    workspace.bookmarks_folder = newBookmarksFolder;
  }

  config.workspaces[workspaceIndex] = workspace;
  saveConfig(config);

  console.log("");
  print.info("Workspace updated successfully:");
  console.log(`  ${print.colors.green}•${print.colors.reset} ${workspace.id}. ${workspace.name}`);
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
 */
export async function deleteWorkspace() {
  const config = loadConfig();

  console.log("");
  print.info("Delete Workspace");
  console.log("");

  config.workspaces.forEach((workspace) => {
    const hasContent = (workspace.commands?.length > 0) || workspace.bookmarks_folder;
    print.workspace(workspace.id, workspace.name, hasContent);
  });

  console.log("");
  process.stdout.write(
    `${print.colors.yellow}Enter workspace ID(s) to delete (e.g., 1,3,5 or 1-3): ${print.colors.reset}`
  );
  const input = sanitizeInput(await getUserInput());

  const idsToDelete = parseSelection(input);

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
    console.log(`  ${print.colors.red}•${print.colors.reset} ${workspace.id}. ${workspace.name}`);
  });

  console.log("");
  process.stdout.write(`${print.colors.red}Are you sure? (yes/no): ${print.colors.reset}`);
  const confirmation = (await getUserInput()).toLowerCase();

  if (confirmation !== "yes") {
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
    saveConfig(config);
    console.log("");
    print.info("Successfully deleted:");
    deletedWorkspaces.reverse().forEach((workspace) => {
      console.log(
        `  ${print.colors.green}•${print.colors.reset} ${workspace.id}. ${workspace.name}`
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
