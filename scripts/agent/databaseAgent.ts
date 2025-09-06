import { GoogleGenerativeAI } from "@google/generative-ai";
import chalk from "chalk";
import ora from "ora";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import {
  AgentStep,
  SchemaDefinition,
  ValidationResult,
  SchemaField,
} from "./types";
import { logStep, toPascalCase } from "./utils";

export class DatabaseAgent {
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
        ? this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
        : null;
  }

  private log(step: AgentStep) {
    logStep(step.type, step.message);
  }

  private startSpinner(message: string) {
    this.spinner = ora(chalk.yellow(message)).start();
  }

  private stopSpinner(success: boolean = true, message?: string) {
    if (this.spinner) {
      success
        ? this.spinner.succeed(chalk.green(message || "Done"))
        : this.spinner.fail(chalk.red(message || "Failed"));
    }
  }

  async processQuery(query: string) {
    this.log({ type: "thinking", message: "Processing your request..." });
    this.startSpinner("Analyzing project structure...");
    await this.getProjectContext();
    this.stopSpinner(true, "Project analysis complete");

    this.log({
      type: "analyzing",
      message: "Understanding your requirements...",
    });
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

    let allSchemasValid = true;
    for (const schemaDef of schemaDefinitions) {
      const validation = await this.validateSchema(schemaDef);
      if (!validation.isValid) {
        allSchemasValid = false;
        console.log(
          chalk.red(`❌ Schema validation failed for ${schemaDef.tableName}:`)
        );
        validation.errors.forEach((e) => console.log(chalk.red(`   • ${e}`)));
      } else {
        console.log(
          chalk.green(`✅ Schema validation passed for ${schemaDef.tableName}`)
        );
        validation.warnings.forEach((w) =>
          console.log(chalk.yellow(`   ⚠️  ${w}`))
        );
      }
    }
    if (!allSchemasValid) {
      console.log(
        chalk.red(
          "\n❌ Cannot proceed with invalid schemas. Please fix the issues above."
        )
      );
      return;
    }

    for (const schemaDef of schemaDefinitions)
      await this.implementSchema(schemaDef);
    await this.updateSchemaIndex(schemaDefinitions);

    const schemaValidation = await this.validateGeneratedSchemas(
      schemaDefinitions
    );
    if (!schemaValidation.isValid) {
      console.log(chalk.red("\n❌ Generated schema files have errors:"));
      schemaValidation.errors.forEach((e) =>
        console.log(chalk.red(`   • ${e}`))
      );
      return;
    }

    await this.runMigrations();
    for (const schemaDef of schemaDefinitions)
      await this.generateApiRoute(schemaDef);
    for (const schemaDef of schemaDefinitions)
      await this.generateSeedData(schemaDef);
    await this.generateFrontendIntegration(schemaDefinitions, query);

    console.log(chalk.green("\n✅ Database implementation complete!"));
    console.log(
      chalk.cyan(
        "🚀 Your new database tables are ready with API endpoints and sample data."
      )
    );
  }

  // ---------------- Project Context ----------------
  private async getProjectContext(): Promise<string> {
    const context: string[] = [];
    const push = (label: string, items: string[]) =>
      items.length && context.push(`${label}: ${items.join(", ")}`);
    try {
      const schemaDir = path.join(process.cwd(), "src", "db", "schema");
      if (fs.existsSync(schemaDir))
        push(
          "Existing schemas",
          fs
            .readdirSync(schemaDir)
            .filter((f) => f.endsWith(".ts") && f !== "index.ts")
        );
    } catch {}
    try {
      const apiDir = path.join(process.cwd(), "src", "app", "api");
      if (fs.existsSync(apiDir)) {
        push(
          "Existing API routes",
          fs
            .readdirSync(apiDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name)
        );
      }
    } catch {}
    try {
      const componentsDir = path.join(process.cwd(), "src", "components");
      if (fs.existsSync(componentsDir)) {
        push(
          "Main components",
          fs
            .readdirSync(componentsDir)
            .filter((f) => f.endsWith(".tsx"))
            .map((f) => f.replace(".tsx", ""))
        );
      }
    } catch {}
    return context.join("\n");
  }

  // ---------------- AI Parsing / Schema Generation ----------------
  private async parseQueryForSchemas(
    query: string
  ): Promise<SchemaDefinition[]> {
    if (!this.model) {
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
              { name: "duration_seconds", type: "integer" },
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
              {
                name: "updated_at",
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
      return [];
    }
    try {
      const schemaPrompt = `You are a database schema expert for PostgreSQL with Drizzle ORM. Analyze the user query and generate VALID schema definitions.\nUser Query: "${query}"\nReturn ONLY a JSON array.`;
      this.startSpinner("Analyzing query with AI...");
      const result = await this.model.generateContent(schemaPrompt);
      const text = result.response.text();
      this.stopSpinner(true, "AI analysis complete");
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      const aiSchemas = JSON.parse(jsonMatch[0]);
      return aiSchemas.map((schema: any) => {
        const processed: SchemaDefinition = {
          tableName: schema.tableName?.toLowerCase() || "unknown_table",
          fileName:
            schema.fileName ||
            `${schema.tableName?.toLowerCase() || "unknown"}.ts`,
          fields: schema.fields || [],
        };
        const hasValidId = processed.fields.some(
          (f: any) =>
            f.name === "id" &&
            f.type === "serial" &&
            f.constraints?.includes("primaryKey()")
        );
        if (!hasValidId)
          processed.fields.unshift({
            name: "id",
            type: "serial",
            constraints: ["primaryKey()"],
          });
        if (!processed.fields.some((f) => f.name === "created_at"))
          processed.fields.push({
            name: "created_at",
            type: "timestamp",
            constraints: ["defaultNow()", "notNull()"],
          });
        if (!processed.fields.some((f) => f.name === "updated_at"))
          processed.fields.push({
            name: "updated_at",
            type: "timestamp",
            constraints: ["defaultNow()", "notNull()"],
          });
        return processed;
      });
    } catch (e: any) {
      this.stopSpinner(false, "AI parsing failed");
      console.log(chalk.red(`❌ Error analyzing query: ${e.message}`));
      return [];
    }
  }

  // ---------------- Validation ----------------
  private async validateSchema(
    schemaDef: SchemaDefinition
  ): Promise<ValidationResult> {
    this.log({
      type: "validating",
      message: `Validating schema for ${schemaDef.tableName}`,
    });
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!schemaDef.tableName || !/^[a-z][a-z0-9_]*$/.test(schemaDef.tableName))
      errors.push("Table name must be snake_case and start with a letter");
    if (!schemaDef.fileName.endsWith(".ts"))
      errors.push("File name must end with .ts");
    const hasId = schemaDef.fields.some(
      (f) =>
        f.name === "id" &&
        f.type === "serial" &&
        f.constraints?.includes("primaryKey()")
    );
    if (!hasId)
      errors.push(
        "Schema must have an 'id' field with type 'serial' and primaryKey() constraint"
      );
    schemaDef.fields.forEach((f, i) => {
      if (!f.name || !/^[a-z][a-z0-9_]*$/.test(f.name))
        errors.push(
          `Field ${i + 1}: Name must be snake_case and start with a letter`
        );
      const validTypes = [
        "serial",
        "text",
        "timestamp",
        "integer",
        "boolean",
        "uuid",
      ];
      if (!validTypes.includes(f.type))
        errors.push(`Field '${f.name}': Invalid type '${f.type}'.`);
      if (f.constraints) {
        if (f.type !== "serial" && f.constraints.includes("primaryKey()"))
          errors.push(
            `Field '${f.name}': Only 'serial' fields should have primaryKey()`
          );
        if (
          f.type !== "timestamp" &&
          f.constraints.some((c) => c.includes("defaultNow"))
        )
          errors.push(`Field '${f.name}': defaultNow() only for timestamp`);
      }
    });
    return { isValid: errors.length === 0, errors, warnings };
  }

  private async validateGeneratedSchemas(
    schemaDefinitions: SchemaDefinition[]
  ): Promise<ValidationResult> {
    this.log({
      type: "validating",
      message: "Validating generated schema files",
    });
    const errors: string[] = [];
    const warnings: string[] = [];
    for (const schemaDef of schemaDefinitions) {
      const schemaPath = path.join(
        process.cwd(),
        "src",
        "db",
        "schema",
        schemaDef.fileName
      );
      if (!fs.existsSync(schemaPath)) {
        errors.push(`Schema file not found: ${schemaDef.fileName}`);
        continue;
      }
      const content = fs.readFileSync(schemaPath, "utf-8");
      if (!content.includes("pgTable"))
        errors.push(`${schemaDef.fileName}: Missing pgTable definition`);
    }
    return { isValid: errors.length === 0, errors, warnings };
  }

  // ---------------- Schema File Generation ----------------
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
    fs.mkdirSync(path.dirname(schemaPath), { recursive: true });
    fs.writeFileSync(schemaPath, schemaContent);
    console.log(chalk.gray(`   📁 Created: ${schemaDef.fileName}`));
  }

  private async updateSchemaIndex(schemaDefinitions: SchemaDefinition[]) {
    this.log({ type: "editing", message: "Updating schema index file" });
    const schemaDir = path.join(process.cwd(), "src", "db", "schema");
    const indexPath = path.join(schemaDir, "index.ts");
    const existing = fs.existsSync(schemaDir)
      ? fs
          .readdirSync(schemaDir)
          .filter((f) => f.endsWith(".ts") && f !== "index.ts")
      : [];
    const all = [
      ...new Set([...existing, ...schemaDefinitions.map((d) => d.fileName)]),
    ];
    fs.writeFileSync(indexPath, this.generateSchemaIndexContent(all));
    console.log(chalk.gray("   📁 Updated: schema/index.ts"));
  }

  private generateSchemaIndexContent(schemaFiles: string[]): string {
    const exports = schemaFiles
      .map((f) => `export * from "./${f.replace(".ts", "")}";`)
      .join("\n");
    return `// Auto-generated schema index\n${exports}`;
  }

  private generateSchemaContent(schemaDef: SchemaDefinition): string {
    const imports = new Set(["pgTable"]);
    schemaDef.fields.forEach((f) => {
      switch (f.type) {
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
    const importStmt = `import { ${Array.from(imports).join(
      ", "
    )} } from "drizzle-orm/pg-core";`;
    const fields = schemaDef.fields
      .map((f) => {
        let def = `${f.type}("${f.name}")`;
        if (f.constraints?.length) {
          const valid = f.constraints.filter(
            (c) =>
              c.startsWith("default(") ||
              [
                "primaryKey()",
                "notNull()",
                "defaultNow()",
                "unique()",
              ].includes(c)
          );
          if (valid.length) def += `.${valid.join(".")}`;
        }
        return `  ${f.name}: ${def},`;
      })
      .join("\n");
    const tableName = schemaDef.tableName;
    const className = toPascalCase(tableName);
    return `${importStmt}\n\nexport const ${tableName} = pgTable("${tableName}", {\n${fields}\n});\n\nexport type ${className} = typeof ${tableName}.$inferSelect;\nexport type New${className} = typeof ${tableName}.$inferInsert;\n`;
  }

  // ---------------- Migrations ----------------
  private async runMigrations() {
    this.log({
      type: "migrating",
      message: "Generating and applying database migrations",
    });
    this.startSpinner("Generating migration files...");
    try {
      execSync("npx drizzle-kit generate", {
        stdio: "pipe",
        cwd: process.cwd(),
      });
      this.stopSpinner(true, "Migration files generated");
      this.startSpinner("Applying migrations to database...");
      execSync("npx drizzle-kit migrate", {
        stdio: "pipe",
        cwd: process.cwd(),
      });
      this.stopSpinner(true, "Migrations applied successfully");
    } catch (e: any) {
      this.stopSpinner(false, "Migration failed");
      console.log(chalk.red(`❌ Migration error: ${e.message}`));
    }
  }

  // ---------------- API Routes ----------------
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
    fs.mkdirSync(path.dirname(apiPath), { recursive: true });
    fs.writeFileSync(apiPath, apiContent);
    console.log(
      chalk.gray(
        `   📁 Created: api/${schemaDef.tableName.replace(/_/g, "-")}/route.ts`
      )
    );
  }

  private generateApiRouteContent(schemaDef: SchemaDefinition): string {
    const tableName = schemaDef.tableName;
    const className = toPascalCase(tableName);
    const hasUserId = schemaDef.fields.some((f) => f.name === "user_id");

    return `import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ${tableName}, type ${className}, type New${className} } from "@/db/schema";
import { desc, eq, and, count } from "drizzle-orm";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/spotify_clone"
});
const db = drizzle(pool);

// GET - Fetch ${tableName} records
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100); // Max 100
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
    const userId = searchParams.get('user_id');
    const id = searchParams.get('id');

    // If fetching a specific record by ID
    if (id) {
      const record = await db
        .select()
        .from(${tableName})
        .where(eq(${tableName}.id, parseInt(id)))
        .limit(1);

      if (record.length === 0) {
        return NextResponse.json(
          { success: false, error: '${className} not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: record[0]
      });
    }

    // Build query with optional filters
    let query = db.select().from(${tableName});
    let countQuery = db.select({ count: count() }).from(${tableName});

    const whereConditions = [];
    ${
      hasUserId
        ? `
    if (userId) {
      whereConditions.push(eq(${tableName}.user_id, userId));
    }`
        : ""
    }

    if (whereConditions.length > 0) {
      const whereClause = whereConditions.length === 1
        ? whereConditions[0]
        : and(...whereConditions);
      query = query.where(whereClause);
      countQuery = countQuery.where(whereClause);
    }

    // Get total count for pagination
    const [totalResult] = await countQuery;
    const total = totalResult.count;

    // Execute main query with pagination
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
        total,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    console.error('Error fetching ${tableName}:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ${tableName}' },
      { status: 500 }
    );
  }
}

// POST - Create new ${tableName} record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Basic validation
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Remove id and timestamps if present (they should be auto-generated)
    const { id, created_at, updated_at, ...createData } = body;

    // Validate required fields
    const requiredFields = [${schemaDef.fields
      .filter(
        (f) =>
          f.name !== "id" &&
          f.name !== "created_at" &&
          f.name !== "updated_at" &&
          f.constraints?.includes("notNull()")
      )
      .map((f) => `'${f.name}'`)
      .join(", ")}];

    for (const field of requiredFields) {
      if (!createData[field]) {
        return NextResponse.json(
          { success: false, error: \`Missing required field: \${field}\` },
          { status: 400 }
        );
      }
    }

    const newRecord = await db
      .insert(${tableName})
      .values(createData as New${className})
      .returning();

    return NextResponse.json(
      { success: true, data: newRecord[0] },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating ${tableName}:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create ${tableName}' },
      { status: 500 }
    );
  }
}

// PUT - Update ${tableName} record
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Remove fields that shouldn't be updated
    const { id: bodyId, created_at, ...updateData } = body;

    // Add updated_at timestamp
    updateData.updated_at = new Date();

    const updatedRecord = await db
      .update(${tableName})
      .set(updateData)
      .where(eq(${tableName}.id, parseInt(id)))
      .returning();

    if (updatedRecord.length === 0) {
      return NextResponse.json(
        { success: false, error: '${className} not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedRecord[0]
    });

  } catch (error) {
    console.error('Error updating ${tableName}:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update ${tableName}' },
      { status: 500 }
    );
  }
}

// DELETE - Remove ${tableName} record
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      );
    }

    const deletedRecord = await db
      .delete(${tableName})
      .where(eq(${tableName}.id, parseInt(id)))
      .returning();

    if (deletedRecord.length === 0) {
      return NextResponse.json(
        { success: false, error: '${className} not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '${className} deleted successfully',
      data: deletedRecord[0]
    });

  } catch (error) {
    console.error('Error deleting ${tableName}:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete ${tableName}' },
      { status: 500 }
    );
  }
}
`;
  }

  // ---------------- Seeding ----------------
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
    fs.mkdirSync(path.dirname(seedPath), { recursive: true });
    fs.writeFileSync(seedPath, seedContent);
    console.log(chalk.gray(`   📁 Created: seed-${schemaDef.tableName}.ts`));
    this.startSpinner(`Seeding ${schemaDef.tableName} with sample data...`);
    try {
      execSync(`npx tsx scripts/seed-${schemaDef.tableName}.ts`, {
        stdio: "pipe",
        cwd: process.cwd(),
      });
      this.stopSpinner(true, `${schemaDef.tableName} seeded successfully`);
    } catch {
      this.stopSpinner(false, `Seeding failed for ${schemaDef.tableName}`);
    }
  }

  private generateSeedContent(schemaDef: SchemaDefinition): string {
    const tableName = schemaDef.tableName;
    const className = toPascalCase(tableName);

    // Generate sample data based on schema fields
    const sampleDataGenerator = this.generateSampleDataForSchema(schemaDef);

    return `import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import dotenv from "dotenv";
import { ${tableName}, type New${className} } from "../src/db/schema/${schemaDef.fileName.replace(
      ".ts",
      ""
    )}";

dotenv.config();

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/spotify_clone'
  });
  const db = drizzle(pool);

  // Sample data for ${tableName}
  const sampleData: New${className}[] = ${sampleDataGenerator};

  try {
    console.log('🌱 Seeding ${tableName} with sample data...');

    // Clear existing data (optional - comment out if you want to keep existing data)
    // await db.delete(${tableName});

    const insertedRecords = await db.insert(${tableName}).values(sampleData).returning();

    console.log(\`✅ Successfully seeded \${insertedRecords.length} records to ${tableName}\`);
    console.log('Sample records:', insertedRecords.slice(0, 3)); // Show first 3 records

  } catch (error) {
    console.error('❌ Error seeding ${tableName}:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed().catch(console.error);
`;
  }

  private generateSampleDataForSchema(schemaDef: SchemaDefinition): string {
    const { tableName, fields } = schemaDef;
    const sampleCount = 5; // Generate 5 sample records
    const samples: any[] = [];

    for (let i = 0; i < sampleCount; i++) {
      const record: any = {};

      fields.forEach((field) => {
        // Skip auto-generated fields
        if (["id", "created_at", "updated_at"].includes(field.name)) {
          return;
        }

        // Generate sample data based on field name and type
        switch (field.type) {
          case "text":
            record[field.name] = this.generateSampleText(field.name, i);
            break;
          case "integer":
            record[field.name] = this.generateSampleInteger(field.name, i);
            break;
          case "boolean":
            record[field.name] = Math.random() > 0.5;
            break;
          case "uuid":
            record[field.name] = `${Math.random()
              .toString(36)
              .substr(2, 8)}-${Math.random()
              .toString(36)
              .substr(2, 4)}-${Math.random()
              .toString(36)
              .substr(2, 4)}-${Math.random()
              .toString(36)
              .substr(2, 4)}-${Math.random().toString(36).substr(2, 12)}`;
            break;
          case "timestamp":
            if (
              field.name.includes("played_at") ||
              field.name.includes("timestamp")
            ) {
              record[field.name] = new Date(
                Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
              ); // Random time in last week
            }
            break;
        }
      });

      samples.push(record);
    }

    return JSON.stringify(samples, null, 2);
  }

  private generateSampleText(fieldName: string, index: number): string {
    const samples = {
      user_id: [
        `user_${index + 1}`,
        `spotify_user_${index + 1}`,
        `test_user_${index + 1}`,
      ],
      song_id: [
        `song_${index + 1}`,
        `track_${Math.random().toString(36).substr(2, 8)}`,
      ],
      song_title: [
        "Bohemian Rhapsody",
        "Hotel California",
        "Stairway to Heaven",
        "Imagine",
        "Sweet Child O Mine",
        "Billie Jean",
        "Like a Rolling Stone",
        "Purple Haze",
        "What's Going On",
        "Respect",
      ],
      artist: [
        "Queen",
        "Eagles",
        "Led Zeppelin",
        "John Lennon",
        "Guns N' Roses",
        "Michael Jackson",
        "Bob Dylan",
        "Jimi Hendrix",
        "Marvin Gaye",
        "Aretha Franklin",
      ],
      album: [
        "A Night at the Opera",
        "Hotel California",
        "Led Zeppelin IV",
        "Imagine",
        "Appetite for Destruction",
        "Thriller",
        "Highway 61 Revisited",
        "Are You Experienced",
        "What's Going On",
        "I Never Loved a Man",
      ],
      name: [`Sample Name ${index + 1}`, `Test Item ${index + 1}`],
      title: [`Sample Title ${index + 1}`, `Test Title ${index + 1}`],
      description: [
        `Sample description for item ${index + 1}`,
        `Test description ${index + 1}`,
      ],
      email: [`user${index + 1}@example.com`, `test${index + 1}@domain.com`],
      status: ["active", "inactive", "pending", "completed"],
      category: ["music", "entertainment", "lifestyle", "technology"],
    };

    if (samples[fieldName as keyof typeof samples]) {
      const options = samples[fieldName as keyof typeof samples];
      return options[index % options.length];
    }

    // Default fallback
    return `sample_${fieldName}_${index + 1}`;
  }

  private generateSampleInteger(fieldName: string, index: number): number {
    const ranges = {
      duration_seconds: () => Math.floor(Math.random() * 300) + 60, // 1-5 minutes
      play_count: () => Math.floor(Math.random() * 1000),
      rating: () => Math.floor(Math.random() * 5) + 1, // 1-5
      age: () => Math.floor(Math.random() * 50) + 18, // 18-68
      price: () => Math.floor(Math.random() * 10000) + 100, // cents
      quantity: () => Math.floor(Math.random() * 100) + 1,
    };

    if (ranges[fieldName as keyof typeof ranges]) {
      return ranges[fieldName as keyof typeof ranges]();
    }

    // Default fallback
    return Math.floor(Math.random() * 100) + 1;
  }

  // ---------------- Frontend Suggestions ----------------
  private async generateFrontendIntegration(
    schemaDefinitions: SchemaDefinition[],
    query: string
  ) {
    this.log({
      type: "integrating",
      message: "Generating frontend integration suggestions",
    });

    console.log(chalk.green("\n🔗 Frontend Integration:"));

    for (const def of schemaDefinitions) {
      const apiEndpoint = `/api/${def.tableName.replace(/_/g, "-")}`;
      const hookName = `use${toPascalCase(def.tableName)}`;

      console.log(chalk.blue(`\n📡 API Endpoint: ${apiEndpoint}`));
      console.log(
        chalk.gray(
          `   GET    ${apiEndpoint}                    - Fetch all records`
        )
      );
      console.log(
        chalk.gray(
          `   GET    ${apiEndpoint}?id=123             - Fetch specific record`
        )
      );
      console.log(
        chalk.gray(
          `   GET    ${apiEndpoint}?limit=10&offset=0  - Paginated fetch`
        )
      );
      if (def.fields.some((f) => f.name === "user_id")) {
        console.log(
          chalk.gray(
            `   GET    ${apiEndpoint}?user_id=abc       - Filter by user`
          )
        );
      }
      console.log(
        chalk.gray(
          `   POST   ${apiEndpoint}                    - Create new record`
        )
      );
      console.log(
        chalk.gray(
          `   PUT    ${apiEndpoint}?id=123             - Update record`
        )
      );
      console.log(
        chalk.gray(
          `   DELETE ${apiEndpoint}?id=123             - Delete record`
        )
      );

      // Generate React hook
      await this.generateReactHook(def);
      console.log(
        chalk.cyan(`   🪝 React Hook: ${hookName} (generated in hooks/)`)
      );
    }

    console.log(chalk.green("\n📋 Usage Examples:"));
    console.log(
      chalk.gray(`
// Fetch data in a React component:
import { ${schemaDefinitions
        .map((def) => `use${toPascalCase(def.tableName)}`)
        .join(", ")} } from '@/hooks';

function MyComponent() {
  const { data, loading, error, create, update, delete: remove } = use${toPascalCase(
    schemaDefinitions[0].tableName
  )}();

  // Fetch all records
  useEffect(() => {
    data.fetchAll();
  }, []);

  // Create new record
  const handleCreate = async () => {
    await create({ /* your data */ });
  };

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {data.records.map(record => (
        <div key={record.id}>{/* render record */}</div>
      ))}
    </div>
  );
}
    `)
    );
  }

  private async generateReactHook(schemaDef: SchemaDefinition) {
    const tableName = schemaDef.tableName;
    const className = toPascalCase(tableName);
    const hookName = `use${className}`;
    const apiEndpoint = `/api/${tableName.replace(/_/g, "-")}`;

    const hookContent = `import { useState, useCallback } from 'react';
import { ${className}, New${className} } from '@/db/schema';

interface ${className}State {
  records: ${className}[];
  loading: boolean;
  error: string | null;
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  } | null;
}

interface ${className}Actions {
  fetchAll: (params?: { limit?: number; offset?: number; user_id?: string }) => Promise<void>;
  fetchById: (id: number) => Promise<${className} | null>;
  create: (data: New${className}) => Promise<${className} | null>;
  update: (id: number, data: Partial<New${className}>) => Promise<${className} | null>;
  delete: (id: number) => Promise<boolean>;
  clearError: () => void;
}

export function ${hookName}() {
  const [state, setState] = useState<${className}State>({
    records: [],
    loading: false,
    error: null,
    pagination: null,
  });

  const setLoading = (loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  };

  const setError = (error: string | null) => {
    setState(prev => ({ ...prev, error }));
  };

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchAll = useCallback(async (params?: { limit?: number; offset?: number; user_id?: string }) => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.offset) searchParams.set('offset', params.offset.toString());
      if (params?.user_id) searchParams.set('user_id', params.user_id);

      const response = await fetch(\`${apiEndpoint}?\${searchParams}\`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch ${tableName}');
      }

      setState(prev => ({
        ...prev,
        records: result.data,
        pagination: result.pagination,
        loading: false,
      }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
      setLoading(false);
    }
  }, []);

  const fetchById = useCallback(async (id: number): Promise<${className} | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(\`${apiEndpoint}?id=\${id}\`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch ${tableName}');
      }

      setLoading(false);
      return result.data;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
      setLoading(false);
      return null;
    }
  }, []);

  const create = useCallback(async (data: New${className}): Promise<${className} | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('${apiEndpoint}', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create ${tableName}');
      }

      // Add new record to the beginning of the list
      setState(prev => ({
        ...prev,
        records: [result.data, ...prev.records],
        loading: false,
      }));

      return result.data;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
      setLoading(false);
      return null;
    }
  }, []);

  const update = useCallback(async (id: number, data: Partial<New${className}>): Promise<${className} | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(\`${apiEndpoint}?id=\${id}\`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update ${tableName}');
      }

      // Update the record in the list
      setState(prev => ({
        ...prev,
        records: prev.records.map(record =>
          record.id === id ? result.data : record
        ),
        loading: false,
      }));

      return result.data;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
      setLoading(false);
      return null;
    }
  }, []);

  const deleteRecord = useCallback(async (id: number): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(\`${apiEndpoint}?id=\${id}\`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete ${tableName}');
      }

      // Remove the record from the list
      setState(prev => ({
        ...prev,
        records: prev.records.filter(record => record.id !== id),
        loading: false,
      }));

      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
      setLoading(false);
      return false;
    }
  }, []);

  const actions: ${className}Actions = {
    fetchAll,
    fetchById,
    create,
    update,
    delete: deleteRecord,
    clearError,
  };

  return {
    data: state,
    loading: state.loading,
    error: state.error,
    ...actions,
  };
}
`;

    const hooksDir = path.join(process.cwd(), "src", "hooks");
    const hookPath = path.join(hooksDir, `${hookName}.ts`);

    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(hookPath, hookContent);

    // Update hooks index file
    await this.updateHooksIndex();
  }

  private async updateHooksIndex() {
    const hooksDir = path.join(process.cwd(), "src", "hooks");
    const indexPath = path.join(hooksDir, "index.ts");

    if (fs.existsSync(hooksDir)) {
      const hookFiles = fs
        .readdirSync(hooksDir)
        .filter((f) => f.endsWith(".ts") && f !== "index.ts")
        .map((f) => f.replace(".ts", ""));

      const indexContent = `// Auto-generated hooks index
${hookFiles.map((f) => `export * from './${f}';`).join("\n")}
`;

      fs.writeFileSync(indexPath, indexContent);
    }
  }
}
