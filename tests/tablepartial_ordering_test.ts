/**
 * Tests for TablePartial ordering preservation
 * Ensures that columns and partial references are preserved in exact order
 */

import { assertEquals, assertExists } from "@std/assert";
import { Parser } from "../src/parser.ts";

Deno.test("DBML - Interleaved partial references and columns", () => {
  const dbml = `
    TablePartial base {
      base_id uuid
    }
    
    TablePartial timestamps {
      created_at timestamp
      updated_at timestamp
    }
    
    TablePartial audit {
      created_by varchar
      modified_by varchar
    }
    
    Table complex_order {
      ~base
      name varchar
      ~timestamps
      description text
      status integer
      ~audit
      notes text
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const elements = schema.tables[0].elements;
  assertExists(elements);
  assertEquals(elements.length, 7);

  // Verify exact ordering
  const expectedOrder = [
    { type: "partialRef", name: "base" },
    { type: "column", name: "name" },
    { type: "partialRef", name: "timestamps" },
    { type: "column", name: "description" },
    { type: "column", name: "status" },
    { type: "partialRef", name: "audit" },
    { type: "column", name: "notes" },
  ];

  for (let i = 0; i < expectedOrder.length; i++) {
    const expected = expectedOrder[i];
    const actual = elements[i];
    
    assertEquals(actual.type, expected.type);
    
    if (expected.type === "column" && actual.type === "column") {
      assertEquals(actual.column.name, expected.name);
    } else if (expected.type === "partialRef" && actual.type === "partialRef") {
      assertEquals(actual.ref.name, expected.name);
    }
  }
});

Deno.test("DBML - Partial at beginning, middle, and end", () => {
  const dbml = `
    TablePartial start_fields {
      id integer [pk]
    }
    
    TablePartial middle_fields {
      active boolean
    }
    
    TablePartial end_fields {
      metadata jsonb
    }
    
    Table test {
      ~start_fields
      col1 varchar
      col2 integer
      ~middle_fields
      col3 text
      col4 decimal
      ~end_fields
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const elements = schema.tables[0].elements;
  assertExists(elements);
  assertEquals(elements.length, 7);

  // Check ordering: partial, 2 cols, partial, 2 cols, partial
  assertEquals(elements[0].type, "partialRef");
  if (elements[0].type === "partialRef") {
    assertEquals(elements[0].ref.name, "start_fields");
  }
  
  assertEquals(elements[1].type, "column");
  if (elements[1].type === "column") {
    assertEquals(elements[1].column.name, "col1");
  }
  
  assertEquals(elements[2].type, "column");
  if (elements[2].type === "column") {
    assertEquals(elements[2].column.name, "col2");
  }
  
  assertEquals(elements[3].type, "partialRef");
  if (elements[3].type === "partialRef") {
    assertEquals(elements[3].ref.name, "middle_fields");
  }
  
  assertEquals(elements[4].type, "column");
  if (elements[4].type === "column") {
    assertEquals(elements[4].column.name, "col3");
  }
  
  assertEquals(elements[5].type, "column");
  if (elements[5].type === "column") {
    assertEquals(elements[5].column.name, "col4");
  }
  
  assertEquals(elements[6].type, "partialRef");
  if (elements[6].type === "partialRef") {
    assertEquals(elements[6].ref.name, "end_fields");
  }
});

Deno.test("DBML - Multiple consecutive partial references", () => {
  const dbml = `
    TablePartial p1 {
      f1 integer
    }
    
    TablePartial p2 {
      f2 varchar
    }
    
    TablePartial p3 {
      f3 boolean
    }
    
    Table test {
      id integer [pk]
      ~p1
      ~p2
      ~p3
      name varchar
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const elements = schema.tables[0].elements;
  assertExists(elements);
  assertEquals(elements.length, 5);

  assertEquals(elements[0].type, "column");
  if (elements[0].type === "column") {
    assertEquals(elements[0].column.name, "id");
  }
  
  assertEquals(elements[1].type, "partialRef");
  if (elements[1].type === "partialRef") {
    assertEquals(elements[1].ref.name, "p1");
  }
  
  assertEquals(elements[2].type, "partialRef");
  if (elements[2].type === "partialRef") {
    assertEquals(elements[2].ref.name, "p2");
  }
  
  assertEquals(elements[3].type, "partialRef");
  if (elements[3].type === "partialRef") {
    assertEquals(elements[3].ref.name, "p3");
  }
  
  assertEquals(elements[4].type, "column");
  if (elements[4].type === "column") {
    assertEquals(elements[4].column.name, "name");
  }
});

Deno.test("DBML - Only partial references", () => {
  const dbml = `
    TablePartial fields1 {
      a integer
      b varchar
    }
    
    TablePartial fields2 {
      c boolean
      d timestamp
    }
    
    Table composed {
      ~fields1
      ~fields2
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const elements = schema.tables[0].elements;
  assertExists(elements);
  assertEquals(elements.length, 2);

  assertEquals(elements[0].type, "partialRef");
  if (elements[0].type === "partialRef") {
    assertEquals(elements[0].ref.name, "fields1");
  }
  
  assertEquals(elements[1].type, "partialRef");
  if (elements[1].type === "partialRef") {
    assertEquals(elements[1].ref.name, "fields2");
  }
  
  // Table has no direct columns
  assertEquals(schema.tables[0].columns.length, 0);
});