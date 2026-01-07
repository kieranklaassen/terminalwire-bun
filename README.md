# terminalwire-bun

A Bun-based [Terminalwire](https://terminalwire.com) client. Build standalone CLI binaries for any Terminalwire server.

## Features

- **Standalone binaries** - No runtime dependencies, ~57MB per platform
- **Cross-platform** - macOS (ARM64/x64) and Linux (ARM64/x64)
- **Configurable** - Compile with your app name and server URL
- **Secure** - Path allowlist, env var allowlist, no arbitrary code execution

## Quick Start

```bash
# Install dependencies
bun install

# Build for your Terminalwire app
APP_NAME=myapp DEFAULT_URL=wss://myapp.com/terminal bun run build
```

## Building for Your App

The client is configured at compile time. Set these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_NAME` | CLI name (e.g., `myapp`) | `terminalwire` |
| `DEFAULT_URL` | Server WebSocket URL | `wss://example.com/terminal` |
| `RELEASE` | Set to `true` for release builds | - |

### Example: Build for CORA

```bash
# Production build
bun run build:cora

# Local development build
bun run build:cora-local
```

### Example: Build for Your App

```bash
# Single platform (current)
bun build --compile --minify \
  --define BUILD_VERSION='"1.0.0"' \
  --define DEFAULT_URL='"wss://myapp.com/terminal"' \
  --define APP_NAME='"myapp"' \
  ./src/cli.ts --outfile ./dist/myapp

# All platforms
APP_NAME=myapp DEFAULT_URL=wss://myapp.com/terminal bun run build
```

## Runtime Configuration

Users can override the server URL at runtime:

```bash
TERMINALWIRE_URL=ws://localhost:3000/terminal myapp login
```

## Security

The client enforces strict security:

- **Path allowlist**: Only `~/.terminalwire/` (or `TERMINALWIRE_HOME`) is accessible
- **Env var allowlist**: Only `HOME`, `TERMINALWIRE_HOME`, `TERMINALWIRE_URL` can be read
- **No shell execution**: Resource handlers don't execute arbitrary commands

## Protocol

Implements the [Terminalwire protocol](https://terminalwire.com):

- WebSocket transport with `ws` subprotocol
- MessagePack encoding
- Resource types: stdout, stderr, stdin, file, directory, browser, environment_variable

## License

MIT
