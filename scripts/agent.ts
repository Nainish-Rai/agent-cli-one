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
    | "integrating"
    | "seeding";
  message: string;
}

interface SchemaField {
  name: string;
  type: "serial" | "text" | "timestamp" | "integer" | "boolean" | "uuid";
  constraints?: string[];
}

interface SchemaDefinition {
  tableName: string;
  fileName: string;
  fields: SchemaField[];
  relationships?: string[];
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
    this.model =
      apiKey && this.genAI
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
      seeding: "🌱",
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

    // Parse the query to extract schema requirements
    const schemaDefinitions = await this.parseQueryForSchemas(query);

    if (schemaDefinitions.length === 0) {
      console.log(
        chalk.yellow(
          "⚠️  No database schema requirements detected in your query."
        )
      );
      console.log(
        chalk.gray(
          "   Try queries like: 'store recently played songs' or 'create user profiles table'"
        )
      );
      return;
    }

    console.log(chalk.green("\n📋 Implementation Plan:"));
    console.log(
      chalk.blue(
        `Creating ${schemaDefinitions.length} database table(s) with migrations and API integration`
      )
    );
    console.log();

    // Execute implementation steps
    for (const schemaDef of schemaDefinitions) {
      await this.implementSchema(schemaDef);
    }

    // Update schema index
    await this.updateSchemaIndex(schemaDefinitions);

    // Generate and run migrations
    await this.runMigrations();

    // Generate API routes
    for (const schemaDef of schemaDefinitions) {
      await this.generateApiRoute(schemaDef);
    }

    // Generate and run seeds
    for (const schemaDef of schemaDefinitions) {
      await this.generateSeedData(schemaDef);
    }

    // Generate frontend integration suggestions
    await this.generateFrontendIntegration(schemaDefinitions, query);

