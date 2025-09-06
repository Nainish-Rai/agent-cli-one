import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import { SchemaDefinition } from "../types";
import { toPascalCase } from "../utils";

export class ApiGenerator {
  async generateApiRoute(schemaDef: SchemaDefinition) {
    const apiContent = this.generateApiRouteContent(schemaDef);
    const apiPath = path.join(
      process.cwd(),
      "src",
      "app",
      "api",
      schemaDef.tableName.replace(/_/g, "-"),
      "route.ts"
    );
    fs.mkdirSync(path.dirname(apiPath), { recursive: true });
    fs.writeFileSync(apiPath, apiContent);
    console.log(
      chalk.gray(
        `   📁 Created: api/${schemaDef.tableName.replace(/_/g, "-")}/route.ts`
      )
    );
  }

  private generateApiRouteContent(schemaDef: SchemaDefinition): string {
    const tableName = schemaDef.tableName;
    const className = toPascalCase(tableName);
    const hasUserId = schemaDef.fields.some((f) => f.name === "user_id");

    return `import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ${tableName}, type ${className}, type New${className} } from "@/db/schema";
import { desc, eq, and, count } from "drizzle-orm";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/spotify_clone"
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
    ${
      hasUserId
        ? `
    if (userId) {
      whereConditions.push(eq(${tableName}.user_id, userId));
    }`
        : ""
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
