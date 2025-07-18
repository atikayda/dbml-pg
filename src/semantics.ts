/**
 * Semantic actions for DBML Ohm grammar
 * Transforms parse tree into AST
 */

import type {
  Schema,
  Project,
  Table,
  Column,
  Index,
  IndexColumn,
  Ref,
  RefType,
  RefAction,
  Enum,
  EnumValue,
  TableGroup,
  DefaultValue,
  InlineRef,
  TablePartial,
  Constraint,
  RefEndpoint,
} from "./types.ts";

import type {
  ColumnAST,
  TableBodyElement,
  IndexesAST,
  ConstraintsAST,
  NoteAST,
  HeaderColorAST,
  PartialReferenceAST,
} from "./ast-types.ts";

// Ohm node types
interface OhmNode {
  toAST(): any;
  sourceString: string;
  children: OhmNode[];
  asIteration(): OhmIterationNode;
}

interface OhmIterationNode {
  children: OhmNode[];
}

export function createSemantics(grammar: any) {
  const semantics = grammar.createSemantics();

  // Main AST transformation operation
  semantics.addOperation("toAST", {
    // ===== Top Level =====
    Schema(elements: OhmNode) {
      const schema: Schema = {
        name: "database",
        tables: [],
        refs: [],
        enums: [],
        tableGroups: [],
        project: undefined,
        partials: [],
      };

      for (const element of elements.children) {
        const ast = element.toAST();
        if (typeof ast === 'object' && ast !== null && 'type' in ast) {
          switch (ast.type) {
            case "project":
              schema.project = ast as unknown as Project;
              schema.name = (ast as { name: string }).name;
              break;
            case "table":
              schema.tables.push(ast as unknown as Table);
              break;
            case "tablePartial":
              if (!schema.partials) {
                schema.partials = [];
              }
              schema.partials.push(ast as unknown as TablePartial);
              break;
            case "ref":
              schema.refs.push(ast as unknown as Ref);
              break;
            case "enum":
              schema.enums.push(ast as unknown as Enum);
              break;
            case "tableGroup":
              schema.tableGroups.push(ast as unknown as TableGroup);
              break;
          }
        }
      }

      return schema;
    },

    // ===== Project =====
    Project(_project: OhmNode, name: OhmNode, _open: OhmNode, body: OhmNode, _close: OhmNode) {
      const props = body.toAST() as Record<string, unknown>;
      return {
        type: "project",
        name: name.toAST() as string,
        ...props,
      } as Project & { type: string };
    },

    ProjectBody(properties: OhmNode) {
      const props: Record<string, unknown> = {};
      for (const prop of properties.children) {
        const { key, value } = prop.toAST() as { key: string; value: unknown };
        props[key] = value;
      }
      return props;
    },

    ProjectProperty(key: OhmNode, _colon: OhmNode, value: OhmNode) {
      return {
        key: key.toAST(),
        value: value.toAST(),
      };
    },

    // ===== Table =====
    Table(_table: OhmNode, name: OhmNode, alias: OhmNode, _open: OhmNode, body: OhmNode, _close: OhmNode) {
      const nameInfo = name.toAST();
      const result: Table & { type: string } = {
        type: "table",
        name: typeof nameInfo === 'string' ? nameInfo : (nameInfo as { name: string }).name,
        columns: [],
        indexes: [],
        elements: [],
      };

      if (typeof nameInfo === 'object' && 'schema' in nameInfo) {
        result.schema = (nameInfo as { schema: string }).schema;
      }

      if (alias.children.length > 0) {
        result.alias = alias.toAST()[0] as string;
      }

      const bodyElements = body.toAST() as Partial<TableBodyElement>[];
      
      for (const element of bodyElements) {
        if (!element) {
          continue;
        }
        switch (element.type) {
          case "column": {
            const { type: _, dataType, ...columnProps } = element;
            const col: Column = {
              name: element.name ?? "",
              type: dataType ?? "",
              ...columnProps,
            };
            result.columns.push(col);
            result.elements!.push({ type: "column", column: col });
            break;
          }
          case "indexes":
            result.indexes = element.indexes ?? [];
            break;
          case "constraints":
            result.constraints = element.constraints;
            break;
          case "note":
            result.note = element.value;
            break;
          case "headerColor":
            result.headerColor = element.value;
            break;
          case "partialReference":
            result.elements!.push({ type: "partialRef", ref: { name: element.name ?? "" } });
            break;
        }
      }

      return result;
    },

    QualifiedIdentifier_qualified(schema: OhmNode, _dot: OhmNode, name: OhmNode) {
      return {
        schema: schema.toAST(),
        name: name.toAST(),
      };
    },

    QualifiedIdentifier_simple(name: OhmNode) {
      return name.toAST();
    },

    TableAlias(_as: OhmNode, name: OhmNode) {
      return name.toAST();
    },

    TableBody(elements: OhmNode) {
      return elements.children.map((e) => e.toAST());
    },

    // ===== TablePartial =====
    TablePartial(_tablepartial: OhmNode, name: OhmNode, _open: OhmNode, body: OhmNode, _close: OhmNode) {
      const result: TablePartial & { type: string } = {
        type: "tablePartial",
        name: name.toAST() as string,
        columns: [],
        indexes: [],
      };

      const elements = body.toAST() as Partial<TableBodyElement>[];
      for (const element of elements) {
        switch (element.type) {
          case "column": {
            const { type: _type, dataType: dt, ...colProps } = element;
            const col: Column = {
              name: element.name ?? "",
              type: dt ?? "",
              ...colProps,
            };
            result.columns.push(col);
            break;
          }
          case "indexes":
            result.indexes = element.indexes ?? [];
            break;
          case "constraints":
            result.constraints = element.constraints;
            break;
          case "note":
            result.note = element.value;
            break;
        }
      }

      return result;
    },

    TablePartialBody(elements: OhmNode) {
      return elements.children.map((e) => e.toAST());
    },

    PartialReference(_tilde: OhmNode, name: OhmNode) {
      const result: PartialReferenceAST = {
        type: "partialReference",
        name: name.toAST() as string,
      };
      return result;
    },

    // ===== Column =====
    Column(name: OhmNode, dataType: OhmNode, settings: OhmNode) {
      const result: ColumnAST = {
        type: "column",
        name: name.toAST() as string,
        dataType: dataType.toAST() as string,
      };

      if (settings.children.length > 0) {
        const columnSettings = settings.toAST()[0] as Partial<Column>;
        Object.assign(result, columnSettings);
      }

      return result;
    },

    DataType_array(type: OhmNode, _brackets: OhmNode) {
      return type.toAST() + "[]";
    },

    DataType_parameterized(type: OhmNode, _open: OhmNode, params: OhmNode, _close: OhmNode) {
      return type.toAST() + "(" + params.sourceString + ")";
    },

    DataType_simple(type: OhmNode) {
      return type.toAST();
    },

    ColumnSettings(_open: OhmNode, settings: OhmNode, _close: OhmNode) {
      const result: Partial<Column> = {};
      for (const setting of settings.asIteration().children) {
        Object.assign(result, setting.toAST());
      }
      return result;
    },

    ColumnSetting_pk(_: OhmNode) {
      return { pk: true };
    },
    
    ColumnSetting_primaryKey(_: OhmNode, __: OhmNode) {
      return { pk: true };
    },

    ColumnSetting_unique(_: OhmNode) {
      return { unique: true };
    },

    ColumnSetting_notNull(_: OhmNode, __: OhmNode) {
      return { notNull: true };
    },

    ColumnSetting_null(_: OhmNode) {
      return { notNull: false };
    },

    ColumnSetting_increment(_: OhmNode) {
      return { increment: true };
    },

    ColumnSetting_identityAlways(_: OhmNode, __: OhmNode, ___: OhmNode, ____: OhmNode) {
      return { identityGeneration: "always" };
    },

    ColumnSetting_identityByDefault(_: OhmNode, __: OhmNode, ___: OhmNode, ____: OhmNode, _____: OhmNode) {
      return { identityGeneration: "by default" };
    },

    ColumnSetting_generatedStored(_: OhmNode, __: OhmNode, ___: OhmNode, expr: OhmNode, ____: OhmNode) {
      const expression = expr.sourceString.slice(1, -1); // Remove backticks
      return { generatedExpression: expression, generatedStored: true };
    },

    ColumnSetting_check(_: OhmNode, expr: OhmNode) {
      const expression = expr.sourceString.slice(1, -1); // Remove backticks
      return { check: expression };
    },

    ColumnDefault(_default: OhmNode, _colon: OhmNode, value: OhmNode) {
      return { default: value.toAST() };
    },

    ColumnNote(_note: OhmNode, _colon: OhmNode, value: OhmNode) {
      return { note: value.toAST() };
    },

    ColumnRef(_ref: OhmNode, _colon: OhmNode, type: OhmNode, endpoint: OhmNode) {
      const ref: InlineRef = {
        type: type.toAST(),
        to: endpoint.toAST(),
      };
      return { ref };
    },

    DefaultValue_expression(expr: OhmNode) {
      const value = expr.sourceString.slice(1, -1); // Remove backticks
      return {
        type: "expression",
        value,
      } as DefaultValue;
    },

    DefaultValue_literal(value: OhmNode) {
      return value.toAST();
    },

    // ===== Indexes =====
    Indexes(_indexes: OhmNode, _open: OhmNode, indexes: OhmNode, _close: OhmNode) {
      const result: IndexesAST = {
        type: "indexes",
        indexes: indexes.children.map((i) => i.toAST() as Index),
      };
      return result;
    },

    Index_composite(_open: OhmNode, columns: OhmNode, _close: OhmNode, settings: OhmNode) {
      const index: Index = {
        columns: columns.asIteration().children.map((c) => c.toAST() as IndexColumn),
      };

      if (settings.children.length > 0) {
        Object.assign(index, settings.toAST()[0] as Partial<Index>);
      }

      return index;
    },

    Index_single(column: OhmNode, settings: OhmNode) {
      const index: Index = {
        columns: [{ name: column.toAST() }],
      };

      if (settings.children.length > 0) {
        Object.assign(index, settings.toAST()[0] as Partial<Index>);
      }

      return index;
    },

    IndexColumn(name: OhmNode, sortOrder: OhmNode) {
      const column: IndexColumn = {
        name: name.toAST(),
      };
      if (sortOrder.children.length > 0) {
        column.sort = sortOrder.toAST()[0] as "asc" | "desc";
      }
      return column;
    },

    SortOrder_asc(_: OhmNode) {
      return "asc";
    },

    SortOrder_desc(_: OhmNode) {
      return "desc";
    },

    IndexSettings(_open: OhmNode, settings: OhmNode, _close: OhmNode) {
      const result: Partial<Index> = {};
      for (const setting of settings.asIteration().children) {
        Object.assign(result, setting.toAST());
      }
      return result;
    },

    IndexType(_type: OhmNode, _colon: OhmNode, typeName: OhmNode) {
      return { type: typeName.toAST() };
    },

    IndexName(_name: OhmNode, _colon: OhmNode, value: OhmNode) {
      return { name: value.toAST() };
    },

    IndexWhere(_where: OhmNode, _colon: OhmNode, value: OhmNode) {
      return { where: value.toAST() };
    },

    IndexSetting_pk(_: OhmNode) {
      return { pk: true };
    },

    IndexSetting_unique(_: OhmNode) {
      return { unique: true };
    },

    IndexTypeName_btree(_: OhmNode) {
      return "btree";
    },

    IndexTypeName_hash(_: OhmNode) {
      return "hash";
    },

    IndexTypeName_gin(_: OhmNode) {
      return "gin";
    },

    IndexTypeName_gist(_: OhmNode) {
      return "gist";
    },

    IndexTypeName_spgist(_: OhmNode) {
      return "spgist";
    },

    IndexTypeName_brin(_: OhmNode) {
      return "brin";
    },

    IndexTypeName_custom(type: OhmNode) {
      return type.sourceString.toLowerCase();
    },

    // ===== Constraints =====
    Constraints(_constraints: OhmNode, _open: OhmNode, constraints: OhmNode, _close: OhmNode) {
      const result: ConstraintsAST = {
        type: "constraints",
        constraints: constraints.children.map((c) => c.toAST() as Constraint),
      };
      return result;
    },

    Constraint(name: OhmNode, type: OhmNode, settings: OhmNode) {
      const constraint = type.toAST() as Constraint;
      
      if (name.children.length > 0) {
        constraint.name = name.toAST()[0] as string;
      }

      if (settings.children.length > 0) {
        Object.assign(constraint, settings.toAST()[0] as Partial<Constraint>);
      }

      return constraint;
    },

    ConstraintName(_constraint: OhmNode, name: OhmNode) {
      return name.toAST();
    },

    ConstraintType_check(_check: OhmNode, expr: OhmNode) {
      const expression = expr.sourceString.slice(1, -1); // Remove backticks
      return {
        type: "check",
        expression,
      };
    },

    ConstraintType_unique(_unique: OhmNode, _open: OhmNode, columns: OhmNode, _close: OhmNode) {
      return {
        type: "unique",
        columns: columns.asIteration().children.map((c) => c.toAST() as string),
      };
    },

    ConstraintType_primaryKey(_primary: OhmNode, _key: OhmNode, _open: OhmNode, columns: OhmNode, _close: OhmNode) {
      return {
        type: "primary_key",
        columns: columns.asIteration().children.map((c) => c.toAST() as string),
      };
    },

    ConstraintType_exclude(_exclude: OhmNode, _using: OhmNode, method: OhmNode, _open: OhmNode, column: OhmNode, _with: OhmNode, operator: OhmNode, _close: OhmNode) {
      return {
        type: "exclude",
        using: method.toAST(),
        columns: [column.toAST()],
        withOperator: operator.sourceString,
      };
    },
    
    ExcludeOperator(op: OhmNode) {
      return op.sourceString;
    },

    ConstraintSettings(_open: OhmNode, settings: OhmNode, _close: OhmNode) {
      const result: Partial<Constraint> = {};
      for (const setting of settings.asIteration().children) {
        Object.assign(result, setting.toAST() as Partial<Constraint>);
      }
      return result;
    },

    ConstraintSetting_deferrable(_: OhmNode) {
      return { deferrable: true };
    },

    ConstraintSetting_notDeferrable(_: OhmNode, __: OhmNode) {
      return { deferrable: false };
    },

    ConstraintSetting_initiallyDeferred(_: OhmNode, __: OhmNode) {
      return { initiallyDeferred: true };
    },

    ConstraintSetting_initiallyImmediate(_: OhmNode, __: OhmNode) {
      return { initiallyDeferred: false };
    },

    // ===== References =====
    Ref(_ref: OhmNode, name: OhmNode, _colon: OhmNode, from: OhmNode, refType: OhmNode, to: OhmNode, settings: OhmNode) {
      const result: Ref & { type: string } = {
        type: "ref",
        from: from.toAST() as RefEndpoint,
        to: to.toAST() as RefEndpoint,
        refType: refType.toAST() as RefType,
      };

      if (name.children.length > 0) {
        result.name = name.toAST()[0] as string;
      }

      if (settings.children.length > 0) {
        Object.assign(result, settings.toAST()[0] as Partial<Ref>);
      }

      return result;
    },

    RefEndpoint_compositeQualified(schema: OhmNode, _dot1: OhmNode, table: OhmNode, _dot2: OhmNode, _open: OhmNode, columns: OhmNode, _close: OhmNode) {
      return {
        schema: schema.toAST(),
        table: table.toAST(),
        columns: columns.asIteration().children.map((c) => c.toAST() as string),
      };
    },

    RefEndpoint_composite(table: OhmNode, _dot: OhmNode, _open: OhmNode, columns: OhmNode, _close: OhmNode) {
      return {
        table: table.toAST(),
        columns: columns.asIteration().children.map((c) => c.toAST() as string),
      };
    },

    RefEndpoint_simpleQualified(schema: OhmNode, _dot1: OhmNode, table: OhmNode, _dot2: OhmNode, column: OhmNode) {
      return {
        schema: schema.toAST(),
        table: table.toAST(),
        column: column.toAST(),
      };
    },

    RefEndpoint_simple(table: OhmNode, _dot: OhmNode, column: OhmNode) {
      return {
        table: table.toAST(),
        column: column.toAST(),
      };
    },

    RefType_many(_: OhmNode) {
      return "<>" as RefType;
    },

    RefType_to(_: OhmNode) {
      return ">" as RefType;
    },

    RefType_from(_: OhmNode) {
      return "<" as RefType;
    },

    RefType_one(_: OhmNode) {
      return "-" as RefType;
    },

    RefSettings(_open: OhmNode, settings: OhmNode, _close: OhmNode) {
      const result: Partial<Ref> = {};
      for (const setting of settings.asIteration().children) {
        Object.assign(result, setting.toAST());
      }
      return result;
    },

    RefSetting_delete(setting: OhmNode) {
      return setting.toAST();
    },

    RefSetting_update(setting: OhmNode) {
      return setting.toAST();
    },

    RefOnDelete(_delete: OhmNode, _colon: OhmNode, action: OhmNode) {
      return { onDelete: action.toAST() };
    },

    RefOnUpdate(_update: OhmNode, _colon: OhmNode, action: OhmNode) {
      return { onUpdate: action.toAST() };
    },

    RefAction_cascade(_: OhmNode) {
      return "cascade" as RefAction;
    },

    RefAction_restrict(_: OhmNode) {
      return "restrict" as RefAction;
    },

    RefAction_setNull(_: OhmNode, __: OhmNode) {
      return "set null" as RefAction;
    },

    RefAction_setDefault(_: OhmNode, __: OhmNode) {
      return "set default" as RefAction;
    },

    RefAction_noAction(_: OhmNode, __: OhmNode) {
      return "no action" as RefAction;
    },

    // ===== Enums =====
    Enum(_enum: OhmNode, name: OhmNode, _open: OhmNode, values: OhmNode, _close: OhmNode) {
      return {
        type: "enum",
        name: name.toAST(),
        values: values.children.map((v) => v.toAST() as EnumValue),
      } as Enum;
    },

    EnumValue(name: OhmNode, note: OhmNode) {
      const value: EnumValue = {
        name: name.toAST(),
      };
      if (note.children.length > 0) {
        value.note = note.toAST()[0];
      }
      return value;
    },

    EnumValueNote(_open: OhmNode, _note: OhmNode, _colon: OhmNode, value: OhmNode, _close: OhmNode) {
      return value.toAST();
    },

    // ===== Table Groups =====
    TableGroup(_tablegroup: OhmNode, name: OhmNode, _open: OhmNode, tables: OhmNode, _close: OhmNode) {
      return {
        type: "tableGroup",
        name: name.toAST(),
        tables: tables.children.map((t) => t.toAST() as string),
      } as TableGroup;
    },

    // ===== Notes =====
    Note(_note: OhmNode, _colon: OhmNode, value: OhmNode) {
      const result: NoteAST = {
        type: "note",
        value: value.toAST() as string,
      };
      return result;
    },

    HeaderColor(_headercolor: OhmNode, _colon: OhmNode, value: OhmNode) {
      const result: HeaderColorAST = {
        type: "headerColor",
        value: value.sourceString.startsWith('#') ? value.sourceString : value.toAST() as string,
      };
      return result;
    },

    HexColor(_hash: OhmNode, _d1: OhmNode, _d2: OhmNode, _d3: OhmNode, _d4: OhmNode, _d5: OhmNode, _d6: OhmNode) {
      return this.sourceString;
    },

    // ===== Values =====
    tripleString(_open: OhmNode, chars: OhmNode, _close: OhmNode) {
      return chars.sourceString;
    },

    doubleString(_open: OhmNode, chars: OhmNode, _close: OhmNode) {
      return chars.children.map((c: OhmNode) => c.toAST()).join('');
    },

    doubleStringChar_escape(_: OhmNode, char: OhmNode) {
      const c = char.sourceString;
      if (c === '"') return '"';
      if (c === '\\') return '\\';
      if (c === 'n') return '\n';
      if (c === 'r') return '\r';
      if (c === 't') return '\t';
      return c;
    },

    doubleStringChar_normal(char: OhmNode) {
      return char.sourceString;
    },

    singleString(_open: OhmNode, chars: OhmNode, _close: OhmNode) {
      return chars.children.map((c: OhmNode) => c.toAST()).join('');
    },

    singleStringChar_escape(_: OhmNode, char: OhmNode) {
      const c = char.sourceString;
      if (c === "'") return "'";
      if (c === '\\') return '\\';
      if (c === 'n') return '\n';
      if (c === 'r') return '\r';
      if (c === 't') return '\t';
      return c;
    },

    singleStringChar_normal(char: OhmNode) {
      return char.sourceString;
    },

    backtickString(_open: OhmNode, chars: OhmNode, _close: OhmNode) {
      return chars.sourceString;
    },

    number(_sign: OhmNode, _int: OhmNode, _dot: OhmNode, _decimal: OhmNode) {
      return parseFloat(this.sourceString);
    },

    boolean_true(_: OhmNode) {
      return true;
    },

    boolean_false(_: OhmNode) {
      return false;
    },

    identifier(name: OhmNode) {
      return name.toAST();
    },

    quotedIdentifier(_open: OhmNode, chars: OhmNode, _close: OhmNode) {
      return chars.sourceString;
    },

    identifierName(_first: OhmNode, _rest: OhmNode) {
      return this.sourceString;
    },

    // Newline variants
    newline_lf(_: OhmNode) {
      return "\n";
    },

    newline_cr(_: OhmNode) {
      return "\r";
    },

    newline_crlf(_: OhmNode) {
      return "\r\n";
    },

    // For any terminal rule, just return the source
    _terminal() {
      return this.sourceString;
    },

    // For iteration nodes
    _iter(...children: OhmNode[]) {
      return children.map((c) => c.toAST());
    },
  });

  return semantics;
}