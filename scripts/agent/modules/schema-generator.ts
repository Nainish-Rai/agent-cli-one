import chalk from "chalk";
import { SchemaDefinition } from "../types";
import { toPascalCase } from "../utils";

export class SchemaGenerator {
  async parseQueryForSchemas(
    query: string,
    model: any
  ): Promise<SchemaDefinition[]> {
    try {
      const schemaPrompt = `You are a database schema expert for PostgreSQL with Drizzle ORM. Analyze the user query and generate VALID schema definitions.\nUser Query: "${query}"\nReturn ONLY a JSON array.`;
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

  generateSchemaContent(schemaDef: SchemaDefinition): string {
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

  generateSchemaIndexContent(schemaFiles: string[]): string {
    const exports = schemaFiles
      .map((f) => `export * from "./${f.replace(".ts", "")}";`)
      .join("\n");
    return `${exports}`;
  }
}
