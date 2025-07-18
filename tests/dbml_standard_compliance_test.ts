/**
 * Tests for standard DBML compliance
 * Verifies that dbml-pg correctly parses all standard DBML features
 */

import { assertEquals, assertExists } from "@std/assert";
import { Parser } from "../src/parser.ts";

Deno.test("Standard DBML - Project definition", () => {
  const dbml = `
    Project ecommerce {
      database_type: 'PostgreSQL'
      note: 'E-commerce database'
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.name, "ecommerce");
  assertExists(schema.project);
  assertEquals(schema.project.database_type, "PostgreSQL");
  assertEquals(schema.project.note, "E-commerce database");
});

Deno.test("Standard DBML - Basic table with columns", () => {
  const dbml = `
    Table users {
      id integer [primary key]
      username varchar [unique, not null]
      email varchar [unique]
      created_at timestamp [default: 'now()']
      is_active boolean [default: true]
      age integer [null]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const table = schema.tables[0];
  assertEquals(table.name, "users");
  assertEquals(table.columns.length, 6);

  // Check primary key
  assertEquals(table.columns[0].pk, true);
  
  // Check unique and not null
  assertEquals(table.columns[1].unique, true);
  assertEquals(table.columns[1].notNull, true);
  
  // Check defaults
  assertEquals(table.columns[3].default, 'now()'); // String literal
  assertEquals(table.columns[4].default, true);
  
  // Check nullable (explicit null)
  assertEquals(table.columns[5].notNull, false);
});

Deno.test("Standard DBML - Indexes", () => {
  const dbml = `
    Table bookings {
      id integer
      country varchar
      booking_date date
      created_at timestamp
      
      indexes {
        (id, country) [pk]
        created_at
        (country, booking_date) [unique]
        booking_date [name: 'idx_booking_date']
      }
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const indexes = schema.tables[0].indexes;
  assertEquals(indexes.length, 4);
  
  // Composite primary key
  assertEquals(indexes[0].pk, true);
  assertEquals(indexes[0].columns.length, 2);
  
  // Single column index
  assertEquals(indexes[1].columns[0].name, "created_at");
  
  // Unique composite index
  assertEquals(indexes[2].unique, true);
  assertEquals(indexes[2].columns.length, 2);
  
  // Named index
  assertEquals(indexes[3].name, "idx_booking_date");
});

Deno.test("Standard DBML - Relationships", () => {
  const dbml = `
    Table users {
      id integer [pk]
    }
    
    Table posts {
      id integer [pk]
      user_id integer [ref: > users.id]
      parent_id integer
    }
    
    Table tags {
      id integer [pk]
    }
    
    Table post_tags {
      post_id integer
      tag_id integer
    }
    
    Ref: posts.parent_id > posts.id
    Ref posts_tags: post_tags.post_id > posts.id
    Ref: post_tags.tag_id > tags.id [delete: cascade, update: cascade]
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  // Inline ref
  const inlineRef = schema.tables[1].columns[1].ref;
  assertEquals(inlineRef?.type, ">");
  assertEquals(inlineRef?.to.table, "users");
  assertEquals(inlineRef?.to.column, "id");
  
  // Standalone refs
  assertEquals(schema.refs.length, 3);
  
  // Self-referencing
  assertEquals(schema.refs[0].from.table, "posts");
  assertEquals(schema.refs[0].to.table, "posts");
  
  // Named ref
  assertEquals(schema.refs[1].name, "posts_tags");
  
  // Ref with actions
  assertEquals(schema.refs[2].onDelete, "cascade");
  assertEquals(schema.refs[2].onUpdate, "cascade");
});

Deno.test("Standard DBML - Enums", () => {
  const dbml = `
    enum job_status {
      created [note: 'Job created']
      running
      done
      failure [note: 'Job failed']
    }
    
    Table jobs {
      id integer [pk]
      status job_status [not null]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.enums.length, 1);
  const enumDef = schema.enums[0];
  assertEquals(enumDef.name, "job_status");
  assertEquals(enumDef.values.length, 4);
  assertEquals(enumDef.values[0].name, "created");
  assertEquals(enumDef.values[0].note, "Job created");
  assertEquals(enumDef.values[3].note, "Job failed");
});

Deno.test("Standard DBML - Table groups", () => {
  const dbml = `
    Table users {
      id integer [pk]
    }
    
    Table merchants {
      id integer [pk]
    }
    
    Table products {
      id integer [pk]
    }
    
    TableGroup e_commerce {
      users
      merchants
      products
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.tableGroups.length, 1);
  const group = schema.tableGroups[0];
  assertEquals(group.name, "e_commerce");
  assertEquals(group.tables.length, 3);
  assertEquals(group.tables, ["users", "merchants", "products"]);
});

Deno.test("Standard DBML - Notes at different levels", () => {
  const dbml = `
    Table users {
      id integer [pk, note: 'Primary key']
      email varchar [note: '''
        User email address
        Must be unique
      ''']
      
      note: 'Main users table'
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const table = schema.tables[0];
  assertEquals(table.note, "Main users table");
  assertEquals(table.columns[0].note, "Primary key");
  assertEquals(table.columns[1].note?.includes("User email address"), true);
  assertEquals(table.columns[1].note?.includes("Must be unique"), true);
});

Deno.test("Standard DBML - Table aliases", () => {
  const dbml = `
    Table users as U {
      id integer [pk]
      name varchar
    }
    
    Table posts as P {
      id integer [pk]  
      author_id integer [ref: > U.id]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.tables[0].alias, "U");
  assertEquals(schema.tables[1].alias, "P");
});

Deno.test("Standard DBML - Array types", () => {
  const dbml = `
    Table products {
      id integer [pk]
      tags varchar[]
      prices integer[]
      metadata jsonb[]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const columns = schema.tables[0].columns;
  assertEquals(columns[1].type, "varchar[]");
  assertEquals(columns[2].type, "integer[]");
  assertEquals(columns[3].type, "jsonb[]");
});

Deno.test("Standard DBML - Parameterized types", () => {
  const dbml = `
    Table products {
      id serial [pk]
      name varchar(255) [not null]
      price decimal(10,2)
      description varchar(1000)
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const columns = schema.tables[0].columns;
  assertEquals(columns[1].type, "varchar(255)");
  assertEquals(columns[2].type, "decimal(10,2)");
  assertEquals(columns[3].type, "varchar(1000)");
});

Deno.test("Standard DBML - Comments", () => {
  const dbml = `
    // This is a single line comment
    Table users {
      id integer [pk] // Primary key
      /* Multi-line comment
         describing the email field */
      email varchar [unique]
    }
    
    /* Another multi-line
       comment */
    Table posts {
      id integer [pk]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  // Comments should be ignored and not affect parsing
  assertEquals(schema.tables.length, 2);
  assertEquals(schema.tables[0].name, "users");
  assertEquals(schema.tables[1].name, "posts");
});

Deno.test("Standard DBML - Default values", () => {
  const dbml = `
    Table users {
      id integer [pk, increment]
      status varchar [default: 'active']
      score integer [default: 0]
      created_at timestamp [default: \`now()\`]
      is_verified boolean [default: false]
      balance decimal [default: 100.50]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const columns = schema.tables[0].columns;
  assertEquals(columns[0].increment, true);
  assertEquals(columns[1].default, "active");
  assertEquals(columns[2].default, 0);
  const defaultVal3 = columns[3].default;
  assertEquals(typeof defaultVal3, 'object');
  assertEquals((defaultVal3 as any)?.value, "now()");
  assertEquals(columns[4].default, false);
  assertEquals(columns[5].default, 100.50);
});

Deno.test("Standard DBML - All relationship types", () => {
  const dbml = `
    Table users {
      id integer [pk]
    }
    
    Table profiles {
      id integer [pk]
      user_id integer
    }
    
    Table posts {
      id integer [pk]
      author_id integer
    }
    
    Table tags {
      id integer [pk]
    }
    
    Table post_tags {
      post_id integer
      tag_id integer
    }
    
    Ref: profiles.user_id - users.id // one-to-one
    Ref: posts.author_id > users.id  // many-to-one
    Ref: users.id < posts.author_id  // one-to-many
    Ref: post_tags.(post_id, tag_id) <> posts.(id, id) // many-to-many
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.refs[0].refType, "-");
  assertEquals(schema.refs[1].refType, ">");
  assertEquals(schema.refs[2].refType, "<");
  assertEquals(schema.refs[3].refType, "<>");
});

Deno.test("Standard DBML - HeaderColor", () => {
  const dbml = `
    Table users {
      id integer [pk]
      name varchar
      
      headercolor: #3498db
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.tables[0].headerColor, "#3498db");
});

Deno.test("Standard DBML - Complex real-world example", () => {
  const dbml = `
    Project shop_db {
      database_type: 'PostgreSQL'
      note: 'E-commerce database'
    }
    
    enum order_status {
      pending
      processing
      shipped
      delivered
      cancelled
    }
    
    Table customers {
      id integer [pk, increment]
      email varchar(255) [unique, not null]
      name varchar(100) [not null]
      created_at timestamp [default: \`now()\`]
      
      indexes {
        email [unique]
        (name, created_at)
      }
      
      note: 'Customer information'
    }
    
    Table orders as O {
      id integer [pk, increment]
      customer_id integer [ref: > customers.id, not null]
      status order_status [default: 'pending']
      total decimal(10,2) [not null]
      created_at timestamp [default: \`now()\`]
      
      indexes {
        customer_id
        (status, created_at)
      }
    }
    
    Table order_items {
      order_id integer [ref: > O.id]
      product_id integer [ref: > products.id]
      quantity integer [not null, default: 1]
      price decimal(10,2) [not null]
      
      indexes {
        (order_id, product_id) [pk]
      }
    }
    
    Table products {
      id integer [pk, increment]
      name varchar(255) [not null]
      description text
      price decimal(10,2) [not null]
      tags varchar[]
      
      headercolor: #27ae60
    }
    
    TableGroup shop {
      customers
      orders  
      order_items
      products
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  // Verify complete parsing
  assertEquals(schema.name, "shop_db");
  assertEquals(schema.tables.length, 4);
  assertEquals(schema.enums.length, 1);
  assertEquals(schema.tableGroups.length, 1);
  
  // Verify relationships are properly parsed
  const orderItems = schema.tables[2];
  assertEquals(orderItems.columns[0].ref?.to.table, "O");
  assertEquals(orderItems.columns[1].ref?.to.table, "products");
});