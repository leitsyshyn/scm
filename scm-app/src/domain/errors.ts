import { Data } from "effect";

export type DomainError =
  | InsufficientStockError
  | NotFoundError
  | ConflictError
  | ValidationError
  | InfrastructureError;

export class InsufficientStockError extends Data.TaggedError("InsufficientStockError")<{
  readonly message: string;
  readonly warehouseId?: string;
  readonly productId?: string;
  readonly requested?: number;
  readonly available?: number;
}> {}

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly message: string;
  readonly entityType: string;
  readonly entityId?: string;
}> {}

export class ConflictError extends Data.TaggedError("ConflictError")<{
  readonly message: string;
  readonly constraint?: string;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly field?: string;
}> {}

export class InfrastructureError extends Data.TaggedError("InfrastructureError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export function mapSqlError(error: unknown): DomainError {
  const err = error as any;
  const code = err?.code;
  const message = err?.message || String(error);

  if (
    message.includes("Insufficient available qty") ||
    message.includes("insufficient stock") ||
    message.includes("not enough inventory")
  ) {
    return new InsufficientStockError({ message });
  }

  if (
    message.includes("exceeds ordered") ||
    message.includes("exceeds qty_ordered") ||
    code === "23514"
  ) {
    return new ValidationError({ message });
  }

  if (code === "23505" || code === "23P01") {
    return new ConflictError({
      message,
      constraint: err?.constraint,
    });
  }

  if (code === "23503") {
    return new NotFoundError({
      message,
      entityType: "referenced entity",
    });
  }

  if (code === "23502") {
    return new ValidationError({
      message,
      field: err?.column,
    });
  }

  return new InfrastructureError({
    message: `Database error: ${message}`,
    cause: error,
  });
}
