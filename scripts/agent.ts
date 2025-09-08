#!/usr/bin/env tsx

import { Command } from "commander";
import chalk from "chalk";
import dotenv from "dotenv";
import readline from "readline";
import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import path from "path";
import { DatabaseAgent } from "./agent/databaseAgent";

dotenv.config();

// Tool configuration for the agentic system
const TOOLS_CONFIG = {
  systemInstruction: `You are an advanced Database Agent for Orchids - a sophisticated AI system that creates full-stack database implementations.

Your capabilities include:
- Analyzing project structure and existing code
- Generating database schemas with Drizzle ORM
- Creating API routes for CRUD operations
- Generating realistic seed data
- Integrating frontend components with database APIs
- Running migrations and validating schemas

You MUST use the available tools to explore the project structure and understand the codebase before making any changes. Always start by listing files and reading relevant code to understand the context.

When a user asks for database features, you should:
1. Explore the project structure using list_files and read_file
2. Analyze existing schemas and components
3. Generate appropriate database schemas
4. Create API endpoints
5. Integrate with the frontend UI
6. Provide real-time updates on your progress

Use the tools extensively to understand the project before implementing changes.`,
  tools: [
    {
      name: "list_files",
      description:
        "List files and directories in the current directory or a specified path",
      parameters: {
        type: Type.OBJECT,
        properties: {
          path: {
            type: Type.STRING,
            description:
              "Optional path to list (defaults to current directory)",
          },
        },
      },
    },
    {
      name: "read_file",
      description: "Read the contents of a file",
      parameters: {
        type: Type.OBJECT,
        properties: {
          filename: {
            type: Type.STRING,
            description: "Path to the file to read",
          },
        },
      },
    },
    {
      name: "implement_database_feature",
      description:
        "Implement a database feature using the Orchids Database Agent",
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description:
              "Natural language description of the database feature to implement",
          },
        },
      },
    },
  ],
  toolConfig: { functionCallingConfig: { mode: "AUTO" } },
};

// Execute a tool call and return the result
async function executeTool(call: any): Promise<string> {
  try {
    if (call.name === "list_files") {
      const targetPath = call.args?.path || ".";
      const fullPath = path.resolve(targetPath);
      if (!fs.existsSync(fullPath)) {
        return `Error: Path '${targetPath}' does not exist`;
      }
      const items = fs.readdirSync(fullPath);
      return `Files and directories in '${targetPath}':\n${items
        .map((item) => {
          const itemPath = path.join(fullPath, item);
          const isDir = fs.statSync(itemPath).isDirectory();
          return `${isDir ? "📁" : "📄"} ${item}${isDir ? "/" : ""}`;
        })
        .join("\n")}`;
    }

    if (call.name === "read_file") {
      const filename = call.args.filename;
      if (!fs.existsSync(filename)) {
        return `Error: File '${filename}' does not exist`;
      }
      const content = fs.readFileSync(filename, "utf8");
      return `Content of '${filename}':\n${content}`;
    }

    if (call.name === "implement_database_feature") {
      const query = call.args.query;
      console.log(chalk.blue.bold("\n🌺 Orchids Database Agent"));
      console.log(chalk.gray("━".repeat(50)));
      console.log(chalk.yellow(`Implementing: ${query}`));
      console.log();

      const agent = new DatabaseAgent();
      await agent.processQuery(query);

      return `Successfully implemented database feature: ${query}`;
    }

    throw new Error(`Unknown tool: ${call.name}`);
  } catch (error: any) {
    return `Error executing ${call.name}: ${error.message}`;
  }
}

