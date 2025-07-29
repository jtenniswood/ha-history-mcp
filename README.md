# Home Assistant History MCP Server

Connect Claude Desktop to your Home Assistant historical data and statistics.

[![Build and Publish](https://github.com/jtenniswood/ha-history-mcp/actions/workflows/build-and-publish.yml/badge.svg)](https://github.com/jtenniswood/ha-history-mcp/actions/workflows/build-and-publish.yml)

## Setup

### 1. Get Your Home Assistant Token

1. Go to Home Assistant → Profile → Security
2. Create a "Long-lived access token"
3. Copy the token

### 2. Configure Claude Desktop

Add this to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ha-history": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-e", "HA_URL=https://your-homeassistant.com",
        "-e", "HA_TOKEN=your-long-lived-access-token",
        "ghcr.io/jtenniswood/ha-history-mcp:latest"
      ]
    }
  }
}
```

**Replace:**
- `https://your-homeassistant.com` → Your Home Assistant URL
- `your-long-lived-access-token` → Your Home Assistant token

### 3. Restart Claude Desktop

### 4. Test It

Ask Claude: *"What entities are available in my Home Assistant?"*

## What You Can Ask

- *"Show me the temperature history for the last 24 hours"*
- *"What sensors are available in my Home Assistant?"*
- *"Get daily temperature statistics for the past month"*
- *"What events happened in the last hour?"*

## Troubleshooting

**Docker not found?** → Install [Docker Desktop](https://docs.docker.com/get-docker/)

**Connection issues?** → Check your Home Assistant URL and token are correct

**Still not working?** → Try running this test:
```bash
docker run --rm -i \
  -e HA_URL="https://your-homeassistant.com" \
  -e HA_TOKEN="your-token" \
  ghcr.io/jtenniswood/ha-history-mcp:latest
```

## How It Works

- Claude Desktop runs a fresh Docker container with your credentials
- Container connects to your Home Assistant
- Your data stays local (never sent to external services)
- Container is automatically removed after each use

## License

MIT License - see [LICENSE](LICENSE) file.
