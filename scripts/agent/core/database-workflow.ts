import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { SchemaDefinition } from "../types";
import { BaseAgent } from "./base-agent";

export class DatabaseWorkflow extends BaseAgent {
  async implementSchema(schemaDef: SchemaDefinition, schemaGenerator: any) {
    this.log({
      type: "creating",
      message: `Creating ${schemaDef.tableName} schema definition`,
    });
    const schemaContent = await schemaGenerator.generateSchemaContent(
      schemaDef
    );
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

  async updateSchemaIndex(
    schemaDefinitions: SchemaDefinition[],
    schemaGenerator: any
  ) {
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
    const indexContent = await schemaGenerator.generateSchemaIndexContent(all);
    fs.writeFileSync(indexPath, indexContent);
    console.log(chalk.gray("   📁 Updated: schema/index.ts"));
  }

  async runMigrations() {
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

  async validateSchemas(
    schemaDefinitions: SchemaDefinition[],
    schemaValidator: any
  ) {
    let allSchemasValid = true;

    for (const schemaDef of schemaDefinitions) {
      const validation = await schemaValidator.validateSchema(schemaDef);
      if (!validation.isValid) {
        allSchemasValid = false;
        console.log(
          chalk.red(`❌ Schema validation failed for ${schemaDef.tableName}:`)
        );
        validation.errors.forEach((e: string) =>
          console.log(chalk.red(`   • ${e}`))
        );
      } else {
        console.log(
          chalk.green(`✅ Schema validation passed for ${schemaDef.tableName}`)
        );
        validation.warnings.forEach((w: string) =>
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
      return false;
    }

    return true;
  }

  async validateGeneratedSchemas(
    schemaDefinitions: SchemaDefinition[],
    schemaValidator: any
  ) {
    const schemaValidation = await schemaValidator.validateGeneratedSchemas(
      schemaDefinitions
    );
    if (!schemaValidation.isValid) {
      console.log(chalk.red("\n❌ Generated schema files have errors:"));
      schemaValidation.errors.forEach((e: string) =>
        console.log(chalk.red(`   • ${e}`))
      );
      return false;
    }
    return true;
  }
}
