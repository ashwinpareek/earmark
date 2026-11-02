// Talk to Earmark's MCP server with the official MCP client, as Claude or ChatGPT would.
// Usage: node scripts/mcp-check.mjs http://localhost:3000/api/mcp
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = new URL(process.argv[2] ?? "http://localhost:3000/api/mcp");
const client = new Client({ name: "earmark-check", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(url));
console.log("server:", client.getServerVersion());
console.log("tools:", (await client.listTools()).tools.map((t) => t.name).join(", "));
const found = await client.callTool({ name: "find_verified_campaigns", arguments: { query: "child surgery" } });
const list = found.structuredContent.campaigns;
console.log("found:", list.map((c) => `${c.patient} (${c.procedure.slice(0, 32)}, needs $${c.still_needs_usd}, ${c.checks})`).join(" | "));
const ev = await client.callTool({ name: "get_campaign_evidence", arguments: { campaign_id: list[0].campaign_id } });
console.log("evidence:", ev.structuredContent.checks.map((k) => `${k.result}:${k.check}`).slice(0, 4).join(", "), "…");
if (process.argv[3] === "pledge") {
  const p = await client.callTool({ name: "create_pledge", arguments: { campaign_id: list[0].campaign_id, amount_usd: 20, donor_name: "Claude user", donor_email: "donor@example.com" } });
  console.log("pledge:", p.structuredContent);
}
await client.close();
