/**
 * dbml-pg - Enhanced DBML parser with full PostgreSQL support
 * 
 * @module
 */

export { Parser, ParseError, defaultParser } from "./src/parser.ts";
export type { ParserOptions, ParserContext } from "./src/parser.ts";
export type {
  Schema,
  Table,
  Column,
  Index,
  Ref,
  Enum,
  EnumValue,
  TableGroup,
  Project,
  DefaultValue,
  InlineRef,
  IndexColumn,
  RefType,
  RefAction,
  RefEndpoint,
  TablePartial,
  TableElement,
  PartialReference,
  Constraint,
  Token,
  TokenType,
  Position,
} from "./src/types.ts";