import type { PostgrestError } from "@supabase/supabase-js";

type ActionError = Pick<PostgrestError, "message" | "code"> | Error | { message?: string } | null | undefined;

export function friendlyActionError(error: ActionError): string {
  const message = error?.message ?? "";

  if (message.includes("schema cache")) {
    return "The database is missing the latest Aura fields. Please run npm run db:apply, then try again.";
  }

  if (message.includes("duplicate key")) {
    return "This record already exists. Please check the details and try again.";
  }

  if (message.includes("violates check constraint")) {
    return "One of the selected values is not allowed. Please check the form and try again.";
  }

  if (message.includes("violates not-null constraint")) {
    return "A required field is missing. Please complete the highlighted details and try again.";
  }

  return message || "Something went wrong. Please try again.";
}
