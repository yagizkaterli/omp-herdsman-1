import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import { buildSessionProjection, readSessionSnapshot } from "../../coding-agent/src/session/session-projection";
import type { FileEntry, SessionEntry } from "../../coding-agent/src/session/session-entries";
import { SessionManager } from "../../coding-agent/src/session/session-manager";

const timestamp = "2026-09-25T00:00:00.000Z";
const assistant: AssistantMessage = {
  role: "assistant", content: [{ type: "text", text: "answer" }], api: "anthropic-messages", provider: "fixture", model: "fixture",
  usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
  stopReason: "stop", timestamp: 0,
};

function fixture(entries: FileEntry[], run: (file: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-herdsman-session-"));
  const file = path.join(dir, "session.jsonl");
  try { fs.writeFileSync(file, entries.map(entry => JSON.stringify(entry)).join("\n") + "\n"); run(file); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const header = { type: "session" as const, version: 3, id: "019974fb-c800-7000-8000-000000000001", cwd: "/tmp", timestamp };
const root: SessionEntry = { type: "message", id: "root", parentId: null, timestamp, message: { role: "user", content: "question", timestamp: 0 } };

describe("native session projections", () => {
  test("keeps selected branch attribution and native model identity without sibling leakage", () => {
    const entries: SessionEntry[] = [root,
      { type: "model_change", id: "model", parentId: "root", timestamp, model: "fixture/target", role: "default" },
      { type: "message", id: "sibling", parentId: "root", timestamp, message: { ...assistant, content: [{ type: "text", text: "wrong branch" }] } },
      { type: "custom_message", id: "context", parentId: "model", timestamp, customType: "supervision", content: "owned snapshot", display: false },
      { type: "message", id: "answer", parentId: "context", timestamp, message: assistant },
    ];
    const projection = buildSessionProjection(entries, "answer");
    expect(projection.entries.map(entry => entry.sourceEntry.id)).toEqual(["root", "model", "context", "answer"]);
    expect(projection.context.models.default).toBe("fixture/target");
    expect(projection.entries.find(entry => entry.sourceEntry.id === "context")?.messages[0]).toMatchObject({ role: "custom", content: "owned snapshot", display: false });
    expect(buildSessionProjection(entries, null).entries).toEqual([]);
    expect(() => buildSessionProjection(entries, "missing")).toThrow("leaf does not exist");
  });

  test("attributes rewritten dangling calls to the original assistant entry", () => {
    const entry: SessionEntry = { type: "message", id: "call", parentId: "root", timestamp, message: { ...assistant, content: [
      { type: "text", text: "before interruption" }, { type: "toolCall", id: "orphan", name: "read", arguments: { path: "secret" } },
    ] } };
    const projection = buildSessionProjection([root, entry]);
    expect(projection.entries[1].sourceEntry).toBe(entry);
    expect(projection.entries[1].messages[0]).toMatchObject({ content: [{ type: "text", text: "before interruption" }], strippedToolCalls: 1 });
    expect(entry.message.content).toHaveLength(2);
  });

  test("does not write or reinterpret an exact persisted ownership identity", () => {
    fixture([header, root, { type: "custom", id: "owner", parentId: "root", timestamp, customType: "omp-herdsman-agent-definition", data: { sessionId: header.id, definition: "scout", label: "scout" } }], file => {
      const bytes = fs.readFileSync(file);
      const snapshot = readSessionSnapshot(file);
      expect(snapshot.header.id).toBe(header.id);
      expect(snapshot.entries[1]).toMatchObject({ customType: "omp-herdsman-agent-definition", data: { sessionId: header.id } });
      expect(fs.readFileSync(file)).toEqual(bytes);
    });
  });

  test("rejects corrupt and cyclic ancestry before ownership can be inferred", () => {
    fixture([header, root, { ...root, id: "cycle", parentId: "cycle" }], file => expect(() => readSessionSnapshot(file)).toThrow("ancestry"));
    fixture([header, root, root], file => expect(() => readSessionSnapshot(file)).toThrow("duplicate"));
    fixture([header, root], file => { fs.appendFileSync(file, "{partial"); expect(() => readSessionSnapshot(file)).toThrow("incomplete"); });
  });

  test("loads native title-slot journals and forked sessions without changing the source", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-herdsman-native-fork-"));
    const manager = SessionManager.create(dir, dir);
    let fork: SessionManager | undefined;
    try {
      manager.appendMessage(root.message);
      await manager.setSessionName("Original", "user");
      await manager.ensureOnDisk();
      await manager.flush();
      const file = manager.getSessionFile()!;
      const bytes = fs.readFileSync(file);
      expect(readSessionSnapshot(file).header.title).toBe("Original");
      fork = await SessionManager.forkFrom(file, dir, dir);
      await fork.flush();
      const snapshot = readSessionSnapshot(fork.getSessionFile()!);
      expect(snapshot.header.id).not.toBe(manager.getSessionId());
      expect(snapshot.header.parentSession).toBe(manager.getSessionId());
      expect(buildSessionProjection(snapshot.entries).context.messages).toMatchObject([{ role: "user", content: "question" }]);
      expect(fs.readFileSync(file)).toEqual(bytes);
    } finally {
      await fork?.close();
      await manager.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
