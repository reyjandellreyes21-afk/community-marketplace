/**
 * HTTP / API surface — re-exports the shared client used across the app.
 * Prefer importing from here in new code for a stable “services” boundary.
 */
export { apiRequest, isUnauthorizedApiError } from "../lib/appApi.js";
