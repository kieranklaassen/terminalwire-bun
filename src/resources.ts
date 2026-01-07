/**
 * Resource handlers for Terminalwire protocol
 *
 * Implements all 7 resource types in a single file:
 * - stdout/stderr: output text
 * - stdin: read input
 * - file: read/write/delete files
 * - directory: list/create/delete directories
 * - browser: open URLs
 * - environment_variable: read env vars
 */

import { existsSync } from "node:fs";
import { mkdir, rmdir, chmod } from "node:fs/promises";
import { spawn } from "bun";
import { validatePath, readEnvVar } from "./security";

type Params = Record<string, unknown>;

export interface ResourceResponse {
  event: "resource";
  name: string;
  status: "success" | "failure";
  response: unknown;
  [key: string]: unknown; // Index signature for Message compatibility
}

/**
 * Handle a resource command from the server.
 */
export async function handleResource(
  name: string,
  command: string,
  params: Params
): Promise<ResourceResponse> {
  try {
    const response = await dispatch(name, command, params);
    // Explicitly convert undefined to null for msgpack compatibility
    return { event: "resource", name, status: "success", response: response ?? null };
  } catch (error) {
    return {
      event: "resource",
      name,
      status: "failure",
      response: error instanceof Error ? error.message : String(error),
    };
  }
}

async function dispatch(
  name: string,
  cmd: string,
  p: Params
): Promise<unknown> {
  const key = `${name}.${cmd}`;

  switch (key) {
    // stdout/stderr
    case "stdout.print":
    case "stderr.print":
      process.stdout.write(p.data as string);
      return null;
    case "stdout.print_line":
    case "stderr.print_line":
      console.log(p.data);
      return null;

    // stdin
    case "stdin.read_line":
      for await (const line of console) return line;
      return "";
    case "stdin.read_password":
      return readPassword();

    // file (with security validation)
    case "file.read":
      return Bun.file(validatePath(p.path as string)).text();
    case "file.write": {
      const writePath = validatePath(p.path as string);
      await Bun.write(writePath, p.content as string);
      if (p.mode) await chmod(writePath, p.mode as number);
      return (p.content as string).length;
    }
    case "file.append": {
      const appendPath = validatePath(p.path as string);
      const existing = existsSync(appendPath)
        ? await Bun.file(appendPath).text()
        : "";
      await Bun.write(appendPath, existing + (p.content as string));
      return (p.content as string).length;
    }
    case "file.delete":
      await Bun.file(validatePath(p.path as string)).unlink();
      return 1;
    case "file.exist":
      try {
        validatePath(p.path as string);
        return existsSync(validatePath(p.path as string));
      } catch {
        return false;
      }
    case "file.change_mode":
      await chmod(validatePath(p.path as string), p.mode as number);
      return 0;

    // directory
    case "directory.list": {
      const glob = new Bun.Glob(validatePath(p.path as string));
      const matches: string[] = [];
      for await (const f of glob.scan(".")) matches.push(f);
      return matches;
    }
    case "directory.create": {
      const dirPath = validatePath(p.path as string);
      await mkdir(dirPath, { recursive: true });
      return [dirPath];
    }
    case "directory.exist":
      try {
        return existsSync(validatePath(p.path as string));
      } catch {
        return false;
      }
    case "directory.delete":
      await rmdir(validatePath(p.path as string));
      return 1;

    // browser
    case "browser.launch": {
      const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
      spawn([openCmd, p.url as string], {
        stdout: "ignore",
        stderr: "ignore",
      }).unref();
      return null;
    }

    // environment variable (with security validation)
    case "environment_variable.read":
      return readEnvVar(p.name as string);

    default:
      throw new Error(`Unknown resource command: ${key}`);
  }
}

/**
 * Read a password from stdin without echoing.
 */
async function readPassword(): Promise<string> {
  const readline = await import("readline");

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    let password = "";

    const handler = (chunk: Buffer) => {
      const char = chunk.toString();

      if (char === "\r" || char === "\n") {
        // Enter pressed - done
        console.log();
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdin.off("data", handler);
        rl.close();
        resolve(password);
      } else if (char === "\x7f" || char === "\b") {
        // Backspace
        password = password.slice(0, -1);
      } else if (char === "\x03") {
        // Ctrl+C
        process.exit(1);
      } else {
        // Regular character
        password += char;
      }
    };

    process.stdin.on("data", handler);
  });
}
