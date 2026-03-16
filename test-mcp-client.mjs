#!/usr/bin/env node
/**
 * Test script for IBGE MCP Server via HTTP/SSE
 * Tests real MCP connection using official SDK
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function testMCPServer() {
  console.log("🧪 Testing IBGE MCP Server (HTTP/SSE)");
  console.log("=" .repeat(60));

  try {
    // Create SSE transport
    console.log("\n1️⃣  Creating SSE transport...");
    const transport = new SSEClientTransport(
      new URL("http://localhost:3000/sse")
    );
    console.log("   ✅ Transport created");

    // Create MCP client
    console.log("\n2️⃣  Creating MCP client...");
    const client = new Client(
      {
        name: "test-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );
    console.log("   ✅ Client created");

    // Connect to server
    console.log("\n3️⃣  Connecting to server...");
    await client.connect(transport);
    console.log("   ✅ Connected successfully!");

    // List available tools
    console.log("\n4️⃣  Listing available tools...");
    const tools = await client.listTools();
    console.log(`   ✅ Found ${tools.tools.length} tools:`);

    // Show first 5 tools
    tools.tools.slice(0, 5).forEach((tool, i) => {
      console.log(`      ${i + 1}. ${tool.name} - ${tool.description}`);
    });

    if (tools.tools.length > 5) {
      console.log(`      ... and ${tools.tools.length - 5} more`);
    }

    // Test calling a tool - population by states
    console.log("\n5️⃣  Testing tool call: ibge_populacao_estados");
    const result = await client.callTool({
      name: "ibge_populacao_estados",
      arguments: {},
    });
    console.log("   ✅ Tool executed successfully!");
    console.log("   Response preview:");

    // Extract text content from MCP result
    const textContent = result.content
      .filter(c => c.type === "text")
      .map(c => c.text)
      .join("\n");

    // Show first 200 chars
    console.log(`   ${textContent.substring(0, 200)}...`);

    // Test municipality search
    console.log("\n6️⃣  Testing tool call: ibge_buscar_municipio (São Paulo)");
    const searchResult = await client.callTool({
      name: "ibge_buscar_municipio",
      arguments: { nome: "São Paulo" },
    });
    console.log("   ✅ Search executed successfully!");

    const searchText = searchResult.content
      .filter(c => c.type === "text")
      .map(c => c.text)
      .join("\n");

    console.log(`   ${searchText.substring(0, 300)}...`);

    // Close connection
    console.log("\n7️⃣  Closing connection...");
    await client.close();
    console.log("   ✅ Connection closed");

    console.log("\n" + "=".repeat(60));
    console.log("✅ ALL TESTS PASSED!");
    console.log("=".repeat(60));

  } catch (error) {
    console.error("\n❌ TEST FAILED:");
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    process.exit(1);
  }
}

// Run tests
testMCPServer().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});