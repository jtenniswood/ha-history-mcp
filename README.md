<div align="center">
  <img src="docs/logo.png" alt="Home Assistant Logo" width="500">
</div>

This MCP server improves on other tools by allowing access to historical data from Home Assistant to help you build out rich automations using AI tools such as Claude Desktop, Claude Code, Cursor and many more.

## Quick Install

### For Claude Desktop

1. **Download** the `home-assistant-mcp.dxt` file from [GitHub Releases](https://github.com/jtenniswood/home-assistant-mcp/releases/latest)
2. **Double-click** the `.dxt` file to install in Claude Desktop  
3. **Configure** with your Home Assistant details:
   - **URL**: Your HA instance (e.g., `https://homeassistant.local:8123`)
   - **Token**: Create a long-lived access token in HA Settings > Profile > Security


### For Cursor IDE (and most other clients)

1. **Add to Cursor settings** - In your Cursor MCP settings, add:
```json
{
  "mcp": {
    "servers": {
      "home-assistant": {
        "command": "docker",
        "args": [
          "run", "--rm", "-i",
          "-e", "HA_URL=https://homeassistant.local:8123",
          "-e", "HA_TOKEN=your-long-lived-token",
          "-e", "TRANSPORT=stdio",
          "ghcr.io/jtenniswood/home-assistant-mcp:latest"
        ]
      }
    }
  }
}
```
2. **Update your credentials** in the JSON above
3. **Restart Cursor** to load the MCP server


## What You Can Do

- **Control devices**: *"Turn on the living room lights"* 
- **Check status**: *"What's the current temperature in the bedroom?"*
- **View history**: *"Show me energy usage for the past week"*
- **Manage automations**: *"List my automations and their last trigger times"*
- **Search entities**: *"Find all temperature sensors"*
- **System monitoring**: *"Check my Home Assistant error log"*

## Getting Your Token

1. Go to **Home Assistant → Settings → Profile → Security**
2. Scroll to **"Long-lived access tokens"**
3. Click **"Create Token"** and name it "Claude MCP"
4. **Copy the token** and use it in your configuration

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
