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

    // Convert snake_case field names to camelCase for TypeScript object properties
    const convertToCamelCase = (str: string) => {
      return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    };

    // Convert snake_case table name to camelCase for export name
    const tableExportName = convertToCamelCase(tableName);

    const seedPrompt = `Generate a TypeScript seed file for a database table with realistic sample data.

CRITICAL: You must strictly follow the provided schema definition and naming conventions.

Table Information:
- Database table name: ${tableName}
- TypeScript export name: ${tableExportName}
- Class name: ${className}
- Schema file name: ${schemaDef.fileName}
- Fields to populate: ${JSON.stringify(
      fieldsInfo.map((f) => ({
        ...f,
        tsFieldName: convertToCamelCase(f.name),
      })),
      null,
      2
    )}
- Full schema fields: ${JSON.stringify(schemaDef.fields, null, 2)}

CRITICAL NAMING CONVENTION:
- Import the table as: import { ${tableExportName}, type New${className} } from "@/db/schema";
- Use camelCase field names in the TypeScript objects: ${fieldsInfo
      .map((f) => convertToCamelCase(f.name))
      .join(", ")}

Context: This is for a Spotify clone application. Generate music-related data that makes sense for the table structure.

STRICT Requirements:
1. Generate 12-20 realistic sample records
2. Use proper TypeScript types that match the schema exactly
3. Import from "@/db/schema" using the correct export name: import { ${tableExportName}, type New${className} } from "@/db/schema";
4. Include proper database connection setup with SSL handling
5. Handle errors appropriately with detailed error messages
6. Generate contextually appropriate data based on field names and types
7. DO NOT include id, created_at, updated_at in sample data (these are auto-generated)
8. Use async/await properly with proper error handling
9. Handle SSL connections for cloud databases (neon.tech detection)
10. NO COMMENTS in the generated code
11. Use exact TypeScript field names (camelCase) from the schema definition
12. Ensure all required fields (notNull) have values
13. Respect field constraints and types exactly

Field Type Mapping Guidelines:
- text: String values appropriate for the field name
- integer: Numeric values appropriate for the field name
- boolean: true/false values
- uuid: Valid UUID format strings
- timestamp: ISO date strings or Date objects for user-provided timestamps
- serial: Never include (auto-generated)

Common field patterns for Spotify clone (use camelCase in TypeScript):
- songTitle, trackTitle, title: Real song titles
- artistName, artist: Real artist names
- albumName, album: Real album names
- durationSeconds: Realistic song durations (120-300 seconds)
- genre: Music genres (Pop, Rock, Hip Hop, R&B, Electronic, etc.)
- userId: Numeric user identifiers (100-999)
- songId: Numeric song identifiers (5000-9999)
- playCount: Numbers between 1-10000
- isLiked, isFavorited: boolean values
- playedAt, lastPlayedAt: Recent Date objects or ISO strings

Database setup template:
\`\`\`typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import dotenv from "dotenv";
import { ${tableExportName}, type New${className} } from "@/db/schema";

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

  const sampleData: New${className}[] = [
    // Sample data using camelCase field names
  ];

  // Insert and handle errors
}
\`\`\`

Generate a complete, executable TypeScript seed file with:
- Proper imports matching the actual schema export names
- Database connection with SSL handling
- Sample data array with realistic values using camelCase field names
- Insert operation with error handling
- Connection cleanup
- Detailed logging

use this https://v3.fal.media/files/elephant/N5qDbXOpqAlIcK7kJ4BBp_output.png for image url whenever image url is required

IMPORTANT: Generate ONLY the TypeScript code, no explanation or markdown formatting. Do not include any comments in the code. Ensure the generated code uses the correct camelCase field names and table export name.`;

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

      // Validate and fix import statements
      if (!generatedCode.includes(`import { ${tableExportName}`)) {
        console.log(
          chalk.yellow(
            `⚠️  Generated code may have incorrect imports. Attempting to fix...`
          )
        );
        // Fix import issues - replace any incorrect table name with the correct one
        generatedCode = generatedCode.replace(
          /import\s*{[^}]+}\s*from\s*["']@\/db\/schema["']/,
          `import { ${tableExportName}, type New${className} } from "@/db/schema"`
        );
      }

      // Validate that we're using the correct table name in the insert operation
      if (generatedCode.includes(`db.insert(${tableName})`)) {
        generatedCode = generatedCode.replace(
          new RegExp(`db\\.insert\\(${tableName}\\)`, "g"),
          `db.insert(${tableExportName})`
        );
      }

      return generatedCode;
    } catch (error) {
      console.log(chalk.red(`❌ Error generating AI seed content: ${error}`));
      throw new Error(`Failed to generate seed content using AI: ${error}`);
    }
  }
}
