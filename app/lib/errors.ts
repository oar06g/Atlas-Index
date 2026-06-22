export function getErrorMessage(error: unknown): string {
  if (error instanceof AggregateError) {
    const details = error.errors.map((e) =>
      e instanceof Error ? e.message : String(e)
    );
    return details.join("; ") || "Service unavailable - connection refused";
  }
  if (error instanceof Error) {
    if ("code" in error && (error as { code: unknown }).code === "ECONNREFUSED") {
      return "Service unavailable - connection refused";
    }
    if (error.message) return error.message;
  }
  return String(error);
}
