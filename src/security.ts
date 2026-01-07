/**
 * Security module for Terminalwire Bun Client
 *
 * Provides path validation and environment variable allowlisting
 * to prevent path traversal attacks and unauthorized env access.
 */

import { resolve } from "node:path";

// Only allow reading these specific env vars
const ALLOWED_ENV_VARS = new Set([
  "HOME",
  "TERMINALWIRE_HOME", // Required by Terminalwire protocol
  "TERMINALWIRE_URL",  // URL override
]);

/**
 * Validates and normalizes a file path against the allowlist.
 * Prevents path traversal attacks.
 *
 * @param path - The path to validate (may include ~ for home or absolute path)
 * @returns The normalized absolute path
 * @throws Error if path is not in allowlist or contains traversal
 */
export function validatePath(path: string): string {
  const home = process.env.HOME;
  if (!home) {
    throw new Error("HOME environment variable not set");
  }

  // Expand ~ to home directory
  const expanded = path.replace(/^~/, home);

  // Resolve to absolute path
  const normalized = resolve(expanded);

  // Prevent path traversal - check for .. after normalization
  if (!normalized.startsWith(home)) {
    throw new Error(`Access denied: path must be within home directory`);
  }

  // Get the allowed directory from TERMINALWIRE_HOME or default to ~/.terminalwire
  const terminalwireHome = process.env.TERMINALWIRE_HOME || resolve(home, ".terminalwire");
  const allowedDir = resolve(terminalwireHome);

  if (!normalized.startsWith(allowedDir + "/") && normalized !== allowedDir) {
    throw new Error(`Access denied: ${path} is not in allowlist`);
  }

  return normalized;
}

/**
 * Reads an environment variable if it's in the allowlist.
 *
 * @param name - The env var name to read
 * @returns The env var value or undefined
 * @throws Error if env var is not in allowlist
 */
export function readEnvVar(name: string): string | undefined {
  if (!ALLOWED_ENV_VARS.has(name)) {
    throw new Error(`Environment variable not allowed: ${name}`);
  }
  return process.env[name];
}
