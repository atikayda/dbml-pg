/**
 * Tests based on official DBML documentation examples
 * Source: https://github.com/holistics/dbml/blob/master/dbml-homepage/docs/docs.md
 */

import { assertEquals } from "@std/assert";
import { Parser } from "../src/parser.ts";

Deno.test("Official DBML - Basic table definition", () => {
  const dbml = `
    Table users {
      id integer
      username varchar
      role varchar
      created_at timestamp
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.tables.length, 1);
  assertEquals(schema.tables[0].name, "users");
  assertEquals(schema.tables[0].columns.length, 4);
});

Deno.test("Official DBML - Table with schema name", () => {
  const dbml = `
    Table ecommerce.users {
      id integer
      username varchar
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.tables[0].schema, "ecommerce");
  assertEquals(schema.tables[0].name, "users");
});

Deno.test("Official DBML - Table alias", () => {
  const dbml = `
    Table users as U {
      id integer
      username varchar
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.tables[0].alias, "U");
});

Deno.test("Official DBML - Column settings", () => {
  const dbml = `
    Table users {
      id integer [primary key]
      username varchar [not null, unique]
      role varchar [default: 'user']
      created_at timestamp [default: \`now()\`]
      updated_at timestamp [null]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const columns = schema.tables[0].columns;
  assertEquals(columns[0].pk, true);
  assertEquals(columns[1].notNull, true);
  assertEquals(columns[1].unique, true);
  assertEquals(columns[2].default, 'user');
  assertEquals(columns[4].notNull, false);
});

Deno.test("Official DBML - Default value variations", () => {
  const dbml = `
    Table users {
      role varchar [default: 'user']
      created_at timestamp [default: \`now()\`]
      age int [default: 18]
      is_active boolean [default: true]
      rating float [default: 5.0]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const columns = schema.tables[0].columns;
  assertEquals(columns[0].default, 'user');
  assertEquals((columns[1].default as any).value, 'now()');
  assertEquals(columns[2].default, 18);
  assertEquals(columns[3].default, true);
  assertEquals(columns[4].default, 5.0);
});

Deno.test("Official DBML - Inline references", () => {
  const dbml = `
    Table posts {
      id integer [primary key]
      user_id integer [ref: > users.id]
    }
    
    Table users {
      id integer [primary key]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const ref = schema.tables[0].columns[1].ref;
  assertEquals(ref?.type, ">");
  assertEquals(ref?.to.table, "users");
  assertEquals(ref?.to.column, "id");
});

Deno.test("Official DBML - Index definitions", () => {
  const dbml = `
    Table users {
      id integer
      email varchar
      created_at timestamp
      
      indexes {
        created_at [name: 'created_at_index']
        (id, email) [unique]
        email [type: hash]
      }
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const indexes = schema.tables[0].indexes;
  assertEquals(indexes.length, 3);
  assertEquals(indexes[0].name, 'created_at_index');
  assertEquals(indexes[1].unique, true);
  assertEquals(indexes[2].type, 'hash');
});

Deno.test("Official DBML - Enum definition", () => {
  const dbml = `
    enum user_role {
      admin
      moderator
      user
    }
    
    Table users {
      id integer
      role user_role
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.enums.length, 1);
  assertEquals(schema.enums[0].name, "user_role");
  assertEquals(schema.enums[0].values.length, 3);
});

Deno.test("Official DBML - Ref short form", () => {
  const dbml = `
    Table users {
      id integer
    }
    
    Table posts {
      id integer
      user_id integer
    }
    
    Ref: posts.user_id > users.id
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.refs.length, 1);
  assertEquals(schema.refs[0].from.table, "posts");
  assertEquals(schema.refs[0].from.column, "user_id");
  assertEquals(schema.refs[0].to.table, "users");
  assertEquals(schema.refs[0].to.column, "id");
});

Deno.test("Official DBML - Ref with settings", () => {
  const dbml = `
    Ref: posts.user_id > users.id [delete: cascade, update: cascade]
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.refs[0].onDelete, "cascade");
  assertEquals(schema.refs[0].onUpdate, "cascade");
});

Deno.test("Official DBML - Composite foreign keys", () => {
  const dbml = `
    Table merchant_periods {
      id integer
      merchant_id integer
      country_code varchar
    }
    
    Table merchants {
      id integer
      country_code varchar
    }
    
    Ref: merchant_periods.(merchant_id, country_code) > merchants.(id, country_code)
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const ref = schema.refs[0];
  assertEquals(ref.from.columns, ["merchant_id", "country_code"]);
  assertEquals(ref.to.columns, ["id", "country_code"]);
});

Deno.test("Official DBML - Multi-line notes", () => {
  const dbml = `
    Table users {
      id integer [note: 'User ID']
      status varchar [note: '''
        User status:
        - active
        - inactive  
        - suspended
      ''']
      
      note: '''
        This table contains user information
        Including authentication details
      '''
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const table = schema.tables[0];
  assertEquals(table.columns[0].note, 'User ID');
  assertEquals(table.columns[1].note?.includes('User status:'), true);
  assertEquals(table.note?.includes('This table contains'), true);
});

Deno.test("Official DBML - Table groups", () => {
  const dbml = `
    Table users {
      id integer
    }
    
    Table posts {
      id integer
    }
    
    TableGroup blog {
      users
      posts
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.tableGroups.length, 1);
  assertEquals(schema.tableGroups[0].name, "blog");
  assertEquals(schema.tableGroups[0].tables, ["users", "posts"]);
});

Deno.test("Official DBML - Project definition", () => {
  const dbml = `
    Project my_project {
      database_type: 'PostgreSQL'
      note: 'Description of the project'
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.project?.name, "my_project");
  assertEquals(schema.project?.database_type, "PostgreSQL");
  assertEquals(schema.project?.note, "Description of the project");
});

Deno.test("Official DBML - Comments", () => {
  const dbml = `
    // Table for storing user data
    Table users {
      id integer // primary identifier
      /* 
        Username must be unique
        across the system
      */
      username varchar
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  // Comments should be ignored
  assertEquals(schema.tables.length, 1);
  assertEquals(schema.tables[0].columns.length, 2);
});

Deno.test("Official DBML - Quoted identifiers", () => {
  const dbml = `
    Table "User Table" {
      "user id" integer
      "first name" varchar
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.tables[0].name, "User Table");
  assertEquals(schema.tables[0].columns[0].name, "user id");
  assertEquals(schema.tables[0].columns[1].name, "first name");
});

Deno.test("Official DBML - All relationship types", () => {
  const dbml = `
    Table users {
      id integer
    }
    
    Table posts {
      id integer
      user_id integer
    }
    
    Table profiles {
      id integer
      user_id integer
    }
    
    Table tags {
      id integer
    }
    
    Table post_tags {
      post_id integer
      tag_id integer
    }
    
    Ref: posts.user_id > users.id // many-to-one
    Ref: users.id < posts.user_id // one-to-many
    Ref: profiles.user_id - users.id // one-to-one
    Ref: post_tags.(post_id, tag_id) <> posts.(id, id) // many-to-many
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.refs[0].refType, ">");
  assertEquals(schema.refs[1].refType, "<");
  assertEquals(schema.refs[2].refType, "-");
  assertEquals(schema.refs[3].refType, "<>");
});

Deno.test("Official DBML - Complex index examples", () => {
  const dbml = `
    Table products {
      id integer
      name varchar
      merchant_id integer
      price decimal
      created_at datetime
      
      indexes {
        (merchant_id, created_at) [name: 'product_status']
        id [unique]
        created_at
      }
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const indexes = schema.tables[0].indexes;
  assertEquals(indexes[0].columns.length, 2);
  assertEquals(indexes[0].name, 'product_status');
  assertEquals(indexes[1].unique, true);
  assertEquals(indexes[2].columns[0].name, 'created_at');
});

Deno.test("Official DBML - HeaderColor", () => {
  const dbml = `
    Table users {
      id integer
      
      headercolor: #3498db
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  assertEquals(schema.tables[0].headerColor, '#3498db');
});

Deno.test("Official DBML - Nullable vs not null", () => {
  const dbml = `
    Table test {
      id integer [not null]
      optional_field varchar [null]
      required_field varchar [not null]
      default_nullable varchar
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const columns = schema.tables[0].columns;
  assertEquals(columns[0].notNull, true);
  assertEquals(columns[1].notNull, false);
  assertEquals(columns[2].notNull, true);
  assertEquals(columns[3].notNull, undefined);
});