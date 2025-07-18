/**
 * Type definitions for dbml-pg
 */

export interface Schema {
  name: string;
  tables: Table[];
  refs: Ref[];
  enums: Enum[];
  tableGroups: TableGroup[];
  project?: Project;
  partials?: TablePartial[];
}

export interface Project {
  name: string;
  databaseType?: string;
  note?: string;
  [key: string]: unknown; // Allow additional properties
}

export interface Table {
  name: string;
  alias?: string;
  columns: Column[];
  indexes: Index[];
  constraints?: Constraint[];
  note?: string;
  headerColor?: string;
  schema?: string;
  elements?: TableElement[]; // Ordered array of columns and partial refs
}

export interface Constraint {
  name?: string;
  type: "check" | "unique" | "exclude" | "foreign_key" | "primary_key";
  expression?: string;
  columns?: string[];
  deferrable?: boolean;
  initiallyDeferred?: boolean;
  using?: string; // For EXCLUDE constraints
  withOperator?: string; // For EXCLUDE constraints
}

export interface Column {
  name: string;
  type: string;
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

export interface DefaultValue {
  type: "string" | "number" | "boolean" | "expression" | "function";
  value: string;
}

export interface Index {
  columns: IndexColumn[];
  type?: "btree" | "hash" | "gin" | "gist" | "spgist" | "brin" | string;
  unique?: boolean;
  pk?: boolean;
  name?: string;
  where?: string;
  note?: string;
  using?: string; // For custom operator classes
}

export interface IndexColumn {
  name: string;
  sort?: "asc" | "desc";
  nulls?: "first" | "last";
  opclass?: string;
}

export interface Ref {
  name?: string;
  from: RefEndpoint;
  to: RefEndpoint;
  refType: RefType;
  onUpdate?: RefAction;
  onDelete?: RefAction;
}

export interface RefEndpoint {
  table: string;
  column?: string;
  columns?: string[];
  schema?: string;
}

export type RefType = ">" | "<" | "-" | "<>";
export type RefAction = "cascade" | "restrict" | "set null" | "set default" | "no action";

export interface Enum {
  name: string;
  values: EnumValue[];
  note?: string;
  schema?: string;
}

export interface EnumValue {
  name: string;
  note?: string;
}

export interface TableGroup {
  name: string;
  tables: string[];
}

export interface TablePartial {
  name: string;
  columns: Column[];
  indexes: Index[];
  constraints?: Constraint[];
  note?: string;
}

export interface PartialReference {
  name: string;
}

export type TableElement = 
  | { type: "column"; column: Column }
  | { type: "partialRef"; ref: PartialReference };

export interface InlineRef {
  type: RefType;
  to: RefEndpoint;
}

// Lexer types
export interface Token {
  type: TokenType;
  value: string;
  position: Position;
}

export interface Position {
  line: number;
  column: number;
  offset: number;
}

export type TokenType =
  | "KEYWORD"
  | "IDENTIFIER"
  | "STRING"
  | "NUMBER"
  | "EXPRESSION"
  | "OPERATOR"
  | "PUNCTUATION"
  | "COMMENT"
  | "WHITESPACE"
  | "EOF";