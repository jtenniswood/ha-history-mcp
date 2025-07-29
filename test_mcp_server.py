#!/usr/bin/env python3
"""
Local test script for the Home Assistant MCP Server.
This runs the server locally for testing without Docker.
"""
import os
import sys
import subprocess
import asyncio
from pathlib import Path

def setup_environment():
    """Set up the local environment for testing."""
    # Add the src directory to Python path
    src_path = Path(__file__).parent / "src"
    sys.path.insert(0, str(src_path))
    
    # Load environment variables from .env file
    env_file = Path(__file__).parent / ".env"
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value
        print("✅ Loaded environment from .env file")
    else:
        print("❌ .env file not found. Make sure you have HA_URL and HA_TOKEN set.")
        return False
    
    # Check required environment variables
    required_vars = ['HA_URL', 'HA_TOKEN']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        print(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        return False
    
    print(f"✅ Environment ready:")
    print(f"   HA_URL: {os.getenv('HA_URL')}")
    print(f"   HA_TOKEN: {os.getenv('HA_TOKEN', '')[:20]}...")
    return True

def install_dependencies():
    """Install required dependencies if not available."""
    try:
        import mcp
        import httpx
        import pydantic
        print("✅ All dependencies are available")
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Installing dependencies...")
        try:
            subprocess.check_call([
                sys.executable, "-m", "pip", "install", "-r", "requirements.txt"
            ])
            print("✅ Dependencies installed successfully")
            return True
        except subprocess.CalledProcessError:
            print("❌ Failed to install dependencies")
            print("Please run: pip install -r requirements.txt")
            return False

def test_local():
    """Test the MCP server locally."""
    print("\n🧪 Testing MCP Server Locally")
    print("=" * 50)
    
    if not setup_environment():
        return False
        
    if not install_dependencies():
        return False
    
    print("\n🚀 Starting MCP Server...")
    print("   (Press Ctrl+C to stop)")
    print("   Server will show startup logs and wait for MCP client connections")
    print()
    
    try:
        # Import and run the server
        from ha_history_mcp_server import mcp
        print("📡 MCP Server is running and ready for connections!")
        print("   You can now:")
        print("   1. Connect from Claude Desktop")
        print("   2. Connect from VS Code with MCP extension")
        print("   3. Use MCP Inspector: npx @modelcontextprotocol/inspector python test_mcp_server.py")
        print()
        
        # Run the server
        mcp.run(transport="stdio")
        
    except KeyboardInterrupt:
        print("\n👋 MCP Server stopped")
        return True
    except Exception as e:
        print(f"❌ Error running MCP server: {e}")
        return False

def test_with_inspector():
    """Show how to test with MCP Inspector."""
    print("\n🔍 Testing with MCP Inspector")
    print("=" * 50)
    print()
    print("1. Install MCP Inspector (if not already installed):")
    print("   npm install -g @modelcontextprotocol/inspector")
    print()
    print("2. Test the server:")
    print("   npx @modelcontextprotocol/inspector python test_mcp_server.py")
    print()
    print("3. This will open a web interface where you can:")
    print("   - See available tools")
    print("   - Test tool calls")
    print("   - View responses")
    print()

def test_with_docker():
    """Show how to test with Docker."""
    print("\n🐳 Testing with Docker")
    print("=" * 50)
    print()
    print("1. Build and start the container:")
    print("   docker-compose up -d")
    print()
    print("2. Test with MCP Inspector:")
    print("   npx @modelcontextprotocol/inspector docker exec -i ha-history-mcp-server python src/ha_history_mcp_server.py")
    print()
    print("3. View logs:")
    print("   docker-compose logs -f ha-history-mcp")
    print()
    print("4. Stop the container:")
    print("   docker-compose down")
    print()

def main():
    """Main function to choose test method."""
    print("🏠 Home Assistant MCP Server - Local Testing")
    print("=" * 60)
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "--help":
            print("Usage:")
            print("  python test_mcp_server.py           # Run server locally")
            print("  python test_mcp_server.py --help    # Show this help")
            print("  python test_mcp_server.py --docker  # Show Docker testing info")
            print("  python test_mcp_server.py --inspector # Show Inspector testing info")
            return
        elif sys.argv[1] == "--docker":
            test_with_docker()
            return
        elif sys.argv[1] == "--inspector":
            test_with_inspector()
            return
    
    # Default: run the server locally
    success = test_local()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()