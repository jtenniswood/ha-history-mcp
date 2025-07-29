# Deployment Guide

This guide covers different deployment scenarios for the Home Assistant History MCP Server.

## Quick Deployment

### Using GitHub Container Registry (Recommended)

The easiest way to deploy is using the pre-built images from GitHub Container Registry:

```bash
# Simple deployment
docker run -d \
  --name ha-history-mcp \
  -e HA_URL="https://your-homeassistant.com" \
  -e HA_TOKEN="your-long-lived-access-token" \
  ghcr.io/jtenniswood/ha-history-mcp:latest
```

### Using Docker Compose

1. **Download the deployment files:**
```bash
mkdir ha-history-mcp && cd ha-history-mcp
curl -O https://github.com/jtenniswood/ha-history-mcp/releases/latest/download/docker-compose.example.yml
mv docker-compose.example.yml docker-compose.yml
```

2. **Create environment file:**
```bash
cat > .env << EOF
HA_URL=https://your-homeassistant.com
HA_TOKEN=your-long-lived-access-token
REQUEST_TIMEOUT=30
EOF
```

3. **Deploy:**
```bash
docker-compose up -d
```

## Production Deployment

### Docker Swarm

```yaml
# docker-stack.yml
version: '3.8'

services:
  ha-history-mcp:
    image: ghcr.io/jtenniswood/ha-history-mcp:v1.0.0
    environment:
      - HA_URL=${HA_URL}
      - HA_TOKEN=${HA_TOKEN}
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 256M
          cpus: '0.25'
        reservations:
          memory: 128M
          cpus: '0.1'
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    networks:
      - mcp-network

networks:
  mcp-network:
    driver: overlay
```

Deploy with:
```bash
docker stack deploy -c docker-stack.yml ha-history-mcp
```

### Kubernetes

```yaml
# k8s-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ha-history-mcp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ha-history-mcp
  template:
    metadata:
      labels:
        app: ha-history-mcp
    spec:
      containers:
      - name: ha-history-mcp
        image: ghcr.io/jtenniswood/ha-history-mcp:v1.0.0
        env:
        - name: HA_URL
          valueFrom:
            secretKeyRef:
              name: ha-secrets
              key: url
        - name: HA_TOKEN
          valueFrom:
            secretKeyRef:
              name: ha-secrets
              key: token
        resources:
          limits:
            memory: "256Mi"
            cpu: "250m"
          requests:
            memory: "128Mi"
            cpu: "100m"
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
          allowPrivilegeEscalation: false
---
apiVersion: v1
kind: Secret
metadata:
  name: ha-secrets
type: Opaque
stringData:
  url: "https://your-homeassistant.com"
  token: "your-long-lived-access-token"
```

Deploy with:
```bash
kubectl apply -f k8s-deployment.yml
```

## MCP Client Integration

### Claude Desktop

Update your Claude configuration file:

**Location**: 
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%/Claude/claude_desktop_config.json`

**Configuration**:
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

### VS Code with Continue.dev

Add to your Continue configuration:

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

## Monitoring and Maintenance

### Health Checks

```bash
# Check container status
docker ps | grep ha-history-mcp

# View logs
docker logs ha-history-mcp-server

# Test API connectivity
docker exec ha-history-mcp-server python -c "
import os, asyncio, httpx
async def test():
    url = os.getenv('HA_URL')
    token = os.getenv('HA_TOKEN')
    headers = {'Authorization': f'Bearer {token}'}
    async with httpx.AsyncClient() as client:
        response = await client.get(f'{url}/api/', headers=headers)
        print(f'Status: {response.status_code}')
asyncio.run(test())
"
```

### Log Rotation

Add to your `docker-compose.yml`:

```yaml
services:
  ha-history-mcp:
    # ... other config
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Backup Configuration

```bash
# Backup configuration
tar -czf ha-history-mcp-backup-$(date +%Y%m%d).tar.gz \
  docker-compose.yml .env

# Backup with exclusions
tar --exclude='.env' -czf ha-history-mcp-config.tar.gz \
  docker-compose.yml README.md
```

## Troubleshooting

### Common Issues

1. **Container won't start**
   ```bash
   # Check logs
   docker logs ha-history-mcp-server
   
   # Verify environment variables
   docker exec ha-history-mcp-server env | grep HA_
   ```

2. **Can't connect to Home Assistant**
   ```bash
   # Test connectivity
   docker exec ha-history-mcp-server curl -I $HA_URL
   
   # Verify token
   docker exec ha-history-mcp-server curl -H "Authorization: Bearer $HA_TOKEN" $HA_URL/api/
   ```

3. **High memory usage**
   ```bash
   # Check container stats
   docker stats ha-history-mcp-server
   
   # Adjust memory limits in docker-compose.yml
   ```

### Performance Tuning

- Use specific image tags instead of `latest`
- Set appropriate resource limits
- Enable Docker BuildKit for faster builds
- Use multi-stage builds for smaller images

## Security Considerations

### Network Security

```yaml
# Isolated network
version: '3.8'
services:
  ha-history-mcp:
    # ... config
    networks:
      - isolated-network

networks:
  isolated-network:
    driver: bridge
    internal: true
```

### Secrets Management

```bash
# Use Docker secrets (Swarm mode)
echo "your-ha-token" | docker secret create ha_token -

# Reference in stack file
version: '3.8'
services:
  ha-history-mcp:
    secrets:
      - ha_token
    environment:
      - HA_TOKEN_FILE=/run/secrets/ha_token

secrets:
  ha_token:
    external: true
```

### Regular Updates

```bash
# Update to latest version
docker-compose pull
docker-compose up -d

# Update to specific version
sed -i 's/:latest/:v1.1.0/' docker-compose.yml
docker-compose up -d
```

## Migration Guide

### From Local Build to Registry Image

1. **Backup current setup**
2. **Update docker-compose.yml**:
   ```yaml
   # Change from:
   build: .
   
   # To:
   image: ghcr.io/jtenniswood/ha-history-mcp:latest
   ```
3. **Redeploy**:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

### Version Upgrades

1. **Check release notes** for breaking changes
2. **Backup configuration and data**
3. **Update image tag** in docker-compose.yml
4. **Test in staging environment** first
5. **Deploy to production**

---

For additional support, see the [main README](README.md) or open an issue on GitHub.