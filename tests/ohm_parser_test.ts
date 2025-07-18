/**
 * Tests for Ohm-based DBML parser
 */

import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { Parser, ParseError } from "../src/parser.ts";

Deno.test("Ohm Parser - Basic table parsing", () => {
  const dbml = `
    Table users {
      id integer [pk]
      name text [not null]
      email varchar(255) [unique]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.tables.length, 1);
  assertEquals(schema.tables[0].name, "users");
  assertEquals(schema.tables[0].columns.length, 3);
  
  const idCol = schema.tables[0].columns[0];
  assertEquals(idCol.name, "id");
  assertEquals(idCol.type, "integer");
  assertEquals(idCol.pk, true);
});

Deno.test("Ohm Parser - PostgreSQL custom types", () => {
  const dbml = `
    Table test {
      id uuid [pk]
      created_at kinstant [default: \`kjson_now()\`]
      data kjson
      tags text[]
      metadata jsonb
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const table = schema.tables[0];
  assertEquals(table.columns[1].type, "timestamp with time zone");
  assertEquals(table.columns[2].type, "jsonb");
  assertEquals(table.columns[3].type, "text[]");
  assertEquals(table.columns[4].type, "jsonb");
});

Deno.test("Ohm Parser - GIN index type", () => {
  const dbml = `
    Table products {
      id serial [pk]
      tags text[]
      
      indexes {
        (tags) [type: gin]
      }
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const index = schema.tables[0].indexes[0];
  assertEquals(index.type, "gin");
  assertEquals(index.columns[0].name, "tags");
});

Deno.test("Ohm Parser - Partial index with WHERE clause", () => {
  const dbml = `
    Table orders {
      id bigserial [pk]
      status text
      created_at timestamp
      
      indexes {
        (status) [type: btree, where: "status = 'pending'"]
        (created_at) [where: "created_at > NOW() - INTERVAL '30 days'"]
      }
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const indexes = schema.tables[0].indexes;
  assertEquals(indexes[0].where, "status = 'pending'");
  assertEquals(indexes[1].where, "created_at > NOW() - INTERVAL '30 days'");
});

Deno.test("Ohm Parser - All PostgreSQL index types", () => {
  const dbml = `
    Table test_indexes {
      id serial [pk]
      data jsonb
      location point
      range_data int4range
      
      indexes {
        (id) [type: btree]
        (data) [type: gin]
        (location) [type: gist]
        (location) [type: spgist, name: 'idx_location_sp']
        (range_data) [type: brin]
      }
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const indexes = schema.tables[0].indexes;
  assertEquals(indexes[0].type, "btree");
  assertEquals(indexes[1].type, "gin");
  assertEquals(indexes[2].type, "gist");
  assertEquals(indexes[3].type, "spgist");
  assertEquals(indexes[4].type, "brin");
});

Deno.test("Ohm Parser - Project metadata", () => {
  const dbml = `
    Project my_database {
      database_type: 'PostgreSQL'
      note: 'Test database'
    }
    
    Table users {
      id serial [pk]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.name, "my_database");
  assertExists(schema.project);
  assertEquals(schema.project.database_type, "PostgreSQL");
  assertEquals(schema.project.note, "Test database");
});

Deno.test("Ohm Parser - References", () => {
  const dbml = `
    Table users {
      id uuid [pk]
    }
    
    Table posts {
      id uuid [pk]
      user_id uuid [ref: > users.id]
    }
    
    Ref: posts.user_id > users.id [delete: cascade, update: cascade]
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.refs.length, 1);
  const ref = schema.refs[0];
  assertEquals(ref.from.table, "posts");
  assertEquals(ref.from.column, "user_id");
  assertEquals(ref.to.table, "users");
  assertEquals(ref.to.column, "id");
  assertEquals(ref.onDelete, "cascade");
  assertEquals(ref.onUpdate, "cascade");
});

Deno.test("Ohm Parser - Enum support", () => {
  const dbml = `
    Enum status {
      pending [note: 'Awaiting processing']
      active
      completed
      cancelled
    }
    
    Table orders {
      id serial [pk]
      status status [not null]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.enums.length, 1);
  const enumDef = schema.enums[0];
  assertEquals(enumDef.name, "status");
  assertEquals(enumDef.values.length, 4);
  assertEquals(enumDef.values[0].note, "Awaiting processing");
});

Deno.test("Ohm Parser - Error reporting", () => {
  const dbml = `
    Table users {
      id integer [invalid_setting]
    }
  `;

  const parser = new Parser();
  
  assertThrows(
    () => parser.parse(dbml),
    ParseError,
    "Expected"
  );
});

Deno.test("Ohm Parser - Triple quoted strings", () => {
  const dbml = `
    Project test {
      note: '''
        This is a
        multi-line
        note
      '''
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);
  
  assertExists(schema.project?.note);
  assertEquals(schema.project.note.includes("multi-line"), true);
});

Deno.test("Ohm Parser - Keywords as identifiers", () => {
  const dbml = `
    Table audit_log {
      id serial [pk]
      action text
      type text
      name text
      
      indexes {
        (action)
        (type)
        (name)
      }
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);
  
  const table = schema.tables[0];
  assertEquals(table.columns[1].name, "action");
  assertEquals(table.columns[2].name, "type");
  assertEquals(table.columns[3].name, "name");
  assertEquals(table.indexes.length, 3);
});

Deno.test("Ohm Parser - Complex default expressions", () => {
  const dbml = `
    Table events {
      id uuid [default: \`gen_random_uuid()\`]
      created_at timestamp [default: \`CURRENT_TIMESTAMP\`]
      data jsonb [default: \`'{}'::jsonb\`]
      counter integer [default: 0]
      active boolean [default: true]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const columns = schema.tables[0].columns;
  assertExists(columns[0].default);
  assertExists(columns[1].default);
  assertExists(columns[2].default);
  assertEquals(columns[3].default, 0);
  assertEquals(columns[4].default, true);
});

Deno.test("Ohm Parser - Custom type mappings", () => {
  const dbml = `
    Table custom_types {
      id bigint [pk]
      amount money
      data super_json
    }
  `;

  const parser = new Parser({
    typeMappings: {
      "money": "numeric(19,4)",
      "super_json": "jsonb",
    },
  });
  const schema = parser.parse(dbml);

  const columns = schema.tables[0].columns;
  assertEquals(columns[1].type, "numeric(19,4)");
  assertEquals(columns[2].type, "jsonb");
});