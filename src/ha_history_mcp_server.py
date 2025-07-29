import asyncio
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urljoin, quote

import httpx
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field

# Configure logging to stderr only (important for MCP STDIO)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# Initialize FastMCP server
mcp = FastMCP("home-assistant-history")

# Configuration from environment (allow import without credentials for testing)
HA_URL = os.getenv("HA_URL", "").rstrip("/")
HA_TOKEN = os.getenv("HA_TOKEN", "")
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))

def validate_environment():
    """Validate required environment variables."""
    if not HA_URL or not HA_TOKEN:
        raise ValueError("HA_URL and HA_TOKEN environment variables are required")

# Pydantic models for structured responses
class EntityHistoryResponse(BaseModel):
    """Response model for entity history data."""
    entity_id: str = Field(..., description="The entity ID")
    data_points: int = Field(..., description="Number of data points returned")
    start_time: str = Field(..., description="Start time of the data")
    end_time: str = Field(..., description="End time of the data")
    history: List[Dict[str, Any]] = Field(..., description="Historical data points")

class EntityStatisticsResponse(BaseModel):
    """Response model for entity statistics."""
    entity_id: str = Field(..., description="The entity ID")
    period: str = Field(..., description="Statistics period (hour/day)")
    start_time: str = Field(..., description="Start time of the statistics")
    end_time: str = Field(..., description="End time of the statistics") 
    statistics: List[Dict[str, Any]] = Field(..., description="Statistical data")

class EntitiesListResponse(BaseModel):
    """Response model for available entities."""
    total_entities: int = Field(..., description="Total number of entities")
    entities: List[Dict[str, str]] = Field(..., description="List of entities with their info")

class LogbookResponse(BaseModel):
    """Response model for logbook entries."""
    entry_count: int = Field(..., description="Number of logbook entries")
    start_time: str = Field(..., description="Start time of the logbook data")
    end_time: str = Field(..., description="End time of the logbook data")
    entries: List[Dict[str, Any]] = Field(..., description="Logbook entries")

