import * as fs from "fs";
import * as path from "path";

export class ProjectAnalyzer {
  async getProjectContext(): Promise<string> {
    const context: string[] = [];
    const push = (label: string, items: string[]) =>
      items.length && context.push(`${label}: ${items.join(", ")}`);

    try {
      const schemaDir = path.join(process.cwd(), "src", "db", "schema");
      if (fs.existsSync(schemaDir))
        push(
          "Existing schemas",
          fs
            .readdirSync(schemaDir)
            .filter((f) => f.endsWith(".ts") && f !== "index.ts")
        );
    } catch {}

    try {
      const apiDir = path.join(process.cwd(), "src", "app", "api");
      if (fs.existsSync(apiDir)) {
        push(
          "Existing API routes",
          fs
            .readdirSync(apiDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name)
        );
      }
    } catch {}

    try {
      const componentsDir = path.join(process.cwd(), "src", "components");
      if (fs.existsSync(componentsDir)) {
        push(
          "Main components",
          fs
            .readdirSync(componentsDir)
            .filter((f) => f.endsWith(".tsx"))
            .map((f) => f.replace(".tsx", ""))
        );
      }
    } catch {}

    return context.join("\n");
  }
}
