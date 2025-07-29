#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';

// Configuration from environment variables
const HA_URL = process.env.HA_URL || '';
const HA_TOKEN = process.env.HA_TOKEN || '';
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '30') * 1000;
const TRANSPORT = process.env.TRANSPORT || 'stdio'; // 'stdio' or 'http'
const PORT = parseInt(process.env.PORT || '3000');

if (!HA_URL || !HA_TOKEN) {
  console.error('HA_URL and HA_TOKEN environment variables are required');
  process.exit(1);
}

class HomeAssistantClient {
  constructor(baseUrl, token, timeout = 30000) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    this.timeout = timeout;
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        ...options,
        headers: { ...this.headers, ...options.headers },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new McpError(
          ErrorCode.InternalError,
          `Home Assistant API error: ${response.status} - ${response.statusText}`
        );
      }
      
      // Handle empty responses
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return { success: true };
      }
      
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new McpError(ErrorCode.InternalError, 'Request timeout');
      }
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(ErrorCode.InternalError, `Failed to connect to Home Assistant: ${error.message}`);
    }
  }

  async getEntityHistory(entityId, startTime, endTime, minimalResponse = true) {
    let endpoint = '/api/history/period';
    if (startTime) {
      endpoint += `/${encodeURIComponent(startTime)}`;
    }
    
    const params = new URLSearchParams({
      filter_entity_id: entityId,
      minimal_response: minimalResponse.toString(),
    });
    
    if (endTime) {
      params.append('end_time', endTime);
    }
    
    const data = await this.makeRequest(`${endpoint}?${params}`);
    return data[0] || [];
  }

  async getEntityStatistics(entityId, startTime, endTime, period = 'hour') {
    const params = new URLSearchParams({
      statistic_ids: entityId,
      start_time: startTime,
      period: period,
    });
    
    if (endTime) {
      params.append('end_time', endTime);
    }
    
    return await this.makeRequest(`/api/history/statistics?${params}`);
  }

  async getStates() {
    return await this.makeRequest('/api/states');
  }

  async getEntityState(entityId) {
    return await this.makeRequest(`/api/states/${entityId}`);
  }

  async getVersion() {
    return await this.makeRequest('/api/');
  }

  async getErrorLog() {
    const response = await fetch(`${this.baseUrl}/api/error_log`, {
      headers: this.headers,
      signal: AbortSignal.timeout(this.timeout),
    });
    
    if (!response.ok) {
      throw new McpError(ErrorCode.InternalError, `Failed to get error log: ${response.statusText}`);
    }
    
    return await response.text();
  }

  async callService(domain, service, serviceData = {}, target = {}) {
    const data = { ...serviceData };
    if (Object.keys(target).length > 0) {
      data.target = target;
    }
    
    return await this.makeRequest(`/api/services/${domain}/${service}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getLogbook(startTime, endTime, entityId) {
    let endpoint = '/api/logbook';
    if (startTime) {
      endpoint += `/${encodeURIComponent(startTime)}`;
    }
    
    const params = new URLSearchParams();
    if (endTime) {
      params.append('end_time', endTime);
    }
    if (entityId) {
      params.append('entity', entityId);
    }
    
    const queryString = params.toString();
    return await this.makeRequest(queryString ? `${endpoint}?${queryString}` : endpoint);
  }
}

// Initialize client
const haClient = new HomeAssistantClient(HA_URL, HA_TOKEN, REQUEST_TIMEOUT);

// Helper functions
function parseTimeString(timeStr) {
  try {
    const formats = [
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    ];
    
    for (const format of formats) {
      if (format.test(timeStr)) {
        return new Date(timeStr).toISOString();
      }
    }
    
    // Try parsing as ISO
    return new Date(timeStr.replace('Z', '+00:00')).toISOString();
  } catch (error) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid time format: ${timeStr}. Use YYYY-MM-DD or ISO format.`
    );
  }
}

function validateEntityId(entityId) {
  if (!entityId || !entityId.includes('.')) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "entity_id must be in format 'domain.entity_name'"
    );
  }
}

