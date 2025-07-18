/**
 * Tests for advanced PostgreSQL features:
 * - Generated columns
 * - Check constraints
 * - Table-level constraints
 * - Named constraints
 * - Exclude constraints
 * - Deferrable constraints
 */

import { assertEquals } from "@std/assert";
import { Parser } from "../src/parser.ts";

Deno.test("Generated columns - GENERATED ALWAYS AS STORED", () => {
  const dbml = `
    Table people {
      id bigint [pk]
      height_cm numeric
      height_in numeric [generated always as \`height_cm / 2.54\` stored]
      weight_kg numeric
      weight_lb numeric [generated always as \`weight_kg * 2.20462\` stored]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const columns = schema.tables[0].columns;
  assertEquals(columns[2].name, "height_in");
  assertEquals(columns[2].generatedExpression, "height_cm / 2.54");
  assertEquals(columns[2].generatedStored, true);
  
  assertEquals(columns[4].name, "weight_lb");
  assertEquals(columns[4].generatedExpression, "weight_kg * 2.20462");
  assertEquals(columns[4].generatedStored, true);
});

Deno.test("Column-level CHECK constraints", () => {
  const dbml = `
    Table products {
      id serial [pk]
      name text [not null]
      price numeric [check \`price > 0\`]
      discount_price numeric [check \`discount_price < price\`]
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const columns = schema.tables[0].columns;
  assertEquals(columns[2].check, "price > 0");
  assertEquals(columns[3].check, "discount_price < price");
});

Deno.test("Table-level constraints", () => {
  const dbml = `
    Table orders {
      id bigserial [pk]
      product_id bigint [not null]
      quantity integer [not null]
      price numeric [not null]
      
      constraints {
        check \`quantity > 0\`
        check \`price > 0\`
        unique (product_id, created_at)
      }
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const table = schema.tables[0];
  assertEquals(table.constraints?.length, 3);
  
  assertEquals(table.constraints![0].type, "check");
  assertEquals(table.constraints![0].expression, "quantity > 0");
  
  assertEquals(table.constraints![1].type, "check");
  assertEquals(table.constraints![1].expression, "price > 0");
  
  assertEquals(table.constraints![2].type, "unique");
  assertEquals(table.constraints![2].columns, ["product_id", "created_at"]);
});

Deno.test("Named constraints", () => {
  const dbml = `
    Table users {
      id uuid [pk]
      email text [unique]
      age integer
      
      constraints {
        constraint check_adult check \`age >= 18\`
        constraint unique_email unique (email)
        constraint pk_users primary key (id)
      }
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const constraints = schema.tables[0].constraints!;
  
  assertEquals(constraints[0].name, "check_adult");
  assertEquals(constraints[0].type, "check");
  assertEquals(constraints[0].expression, "age >= 18");
  
  assertEquals(constraints[1].name, "unique_email");
  assertEquals(constraints[1].type, "unique");
  
  assertEquals(constraints[2].name, "pk_users");
  assertEquals(constraints[2].type, "primary_key");
  assertEquals(constraints[2].columns, ["id"]);
});

Deno.test("EXCLUDE constraints", () => {
  const dbml = `
    Table room_reservations {
      id serial [pk]
      room_id integer [not null]
      during tsrange [not null]
      
      constraints {
        exclude using gist (room_id with =)
        constraint no_overlap exclude using gist (during with &&)
      }
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const constraints = schema.tables[0].constraints!;
  
  assertEquals(constraints[0].type, "exclude");
  assertEquals(constraints[0].using, "gist");
  assertEquals(constraints[0].columns, ["room_id"]);
  assertEquals(constraints[0].withOperator, "=");
  
  assertEquals(constraints[1].name, "no_overlap");
  assertEquals(constraints[1].type, "exclude");
  assertEquals(constraints[1].using, "gist");
  assertEquals(constraints[1].columns, ["during"]);
  assertEquals(constraints[1].withOperator, "&&");
});

Deno.test("Deferrable constraints", () => {
  const dbml = `
    Table transactions {
      id bigserial [pk]
      account_id bigint [not null]
      amount numeric [not null]
      
      constraints {
        check \`amount != 0\` [deferrable, initially deferred]
        unique (account_id, created_at) [not deferrable]
        constraint balance_check check \`get_balance(account_id) >= 0\` [deferrable, initially immediate]
      }
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const constraints = schema.tables[0].constraints!;
  
  assertEquals(constraints[0].deferrable, true);
  assertEquals(constraints[0].initiallyDeferred, true);
  
  assertEquals(constraints[1].deferrable, false);
  
  assertEquals(constraints[2].name, "balance_check");
  assertEquals(constraints[2].deferrable, true);
  assertEquals(constraints[2].initiallyDeferred, false);
});

Deno.test("Mixed advanced features", () => {
  const dbml = `
    Table inventory {
      id bigserial [generated always as identity, pk]
      product_id bigint [not null]
      quantity integer [not null, check \`quantity >= 0\`]
      unit_price numeric [not null]
      total_value numeric [generated always as \`quantity * unit_price\` stored]
      last_updated kinstant [default: \`kjson_now()\`]
      
      constraints {
        constraint positive_price check \`unit_price > 0\`
        unique (product_id)
        constraint inventory_pk primary key (id)
      }
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const table = schema.tables[0];
  
  // Check identity column
  assertEquals(table.columns[0].identityGeneration, "always");
  assertEquals(table.columns[0].pk, true);
  
  // Check column with check constraint
  assertEquals(table.columns[2].check, "quantity >= 0");
  
  // Check generated column
  assertEquals(table.columns[4].generatedExpression, "quantity * unit_price");
  assertEquals(table.columns[4].generatedStored, true);
  
  // Check table constraints
  assertEquals(table.constraints?.length, 3);
  assertEquals(table.constraints![0].name, "positive_price");
  assertEquals(table.constraints![2].name, "inventory_pk");
});

Deno.test("Case insensitive parsing of new keywords", () => {
  const dbml = `
    Table test {
      id integer [GENERATED ALWAYS AS IDENTITY]
      computed numeric [Generated Always As \`id * 2\` Stored]
      value numeric [CHECK \`value > 0\`]
      
      CONSTRAINTS {
        CONSTRAINT check_positive CHECK \`value > 0\`
        EXCLUDE USING gist (id WITH =) [DEFERRABLE, INITIALLY DEFERRED]
      }
    }
  `;

  const parser = new Parser();
  const schema = parser.parse(dbml);

  const table = schema.tables[0];
  assertEquals(table.columns[0].identityGeneration, "always");
  assertEquals(table.columns[1].generatedExpression, "id * 2");
  assertEquals(table.columns[2].check, "value > 0");
  assertEquals(table.constraints?.length, 2);
  assertEquals(table.constraints![1].deferrable, true);
  assertEquals(table.constraints![1].initiallyDeferred, true);
});