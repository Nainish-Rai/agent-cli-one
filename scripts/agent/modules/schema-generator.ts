import chalk from "chalk";
import { SchemaDefinition } from "../types";
import { toPascalCase } from "../utils";

export class SchemaGenerator {
  private model: any;

  constructor(model?: any) {
    this.model = model;
  }

  setModel(model: any) {
    this.model = model;
  }

  async parseQueryForSchemas(
    query: string,
    model: any
  ): Promise<SchemaDefinition[]> {
    this.model = model;
    try {
      const schemaPrompt = `You are a database schema expert for PostgreSQL with Drizzle ORM.

Analyze this user query and generate VALID schema definitions for a Next.js project with TypeScript.

User Query: "${query}"

Return ONLY a JSON array with schema definitions. Each schema should have:
- tableName: lowercase with underscores (e.g., "recently_played", "user_playlists")
- fileName: the TypeScript file name (e.g., "recently_played.ts")
- fields: array of field objects with name, type, and constraints

Available Drizzle field types: serial, text, varchar, integer, boolean, timestamp, uuid, json
Available constraints: primaryKey(), notNull(), unique(), defaultNow(), default(value)

Ensure each table has:
- id field as serial primaryKey()
- created_at and updated_at timestamp fields with defaultNow() and notNull()

Example format:
[
  {
    "tableName": "recently_played",
    "fileName": "recently_played.ts",
    "fields": [
      {"name": "id", "type": "serial", "constraints": ["primaryKey()"]},
      {"name": "song_title", "type": "text", "constraints": ["notNull()"]},
      {"name": "artist_name", "type": "text", "constraints": ["notNull()"]},
      {"name": "created_at", "type": "timestamp", "constraints": ["defaultNow()", "notNull()"]},
      {"name": "updated_at", "type": "timestamp", "constraints": ["defaultNow()", "notNull()"]}
    ]
  }
]

Return ONLY the JSON array, no explanation.`;

      const result = await model.generateContent(schemaPrompt);
      const text = result.response.text();
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

        // Ensure required fields exist
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
      console.log(chalk.red(`❌ Error analyzing query: ${e.message}`));
      return [];
    }
  }

  async generateSchemaContent(schemaDef: SchemaDefinition): Promise<string> {
    if (!this.model) {
      throw new Error("Model not set. Call setModel() first.");
    }

    const schemaPrompt = `Generate a Drizzle ORM schema file for PostgreSQL with TypeScript.

Table Definition:
- Table name: ${schemaDef.tableName}
- Fields: ${JSON.stringify(schemaDef.fields, null, 2)}

Requirements:
1. Import necessary types from "drizzle-orm/pg-core" (pgTable, serial, text, timestamp, integer, boolean, uuid, etc.)
2. Create the table using pgTable()
3. Export the table and TypeScript types
4. Use proper Drizzle ORM syntax
5. Include inferSelect and inferInsert types

Example structure:
\`\`\`typescript
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const tableName = pgTable("table_name", {
  id: serial("id").primaryKey(),
  field_name: text("field_name").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export type TableName = typeof tableName.$inferSelect;
export type NewTableName = typeof tableName.$inferInsert;
\`\`\`

Generate ONLY the TypeScript code, no explanation or markdown formatting.`;

    try {
      const result = await this.model.generateContent(schemaPrompt);
      return result.response.text().trim();
    } catch (error) {
      console.log(chalk.red(`❌ Error generating schema content: ${error}`));
      // Fallback to basic template
      return this.generateBasicSchemaContent(schemaDef);
    }
  }

  async generateSchemaIndexContent(schemaFiles: string[]): Promise<string> {
    if (!this.model) {
      throw new Error("Model not set. Call setModel() first.");
    }

    const indexPrompt = `Generate a TypeScript index file that exports all schema files.

Schema files to export: ${schemaFiles.join(", ")}

Requirements:
1. Export everything from each schema file
2. Use proper ES6 export syntax
3. Remove .ts extension from imports

Example:
\`\`\`typescript
export * from "./schema1";
export * from "./schema2";
\`\`\`

Generate ONLY the TypeScript code, no explanation or markdown formatting.`;

    try {
      const result = await this.model.generateContent(indexPrompt);
      return result.response.text().trim();
    } catch (error) {
      console.log(chalk.red(`❌ Error generating index content: ${error}`));
      // Fallback
      return schemaFiles
        .map((f) => `export * from "./${f.replace(".ts", "")}";`)
        .join("\n");
    }
  }

  // Fallback method for basic schema generation
  private generateBasicSchemaContent(schemaDef: SchemaDefinition): string {
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
}
