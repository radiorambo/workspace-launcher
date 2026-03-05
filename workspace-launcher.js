#!/usr/bin/env bun
/**
 * Workspace Launcher
 *
 * A CLI tool to launch workspaces with custom commands.
 *
 * @author Zero
 */

import { parseArgs } from "util";
import { launchWorkspace, setDryRun, setVerbose } from "./src/launcher.js";
import { setupGracefulShutdown, loadConfig, parseSelection, resolveWorkspaceByKeyword, print, color } from "./src/utils.js";

async function main() {
  try {
    setupGracefulShutdown();

    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        config: { type: 'string', short: 'c' },
        'dry-run': { type: 'boolean' },
        verbose: { type: 'boolean', short: 'v' },
        help: { type: 'boolean', short: 'h' },
      },
      strict: false,
      allowPositionals: true,
    });

    const selection = positionals[0];
    const opts = values;

    if (opts.help) {
      console.log(`
Usage: wl [options] [selection]

A CLI tool to launch workspaces with custom commands

Arguments:
  selection             Workspace ID(s) or keyword (e.g., 1,3,5 or 1-3 or math)

Options:
  -c, --config <path>   Use custom config file
  --dry-run             Preview what would be launched without executing
  -v, --verbose         Launch with verbose output
  -h, --help            Display help for command
`);
      process.exit(0);
    }

    setDryRun(opts['dry-run'] || false);
    setVerbose(opts.verbose || false);

    const config = loadConfig(opts.config || null);
    const workspaces = config.workspaces;

    if (opts['dry-run']) {
      console.log("");
      print.info("DRY RUN MODE - No commands will be executed");
    }

    if (!selection) {
      console.log("");
      print.info(`Available Workspaces (${workspaces.length} total):`);
      console.log("");
      workspaces.forEach((workspace) => {
        const hasContent = (workspace.commands?.length > 0) || workspace.bookmarks_folder;
        const keyword = workspace.keyword ? ` ${color.gray}(${workspace.keyword})${color.reset}` : "";
        print.workspace(workspace.id, workspace.name + keyword, hasContent);
      });
      console.log("");
      process.exit(0);
    }

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
          const kw = w.keyword ? ` ${color.gray}(${w.keyword})${color.reset}` : "";
          print.workspace(w.id, w.name + kw, true);
        });
        console.log("");
        process.exit(1);
      }
      selectedWorkspaces = [match];
    }

    const launchedWorkspaces = [];
    for (const workspace of selectedWorkspaces) {
      await launchWorkspace(workspace, config);
      launchedWorkspaces.push(workspace);
    }

    console.log("");
    if (launchedWorkspaces.length > 0) {
      if (opts['dry-run']) {
        print.info("Planned to launch:");
      } else {
        print.info("Successfully launched:");
      }
      launchedWorkspaces.forEach((workspace) => {
        console.log(`  ${color.green}•${color.reset} ${workspace.id}. ${workspace.name}`);
      });
    }

    if (notFoundIds.length > 0) {
      console.log("");
      notFoundIds.forEach((id) => print.error(`Workspace #${id} not found`));
    }

    console.log("");
    process.exit(0);
  } catch (err) {
    console.error("\nCritical Error:\n", err);
    process.exit(1);
  }
}

main();
