import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { SchemaDefinition } from "../types";
import { toPascalCase } from "../utils";

export class FrontendIntegrator {
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
  update: (id: number, data: Partial<New${className}>): Promise<${className} | null>;
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

    // Map query keywords to UI sections
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

    // Check each schema against the query and UI mappings
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

    // If no specific mapping found, try to infer from table structure
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
    // Delegate to UIIntegrator for complex component updates
    const uiIntegrator = new (await import("./ui-integrator")).UIIntegrator();
    await uiIntegrator.updateSpotifyMainContent(
      schemaDefinitions,
      queryAnalysis
    );
  }

  private async updateSpotifySidebar(
    schemaDefinitions: SchemaDefinition[],
    queryAnalysis: any
  ) {
    // Delegate to UIIntegrator for complex component updates
    const uiIntegrator = new (await import("./ui-integrator")).UIIntegrator();
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
