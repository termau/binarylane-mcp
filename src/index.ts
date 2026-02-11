#!/usr/bin/env node

/**
 * BinaryLane MCP Server
 *
 * A Model Context Protocol server for interacting with the BinaryLane VPS hosting API.
 * Provides comprehensive tools for managing servers, domains, VPCs, load balancers, and more.
 *
 * Features:
 * - Full API coverage for BinaryLane v2 API
 * - Zod schema validation for all inputs
 * - Proper tool annotations (readOnlyHint, destructiveHint, etc.)
 * - Actionable error messages
 * - Comprehensive tool descriptions
 *
 * Environment Variables:
 *   BINARYLANE_API_TOKEN - Required. Your BinaryLane API token.
 *
 * @see https://api.binarylane.com.au/reference/
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ZodError } from 'zod';

import { BinaryLaneClient, ApiError } from './api-client.js';
import { allTools } from './tools.js';
import { allHandlers } from './handlers.js';

// ==================== Configuration ====================

const SERVER_NAME = 'binarylane-mcp';
const SERVER_VERSION = '1.0.0';

// Get API token from environment
const API_TOKEN = process.env.BINARYLANE_API_TOKEN;

/**
 * Validates that the API token matches the expected BinaryLane format.
 * @param token - The API token to validate
 * @returns An error message if validation fails, otherwise null
 */
function validateApiToken(token: string): string | null {
  // BinaryLane API tokens are 64 alphanumeric characters
  const TOKEN_PATTERN = /^[a-zA-Z0-9]{64}$/;

  if (token.length !== 64) {
    return `Invalid token length: expected 64 characters, got ${token.length}`;
  }

  if (!TOKEN_PATTERN.test(token)) {
    return 'Invalid token format: token must contain only alphanumeric characters (a-z, A-Z, 0-9)';
  }

  return null;
}

if (!API_TOKEN) {
  console.error('Error: BINARYLANE_API_TOKEN environment variable is required');
  console.error('');
  console.error('Get your API token from: https://home.binarylane.com.au/api-info');
  console.error('');
  console.error('Usage:');
  console.error('  export BINARYLANE_API_TOKEN="your-token-here"');
  console.error('  npx binarylane-mcp');
  process.exit(1);
}

// Validate token format
const tokenValidationError = validateApiToken(API_TOKEN);
if (tokenValidationError) {
  console.error('Error: Invalid BINARYLANE_API_TOKEN format');
  console.error('');
  console.error(`Issue: ${tokenValidationError}`);
  console.error('');
  console.error('Expected format: 64 alphanumeric characters (a-z, A-Z, 0-9)');
  console.error('Example: fuHUGTGDGNA32N44mwektPk7Pg57AEBUnZMwpKGrwtMLSLaK1tM818ZdVUYok3is');
  console.error('');
  console.error('Get your API token from: https://home.binarylane.com.au/api-info');
  process.exit(1);
}

// Initialize API client
const client = new BinaryLaneClient(API_TOKEN);

// ==================== Error Handling ====================

/**
 * Format errors into actionable messages for LLM consumption.
 */
function formatError(error: unknown): string {
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const issues = error.issues.map(issue => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    }).join('; ');
    return `Validation error: ${issues}. Please check the parameter values and try again.`;
  }

  // Handle API errors with type checking
  if (error instanceof ApiError) {
    // Provide actionable suggestions based on HTTP status codes
    switch (error.statusCode) {
      case 401:
        return 'Authentication failed. Please verify your BINARYLANE_API_TOKEN is valid and not expired.';
      case 403:
        return 'Permission denied. Your API token may not have access to this resource.';
      case 404:
        return 'Resource not found. Please verify the ID exists using the appropriate list tool.';
      case 409:
        return 'Conflict: The operation cannot be completed in the current state. Check if another operation is in progress.';
      case 422:
        return `Invalid request: ${error.message}. Check that all required parameters are provided with valid values.`;
      case 429:
        return 'Rate limit exceeded. Please wait a moment before retrying.';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'BinaryLane API error. This may be temporary - please try again in a few moments.';
      default:
        return `API error (${error.statusCode}): ${error.message}`;
    }
  }

  // Fallback for non-API errors
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  return `Unexpected error: ${String(error)}`;
}

// ==================== Server Setup ====================

const server = new Server(
  {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ==================== Tool Registration ====================

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: allTools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Find the handler for this tool
  const handler = allHandlers[name];

  if (!handler) {
    return {
      content: [{
        type: 'text',
        text: `Unknown tool: ${name}. Use list_tools to see available tools.`,
      }],
      isError: true,
    };
  }

  try {
    // Execute the handler
    const result = await handler(client, args || {});

    // Return formatted result
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  } catch (error) {
    // Return actionable error message
    return {
      content: [{
        type: 'text',
        text: formatError(error),
      }],
      isError: true,
    };
  }
});

// ==================== Server Startup ====================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
  console.error('Ready to accept requests');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
