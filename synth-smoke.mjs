// Live demo of synthesize_case: spins up a fresh orchestrator and synthesizes a
// real multi-asset case (the ancient-aliens/pyramids case, which has curiosity
// + research calls) into one digest.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const caseId = process.argv[2] ?? "d2d18dc6-3348-4a2f-822f-9f437eb5d3e3";
const client = new Client({ name: "synth-smoke", version: "0.0.1" });
await client.connect(new StdioClientTransport({ command: "node", args: ["dist/index.js"], cwd: "D:/John MCP" }));
const res = await client.callTool({ name: "synthesize_case", arguments: { case_id: caseId } });
console.log(res.content[0].text);
await client.close();
process.exit(0);
