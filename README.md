# dbml-pg

<div align="center">
  <img src="assets/dbml-pg.webp" alt="dbml-pg Logo" width="160" height="160">
  <br><br>
  <strong>Parse any valid DBML file and leverage additional PostgreSQL-specific features</strong>
  <br><br>
  
  [![JSR](https://jsr.io/badges/@atikayda/dbml-pg)](https://jsr.io/@atikayda/kjson)
  [![GitHub](https://img.shields.io/badge/GitHub-atikayda/dbml-pg-blue?logo=github)](https://github.com/atikayda/dbml-pg)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Deno](https://img.shields.io/badge/Deno-1.45+-brightgreen?logo=deno)](https://deno.land)
  
</div>

---

A **100% DBML-compliant** parser with PostgreSQL extensions. Parse any valid DBML file and leverage additional PostgreSQL-specific features.

## Features

`dbml-pg` extends the standard DBML specification to support PostgreSQL-specific features while maintaining backward compatibility:

### ✅ 100% Standard DBML Support
- Tables, columns, and relationships (one-to-one, one-to-many, many-to-many)
- Primary keys, foreign keys, and unique constraints
- Indexes with multiple columns and sort orders
- Enums with values and notes
- Table groups and project definitions
- Notes and comments at all levels
- TablePartial definitions for reusable field sets
- Cross-schema references (e.g., `schema.table.column`)
- Composite relationship endpoints (e.g., `table.(col1, col2)`)
- All reference actions (cascade, restrict, set null, set default, no action)

### 🚀 PostgreSQL Extensions
- **Custom Types**: Support for any PostgreSQL type including custom domains
- **Array Types**: `text[]`, `integer[]`, `jsonb[]`, etc.
- **Advanced Index Types**: `gin`, `gist`, `spgist`, `brin` (beyond standard `btree` and `hash`)
- **Partial Indexes**: WHERE clauses on indexes
- **Custom Default Functions**: Any PostgreSQL function in defaults
- **Identity Columns**: `GENERATED ALWAYS/BY DEFAULT AS IDENTITY`
- **Generated Columns**: `GENERATED ALWAYS AS (expression) STORED`
- **Check Constraints**: Table and column-level CHECK constraints
- **Exclude Constraints**: Advanced constraint types with operators
- **Constraint Options**: Deferrable and initially deferred settings

### 🔧 Additional Features
- **Type Aliases**: Map custom types to PostgreSQL types (e.g., `kinstant` → `timestamp`)
- **Case-Insensitive Keywords**: Write DBML in any case style
- **Flexible Syntax**: Handles real-world schemas with proper error recovery

## Installation

```bash
# Deno
deno add @atikayda/dbml-pg

# npm (coming soon)
npm install @atikayda/dbml-pg
```

## Usage

```typescript
import { Parser } from "@atikayda/dbml-pg";

const dbml = `
Table users {
  id uuid [pk, default: \`gen_random_uuid()\`]
  email text [unique, not null]
  created_at kinstant [default: \`kjson_now()\`]
  metadata kjson
  tags text[]
  
  indexes {
    (email) [type: hash]
    (tags) [type: gin]
    (created_at) [type: btree, where: "created_at > '2024-01-01'"]
  }
}

Table posts {
  id bigserial [pk]
  user_id uuid [ref: > users.id]
  content text
  search_vector tsvector
  
  indexes {
    (search_vector) [type: gin]
  }
}
`;

const parser = new Parser();
const schema = parser.parse(dbml);

console.log(schema);
```

## Type Mappings

You can configure custom type mappings:

```typescript
const parser = new Parser({
  typeMappings: {
    "kinstant": "timestamp with time zone",
    "kjson": "jsonb",
  }
});
```

### Validation

Check if DBML syntax is valid without parsing:

```typescript
const parser = new Parser();
const result = parser.validate(dbml);

if (result.valid) {
  console.log("DBML is valid!");
} else {
  console.error("Invalid DBML:", result.error);
}
```

## Extended Syntax

### Custom Index Types
```dbml
indexes {
  (column) [type: gin]    // GIN index for arrays/JSON
  (column) [type: gist]   // GiST index for geometric types
  (column) [type: spgist] // SP-GiST index
  (column) [type: brin]   // BRIN index for large tables
}
```

### Partial Indexes
```dbml
indexes {
  (status) [type: btree, where: "status = 'active'"]
  (created_at) [type: btree, where: "created_at > NOW() - INTERVAL '30 days'"]
}
```

### Array Types
```dbml
Table products {
  id serial [pk]
  tags text[]
  prices decimal(10,2)[]
  metadata jsonb[]
}
```

### Custom Defaults
```dbml
Table events {
  id uuid [default: \`gen_random_uuid()\`]
  created_at timestamp [default: \`CURRENT_TIMESTAMP\`]
  data jsonb [default: \`'{}'::jsonb\`]
}
```

### TablePartial (Parsing Only)
```dbml
// Define reusable field sets
TablePartial timestamps {
  created_at timestamp [default: \`now()\`]
  updated_at timestamp [default: \`now()\`]
}

// Reference in tables
Table users {
  id integer [pk]
  ~timestamps  // Partial reference
  email varchar
}
```
Note: Partial merging is left to implementors. See docs/TABLEPARTIAL_IMPLEMENTATION.md for details.

### PostgreSQL Identity Columns
```dbml
Table products {
  id integer [pk, generated always as identity]
  sku varchar [generated by default as identity]
}
```

### Generated Columns
```dbml
Table invoices {
  price decimal(10,2)
  tax decimal(10,2)
  total decimal(10,2) [generated always as `price + tax` stored]
}
```

### Check Constraints
```dbml
Table products {
  price decimal [check: `price > 0`]
  
  constraints {
    constraint positive_stock check `stock >= 0`
  }
}
```

### Composite Relationships
```dbml
Table order_items {
  order_id integer
  product_id integer
  quantity integer
}

Ref: order_items.(order_id, product_id) > composite_key.(id1, id2)
```

## API Reference

### Parser

```typescript
class Parser {
  constructor(options?: ParserOptions);
  parse(dbml: string): Schema;
  validate(dbml: string): { valid: boolean; error?: string };
}

interface ParserOptions {
  typeMappings?: Record<string, string>;
  strict?: boolean; // If true, only allow standard DBML
}
```

### Schema Types

```typescript
interface Schema {
  name: string;
  tables: Table[];
  refs: Ref[];
  enums: Enum[];
  tableGroups: TableGroup[];
  project?: Project;
  partials?: TablePartial[]; // TablePartial definitions
}

interface Table {
  name: string;
  columns: Column[];
  indexes: Index[];
  note?: string;
  headerColor?: string;
  schema?: string; // Schema qualification
  alias?: string; // Table alias
  constraints?: Constraint[]; // Table-level constraints
  elements?: TableElement[]; // Ordered array of columns and partial refs
}

interface Column {
  name: string;
  type: string;
  pk?: boolean;
  unique?: boolean;
  notNull?: boolean;
  increment?: boolean;
  default?: string | DefaultValue;
  note?: string;
  ref?: InlineRef;
  identityGeneration?: "always" | "by default";
  generatedExpression?: string;
  generatedStored?: boolean;
  check?: string;
}

interface Index {
  columns: IndexColumn[] | string[]; // Can be strings or objects with sort order
  type?: "btree" | "hash" | "gin" | "gist" | "spgist" | "brin";
  unique?: boolean;
  pk?: boolean;
  name?: string;
  where?: string;
  note?: string;
}

interface IndexColumn {
  name: string;
  sort?: "asc" | "desc";
}
```

## Error Handling

```typescript
import { Parser, ParseError } from "@atikayda/dbml-pg";

const parser = new Parser();

try {
  const schema = parser.parse(dbml);
} catch (error) {
  if (error instanceof ParseError) {
    console.error(error.getFormattedMessage());
    // Line 5, column 12:
    //   id integer [invalid syntax]
    //              ^
  }
}
```

## Compatibility

- ✅ **Backward Compatible**: All standard DBML files parse correctly
- ✅ **Forward Compatible**: Extensions use existing DBML syntax patterns
- ✅ **Tool Friendly**: Produces AST compatible with DBML tools
- ✅ **PostgreSQL Native**: Generates proper PostgreSQL DDL

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details.

## Credits

Built with ❤️ by [atikayda](https://github.com/atikayda)

Inspired by the [DBML](https://dbml.org) project by Holistics.