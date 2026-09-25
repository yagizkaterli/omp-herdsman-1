import { expect, test } from "bun:test";
import { type } from "@oh-my-pi/omptype";
import { Agent, type AgentMessage, type AgentTool } from "@oh-my-pi/pi-agent-core";
import type { CompactionPreparation } from "@oh-my-pi/pi-agent-core/compaction";
import type { Model } from "@oh-my-pi/pi-ai";
import { createMockModel } from "@oh-my-pi/pi-ai/providers/mock";
import { buildModel } from "@oh-my-pi/pi-catalog/build";
import { ModelRegistry } from "../../coding-agent/src/config/model-registry";
import { Settings } from "../../coding-agent/src/config/settings";
import { AgentSession } from "../../coding-agent/src/session/agent-session";
import { AuthStorage } from "../../coding-agent/src/session/auth-storage";
import { convertToLlm } from "../../coding-agent/src/session/messages";
import { SessionManager } from "../../coding-agent/src/session/session-manager";

function model(id: string, contextWindow: number, codeMode = false): Model {
  return buildModel({ id, name: id, provider: codeMode ? "openai-codex" : "fixture", api: "openai-responses", baseUrl: "https://fixture.invalid",
    reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow, maxTokens: 512,
    ...(codeMode ? { toolMode: "code_mode_only" } : {}),
  });
}
function tool(name: string): AgentTool {
  return { name, label: name, description: name, parameters: type({}), async execute() { throw new Error("No tools are executed by this fixture"); } };
}

async function registry(): Promise<{ auth: AuthStorage; models: ModelRegistry }> {
  const auth = await AuthStorage.create(":memory:");
  auth.keys.setRuntime("fixture", "fixture-only");
  auth.keys.setRuntime("openai-codex", "fixture-only");
  return { auth, models: new ModelRegistry(auth) };
}

test("concrete request changes refresh native Code Mode and capacity without changing logical selection", async () => {
  const { auth, models } = await registry();
  const logical = model("logical", 100_000);
  const coded = model("coded", 4096, true);
  const direct = model("direct", 8192);
  let target = coded;
  const backend = createMockModel({ responses: [{ content: ["first"] }, { content: ["second"] }] });
  const tools = [{ ...tool("eval"), supportsCodeModeTransport: () => true }, tool("read")];
  const manager = SessionManager.inMemory();
  manager.appendModelChange("fixture/logical");
  const agent = new Agent({ initialState: { model: logical, systemPrompt: ["logical base"], tools }, convertToLlm,
    getApiKey: () => "fixture-only", streamFn: backend.stream, resolveRequest: () => ({ targets: [{ model: target }] }) });
  const session = new AgentSession({ agent, sessionManager: manager, modelRegistry: models,
    settings: Settings.isolated({ "compaction.enabled": false, "providers.openai-codex.codeMode": "auto" }),
    toolRegistry: new Map(tools.map(entry => [entry.name, entry])), builtInToolNames: tools.map(entry => entry.name),
    rebuildSystemPrompt: async (names, _tools, options) => ({ systemPrompt: [`native ${agent.requestModel?.id ?? logical.id}: ${(options?.directToolNames ?? names).join(",")}`] }),
  });
  agent.prepareRequestModel = (selected, signal) => session.prepareRequestModel(selected, signal);
  try {
    await session.prompt("First request");
    expect(backend.calls[0].context.tools?.map(entry => entry.name)).toEqual(["eval"]);
    expect(session.getEnabledToolNames()).toEqual(["eval", "read"]);
    expect(session.codeModeNamespacesInfo).toBeDefined();
    expect(backend.calls[0].context.systemPrompt).toEqual(["native coded: eval"]);
    expect(session.getContextUsage()?.contextWindow).toBe(4096);
    target = direct;
    await session.prompt("Second request");
    expect(backend.calls[1].context.tools?.map(entry => entry.name)).toEqual(["eval", "read"]);
    expect(backend.calls[1].context.systemPrompt).toEqual(["native direct: eval,read"]);
    expect(session.getContextUsage()?.contextWindow).toBe(8192);
    expect(session.model).toBe(logical);
    expect(manager.getEntries().filter(entry => entry.type === "model_change").map(entry => entry.model)).toEqual(["fixture/logical"]);
  } finally { await session.dispose(); auth.close(); }
});

test("smaller concrete target overflow compacts and retries instead of treating it as a different logical model", async () => {
  const { auth, models } = await registry();
  const logical = model("large-logical", 100_000);
  const target = model("small-target", 4096);
  const backend = createMockModel({ id: target.id, provider: target.provider, responses: [
    { stopReason: "error", errorMessage: "maximum context length is 4096 tokens; requested 6500 tokens", usage: { input: 6500 } },
    { content: ["Recovered after compaction"], usage: { input: 300, output: 8 } },
  ] });
  const history: AgentMessage[] = [];
  for (let index = 0; index < 6; index++) {
    history.push({ role: "user", content: `Earlier request ${index}`, timestamp: index * 2 });
    history.push({ role: "assistant", api: target.api, provider: target.provider, model: target.id,
      content: [{ type: "text", text: "Earlier evidence. ".repeat(300) }], stopReason: "stop", timestamp: index * 2 + 1,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    });
  }
  const manager = SessionManager.inMemory();
  manager.appendModelChange("fixture/large-logical");
  for (const message of history) manager.appendMessage(message);
  const reasons: string[] = [];
  const extensionRunner = {
    hasHandlers: (name: string) => name === "session_before_compact",
    emitBeforeAgentStart: async () => undefined,
    emit: async (event: { type: string; reason?: string; preparation?: CompactionPreparation }) => {
      if (event.type !== "session_before_compact" || !event.preparation) return;
      reasons.push(event.reason ?? "missing");
      return { compaction: { summary: "Earlier evidence summarized", firstKeptEntryId: event.preparation.firstKeptEntryId, tokensBefore: event.preparation.tokensBefore } };
    },
  };
  const agent = new Agent({ initialState: { model: logical, systemPrompt: ["fixture"], tools: [], messages: history }, convertToLlm,
    getApiKey: () => "fixture-only", streamFn: backend.stream, resolveRequest: () => ({ targets: [{ model: target }] }) });
  const session = new AgentSession({ agent, sessionManager: manager, modelRegistry: models,
    extensionRunner: extensionRunner as never,
    settings: Settings.isolated({ "compaction.enabled": true, "compaction.autoContinue": true, "compaction.methodOrder": ["soft"],
      "compaction.reserveTokens": 512, "compaction.keepRecentTokens": 512, "contextPromotion.enabled": false, "retry.enabled": false }),
  });
  agent.prepareRequestModel = (selected, signal) => session.prepareRequestModel(selected, signal);
  try {
    await session.prompt("Continue the current request");
    expect(reasons).toContain("overflow");
    expect(manager.getEntries().some(entry => entry.type === "compaction")).toBe(true);
    expect(backend.calls.length).toBe(2);
    expect(session.getLastAssistantMessage()?.content).toEqual([{ type: "text", text: "Recovered after compaction" }]);
    expect(session.model).toBe(logical);
    expect(session.getContextUsage()?.contextWindow).toBe(4096);
  } finally { await session.dispose(); auth.close(); }
});
