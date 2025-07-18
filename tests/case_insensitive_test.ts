/**
 * Test case-insensitive parsing for DBML keywords
 */

import { assertEquals } from "@std/assert";
import { Parser } from "../src/parser.ts";

Deno.test("Case-insensitive keyword parsing", () => {
  const parser = new Parser();
  
  // Test various case combinations
  const testCases = [
    // All lowercase
    `table users {
      id integer [pk]
      name text [not null]
    }`,
    
    // All uppercase
    `TABLE users {
      id integer [PK]
      name text [NOT NULL]
    }`,
    
    // Mixed case
    `Table users {
      id integer [Pk]
      name text [Not Null]
    }`,
    
    // Crazy mixed case
    `TaBLe users {
      id integer [pK]
      name text [nOt NuLl]
    }`
  ];
  
  for (const dbml of testCases) {
    const schema = parser.parse(dbml);
    assertEquals(schema.tables.length, 1);
    assertEquals(schema.tables[0].name, "users");
    assertEquals(schema.tables[0].columns[0].pk, true);
    assertEquals(schema.tables[0].columns[1].notNull, true);
  }
});

Deno.test("Case-insensitive index types", () => {
  const parser = new Parser();
  
  const dbml = `
    TABLE test {
      data jsonb
      
      INDEXES {
        (data) [TYPE: GIN]
        (data) [type: Gin]
        (data) [Type: gin]
      }
    }
  `;
  
  const schema = parser.parse(dbml);
  const indexes = schema.tables[0].indexes;
  assertEquals(indexes.length, 3);
  assertEquals(indexes[0].type, "gin");
  assertEquals(indexes[1].type, "gin");
  assertEquals(indexes[2].type, "gin");
});

Deno.test("Case-insensitive references", () => {
  const parser = new Parser();
  
  const dbml = `
    table users {
      id uuid [PRIMARY KEY]
    }
    
    TABLE posts {
      id uuid [pk]
      user_id uuid
    }
    
    REF: posts.user_id > users.id [DELETE: CASCADE, UPDATE: RESTRICT]
  `;
  
  const schema = parser.parse(dbml);
  assertEquals(schema.tables.length, 2);
  assertEquals(schema.refs.length, 1);
  assertEquals(schema.refs[0].onDelete, "cascade");
  assertEquals(schema.refs[0].onUpdate, "restrict");
});

Deno.test("Case-insensitive boolean values", () => {
  const parser = new Parser();
  
  const dbml = `
    Project test {
      note: 'Test project'
    }
    
    Table settings {
      is_enabled boolean [default: TRUE]
      is_visible boolean [default: False]
      is_active boolean [default: tRuE]
    }
  `;
  
  const schema = parser.parse(dbml);
  const table = schema.tables[0];
  // Default values are stored as booleans from the boolean rule
  assertEquals(table.columns[0].default, true);
  assertEquals(table.columns[1].default, false);
  assertEquals(table.columns[2].default, true);
});

Deno.test("Case-insensitive sort orders", () => {
  const parser = new Parser();
  
  const dbml = `
    Table test {
      id integer
      name text
      
      indexes {
        (id ASC)
        (name desc)
        (id Asc, name DESC)
      }
    }
  `;
  
  const schema = parser.parse(dbml);
  const indexes = schema.tables[0].indexes;
  assertEquals(indexes[0].columns[0].sort, "asc");
  assertEquals(indexes[1].columns[0].sort, "desc");
  assertEquals(indexes[2].columns[0].sort, "asc");
  assertEquals(indexes[2].columns[1].sort, "desc");
});