/**
 * Build script for Terminalwire Bun Client
 *
 * Cross-compiles for all supported platforms:
 * - darwin-arm64 (macOS Apple Silicon)
 * - darwin-x64 (macOS Intel)
 * - linux-x64 (Linux x86_64)
 * - linux-arm64 (Linux ARM64)
 *
 * Environment variables:
 * - APP_NAME: Name of the CLI (default: "terminalwire")
 * - DEFAULT_URL: Default server URL (default: "wss://example.com/terminal")
 * - RELEASE: Set to "true" for release builds
 */

import { $ } from "bun";

const targets = [
  { target: "bun-darwin-arm64", suffix: "darwin-arm64" },
  { target: "bun-darwin-x64", suffix: "darwin-x64" },
  { target: "bun-linux-x64", suffix: "linux-x64" },
  { target: "bun-linux-arm64", suffix: "linux-arm64" },
];

// Get configuration from environment
const appName = process.env.APP_NAME || "terminalwire";
const defaultUrl = process.env.DEFAULT_URL || "wss://example.com/terminal";
const isRelease = process.env.RELEASE === "true";

// Get version from git tags or use default
const version = (
  await $`git describe --tags 2>/dev/null || echo "1.0.0"`.text()
).trim();

console.log(`Building ${appName} v${version} (${isRelease ? "release" : "dev"})`);
console.log(`Default URL: ${defaultUrl}`);
console.log();

// Create dist directory
await $`mkdir -p dist`;

for (const { target, suffix } of targets) {
  console.log(`Building for ${target}...`);

  // Build command with all flags
  const buildArgs = [
    "bun",
    "build",
    "--compile",
    `--target=${target}`,
    "--minify",
    `--define`,
    `BUILD_VERSION='"${version}"'`,
    `--define`,
    `DEFAULT_URL='"${defaultUrl}"'`,
    `--define`,
    `APP_NAME='"${appName}"'`,
    "./src/cli.ts",
    `--outfile`,
    `./dist/${appName}-${suffix}`,
  ];

  // Dev builds get sourcemaps for debugging
  if (!isRelease) {
    buildArgs.splice(5, 0, "--sourcemap=linked");
  }

  const result = await Bun.spawn(buildArgs, {
    stdout: "inherit",
    stderr: "inherit",
  });

  await result.exited;

  if (result.exitCode !== 0) {
    console.error(`Failed to build for ${target}`);
    process.exit(1);
  }
}

// Create tarballs for release
console.log("\nPackaging...");
for (const { suffix } of targets) {
  await $`tar -czvf dist/${suffix}.tar.gz -C dist ${appName}-${suffix}`;
}

// Show results
console.log("\nBuild complete!");
await $`ls -lh dist/`;

// Create checksums if this is a release
if (isRelease) {
  console.log("\nCreating checksums...");
  await $`cd dist && sha256sum *.tar.gz > checksums.txt`;
  console.log("Checksums written to dist/checksums.txt");
}
