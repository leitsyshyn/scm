import { config } from "dotenv";
import { NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { PgMigrator } from "@effect/sql-pg";
import { fileURLToPath } from "node:url";
import { DbLive } from "../src/db/SqlClient.js";
import { NodeContext } from "@effect/platform-node";

config();

const program = Effect.gen(function* () {
  yield* Console.log("Starting database migration...\n");
  
  const migrations = yield* PgMigrator.run({
    loader: PgMigrator.fromFileSystem(
      fileURLToPath(new URL("../migrations", import.meta.url))
    ),
    table: "public.effect_sql_migrations",
    schemaDirectory: "migrations"
  });
  
  yield* Console.log(`Migrations completed successfully!`);
  yield* Console.log(`   Total migrations applied: ${migrations.length}\n`);
  
  if (migrations.length > 0) {
    yield* Console.log("Applied migrations:");
    for (const [id, name] of migrations) {
      yield* Console.log(`  - [${id}] ${name}`);
    }
  } else {
    yield* Console.log("No new migrations to apply - database is up to date.");
  }
});

NodeRuntime.runMain(
  program.pipe(
    Effect.provide(DbLive),
    Effect.provide(NodeContext.layer)
  )
);
