import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { MonitorAlertEvent, MonitorSnapshot, MonitorStateFile } from "./types.js";

interface LegacyMonitorStateFile {
  version: 1;
  wallets: Record<string, MonitorSnapshot>;
}

const emptyState = (): MonitorStateFile => ({
  version: 2,
  wallets: {},
  pendingAlerts: {},
});

function normalizeState(parsed: unknown): MonitorStateFile {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("invalid monitor state schema");
  }

  const candidate = parsed as Partial<MonitorStateFile & LegacyMonitorStateFile>;
  if (!candidate.wallets || typeof candidate.wallets !== "object") {
    throw new Error("invalid monitor state schema");
  }

  if (candidate.version === 1) {
    return {
      version: 2,
      wallets: candidate.wallets,
      pendingAlerts: {},
    };
  }

  if (
    candidate.version !== 2 ||
    !candidate.pendingAlerts ||
    typeof candidate.pendingAlerts !== "object"
  ) {
    throw new Error("invalid monitor state schema");
  }

  return {
    version: 2,
    wallets: candidate.wallets,
    pendingAlerts: candidate.pendingAlerts as Record<string, MonitorAlertEvent>,
  };
}

export class JsonMonitorStore {
  lastRecoveredCorruptPath: string | null = null;

  constructor(private readonly path: string) {}

  async load(): Promise<MonitorStateFile> {
    this.lastRecoveredCorruptPath = null;

    try {
      const raw = await readFile(this.path, "utf8");
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        return emptyState();
      }

      await mkdir(dirname(this.path), { recursive: true });
      const corruptPath = `${this.path}.corrupt-${Date.now()}`;
      await rename(this.path, corruptPath);
      this.lastRecoveredCorruptPath = corruptPath;
      return emptyState();
    }
  }

  async save(state: MonitorStateFile): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const tempPath = `${this.path}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(tempPath, this.path);
  }
}