// Create and configure the server
const server = new Server(
  {
    name: 'home-assistant-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
      resources: {},
    },
  }
);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_entity_history',
        description: 'Get historical data for a specific Home Assistant entity',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: { type: 'string', description: 'The Home Assistant entity ID' },
            hours_back: { type: 'number', default: 24, description: 'Number of hours back from now' },
            start_time: { type: 'string', description: 'Start time in YYYY-MM-DD or ISO format' },
            end_time: { type: 'string', description: 'End time in YYYY-MM-DD or ISO format' },
            minimal_response: { type: 'boolean', default: true, description: 'Return minimal data for better performance' },
          },
          required: ['entity_id'],
        },
      },
      {
        name: 'get_entity_statistics',
        description: 'Get long-term statistics for a Home Assistant entity',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: { type: 'string', description: 'The Home Assistant entity ID' },
            days_back: { type: 'number', default: 7, description: 'Number of days back from now' },
            start_time: { type: 'string', description: 'Start time in YYYY-MM-DD or ISO format' },
            end_time: { type: 'string', description: 'End time in YYYY-MM-DD or ISO format' },
            period: { type: 'string', enum: ['hour', 'day', 'week', 'month'], default: 'hour' },
          },
          required: ['entity_id'],
        },
      },
      {
        name: 'get_available_entities',
        description: 'Get list of available entities with filtering',
        inputSchema: {
          type: 'object',
          properties: {
            domain_filter: { type: 'string', description: 'Filter by entity domain' },
            search_term: { type: 'string', description: 'Search entities by name or entity_id' },
            limit: { type: 'number', default: 100, description: 'Maximum number of entities to return' },
          },
        },
      },
      {
        name: 'get_logbook_entries',
        description: 'Get Home Assistant logbook entries (events and state changes)',
        inputSchema: {
          type: 'object',
          properties: {
            hours_back: { type: 'number', default: 24, description: 'Number of hours back from now' },
            start_time: { type: 'string', description: 'Start time in YYYY-MM-DD or ISO format' },
            end_time: { type: 'string', description: 'End time in YYYY-MM-DD or ISO format' },
            entity_id: { type: 'string', description: 'Filter entries for specific entity' },
            limit: { type: 'number', default: 50, description: 'Maximum number of entries to return' },
          },
        },
      },
      {
        name: 'get_entity',
        description: 'Get the current state of a specific Home Assistant entity',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: { type: 'string', description: 'The Home Assistant entity ID' },
            fields: { type: 'array', items: { type: 'string' }, description: 'Optional list of specific fields to return' },
          },
          required: ['entity_id'],
        },
      },
      {
        name: 'entity_action',
        description: 'Perform actions on Home Assistant entities (turn on/off/toggle)',
        inputSchema: {
          type: 'object',
          properties: {
            entity_id: { type: 'string', description: 'The Home Assistant entity ID' },
            action: { type: 'string', description: 'Action to perform (turn_on, turn_off, toggle, etc.)' },
          },
          required: ['entity_id', 'action'],
          additionalProperties: true,
        },
      },
      {
        name: 'call_service_tool',
        description: 'Call any Home Assistant service',
        inputSchema: {
          type: 'object',
          properties: {
            domain: { type: 'string', description: 'Service domain' },
            service: { type: 'string', description: 'Service name' },
            service_data: { type: 'object', description: 'Optional service data dictionary' },
            target: { type: 'object', description: 'Optional target specification' },
          },
          required: ['domain', 'service'],
        },
      },
      {
        name: 'restart_ha',
        description: 'Restart Home Assistant',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_version',
        description: 'Get Home Assistant version information',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_error_log',
        description: 'Get the Home Assistant error log',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'search_entities_tool',
        description: 'Search for entities by name, entity_id, or attributes',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search term to match against entity names and IDs' },
            limit: { type: 'number', default: 20, description: 'Maximum number of results to return' },
            domain_filter: { type: 'string', description: 'Optional domain filter' },
          },
          required: ['query'],
        },
      },
      {
        name: 'domain_summary_tool',
        description: 'Get a summary of entities in a specific domain',
        inputSchema: {
          type: 'object',
          properties: {
            domain: { type: 'string', description: 'Domain name' },
            include_entities: { type: 'boolean', default: true, description: 'Whether to include sample entities' },
            limit: { type: 'number', default: 10, description: 'Maximum number of sample entities to include' },
          },
          required: ['domain'],
        },
      },
      {
        name: 'list_automations',
        description: 'Get a list of all Home Assistant automations',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_entity_history': {
        validateEntityId(args.entity_id);
        
        let startTime;
        if (args.start_time) {
          startTime = parseTimeString(args.start_time);
        } else {
          const hoursBack = args.hours_back || 24;
          startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
        }
        
        const endTime = args.end_time ? parseTimeString(args.end_time) : null;
        const history = await haClient.getEntityHistory(
          args.entity_id,
          startTime,
          endTime,
          args.minimal_response !== false
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                entity_id: args.entity_id,
                data_points: history.length,
                start_time: startTime,
                end_time: endTime || new Date().toISOString(),
                history: history,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_entity_statistics': {
        validateEntityId(args.entity_id);
        
        let startTime;
        if (args.start_time) {
          startTime = parseTimeString(args.start_time);
        } else {
          const daysBack = args.days_back || 7;
          startTime = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
        }
        
        const endTime = args.end_time ? parseTimeString(args.end_time) : null;
        const period = args.period || 'hour';
        
        const stats = await haClient.getEntityStatistics(args.entity_id, startTime, endTime, period);
        const entityStats = stats[args.entity_id] || [];
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                entity_id: args.entity_id,
                period: period,
                start_time: startTime,
                end_time: endTime || new Date().toISOString(),
                statistics: entityStats,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_available_entities': {
        const states = await haClient.getStates();
        let filteredEntities = [];
        
        for (const state of states) {
          const entityId = state.entity_id || '';
          const attributes = state.attributes || {};
          const friendlyName = attributes.friendly_name || entityId;
          
          // Apply domain filter
          if (args.domain_filter && !entityId.startsWith(`${args.domain_filter}.`)) {
            continue;
          }
          
          // Apply search filter
          if (args.search_term) {
            const searchLower = args.search_term.toLowerCase();
            if (!entityId.toLowerCase().includes(searchLower) &&
                !friendlyName.toLowerCase().includes(searchLower)) {
              continue;
            }
          }
          
          filteredEntities.push({
            entity_id: entityId,
            friendly_name: friendlyName,
            domain: entityId.split('.')[0],
            state: state.state || 'unknown',
            unit_of_measurement: attributes.unit_of_measurement || '',
          });
        }
        
        // Apply limit
        const limit = args.limit || 100;
        if (filteredEntities.length > limit) {
          filteredEntities = filteredEntities.slice(0, limit);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                total_entities: filteredEntities.length,
                entities: filteredEntities,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_logbook_entries': {
        let startTime;
        if (args.start_time) {
          startTime = parseTimeString(args.start_time);
        } else {
          const hoursBack = args.hours_back || 24;
          startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
        }
        
        const endTime = args.end_time ? parseTimeString(args.end_time) : null;
        let logbookData = await haClient.getLogbook(startTime, endTime, args.entity_id);
        
        // Apply limit
        const limit = args.limit || 50;
        if (logbookData.length > limit) {
          logbookData = logbookData.slice(0, limit);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                entry_count: logbookData.length,
                start_time: startTime,
                end_time: endTime || new Date().toISOString(),
                entries: logbookData,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_entity': {
        validateEntityId(args.entity_id);
        
        const stateData = await haClient.getEntityState(args.entity_id);
        let attributes = stateData.attributes || {};
        
        // Apply field filtering if requested
        if (args.fields) {
          const filteredData = {};
          for (const field of args.fields) {
            if (field.includes('.')) {
              // Handle nested fields like 'attributes.brightness'
              const parts = field.split('.');
              let current = stateData;
              for (const part of parts) {
                if (current && typeof current === 'object' && part in current) {
                  current = current[part];
                } else {
                  current = null;
                  break;
                }
              }
              if (current !== null) {
                filteredData[field] = current;
              }
            } else if (field in stateData) {
              filteredData[field] = stateData[field];
            }
          }
          attributes = filteredData;
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                entity_id: args.entity_id,
                state: stateData.state || 'unknown',
                last_changed: stateData.last_changed || '',
                last_updated: stateData.last_updated || '',
                attributes: attributes,
              }, null, 2),
            },
          ],
        };
      }

      case 'entity_action': {
        validateEntityId(args.entity_id);
        
        const domain = args.entity_id.split('.')[0];
        const actionMap = {
          'on': 'turn_on',
          'off': 'turn_off',
          'toggle': 'toggle',
          'turn_on': 'turn_on',
          'turn_off': 'turn_off',
        };
        
        const service = actionMap[args.action.toLowerCase()] || args.action;
        const serviceData = { entity_id: args.entity_id };
        
        // Add any additional parameters
        Object.keys(args).forEach(key => {
          if (key !== 'entity_id' && key !== 'action') {
            serviceData[key] = args[key];
          }
        });
        
        await haClient.callService(domain, service, serviceData);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                service: `${domain}.${service}`,
                target: { entity_id: args.entity_id },
                service_data: Object.keys(serviceData).length > 1 ? serviceData : null,
              }, null, 2),
            },
          ],
        };
      }

      case 'call_service_tool': {
        const result = await haClient.callService(
          args.domain,
          args.service,
          args.service_data || {},
          args.target || {}
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                service: `${args.domain}.${args.service}`,
                target: args.target,
                service_data: args.service_data,
                result: result,
              }, null, 2),
            },
          ],
        };
      }

      case 'restart_ha': {
        await haClient.callService('homeassistant', 'restart');
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                service: 'homeassistant.restart',
                message: 'Home Assistant restart initiated',
              }, null, 2),
            },
          ],
        };
      }

      case 'get_version': {
        const versionData = await haClient.getVersion();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                version: versionData.version || 'unknown',
                ...versionData,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_error_log': {
        const errorLog = await haClient.getErrorLog();
        
        return {
          content: [
            {
              type: 'text',
              text: errorLog,
            },
          ],
        };
      }

      case 'search_entities_tool': {
        const states = await haClient.getStates();
        const queryLower = args.query.toLowerCase();
        let matchingEntities = [];
        
        for (const state of states) {
          const entityId = state.entity_id || '';
          const attributes = state.attributes || {};
          const friendlyName = attributes.friendly_name || entityId;
          
          // Apply domain filter
          if (args.domain_filter && !entityId.startsWith(`${args.domain_filter}.`)) {
            continue;
          }
          
          // Search in entity_id, friendly_name, and device_class
          let searchableText = `${entityId} ${friendlyName}`.toLowerCase();
          if (attributes.device_class) {
            searchableText += ` ${attributes.device_class}`.toLowerCase();
          }
          
          if (searchableText.includes(queryLower)) {
            matchingEntities.push({
              entity_id: entityId,
              friendly_name: friendlyName,
              domain: entityId.split('.')[0],
              state: state.state || 'unknown',
              unit_of_measurement: attributes.unit_of_measurement || '',
              device_class: attributes.device_class || '',
            });
          }
        }
        
        // Sort by relevance
        matchingEntities.sort((a, b) => {
          const aName = a.friendly_name.toLowerCase();
          const aEntityId = a.entity_id.toLowerCase();
          const bName = b.friendly_name.toLowerCase();
          const bEntityId = b.entity_id.toLowerCase();
          
          // Exact match
          if (queryLower === aName || queryLower === aEntityId) return -1;
          if (queryLower === bName || queryLower === bEntityId) return 1;
          
          // Starts with
          if (aName.startsWith(queryLower) || aEntityId.startsWith(queryLower)) return -1;
          if (bName.startsWith(queryLower) || bEntityId.startsWith(queryLower)) return 1;
          
          return 0;
        });
        
        // Apply limit
        const limit = args.limit || 20;
        if (matchingEntities.length > limit) {
          matchingEntities = matchingEntities.slice(0, limit);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                total_entities: matchingEntities.length,
                entities: matchingEntities,
              }, null, 2),
            },
          ],
        };
      }

      case 'domain_summary_tool': {
        const states = await haClient.getStates();
        const domainEntities = states.filter(state => 
          state.entity_id && state.entity_id.startsWith(`${args.domain}.`)
        );
        
        let sampleEntities = [];
        if (args.include_entities !== false) {
          const limit = args.limit || 10;
          sampleEntities = domainEntities.slice(0, limit).map(state => ({
            entity_id: state.entity_id,
            friendly_name: state.attributes?.friendly_name || state.entity_id,
            state: state.state || 'unknown',
            unit_of_measurement: state.attributes?.unit_of_measurement || '',
            device_class: state.attributes?.device_class || '',
          }));
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                domain: args.domain,
                entity_count: domainEntities.length,
                entities: sampleEntities,
              }, null, 2),
            },
          ],
        };
      }

      case 'list_automations': {
        const states = await haClient.getStates();
        const automations = states.filter(state => 
          state.entity_id && state.entity_id.startsWith('automation.')
        );
        
        const automationList = automations.map(automation => ({
          entity_id: automation.entity_id,
          friendly_name: automation.attributes?.friendly_name || automation.entity_id,
          state: automation.state || 'unknown',
          last_triggered: automation.attributes?.last_triggered,
          mode: automation.attributes?.mode || 'single',
          current: automation.attributes?.current || 0,
          max: automation.attributes?.max || 10,
        }));
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                total_automations: automationList.length,
                automations: automationList,
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error.message}`);
  }
});

// Prompt handlers
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'create_automation',
        description: 'Guide for creating Home Assistant automations based on trigger type',
        arguments: [
          {
            name: 'trigger_type',
            description: 'Type of trigger (time, state, event, device, etc.)',
            required: false,
          },
        ],
      },
      {
        name: 'debug_automation',
        description: 'Troubleshooting help for automations that aren\'t working',
        arguments: [
          {
            name: 'automation_id',
            description: 'ID of the automation to debug',
            required: false,
          },
        ],
      },
      {
        name: 'troubleshoot_entity',
        description: 'Diagnose issues with Home Assistant entities',
        arguments: [
          {
            name: 'entity_id',
            description: 'ID of the entity to troubleshoot',
            required: false,
          },
        ],
      },
      {
        name: 'routine_optimizer',
        description: 'Analyze usage patterns and suggest optimized routines',
      },
      {
        name: 'automation_health_check',
        description: 'Review all automations for conflicts and improvements',
      },
      {
        name: 'entity_naming_consistency',
        description: 'Audit entity names and suggest standardization',
      },
      {
        name: 'dashboard_layout_generator',
        description: 'Create optimized dashboards based on usage patterns',
      },
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'create_automation': {
      const triggerType = args?.trigger_type || 'time';
      
      const baseGuide = `