class HomeAssistantClient:
    """Client for interacting with Home Assistant API."""
    
    def __init__(self, base_url: str, token: str, timeout: int = 30):
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        self.timeout = timeout

    async def _make_request(self, endpoint: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """Make an authenticated request to Home Assistant API."""
        url = urljoin(self.base_url, endpoint)
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                logger.info(f"Making request to: {url}")
                response = await client.get(url, headers=self.headers, params=params or {})
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"HTTP error {e.response.status_code}: {e.response.text}")
                raise ValueError(f"Home Assistant API error: {e.response.status_code} - {e.response.text}")
            except httpx.RequestError as e:
                logger.error(f"Request error: {str(e)}")
                raise ValueError(f"Failed to connect to Home Assistant: {str(e)}")
            except Exception as e:
                logger.error(f"Unexpected error: {str(e)}")
                raise ValueError(f"Unexpected error: {str(e)}")

    async def get_entity_history(
        self, 
        entity_id: str, 
        start_time: Optional[str] = None, 
        end_time: Optional[str] = None,
        minimal_response: bool = True
    ) -> List[Dict[str, Any]]:
        """Get historical data for a specific entity."""
        endpoint = "/api/history/period"
        
        if start_time:
            endpoint += f"/{quote(start_time)}"
        
        params = {
            "filter_entity_id": entity_id,
            "minimal_response": "true" if minimal_response else "false"
        }
        
        if end_time:
            params["end_time"] = end_time
            
        data = await self._make_request(endpoint, params)
        return data[0] if data and len(data) > 0 else []

    async def get_entity_statistics(
        self,
        entity_id: str,
        start_time: str,
        end_time: Optional[str] = None,
        period: str = "hour"
    ) -> Dict[str, Any]:
        """Get statistical data for entities (long-term statistics)."""
        endpoint = "/api/history/statistics"
        
        params = {
            "statistic_ids": entity_id,
            "start_time": start_time,
            "period": period
        }
        
        if end_time:
            params["end_time"] = end_time
            
        data = await self._make_request(endpoint, params)
        return data

    async def get_states(self) -> List[Dict[str, Any]]:
        """Get all current entity states."""
        endpoint = "/api/states"
        return await self._make_request(endpoint)

    async def get_logbook(
        self,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        entity_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get logbook entries."""
        endpoint = "/api/logbook"
        
        if start_time:
            endpoint += f"/{quote(start_time)}"
        
        params = {}
        if end_time:
            params["end_time"] = end_time
        if entity_id:
            params["entity"] = entity_id
            
        return await self._make_request(endpoint, params)

# Initialize Home Assistant client
ha_client = HomeAssistantClient(HA_URL, HA_TOKEN, REQUEST_TIMEOUT)

def parse_time_string(time_str: str) -> str:
    """Parse and validate time string, convert to ISO format."""
    try:
        # Try parsing common formats
        for fmt in ["%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"]:
            try:
                dt = datetime.strptime(time_str, fmt)
                return dt.isoformat()
            except ValueError:
                continue
        
        # If no format matched, try parsing as ISO
        dt = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
        return dt.isoformat()
    except Exception:
        raise ValueError(f"Invalid time format: {time_str}. Use YYYY-MM-DD or ISO format.")

@mcp.tool()
async def get_entity_history(
    entity_id: str,
    hours_back: int = 24,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    minimal_response: bool = True
) -> EntityHistoryResponse:
    """Get historical data for a specific Home Assistant entity.

    Args:
        entity_id: The Home Assistant entity ID (e.g., 'sensor.temperature')
        hours_back: Number of hours back from now (default: 24, ignored if start_time provided)
        start_time: Start time in YYYY-MM-DD or ISO format (optional)
        end_time: End time in YYYY-MM-DD or ISO format (optional)
        minimal_response: Return minimal data for better performance (default: True)
    """
    try:
        # Validate entity_id format
        if not entity_id or "." not in entity_id:
            raise ValueError("entity_id must be in format 'domain.entity_name'")

        # Determine time range
        if start_time:
            start_time = parse_time_string(start_time)
        else:
            start_dt = datetime.now() - timedelta(hours=hours_back)
            start_time = start_dt.isoformat()

        if end_time:
            end_time = parse_time_string(end_time)

        # Get historical data
        history_data = await ha_client.get_entity_history(
            entity_id, start_time, end_time, minimal_response
        )

        return EntityHistoryResponse(
            entity_id=entity_id,
            data_points=len(history_data),
            start_time=start_time,
            end_time=end_time or datetime.now().isoformat(),
            history=history_data
        )

    except Exception as e:
        logger.error(f"Error getting entity history for {entity_id}: {str(e)}")
        raise ValueError(f"Failed to get entity history: {str(e)}")

@mcp.tool()
async def get_entity_statistics(
    entity_id: str,
    days_back: int = 7,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    period: str = "hour"
) -> EntityStatisticsResponse:
    """Get long-term statistics for a Home Assistant entity.

    Args:
        entity_id: The Home Assistant entity ID (e.g., 'sensor.energy_usage') 
        days_back: Number of days back from now (default: 7, ignored if start_time provided)
        start_time: Start time in YYYY-MM-DD or ISO format (optional)
        end_time: End time in YYYY-MM-DD or ISO format (optional)
        period: Statistics period - 'hour', 'day', 'week', 'month' (default: 'hour')
    """
    try:
        # Validate inputs
        if not entity_id or "." not in entity_id:
            raise ValueError("entity_id must be in format 'domain.entity_name'")
        
        valid_periods = ["hour", "day", "week", "month"]
        if period not in valid_periods:
            raise ValueError(f"period must be one of: {', '.join(valid_periods)}")

        # Determine time range  
        if start_time:
            start_time = parse_time_string(start_time)
        else:
            start_dt = datetime.now() - timedelta(days=days_back)
            start_time = start_dt.isoformat()

        if end_time:
            end_time = parse_time_string(end_time)

        # Get statistics data
        stats_data = await ha_client.get_entity_statistics(
            entity_id, start_time, end_time, period
        )

        entity_stats = stats_data.get(entity_id, [])

        return EntityStatisticsResponse(
            entity_id=entity_id,
            period=period,
            start_time=start_time,
            end_time=end_time or datetime.now().isoformat(),
            statistics=entity_stats
        )

    except Exception as e:
        logger.error(f"Error getting entity statistics for {entity_id}: {str(e)}")
        raise ValueError(f"Failed to get entity statistics: {str(e)}")

@mcp.tool()
async def get_available_entities(
    domain_filter: Optional[str] = None,
    search_term: Optional[str] = None,
    limit: int = 100
) -> EntitiesListResponse:
    """Get list of available entities that have historical data.

    Args:
        domain_filter: Filter by entity domain (e.g., 'sensor', 'switch', 'light')
        search_term: Search entities by name or entity_id (case insensitive)
        limit: Maximum number of entities to return (default: 100)
    """
    try:
        # Get all current states
        states = await ha_client.get_states()
        
        # Filter entities
        filtered_entities = []
        for state in states:
            entity_id = state.get("entity_id", "")
            attributes = state.get("attributes", {})
            friendly_name = attributes.get("friendly_name", entity_id)
            
            # Apply domain filter
            if domain_filter and not entity_id.startswith(f"{domain_filter}."):
                continue
            
            # Apply search filter
            if search_term:
                search_lower = search_term.lower()
                if (search_lower not in entity_id.lower() and 
                    search_lower not in friendly_name.lower()):
                    continue
            
            filtered_entities.append({
                "entity_id": entity_id,
                "friendly_name": friendly_name,
                "domain": entity_id.split(".")[0],
                "state": state.get("state", "unknown"),
                "unit_of_measurement": attributes.get("unit_of_measurement", "")
            })
        
        # Apply limit
        if len(filtered_entities) > limit:
            filtered_entities = filtered_entities[:limit]

        return EntitiesListResponse(
            total_entities=len(filtered_entities),
            entities=filtered_entities
        )

    except Exception as e:
        logger.error(f"Error getting available entities: {str(e)}")
        raise ValueError(f"Failed to get available entities: {str(e)}")

@mcp.tool()
async def get_logbook_entries(
    hours_back: int = 24,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    entity_id: Optional[str] = None,
    limit: int = 50
) -> LogbookResponse:
    """Get Home Assistant logbook entries (events and state changes).

    Args:
        hours_back: Number of hours back from now (default: 24, ignored if start_time provided)
        start_time: Start time in YYYY-MM-DD or ISO format (optional)
        end_time: End time in YYYY-MM-DD or ISO format (optional)  
        entity_id: Filter entries for specific entity (optional)
        limit: Maximum number of entries to return (default: 50)
    """
    try:
        # Determine time range
        if start_time:
            start_time = parse_time_string(start_time)
        else:
            start_dt = datetime.now() - timedelta(hours=hours_back)
            start_time = start_dt.isoformat()

        if end_time:
            end_time = parse_time_string(end_time)

        # Get logbook data
        logbook_data = await ha_client.get_logbook(start_time, end_time, entity_id)
        
        # Apply limit
        if len(logbook_data) > limit:
            logbook_data = logbook_data[:limit]

        return LogbookResponse(
            entry_count=len(logbook_data),
            start_time=start_time,
            end_time=end_time or datetime.now().isoformat(),
            entries=logbook_data
        )

    except Exception as e:
        logger.error(f"Error getting logbook entries: {str(e)}")
        raise ValueError(f"Failed to get logbook entries: {str(e)}")

if __name__ == "__main__":
    # Validate environment variables when server is actually run
    validate_environment()
    
    logger.info(f"Starting Home Assistant History MCP Server")
    logger.info(f"Connected to: {HA_URL}")
    logger.info(f"Request timeout: {REQUEST_TIMEOUT}s")
    
    # Run the server
    mcp.run(transport="stdio")