async function startInteractiveMode(ai: GoogleGenAI, verbose: boolean) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan("🌺 orchids-agent> "),
  });

  console.log(
    chalk.blue.bold("🌺 Orchids Agentic Database Agent - Interactive Mode")
  );
  console.log(chalk.gray("━".repeat(60)));
  console.log(
    chalk.cyan("AI-powered database implementation for Next.js projects")
  );
  console.log(
    chalk.gray('Type "exit" to quit, "clear" to reset conversation history')
  );
  console.log(chalk.gray("Examples:"));
  console.log(
    chalk.gray('  - "Can you store the recently played songs in a table"')
  );
  console.log(
    chalk.gray('  - "Create Made for you and Popular albums tables"')
  );
  console.log(chalk.gray('  - "Show me the current database schema"'));
  console.log();
  rl.prompt();

  let history: any[] = [];

  rl.on("line", async (input) => {
    const trimmed = input.trim();

    if (trimmed === "exit") {
      rl.close();
      return;
    }

    if (trimmed === "clear") {
      history = [];
      console.log(chalk.green("🧹 Conversation history cleared"));
      rl.prompt();
      return;
    }

    if (trimmed) {
      try {
        // Add user message to conversation history
        history.push({ role: "user", parts: [{ text: trimmed }] });

        console.log(chalk.blue("🤖 AI Agent is thinking..."));

        // Get initial AI response
        let response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: history,
          config: TOOLS_CONFIG,
        });

        // Agent feedback loop - continue until no more tools needed
        let iterations = 0;
        while (response.functionCalls && iterations < 10) {
          const toolCall = response.functionCalls[0];

          if (verbose) {
            console.log(
              chalk.yellow(
                `🔧 Tool ${iterations + 1}: ${toolCall.name}(${JSON.stringify(
                  toolCall.args || {}
                )})`
              )
            );
          } else {
            console.log(chalk.yellow(`🔧 Using tool: ${toolCall.name}`));
          }

          // Execute the tool and get result
          const result = await executeTool(toolCall);

          // Add tool call and result to history
          history.push({ role: "model", parts: [{ functionCall: toolCall }] });
          history.push({
            role: "function",
            parts: [
              {
                functionResponse: { name: toolCall.name, response: { result } },
              },
            ],
          });

          // Get next AI response
          response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: history,
            config: TOOLS_CONFIG,
          });

          iterations++;
        }

        // Display final result and add to history
        console.log(chalk.green(response.text));
        history.push({ role: "model", parts: [{ text: response.text }] });
      } catch (error: any) {
        console.error(chalk.red("❌ Error:"), error.message);
      }
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log(
      chalk.blue("\n👋 Goodbye! Thanks for using Orchids Database Agent")
    );
    process.exit(0);
  });
}

const program = new Command();

program
  .name("orchids-agent")
  .description(
    "🌺 Orchids Agentic Database Agent - AI-powered database implementation for Next.js"
  )
  .version("1.0.0")
  .option("-i, --interactive", "Start interactive mode")
  .option(
    "-a, --apiKey <key>",
    "Google Gemini API key (or set GEMINI_API_KEY env var)"
  )
  .option("-v, --verbose", "Enable verbose mode", false)
  .argument(
    "[query]",
    "Natural language query describing the database feature to implement"
  )
  .action(async (query: string | undefined, options: any) => {
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.log(chalk.yellow("⚠️  No GEMINI_API_KEY found"));
      console.log(
        chalk.gray("   Add your API key to .env file or use --apiKey option")
      );
      console.log(
        chalk.gray("   Running in demo mode without AI capabilities\n")
      );
    }

    if (options.interactive || !query) {
      if (!apiKey) {
        console.log(chalk.red("❌ Interactive mode requires a Gemini API key"));
        process.exit(1);
      }
      const ai = new GoogleGenAI({ apiKey });
      if (options.verbose) {
        console.log(chalk.green("🚀 Gemini AI client initialized"));
      }
      await startInteractiveMode(ai, options.verbose);
    } else {
      // Direct query mode (existing functionality)
      console.log(chalk.blue.bold("🌺 Orchids Database Agent"));
      console.log(chalk.gray("━".repeat(50)));
      console.log();
      const agent = new DatabaseAgent();
      await agent.processQuery(query);
    }
  });

process.on("uncaughtException", (error) => {
  console.error(chalk.red("❌ Unexpected error:"), error.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error(chalk.red("❌ Unhandled promise rejection:"), reason);
  process.exit(1);
});

program.parse();
