# Knrog

Expose your local server to the internet with secure tunnels.

## Installation

```bash
npm install -g knrog
```

## Usage

```bash
# Basic usage - expose a local port
knrog <port>

# Example: expose localhost:3000
knrog 3000

# Use a custom server
knrog 3000 --server wss://api.knrog.online

# Request a specific subdomain
knrog 3000 --subdomain myapp

# Provide an API key directly
knrog 3000 --api-key YOUR_API_KEY
```

## Options

| Option | Description |
|--------|-------------|
| `-s, --server <url>` | Knrog server URL (default: `wss://api.knrog.online`) |
| `-k, --api-key <key>` | API Key for authentication |
| `-d, --subdomain <name>` | Request a specific subdomain |
| `-h, --help` | Display help |

## Authentication

On first use, Knrog will:
1. Open your browser to register/login
2. Automatically save your API key to `~/.knrog/config.json`

You can also provide an API key manually using the `--api-key` option.

## Configuration

Knrog stores configuration in `~/.knrog/config.json`:

```json
{
  "apiKey": "your-api-key",
  "lastSubdomain": "your-last-subdomain"
}
```

## License

MIT
