import chalk from "chalk";
import { SchemaDefinition, ValidationResult } from "../types";

export class SchemaValidator {
  async validateSchema(schemaDef: SchemaDefinition): Promise<ValidationResult> {
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

  async validateGeneratedSchemas(
    schemaDefinitions: SchemaDefinition[]
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const schemaDef of schemaDefinitions) {
      const schemaPath = require("path").join(
        process.cwd(),
        "src",
        "db",
        "schema",
        schemaDef.fileName
      );

      if (!require("fs").existsSync(schemaPath)) {
        errors.push(`Schema file not found: ${schemaDef.fileName}`);
        continue;
      }

      const content = require("fs").readFileSync(schemaPath, "utf-8");
      if (!content.includes("pgTable"))
        errors.push(`${schemaDef.fileName}: Missing pgTable definition`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}
