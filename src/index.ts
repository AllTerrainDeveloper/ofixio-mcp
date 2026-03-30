#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const OFIXIO_URL = (process.env.OFIXIO_URL ?? "https://ofixio.es").replace(/\/$/, "");
const MCP_ENDPOINT = `${OFIXIO_URL}/wp-json/ofixio/v1/mcp`;

let requestId = 0;

async function callBackend(method: string, params: Record<string, unknown>) {
  const id = ++requestId;
  const response = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });

  if (!response.ok) {
    throw new Error(`Ofixio backend returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    result?: unknown;
    error?: { code: number; message: string };
  };

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data.result;
}

const server = new Server(
  {
    name: "ofixio",
    version: "1.0.0",
  },
  {
    capabilities: { tools: {} },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const result = await callBackend("tools/list", {});
  return result as { tools: unknown[] };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const result = await callBackend("tools/call", {
    name: request.params.name,
    arguments: request.params.arguments ?? {},
  });
  return result as { content: unknown[]; isError: boolean };
});

const transport = new StdioServerTransport();
await server.connect(transport);
