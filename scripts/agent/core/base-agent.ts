import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import path from "path";
import { AgentStep } from "../types";
import { logStep } from "../utils";

// Tool configuration for agentic behavior
const TOOLS_CONFIG = {
  systemInstruction: `You are an advanced database agent for Next.js projects. You MUST use the provided tools to explore the project structure, read files, write files, and execute commands. You should work iteratively, using tools to understand the project context before making changes.

Key capabilities:
- Analyze project structure using list_files
- Read existing code using read_file
- Create/modify files using write_file
- Execute commands using execute_command
- Generate database schemas, API routes, and frontend integrations

Always use tools to understand the current state before making changes. Be methodical and iterative in your approach.`,
  tools: [
    {
      functionDeclarations: [
        {
          name: "list_files",
          description: "List files and directories in a specified path",
          parameters: {
            type: SchemaType.OBJECT,
            properties: {
              path: {
                type: SchemaType.STRING,
                description:
                  "Directory path to list (default: current directory)",
              },
            },
          },
        },
        {
          name: "read_file",
          description: "Read the contents of a file",
          parameters: {
            type: SchemaType.OBJECT,
            properties: {
              filepath: {
                type: SchemaType.STRING,
                description: "Path to the file to read",
              },
            },
            required: ["filepath"],
          },
        },
        {
          name: "write_file",
          description:
            "Write content to a file (creates directories if needed)",
          parameters: {
            type: SchemaType.OBJECT,
            properties: {
              filepath: {
                type: SchemaType.STRING,
                description: "Path to the file to write",
              },
              content: {
                type: SchemaType.STRING,
                description: "Content to write to the file",
              },
            },
            required: ["filepath", "content"],
          },
        },
        {
          name: "execute_command",
          description: "Execute a shell command",
          parameters: {
            type: SchemaType.OBJECT,
            properties: {
              command: {
                type: SchemaType.STRING,
                description: "Command to execute",
              },
              directory: {
                type: SchemaType.STRING,
                description: "Working directory for command (optional)",
              },
            },
            required: ["command"],
          },
        },
        {
          name: "analyze_project",
          description:
            "Get comprehensive project analysis including structure and existing schemas",
          parameters: {
            type: SchemaType.OBJECT,
            properties: {},
          },
        },
      ],
    },
  ],
  toolConfig: { functionCallingConfig: { mode: "AUTO" } },
};

