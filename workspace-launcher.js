#!/usr/bin/env bun
/**
 * Workspace Launcher
 *
 * A CLI tool to launch workspaces with custom commands.
 *
 * @author Zero
 */

import { Command } from "commander";
import chalk from "chalk";
import { launchWorkspace, setDryRun, setVerbose } from "./src/launcher.js";
import { setupGracefulShutdown, loadConfig, parseSelection, resolveWorkspaceByKeyword, print } from "./src/utils.js";

setupGracefulShutdown();

const program = new Command();

program
  .name("wl")
  .description("A CLI tool to launch workspaces with custom commands")
  .option("-c, --config <path>", "Use custom config file")
  .option("--dry-run", "Preview what would be launched without executing")
  .option("-v, --verbose", "Launch with verbose output")
  .argument("[selection]", "Workspace ID(s) or keyword (e.g., 1,3,5 or 1-3 or math)")
  .action(async (selection, opts) => {
    setDryRun(opts.dryRun || false);
    setVerbose(opts.verbose || false);

    const config = loadConfig(opts.config || null);
    const workspaces = config.workspaces;

    if (opts.dryRun) {
      console.log("");
      print.info("DRY RUN MODE - No commands will be executed");
    }

    if (!selection) {
      // No selection — list workspaces and exit
      console.log("");
      print.info(`Available Workspaces (${workspaces.length} total):`);
      console.log("");
      workspaces.forEach((workspace) => {
        const hasContent = (workspace.commands?.length > 0) || workspace.bookmarks_folder;
        const keyword = workspace.keyword ? ` ${chalk.gray(`(${workspace.keyword})`)}` : "";
        print.workspace(workspace.id, workspace.name + keyword, hasContent);
      });
      console.log("");
      process.exit(0);
    }

    // Resolve selection to workspaces
    let selectedWorkspaces = [];
    let notFoundIds = [];
    const isNumeric = /^[\d,\-\s]+$/.test(selection);

    if (isNumeric) {
      const selectedIds = parseSelection(selection);
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
      const match = resolveWorkspaceByKeyword(selection, workspaces);
      if (!match) {
        print.error(`No workspace with keyword "${selection}"`);
        console.log("");
        print.info("Available workspaces:");
        workspaces.forEach((w) => {
          const kw = w.keyword ? ` ${chalk.gray(`(${w.keyword})`)}` : "";
          print.workspace(w.id, w.name + kw, true);
        });
        console.log("");
        process.exit(1);
      }
      selectedWorkspaces = [match];
    }

    // Launch
    const launchedWorkspaces = [];
    for (const workspace of selectedWorkspaces) {
      await launchWorkspace(workspace, config);
      launchedWorkspaces.push(workspace);
    }

    console.log("");
    if (launchedWorkspaces.length > 0) {
      if (opts.dryRun) {
        print.info("Planned to launch:");
      } else {
        print.info("Successfully launched:");
      }
      launchedWorkspaces.forEach((workspace) => {
        console.log(`  ${chalk.green("•")} ${workspace.id}. ${workspace.name}`);
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
  });

program.parse();
