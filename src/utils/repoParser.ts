import * as vscode from "vscode";
import * as path from "path";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";

interface FileMatch {
  name: string;
  path: string;
  type: "file" | "folder" | "component" | "function";
  matchScore: number; // Added for better match ranking
}

export class RepoParser {
  private fileCache: Map<string, string> = new Map();
  private folderCache: Map<string, string> = new Map();
  private componentCache: Map<string, string> = new Map();
  private functionCache: Map<string, string> = new Map();
  private workspacePath: string;
  private disposables: vscode.Disposable[] = [];
  private initialized: boolean = false;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.setupFileWatchers();
  }

  /**
   * Initialize the parser by scanning the workspace
   * @returns Promise<void>
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log("Initializing RepoParser...");

      // Get all files in workspace
      const files = await vscode.workspace.findFiles(
        "**/*.{ts,tsx,js,jsx,vue,scss,css,less,json,md}",
        "**/node_modules/**"
      );

      // Process each file
      for (const file of files) {
        await this.handleFileCreated(file.fsPath);
      }

      this.initialized = true;
      console.log("RepoParser initialization complete");

      // Log cache statistics
      console.log("Cache statistics:", {
        files: this.fileCache.size,
        folders: this.folderCache.size,
        components: this.componentCache.size,
        functions: this.functionCache.size,
      });
    } catch (error) {
      console.error("Error initializing RepoParser:", error);
      throw error;
    }
  }

  /**
   * Check if the parser is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset the parser state
   */
  public reset(): void {
    this.fileCache.clear();
    this.folderCache.clear();
    this.componentCache.clear();
    this.functionCache.clear();
    this.initialized = false;
  }

  private setupFileWatchers() {
    const fileWatcher = vscode.workspace.createFileSystemWatcher(
      "**/*.{ts,tsx,js,jsx,vue,scss,css,less,json,md}" // Added more file types
    );

    this.disposables.push(
      fileWatcher.onDidCreate(async (uri) => {
        await this.handleFileCreated(uri.fsPath);
      }),
      fileWatcher.onDidDelete(async (uri) => {
        await this.handleFileDeleted(uri.fsPath);
      }),
      fileWatcher.onDidChange(async (uri) => {
        await this.handleFileChanged(uri.fsPath);
      }),
      fileWatcher
    );
  }

  private async handleFileCreated(filePath: string) {
    const fileName = path.basename(filePath);
    const fileNameWithoutExt = path.parse(fileName).name;

    // Store both with and without extension
    this.fileCache.set(fileName.toLowerCase(), filePath);
    this.fileCache.set(fileNameWithoutExt.toLowerCase(), filePath);

    // Store all parent folders
    let dirPath = path.dirname(filePath);
    while (dirPath && dirPath !== this.workspacePath) {
      const folderName = path.basename(dirPath);
      this.folderCache.set(folderName.toLowerCase(), dirPath);
      dirPath = path.dirname(dirPath);
    }

    if (this.isJavaScriptFile(filePath)) {
      await this.scanForComponents(filePath);
    }
  }

  private isJavaScriptFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return [".js", ".jsx", ".ts", ".tsx", ".vue"].includes(ext);
  }

  private async handleFileDeleted(filePath: string) {
    const fileName = path.basename(filePath);
    const fileNameWithoutExt = path.parse(fileName).name;

    this.fileCache.delete(fileName.toLowerCase());
    this.fileCache.delete(fileNameWithoutExt.toLowerCase());

    // Remove components and functions
    for (const [name, path] of [
      ...this.componentCache.entries(),
      ...this.functionCache.entries(),
    ]) {
      if (path === filePath) {
        this.componentCache.delete(name);
        this.functionCache.delete(name);
      }
    }

    // Update folder cache
    await this.updateFolderCache();
  }

  private async updateFolderCache() {
    this.folderCache.clear();
    const files = await vscode.workspace.findFiles(
      "**/*",
      "**/node_modules/**"
    );

    files.forEach((file) => {
      let dirPath = path.dirname(file.fsPath);
      while (dirPath && dirPath !== this.workspacePath) {
        const folderName = path.basename(dirPath);
        this.folderCache.set(folderName.toLowerCase(), dirPath);
        dirPath = path.dirname(dirPath);
      }
    });
  }

  private async handleFileChanged(filePath: string) {
    if (this.isJavaScriptFile(filePath)) {
      // Remove old components and functions
      for (const [name, path] of [
        ...this.componentCache.entries(),
        ...this.functionCache.entries(),
      ]) {
        if (path === filePath) {
          this.componentCache.delete(name);
          this.functionCache.delete(name);
        }
      }

      await this.scanForComponents(filePath);
    }
  }

  private async scanForComponents(filePath: string) {
    try {
      const document = await vscode.workspace.openTextDocument(filePath);
      const content = document.getText();

      const ast = parser.parse(content, {
        sourceType: "module",
        plugins: ["jsx", "typescript", "decorators"],
      });

      traverse(ast, {
        ClassDeclaration: (path) => {
          if (path.node.id?.name) {
            this.componentCache.set(path.node.id.name, filePath);
          }
        },
        FunctionDeclaration: (path) => {
          if (path.node.id?.name) {
            const name = path.node.id.name;
            if (name[0] === name[0].toUpperCase()) {
              this.componentCache.set(name, filePath);
            } else {
              this.functionCache.set(name, filePath);
            }
          }
        },
        VariableDeclarator: (path) => {
          if (
            path.node.id.type === "Identifier" &&
            (path.node.init?.type === "ArrowFunctionExpression" ||
              path.node.init?.type === "FunctionExpression")
          ) {
            const name = path.node.id.name;
            if (name[0] === name[0].toUpperCase()) {
              this.componentCache.set(name, filePath);
            } else {
              this.functionCache.set(name, filePath);
            }
          }
        },
      });
    } catch (error) {
      console.error(`Error scanning file ${filePath}:`, error);
    }
  }

  findInTranscript(transcript: string): {
    updatedTranscript: string;
    matches: FileMatch[];
  } {
    const words = transcript.toLowerCase().split(/\s+/);
    const matches: FileMatch[] = [];
    const markedWords = transcript.split(/\s+/);
    const processedMatches = new Set<string>();

    // First pass: Look for multi-word matches
    for (let i = 0; i < words.length - 1; i++) {
      const twoWordPhrase = words[i] + " " + words[i + 1];
      const threeWordPhrase =
        i < words.length - 2
          ? words[i] + " " + words[i + 1] + " " + words[i + 2]
          : "";

      if (this.tryPhraseMatch(twoWordPhrase, matches, processedMatches)) {
        markedWords[i] =
          "@" + this.getOriginalName(matches[matches.length - 1].name);
        markedWords[i + 1] = ""; // Clear the second word
        i++; // Skip the next word
        continue;
      }

      if (
        threeWordPhrase &&
        this.tryPhraseMatch(threeWordPhrase, matches, processedMatches)
      ) {
        markedWords[i] =
          "@" + this.getOriginalName(matches[matches.length - 1].name);
        markedWords[i + 1] = ""; // Clear the second word
        markedWords[i + 2] = ""; // Clear the third word
        i += 2; // Skip the next two words
        continue;
      }
    }

    // Second pass: Single word matches with stricter criteria
    for (let i = 0; i < words.length; i++) {
      if (markedWords[i] === "") continue; // Skip already processed words

      const word = words[i];
      const originalWord = markedWords[i];

      // Skip common words and short terms
      if (this.isCommonWord(word) || word.length < 3) continue;

      const match = this.findBestMatch(word);
      if (match && !processedMatches.has(match.path)) {
        matches.push(match);
        processedMatches.add(match.path);
        markedWords[i] = "@" + this.getOriginalName(match.name);
      }
    }

    return {
      updatedTranscript: markedWords.filter((w) => w !== "").join(" "),
      matches: matches.sort((a, b) => b.matchScore - a.matchScore),
    };
  }

  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      "the",
      "to",
      "and",
      "in",
      "on",
      "at",
      "with",
      "by",
      "from",
      "up",
      "down",
      "for",
      "of",
      "above",
      "below",
      "change",
      "update",
      "modify",
      "set",
      "get",
      "make",
      "do",
      "does",
      "section",
      "some",
      "want",
      "need",
      "please",
      "can",
      "could",
      "would",
      "should",
      "will",
      "show",
      "me",
      "my",
      "open",
      "close",
      "save",
      "delete",
      "remove",
      "add",
      "new",
      "create",
    ]);
    return commonWords.has(word);
  }

  private findBestMatch(word: string): FileMatch | null {
    let bestMatch: FileMatch | null = null;
    let bestScore = 0.7; // Minimum threshold for matching

    const checkCache = (
      name: string,
      path: string,
      type: FileMatch["type"]
    ) => {
      const score = this.calculateMatchScore(word, name.toLowerCase());
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          name: this.getDisplayName(name, path),
          path,
          type,
          matchScore: score,
        };
      }
    };

    // Check each cache with appropriate context
    for (const [name, path] of this.fileCache.entries()) {
      checkCache(name, path, "file");
    }

    for (const [name, path] of this.componentCache.entries()) {
      checkCache(name, path, "component");
    }

    for (const [name, path] of this.functionCache.entries()) {
      // Only match functions if they're specifically referenced
      if (word.length > 4) {
        // Longer word requirement for functions
        checkCache(name, path, "function");
      }
    }

    return bestMatch;
  }

  private calculateMatchScore(word: string, target: string): number {
    // Clean the strings
    word = word.replace(/[^a-z0-9]/g, "");
    target = target.replace(/[^a-z0-9]/g, "");

    // Exact match
    if (target === word) return 1;

    // Target contains the word as a whole part
    if (target.includes(word)) {
      // Prefer matches at word boundaries
      if (
        target === word ||
        target.startsWith(word + "-") ||
        target.endsWith("-" + word) ||
        target.includes("-" + word + "-")
      ) {
        return 0.9;
      }
      return 0.8;
    }

    // Word contains the target (less preferred)
    if (word.includes(target) && target.length > 3) {
      return 0.7;
    }

    return 0; // No match
  }

  private tryPhraseMatch(
    phrase: string,
    matches: FileMatch[],
    processedMatches: Set<string>
  ): boolean {
    // Try exact matches first
    for (const [name, path] of [
      ...this.componentCache.entries(),
      ...this.fileCache.entries(),
    ]) {
      const normalizedName = name.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
      if (normalizedName === phrase && !processedMatches.has(path)) {
        matches.push({
          name: this.getDisplayName(name, path),
          path,
          type: this.componentCache.has(name) ? "component" : "file",
          matchScore: 1,
        });
        processedMatches.add(path);
        return true;
      }
    }

    // Try partial matches
    for (const [name, path] of [
      ...this.componentCache.entries(),
      ...this.fileCache.entries(),
    ]) {
      const normalizedName = name.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
      if (normalizedName.includes(phrase) && !processedMatches.has(path)) {
        matches.push({
          name: this.getDisplayName(name, path),
          path,
          type: this.componentCache.has(name) ? "component" : "file",
          matchScore: 0.9,
        });
        processedMatches.add(path);
        return true;
      }
    }

    return false;
  }

  private getOriginalName(name: string): string {
    return name;
  }

  private getDisplayName(name: string, filePath: string): string {
    if (this.componentCache.has(name)) {
      // For components, show both name and file
      const fileName = path.basename(filePath);
      return `${name} (${fileName})`;
    }
    // For files, show full name with extension
    return path.basename(filePath);
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.reset();
  }
}
