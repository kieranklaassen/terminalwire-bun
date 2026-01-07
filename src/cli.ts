#!/usr/bin/env bun
/**
 * Terminalwire Bun Client
 *
 * A Bun-based client for connecting to any Terminalwire server.
 * Can be compiled with different app names and default URLs.
 */

import { connect } from "./client";
import { handleResource } from "./resources";

// Build-time constants injected by Bun (with defaults for dev mode)
declare const DEFAULT_URL: string;
declare const BUILD_VERSION: string;
declare const APP_NAME: string;

// Use build-time constants or defaults
const appName = typeof APP_NAME !== "undefined" ? APP_NAME : "terminalwire";
const defaultUrl = typeof DEFAULT_URL !== "undefined" ? DEFAULT_URL : "ws://localhost:3000/terminal";
const version = typeof BUILD_VERSION !== "undefined" ? BUILD_VERSION : "dev";

async function main() {
  const args = process.argv.slice(2);

  // Handle version flag locally (with JSON support for agents)
  if (args.includes("--version") || args.includes("-v")) {
    if (args.includes("--format") && args.includes("json")) {
      console.log(JSON.stringify({ version }));
    } else {
      console.log(`${appName} ${version}`);
    }
    process.exit(0);
  }

  // Handle help flag locally
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    console.log(`
${appName.toUpperCase()} CLI v${version}

Usage:
  ${appName} <command> [options]

Common Commands:
  login                         Authenticate with the server
  logout                        Clear session
  whoami [--format json]        Show current user

Options:
  --format json                 Output as JSON (for automation)
  --help, -h                    Show this help
  --version, -v                 Show version

Environment:
  TERMINALWIRE_URL              Override server URL (default: ${defaultUrl})

Exit Codes:
  0  Success
  1  General error
  2  Authentication required
  3  Connection failed
  4  Server error
    `.trim());
    process.exit(0);
  }

  // Allow URL override via environment variable
  const url = process.env.TERMINALWIRE_URL || defaultUrl;

  // Connect and run
  let exitCode = 0;

  const send = await connect(
    url,
    async (msg) => {
      if (msg.event === "resource") {
        const response = await handleResource(
          msg.name as string,
          msg.command as string,
          (msg.parameters as Record<string, unknown>) || {}
        );
        send(response);
      } else if (msg.event === "exit") {
        exitCode = msg.status as number;
      }
    },
    (code) => {
      // WebSocket close code 1000 means normal closure
      process.exit(exitCode || (code === 1000 ? 0 : 1));
    }
  ).catch((err) => {
    console.error(`Failed to connect: ${err.message}`);
    process.exit(3);
  });

  // Send initialization message
  send({
    event: "initialization",
    protocol: { version },
    entitlement: {
      authority: new URL(url).hostname,
      schemes: [{ scheme: "https" }, { scheme: "http" }],
      paths: [{ location: "~/.terminalwire/**/*", mode: 0o600 }],
      environment_variables: [{ name: "TERMINALWIRE_URL" }, { name: "HOME" }],
    },
    program: {
      name: appName,
      arguments: args,
    },
  });
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error.message }));
  process.exit(1);
});
