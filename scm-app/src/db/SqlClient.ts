import { Config, ConfigError, Effect, Layer } from "effect";
import type * as SqlClient from "@effect/sql/SqlClient";
import type * as SqlError from "@effect/sql/SqlError";
import * as PgClient from "@effect/sql-pg/PgClient";
import type { PgClient as PgClientType } from "@effect/sql-pg/PgClient";
import type { DomainError } from "../domain/errors.js";
import { mapSqlError } from "../domain/errors.js";

export const Sql = PgClient.PgClient;
export type { PgClient } from "@effect/sql-pg/PgClient";

const dbConfigLive = Config.all({
  url: Config.redacted("DATABASE_URL"),
  minConnections: Config.integer("DB_MIN_CONNECTIONS").pipe(Config.withDefault(2)),
  maxConnections: Config.integer("DB_MAX_CONNECTIONS").pipe(Config.withDefault(10)),
});

const snakeToCamel = (str: string): string =>
  str.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase());

const camelToSnake = (str: string): string =>
  str.replace(/[A-Z]/g, (letter: string) => `_${letter.toLowerCase()}`);

export const DbLive: Layer.Layer<
  PgClientType | SqlClient.SqlClient,
  ConfigError.ConfigError | SqlError.SqlError
> = PgClient.layerConfig({
  url: Config.map(dbConfigLive, (config) => config.url),
  minConnections: Config.map(dbConfigLive, (config) => config.minConnections),
  maxConnections: Config.map(dbConfigLive, (config) => config.maxConnections),
  transformQueryNames: Config.succeed(camelToSnake),
  transformResultNames: Config.succeed(snakeToCamel),
});

export const callProcedure = (
  sql: PgClientType,
  procName: string,
  params: ReadonlyArray<unknown>
): Effect.Effect<void, DomainError> => {
  const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
  const query = `CALL ${procName}(${placeholders})`;

  return sql.unsafe(query, params as any).pipe(
    Effect.asVoid,
    Effect.mapError((error) => mapSqlError(error))
  );
};

export const queryView = <T>(
  sql: PgClientType,
  viewName: string,
  whereClause?: string,
  params?: ReadonlyArray<unknown>
): Effect.Effect<ReadonlyArray<T>, DomainError> => {
  const query = whereClause
    ? `SELECT * FROM ${viewName} WHERE ${whereClause}`
    : `SELECT * FROM ${viewName}`;

  return sql.unsafe(query, params as any).pipe(
    Effect.map((rows) => rows as ReadonlyArray<T>),
    Effect.mapError((error) => mapSqlError(error))
  );
};
