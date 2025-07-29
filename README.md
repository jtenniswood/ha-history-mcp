# Home Assistant History MCP Server

A secure, containerized Model Context Protocol (MCP) server that provides LLMs with access to Home Assistant historical data and statistics.

## Features

- **Historical Data Access**: Retrieve detailed historical data for any Home Assistant entity
- **Long-term Statistics**: Access statistical summaries with configurable periods (hour/day/week/month)  
- **Entity Discovery**: List and search available entities
- **Logbook Integration**: Access Home Assistant logbook entries and events
- **Secure Docker Deployment**: Containerized with security best practices
- **Flexible Time Ranges**: Support for relative and absolute time specifications
- **Input Validation**: Comprehensive validation and error handling

## Quick Start

### 1. Clone and Setup

```bash
git clone <your-repo>
cd ha-history-mcp
```

### 2. Configure Environment

Create a `.env` file with your Home Assistant details:

```bash
# Home Assistant Configuration
HA_URL=https://homeassistant.tenniswoodnetwork.co.uk
HA_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiIyZDc3MDgxOTBiZjA0OWRiOGFmOGM4MWFjNzJjY2M0OSIsImlhdCI6MTc1Mzc5OTQ0MSwiZXhwIjoyMDY5MTU5NDQxfQ.nUv5VEhZtrixMzOwoJozP03ZwgZh4Y4LGHUuJJ7mTWE

# Optional Configuration
REQUEST_TIMEOUT=30
LOG_LEVEL=INFO
```

### 3. Deploy with Docker Compose

```bash
docker-compose up -d
```

### 4. Test the Server

```bash
# Check if container is running
docker-compose ps

# View logs
docker-compose logs -f ha-history-mcp
```

## Available Tools

### `get_entity_history`
Retrieve detailed historical data for entities.

**Parameters:**
- `entity_id` (required): Entity ID (e.g., 'sensor.temperature')
- `hours_back` (optional): Hours back from now (default: 24)
- `start_time` (optional): Start time in YYYY-MM-DD or ISO format
- `end_time` (optional): End time in YYYY-MM-DD or ISO format
- `minimal_response` (optional): Return minimal data (default: true)

### `get_entity_statistics`
Get long-term statistical data.

**Parameters:**
- `entity_id` (required): Entity ID
- `days_back` (optional): Days back from now (default: 7)
- `start_time` (optional): Start time
- `end_time` (optional): End time
- `period` (optional): 'hour', 'day', 'week', 'month' (default: 'hour')

### `get_available_entities`
List available entities with filtering.

**Parameters:**
- `domain_filter` (optional): Filter by domain (e.g., 'sensor')
- `search_term` (optional): Search term for entity names
- `limit` (optional): Maximum results (default: 100)

### `get_logbook_entries`
Access logbook entries and events.

**Parameters:**
- `hours_back` (optional): Hours back from now (default: 24)
- `start_time` (optional): Start time
- `end_time` (optional): End time
- `entity_id` (optional): Filter by specific entity
- `limit` (optional): Maximum entries (default: 50)

## Usage with MCP Clients

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

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

### VS Code MCP Configuration

Add to your `.vscode/mcp.json`:

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

### Example Queries

- "Show me the temperature history for the last 3 days"
- "What sensors have changed in the last hour?"
- "Get energy usage statistics for this week"
- "Show logbook entries for the front door sensor today"

## Security Features

- **Non-root container execution**
- **Resource limits and security policies**
- **Input validation and sanitization**
- **Secure token handling via environment variables**
- **Read-only operations only**
- **Network isolation**

## API Endpoints

The server implements the following Home Assistant API endpoints:

- `/api/history/period` - Historical entity data
- `/api/history/statistics` - Long-term statistics
- `/api/states` - Current entity states
- `/api/logbook` - Event logbook entries

## Time Format Support

The server supports multiple time formats:

- `YYYY-MM-DD` (e.g., "2024-01-15")
- `YYYY-MM-DD HH:MM:SS` (e.g., "2024-01-15 14:30:00")
- `YYYY-MM-DDTHH:MM:SS` (e.g., "2024-01-15T14:30:00")
- ISO 8601 format with timezone

## Troubleshooting

### Check Container Status
```bash
docker-compose ps
docker-compose logs ha-history-mcp
```

### Test Home Assistant Connection
```bash
docker-compose exec ha-history-mcp python -c "
import os, asyncio, httpx
async def test():
    url = os.getenv('HA_URL')
    token = os.getenv('HA_TOKEN')
    headers = {'Authorization': f'Bearer {token}'}
    async with httpx.AsyncClient() as client:
        response = await client.get(f'{url}/api/', headers=headers)
        print(f'Status: {response.status_code}')
        print(f'Response: {response.text}')
asyncio.run(test())
"
```

### Common Issues

1. **Authentication Error**: Verify your `HA_TOKEN` is correct and active
2. **Connection Error**: Check `HA_URL` and network connectivity
3. **Permission Error**: Ensure token has necessary permissions
4. **Container Health Check Failed**: Check logs and environment variables

## Development

### Local Development
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export HA_URL="https://homeassistant.tenniswoodnetwork.co.uk"
export HA_TOKEN="your_token_here"

# Run server
python src/ha_history_mcp_server.py
```

### Testing with MCP Inspector
```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Test the server
npx @modelcontextprotocol/inspector python src/ha_history_mcp_server.py
```

### Building Custom Docker Image
```bash
# Build image
docker build -t ha-history-mcp:latest .

# Run container
docker run -it --env-file .env ha-history-mcp:latest
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Client    │───▶│  MCP Server     │───▶│ Home Assistant  │
│  (Claude, etc.) │    │   (Docker)      │    │    REST API     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Components

- **FastMCP**: Python MCP framework for tool handling
- **httpx**: Async HTTP client for Home Assistant API calls
- **Pydantic**: Data validation and serialization
- **Docker**: Containerization with security best practices

## Configuration Reference

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `HA_URL` | Home Assistant base URL | - | Yes |
| `HA_TOKEN` | Long-lived access token | - | Yes |
| `REQUEST_TIMEOUT` | API request timeout (seconds) | 30 | No |
| `LOG_LEVEL` | Logging level | INFO | No |

### Docker Compose Configuration

The Docker Compose setup includes:

- Resource limits (512M memory, 0.5 CPU)
- Health checks
- Security policies
- Custom network isolation
- Log rotation

## Performance Considerations

- Use `minimal_response=true` for better performance on large datasets
- Limit time ranges for statistics queries
- Consider using `limit` parameter for entity lists
- Monitor container resource usage

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review Docker and MCP logs
3. Verify Home Assistant API connectivity
4. Open an issue with detailed information

---

**Built with security and performance in mind for production MCP deployments.**