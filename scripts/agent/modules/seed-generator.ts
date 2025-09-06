import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import { SchemaDefinition } from "../types";
import { toPascalCase } from "../utils";

export class SeedGenerator {
  async generateSeedData(schemaDef: SchemaDefinition) {
    const seedContent = this.generateSeedContent(schemaDef);
    const seedPath = path.join(
      process.cwd(),
      "scripts",
      `seed-${schemaDef.tableName}.ts`
    );
    fs.mkdirSync(path.dirname(seedPath), { recursive: true });
    fs.writeFileSync(seedPath, seedContent);
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

  private generateSeedContent(schemaDef: SchemaDefinition): string {
    const tableName = schemaDef.tableName;
    const className = toPascalCase(tableName);
    const sampleDataGenerator = this.generateSampleDataForSchema(schemaDef);

    return `import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import dotenv from "dotenv";
import { ${tableName}, type New${className} } from "../src/db/schema/${schemaDef.fileName.replace(
      ".ts",
      ""
    )}";

dotenv.config();

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/spotify_clone'
  });
  const db = drizzle(pool);

  const sampleData: New${className}[] = ${sampleDataGenerator};

  try {
    console.log('🌱 Seeding ${tableName} with sample data...');

    const insertedRecords = await db.insert(${tableName}).values(sampleData).returning();

    console.log(\`✅ Successfully seeded \${insertedRecords.length} records to ${tableName}\`);
    console.log('Sample records:', insertedRecords.slice(0, 3));

  } catch (error) {
    console.error('❌ Error seeding ${tableName}:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed().catch(console.error);
`;
  }

  private generateSampleDataForSchema(schemaDef: SchemaDefinition): string {
    const { fields } = schemaDef;
    const sampleCount = 5;
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
      user_id: [
        `user_${index + 1}`,
        `spotify_user_${index + 1}`,
        `test_user_${index + 1}`,
      ],
      song_id: [
        `song_${index + 1}`,
        `track_${Math.random().toString(36).substr(2, 8)}`,
      ],
      song_title: [
        "Bohemian Rhapsody",
        "Hotel California",
        "Stairway to Heaven",
        "Imagine",
        "Sweet Child O Mine",
      ],
      artist: [
        "Queen",
        "Eagles",
        "Led Zeppelin",
        "John Lennon",
        "Guns N' Roses",
      ],
      album: [
        "A Night at the Opera",
        "Hotel California",
        "Led Zeppelin IV",
        "Imagine",
        "Appetite for Destruction",
      ],
      name: [`Sample Name ${index + 1}`, `Test Item ${index + 1}`],
      title: [`Sample Title ${index + 1}`, `Test Title ${index + 1}`],
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
    const ranges = {
      duration_seconds: () => Math.floor(Math.random() * 300) + 60,
      play_count: () => Math.floor(Math.random() * 1000),
      rating: () => Math.floor(Math.random() * 5) + 1,
      age: () => Math.floor(Math.random() * 50) + 18,
      price: () => Math.floor(Math.random() * 10000) + 100,
      quantity: () => Math.floor(Math.random() * 100) + 1,
    };

    if (ranges[fieldName as keyof typeof ranges]) {
      return ranges[fieldName as keyof typeof ranges]();
    }

    return Math.floor(Math.random() * 100) + 1;
  }
}