export abstract class BaseAgent {
  protected genAI: GoogleGenerativeAI | null;
  protected model: any;
  protected spinner: any;
  private conversationHistory: any[] = [];

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log(
        chalk.yellow("⚠️  No GEMINI_API_KEY found - running in demo mode")
      );
      console.log(
        chalk.gray(
          "   Add your API key to .env for full AI-powered functionality\n"
        )
      );
    }
    this.genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
    this.model =
      apiKey && this.genAI
        ? this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
        : null;
  }

  protected log(step: AgentStep) {
    logStep(step.type, step.message);
  }

  protected startSpinner(message: string) {
    this.spinner = ora(chalk.yellow(message)).start();
  }

  protected stopSpinner(success: boolean = true, message?: string) {
    if (this.spinner) {
      success
        ? this.spinner.succeed(chalk.green(message || "Done"))
        : this.spinner.fail(chalk.red(message || "Failed"));
    }
  }

  /**
   * Execute an agentic conversation with tool calling support
   */
  protected async executeAgenticWorkflow(
    query: string,
    verbose: boolean = false
  ): Promise<string> {
    if (!this.model) {
      throw new Error("Gemini model not available. Please set GEMINI_API_KEY.");
    }

    // Initialize conversation with the user query
    this.conversationHistory = [{ role: "user", parts: [{ text: query }] }];

    this.log({ type: "thinking", message: "Starting agentic workflow..." });

    let response = await this.model.generateContent({
      contents: this.conversationHistory,
      ...TOOLS_CONFIG,
    });

    // Agent feedback loop - continue until no more tools needed
    let iterations = 0;
    const maxIterations = 15; // Increased for more complex operations

    while (response.functionCalls && iterations < maxIterations) {
      const toolCall = response.functionCalls[0];

      if (verbose) {
        console.log(
          chalk.cyan(
            `🔧 Tool ${iterations + 1}: ${toolCall.name}(${JSON.stringify(
              toolCall.args || {}
            )})`
          )
        );
      }

      // Execute the tool and get result
      const result = await this.executeTool(toolCall);

      // Add tool call and result to history
      this.conversationHistory.push({
        role: "model",
        parts: [{ functionCall: toolCall }],
      });
      this.conversationHistory.push({
        role: "function",
        parts: [
          { functionResponse: { name: toolCall.name, response: { result } } },
        ],
      });

      // Get next AI response
      response = await this.model.generateContent({
        contents: this.conversationHistory,
        ...TOOLS_CONFIG,
      });

      iterations++;
    }

    // Add final response to history
    const finalText = response.text();
    this.conversationHistory.push({
      role: "model",
      parts: [{ text: finalText }],
    });

    if (iterations >= maxIterations) {
      console.log(chalk.yellow("⚠️  Reached maximum tool iterations"));
    }

    return finalText;
  }

  /**
   * Execute a tool call and return the result
   */
  private async executeTool(call: any): Promise<any> {
    try {
      switch (call.name) {
        case "list_files":
          return this.listFiles(call.args?.path || ".");
        case "read_file":
          return this.readFile(call.args.filepath);
        case "write_file":
          return this.writeFile(call.args.filepath, call.args.content);
        case "execute_command":
          return this.executeCommand(call.args.command, call.args.directory);
        case "analyze_project":
          return this.analyzeProject();
        default:
          throw new Error(`Unknown tool: ${call.name}`);
      }
    } catch (error: any) {
      return `Error executing ${call.name}: ${error.message}`;
    }
  }

  /**
   * List files in a directory
   */
  private listFiles(dirPath: string): string[] {
    try {
      const fullPath = path.resolve(dirPath);
      return fs.readdirSync(fullPath);
    } catch (error: any) {
      return [`Error listing files: ${error.message}`];
    }
  }

  /**
   * Read file contents
   */
  private readFile(filepath: string): string {
    try {
      return fs.readFileSync(filepath, "utf8");
    } catch (error: any) {
      return `Error reading file: ${error.message}`;
    }
  }

  /**
   * Write content to a file
   */
  private writeFile(filepath: string, content: string): string {
    try {
      // Ensure directory exists
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filepath, content, "utf8");
      return `Successfully wrote to ${filepath}`;
    } catch (error: any) {
      return `Error writing file: ${error.message}`;
    }
  }

  /**
   * Execute a shell command
   */
  private executeCommand(command: string, directory?: string): string {
    try {
      const { execSync } = require("child_process");
      const options: any = { encoding: "utf8" };
      if (directory) {
        options.cwd = directory;
      }

      const result = execSync(command, options);
      return result.toString();
    } catch (error: any) {
      return `Command failed: ${error.message}`;
    }
  }

  /**
   * Analyze the current project structure
   */
  private analyzeProject(): string {
    try {
      const analysis = {
        hasNextConfig:
          fs.existsSync("next.config.ts") || fs.existsSync("next.config.js"),
        hasPackageJson: fs.existsSync("package.json"),
        hasDrizzleConfig: fs.existsSync("drizzle.config.ts"),
        hasDatabase: fs.existsSync("src/db"),
        hasApiRoutes: fs.existsSync("src/app/api"),
        hasComponents: fs.existsSync("src/components"),
        directories: {
          src: fs.existsSync("src") ? fs.readdirSync("src") : [],
          srcDb: fs.existsSync("src/db") ? fs.readdirSync("src/db") : [],
          apiRoutes: fs.existsSync("src/app/api")
            ? fs.readdirSync("src/app/api")
            : [],
          components: fs.existsSync("src/components")
            ? fs.readdirSync("src/components")
            : [],
        },
      };

      return JSON.stringify(analysis, null, 2);
    } catch (error: any) {
      return `Error analyzing project: ${error.message}`;
    }
  }

  /**
   * Get conversation history for debugging
   */
  public getConversationHistory(): any[] {
    return this.conversationHistory;
  }

  /**
   * Clear conversation history
   */
  public clearHistory(): void {
    this.conversationHistory = [];
  }
}
