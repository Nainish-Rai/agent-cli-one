#!/usr/bin/env tsx

import { Command } from "commander";
import chalk from "chalk";
import dotenv from "dotenv";
import { DatabaseAgent } from "./agent/databaseAgent";

dotenv.config();

const program = new Command();

program
  .name("orchids-agent")
  .description(
    "DB-Agent for Orchids - Database operations for Next.js projects"
  )
  .version("1.0.0")
  .argument(
    "<query>",
    "Natural language query describing the database feature to implement"
  )
  .action(async (query: string) => {
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
