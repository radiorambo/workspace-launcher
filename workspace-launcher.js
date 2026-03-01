#!/usr/bin/env bun
/**
 * Workspace Launcher
 *
 * An interactive CLI tool to launch workspaces with custom commands.
 *
 * @author Zero
 * @version 0.3.0
 */

import { Command } from "commander";
import { showMenu, selectAndLaunchWorkspaces } from "./src/ui.js";
import { addWorkspace, editWorkspace, deleteWorkspace } from "./src/management.js";
import { setupGracefulShutdown, VERSION } from "./src/utils.js";

// Setup graceful shutdown
setupGracefulShutdown();

const program = new Command();

program
  .name("wl")
  .description("An interactive CLI tool to launch workspaces with custom commands")
  .version(`Workspace Launcher v${VERSION}`, "-V, --version")
  .option("-c, --config <path>", "Use custom config file");

program
  .command("launch [selection]")
  .description("Launch workspace (supports: 1,3,5 or 1-3 or keyword)")
  .option("--dry-run", "Preview what would be launched without executing")
  .option("-v, --verbose", "Launch with verbose output")
  .action(async (selection, opts) => {
    const globalOpts = program.opts();
    await selectAndLaunchWorkspaces(selection || null, opts.dryRun || false, opts.verbose || false, globalOpts.config || null);
  });

program
  .command("add")
  .description("Add a new workspace")
  .action(async () => {
    await addWorkspace(program.opts().config || null);
  });

program
  .command("edit")
  .description("Edit an existing workspace")
  .action(async () => {
    await editWorkspace(program.opts().config || null);
  });

program
  .command("delete")
  .description("Delete workspace (supports: 1,3,5 or 1-3)")
  .action(async () => {
    await deleteWorkspace(program.opts().config || null);
  });

// Default action — show interactive menu
program.action(async () => {
  await showMenu(program.opts().config || null);
});

program.parse();
