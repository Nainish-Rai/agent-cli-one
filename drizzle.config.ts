import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  schema: "./src/db/schema", // Updated to point to the schema directory
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL || "postgresql://localhost:5432/spotify_clone",
  },
  verbose: true,
  strict: true,
});