    console.log(chalk.green("\n✅ Database implementation complete!"));
    console.log(
      chalk.cyan(
        "🚀 Your new database tables are ready with API endpoints and sample data."
      )
    );
  }

  private async getProjectContext(): Promise<string> {
    const context = [];

    // Check existing schemas
    try {
      const schemaDir = path.join(process.cwd(), "src", "db", "schema");
      if (fs.existsSync(schemaDir)) {
        const schemas = fs
          .readdirSync(schemaDir)
          .filter((f) => f.endsWith(".ts") && f !== "index.ts");
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

  private async parseQueryForSchemas(
    query: string
  ): Promise<SchemaDefinition[]> {
    if (!this.model) {
      // Fallback for demo mode - provide a basic schema for "recently played songs"
      if (
        query.toLowerCase().includes("recently played") &&
        query.toLowerCase().includes("songs")
      ) {
        return [
          {
            tableName: "recently_played",
            fileName: "recently-played.ts",
            fields: [
              { name: "id", type: "serial", constraints: ["primaryKey()"] },
              { name: "user_id", type: "text", constraints: ["notNull()"] },
              { name: "song_id", type: "text", constraints: ["notNull()"] },
              { name: "song_title", type: "text", constraints: ["notNull()"] },
              { name: "artist", type: "text", constraints: ["notNull()"] },
              { name: "album", type: "text" },
              { name: "duration", type: "integer" },
              {
                name: "played_at",
                type: "timestamp",
                constraints: ["defaultNow()", "notNull()"],
              },
              {
                name: "created_at",
                type: "timestamp",
                constraints: ["defaultNow()", "notNull()"],
              },
            ],
          },
        ];
      }

      console.log(
        chalk.red(
          "❌ GEMINI_API_KEY is required for advanced schema generation"
        )
      );
      console.log(chalk.yellow("💡 Add your Gemini API key to .env file:"));
      console.log(chalk.gray("   GEMINI_API_KEY=your_api_key_here"));
      console.log(
        chalk.yellow(
          "🔧 Running in demo mode with basic 'recently played songs' schema"
        )
      );
      return [];
    }

    try {
      const schemaPrompt = `You are a database schema expert. Analyze the following user query and extract database schema requirements.

User Query: "${query}"

Respond with a JSON array of schema definitions. Each schema should have:
- tableName: snake_case table name
- fileName: kebab-case filename (with .ts extension)
- fields: array of field objects with name, type, and constraints

Available field types: serial, text, timestamp, integer, boolean, uuid
Available constraints: primaryKey(), notNull(), defaultNow(), default(value)

Example response:
[
  {
    "tableName": "user_profiles",
    "fileName": "user-profiles.ts",
    "fields": [
      {"name": "id", "type": "serial", "constraints": ["primaryKey()"]},
      {"name": "username", "type": "text", "constraints": ["notNull()"]},
      {"name": "email", "type": "text", "constraints": ["notNull()"]},
      {"name": "created_at", "type": "timestamp", "constraints": ["defaultNow()", "notNull()"]}
    ]
  }
]

Important guidelines:
- Always include an "id" field with serial type and primaryKey() constraint
- Add created_at and updated_at timestamps for most tables
- Use appropriate field types based on the data being stored
- Include proper constraints like notNull() for required fields
- Think about the relationships and data that would be needed for a Spotify-like application
- If the query mentions storing user data, include user_id field
- For music-related tables, include relevant fields like song_id, artist, title, duration, etc.

Analyze the query and generate appropriate schema definitions:`;

      this.startSpinner("Analyzing query with AI...");
      const result = await this.model.generateContent(schemaPrompt);
      const response = await result.response;
      const text = response.text();
      this.stopSpinner(true, "AI analysis complete");

      // Try to extract JSON from the AI response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const aiSchemas = JSON.parse(jsonMatch[0]);
        return aiSchemas;
      } else {
        console.log(chalk.yellow("⚠️  Could not parse AI response as JSON"));
        console.log(chalk.gray("AI Response:"), text);
        return [];
      }
    } catch (error) {
      this.stopSpinner(false, "AI parsing failed");
      console.log(chalk.red(`❌ Error analyzing query: ${error.message}`));
      console.log(
        chalk.yellow("💡 Please check your GEMINI_API_KEY and try again")
      );
      return [];
    }
  }

  private async implementSchema(schemaDef: SchemaDefinition) {
    this.log({
      type: "creating",
      message: `Creating ${schemaDef.tableName} schema definition`,
    });

    const schemaContent = this.generateSchemaContent(schemaDef);
    const schemaPath = path.join(
      process.cwd(),
      "src",
      "db",
      "schema",
      schemaDef.fileName
    );

    // Ensure schema directory exists
    const schemaDir = path.dirname(schemaPath);
    if (!fs.existsSync(schemaDir)) {
      fs.mkdirSync(schemaDir, { recursive: true });
    }

    // Write schema file
    fs.writeFileSync(schemaPath, schemaContent);

    console.log(chalk.gray(`   📁 Created: ${schemaDef.fileName}`));

    // Small delay for visual effect
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  private async updateSchemaIndex(schemaDefinitions: SchemaDefinition[]) {
    this.log({
      type: "editing",
      message: "Updating schema index file",
    });

    const schemaDir = path.join(process.cwd(), "src", "db", "schema");
    const indexPath = path.join(schemaDir, "index.ts");

    // Get existing schemas
    const existingSchemas = fs.existsSync(schemaDir)
      ? fs
          .readdirSync(schemaDir)
          .filter((f) => f.endsWith(".ts") && f !== "index.ts")
      : [];

    // Add new schemas
    const allSchemas = [
      ...new Set([
        ...existingSchemas,
        ...schemaDefinitions.map((def) => def.fileName),
      ]),
    ];

    const indexContent = this.generateSchemaIndexContent(allSchemas);

    // Ensure directory exists
    if (!fs.existsSync(schemaDir)) {
      fs.mkdirSync(schemaDir, { recursive: true });
    }

    fs.writeFileSync(indexPath, indexContent);
    console.log(chalk.gray(`   📁 Updated: schema/index.ts`));
  }

  private generateSchemaIndexContent(schemaFiles: string[]): string {
    const exports = schemaFiles
      .map((fileName) => {
        const tableName = fileName.replace(".ts", "").replace(/-/g, "_");
        const importName = fileName.replace(".ts", "");
        return `export * from "./${importName}";`;
      })
      .join("\n");

    return `// Auto-generated schema index
${exports}
`;
  }

  private generateSchemaContent(schemaDef: SchemaDefinition): string {
    const imports = new Set(["pgTable"]);

    // Collect all field types needed for imports
    schemaDef.fields.forEach((field) => {
      switch (field.type) {
        case "serial":
          imports.add("serial");
          break;
        case "text":
          imports.add("text");
          break;
        case "timestamp":
          imports.add("timestamp");
          break;
        case "integer":
          imports.add("integer");
          break;
        case "boolean":
          imports.add("boolean");
          break;
        case "uuid":
          imports.add("uuid");
          break;
      }
    });

    const importStatement = `import { ${Array.from(imports).join(
      ", "
    )} } from "drizzle-orm/pg-core";`;

    const fields = schemaDef.fields
      .map((field) => {
        const constraints = field.constraints
          ? `.${field.constraints.join(".")}`
          : "";
        return `  ${field.name}: ${field.type}("${field.name}")${constraints},`;
      })
      .join("\n");

    return `${importStatement}

export const ${schemaDef.tableName} = pgTable("${schemaDef.tableName}", {
${fields}
});

export type ${toPascalCase(schemaDef.tableName)} = typeof ${
      schemaDef.tableName
    }.$inferSelect;
export type New${toPascalCase(schemaDef.tableName)} = typeof ${
      schemaDef.tableName
    }.$inferInsert;
`;
  }

  private async runMigrations() {
    this.log({
      type: "migrating",
      message: "Generating and applying database migrations",
    });

    this.startSpinner("Generating migration files...");

    try {
      // Generate migrations with proper schema path
      execSync("npx drizzle-kit generate", {
        stdio: "pipe",
        cwd: process.cwd(),
      });

      this.stopSpinner(true, "Migration files generated");

      this.startSpinner("Applying migrations to database...");

      // Use migrate instead of push to apply actual migration files
      execSync("npx drizzle-kit migrate", {
        stdio: "pipe",
        cwd: process.cwd(),
      });

      this.stopSpinner(true, "Migrations applied successfully");
    } catch (error) {
      this.stopSpinner(false, "Migration failed");
      console.log(chalk.red(`❌ Migration error: ${error.message}`));
      console.log(
        chalk.yellow(
          "💡 Make sure your database is running and DATABASE_URL is configured"
        )
      );

      // Try alternative approach with push
      try {
        this.startSpinner("Trying direct schema push...");
        execSync("npx drizzle-kit push", {
          stdio: "pipe",
          cwd: process.cwd(),
        });
        this.stopSpinner(true, "Schema pushed successfully");
      } catch (pushError) {
        this.stopSpinner(false, "Schema push also failed");
        console.log(chalk.red(`❌ Push error: ${pushError.message}`));
      }
    }
  }

  private async generateApiRoute(schemaDef: SchemaDefinition) {
    this.log({
      type: "generating",
      message: `Creating API route for ${schemaDef.tableName}`,
    });

    const apiContent = this.generateApiRouteContent(schemaDef);
    const apiPath = path.join(
      process.cwd(),
      "src",
      "app",
      "api",
      schemaDef.tableName.replace(/_/g, "-"),
      "route.ts"
    );

    // Ensure API directory exists
    const apiDir = path.dirname(apiPath);
    if (!fs.existsSync(apiDir)) {
      fs.mkdirSync(apiDir, { recursive: true });
    }

    // Write API route file
    fs.writeFileSync(apiPath, apiContent);

    console.log(
      chalk.gray(
        `   📁 Created: api/${schemaDef.tableName.replace(/_/g, "-")}/route.ts`
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  private generateApiRouteContent(schemaDef: SchemaDefinition): string {
    const tableName = schemaDef.tableName;
    const className = toPascalCase(tableName);

    return `import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ${tableName} } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/spotify_clone",
});

const db = drizzle(pool);

// GET - Fetch all records
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");
    const userId = searchParams.get("user_id");

    let query = db.select().from(${tableName});

    // Add user filtering if user_id field exists and is provided
    ${
      schemaDef.fields.some((f) => f.name === "user_id")
        ? `
    if (userId) {
      query = query.where(eq(${tableName}.user_id, userId));
    }
    `
        : ""
    }

    const records = await query
      .orderBy(desc(${tableName}.created_at))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      success: true,
      data: records,
      pagination: {
        limit,
        offset,
        count: records.length
      }
    });
  } catch (error) {
    console.error("Error fetching ${tableName}:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch ${tableName}" },
      { status: 500 }
    );
  }
}

// POST - Create new record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const newRecord = await db.insert(${tableName}).values(body).returning();

    return NextResponse.json({
      success: true,
      data: newRecord[0]
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating ${tableName}:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create ${tableName}" },
      { status: 500 }
    );
  }
}

// DELETE - Delete record by ID
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID is required" },
        { status: 400 }
      );
    }

    await db.delete(${tableName}).where(eq(${tableName}.id, parseInt(id)));

    return NextResponse.json({
      success: true,
      message: "${className} deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting ${tableName}:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete ${tableName}" },
      { status: 500 }
    );
  }
}
`;
  }

  private async generateSeedData(schemaDef: SchemaDefinition) {
    this.log({
      type: "seeding",
      message: `Generating seed data for ${schemaDef.tableName}`,
    });

    const seedContent = this.generateSeedContent(schemaDef);
    const seedPath = path.join(
      process.cwd(),
      "scripts",
      `seed-${schemaDef.tableName}.ts`
    );

    // Ensure scripts directory exists
    const scriptsDir = path.dirname(seedPath);
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }

    // Write seed file
    fs.writeFileSync(seedPath, seedContent);

    console.log(chalk.gray(`   📁 Created: seed-${schemaDef.tableName}.ts`));

    // Execute seeding
    this.startSpinner(`Seeding ${schemaDef.tableName} with sample data...`);

    try {
      execSync(`npx tsx scripts/seed-${schemaDef.tableName}.ts`, {
        stdio: "pipe",
        cwd: process.cwd(),
      });
      this.stopSpinner(true, `${schemaDef.tableName} seeded successfully`);
    } catch (error) {
      this.stopSpinner(false, `Seeding failed for ${schemaDef.tableName}`);
      console.log(
        chalk.yellow(
          `⚠️  Manual seeding available: npx tsx scripts/seed-${schemaDef.tableName}.ts`
        )
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  private generateSeedContent(schemaDef: SchemaDefinition): string {
    const tableName = schemaDef.tableName;
    const className = toPascalCase(tableName);

    let sampleData = "";

    switch (tableName) {
      case "recently_played":
        sampleData = `
  {
    user_id: "user_123",
    song_id: "song_001",
    song_title: "Blinding Lights",
    artist: "The Weeknd",
    album: "After Hours",
    duration: 200,
  },
  {
    user_id: "user_123",
    song_id: "song_002",
    song_title: "Watermelon Sugar",
    artist: "Harry Styles",
    album: "Fine Line",
    duration: 174,
  },
  {
    user_id: "user_123",
    song_id: "song_003",
    song_title: "Good 4 U",
    artist: "Olivia Rodrigo",
    album: "SOUR",
    duration: 178,
  },
  {
    user_id: "user_456",
    song_id: "song_004",
    song_title: "Levitating",
    artist: "Dua Lipa",
    album: "Future Nostalgia",
    duration: 203,
  },
  {
    user_id: "user_456",
    song_id: "song_005",
    song_title: "drivers license",
    artist: "Olivia Rodrigo",
    album: "SOUR",
    duration: 242,
  }`;
        break;

      case "made_for_you":
        sampleData = `
  {
    user_id: "user_123",
    playlist_name: "Discover Weekly",
    description: "Your weekly mixtape of fresh music",
    cover_image: "/images/discover-weekly.jpg",
    song_count: 30,
  },
  {
    user_id: "user_123",
    playlist_name: "Release Radar",
    description: "Catch all the latest music from artists you follow",
    cover_image: "/images/release-radar.jpg",
    song_count: 25,
  },
  {
    user_id: "user_456",
    playlist_name: "Daily Mix 1",
    description: "Made for you • Olivia Rodrigo, Taylor Swift, and more",
    cover_image: "/images/daily-mix-1.jpg",
    song_count: 50,
  },
  {
    user_id: "user_456",
    playlist_name: "On Repeat",
    description: "Songs you can't stop playing",
    cover_image: "/images/on-repeat.jpg",
    song_count: 20,
  }`;
        break;

      case "popular_albums":
        sampleData = `
  {
    album_id: "album_001",
    title: "Midnights",
    artist: "Taylor Swift",
    cover_image: "/images/midnights.jpg",
    release_date: new Date("2022-10-21"),
    popularity_score: 95,
    genre: "Pop",
  },
  {
    album_id: "album_002",
    title: "Harry's House",
    artist: "Harry Styles",
    cover_image: "/images/harrys-house.jpg",
    release_date: new Date("2022-05-20"),
    popularity_score: 92,
    genre: "Pop Rock",
  },
  {
    album_id: "album_003",
    title: "Un Verano Sin Ti",
    artist: "Bad Bunny",
    cover_image: "/images/un-verano-sin-ti.jpg",
    release_date: new Date("2022-05-06"),
    popularity_score: 90,
    genre: "Reggaeton",
  },
  {
    album_id: "album_004",
    title: "SOUR",
    artist: "Olivia Rodrigo",
    cover_image: "/images/sour.jpg",
    release_date: new Date("2021-05-21"),
    popularity_score: 88,
    genre: "Pop",
  },
  {
    album_id: "album_005",
    title: "Happier Than Ever",
    artist: "Billie Eilish",
    cover_image: "/images/happier-than-ever.jpg",
    release_date: new Date("2021-07-30"),
    popularity_score: 85,
    genre: "Alternative",
  }`;
        break;

      default:
        sampleData = `
  // Add your sample data here
  // Example: { field1: "value1", field2: "value2" }`;
    }

    return `import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import dotenv from "dotenv";
import { ${tableName} } from "../src/db/schema/${schemaDef.fileName.replace(
      ".ts",
      ""
    )}";

dotenv.config();

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/spotify_clone",
  });

  const db = drizzle(pool);

  console.log("🌱 Seeding ${tableName}...");

  const sampleData = [${sampleData}
  ];

  try {
    await db.insert(${tableName}).values(sampleData);
    console.log("✅ ${tableName} seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding ${tableName}:", error);
  } finally {
    await pool.end();
  }
}

seed().catch(console.error);
`;
  }

  private async generateFrontendIntegration(
    schemaDefinitions: SchemaDefinition[],
    query: string
  ) {
    this.log({
      type: "integrating",
      message: "Generating frontend integration suggestions",
    });

    console.log(chalk.green("\n🔗 Frontend Integration:"));

    for (const schemaDef of schemaDefinitions) {
      const apiEndpoint = `/api/${schemaDef.tableName.replace(/_/g, "-")}`;

      console.log(chalk.blue(`\n📡 API Endpoint: ${apiEndpoint}`));
      console.log(chalk.gray(`   GET    ${apiEndpoint} - Fetch records`));
      console.log(chalk.gray(`   POST   ${apiEndpoint} - Create record`));
      console.log(
        chalk.gray(`   DELETE ${apiEndpoint}?id=123 - Delete record`)
      );

      // Generate specific integration suggestions based on table type
      if (schemaDef.tableName === "recently_played") {
        console.log(chalk.yellow("\n💡 Integration Suggestions:"));
        console.log(
          chalk.gray(
            "   1. Add to spotify-main-content.tsx to show recent songs"
          )
        );
        console.log(
          chalk.gray("   2. Create a 'Recently Played' section in the sidebar")
        );
        console.log(chalk.gray("   3. Track song plays in spotify-player.tsx"));

        console.log(chalk.cyan("\n📝 Example Usage:"));
        console.log(
          chalk.gray(`   // Fetch recently played songs
   const response = await fetch('${apiEndpoint}?user_id=user_123');
   const { data } = await response.json();`)
        );
      }
    }

    console.log(chalk.green("\n🎨 Next Steps:"));
    console.log(
      chalk.gray("   1. Update your frontend components to use the new API")
    );
    console.log(
      chalk.gray("   2. Add proper error handling and loading states")
    );
    console.log(
      chalk.gray("   3. Consider adding real-time updates with WebSockets")
    );
  }
}

// Helper function to convert snake_case to PascalCase
function toPascalCase(str: string): string {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
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
