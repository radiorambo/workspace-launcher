/**
 * Bookmark handling functions for workspace-launcher
 */

import { readFileSync, existsSync } from "fs";
import { print } from "./utils.js";

/**
 * Gets the Chrome bookmarks file path from config.
 * @param {Object} config - The configuration object.
 * @returns {string|null} The path to the bookmarks file or null if not configured.
 */
export function getBookmarksFilePath(config) {
  return config.settings?.bookmarks_file || null;
}

/**
 * Loads and parses the Chrome bookmarks file.
 * @param {string} bookmarksPath - Path to the bookmarks file.
 * @returns {Object|null} The parsed bookmarks object or null if not found.
 */
export function loadBookmarksFile(bookmarksPath) {
  if (!existsSync(bookmarksPath)) {
    print.error(`Bookmarks file not found: ${bookmarksPath}`);
    print.info("Tip: Check your bookmarks_file path in config.toml");
    print.info("Common paths:");
    print.info("  Chrome:   ~/.config/google-chrome/Default/Bookmarks");
    print.info("  Chromium: ~/.config/chromium/Default/Bookmarks");
    print.info("  Brave:    ~/.config/BraveSoftware/Brave-Browser/Default/Bookmarks");
    return null;
  }
  
  try {
    return JSON.parse(readFileSync(bookmarksPath, "utf-8"));
  } catch (error) {
    print.error(`Failed to parse bookmarks file: ${error.message}`);
    print.info("Tip: Ensure the bookmarks file is valid JSON");
    return null;
  }
}

/**
 * Finds a folder in the bookmarks structure by path.
 * Path format: "Bookmarks bar/folder1/subfolder" or "Other bookmarks/folder"
 * @param {Object} bookmarks - The parsed bookmarks object.
 * @param {string} folderPath - The path to the folder (e.g., "Bookmarks bar/test").
 * @returns {Object|null} The folder object or null if not found.
 */
export function findBookmarkFolder(bookmarks, folderPath) {
  const parts = folderPath.split("/").map((p) => p.trim());
  const roots = bookmarks.roots;

  // Map common names to root keys
  const rootMap = {
    "Bookmarks bar": roots.bookmark_bar,
    "bookmark_bar": roots.bookmark_bar,
    "Other bookmarks": roots.other,
    "other": roots.other,
    "Mobile bookmarks": roots.synced,
    "synced": roots.synced,
  };

  // Start from the appropriate root
  let current = rootMap[parts[0]];
  if (!current) {
    print.error(`Root folder not found: ${parts[0]}`);
    print.info("Available roots: Bookmarks bar, Other bookmarks, Mobile bookmarks");
    return null;
  }

  // Navigate through the path
  for (let i = 1; i < parts.length; i++) {
    if (!current.children) {
      print.error(`"${parts[i - 1]}" is not a folder`);
      return null;
    }

    const child = current.children.find(
      (c) => c.name === parts[i] && c.type === "folder"
    );

    if (!child) {
      print.error(`Folder not found: ${parts[i]} in ${parts.slice(0, i).join("/")}`);
      print.info("Tip: Check the folder name spelling and path");
      return null;
    }
    current = child;
  }

  return current;
}

/**
 * Extracts all URLs from a bookmark folder (including nested folders).
 * @param {Object} folder - The bookmark folder object.
 * @param {boolean} recursive - Whether to include URLs from subfolders.
 * @returns {Array<{name: string, url: string}>} Array of bookmark objects.
 */
export function extractUrlsFromFolder(folder, recursive = true) {
  const urls = [];

  if (!folder.children) return urls;

  for (const item of folder.children) {
    if (item.type === "url") {
      urls.push({ name: item.name, url: item.url });
    } else if (item.type === "folder" && recursive) {
      urls.push(...extractUrlsFromFolder(item, recursive));
    }
  }

  return urls;
}

/**
 * Gets all URLs from a bookmarks folder path.
 * @param {string} bookmarksFilePath - Path to the bookmarks file.
 * @param {string} folderPath - Path to the folder within bookmarks.
 * @returns {Array<{name: string, url: string}>} Array of bookmark objects.
 */
export function getBookmarksFromFolder(bookmarksFilePath, folderPath) {
  const bookmarks = loadBookmarksFile(bookmarksFilePath);
  if (!bookmarks) return [];

  const folder = findBookmarkFolder(bookmarks, folderPath);
  if (!folder) return [];

  return extractUrlsFromFolder(folder);
}
