import chalk from "chalk";
import { BaseAgent } from "./core/base-agent";
import { ProjectAnalyzer } from "./core/project-analyzer";
import { DatabaseWorkflow } from "./core/database-workflow";
import { SchemaValidator } from "./modules/schema-validator";
import { SchemaGenerator } from "./modules/schema-generator";
import { ApiGenerator } from "./modules/api-generator";
import { SeedGenerator } from "./modules/seed-generator";
import { FrontendIntegrator } from "./modules/frontend-integrator";
import { UIIntegrator } from "./modules/ui-integrator";
import { SchemaDefinition } from "./types";

export class DatabaseAgent extends BaseAgent {
  private projectAnalyzer = new ProjectAnalyzer();
  private databaseWorkflow = new DatabaseWorkflow();
  private schemaValidator = new SchemaValidator();
  private schemaGenerator = new SchemaGenerator();
  private apiGenerator = new ApiGenerator();
  private seedGenerator = new SeedGenerator();
  private frontendIntegrator = new FrontendIntegrator();
  private uiIntegrator = new UIIntegrator();

  async processQuery(query: string) {
    this.log({
      type: "thinking",
      message: "Starting agentic database workflow...",
    });

    if (!this.model) {
      // Fallback to legacy workflow if no API key
      console.log(
        chalk.yellow("🤖 Using legacy workflow (no API key detected)")
      );
      return this.processQueryLegacy(query);
    }

    try {
      // Use the agentic workflow with tool calling and feedback loops
      console.log(chalk.blue("🧠 Initializing agentic AI agent..."));
      console.log(
        chalk.gray(
          "   This agent will use tools to understand your project and implement features"
        )
      );
      console.log();

      const enhancedQuery = `${query}

Project Context: This is a Next.js project with TypeScript and Drizzle ORM. The project structure includes:
- Frontend: Spotify clone with components in src/components/
- Database: Drizzle ORM with schema in src/db/schema/
- API Routes: Next.js API routes in src/app/api/

Please analyze the project structure first, then implement the requested database features including:
1. Database schemas with migrations
2. API routes for CRUD operations
3. Frontend integration with React hooks
4. UI updates to display the data

Be thorough and methodical in your approach.`;

      const result = await this.executeAgenticWorkflow(enhancedQuery, true);

      console.log(chalk.green("\n✅ Agentic workflow completed!"));
      console.log(
        chalk.cyan(
          "🤖 AI agent has finished implementing your database features"
        )
      );
      console.log(
        chalk.gray(`📝 Final result: ${result.substring(0, 150)}...`)
      );
    } catch (error: any) {
      console.log(chalk.red(`❌ Agentic workflow failed: ${error.message}`));
      console.log(chalk.yellow("🔄 Falling back to legacy workflow..."));
      return this.processQueryLegacy(query);
    }
  }

