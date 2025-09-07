import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import { SchemaDefinition } from "../types";
import { toPascalCase } from "../utils";

export class SeedGenerator {
  private model: any;

  constructor(model?: any) {
    this.model = model;
  }

  setModel(model: any) {
    this.model = model;
  }

  async generateSeedData(schemaDef: SchemaDefinition) {
    if (!this.model) {
      throw new Error(
        "❌ AI model is required for seed generation. Please set a model using setModel() method."
      );
    }

    console.log(
      chalk.blue(
        `🤖 Generating AI-powered seed data for ${schemaDef.tableName}...`
      )
    );
    const seedContent = await this.generateSeedContent(schemaDef);
    await this.writeSeedFile(schemaDef, seedContent);
  }

  private async writeSeedFile(schemaDef: SchemaDefinition, content: string) {
    const seedPath = path.join(
      process.cwd(),
      "scripts",
      `seed-${schemaDef.tableName}.ts`
    );
    fs.mkdirSync(path.dirname(seedPath), { recursive: true });
    fs.writeFileSync(seedPath, content);
    console.log(chalk.gray(`   📁 Created: seed-${schemaDef.tableName}.ts`));

    try {
      execSync(`npx tsx scripts/seed-${schemaDef.tableName}.ts`, {
        stdio: "pipe",
        cwd: process.cwd(),
      });
      console.log(
        chalk.green(`   ✅ ${schemaDef.tableName} seeded successfully`)
      );
    } catch (error) {
      console.log(chalk.red(`   ❌ Seeding failed for ${schemaDef.tableName}`));
      console.log(chalk.red(`   Error: ${error}`));
    }
  }

  private async generateSeedContent(
    schemaDef: SchemaDefinition
  ): Promise<string> {
    const tableName = schemaDef.tableName;
    const className = toPascalCase(tableName);

    // Get only the fields that should be populated (exclude auto-generated ones)
    const fieldsInfo = schemaDef.fields
      .filter((f) => !["id", "created_at", "updated_at"].includes(f.name))
      .map((f) => ({
        name: f.name,
        type: f.type,
        isRequired: f.constraints?.includes("notNull()"),
        constraints: f.constraints || [],
      }));

    const seedPrompt = `Generate a TypeScript seed file for a database table with realistic sample data.

CRITICAL: You must strictly follow the provided schema definition and generate seeds that match exactly.

Table Information:
- Table name: ${tableName}
- Class name: ${className}
- Schema file name: ${schemaDef.fileName}
- Fields to populate: ${JSON.stringify(fieldsInfo, null, 2)}
- Full schema fields: ${JSON.stringify(schemaDef.fields, null, 2)}

Context: This is for a Spotify clone application. Generate music-related data that makes sense for the table structure.

STRICT Requirements:
1. Generate 12-20 realistic sample records
2. Use proper TypeScript types that match the schema exactly
3. Import from "@/db/schema" using the exact table name: import { ${tableName} } from "@/db/schema";
4. Include proper database connection setup with SSL handling
5. Handle errors appropriately with detailed error messages
6. Generate contextually appropriate data based on field names and types
7. DO NOT include id, created_at, updated_at in sample data (these are auto-generated)
8. Use async/await properly with proper error handling
9. Handle SSL connections for cloud databases (neon.tech detection)
10. NO COMMENTS in the generated code
11. Use exact field names and types from the schema definition
12. Ensure all required fields (notNull) have values
13. Respect field constraints and types exactly

Field Type Mapping Guidelines:
- text: String values appropriate for the field name
- integer: Numeric values appropriate for the field name
- boolean: true/false values
- uuid: Valid UUID format strings
- timestamp: ISO date strings for user-provided timestamps
- serial: Never include (auto-generated)

Common field patterns for Spotify clone:
- song_title, track_title, title: Real song titles
- artist_name, artist: Real artist names
- album_name, album: Real album names
- duration_seconds: Realistic song durations (120-300 seconds)
- genre: Music genres (Pop, Rock, Hip Hop, R&B, Electronic, etc.)
- user_id: UUID format identifiers
- play_count: Numbers between 1-10000
- is_liked, is_favorited: boolean values
- recently_played_at, last_played_at: Recent ISO timestamps

Database setup template:
\`\`\`typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import dotenv from "dotenv";
import { ${tableName}, type New${className} } from "@/db/schema";

dotenv.config();

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.log('Please ensure your .env file contains a valid DATABASE_URL');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : false
  });

  const db = drizzle(pool);
  // ... rest of implementation
}
\`\`\`

Generate a complete, executable TypeScript seed file with:
- Proper imports matching the schema
- Database connection with SSL handling
- Sample data array with realistic values
- Insert operation with error handling
- Connection cleanup
- Detailed logging

IMPORTANT: Generate ONLY the TypeScript code, no explanation or markdown formatting. Do not include any comments in the code. Ensure the generated code exactly matches the provided schema definition.`;

    try {
      const result = await this.model.generateContent(seedPrompt);
      let generatedCode = result.response.text().trim();

      // Clean up any markdown formatting or comments
      generatedCode = generatedCode
        .replace(/```typescript\n?/g, "")
        .replace(/```\n?/g, "")
        .replace(/\/\/[^\n]*\n/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim();

      // Validate that the generated code includes the required imports
      if (!generatedCode.includes(`import { ${tableName}`)) {
        console.log(
          chalk.yellow(
            `⚠️  Generated code may have incorrect imports. Attempting to fix...`
          )
        );
        // Try to fix common import issues
        generatedCode = generatedCode.replace(
          /import\s*{[^}]+}\s*from\s*["']@\/db\/schema["']/,
          `import { ${tableName}, type New${className} } from "@/db/schema"`
        );
      }

      return generatedCode;
    } catch (error) {
      console.log(chalk.red(`❌ Error generating AI seed content: ${error}`));
      throw new Error(`Failed to generate seed content using AI: ${error}`);
    }
  }
}
