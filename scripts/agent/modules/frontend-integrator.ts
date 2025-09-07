import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { SchemaDefinition } from "../types";
import { toPascalCase } from "../utils";

export class FrontendIntegrator {
  private model: any;

  constructor(model?: any) {
    this.model = model;
  }

  setModel(model: any) {
    this.model = model;
  }

  async generateFrontendIntegration(
    schemaDefinitions: SchemaDefinition[],
    query: string
  ) {
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

    await this.integrateIntoSpotifyComponents(schemaDefinitions, query);
    this.displayUsageExamples(schemaDefinitions);
  }

  private async generateReactHook(schemaDef: SchemaDefinition) {
    if (!this.model) {
      console.log(
        chalk.yellow("⚠️  No model set, using fallback hook template")
      );
      const hookContent = this.generateReactHookFallback(schemaDef);
      await this.writeHookFile(schemaDef, hookContent);
      return;
    }

    const hookContent = await this.generateReactHookContent(schemaDef);
    await this.writeHookFile(schemaDef, hookContent);
  }

  private async writeHookFile(schemaDef: SchemaDefinition, content: string) {
    const tableName = schemaDef.tableName;
    const className = toPascalCase(tableName);
    const hookName = `use${className}`;

    const hooksDir = path.join(process.cwd(), "src", "hooks");
    const hookPath = path.join(hooksDir, `${hookName}.ts`);

    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(hookPath, content);

    await this.updateHooksIndex();
  }

