import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createHttpApp } from "../../src/index.js";
import type { Application } from "express";

describe("HTTP Mode Tests", () => {
  let app: Application;
  let server: McpServer;

  beforeAll(() => {
    // Create a test MCP server
    server = new McpServer({
      name: "ibge-mcp-server-test",
      version: "2.2.0",
    });

    // Create the HTTP app
    app = createHttpApp(server);
  });

  describe("GET /health", () => {
    it("should return 200 status code", async () => {
      const response = await request(app).get("/health");
      expect(response.status).toBe(200);
    });

    it("should return JSON content type", async () => {
      const response = await request(app).get("/health");
      expect(response.headers["content-type"]).toMatch(/json/);
    });

    it("should return correct health check structure", async () => {
      const response = await request(app).get("/health");

      expect(response.body).toHaveProperty("status", "ok");
      expect(response.body).toHaveProperty("name", "ibge-mcp-server");
      expect(response.body).toHaveProperty("version", "2.2.0");
      expect(response.body).toHaveProperty("tools", 32);
      expect(response.body).toHaveProperty("mode", "http");
    });

    it("should have all required health check fields", async () => {
      const response = await request(app).get("/health");
      const requiredFields = ["status", "name", "version", "tools", "mode"];

      requiredFields.forEach((field) => {
        expect(response.body).toHaveProperty(field);
      });
    });

    it("should return status ok", async () => {
      const response = await request(app).get("/health");
      expect(response.body.status).toBe("ok");
    });

    it("should return correct number of tools", async () => {
      const response = await request(app).get("/health");
      expect(response.body.tools).toBe(32);
      expect(typeof response.body.tools).toBe("number");
    });

    it("should indicate HTTP mode", async () => {
      const response = await request(app).get("/health");
      expect(response.body.mode).toBe("http");
    });
  });

  describe("GET /sse", () => {
    it("should have SSE endpoint registered (route exists)", async () => {
      // SSE endpoint keeps connections open (long-lived stream)
      // We verify it exists by checking it doesn't return 404
      // Note: SSE will timeout waiting for MCP client handshake - this is expected
      const promise = request(app)
        .get("/sse")
        .set("Accept", "text/event-stream")
        .timeout(500);

      // Endpoint exists if it doesn't immediately reject with 404
      await expect(promise).rejects.toThrow(); // Will timeout or error, not 404
    });

    it("should accept GET requests to SSE endpoint", async () => {
      // SSE uses GET (EventSource standard)
      const promise = request(app)
        .get("/sse")
        .set("Accept", "text/event-stream")
        .timeout(500);

      // Will timeout (expected), not 404
      await expect(promise).rejects.toThrow();
    });
  });

  describe("CORS Configuration", () => {
    it("should allow CORS requests", async () => {
      const response = await request(app)
        .get("/health")
        .set("Origin", "http://example.com");

      expect(response.headers["access-control-allow-origin"]).toBeDefined();
    });

    it("should handle OPTIONS preflight requests", async () => {
      const response = await request(app)
        .options("/health")
        .set("Origin", "http://example.com")
        .set("Access-Control-Request-Method", "GET");

      expect(response.status).toBeLessThan(500);
    });
  });

  describe("Error Handling", () => {
    it("should return 404 for unknown routes", async () => {
      const response = await request(app).get("/unknown-endpoint");
      expect(response.status).toBe(404);
    });

    it("should handle requests to SSE endpoint gracefully", async () => {
      const promise = request(app)
        .get("/sse")
        .timeout(500);

      // Should handle gracefully (timeout expected, not crash)
      await expect(promise).rejects.toThrow();
    });
  });

  describe("HTTP Methods", () => {
    it("should only accept GET for /health", async () => {
      const postResponse = await request(app).post("/health");
      expect(postResponse.status).toBeGreaterThanOrEqual(400);
    });

    it("should accept GET for /sse (EventSource standard)", async () => {
      const promise = request(app)
        .get("/sse")
        .timeout(500);

      // SSE keeps connection open, will timeout (expected behavior)
      await expect(promise).rejects.toThrow();
    });
  });

  describe("Response Format", () => {
    it("should return valid JSON for health endpoint", async () => {
      const response = await request(app).get("/health");

      expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
    });

    it("should have consistent response structure", async () => {
      const response1 = await request(app).get("/health");
      const response2 = await request(app).get("/health");

      expect(Object.keys(response1.body).sort()).toEqual(
        Object.keys(response2.body).sort()
      );
    });
  });

  describe("Performance", () => {
    it("should respond to health check within 100ms", async () => {
      const start = Date.now();
      await request(app).get("/health");
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it("should handle multiple concurrent health checks", async () => {
      const requests = Array(10)
        .fill(null)
        .map(() => request(app).get("/health"));

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe("ok");
      });
    });
  });

  describe("Header Validation", () => {
    it("should return JSON for health endpoint", async () => {
      const response = await request(app).get("/health");

      expect(response.type).toBe("application/json");
    });

    it("should have proper CORS headers", async () => {
      const response = await request(app)
        .get("/health")
        .set("Origin", "http://localhost:3000");

      expect(response.headers["access-control-allow-origin"]).toBeDefined();
    });
  });
});
