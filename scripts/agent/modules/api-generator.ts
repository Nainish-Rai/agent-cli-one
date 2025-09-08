import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import { SchemaDefinition } from "../types";
import { toPascalCase } from "../utils";

export class ApiGenerator {
  private model: any;

  constructor(model?: any) {
    this.model = model;
  }

  setModel(model: any) {
    this.model = model;
  }

  // Add method to read database schema context
  private async getSchemaContext(): Promise<string> {
    const schemaDir = path.join(process.cwd(), "src", "db", "schema");
    const dbIndexPath = path.join(process.cwd(), "src", "db", "index.ts");

    let schemaContext = "";

    // Read main db index file
    if (fs.existsSync(dbIndexPath)) {
      const dbIndexContent = fs.readFileSync(dbIndexPath, "utf-8");
      schemaContext += `\n// Database configuration (src/db/index.ts):\n${dbIndexContent}\n`;
    }

    // Read schema index file
    const schemaIndexPath = path.join(schemaDir, "index.ts");
    if (fs.existsSync(schemaIndexPath)) {
      const schemaIndexContent = fs.readFileSync(schemaIndexPath, "utf-8");
      schemaContext += `\n// Schema exports (src/db/schema/index.ts):\n${schemaIndexContent}\n`;
    }

    // Read all schema files
    if (fs.existsSync(schemaDir)) {
      const schemaFiles = fs
        .readdirSync(schemaDir)
        .filter((file) => file.endsWith(".ts") && file !== "index.ts");

      for (const file of schemaFiles) {
        const filePath = path.join(schemaDir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        schemaContext += `\n// Schema file (src/db/schema/${file}):\n${content}\n`;
      }
    }

    return schemaContext;
  }

  async generateApiRoute(schemaDef: SchemaDefinition) {
    if (!this.model) {
      throw new Error(
        "Model is required for API generation. No fallback available."
      );
    }

    // Generate both the main route and the dynamic [id] route
    await this.generateMainApiRoute(schemaDef);
    await this.generateDynamicApiRoute(schemaDef);
  }

  private async generateMainApiRoute(schemaDef: SchemaDefinition) {
    const apiContent = await this.generateMainRouteContent(schemaDef);
    await this.writeMainApiRoute(schemaDef, apiContent);
  }

  private async generateDynamicApiRoute(schemaDef: SchemaDefinition) {
    const apiContent = await this.generateDynamicRouteContent(schemaDef);
    await this.writeDynamicApiRoute(schemaDef, apiContent);
  }

  private async writeMainApiRoute(
    schemaDef: SchemaDefinition,
    content: string
  ) {
    const apiPath = path.join(
      process.cwd(),
      "src",
      "app",
      "api",
      schemaDef.tableName.replace(/_/g, "-"),
      "route.ts"
    );
    fs.mkdirSync(path.dirname(apiPath), { recursive: true });
    fs.writeFileSync(apiPath, content);
    console.log(
      chalk.gray(
        `   📁 Created: api/${schemaDef.tableName.replace(/_/g, "-")}/route.ts`
      )
    );
  }

  private async writeDynamicApiRoute(
    schemaDef: SchemaDefinition,
    content: string
  ) {
    const apiPath = path.join(
      process.cwd(),
      "src",
      "app",
      "api",
      schemaDef.tableName.replace(/_/g, "-"),
      "[id]",
      "route.ts"
    );
    fs.mkdirSync(path.dirname(apiPath), { recursive: true });
    fs.writeFileSync(apiPath, content);
    console.log(
      chalk.gray(
        `   📁 Created: api/${schemaDef.tableName.replace(
          /_/g,
          "-"
        )}/[id]/route.ts`
      )
    );
  }

  private async generateMainRouteContent(
    schemaDef: SchemaDefinition
  ): Promise<string> {
    const tableName = schemaDef.tableName;
    const className = toPascalCase(tableName);
    const hasUserId = schemaDef.fields.some((f) => f.name === "user_id");

    const fieldsInfo = schemaDef.fields
      .filter((f) => !["id", "created_at", "updated_at"].includes(f.name))
      .map((f) => ({
        name: f.name,
        type: f.type,
        isRequired: f.constraints?.includes("notNull()"),
      }));

    const requiredFields = fieldsInfo
      .filter((f) => f.isRequired)
      .map((f) => f.name);

    // Get database schema context
    const schemaContext = await this.getSchemaContext();

    const apiPrompt = `You are generating a Next.js API route for a PostgreSQL database with Drizzle ORM.

DATABASE SCHEMA CONTEXT:
${schemaContext}

TARGET TABLE INFORMATION:
- Table: ${tableName}
- Type: ${className}
- Required fields: ${requiredFields.join(", ")}
- Has user_id: ${hasUserId}
- All fields: ${JSON.stringify(fieldsInfo, null, 2)}

Generate a Next.js API route for the main CRUD operations (GET all, POST create) following this exact pattern:

CRITICAL REQUIREMENTS:
1. Use camelCase for table imports (e.g., import { recentlyPlayedSongs } from '@/db/schema')
2. Use the correct table export name from the schema files above
3. Ensure field names match the actual schema definition
4. Include proper error handling and validation
5. Use NextRequest/NextResponse types
6. Follow Drizzle ORM patterns shown in the schema context

Generate ONLY the TypeScript code, no markdown blocks or explanations.`;

    try {
      const result = await this.model.generateContent(apiPrompt);
      let generatedCode = result.response.text().trim();

      // Clean the response
      generatedCode = generatedCode
        .replace(/```typescript\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      return generatedCode;
    } catch (error) {
      throw new Error(`Failed to generate main API route: ${error}`);
    }
  }

  private async generateDynamicRouteContent(
    schemaDef: SchemaDefinition
  ): Promise<string> {
    const tableName = schemaDef.tableName;
    const className = toPascalCase(tableName);

    const fieldsInfo = schemaDef.fields
      .filter((f) => !["id", "created_at", "updated_at"].includes(f.name))
      .map((f) => ({
        name: f.name,
        type: f.type,
        isRequired: f.constraints?.includes("notNull()"),
      }));

    // Get database schema context
    const schemaContext = await this.getSchemaContext();

    const apiPrompt = `You are generating a Next.js dynamic API route for individual operations with PostgreSQL and Drizzle ORM.

DATABASE SCHEMA CONTEXT:
${schemaContext}

TARGET TABLE INFORMATION:
- Table: ${tableName}
- Type: ${className}
- All fields: ${JSON.stringify(fieldsInfo, null, 2)}

Generate a Next.js dynamic API route for individual operations (GET by ID, PUT update, DELETE) with these requirements:

CRITICAL REQUIREMENTS:
1. Use camelCase for table imports matching the schema files above
2. Use the correct table export name from the schema context
3. Import from '@/db' and '@/db/schema' as shown in the schema context
4. Include proper error handling for all operations
5. Use eq from 'drizzle-orm' for WHERE clauses
6. Follow the exact field names from the schema definition
7. Include updated_at field handling if it exists in the schema

Generate ONLY the TypeScript code for GET, PUT, and DELETE operations, no markdown blocks or explanations.`;

    try {
      const result = await this.model.generateContent(apiPrompt);
      let generatedCode = result.response.text().trim();

      // Clean the response
      generatedCode = generatedCode
        .replace(/```typescript\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      return generatedCode;
    } catch (error) {
      throw new Error(`Failed to generate dynamic API route: ${error}`);
    }
  }
}
