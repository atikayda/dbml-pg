/**
 * Tests for TablePartial parsing support
 * Note: This implementation parses TablePartial definitions and partial references
 * but does NOT merge them. Merging is left to implementors.
 */

import { assertEquals, assertExists } from "@std/assert";
import { Parser } from "../src/parser.ts";

Deno.test("DBML - Basic TablePartial definition", () => {
  const dbml = `
    TablePartial timestamps {
      created_at timestamp [default: \`now()\`]
      updated_at timestamp [default: \`now()\`]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertExists(schema.partials);
  assertEquals(schema.partials.length, 1);
  assertEquals(schema.partials[0].name, "timestamps");
  assertEquals(schema.partials[0].columns.length, 2);
  assertEquals(schema.partials[0].columns[0].name, "created_at");
  assertEquals(schema.partials[0].columns[1].name, "updated_at");
});

Deno.test("DBML - TablePartial with indexes", () => {
  const dbml = `
    TablePartial searchable {
      search_vector tsvector
      
      indexes {
        search_vector [type: gin]
      }
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertExists(schema.partials);
  assertEquals(schema.partials[0].name, "searchable");
  assertEquals(schema.partials[0].columns.length, 1);
  assertEquals(schema.partials[0].indexes.length, 1);
  assertEquals(schema.partials[0].indexes[0].type, "gin");
});

Deno.test("DBML - TablePartial with constraints", () => {
  const dbml = `
    TablePartial audit {
      user_id integer [not null]
      action varchar [not null]
      
      constraints {
        check \`action IN ('CREATE', 'UPDATE', 'DELETE')\`
      }
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertExists(schema.partials);
  assertEquals(schema.partials[0].name, "audit");
  assertEquals(schema.partials[0].constraints?.length, 1);
  assertEquals(schema.partials[0].constraints?.[0].type, "check");
});

Deno.test("DBML - Table with partial references", () => {
  const dbml = `
    TablePartial timestamps {
      created_at timestamp
      updated_at timestamp
    }
    
    Table users {
      id integer [pk]
      ~timestamps
      email varchar [unique]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  // Check that the partial is parsed
  assertExists(schema.partials);
  assertEquals(schema.partials.length, 1);
  
  // Check that the table has elements in correct order
  assertExists(schema.tables[0].elements);
  assertEquals(schema.tables[0].elements.length, 3); // id, ~timestamps, email
  
  // First element: id column
  assertEquals(schema.tables[0].elements[0].type, "column");
  if (schema.tables[0].elements[0].type === "column") {
    assertEquals(schema.tables[0].elements[0].column.name, "id");
  }
  
  // Second element: timestamps partial ref
  assertEquals(schema.tables[0].elements[1].type, "partialRef");
  if (schema.tables[0].elements[1].type === "partialRef") {
    assertEquals(schema.tables[0].elements[1].ref.name, "timestamps");
  }
  
  // Third element: email column
  assertEquals(schema.tables[0].elements[2].type, "column");
  if (schema.tables[0].elements[2].type === "column") {
    assertEquals(schema.tables[0].elements[2].column.name, "email");
  }
  
  // Check that table still has its own columns
  assertEquals(schema.tables[0].columns.length, 2);
  assertEquals(schema.tables[0].columns[0].name, "id");
  assertEquals(schema.tables[0].columns[1].name, "email");
});

Deno.test("DBML - Table with multiple partial references", () => {
  const dbml = `
    TablePartial timestamps {
      created_at timestamp
      updated_at timestamp
    }
    
    TablePartial soft_delete {
      is_deleted boolean [default: false]
      deleted_at timestamp [null]
    }
    
    Table users {
      ~timestamps
      id integer [pk]
      email varchar [unique]
      ~soft_delete
      name varchar
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  // Check partials
  assertEquals(schema.partials?.length, 2);
  
  // Check table has elements in correct interleaved order
  const elements = schema.tables[0].elements;
  assertExists(elements);
  assertEquals(elements.length, 5); // ~timestamps, id, email, ~soft_delete, name
  
  // Verify exact ordering
  assertEquals(elements[0].type, "partialRef");
  if (elements[0].type === "partialRef") {
    assertEquals(elements[0].ref.name, "timestamps");
  }
  
  assertEquals(elements[1].type, "column");
  if (elements[1].type === "column") {
    assertEquals(elements[1].column.name, "id");
  }
  
  assertEquals(elements[2].type, "column");
  if (elements[2].type === "column") {
    assertEquals(elements[2].column.name, "email");
  }
  
  assertEquals(elements[3].type, "partialRef");
  if (elements[3].type === "partialRef") {
    assertEquals(elements[3].ref.name, "soft_delete");
  }
  
  assertEquals(elements[4].type, "column");
  if (elements[4].type === "column") {
    assertEquals(elements[4].column.name, "name");
  }
  
  // Table still has its own columns
  assertEquals(schema.tables[0].columns.length, 3);
});

Deno.test("DBML - Complex example with all features", () => {
  const dbml = `
    Project myapp {
      name: "My Application"
    }
    
    TablePartial timestamps {
      created_at timestamp [default: \`now()\`, not null]
      updated_at timestamp [default: \`now()\`, not null]
      
      indexes {
        created_at
      }
    }
    
    TablePartial soft_delete {
      is_deleted boolean [default: false]
      deleted_at timestamp [null]
      
      indexes {
        (is_deleted, deleted_at)
      }
    }
    
    Table users {
      id integer [pk, increment]
      ~timestamps
      email varchar [unique, not null]
      ~soft_delete
      
      indexes {
        email [unique]
      }
    }
    
    Table posts {
      id integer [pk]
      ~timestamps
      user_id integer [ref: > users.id]
      title varchar
      content text
      ~soft_delete
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  // Verify partials are parsed
  assertEquals(schema.partials?.length, 2);
  assertEquals(schema.partials![0].name, "timestamps");
  assertEquals(schema.partials![1].name, "soft_delete");
  
  // Verify both tables have elements with correct ordering
  assertEquals(schema.tables[0].elements?.length, 4); // id, ~timestamps, email, ~soft_delete
  assertEquals(schema.tables[1].elements?.length, 6); // id, ~timestamps, user_id, title, content, ~soft_delete
  
  // Each table maintains its own columns
  assertEquals(schema.tables[0].columns.length, 2); // id, email
  assertEquals(schema.tables[1].columns.length, 4); // id, user_id, title, content
  
  // Partials maintain their own indexes
  assertEquals(schema.partials![0].indexes.length, 1);
  assertEquals(schema.partials![1].indexes.length, 1);
});

Deno.test("DBML - Case insensitive TablePartial", () => {
  const dbml = `
    TABLEPARTIAL common_fields {
      uuid varchar [pk]
      version integer [default: 1]
    }
    
    Table items {
      ~common_fields
      name varchar
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertExists(schema.partials);
  assertEquals(schema.partials.length, 1);
  assertEquals(schema.partials[0].name, "common_fields");
});