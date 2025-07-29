# Home Assistant History MCP Server

A secure, containerized Model Context Protocol (MCP) server that provides LLMs with access to Home Assistant historical data and statistics.

[![Build and Publish](https://github.com/jtenniswood/ha-history-mcp/actions/workflows/build-and-publish.yml/badge.svg)](https://github.com/jtenniswood/ha-history-mcp/actions/workflows/build-and-publish.yml)
[![Test and Validate](https://github.com/jtenniswood/ha-history-mcp/actions/workflows/test.yml/badge.svg)](https://github.com/jtenniswood/ha-history-mcp/actions/workflows/test.yml)
[![Docker Pulls](https://img.shields.io/github/packages/jtenniswood/ha-history-mcp?label=Docker%20Pulls)](https://github.com/jtenniswood/ha-history-mcp/pkgs/container/ha-history-mcp)

## Features

- **Historical Data Access**: Retrieve detailed historical data for any Home Assistant entity
- **Long-term Statistics**: Access statistical summaries with configurable periods (hour/day/week/month)  
- **Entity Discovery**: List and search available entities
- **Logbook Integration**: Access Home Assistant logbook entries and events
- **Secure Docker Deployment**: Containerized with security best practices
- **Flexible Time Ranges**: Support for relative and absolute time specifications
- **Input Validation**: Comprehensive validation and error handling

## 🚀 Quick Start - Use the Public Container

### ⚡ One-Command Setup

```bash
# Replace with YOUR Home Assistant URL and token
docker run -d \
  --name ha-history-mcp \
  -e HA_URL="https://your-homeassistant.com" \
  -e HA_TOKEN="your-long-lived-access-token" \
  --restart unless-stopped \
  ghcr.io/jtenniswood/ha-history-mcp:latest
```

### 🐳 Docker Compose (Recommended)

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  ha-history-mcp:
    image: ghcr.io/jtenniswood/ha-history-mcp:latest
    container_name: ha-history-mcp-server
    restart: unless-stopped
    environment:
      - HA_URL=https://your-homeassistant.com
      - HA_TOKEN=your-long-lived-access-token
      - REQUEST_TIMEOUT=30
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
```

Then run:
```bash
# Edit the HA_URL and HA_TOKEN in docker-compose.yml first!
docker-compose up -d
```

### 🔧 Environment Variables

**Required:**
- `HA_URL` - Your Home Assistant URL (e.g., `https://homeassistant.local:8123`)
- `HA_TOKEN` - Your Home Assistant long-lived access token

**Optional:**
- `REQUEST_TIMEOUT` - API timeout in seconds (default: 30)

## 📦 Available Images

The project publishes multi-architecture Docker images to GitHub Container Registry:

- **Latest stable**: `ghcr.io/jtenniswood/ha-history-mcp:latest`
- **Specific version**: `ghcr.io/jtenniswood/ha-history-mcp:v1.0.0`
- **Development**: `ghcr.io/jtenniswood/ha-history-mcp:edge`

**Supported architectures**: `linux/amd64`, `linux/arm64`

## 🔑 Creating a Home Assistant Token

1. Go to Home Assistant → Profile → Security
2. Scroll down to "Long-lived access tokens"
3. Click "Create Token"
4. Give it a name like "MCP History Server"
5. Copy the generated token and use it as `HA_TOKEN`

## 🖥️ MCP Client Configuration

### Claude Desktop

Add to your Claude Desktop configuration:

**Location**: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

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

### Continue.dev

```json
{
  "mcpServers": {
    "ha-history": {
      "command": "docker",
      "args": ["exec", "-i", "ha-history-mcp-server", "python", "src/ha_history_mcp_server.py"]
    }
  }
}
```

## 🧪 Test Your Setup

1. **Check container status:**
```bash
docker ps | grep ha-history-mcp
```

2. **View logs:**
```bash
docker logs ha-history-mcp-server
```

3. **Test Home Assistant connection:**
```bash
docker exec ha-history-mcp-server python -c "
import os, asyncio, httpx
async def test():
    url = os.getenv('HA_URL')
    token = os.getenv('HA_TOKEN')
    headers = {'Authorization': f'Bearer {token}'}
    async with httpx.AsyncClient() as client:
        response = await client.get(f'{url}/api/', headers=headers)
        print(f'✅ Connected! Status: {response.status_code}')
asyncio.run(test())
"
```

4. **Try in Claude Desktop:**
Ask Claude: *"Show me the temperature history for the last 24 hours"*

## 🛠️ Development Setup

For local development and contributions:

### 1. Clone and Setup

```bash
git clone https://github.com/jtenniswood/ha-history-mcp.git
cd ha-history-mcp

# Create environment file
cp env.example .env
# Edit .env with your Home Assistant details
```

### 2. Development with Docker

```bash
# Start development environment
docker-compose --profile dev up -d

# View logs
docker-compose logs -f ha-history-mcp-dev

# Stop development environment
docker-compose --profile dev down
```

### 3. Local Python Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run directly
python test_mcp_server.py

# Test Home Assistant connection
python test_connection.py
```

## 🧪 Testing

### Automated Tests

The project includes comprehensive GitHub Actions workflows:

- **Build & Publish**: Builds and publishes Docker images
- **Test & Validate**: Runs Python syntax checks and Docker tests
- **Security Scan**: Vulnerability scanning with Trivy

### Manual Testing

```bash
# Test with MCP Inspector
npx @modelcontextprotocol/inspector docker exec -i ha-history-mcp-server python src/ha_history_mcp_server.py

# Test container health
docker-compose ps
docker-compose logs ha-history-mcp
```

## 📊 Available Tools

The MCP server provides these tools to LLMs:

### `get_entity_history`
Retrieve detailed historical data for a specific entity.

**Parameters:**
- `entity_id` (required): Entity ID (e.g., `sensor.temperature`)
- `start_time` (optional): Start time (ISO format or relative like "1 hour ago")
- `end_time` (optional): End time (ISO format or relative)
- `minimal_response` (optional): Return minimal data to reduce payload

### `get_statistics`
Get long-term statistical data for entities.

**Parameters:**
- `entity_ids` (required): List of entity IDs
- `start_time` (optional): Start time for statistics
- `end_time` (optional): End time for statistics  
- `period` (optional): Statistical period (`5minute`, `hour`, `day`, `week`, `month`)
- `statistic_ids` (optional): Specific statistics to retrieve
- `units` (optional): Unit conversion

### `list_entities`
Discover available entities in Home Assistant.

**Parameters:**
- `domain` (optional): Filter by domain (e.g., `sensor`, `light`)
- `search` (optional): Search entities by name/ID
- `limit` (optional): Maximum number of entities to return

### `get_logbook_entries`
Retrieve Home Assistant logbook entries and events.

**Parameters:**
- `start_time` (optional): Start time for logbook entries
- `end_time` (optional): End time for logbook entries
- `entity_id` (optional): Filter by specific entity

## 🔐 Security

- **Non-root container execution**
- **Security options**: `no-new-privileges`
- **Resource limits**: Memory and CPU constraints
- **Token-based authentication** with Home Assistant
- **Input validation** for all parameters
- **Vulnerability scanning** in CI/CD pipeline

## 📋 Production Deployment

For production use:

1. **Use specific version tags** instead of `latest`
2. **Set resource limits** appropriate for your environment
3. **Configure log rotation**
4. **Monitor container health**
5. **Keep tokens secure** and rotate regularly

```yaml
# Production docker-compose.yml example
version: '3.8'
services:
  ha-history-mcp:
    image: ghcr.io/jtenniswood/ha-history-mcp:v1.0.0  # Specific version
    restart: unless-stopped
    environment:
      - HA_URL=${HA_URL}
      - HA_TOKEN=${HA_TOKEN}
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.25'
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test them
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/jtenniswood/ha-history-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jtenniswood/ha-history-mcp/discussions)
- **Documentation**: Check the [Wiki](https://github.com/jtenniswood/ha-history-mcp/wiki)

## 🎯 Roadmap

- [ ] WebSocket support for real-time data
- [ ] Advanced filtering and aggregation
- [ ] Integration with Home Assistant add-ons
- [ ] Grafana dashboard examples
- [ ] InfluxDB export capabilities
