#!/usr/bin/env tsx

import { Command } from "commander";
import chalk from "chalk";
import dotenv from "dotenv";
import readline from "readline";
import { DatabaseAgent } from "./agent/databaseAgent";

dotenv.config();

const program = new Command();

async function startInteractiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.blue("🌺 orchids-agent> "),
  });

  console.log(chalk.blue.bold("🌺 Orchids Database Agent - Interactive Mode"));
  console.log(chalk.gray("━".repeat(60)));
  console.log(
    chalk.cyan(
      "💡 Ask me to implement database features for your Next.js project"
    )
  );
  console.log(
    chalk.gray(
      '   Type "exit" to quit, "clear" to clear history, "help" for commands'
    )
  );
  console.log();

  const agent = new DatabaseAgent();

  rl.prompt();

  rl.on("line", async (input) => {
    const trimmed = input.trim();

    if (trimmed === "exit") {
      console.log(chalk.green("👋 Goodbye!"));
      rl.close();
      return;
    }

    if (trimmed === "clear") {
      agent.clearHistory();
      console.log(chalk.green("🧹 Conversation history cleared"));
      rl.prompt();
      return;
    }

    if (trimmed === "help") {
      console.log(chalk.cyan("\n📚 Available Commands:"));
      console.log(chalk.gray("  exit     - Exit the interactive mode"));
      console.log(chalk.gray("  clear    - Clear conversation history"));
      console.log(chalk.gray("  help     - Show this help message"));
      console.log(chalk.gray("  history  - Show conversation history"));
      console.log();
      console.log(chalk.cyan("💬 Example Queries:"));
      console.log(
        chalk.gray('  "Can you store the recently played songs in a table"')
      );
      console.log(
        chalk.gray('  "Create a user profiles table with authentication"')
      );
      console.log(
        chalk.gray('  "Store the Made for you and Popular albums in tables"')
      );
      console.log();
      rl.prompt();
      return;
    }

    if (trimmed === "history") {
      const history = agent.getConversationHistory();
      if (history.length === 0) {
        console.log(chalk.yellow("📝 No conversation history yet"));
      } else {
        console.log(
          chalk.cyan(`📝 Conversation History (${history.length} entries):`)
        );
        history.forEach((entry, index) => {
          console.log(
            chalk.gray(
              `  ${index + 1}. ${entry.role}: ${JSON.stringify(
                entry.parts
              ).substring(0, 100)}...`
            )
          );
        });
      }
      console.log();
      rl.prompt();
      return;
    }

    if (trimmed) {
      try {
        console.log();
        await agent.processQuery(trimmed);
        console.log();
      } catch (error: any) {
        console.error(chalk.red("❌ Error:"), error.message);
      }
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log(chalk.green("👋 Goodbye!"));
    process.exit(0);
  });
}

program
  .name("orchids-agent")
  .description(
    "🌺 Agentic Database Agent for Next.js projects with AI-powered tool calling"
  )
  .version("1.0.0")
  .option(
    "-i, --interactive",
    "Start interactive mode with conversation history"
  )
  .option(
    "-v, --verbose",
    "Enable verbose mode with detailed tool usage",
    false
  )
  .argument(
    "[query]",
    "Natural language query describing the database feature to implement"
  )
  .action(async (query: string, options) => {
    if (options.interactive || !query) {
      await startInteractiveMode();
      return;
    }

    console.log(chalk.blue.bold("🌺 Orchids Database Agent"));
    console.log(chalk.gray("━".repeat(50)));
    console.log();

    const agent = new DatabaseAgent();
    await agent.processQuery(query);
  });

process.on("uncaughtException", (error) => {
  console.error(chalk.red("❌ Unexpected error:"), (error as any).message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error(chalk.red("❌ Unhandled promise rejection:"), reason);
  process.exit(1);
});

program.parse();
