/**
 * DBML-PG Parser using Ohm
 * Clean, maintainable parser with PostgreSQL extensions
 */

import * as ohm from "ohm-js";
import { createSemantics } from "./semantics.ts";
import type { Schema } from "./types.ts";

// Read the grammar file
const grammarSource = await Deno.readTextFile(
  new URL("./dbml.ohm", import.meta.url)
);

// Create the grammar
const grammar = ohm.grammar(grammarSource);

// Create semantics
const semantics = createSemantics(grammar);

export interface ParserOptions {
  /**
   * Custom type mappings (e.g., { "kinstant": "timestamp with time zone" })
   */
  typeMappings?: Record<string, string>;

  /**
   * If true, only allow standard DBML syntax (no PostgreSQL extensions)
   */
  strict?: boolean;

  /**
   * Start rule for parsing (default: "Schema")
   */
  startRule?: string;
}

export interface ParserContext {
  typeMappings: Record<string, string>;
}

export class Parser {
  private typeMappings: Record<string, string>;
  private strict: boolean;

  constructor(options: ParserOptions = {}) {
    this.typeMappings = {
      // Default type mappings
      "kinstant": "timestamp with time zone",
      "kjson": "jsonb",
      ...options.typeMappings,
    };
    this.strict = options.strict || false;
  }

  /**
   * Parse DBML string
   */
  parse(dbml: string, options?: { startRule?: string }): Schema {
    const match = grammar.match(dbml, options?.startRule);
    
    if (!match.succeeded()) {
      throw new ParseError(match);
    }

    // Apply semantics to get AST
    const ast = semantics(match).toAST();

    // Apply type mappings
    if (ast.tables) {
      for (const table of ast.tables) {
        for (const column of table.columns) {
          // Map dataType to type for the final output
          column.type = this.mapType(column.dataType || column.type);
          delete column.dataType;
        }
      }
    }

    return ast;
  }


  /**
   * Validate DBML syntax without building AST
   */
  validate(dbml: string): { valid: boolean; error?: string } {
    const match = grammar.match(dbml);
    
    if (match.succeeded()) {
      return { valid: true };
    } else {
      return {
        valid: false,
        error: match.message,
      };
    }
  }

  /**
   * Map custom types to PostgreSQL types
   */
  private mapType(type: string): string {
    return this.typeMappings[type] || type;
  }

  /**
   * Get the grammar (for testing/debugging)
   */
  getGrammar(): any {
    return grammar;
  }

  /**
   * Get the semantics (for extending)
   */
  getSemantics(): any {
    return semantics;
  }
}

/**
 * Parse error with detailed information
 */
export class ParseError extends Error {
  public readonly match: any;
  public readonly line: number;
  public readonly column: number;
  public readonly expected: string[];

  constructor(match: any) {
    const message = match.message || "Parse error";
    super(message);
    
    this.name = "ParseError";
    this.match = match;
    
    // Extract line and column from the match
    const interval = match.getInterval();
    const source = match.input;
    const lines = source.slice(0, interval.startIdx).split("\n");
    
    this.line = lines.length;
    this.column = lines[lines.length - 1].length + 1;
    
    // Extract expected tokens
    this.expected = [];
    if (match.expected) {
      this.expected = match.expected;
    }
  }

  /**
   * Get a formatted error message with context
   */
  getFormattedMessage(): string {
    const lines = this.match.input.split("\n");
    const errorLine = lines[this.line - 1];
    const pointer = " ".repeat(this.column - 1) + "^";
    
    return `${this.message}

Line ${this.line}, column ${this.column}:
${errorLine}
${pointer}`;
  }
}

// Export a default parser instance
export const defaultParser: Parser = new Parser();