import { NodeContext } from "@effect/platform-node";
import { PgMigrator } from "@effect/sql-pg";
import type { MigrationError } from "@effect/sql/Migrator";
import type { SqlError } from "@effect/sql/SqlError";
import type { ConfigError } from "effect/ConfigError";
import { Layer } from "effect";
import { fileURLToPath } from "node:url";
import { DbLive } from "./SqlClient.js";

export const MigratorLive: Layer.Layer<
  never,
  SqlError | ConfigError | MigrationError,
  never
> = PgMigrator.layer({
  loader: PgMigrator.fromFileSystem(
    fileURLToPath(new URL("../../migrations", import.meta.url))
  ),
  table: "effect_sql_migrations",
  schemaDirectory: "migrations"
}).pipe(
  Layer.provide(DbLive),
  Layer.provide(NodeContext.layer)
);