  // Legacy workflow for fallback
  private async processQueryLegacy(query: string) {
    this.log({ type: "thinking", message: "Processing your request..." });

    // Initialize all modules with the Gemini model
    this.initializeModulesWithModel();

    this.startSpinner("Analyzing project structure...");
    await this.projectAnalyzer.getProjectContext();
    this.stopSpinner(true, "Project analysis complete");

    this.log({
      type: "analyzing",
      message: "Understanding your requirements using Gemini AI...",
    });
    const schemaDefinitions = await this.schemaGenerator.parseQueryForSchemas(
      query,
      this.model
    );

    if (schemaDefinitions.length === 0) {
      console.log(
        chalk.yellow(
          "⚠️  No database schema requirements detected in your query."
        )
      );
      console.log(
        chalk.gray(
          "   Try queries like: 'store recently played songs' or 'create user profiles table'"
        )
      );
      return;
    }

    console.log(chalk.green("\n📋 Implementation Plan:"));
    console.log(
      chalk.blue(
        `Creating ${schemaDefinitions.length} database table(s) with migrations and API integration`
      )
    );
    console.log();

    // Validate schemas
    const schemasValid = await this.databaseWorkflow.validateSchemas(
      schemaDefinitions,
      this.schemaValidator
    );
    if (!schemasValid) return;

    // Implement schemas using Gemini-generated code
    for (const schemaDef of schemaDefinitions) {
      await this.databaseWorkflow.implementSchema(
        schemaDef,
        this.schemaGenerator
      );
    }
    await this.databaseWorkflow.updateSchemaIndex(
      schemaDefinitions,
      this.schemaGenerator
    );

    // Validate generated schemas
    const generatedSchemasValid =
      await this.databaseWorkflow.validateGeneratedSchemas(
        schemaDefinitions,
        this.schemaValidator
      );
    if (!generatedSchemasValid) return;

    // Run migrations
    await this.databaseWorkflow.runMigrations();

    // Generate API routes using Gemini
    this.log({
      type: "creating",
      message: "Generating API routes with Gemini AI...",
    });
    for (const schemaDef of schemaDefinitions) {
      await this.apiGenerator.generateApiRoute(schemaDef);
    }

    // Generate seed data using Gemini
    this.log({
      type: "creating",
      message: "Generating realistic seed data with Gemini AI...",
    });
    for (const schemaDef of schemaDefinitions) {
      await this.seedGenerator.generateSeedData(schemaDef);
    }

    // Generate frontend integration using Gemini
    await this.generateFrontendIntegration(schemaDefinitions, query);

    console.log(chalk.green("\n✅ Database implementation complete!"));
    console.log(
      chalk.cyan(
        "🚀 Your new database tables are ready with API endpoints and sample data."
      )
    );
    console.log(
      chalk.cyan(
        "🤖 All code was generated using Gemini AI for maximum relevance and quality."
      )
    );
  }

  private initializeModulesWithModel() {
    // Pass the Gemini model to all modules that need it
    this.schemaGenerator.setModel(this.model);
    this.apiGenerator.setModel(this.model);
    this.seedGenerator.setModel(this.model);
    this.frontendIntegrator.setModel(this.model);
    this.uiIntegrator.setModel(this.model);

    this.log({
      type: "thinking",
      message:
        "Initialized all modules with Gemini AI model for dynamic code generation",
    });
  }

  private async generateFrontendIntegration(
    schemaDefinitions: SchemaDefinition[],
    query: string
  ) {
    this.log({
      type: "integrating",
      message: "Generating frontend integration with Gemini AI...",
    });

    // Generate React hooks and display API info using Gemini
    await this.frontendIntegrator.generateFrontendIntegration(
      schemaDefinitions,
      query
    );

    // Integrate into Spotify components using Gemini
    await this.integrateIntoSpotifyComponents(schemaDefinitions, query);
  }

  private async integrateIntoSpotifyComponents(
    schemaDefinitions: SchemaDefinition[],
    query: string
  ) {
    this.log({
      type: "integrating",
      message:
        "Integrating database hooks into Spotify components with Gemini AI...",
    });

    // Analyze query to determine which UI sections to update
    const queryAnalysis = this.uiIntegrator.analyzeQueryForUIIntegration(
      query,
      schemaDefinitions
    );

    if (queryAnalysis.shouldUpdateMainContent) {
      await this.uiIntegrator.updateSpotifyMainContent(
        schemaDefinitions,
        queryAnalysis
      );
      console.log(
        chalk.cyan("   🎵 Updated SpotifyMainContent to use database data")
      );
    }

    if (queryAnalysis.shouldUpdateSidebar) {
      await this.uiIntegrator.updateSpotifySidebar(
        schemaDefinitions,
        queryAnalysis
      );
      console.log(
        chalk.cyan("   📱 Updated SpotifySidebar to use database data")
      );
    }

    console.log(chalk.cyan("   📦 Updated hooks index"));
  }
}
