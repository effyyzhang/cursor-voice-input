// At the very top of the file
console.log("Loading Voice Input extension...");

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { getFileTree, findFile, searchFiles } from "./utils/fileTree.js";
import { clearCache } from "./utils/fileCache.js";

console.log("Hello World from cursor-voice-input!");

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  try {
    // Make this more visible
    vscode.window.showInformationMessage(
      "Voice Input extension is now active!"
    );
    console.log("Starting Voice Input extension activation...");

    // Debug: List all registered commands
    vscode.commands.getCommands(true).then(
      (commands) => {
        console.log("All registered commands:", commands);
      },
      (error) => {
        console.error("Failed to get commands:", error);
      }
    );

    // Register commands
    console.log("Registering Voice Input commands...");

    let fileTreeCommand = vscode.commands.registerCommand(
      "cursor-voice-input.getFileTree",
      async () => {
        console.log("File Tree command triggered");
        try {
          const files = await getFileTree(false);
          console.log("Workspace files:", files);
          vscode.window.showInformationMessage(
            `Found ${files.length} files in workspace`
          );
        } catch (error) {
          console.error("Error getting file tree:", error);
          vscode.window.showErrorMessage("Failed to get file tree");
        }
      }
    );

    let searchCommand = vscode.commands.registerCommand(
      "cursor-voice-input.searchFiles",
      async () => {
        console.log("Search Files command triggered");
        const pattern = await vscode.window.showInputBox({
          prompt: "Enter search pattern",
          placeHolder: "e.g., *.ts or ^test",
        });

        if (pattern) {
          const matches = await searchFiles(pattern);
          console.log("Matching files:", matches);
          vscode.window.showInformationMessage(
            `Found ${matches.length} matching files`
          );
        }
      }
    );

    // Add command registration confirmation
    vscode.commands.getCommands(true).then((commands) => {
      const ourCommands = commands.filter((cmd) =>
        cmd.startsWith("cursor-voice-input")
      );
      console.log("Our registered commands:", ourCommands);
    });

    context.subscriptions.push(fileTreeCommand, searchCommand);
    console.log("Voice Input commands registered successfully");
  } catch (error) {
    console.error("Failed to activate extension:", error);
    vscode.window.showErrorMessage(`Extension activation failed: ${error}`);
  }

  console.log("Voice Input extension activated successfully");

  // Clear cache when workspace changes
  vscode.workspace.onDidChangeWorkspaceFolders(() => clearCache());
}

// This method is called when your extension is deactivated
export function deactivate() {}
