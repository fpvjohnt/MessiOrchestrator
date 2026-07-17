// Live proof of the health_check tool: spins up a FRESH orchestrator from the
// current dist/ (which has the new tool) and calls health_check, which connects
// to all registered assets. Since this orchestrator starts after every build,
// nothing should read as stale — staleness logic itself is covered by the unit
// tests; this proves the liveness path end-to-end against real asset processes.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "health-smoke", version: "0.0.1" });
// Use the absolute node binary (not a bare "node") so the smoke test mirrors a
// GUI launch where PATH may lack node — the same hardening client-manager uses.
await client.connect(new StdioClientTransport({ command: process.execPath, args: ["dist/index.js"], cwd: "D:/John MCP" }));

const res = await client.callTool({ name: "health_check", arguments: {} });
console.log(res.content[0].text);

await client.close();
process.exit(0);
