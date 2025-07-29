#!/usr/bin/env python3
"""
Test script to verify Home Assistant API connectivity.
Run this to ensure your HA_URL and HA_TOKEN are working correctly.
"""
import asyncio
import os
import httpx

async def test_ha_connection():
    """Test Home Assistant API connection."""
    # Load environment variables
    ha_url = os.getenv("HA_URL", "").rstrip("/")
    ha_token = os.getenv("HA_TOKEN", "")
    
    if not ha_url or not ha_token:
        print("❌ HA_URL and HA_TOKEN environment variables are required")
        print("   Make sure you have a .env file with these values")
        return False
    
    print(f"🏠 Testing Home Assistant connection...")
    print(f"   URL: {ha_url}")
    print(f"   Token: {ha_token[:20]}...")
    
    headers = {
        "Authorization": f"Bearer {ha_token}",
        "Content-Type": "application/json"
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Test basic API
            print("\n📡 Testing basic API connection...")
            response = await client.get(f"{ha_url}/api/", headers=headers)
            
            if response.status_code == 200:
                print("✅ Basic API connection successful!")
                data = response.json()
                print(f"   Response: {data}")
                
                # Test states endpoint
                print("\n📊 Testing states endpoint...")
                response = await client.get(f"{ha_url}/api/states", headers=headers)
                if response.status_code == 200:
                    states = response.json()
                    entity_count = len(states)
                    print(f"✅ States endpoint successful! Found {entity_count} entities")
                    
                    # Show a few example entities
                    if entity_count > 0:
                        print("   Example entities:")
                        for i, state in enumerate(states[:5]):
                            entity_id = state.get("entity_id", "unknown")
                            friendly_name = state.get("attributes", {}).get("friendly_name", entity_id)
                            current_state = state.get("state", "unknown")
                            print(f"     {i+1}. {entity_id} ({friendly_name}): {current_state}")
                        if entity_count > 5:
                            print(f"     ... and {entity_count - 5} more entities")
                else:
                    print(f"❌ States endpoint failed: HTTP {response.status_code}")
                    
                # Test history endpoint  
                print("\n📈 Testing history endpoint...")
                response = await client.get(f"{ha_url}/api/history/period", headers=headers)
                if response.status_code == 200:
                    print("✅ History endpoint accessible!")
                else:
                    print(f"⚠️  History endpoint returned: HTTP {response.status_code}")
                    
                print("\n🎉 Home Assistant connection test completed successfully!")
                print("   Your MCP server should work correctly with these credentials.")
                return True
                
            else:
                print(f"❌ API connection failed: HTTP {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
    except httpx.ConnectError as e:
        print(f"❌ Connection error: {str(e)}")
        print("   Check that your HA_URL is correct and Home Assistant is accessible")
        return False
    except httpx.HTTPStatusError as e:
        print(f"❌ HTTP error: {e.response.status_code}")
        print(f"   Response: {e.response.text}")
        print("   Check that your HA_TOKEN is valid and has the necessary permissions")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return False

if __name__ == "__main__":
    # Load .env file if available
    try:
        from dotenv import load_dotenv
        load_dotenv()
        print("📄 Loaded environment from .env file")
    except ImportError:
        print("📄 No python-dotenv available, using system environment variables")
    except Exception:
        print("📄 Using system environment variables")
    
    # Run the test
    result = asyncio.run(test_ha_connection())
    exit(0 if result else 1)