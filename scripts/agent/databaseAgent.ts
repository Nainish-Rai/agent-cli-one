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
    this.log({ type: "thinking", message: "Processing your request..." });
    this.startSpinner("Analyzing project structure...");
    await this.projectAnalyzer.getProjectContext();
    this.stopSpinner(true, "Project analysis complete");

    this.log({
      type: "analyzing",
      message: "Understanding your requirements...",
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

    // Implement schemas
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

    // Generate API routes
    for (const schemaDef of schemaDefinitions) {
      await this.apiGenerator.generateApiRoute(schemaDef);
    }

    // Generate seed data
    for (const schemaDef of schemaDefinitions) {
      await this.seedGenerator.generateSeedData(schemaDef);
    }

    // Generate frontend integration
    await this.generateFrontendIntegration(schemaDefinitions, query);

    console.log(chalk.green("\n✅ Database implementation complete!"));
    console.log(
      chalk.cyan(
        "🚀 Your new database tables are ready with API endpoints and sample data."
      )
    );
  }

  private async generateFrontendIntegration(
    schemaDefinitions: SchemaDefinition[],
    query: string
  ) {
    this.log({
      type: "integrating",
      message: "Generating frontend integration suggestions",
    });

    // Generate React hooks and display API info
    await this.frontendIntegrator.generateFrontendIntegration(
      schemaDefinitions,
      query
    );

    // Integrate into Spotify components
    await this.integrateIntoSpotifyComponents(schemaDefinitions, query);
  }

  private async integrateIntoSpotifyComponents(
    schemaDefinitions: SchemaDefinition[],
    query: string
  ) {
    this.log({
      type: "integrating",
      message: "Integrating database hooks into Spotify components",
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
