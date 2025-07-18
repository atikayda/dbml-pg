/**
 * AST node types for the DBML parser
 * These types represent the intermediate AST before final transformation
 */

import type {
  Index,
  Constraint,
  DefaultValue,
  InlineRef,
} from "./types.ts";

// Base type for all AST nodes
export interface ASTNode {
  type: string;
}

// Column in the AST (before mapping to Column interface)
export interface ColumnAST extends ASTNode {
  type: "column";
  name: string;
  dataType: string;
  pk?: boolean;
  unique?: boolean;
  notNull?: boolean;
  increment?: boolean;
  identityGeneration?: "always" | "by default";
  generatedExpression?: string;
  generatedStored?: boolean;
  default?: string | number | boolean | DefaultValue;
  note?: string;
  ref?: InlineRef;
  check?: string;
}

// Index block AST
export interface IndexesAST extends ASTNode {
  type: "indexes";
  indexes: Index[];
}

// Constraints block AST
export interface ConstraintsAST extends ASTNode {
  type: "constraints";
  constraints: Constraint[];
}

// Note AST
export interface NoteAST extends ASTNode {
  type: "note";
  value: string;
}

// Header color AST  
export interface HeaderColorAST extends ASTNode {
  type: "headerColor";
  value: string;
}

// Partial reference AST
export interface PartialReferenceAST extends ASTNode {
  type: "partialReference";
  name: string;
}

// Union of all possible table body elements
export type TableBodyElement = ColumnAST | IndexesAST | ConstraintsAST | NoteAST | HeaderColorAST | PartialReferenceAST;