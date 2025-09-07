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

    const apiPrompt = `Generate a Next.js API route for the main CRUD operations (GET all, POST create) following this exact pattern:

Table: ${tableName}
Type: ${className}
Required fields: ${requiredFields.join(", ")}
Has user_id: ${hasUserId}

Generate EXACTLY this structure:
NOTE: for tableName use camelCase ie import { recentlyPlayedSongs } from '@/db/schema'; instead of import { recently_played_songs } from '@/db/schema';


\`\`\`typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { ${tableName} } from '@/db/schema';

// GET - Fetch all ${tableName}
export async function GET() {
  try {
    const all${className} = await db.select().from(${tableName});
    return NextResponse.json(all${className});
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch ${tableName}' },
      { status: 500 }
    );
  }
}

// POST - Create a new ${tableName.slice(0, -1)}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ${fieldsInfo.map((f) => f.name).join(", ")} } = body;

    ${
      requiredFields.length > 0
        ? `
    if (!${requiredFields.join(" || !")}) {
      return NextResponse.json(
        { error: '${requiredFields.join(", ")} ${
            requiredFields.length > 1 ? "are" : "is"
          } required' },
        { status: 400 }
      );
    }`
        : ""
    }

    const new${className} = await db.insert(${tableName}).values({
      ${fieldsInfo.map((f) => f.name).join(",\n      ")},
    }).returning();

    return NextResponse.json(new${className}[0], { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create ${tableName.slice(0, -1)}' },
      { status: 500 }
    );
  }
}
\`\`\`

Return ONLY the TypeScript code, no markdown blocks or explanations.`;

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

    const apiPrompt = `Generate a Next.js dynamic API route for individual operations (GET by ID, PUT update, DELETE) following this exact pattern:

Table: ${tableName}
Type: ${className}

Generate EXACTLY this structure:

\`\`\`typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { ${tableName} } from '@/db/schema';
import { eq } from 'drizzle-orm';

// GET - Fetch a single ${tableName.slice(0, -1)} by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ${tableName.slice(0, -1)}Id = parseInt(params.id);

    const ${tableName.slice(0, -1)} = await db.select()
      .from(${tableName})
      .where(eq(${tableName}.id, ${tableName.slice(0, -1)}Id))
      .limit(1);

    if (${tableName.slice(0, -1)}.length === 0) {
      return NextResponse.json(
        { error: '${className} not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(${tableName.slice(0, -1)}[0]);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch ${tableName.slice(0, -1)}' },
      { status: 500 }
    );
  }
}

// PUT - Update a ${tableName.slice(0, -1)}
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ${tableName.slice(0, -1)}Id = parseInt(params.id);
    const body = await request.json();
    const { ${fieldsInfo.map((f) => f.name).join(", ")} } = body;

    const updated${className} = await db.update(${tableName})
      .set({
        ${fieldsInfo.map((f) => f.name).join(",\n        ")},
        ${
          schemaDef.fields.some((f) => f.name === "updated_at")
            ? "updatedAt: new Date(),"
            : ""
        }
      })
      .where(eq(${tableName}.id, ${tableName.slice(0, -1)}Id))
      .returning();

    if (updated${className}.length === 0) {
      return NextResponse.json(
        { error: '${className} not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updated${className}[0]);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update ${tableName.slice(0, -1)}' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a ${tableName.slice(0, -1)}
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ${tableName.slice(0, -1)}Id = parseInt(params.id);

    const deleted${className} = await db.delete(${tableName})
      .where(eq(${tableName}.id, ${tableName.slice(0, -1)}Id))
      .returning();

    if (deleted${className}.length === 0) {
      return NextResponse.json(
        { error: '${className} not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: '${className} deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete ${tableName.slice(0, -1)}' },
      { status: 500 }
    );
  }
}
\`\`\`

Return ONLY the TypeScript code, no markdown blocks or explanations.`;

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