  private async generateReactHookContent(
    schemaDef: SchemaDefinition
  ): Promise<string> {
    const tableName = schemaDef.tableName;
    const className = toPascalCase(tableName);
    const hookName = `use${className}`;
    const apiEndpoint = `/api/${tableName.replace(/_/g, "-")}`;
    const hasUserId = schemaDef.fields.some((f) => f.name === "user_id");

    const fieldsInfo = schemaDef.fields.map((f) => ({
      name: f.name,
      type: f.type,
      isRequired:
        f.constraints?.includes("notNull()") &&
        !["id", "created_at", "updated_at"].includes(f.name),
    }));

    const hookPrompt = `Generate a complete React hook for managing database operations with TypeScript.

Table Information:
- Table name: ${tableName}
- Class name: ${className}
- Hook name: ${hookName}
- API endpoint: ${apiEndpoint}
- Has user_id field: ${hasUserId}
- Fields: ${JSON.stringify(fieldsInfo, null, 2)}

Requirements:
1. Use React 18+ with modern hooks (useState, useCallback, useEffect)
2. TypeScript with proper type definitions
3. State management for records, loading, error, pagination
4. CRUD operations: fetchAll, fetchById, create, update, delete
5. Error handling and loading states
6. Pagination support
7. User filtering if user_id field exists
8. Return interface with data and actions
9. Use fetch API with proper error handling
10. NO COMMENTS in the generated code

Hook interface should include:
- data: array of records with pagination info
- loading: boolean
- error: string | null
- fetchAll: (params?) => Promise<void>
- fetchById: (id) => Promise<T | null>
- create: (data) => Promise<T | null>
- update: (id, data) => Promise<T | null>
- delete: (id) => Promise<boolean>
- clearError: () => void

API Response format:
\`\`\`typescript
// Success: { success: true, data: T | T[], pagination?: {...} }
// Error: { success: false, error: string }
\`\`\`

Generate a complete, production-ready React hook with modern TypeScript patterns.

Generate ONLY the TypeScript code, no explanation or markdown formatting. Do not include any comments in the code.`;

    try {
      const result = await this.model.generateContent(hookPrompt);
      let generatedCode = result.response.text().trim();

      generatedCode = generatedCode
        .replace(/```typescript\n?/g, "")
        .replace(/```\n?/g, "")
        .replace(/\/\/[^\n]*\n/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");

      return generatedCode;
    } catch (error) {
      console.log(chalk.red(`❌ Error generating React hook: ${error}`));
      return this.generateReactHookFallback(schemaDef);
    }
  }

  private generateReactHookFallback(schemaDef: SchemaDefinition): string {
    const tableName = schemaDef.tableName;
    const className = toPascalCase(tableName);
    const hookName = `use${className}`;
    const apiEndpoint = `/api/${tableName.replace(/_/g, "-")}`;

    return `import { useState, useCallback } from 'react';
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

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const fetchAll = useCallback(async (params?: { limit?: number; offset?: number; user_id?: string }) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

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
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      }));
    }
  }, []);

  const fetchById = useCallback(async (id: number): Promise<${className} | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(\`${apiEndpoint}?id=\${id}\`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch ${tableName}');
      }

      setState(prev => ({ ...prev, loading: false }));
      return result.data;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      }));
      return null;
    }
  }, []);

  const create = useCallback(async (data: New${className}): Promise<${className} | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

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
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      }));
      return null;
    }
  }, []);

  const update = useCallback(async (id: number, data: Partial<New${className}>): Promise<${className} | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

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
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      }));
      return null;
    }
  }, []);

  const deleteRecord = useCallback(async (id: number): Promise<boolean> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

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
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      }));
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
  }

  private async integrateIntoSpotifyComponents(
    schemaDefinitions: SchemaDefinition[],
    query: string
  ) {
    const queryAnalysis = this.analyzeQueryForUIIntegration(
      query,
      schemaDefinitions
    );

    if (queryAnalysis.shouldUpdateMainContent) {
      await this.updateSpotifyMainContent(schemaDefinitions, queryAnalysis);
      console.log(
        chalk.cyan("   🎵 Updated SpotifyMainContent to use database data")
      );
    }

    if (queryAnalysis.shouldUpdateSidebar) {
      await this.updateSpotifySidebar(schemaDefinitions, queryAnalysis);
      console.log(
        chalk.cyan("   📱 Updated SpotifySidebar to use database data")
      );
    }

    await this.updateHooksIndex();
    console.log(chalk.cyan("   📦 Updated hooks index"));
  }

  private analyzeQueryForUIIntegration(
    query: string,
    schemaDefinitions: SchemaDefinition[]
  ) {
    const lowerQuery = query.toLowerCase();
    const analysis = {
      shouldUpdateMainContent: false,
      shouldUpdateSidebar: false,
      sections: [] as Array<{
        sectionName: string;
        targetArray: string;
        schema: SchemaDefinition;
        hookName: string;
      }>,
    };

    const uiMappings = [
      {
        keywords: ["recently played", "recent", "history", "last played"],
        sectionName: "Recently Played",
        targetArray: "recentlyPlayed",
        component: "main",
      },
      {
        keywords: ["made for you", "curated", "recommendations", "suggested"],
        sectionName: "Made For You",
        targetArray: "madeForYou",
        component: "main",
      },
      {
        keywords: [
          "popular albums",
          "popular",
          "trending albums",
          "top albums",
        ],
        sectionName: "Popular Albums",
        targetArray: "popularAlbums",
        component: "main",
      },
      {
        keywords: ["playlist", "playlists", "user playlist", "my playlist"],
        sectionName: "Playlists",
        targetArray: "recentlyPlayed",
        component: "sidebar",
      },
      {
        keywords: ["liked songs", "favorites", "saved songs", "hearted"],
        sectionName: "Liked Songs",
        targetArray: "recentlyPlayed",
        component: "sidebar",
      },
    ];

    for (const schema of schemaDefinitions) {
      const tableName = schema.tableName.toLowerCase();
      const schemaKeywords = tableName.split("_").concat(tableName.split("-"));

      const matchingMapping = uiMappings.find((mapping) => {
        const queryMatches = mapping.keywords.some((keyword) =>
          lowerQuery.includes(keyword)
        );

        const schemaMatches = mapping.keywords.some((keyword) =>
          keyword
            .split(" ")
            .every((word) =>
              schemaKeywords.some(
                (schemaWord) =>
                  schemaWord.includes(word) || word.includes(schemaWord)
              )
            )
        );

        return queryMatches || schemaMatches;
      });

      if (matchingMapping) {
        const hookName = `use${toPascalCase(schema.tableName)}`;

        analysis.sections.push({
          sectionName: matchingMapping.sectionName,
          targetArray: matchingMapping.targetArray,
          schema,
          hookName,
        });

        if (matchingMapping.component === "main") {
          analysis.shouldUpdateMainContent = true;
        } else if (matchingMapping.component === "sidebar") {
          analysis.shouldUpdateSidebar = true;
        }
      }
    }

    if (analysis.sections.length === 0) {
      for (const schema of schemaDefinitions) {
        const hookName = `use${toPascalCase(schema.tableName)}`;

        const hasTitle = schema.fields.some((f) =>
          ["title", "name", "song_title", "track_title"].includes(
            f.name.toLowerCase()
          )
        );
        const hasArtist = schema.fields.some((f) =>
          ["artist", "artist_name", "creator"].includes(f.name.toLowerCase())
        );

        if (hasTitle && hasArtist) {
          analysis.sections.push({
            sectionName: `${toPascalCase(schema.tableName)} Collection`,
            targetArray: "recentlyPlayed",
            schema,
            hookName,
          });
          analysis.shouldUpdateMainContent = true;
        } else {
          console.log(
            chalk.yellow(
              `   ⚠️  Schema ${schema.tableName} doesn't match known UI patterns`
            )
          );
        }
      }
    }

    return analysis;
  }

  private async updateSpotifyMainContent(
    schemaDefinitions: SchemaDefinition[],
    queryAnalysis: any
  ) {
    const uiIntegrator = new (await import("./ui-integrator")).UIIntegrator();
    uiIntegrator.setModel(this.model);
    await uiIntegrator.updateSpotifyMainContent(
      schemaDefinitions,
      queryAnalysis
    );
  }

  private async updateSpotifySidebar(
    schemaDefinitions: SchemaDefinition[],
    queryAnalysis: any
  ) {
    const uiIntegrator = new (await import("./ui-integrator")).UIIntegrator();
    uiIntegrator.setModel(this.model);
    await uiIntegrator.updateSpotifySidebar(schemaDefinitions, queryAnalysis);
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

  private displayUsageExamples(schemaDefinitions: SchemaDefinition[]) {
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
}
