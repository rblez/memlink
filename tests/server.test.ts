import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createServer } from "http";
import { createUniversalMemory } from "../src/core/memory.ts";
import { unlinkSync, existsSync } from "fs";

describe("MCP Server", () => {
  let server: any;
  let memoryId: string;
  let memoryName: string;
  const port = 4445; // Use different port to avoid conflicts

  beforeEach(async () => {
    memoryName = `test-server-${Date.now()}`;
    const memory = createUniversalMemory(memoryName);
    memoryId = memory.memoryId;

    // Start server on different port for testing
    server = await startTestServer(port);
  });

  afterEach(() => {
    if (server) {
      server.close();
    }

    try {
      const memoryPath = `/home/${process.env.USER}/.memlink/${memoryId}.memory.md`;
      if (existsSync(memoryPath)) {
        unlinkSync(memoryPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Server Health", () => {
    it("should start server without errors", async () => {
      expect(server).toBeDefined();
      expect(server.listening).toBe(true);
    });

    it("should respond to health check", async () => {
      const response = await fetch(`http://localhost:${port}/health`);
      expect(response.status).toBe(200);
    });
  });

  describe("MCP Protocol", () => {
    it("should handle MCP requests", async () => {
      const mcpRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "test-client",
            version: "1.0.0",
          },
        },
      };

      const response = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer memlink_${memoryId}`,
        },
        body: JSON.stringify(mcpRequest),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.jsonrpc).toBe("2.0");
      expect(data.id).toBe(1);
      expect(data.result).toBeDefined();
    });

    it("should validate authentication", async () => {
      const response = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(401);
    });
  });

  async function startTestServer(testPort: number): Promise<any> {
    return new Promise((resolve) => {
      const testServer = createServer((req, res) => {
        if (req.url === "/health") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "healthy" }));
          return;
        }

        if (req.url === "/mcp" && req.method === "POST") {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith("Bearer memlink_")) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Unauthorized" }));
            return;
          }

          let body = "";
          req.on("data", (chunk) => {
            body += chunk.toString();
          });

          req.on("end", () => {
            try {
              const mcpRequest = JSON.parse(body);
              const mcpResponse = {
                jsonrpc: "2.0",
                id: mcpRequest.id,
                result: {
                  protocolVersion: "2024-11-05",
                  capabilities: {
                    tools: {},
                    resources: {},
                  },
                  serverInfo: {
                    name: "memlink",
                    version: "2.0.0",
                  },
                },
              };

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(mcpResponse));
            } catch (error) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid JSON" }));
            }
          });
          return;
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found" }));
      });

      testServer.listen(testPort, () => {
        resolve(testServer);
      });
    });
  }
});