# Creating Home Assistant Automations

I'll help you create a Home Assistant automation. Here's what we'll need:

## 1. Trigger (What starts the automation?)
`;
      
      const triggers = {
        time: `
**Time-based triggers:**
- At a specific time: \`platform: time, at: "07:00:00"\`
- At sunrise/sunset: \`platform: sun, event: sunrise/sunset\`
- Recurring pattern: \`platform: time_pattern, minutes: "/5"\` (every 5 minutes)
`,
        state: `
**State-based triggers:**
- Entity state change: \`platform: state, entity_id: sensor.temperature, to: "20"\`
- Numeric state: \`platform: numeric_state, entity_id: sensor.temperature, above: 25\`
- Template: \`platform: template, value_template: "{{ states('sensor.temp') | float > 20 }}"\`
`,
        event: `
**Event-based triggers:**
- Home Assistant events: \`platform: event, event_type: automation_reloaded\`
- Device events: \`platform: device, device_id: abc123, domain: binary_sensor\`
`,
        device: `
**Device-based triggers:**
- Motion sensor: \`platform: device, device_id: motion_sensor_id, domain: binary_sensor, type: motion\`
- Button press: \`platform: device, device_id: button_id, domain: sensor, type: action\`
`,
      };
      
      const triggerContent = triggers[triggerType] || triggers.time;
      
      const guide = baseGuide + triggerContent + `
## 2. Condition (Optional - When should it run?)
- Time condition: \`condition: time, after: "07:00:00", before: "23:00:00"\`
- State condition: \`condition: state, entity_id: light.living_room, state: "off"\`
- Numeric condition: \`condition: numeric_state, entity_id: sensor.temp, above: 20\`

## 3. Action (What should happen?)
- Turn on/off: \`service: light.turn_on, target: {entity_id: light.living_room}\`
- Send notification: \`service: notify.mobile_app, data: {message: "Hello!"}\`
- Set value: \`service: input_number.set_value, target: {entity_id: input_number.temp}, data: {value: 22}\`

## 4. Mode (How to handle multiple triggers?)
- \`single\`: Only one instance (default)
- \`restart\`: Restart if triggered again
- \`queued\`: Queue multiple instances
- \`parallel\`: Run multiple instances simultaneously

Let me know what specific automation you want to create!
`;
      
      return {
        description: `Guide for creating ${triggerType}-based automations`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: guide,
            },
          },
        ],
      };
    }
    
    case 'debug_automation': {
      const automationId = args?.automation_id || '';
      
      return {
        description: `Troubleshooting help for automation${automationId ? `: ${automationId}` : ''}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `# Debugging Home Assistant Automation${automationId ? `: ${automationId}` : ''}

Let's troubleshoot your automation step by step:

## 1. Check Automation Status
- Is the automation enabled? Check in Settings > Automations & Scenes
- Look at the automation's "Last Triggered" timestamp
- Check the "Current" count vs "Max" runs

## 2. Verify Triggers
- **Time triggers**: Check if time zones are correct
- **State triggers**: Verify entity_id exists and state values match exactly
- **Numeric triggers**: Ensure \`above\`/\`below\` values are numbers, not strings
- **Template triggers**: Test templates in Developer Tools > Template

## 3. Check Conditions
- Are conditions too restrictive?
- Test each condition individually in Developer Tools
- Remember: ALL conditions must be true

## 4. Validate Actions
- Test each action manually in Developer Tools > Services
- Check if target entities exist and are accessible
- Verify service data format matches service requirements

## 5. Common Issues
- **Entity names changed**: Update entity_ids if devices were renamed
- **State format**: States are strings ("20" not 20), except for numeric_state
- **Time zones**: Ensure automation server time matches your location
- **Mode conflicts**: Check if 'single' mode is blocking repeated triggers

## 6. Debugging Tools
- Use \`Developer Tools > Logs\` to see automation errors
- Add \`service: system_log.write\` actions for debugging
- Check \`Settings > System > Logs\` for detailed error messages

## 7. Testing Tips
- Use \`action: automation.trigger\` to manually test automations
- Create simple test automations to isolate issues
- Use \`trace\` feature in automation editor to see execution flow

What specific issue are you experiencing with your automation?`,
            },
          },
        ],
      };
    }
    
    // Add other prompt handlers here...
    
    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown prompt: ${name}`);
  }
});

// Resource handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'hass://entities',
        name: 'All Home Assistant entities',
        description: 'List all entities grouped by domain',
        mimeType: 'application/json',
      },
      {
        uri: 'hass://entities/{entity_id}',
        name: 'Entity state',
        description: 'Get current state of a specific entity',
        mimeType: 'application/json',
      },
      {
        uri: 'hass://entities/{entity_id}/detailed',
        name: 'Detailed entity information',
        description: 'Get detailed entity information with all attributes',
        mimeType: 'application/json',
      },
      {
        uri: 'hass://entities/domain/{domain}',
        name: 'Domain entities',
        description: 'Get entities for a specific domain',
        mimeType: 'application/json',
      },
      {
        uri: 'hass://search/{query}/{limit?}',
        name: 'Search entities',
        description: 'Search entities with optional limit',
        mimeType: 'application/json',
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  
  try {
    if (uri === 'hass://entities') {
      const states = await haClient.getStates();
      const domains = {};
      
      for (const state of states) {
        const entityId = state.entity_id || '';
        const domain = entityId.split('.')[0];
        if (!domains[domain]) {
          domains[domain] = [];
        }
        domains[domain].push({
          entity_id: entityId,
          friendly_name: state.attributes?.friendly_name || entityId,
          state: state.state || 'unknown',
        });
      }
      
      let result = 'Home Assistant Entities by Domain:\n\n';
      for (const [domain, entities] of Object.entries(domains).sort()) {
        result += `${domain.toUpperCase()} (${entities.length} entities):\n`;
        for (const entity of entities.slice(0, 10)) {
          result += `  - ${entity.entity_id}: ${entity.state}\n`;
        }
        if (entities.length > 10) {
          result += `  ... and ${entities.length - 10} more\n`;
        }
        result += '\n';
      }
      
      return {
        contents: [
          {
            uri: uri,
            mimeType: 'text/plain',
            text: result,
          },
        ],
      };
    }
    
    // Handle other resource URIs...
    
    throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(ErrorCode.InternalError, `Resource access failed: ${error.message}`);
  }
});

// Start the server
async function main() {
  if (TRANSPORT === 'stdio') {
    // Desktop Extension mode - use stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Home Assistant MCP Server running on stdio');
  } else if (TRANSPORT === 'http') {
    // Docker/HTTP mode - use Express with SSE transport
    const app = express();
    
    // Enable CORS for cross-origin requests
    app.use(cors());
    app.use(express.json());
    
    // Health check endpoint for Docker
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        transport: 'http'
      });
    });
    
    // MCP endpoint info
    app.get('/info', (req, res) => {
      res.json({
        name: 'Home Assistant MCP Server',
        version: '1.0.0',
        description: 'Complete Home Assistant integration with historical data analysis and real-time control',
        endpoints: {
          sse: '/sse',
          health: '/health'
        }
      });
    });
    
    // Start Express server
    const httpServer = app.listen(PORT, () => {
      console.error(`Home Assistant MCP Server running on HTTP port ${PORT}`);
      console.error(`Health check: http://localhost:${PORT}/health`);
      console.error(`SSE endpoint: http://localhost:${PORT}/sse`);
    });
    
    // Create SSE transport
    const transport = new SSEServerTransport('/sse', httpServer);
    await server.connect(transport);
  } else {
    throw new Error(`Unsupported transport: ${TRANSPORT}. Use 'stdio' or 'http'`);
  }
}

main().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});