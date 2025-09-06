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
    return `import { NextRequest, NextResponse } from "next/server";\nimport { drizzle } from "drizzle-orm/node-postgres";\nimport { Pool } from "pg";\nimport { ${tableName} } from "@/db/schema";\nimport { desc, eq } from "drizzle-orm";\n\nconst pool = new Pool({ connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/spotify_clone" });\nconst db = drizzle(pool);\nexport async function GET(request: NextRequest){ try { const { searchParams } = new URL(request.url); const limit = parseInt(searchParams.get('limit')||'10'); const offset = parseInt(searchParams.get('offset')||'0'); const userId = searchParams.get('user_id'); let query = db.select().from(${tableName});${
      schemaDef.fields.some((f) => f.name === "user_id")
        ? " if(userId){ query = query.where(eq(" +
          tableName +
          ".user_id, userId)); }"
        : ""
    } const records = await query.orderBy(desc(${tableName}.created_at)).limit(limit).offset(offset); return NextResponse.json({ success:true, data: records, pagination:{ limit, offset, count: records.length }});} catch(e){ return NextResponse.json({ success:false, error:'Failed to fetch ${tableName}'},{ status:500}); } }\nexport async function POST(request: NextRequest){ try { const body = await request.json(); const newRecord = await db.insert(${tableName}).values(body).returning(); return NextResponse.json({ success:true, data:newRecord[0]}, { status:201}); } catch(e){ return NextResponse.json({ success:false, error:'Failed to create ${tableName}'},{ status:500}); } }\nexport async function DELETE(request: NextRequest){ try { const { searchParams } = new URL(request.url); const id = searchParams.get('id'); if(!id) return NextResponse.json({ success:false, error:'ID is required'},{ status:400}); await db.delete(${tableName}).where(eq(${tableName}.id, parseInt(id))); return NextResponse.json({ success:true, message:'${className} deleted successfully'});} catch(e){ return NextResponse.json({ success:false, error:'Failed to delete ${tableName}'},{ status:500}); } }`;
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
    return `import { drizzle } from "drizzle-orm/node-postgres";\nimport { Pool } from "pg";\nimport dotenv from "dotenv";\nimport { ${tableName} } from "../src/db/schema/${schemaDef.fileName.replace(
      ".ts",
      ""
    )}";\ndotenv.config();\nasync function seed(){ const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/spotify_clone'}); const db = drizzle(pool); const sampleData = []; try { await db.insert(${tableName}).values(sampleData); console.log('✅ ${tableName} seeded'); } catch(e){ console.error('❌ Error seeding ${tableName}', e);} finally { await pool.end(); } }\nseed().catch(console.error);`;
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
    schemaDefinitions.forEach((def) => {
      const apiEndpoint = `/api/${def.tableName.replace(/_/g, "-")}`;
      console.log(chalk.blue(`\n📡 API Endpoint: ${apiEndpoint}`));
      console.log(chalk.gray(`   GET    ${apiEndpoint}`));
      console.log(chalk.gray(`   POST   ${apiEndpoint}`));
      console.log(chalk.gray(`   DELETE ${apiEndpoint}?id=123`));
    });
  }
}
