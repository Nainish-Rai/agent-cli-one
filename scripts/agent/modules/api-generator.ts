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

  async generateApiRoute(schemaDef: SchemaDefinition) {
    if (!this.model) {
      console.log(chalk.yellow("⚠️  No model set, using fallback template"));
      const apiContent = this.generateApiRouteContentFallback(schemaDef);
      await this.writeApiRoute(schemaDef, apiContent);
      return;
    }

    const apiContent = await this.generateApiRouteContent(schemaDef);
    await this.writeApiRoute(schemaDef, apiContent);
  }

  private async writeApiRoute(schemaDef: SchemaDefinition, content: string) {
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

  private async generateApiRouteContent(
    schemaDef: SchemaDefinition
  ): Promise<string> {
    const tableName = schemaDef.tableName;
    const className = toPascalCase(tableName);
    const hasUserId = schemaDef.fields.some((f) => f.name === "user_id");

    const fieldsInfo = schemaDef.fields.map((f) => ({
      name: f.name,
      type: f.type,
      isRequired:
        f.constraints?.includes("notNull()") &&
        !["id", "created_at", "updated_at"].includes(f.name),
    }));

    const apiPrompt = `Generate a complete Next.js API route file for a database table with full CRUD operations.

Table Information:
- Table name: ${tableName}
- Class name: ${className}
- Has user_id field: ${hasUserId}
- Fields: ${JSON.stringify(fieldsInfo, null, 2)}

Requirements:
1. Use Next.js 14+ App Router (NextRequest, NextResponse)
2. Use Drizzle ORM with PostgreSQL
3. Import from "drizzle-orm/node-postgres" (NOT "drizzle-orm/pg-core")
4. Import table and types from "@/db/schema"
5. Implement GET, POST, PUT, DELETE methods
6. Support pagination (limit, offset)
7. Support filtering by id and user_id (if applicable)
8. Include proper error handling and validation
9. Use proper TypeScript types
10. Return consistent JSON responses with success/error format
11. NO COMMENTS in the generated code
12. Use proper database connection string format
13. Handle SSL for cloud databases (neon.tech detection)
14. Avoid query reassignment - use separate queries for different conditions

Database setup template:
\`\`\`typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/spotify_clone",
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});
const db = drizzle(pool);
\`\`\`

Import pattern:
\`\`\`typescript
import { ${tableName}, type ${className}, type New${className} } from "@/db/schema";
\`\`\`

Query pattern for conditional WHERE clauses:
\`\`\`typescript
const whereConditions = [];
if (condition) {
  whereConditions.push(eq(table.field, value));
}
const whereClause = whereConditions.length > 0
  ? (whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions))
  : undefined;

const records = await db
  .select()
  .from(${tableName})
  .where(whereClause)
  .orderBy(desc(${tableName}.created_at))
  .limit(limit)
  .offset(offset);
\`\`\`

Response format:
\`\`\`typescript
// Success: { success: true, data: T, pagination?: {...} }
// Error: { success: false, error: string }
\`\`\`

Generate the complete API route file with all imports and exports. Use modern TypeScript and follow Next.js 14+ best practices.

CRITICAL: Ensure the database connection string is properly terminated and uses correct imports.

Generate ONLY the TypeScript code, no explanation or markdown formatting. Do not include any comments in the code.`;

    try {
      const result = await this.model.generateContent(apiPrompt);
      let generatedCode = result.response.text().trim();

      generatedCode = generatedCode
        .replace(/```typescript\n?/g, "")
        .replace(/```\n?/g, "")
        .replace(/\/\/[^\n]*\n/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");

      // Post-process to fix common issues
      generatedCode = this.postProcessGeneratedCode(generatedCode, schemaDef);

      return generatedCode;
    } catch (error) {
      console.log(chalk.red(`❌ Error generating API route: ${error}`));
      return this.generateApiRouteContentFallback(schemaDef);
    }
  }

  private postProcessGeneratedCode(
    code: string,
    schemaDef: SchemaDefinition
  ): string {
    const tableName = schemaDef.tableName;
    const className = toPascalCase(tableName);

    // Fix common issues in generated code
    let fixedCode = code;

    // Ensure proper connection string termination
    fixedCode = fixedCode.replace(
      /connectionString: process\.env\.DATABASE_URL \|\| "postgresql:[^"]*$/gm,
      `connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/spotify_clone"`
    );

    // Ensure correct Drizzle import
    fixedCode = fixedCode.replace(
      /from ['"](drizzle-orm\/pg-core|drizzle-orm\/postgres-js)['"]/g,
      'from "drizzle-orm/node-postgres"'
    );

    // Fix type import patterns
    fixedCode = fixedCode.replace(/\$inferSelect|\$inferInsert/g, (match) =>
      match === "$inferSelect" ? className : `New${className}`
    );

    // Ensure proper table import
    if (!fixedCode.includes(`{ ${tableName},`)) {
      fixedCode = fixedCode.replace(
        /import.*from "@\/db\/schema";/,
        `import { ${tableName}, type ${className}, type New${className} } from "@/db/schema";`
      );
    }

    return fixedCode;
  }

  private generateApiRouteContentFallback(schemaDef: SchemaDefinition): string {
    const tableName = schemaDef.tableName;
    const className = toPascalCase(tableName);
    const hasUserId = schemaDef.fields.some((f) => f.name === "user_id");

    return `import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ${tableName}, type ${className}, type New${className} } from "@/db/schema";
import { desc, eq, and, count } from "drizzle-orm";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/spotify_clone",
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});
const db = drizzle(pool);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
    const userId = searchParams.get('user_id');
    const id = searchParams.get('id');

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

    let query = db.select().from(${tableName});
    let countQuery = db.select({ count: count() }).from(${tableName});

    const whereConditions = [];

    if (userId) {
      whereConditions.push(eq(${tableName}.user_id, userId));
    }

    if (whereConditions.length > 0) {
      const whereClause = whereConditions.length === 1
        ? whereConditions[0]
        : and(...whereConditions);
      query = query.where(whereClause);
      countQuery = countQuery.where(whereClause);
    }

    const [totalResult] = await countQuery;
    const total = totalResult.count;

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { id, created_at, updated_at, ...createData } = body;

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

    const { id: bodyId, created_at, ...updateData } = body;
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
}
