#!/usr/bin/env bun
/**
 * CORA CLI - Terminalwire-compatible client
 *
 * A Bun-based CLI that connects to the CORA server via WebSocket
 * using the Terminalwire protocol (MessagePack over WebSocket).
 */

import { connect } from "./client";
import { handleResource } from "./resources";

// Build-time constants injected by Bun
declare const API_URL: string;
declare const BUILD_VERSION: string;

async function main() {
  const args = process.argv.slice(2);

  // Handle version flag locally (with JSON support for agents)
  if (args.includes("--version") || args.includes("-v")) {
    if (args.includes("--format") && args.includes("json")) {
      console.log(JSON.stringify({ version: BUILD_VERSION }));
    } else {
      console.log(`cora ${BUILD_VERSION}`);
    }
    process.exit(0);
  }

  // Handle help flag locally
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    console.log(`
CORA CLI v${BUILD_VERSION}

Usage:
  cora login [--token TOKEN]    Authenticate with API token
  cora logout                   Clear session
  cora whoami [--format json]   Show current user
  cora status [--format json]   Show account status
  cora open                     Open dashboard in browser
  cora prime [--format json]    Output agent instructions
  cora context                  Output context for AI agents
  cora todo <subcommand>        Manage todos

Agent-Native Flags:
  --format json                 Output as JSON (for automation)

Environment:
  CORA_API_TOKEN                Stateless auth (skips login)

Exit Codes:
  0  Success
  1  General error
  2  Authentication required
  3  Connection failed
  4  Server error

Run 'cora <command> --help' for more information.
    `.trim());
    process.exit(0);
  }

  // Connect and run
  let exitCode = 0;

  const send = await connect(
    API_URL,
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
    console.error(`Failed to connect to CORA server: ${err.message}`);
    process.exit(3);
  });

  // Send initialization message
  send({
    event: "initialization",
    protocol: { version: BUILD_VERSION },
    entitlement: {
      authority: new URL(API_URL).hostname,
      schemes: [{ scheme: "https" }, { scheme: "http" }],
      paths: [{ location: "~/.cora/**/*", mode: 0o600 }],
      environment_variables: [{ name: "CORA_API_TOKEN" }, { name: "HOME" }],
    },
    program: {
      name: "cora",
      arguments: args,
    },
  });
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error.message }));
  process.exit(1);
});
