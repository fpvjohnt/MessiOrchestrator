// Live end-to-end proof of latency tracking: a fresh orchestrator runs a few
// real tasks (which the new task_asset now times), then overseer.latency_report
// reads those durations back. Shows the whole loop — capture → report.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const c = new Client({ name: "latency-smoke", version: "0.0.1" });
await c.connect(new StdioClientTransport({ command: "node", args: ["dist/index.js"], cwd: "D:/John MCP" }));
const call = (name, args) => c.callTool({ name, arguments: args });

const opened = await call("open_case", { objective: "latency demo", preferred_assets: ["polymath", "curiosity", "overseer"] });
const caseId = opened.content[0].text.match(/Case ([0-9a-f-]+) opened/)[1];

// A few real tasks — first call to each asset includes spawn+connect (real latency).
await call("task_asset", { case_id: caseId, asset: "polymath", tool: "day_in_the_life", arguments: { cluster: "data_bi" } });
await call("task_asset", { case_id: caseId, asset: "curiosity", tool: "explore", arguments: { topic: "space" } });
await call("task_asset", { case_id: caseId, asset: "polymath", tool: "day_in_the_life", arguments: { cluster: "cloud_infra" } });

const rep = await call("task_asset", { case_id: caseId, asset: "overseer", tool: "latency_report", arguments: {} });
console.log(rep.content.find((b) => b.text?.includes("LATENCY"))?.text ?? rep.content.map((b) => b.text).join("\n"));

await call("close_case", { case_id: caseId });
await c.close();
process.exit(0);
