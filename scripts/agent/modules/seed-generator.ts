import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import { SchemaDefinition } from "../types";
import { toPascalCase } from "../utils";

export class SeedGenerator {
  private model: any;

  constructor(model?: any) {
    this.model = model;
  }

  setModel(model: any) {
    this.model = model;
  }

  async generateSeedData(schemaDef: SchemaDefinition) {
    if (!this.model) {
      console.log(chalk.yellow("⚠️  No model set, using fallback seed data"));
      const seedContent = this.generateSeedContentFallback(schemaDef);
      await this.writeSeedFile(schemaDef, seedContent);
      return;
    }

    const seedContent = await this.generateSeedContent(schemaDef);
    await this.writeSeedFile(schemaDef, seedContent);
  }

  private async writeSeedFile(schemaDef: SchemaDefinition, content: string) {
    const seedPath = path.join(
      process.cwd(),
      "scripts",
      `seed-${schemaDef.tableName}.ts`
    );
    fs.mkdirSync(path.dirname(seedPath), { recursive: true });
    fs.writeFileSync(seedPath, content);
    console.log(chalk.gray(`   📁 Created: seed-${schemaDef.tableName}.ts`));

    try {
      execSync(`npx tsx scripts/seed-${schemaDef.tableName}.ts`, {
        stdio: "pipe",
        cwd: process.cwd(),
      });
      console.log(
        chalk.green(`   ✅ ${schemaDef.tableName} seeded successfully`)
      );
    } catch {
      console.log(chalk.red(`   ❌ Seeding failed for ${schemaDef.tableName}`));
    }
  }

