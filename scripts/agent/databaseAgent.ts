import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { BaseAgent } from "./core/base-agent";
import { ProjectAnalyzer } from "./core/project-analyzer";
import { SchemaValidator } from "./modules/schema-validator";
import { SchemaGenerator } from "./modules/schema-generator";
import { ApiGenerator } from "./modules/api-generator";
import { SeedGenerator } from "./modules/seed-generator";
import { SchemaDefinition } from "./types";
import { toPascalCase } from "./utils";

export class DatabaseAgent extends BaseAgent {
  private projectAnalyzer = new ProjectAnalyzer();
  private schemaValidator = new SchemaValidator();
  private schemaGenerator = new SchemaGenerator();
  private apiGenerator = new ApiGenerator();
  private seedGenerator = new SeedGenerator();

  async processQuery(query: string) {
    this.log({ type: "thinking", message: "Processing your request..." });
    this.startSpinner("Analyzing project structure...");
    await this.projectAnalyzer.getProjectContext();
    this.stopSpinner(true, "Project analysis complete");

    this.log({
      type: "analyzing",
      message: "Understanding your requirements...",
    });
    const schemaDefinitions = await this.schemaGenerator.parseQueryForSchemas(
      query,
      this.model
    );

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
      const validation = await this.schemaValidator.validateSchema(schemaDef);
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

    const schemaValidation =
      await this.schemaValidator.validateGeneratedSchemas(schemaDefinitions);
    if (!schemaValidation.isValid) {
      console.log(chalk.red("\n❌ Generated schema files have errors:"));
      schemaValidation.errors.forEach((e) =>
        console.log(chalk.red(`   • ${e}`))
      );
      return;
    }

    await this.runMigrations();
    for (const schemaDef of schemaDefinitions)
      await this.apiGenerator.generateApiRoute(schemaDef);
    for (const schemaDef of schemaDefinitions)
      await this.seedGenerator.generateSeedData(schemaDef);
    await this.generateFrontendIntegration(schemaDefinitions, query);

    console.log(chalk.green("\n✅ Database implementation complete!"));
    console.log(
      chalk.cyan(
        "🚀 Your new database tables are ready with API endpoints and sample data."
      )
    );
  }

  private async implementSchema(schemaDef: SchemaDefinition) {
    this.log({
      type: "creating",
      message: `Creating ${schemaDef.tableName} schema definition`,
    });
    const schemaContent = this.schemaGenerator.generateSchemaContent(schemaDef);
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
    fs.writeFileSync(
      indexPath,
      this.schemaGenerator.generateSchemaIndexContent(all)
    );
    console.log(chalk.gray("   📁 Updated: schema/index.ts"));
  }

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

  useEffect(() => {
    data.fetchAll();
  }, []);

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

      const indexContent = `${hookFiles
        .map((f) => `export * from './${f}';`)
        .join("\n")}
`;

      fs.writeFileSync(indexPath, indexContent);
    }
  }
}
