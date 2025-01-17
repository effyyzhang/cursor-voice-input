// At the very top of the file
import * as vscode from "vscode";
import { getFileTree, findFile, searchFiles } from "./utils/fileTree";
import { clearCache } from "./utils/fileCache";
import { RepoParser } from "./utils/repoParser";
import * as path from "path";

let repoParser: RepoParser | undefined;

// Make activate function async
export async function activate(context: vscode.ExtensionContext) {
  try {
    console.log("Starting Voice Input extension activation...");

    // Initialize RepoParser when workspace is available
    if (vscode.workspace.workspaceFolders) {
      repoParser = new RepoParser(
        vscode.workspace.workspaceFolders[0].uri.fsPath
      );
      await repoParser.initialize();
      console.log("RepoParser initialized successfully");
    }

    // Register commands
    const fileTreeCommand = vscode.commands.registerCommand(
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

    const searchCommand = vscode.commands.registerCommand(
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

    const testParserCommand = vscode.commands.registerCommand(
      "cursor-voice-input.testParser",
      async () => {
        console.log("Testing RepoParser...");

        // Check workspace
        if (!vscode.workspace.workspaceFolders) {
          vscode.window.showErrorMessage("No workspace folder is open");
          return;
        }

        // Ensure RepoParser is initialized
        if (!repoParser) {
          try {
            repoParser = new RepoParser(
              vscode.workspace.workspaceFolders[0].uri.fsPath
            );
            await repoParser.initialize();
          } catch (error) {
            console.error("Failed to initialize RepoParser:", error);
            vscode.window.showErrorMessage("Failed to initialize parser");
            return;
          }
        }

        const input = await vscode.window.showInputBox({
          prompt: "Enter a message to parse",
          placeHolder: "e.g., Show me the Button component",
        });

        if (!input) return;

        try {
          const result = repoParser.findInTranscript(input);

          // Create output channel
          const outputChannel =
            vscode.window.createOutputChannel("Parser Test");
          outputChannel.clear();
          outputChannel.show();

          // Show results
          outputChannel.appendLine("Parser Test Results:");
          outputChannel.appendLine(`Original: ${input}`);
          outputChannel.appendLine(`Processed: ${result.updatedTranscript}`);

          if (result.matches.length === 0) {
            outputChannel.appendLine("\nNo matches found");
            return;
          }

          // Sort and display matches
          const sortedMatches = result.matches.sort(
            (a, b) => b.matchScore - a.matchScore
          );

          outputChannel.appendLine("\nMatched Files:");
          sortedMatches.forEach((match) => {
            const relativePath = path.relative(
              vscode.workspace.workspaceFolders![0].uri.fsPath,
              match.path
            );
            outputChannel.appendLine(
              `- ${match.type}: ${match.name} (score: ${match.matchScore.toFixed(2)})`
            );
            outputChannel.appendLine(`  Path: ${relativePath}`);
          });

          // Create QuickPick for file selection
          const quickPick = vscode.window.createQuickPick();
          quickPick.items = sortedMatches.map((match) => ({
            label: match.name,
            description: `${match.type} (score: ${match.matchScore.toFixed(2)})`,
            detail: path.relative(
              vscode.workspace.workspaceFolders![0].uri.fsPath,
              match.path
            ),
          }));

          quickPick.onDidChangeSelection(async ([item]) => {
            if (item) {
              try {
                const fullPath = path.join(
                  vscode.workspace.workspaceFolders![0].uri.fsPath,
                  item.detail || ""
                );
                const doc = await vscode.workspace.openTextDocument(fullPath);
                await vscode.window.showTextDocument(doc);
              } catch (error) {
                console.error("Error opening file:", error);
                vscode.window.showErrorMessage(`Failed to open file: ${error}`);
              } finally {
                quickPick.dispose();
              }
            }
          });

          quickPick.onDidHide(() => quickPick.dispose());
          quickPick.show();
        } catch (error) {
          console.error("Parser error:", error);
          vscode.window.showErrorMessage(`Parser error: ${error}`);
        }
      }
    );

    // Register workspace change handler
    const workspaceHandler = vscode.workspace.onDidChangeWorkspaceFolders(
      async () => {
        if (repoParser) {
          repoParser.dispose();
        }
        if (vscode.workspace.workspaceFolders) {
          repoParser = new RepoParser(
            vscode.workspace.workspaceFolders[0].uri.fsPath
          );
          await repoParser.initialize();
        }
      }
    );

    // Add to subscriptions
    context.subscriptions.push(
      fileTreeCommand,
      searchCommand,
      testParserCommand,
      workspaceHandler
    );

    console.log("Voice Input extension activated successfully");
  } catch (error) {
    console.error("Failed to activate extension:", error);
    vscode.window.showErrorMessage(`Extension activation failed: ${error}`);
  }
}

// This method is called when your extension is deactivated
export function deactivate() {
  if (repoParser) {
    repoParser.dispose();
  }
}
