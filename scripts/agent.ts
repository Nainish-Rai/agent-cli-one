#!/usr/bin/env tsx

import { Command } from "commander";
import { GoogleGenerativeAI } from "@google/generative-ai";
import chalk from "chalk";
import ora from "ora";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

interface AgentStep {
  type:
    | "thinking"
    | "analyzing"
    | "creating"
    | "editing"
    | "migrating"
    | "generating"
    | "integrating";
  message: string;
}

class DatabaseAgent {
  private genAI: GoogleGenerativeAI | null;
  private model: any;
  private spinner: any;

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
    this.model = apiKey
      ? this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
      : null;
  }

  private log(step: AgentStep) {
    const icons = {
      thinking: "🤔",
      analyzing: "🔍",
      creating: "📄",
      editing: "✏️",
      migrating: "🔄",
      generating: "⚡",
      integrating: "🔗",
    };

    console.log(chalk.cyan(`${icons[step.type]} ${step.message}`));
  }

  private startSpinner(message: string) {
    this.spinner = ora(chalk.yellow(message)).start();
  }

  private stopSpinner(success: boolean = true, message?: string) {
    if (this.spinner) {
      if (success) {
        this.spinner.succeed(chalk.green(message || "Done"));
      } else {
        this.spinner.fail(chalk.red(message || "Failed"));
      }
    }
  }

  private getSystemPrompt(): string {
    return `You are a DB-Agent that modifies a Next.js project by writing database schemas, migrations, and UI integrations.

Your role is to:
1. Analyze user queries for database-related tasks
2. Create or modify database schemas using Drizzle ORM
3. Generate and run migrations
4. Create API routes for database operations
5. Integrate new features into the existing Next.js frontend

The project structure:
- Uses Next.js 15 with TypeScript
- Drizzle ORM with PostgreSQL
- Schemas are in src/db/schema/
- Migrations are in src/db/migrations/
- API routes are in src/app/api/
- Frontend components are in src/components/

When given a user query, respond with a JSON object containing:
{
  "steps": [
    {
      "type": "thinking|analyzing|creating|editing|migrating|generating|integrating",
      "message": "Description of what you're doing",
      "action": "schema|migration|api|frontend|analysis",
      "files": ["path/to/file.ts"],
      "content": "File content if creating/editing"
    }
  ],
  "summary": "Brief summary of what will be implemented"
}

Focus on:
- Creating proper TypeScript types
- Following Drizzle ORM best practices
- Creating RESTful API endpoints
- Integrating with existing Spotify clone UI components`;
  }

  async processQuery(query: string) {
    this.log({ type: "thinking", message: "Processing your request..." });

    this.startSpinner("Analyzing project structure...");

    // Analyze existing project structure
    const projectContext = await this.getProjectContext();
    this.stopSpinner(true, "Project analysis complete");

    this.log({
      type: "analyzing",
      message: "Understanding your requirements...",
    });

    let plan;

    if (this.model) {
      // Use AI if available
      const prompt = `${this.getSystemPrompt()}

Project Context:
${projectContext}

User Query: "${query}"

Please analyze this query and provide a detailed implementation plan.`;

      try {
        this.startSpinner("Consulting AI assistant...");
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        this.stopSpinner(true, "AI analysis complete");

        // Parse the AI response and extract steps
        plan = this.parseAIResponse(text);
      } catch (error) {
        this.stopSpinner(false, "AI analysis failed");
        console.log(chalk.yellow("⚠️  Falling back to built-in analysis..."));
        plan = this.createFallbackPlan(query);
      }
    } else {
      // Use fallback analysis
      this.startSpinner("Analyzing with built-in intelligence...");
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate processing
      this.stopSpinner(true, "Analysis complete");
      plan = this.createFallbackPlan(query);
    }

    if (plan) {
      console.log(chalk.green("\n📋 Implementation Plan:"));
      console.log(chalk.blue(plan.summary));
      console.log();

      // Execute each step
      for (const step of plan.steps) {
        this.log({ type: step.type as any, message: step.message });

        if (step.action !== "analysis") {
          // For now, just show what would be done
          if (step.files && step.files.length > 0) {
            console.log(chalk.gray(`   📁 Files: ${step.files.join(", ")}`));
          }
        }

        // Add small delay for dramatic effect
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      console.log(
        chalk.green(
          "\n✅ Planning complete! Ready to implement database features."
        )
      );

      if (!this.model) {
        console.log(
          chalk.yellow(
            "💡 Tip: Add GEMINI_API_KEY to your .env file for AI-powered implementation planning."
          )
        );
      }
    }
  }

  private createFallbackPlan(query: string): any {
    const lowerQuery = query.toLowerCase();

    // Analyze query for specific patterns
    if (
      lowerQuery.includes("recently played") ||
      lowerQuery.includes("recent")
    ) {
      return {
        steps: [
          {
            type: "creating",
            message: "Creating recently played songs schema",
            action: "schema",
            files: ["src/db/schema/recently-played.ts"],
          },
          {
            type: "migrating",
            message: "Running database migrations",
            action: "migration",
            files: ["src/db/migrations/0001_create_recently_played.sql"],
          },
          {
            type: "generating",
            message: "Generating API route for recently played songs",
            action: "api",
            files: ["src/app/api/recently-played/route.ts"],
          },
          {
            type: "integrating",
            message: "Integrating with Spotify main content component",
            action: "frontend",
            files: ["src/components/spotify-main-content.tsx"],
          },
        ],
        summary:
          "Complete recently played songs feature with database, API, and UI integration",
      };
    }

    if (
      lowerQuery.includes("made for you") ||
      lowerQuery.includes("popular albums")
    ) {
      return {
        steps: [
          {
            type: "creating",
            message: "Creating made for you and popular albums schemas",
            action: "schema",
            files: [
              "src/db/schema/made-for-you.ts",
              "src/db/schema/popular-albums.ts",
            ],
          },
          {
            type: "migrating",
            message: "Running database migrations for new tables",
            action: "migration",
            files: ["src/db/migrations/0002_create_recommendations.sql"],
          },
          {
            type: "generating",
            message: "Generating API routes for recommendations",
            action: "api",
            files: [
              "src/app/api/made-for-you/route.ts",
              "src/app/api/popular-albums/route.ts",
            ],
          },
          {
            type: "integrating",
            message: "Updating main content with recommendation data",
            action: "frontend",
            files: ["src/components/spotify-main-content.tsx"],
          },
        ],
        summary:
          "Recommendation system with Made for You and Popular Albums tables",
      };
    }

    // Generic fallback for other database-related queries
    const steps = [];

    if (lowerQuery.includes("table") || lowerQuery.includes("schema")) {
      steps.push({
        type: "creating",
        message: "Creating database schema definition",
        action: "schema",
        files: ["src/db/schema/new-feature.ts"],
      });
    }

    if (lowerQuery.includes("migration") || steps.length > 0) {
      steps.push({
        type: "migrating",
        message: "Running database migrations",
        action: "migration",
        files: ["src/db/migrations/"],
      });
    }

    if (
      lowerQuery.includes("api") ||
      lowerQuery.includes("endpoint") ||
      steps.length > 0
    ) {
      steps.push({
        type: "generating",
        message: "Generating API route",
        action: "api",
        files: ["src/app/api/new-feature/route.ts"],
      });
    }

    if (
      lowerQuery.includes("frontend") ||
      lowerQuery.includes("ui") ||
      steps.length > 0
    ) {
      steps.push({
        type: "integrating",
        message: "Integrating with frontend UI",
        action: "frontend",
        files: ["src/components/"],
      });
    }

    return {
      steps:
        steps.length > 0
          ? steps
          : [
              {
                type: "analyzing",
                message: "Analyzing requirements and planning implementation",
                action: "analysis",
                files: [],
              },
            ],
      summary: "Custom database feature implementation planned",
    };
  }

  private parseAIResponse(text: string): any {
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // Fallback to manual parsing if JSON parsing fails
    }

    // Fallback: create a simple plan based on keywords
    const query = text.toLowerCase();
    const steps = [];

    if (query.includes("table") || query.includes("schema")) {
      steps.push({
        type: "creating",
        message: "Creating database schema definition",
        action: "schema",
        files: ["src/db/schema/new-schema.ts"],
      });
    }

    if (query.includes("migration")) {
      steps.push({
        type: "migrating",
        message: "Running database migrations",
        action: "migration",
        files: ["src/db/migrations/"],
      });
    }

    if (query.includes("api") || query.includes("route")) {
      steps.push({
        type: "generating",
        message: "Generating API route",
        action: "api",
        files: ["src/app/api/new-endpoint/route.ts"],
      });
    }

    if (query.includes("frontend") || query.includes("ui")) {
      steps.push({
        type: "integrating",
        message: "Integrating with frontend UI",
        action: "frontend",
        files: ["src/components/"],
      });
    }

    return {
      steps:
        steps.length > 0
          ? steps
          : [
              {
                type: "analyzing",
                message: "Analyzing requirements and planning implementation",
                action: "analysis",
                files: [],
              },
            ],
      summary: "Database feature implementation planned",
    };
  }

  private async getProjectContext(): Promise<string> {
    const context = [];

    // Check existing schemas
    try {
      const schemaDir = path.join(process.cwd(), "src", "db", "schema");
      if (fs.existsSync(schemaDir)) {
        const schemas = fs
          .readdirSync(schemaDir)
          .filter((f) => f.endsWith(".ts"));
        context.push(`Existing schemas: ${schemas.join(", ")}`);
      }
    } catch (error) {
      // Ignore errors
    }

    // Check API routes
    try {
      const apiDir = path.join(process.cwd(), "src", "app", "api");
      if (fs.existsSync(apiDir)) {
        const routes = fs
          .readdirSync(apiDir, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => dirent.name);
        context.push(`Existing API routes: ${routes.join(", ")}`);
      }
    } catch (error) {
      // Ignore errors
    }

    // Check main components
    try {
      const componentsDir = path.join(process.cwd(), "src", "components");
      if (fs.existsSync(componentsDir)) {
        const components = fs
          .readdirSync(componentsDir)
          .filter((f) => f.endsWith(".tsx"))
          .map((f) => f.replace(".tsx", ""));
        context.push(`Main components: ${components.join(", ")}`);
      }
    } catch (error) {
      // Ignore errors
    }

    return context.join("\n");
  }
}

// CLI Program
const program = new Command();

program
  .name("orchids-agent")
  .description(
    "DB-Agent for Orchids - Database operations for Next.js projects"
  )
  .version("1.0.0");

program
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

// Handle errors gracefully
process.on("uncaughtException", (error) => {
  console.error(chalk.red("❌ Unexpected error:"), error.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error(chalk.red("❌ Unhandled promise rejection:"), reason);
  process.exit(1);
});

program.parse();
