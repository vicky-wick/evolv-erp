import type { SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/**
 * Supabase is optional. When both environment variables are present the app
 * authenticates against Supabase; otherwise it falls back to the local demo
 * password so the seeded workspace keeps working out of the box.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let clientPromise: Promise<SupabaseClient | null> | null = null;

/**
 * The SDK is only downloaded when Supabase auth is actually configured, so
 * the demo/landing bundle does not pay for it.
 */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null);

  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js")
      .then(({ createClient }) => {
        const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: "pkce",
          },
        });
        /* Debug handle for the browser console. */
        (window as unknown as Record<string, unknown>).__evolveSupabase = client;
        return client;
      })
      .catch((error) => {
        clientPromise = null;
        throw error;
      });
  }

  return clientPromise;
}

/** Turn Supabase auth errors into copy that fits the sign-in screen. */
export function authErrorMessage(error: unknown): string {
  const raw =
    typeof error === "object" && error && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");
  const message = raw.trim();
  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirm your email address before signing in.";
  }
  if (
    lower.includes("over_email_send_rate_limit") ||
    lower.includes("email rate limit")
  ) {
    return "Supabase's built-in email service has a small hourly limit and it's used up. Wait about an hour, or turn off \"Confirm email\" under Authentication → Sign In / Providers in the Supabase dashboard.";
  }
  if (lower.includes("email_address_not_authorized")) {
    return "Supabase's built-in email service only sends to your organization's team member addresses. Use a team email or set up custom SMTP in the Supabase dashboard.";
  }
  if (lower.includes("user already registered")) {
    return "An account already exists for that email. Try signing in instead, or reset your password.";
  }
  if (
    lower.includes("too many requests") ||
    lower.includes("over_request_rate_limit") ||
    lower.includes("rate limit")
  ) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed")
  ) {
    return "Cannot reach Supabase. Check your connection and the VITE_SUPABASE_URL value.";
  }
  if (lower.includes("user not found")) {
    return "No Supabase account exists for that email.";
  }
  return message || "Could not sign in. Please try again.";
}