  private async generateSeedContent(
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

    const seedPrompt = `Generate a TypeScript seed file for a database table with realistic sample data.

Table Information:
- Table name: ${tableName}
- Class name: ${className}
- File name: ${schemaDef.fileName}
- Fields to populate: ${JSON.stringify(fieldsInfo, null, 2)}

Context: This is for a Spotify clone application, so generate music-related data if the table seems music-related.

Requirements:
1. Generate 10-15 realistic sample records
2. Use proper TypeScript types
3. Import from the correct schema file path
4. Include proper database connection setup
5. Handle errors appropriately
6. Generate contextually appropriate data based on field names
7. Don't include id, created_at, updated_at in sample data (auto-generated)
8. Use async/await properly
9. Handle SSL connections for cloud databases
10. NO COMMENTS in the generated code

Common field patterns and appropriate data:
- song_title, track_title, title: Real song titles
- artist_name, artist: Real artist names
- album_name, album: Real album names
- duration_seconds: Realistic song durations (120-300 seconds)
- genre: Music genres
- user_id: UUID format or user identifiers
- recently_played, last_played: Recent timestamps

Database setup:
\`\`\`typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/spotify_clone',
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});
const db = drizzle(pool);
\`\`\`

Generate a complete TypeScript seed file with:
- Proper imports
- Database connection
- Sample data array
- Insert operation
- Error handling
- Cleanup

Note: Import schema from "@/db/schema";
Example: " import { dislikedSongs } from "@/db/schema"; "

Generate ONLY the TypeScript code, no explanation or markdown formatting. Do not include any comments in the code.`;

    try {
      const result = await this.model.generateContent(seedPrompt);
      let generatedCode = result.response.text().trim();

      generatedCode = generatedCode
        .replace(/```typescript\n?/g, "")
        .replace(/```\n?/g, "")
        .replace(/\/\/[^\n]*\n/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");

      return generatedCode;
    } catch (error) {
      console.log(chalk.red(`❌ Error generating seed content: ${error}`));
      return this.generateSeedContentFallback(schemaDef);
    }
  }

  private generateSeedContentFallback(schemaDef: SchemaDefinition): string {
    const tableName = schemaDef.tableName;
    const className = toPascalCase(tableName);
    const sampleDataGenerator =
      this.generateSampleDataForSchemaFallback(schemaDef);

    return `import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import dotenv from "dotenv";
import { ${tableName}, type New${className} } from "@/db/schema";

dotenv.config();

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.log('Please ensure your .env file contains a valid DATABASE_URL');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : false
  });

  const db = drizzle(pool);

  const sampleData: New${className}[] = ${sampleDataGenerator};

  try {
    console.log('🌱 Seeding ${tableName} with sample data...');

    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');

    const insertedRecords = await db.insert(${tableName}).values(sampleData).returning();

    console.log(\`✅ Successfully seeded \${insertedRecords.length} records to ${tableName}\`);
    console.log('Sample records:', insertedRecords.slice(0, 3));

  } catch (error) {
    console.error('❌ Error seeding ${tableName}:', error);

    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Database connection failed. Please check:');
      console.log('  - Your DATABASE_URL in .env file');
      console.log('  - Database server is running');
      console.log('  - Network connectivity');
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed().catch(console.error);
`;
  }

  private generateSampleDataForSchemaFallback(
    schemaDef: SchemaDefinition
  ): string {
    const { fields } = schemaDef;
    const sampleCount = 12;
    const samples: any[] = [];

    for (let i = 0; i < sampleCount; i++) {
      const record: any = {};

      fields.forEach((field) => {
        if (["id", "created_at", "updated_at"].includes(field.name)) {
          return;
        }

        switch (field.type) {
          case "text":
            record[field.name] = this.generateSampleText(field.name, i);
            break;
          case "integer":
            record[field.name] = this.generateSampleInteger(field.name, i);
            break;
          case "boolean":
            record[field.name] = Math.random() > 0.5;
            break;
          case "uuid":
            record[field.name] = `${Math.random()
              .toString(36)
              .substr(2, 8)}-${Math.random()
              .toString(36)
              .substr(2, 4)}-${Math.random()
              .toString(36)
              .substr(2, 4)}-${Math.random()
              .toString(36)
              .substr(2, 4)}-${Math.random().toString(36).substr(2, 12)}`;
            break;
          case "timestamp":
            if (
              field.name.includes("played_at") ||
              field.name.includes("timestamp")
            ) {
              record[field.name] = new Date(
                Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
              );
            }
            break;
        }
      });

      samples.push(record);
    }

    return JSON.stringify(samples, null, 2);
  }

  private generateSampleText(fieldName: string, index: number): string {
    const samples = {
      song_title: [
        "Blinding Lights",
        "Watermelon Sugar",
        "Levitating",
        "Good 4 U",
        "Stay",
        "Industry Baby",
        "Heat Waves",
        "Peaches",
        "Save Your Tears",
        "Drivers License",
        "Positions",
        "Mood",
      ],
      track_title: [
        "Blinding Lights",
        "Watermelon Sugar",
        "Levitating",
        "Good 4 U",
        "Stay",
        "Industry Baby",
        "Heat Waves",
        "Peaches",
        "Save Your Tears",
        "Drivers License",
        "Positions",
        "Mood",
      ],
      title: [
        "Blinding Lights",
        "Watermelon Sugar",
        "Levitating",
        "Good 4 U",
        "Stay",
        "Industry Baby",
        "Heat Waves",
        "Peaches",
        "Save Your Tears",
        "Drivers License",
        "Positions",
        "Mood",
      ],
      artist_name: [
        "The Weeknd",
        "Harry Styles",
        "Dua Lipa",
        "Olivia Rodrigo",
        "The Kid LAROI",
        "Lil Nas X",
        "Glass Animals",
        "Justin Bieber",
        "Ariana Grande",
        "BTS",
        "Taylor Swift",
        "Drake",
      ],
      artist: [
        "The Weeknd",
        "Harry Styles",
        "Dua Lipa",
        "Olivia Rodrigo",
        "The Kid LAROI",
        "Lil Nas X",
        "Glass Animals",
        "Justin Bieber",
        "Ariana Grande",
        "BTS",
        "Taylor Swift",
        "Drake",
      ],
      album_name: [
        "After Hours",
        "Fine Line",
        "Future Nostalgia",
        "SOUR",
        "F*CK LOVE 3",
        "MONTERO",
        "Dreamland",
        "Justice",
        "Positions",
        "BE",
        "evermore",
        "Certified Lover Boy",
      ],
      album: [
        "After Hours",
        "Fine Line",
        "Future Nostalgia",
        "SOUR",
        "F*CK LOVE 3",
        "MONTERO",
        "Dreamland",
        "Justice",
        "Positions",
        "BE",
        "evermore",
        "Certified Lover Boy",
      ],
      genre: [
        "Pop",
        "Rock",
        "Hip Hop",
        "R&B",
        "Electronic",
        "Indie",
        "Country",
        "Jazz",
        "Classical",
        "Alternative",
        "Reggae",
        "Blues",
      ],
      name: [`Sample Name ${index + 1}`, `Test Item ${index + 1}`],
      description: [
        `Sample description for item ${index + 1}`,
        `Test description ${index + 1}`,
      ],
      email: [`user${index + 1}@example.com`, `test${index + 1}@domain.com`],
      status: ["active", "inactive", "pending", "completed"],
      category: ["music", "entertainment", "lifestyle", "technology"],
    };

    if (samples[fieldName as keyof typeof samples]) {
      const options = samples[fieldName as keyof typeof samples];
      return options[index % options.length];
    }

    return `sample_${fieldName}_${index + 1}`;
  }

  private generateSampleInteger(fieldName: string, index: number): number {
    if (fieldName.includes("duration")) {
      return Math.floor(Math.random() * 180) + 120;
    }
    if (fieldName.includes("count") || fieldName.includes("plays")) {
      return Math.floor(Math.random() * 10000) + 1;
    }
    if (fieldName.includes("year")) {
      return 2020 + (index % 4);
    }
    return Math.floor(Math.random() * 100) + 1;
  }
}
