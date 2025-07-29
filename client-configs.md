# MCP Client Configuration Guide

This guide shows how to configure various MCP clients to connect to your Home Assistant MCP server.

## 🖥️ Claude Desktop Configuration

### Location
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### Configuration

#### Option A: Docker (Recommended)
```json
{
  "mcpServers": {
    "ha-history": {
      "command": "docker",
      "args": [
        "exec", "-i", "ha-history-mcp-server", 
        "python", "src/ha_history_mcp_server.py"
      ]
    }
  }
}
```

#### Option B: Python Script
```json
{
  "mcpServers": {
    "ha-history": {
      "command": "python",
      "args": [
        "/ABSOLUTE/PATH/TO/ha-history-mcp/test_mcp_server.py"
      ]
    }
  }
}
```

**Note**: Replace `/ABSOLUTE/PATH/TO/ha-history-mcp/` with your actual project path.

## 🆚 VS Code Configuration

### Location
Create `.vscode/mcp.json` in your project or workspace root.

### Configuration

#### Option A: Docker
```json
{
  "servers": {
    "ha-history": {
      "command": "docker",
      "args": [
        "exec", "-i", "ha-history-mcp-server",
        "python", "src/ha_history_mcp_server.py"
      ]
    }
  }
}
```

#### Option B: Python Script
```json
{
  "servers": {
    "ha-history": {
      "command": "python",
      "args": [
        "/ABSOLUTE/PATH/TO/ha-history-mcp/test_mcp_server.py"
      ]
    }
  }
}
```

## 🔧 Environment Setup

### For Docker Method
1. Ensure Docker container is running:
   ```bash
   cd /path/to/ha-history-mcp
   docker-compose up -d
   ```

2. Verify container is running:
   ```bash
   docker-compose ps
   ```

### For Python Method
1. Install dependencies:
   ```bash
   cd /path/to/ha-history-mcp
   pip install -r requirements.txt
   ```

2. Ensure `.env` file exists with your credentials:
   ```
   HA_URL=https://homeassistant.tenniswoodnetwork.co.uk
   HA_TOKEN=your_token_here
   ```

## 🧪 Testing Your Configuration

### Test with Claude Desktop
1. Start Claude Desktop
2. Look for the 🔧 tools icon in the interface
3. You should see "ha-history" server listed
4. Try asking: "What entities are available in my Home Assistant?"

### Test with VS Code
1. Open VS Code with the MCP extension
2. Check the MCP panel for connected servers
3. You should see "ha-history" listed as connected

## 📝 Example Queries

Once connected, try these example queries:

### Basic Entity Discovery
- "What sensors are available in my Home Assistant?"
- "List all the temperature sensors"
- "Show me the available light entities"

### Historical Data
- "Show me the temperature history for the last 24 hours"
- "Get the energy usage data for the past week"
- "What was the average temperature yesterday?"

### Statistics
- "Get daily temperature statistics for the past month"
- "Show me hourly energy consumption for today"
- "What are the temperature trends this week?"

### Logbook Queries
- "What events happened in the last hour?"
- "Show me door sensor activity today"
- "List recent motion sensor triggers"

## 🔍 Troubleshooting

### Claude Desktop Issues
1. **Server not appearing**: 
   - Check that the JSON syntax is valid
   - Verify the path is absolute, not relative
   - Restart Claude Desktop after configuration changes

2. **Connection fails**:
   - For Docker: Ensure container is running (`docker-compose ps`)
   - For Python: Check dependencies are installed
   - Verify `.env` file has correct credentials

### VS Code Issues
1. **MCP extension not loading**:
   - Install the MCP extension from the marketplace
   - Check that `.vscode/mcp.json` is in the right location

2. **Server connection errors**:
   - Check the VS Code output panel for MCP logs
   - Verify the command path is correct

### General Issues
1. **Environment variables not loading**:
   - Ensure `.env` file is in the project root
   - Check that HA_URL and HA_TOKEN are correctly set
   - Test with: `source .env && echo $HA_URL`

2. **Home Assistant connection fails**:
   - Verify your token is still valid in Home Assistant
   - Check that your Home Assistant URL is accessible
   - Test with: `curl -H "Authorization: Bearer $HA_TOKEN" "$HA_URL/api/"`

## 🛠️ Advanced Configuration

### Custom Port for HTTP Mode
If you want to run the server in HTTP mode instead of STDIO:

```json
{
  "mcpServers": {
    "ha-history": {
      "url": "http://localhost:8000/mcp"
    }
  }
}
```

Then start the server in HTTP mode:
```bash
docker-compose up -d
# Container will serve on port 8000
```

### Multiple Home Assistant Instances
You can configure multiple instances for different HA servers:

```json
{
  "mcpServers": {
    "ha-main": {
      "command": "docker",
      "args": ["exec", "-i", "ha-history-mcp-server", "python", "src/ha_history_mcp_server.py"],
      "env": {
        "HA_URL": "https://main.homeassistant.example.com",
        "HA_TOKEN": "token_for_main"
      }
    },
    "ha-backup": {
      "command": "docker", 
      "args": ["exec", "-i", "ha-history-mcp-server-2", "python", "src/ha_history_mcp_server.py"],
      "env": {
        "HA_URL": "https://backup.homeassistant.example.com",
        "HA_TOKEN": "token_for_backup"
      }
    }
  }
}
```