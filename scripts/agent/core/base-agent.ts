import { GoogleGenerativeAI } from "@google/generative-ai";
import chalk from "chalk";
import ora from "ora";
import { AgentStep } from "../types";
import { logStep } from "../utils";

export abstract class BaseAgent {
  protected genAI: GoogleGenerativeAI | null;
  protected model: any;
  protected spinner: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log(
        chalk.yellow("⚠️  No GEMINI_API_KEY found - running in demo mode")
      );
      console.log(
        chalk.gray(
          "   Add your API key to .env for full AI-powered functionality\n"
        )
      );
    }
    this.genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
    this.model =
      apiKey && this.genAI
        ? this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
        : null;
  }

  protected log(step: AgentStep) {
    logStep(step.type, step.message);
  }

  protected startSpinner(message: string) {
    this.spinner = ora(chalk.yellow(message)).start();
  }

  protected stopSpinner(success: boolean = true, message?: string) {
    if (this.spinner) {
      success
        ? this.spinner.succeed(chalk.green(message || "Done"))
        : this.spinner.fail(chalk.red(message || "Failed"));
    }
  }
}
