#!/bin/bash
set -e

echo "🏠 Home Assistant MCP Server Setup"
echo "=================================="

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Home Assistant Configuration
HA_URL=https://homeassistant.tenniswoodnetwork.co.uk
HA_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiIyZDc3MDgxOTBiZjA0OWRiOGFmOGM4MWFjNzJjY2M0OSIsImlhdCI6MTc1Mzc5OTQ0MSwiZXhwIjoyMDY5MTU5NDQxfQ.nUv5VEhZtrixMzOwoJozP03ZwgZh4Y4LGHUuJJ7mTWE

# Optional Configuration
REQUEST_TIMEOUT=30
LOG_LEVEL=INFO
EOF
    echo "✅ Created .env file with Home Assistant configuration"
else
    echo "ℹ️  .env file already exists, skipping creation"
fi

echo ""
echo "🐳 Building Docker container..."
docker-compose build

echo ""
echo "🚀 Starting MCP server..."
docker-compose up -d

echo ""
echo "⏳ Waiting for container to start..."
sleep 10

echo ""
echo "🔍 Checking container status..."
docker-compose ps

echo ""
echo "📋 Container logs:"
docker-compose logs --tail=20 ha-history-mcp

echo ""
echo "🧪 Testing Home Assistant connection..."
docker-compose exec -T ha-history-mcp python -c "
import os, asyncio, httpx
import sys

async def test_connection():
    try:
        url = os.getenv('HA_URL')
        token = os.getenv('HA_TOKEN')
        
        print(f'Testing connection to: {url}')
        print(f'Using token: {token[:20]}...')
        
        headers = {'Authorization': f'Bearer {token}'}
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f'{url}/api/', headers=headers)
            
            if response.status_code == 200:
                print('✅ Successfully connected to Home Assistant!')
                print('🎉 MCP Server is ready to use!')
                return True
            else:
                print(f'❌ Connection failed: HTTP {response.status_code}')
                print(f'Response: {response.text}')
                return False
                
    except Exception as e:
        print(f'❌ Connection error: {str(e)}')
        return False

result = asyncio.run(test_connection())
sys.exit(0 if result else 1)
"

echo ""
echo "📖 Setup complete! Next steps:"
echo ""
echo "1. 🔧 Configure your MCP client (Claude Desktop, VS Code, etc.)"
echo "2. 📚 See README.md for client configuration examples"
echo "3. 🐛 If issues occur, check logs with: docker-compose logs -f ha-history-mcp"
echo ""
echo "Available MCP Tools:"
echo "- get_entity_history: Get historical data for entities"
echo "- get_entity_statistics: Get long-term statistics"  
echo "- get_available_entities: List and search entities"
echo "- get_logbook_entries: Get logbook events"
echo ""
echo "Example queries:"
echo "- 'Show me temperature sensor history for the last 24 hours'"
echo "- 'Get energy usage statistics for this week'"
echo "- 'List all available sensors'"