# Home Assistant MCP

Connect Claude Desktop to your complete Home Assistant system with both historical data analysis and real-time control.

## Quick Install

### Desktop Extension (Claude Desktop)
1. **Download** the `home-assistant-mcp.dxt` file from [GitHub Releases](https://github.com/jtenniswood/home-assistant-mcp/releases/latest)
2. **Double-click** the `.dxt` file to install in Claude Desktop  
3. **Configure** with your Home Assistant details:
   - **URL**: Your HA instance (e.g., `https://homeassistant.local:8123`)
   - **Token**: Create a long-lived access token in HA Settings > Profile > Security

### Docker Container (Other MCP Clients)

#### Using Pre-built Image (Recommended)
```bash
# Using Docker Compose
version: '3.8'
services:
  home-assistant-mcp:
    image: ghcr.io/jtenniswood/home-assistant-mcp:latest
    ports:
      - "3000:3000"
    environment:
      - HA_URL=https://homeassistant.local:8123
      - HA_TOKEN=your-long-lived-token
      - TRANSPORT=http

# Using Docker directly
docker run -p 3000:3000 \
  -e HA_URL="https://homeassistant.local:8123" \
  -e HA_TOKEN="your-token" \
  -e TRANSPORT=http \
  ghcr.io/jtenniswood/home-assistant-mcp:latest
```

#### Building Locally
```bash
# Clone and build
git clone https://github.com/jtenniswood/home-assistant-mcp.git
cd home-assistant-mcp
docker-compose up -d
```

**MCP Endpoint**: `http://localhost:3000/sse`  
**Health Check**: `http://localhost:3000/health`

## What You Can Do

- **Control devices**: *"Turn on the living room lights"* 
- **Check status**: *"What's the current temperature in the bedroom?"*
- **View history**: *"Show me energy usage for the past week"*
- **Manage automations**: *"List my automations and their last trigger times"*
- **Search entities**: *"Find all temperature sensors"*
- **System monitoring**: *"Check my Home Assistant error log"*

## Features

### 📊 **Historical Data**
Query entity history, statistics, and logbook entries

### 🎛️ **Real-time Control** 
Get current states and control any device or service

### 🔧 **System Management**
Access version info, error logs, restart services

### 🤖 **Automation Support**
List, debug, and get guidance on automations

### 🔍 **Smart Search**
Find entities by name, domain, or attributes

## Getting Your Token

1. Go to **Home Assistant → Settings → Profile → Security**
2. Scroll to **"Long-lived access tokens"**
3. Click **"Create Token"** and name it "Claude MCP"
4. **Copy the token** and use it in your configuration

## Available Images

| Platform | Registry | Image |
|----------|----------|-------|
| **Docker Hub** | `docker.io` | `jtenniswood/home-assistant-mcp:latest` |
| **GitHub** | `ghcr.io` | `ghcr.io/jtenniswood/home-assistant-mcp:latest` |

All images support both `linux/amd64` and `linux/arm64` architectures.

## Development

```bash
# Clone repository
git clone https://github.com/jtenniswood/home-assistant-mcp.git
cd home-assistant-mcp

# Install dependencies
npm install

# Run locally (stdio mode)
export HA_URL="https://homeassistant.local:8123"
export HA_TOKEN="your-token"
npm start

# Run in HTTP mode
export TRANSPORT=http
npm start
```

## Troubleshooting

- **Connection issues?** → Verify your HA URL and token
- **Permission errors?** → Check token has sufficient privileges
- **Can't install?** → Make sure you have Claude Desktop installed
- **Docker health check failing?** → Verify HA_URL and HA_TOKEN environment variables

## Technical Details

- Built with Node.js and @modelcontextprotocol/sdk
- Connects via Home Assistant REST API
- Your data stays local (never sent to external services)
- MIT Licensed and open source
- Supports both stdio (Desktop Extension) and HTTP (Docker) transports
- Multi-architecture Docker images (amd64, arm64)

---

**Security Note**: This provides full Home Assistant control. Secure your token appropriately.
