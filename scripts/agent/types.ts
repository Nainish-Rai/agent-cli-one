// Shared type definitions for the DB agent
export interface AgentStep {
  type:
    | "thinking"
    | "analyzing"
    | "creating"
    | "editing"
    | "migrating"
    | "generating"
    | "integrating"
    | "seeding"
    | "validating";
  message: string;
}

export interface SchemaField {
  name: string;
  type:
    | "serial"
    | "text"
    | "timestamp"
    | "integer"
    | "boolean"
    | "uuid"
    | string;
  constraints?: string[];
}

export interface SchemaDefinition {
  tableName: string;
  fileName: string;
  fields: SchemaField[];
  relationships?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
