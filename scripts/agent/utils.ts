import chalk from "chalk";

export function toPascalCase(str: string): string {
  return str
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

export const stepIcons: Record<string, string> = {
  thinking: "🤔",
  analyzing: "🔍",
  creating: "📄",
  editing: "✏️",
  migrating: "🔄",
  generating: "⚡",
  integrating: "🔗",
  seeding: "🌱",
  validating: "✅",
};

export function logStep(type: string, message: string) {
  const icon = stepIcons[type] || "•";
  console.log(chalk.cyan(`${icon} ${message}`));
}
