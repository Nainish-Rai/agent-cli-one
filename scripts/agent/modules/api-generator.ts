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

    const apiPrompt = `You are a Next.js API route code generator. Generate a COMPLETE, SYNTACTICALLY CORRECT TypeScript file for a database table with full CRUD operations.

CRITICAL REQUIREMENTS - MUST BE FOLLOWED EXACTLY:

1. COMPLETE FILE STRUCTURE:
   - All imports at the top
   - Database setup with proper closing braces
   - All 4 HTTP methods (GET, POST, PUT, DELETE) with complete function declarations
   - Each function must have proper opening and closing braces

2. EXACT DATABASE SETUP (copy this exactly):
\`\`\`typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/spotify_clone",
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});
const db = drizzle(pool);
\`\`\`

3. EXACT IMPORTS (copy these exactly):
\`\`\`typescript
import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ${tableName}, type ${className}, type New${className} } from "@/db/schema";
import { desc, eq, and, count } from "drizzle-orm";
\`\`\`

4. FUNCTION STRUCTURE - Each function must be complete:
\`\`\`typescript
export async function GET(request: NextRequest) {
  try {
    // function body here
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Error message" }, { status: 500 });
  }
}
\`\`\`

5. PARAMETER VALIDATION must be INSIDE functions, not orphaned:
   - URL parameters: const { searchParams } = new URL(request.url);
   - Body validation: const body = await request.json();

Table Information:
- Table name: ${tableName}
- Class name: ${className}
- Has user_id field: ${hasUserId}
- Fields: ${JSON.stringify(fieldsInfo, null, 2)}

REQUIRED FUNCTIONALITY:
- GET: Support id parameter for single record, pagination (limit/offset), filtering by user_id
- POST: Create new record with validation of required fields
- PUT: Update record by id with validation
- DELETE: Delete record by id

VALIDATION CHECKLIST (ensure all are met):
✓ All imports present and correct
✓ Database pool has proper closing brace and semicolon
✓ Database drizzle initialization present
✓ All 4 functions declared with export async function NAME(request: NextRequest)
✓ All functions have try-catch blocks
✓ All functions have proper opening and closing braces
✓ No orphaned code outside functions
✓ Consistent error response format: { success: false, error: "message" }
✓ Consistent success response format: { success: true, data: result }

Generate ONLY the complete TypeScript code. No explanations, no markdown formatting, no comments.

START YOUR RESPONSE WITH:
import { NextRequest, NextResponse } from "next/server";`;

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;

      try {
        const result = await this.model.generateContent(apiPrompt);
        let generatedCode = result.response.text().trim();

        // Clean the response
        generatedCode = generatedCode
          .replace(/```typescript\n?/g, "")
          .replace(/```\n?/g, "")
          .replace(/\/\/[^\n]*\n/g, "") // Remove single-line comments
          .replace(/\/\*[\s\S]*?\*\//g, ""); // Remove multi-line comments

        // Validate the generated code
        const validationResult = this.validateGeneratedCode(
          generatedCode,
          schemaDef
        );

        if (validationResult.isValid) {
          console.log(
            chalk.green(`✅ Generated valid API route on attempt ${attempts}`)
          );
          return this.postProcessGeneratedCode(generatedCode, schemaDef);
        } else {
          console.log(
            chalk.yellow(
              `⚠️  Attempt ${attempts} failed validation: ${validationResult.errors.join(
                ", "
              )}`
            )
          );

          if (attempts < maxAttempts) {
            // Enhance prompt with specific validation errors for next attempt
            const enhancedPrompt =
              apiPrompt +
              `

PREVIOUS ATTEMPT FAILED WITH THESE ERRORS:
${validationResult.errors.map((error) => `- ${error}`).join("\n")}

FIX THESE SPECIFIC ISSUES in your response. Pay special attention to:
- Proper brace balancing
- Complete function declarations
- Database initialization
- No orphaned code`;

            const retryResult = await this.model.generateContent(
              enhancedPrompt
            );
            generatedCode = retryResult.response
              .text()
              .trim()
              .replace(/```typescript\n?/g, "")
              .replace(/```\n?/g, "")
              .replace(/\/\/[^\n]*\n/g, "")
              .replace(/\/\*[\s\S]*?\*\//g, "");
          }
        }
      } catch (error) {
        console.log(chalk.red(`❌ Error on attempt ${attempts}: ${error}`));
        if (attempts === maxAttempts) {
          throw new Error(
            `Failed to generate valid API route after ${maxAttempts} attempts: ${error}`
          );
        }
      }
    }

    throw new Error(
      `Failed to generate valid API route after ${maxAttempts} attempts`
    );
  }

  private validateGeneratedCode(
    code: string,
    schemaDef: SchemaDefinition
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const tableName = schemaDef.tableName;
    const className = toPascalCase(tableName);

    // Check for required imports
    if (!code.includes("import { NextRequest, NextResponse }")) {
      errors.push("Missing NextRequest/NextResponse imports");
    }
    if (!code.includes("import { drizzle }")) {
      errors.push("Missing drizzle import");
    }
    if (!code.includes(`import { ${tableName},`)) {
      errors.push(`Missing ${tableName} table import`);
    }

    // Check database setup
    if (!code.includes("const pool = new Pool({")) {
      errors.push("Missing database pool initialization");
    }
    if (!code.includes("const db = drizzle(pool);")) {
      errors.push("Missing database drizzle initialization");
    }

    // Check for proper pool closing
    const poolMatch = code.match(/const pool = new Pool\(\{[\s\S]*?\}\);/);
    if (!poolMatch) {
      errors.push("Database pool configuration not properly closed");
    }

    // Check for all HTTP methods
    const requiredMethods = ["GET", "POST", "PUT", "DELETE"];
    for (const method of requiredMethods) {
      if (
        !code.includes(`export async function ${method}(request: NextRequest)`)
      ) {
        errors.push(`Missing ${method} function declaration`);
      }
    }

    // Check for orphaned parameter validation
    const lines = code.split("\n");
    let insideFunction = false;
    let braceCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.includes("export async function")) {
        insideFunction = true;
        braceCount = 0;
      }

      if (insideFunction) {
        braceCount += (line.match(/{/g) || []).length;
        braceCount -= (line.match(/}/g) || []).length;

        if (braceCount === 0 && line.includes("}")) {
          insideFunction = false;
        }
      }

      // Check for parameter validation outside functions
      if (
        !insideFunction &&
        (line.includes("searchParams") || line.includes("request.json()"))
      ) {
        errors.push("Parameter validation code found outside function");
        break;
      }
    }

    // Check brace balance
    const openBraces = (code.match(/{/g) || []).length;
    const closeBraces = (code.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push(
        `Unbalanced braces: ${openBraces} opening, ${closeBraces} closing`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
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

    // Fix missing closing braces in Pool configuration
    fixedCode = fixedCode.replace(
      /ssl: process\.env\.DATABASE_URL\?\.includes\('neon\.tech'\) \? \{ rejectUnauthorized: false \} : false$/gm,
      `ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false\n});`
    );

    // Ensure database initialization is present
    if (!fixedCode.includes("const db = drizzle(pool);")) {
      fixedCode = fixedCode.replace(
        /const pool = new Pool\(\{[\s\S]*?\}\);/,
        "$&\nconst db = drizzle(pool);"
      );
    }

    // Fix orphaned parameter validation by ensuring it's inside a function
    const orphanedValidationRegex =
      /^(?:.*\n)*(\s*const \{ searchParams \}[\s\S]*?const id = searchParams\.get\('id'\);)\s*$/gm;
    if (orphanedValidationRegex.test(fixedCode)) {
      // Remove orphaned validation code
      fixedCode = fixedCode.replace(orphanedValidationRegex, "");
    }

    // Ensure all function declarations are complete
    if (!fixedCode.includes("export async function GET(")) {
      // If GET function is missing, regenerate using fallback
      throw new Error("GET function is missing in the generated code.");
    }

    // Fix incomplete function declarations
    fixedCode = fixedCode.replace(
      /export async function (GET|POST|PUT|DELETE)\s*\(/g,
      "export async function $1(request: NextRequest"
    );

    // Ensure all functions have proper closing braces
    fixedCode = this.ensureProperFunctionClosures(fixedCode);

    return fixedCode;
  }

  private ensureProperFunctionClosures(code: string): string {
    // Split by function declarations and ensure each has proper closure
    const functionRegex =
      /export async function (GET|POST|PUT|DELETE)\(request: NextRequest\)[^{]*{/g;
    const functions = code.split(functionRegex);

    if (functions.length < 2) {
      // If functions aren't properly split, use fallback
      return code;
    }

    let reconstructed = functions[0]; // Imports and setup
    let match;
    let index = 1;

    // Reset regex
    functionRegex.lastIndex = 0;

    while (
      (match = functionRegex.exec(code)) !== null &&
      index < functions.length
    ) {
      const methodName = match[1];
      let functionBody = functions[index];

      // Ensure proper brace balancing
      const openBraces = (functionBody.match(/{/g) || []).length;
      const closeBraces = (functionBody.match(/}/g) || []).length;
      const missingBraces = openBraces - closeBraces + 1; // +1 for the opening brace of the function

      reconstructed += `export async function ${methodName}(request: NextRequest) {`;
      reconstructed += functionBody;

      // Add missing closing braces
      for (let i = 0; i < missingBraces; i++) {
        reconstructed += "\n}";
      }

      index++;
    }

    return reconstructed;
  }
}
