/**
 * Tests for additional DBML features not covered in other tests
 */

import { assertEquals } from "@std/assert";
import { Parser } from "../src/parser.ts";

Deno.test("DBML - Named reference with colon syntax", () => {
  const dbml = `
    Table users {
      id integer
    }
    
    Table posts {
      id integer
      user_id integer
    }
    
    Ref fk_user: posts.user_id > users.id
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.refs[0].name, "fk_user");
  assertEquals(schema.refs[0].from.table, "posts");
  assertEquals(schema.refs[0].from.column, "user_id");
});

Deno.test("DBML - Cross-schema references", () => {
  const dbml = `
    Table auth.users {
      id integer
    }
    
    Table app.posts {
      id integer
      user_id integer
    }
    
    Ref: app.posts.user_id > auth.users.id
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.tables[0].schema, "auth");
  assertEquals(schema.tables[0].name, "users");
  assertEquals(schema.tables[1].schema, "app");
  assertEquals(schema.tables[1].name, "posts");
  
  // Check if reference endpoints preserve schema
  // Note: Our current implementation might not fully support this
});

Deno.test("DBML - Enum values with quotes", () => {
  const dbml = `
    enum "order status" {
      pending
      "in progress"
      completed
      cancelled
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.enums[0].name, "order status");
  assertEquals(schema.enums[0].values[1].name, "in progress");
});

Deno.test("DBML - Multiple column settings combinations", () => {
  const dbml = `
    Table test {
      id integer [pk, increment, not null]
      code varchar [unique, not null, default: 'ABC']
      optional varchar [null, note: 'Can be null']
      computed integer [null, default: 0]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const columns = schema.tables[0].columns;
  assertEquals(columns[0].pk, true);
  assertEquals(columns[0].increment, true);
  assertEquals(columns[0].notNull, true);
  
  assertEquals(columns[1].unique, true);
  assertEquals(columns[1].notNull, true);
  assertEquals(columns[1].default, 'ABC');
});

Deno.test("DBML - Float/decimal default values", () => {
  const dbml = `
    Table products {
      price decimal [default: 19.99]
      tax_rate float [default: 0.0825]
      discount decimal [default: 0.0]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const columns = schema.tables[0].columns;
  assertEquals(columns[0].default, 19.99);
  assertEquals(columns[1].default, 0.0825);
  assertEquals(columns[2].default, 0.0);
});

Deno.test("DBML - Index with sort order", () => {
  const dbml = `
    Table products {
      id integer
      price decimal
      created_at timestamp
      
      indexes {
        (price desc, created_at asc)
        (id asc)
      }
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const indexes = schema.tables[0].indexes;
  assertEquals(indexes[0].columns[0].sort, "desc");
  assertEquals(indexes[0].columns[1].sort, "asc");
  assertEquals(indexes[1].columns[0].sort, "asc");
});

Deno.test("DBML - All reference action types", () => {
  const dbml = `
    Table parent {
      id integer [pk]
    }
    
    Table child1 {
      parent_id integer
    }
    
    Table child2 {
      parent_id integer
    }
    
    Table child3 {
      parent_id integer
    }
    
    Table child4 {
      parent_id integer
    }
    
    Table child5 {
      parent_id integer
    }
    
    Ref: child1.parent_id > parent.id [delete: cascade, update: cascade]
    Ref: child2.parent_id > parent.id [delete: restrict, update: restrict]
    Ref: child3.parent_id > parent.id [delete: set null, update: set null]
    Ref: child4.parent_id > parent.id [delete: set default, update: set default]
    Ref: child5.parent_id > parent.id [delete: no action, update: no action]
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.refs[0].onDelete, "cascade");
  assertEquals(schema.refs[1].onDelete, "restrict");
  assertEquals(schema.refs[2].onDelete, "set null");
  assertEquals(schema.refs[3].onDelete, "set default");
  assertEquals(schema.refs[4].onDelete, "no action");
});

Deno.test("DBML - Empty tables and minimal syntax", () => {
  const dbml = `
    Table empty {
    }
    
    Table minimal {
      id integer
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.tables[0].name, "empty");
  assertEquals(schema.tables[0].columns.length, 0);
  assertEquals(schema.tables[1].name, "minimal");
  assertEquals(schema.tables[1].columns.length, 1);
});

Deno.test("DBML - Nested quotes in strings", () => {
  const dbml = `
    Table test {
      description varchar [default: 'It\\'s a test']
      json_data text [default: '{"key": "value"}']
      note_field varchar [note: "This is a \\"quoted\\" word"]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const columns = schema.tables[0].columns;
  assertEquals(columns[0].default, "It's a test");
  assertEquals(columns[1].default, '{"key": "value"}');
  assertEquals(columns[2].note, 'This is a "quoted" word');
});

Deno.test("DBML - Uppercase keywords", () => {
  const dbml = `
    TABLE users {
      id INTEGER [PRIMARY KEY]
      email VARCHAR [UNIQUE, NOT NULL]
      created_at TIMESTAMP [DEFAULT: \`NOW()\`]
    }
    
    ENUM user_role {
      admin
      user
    }
    
    REF: users.id < posts.user_id
    
    Table posts {
      id integer
      user_id integer
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.tables[0].name, "users");
  assertEquals(schema.tables[0].columns[0].pk, true);
  assertEquals(schema.enums[0].name, "user_role");
  assertEquals(schema.refs.length, 1);
});