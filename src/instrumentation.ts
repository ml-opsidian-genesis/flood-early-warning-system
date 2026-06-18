import * as Sentry from "@sentry/nextjs";

// No-ops safely if SENTRY_DSN isn't set (e.g. local dev) -- same pattern
// as every other optional integration in this project.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
