# Use Python 3.11 slim image for security and size
FROM python:3.11-slim

# Metadata labels
LABEL org.opencontainers.image.title="Home Assistant History MCP Server"
LABEL org.opencontainers.image.description="MCP server providing access to Home Assistant historical data"
LABEL org.opencontainers.image.url="https://github.com/jtenniswood/ha-history-mcp"
LABEL org.opencontainers.image.documentation="https://github.com/jtenniswood/ha-history-mcp#readme"
LABEL org.opencontainers.image.source="https://github.com/jtenniswood/ha-history-mcp"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.vendor="jtenniswood"

# Create non-root user for security
RUN groupadd -r mcpuser && useradd -r -g mcpuser mcpuser

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better Docker layer caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/

# Copy version file
COPY VERSION .

# Change ownership to non-root user
RUN chown -R mcpuser:mcpuser /app

# Switch to non-root user
USER mcpuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import sys; sys.exit(0)" || exit 1

# Expose no ports (MCP uses STDIO)
# EXPOSE 

# Environment variables (with defaults)
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Run the MCP server
CMD ["python", "src/ha_history_mcp_server.py"]