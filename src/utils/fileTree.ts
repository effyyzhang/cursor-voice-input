import * as vscode from "vscode";
import * as path from "path";
import {
  updateCache,
  getCachedFiles,
  isCacheValid,
  clearCache,
} from "./fileCache";

// Add type for file tree results
export interface FileTreeResult {
  path: string;
  type: "file" | "directory";
}

/**
 * Gets a list of all files in the workspace
 * @param useCache - Whether to use cached results if available
 * @returns Promise<string[]> Array of file paths
 */
export async function getFileTree(useCache: boolean = true): Promise<string[]> {
  // Return cached results if valid and requested
  if (useCache && isCacheValid()) {
    return Array.from(getCachedFiles());
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return [];
  }

  const files: string[] = [];

  async function walk(dir: string) {
    try {
      const entries = await vscode.workspace.fs.readDirectory(
        vscode.Uri.file(dir)
      );
      for (const [name, type] of entries) {
        const fullPath = path.join(dir, name);
        if (type === vscode.FileType.Directory) {
          await walk(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
    }
  }

  // Process all workspace folders
  await Promise.all(workspaceFolders.map((folder) => walk(folder.uri.fsPath)));

  // Update cache with new results
  updateCache(files);

  return files;
}

/**
 * Quickly check if a file exists in the workspace
 * @param fileName - Name of the file to look for
 * @returns Promise<boolean>
 */
export async function findFile(fileName: string): Promise<boolean> {
  const files = await getFileTree();
  return files.some((filePath) => path.basename(filePath) === fileName);
}

/**
 * Search for files matching a pattern
 * @param pattern - String or RegExp to match against file names
 * @returns Promise<string[]> Matching file paths
 */
export async function searchFiles(pattern: string | RegExp): Promise<string[]> {
  const files = await getFileTree();
  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);

  return files.filter((filePath) => regex.test(path.basename(filePath)));
}
