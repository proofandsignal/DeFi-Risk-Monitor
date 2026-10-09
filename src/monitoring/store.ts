import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { MonitorStateFile } from "./types.js";

const EMPTY_STATE: MonitorStateFile = { version: 1, wallets: {} };

export class JsonMonitorStore {
  constructor(private readonly path: string) {}

  async load(): Promise<MonitorStateFile> {
    try {
      const raw = await readFile(this.path, "utf8");
      const parsed = JSON.parse(raw) as MonitorStateFile;
      if (parsed.version !== 1 || !parsed.wallets || typeof parsed.wallets !== "object") {
        throw new Error("invalid monitor state schema");
      }
      return parsed;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        return structuredClone(EMPTY_STATE);
      }
      throw error;
    }
  }

  async save(state: MonitorStateFile): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const tempPath = `${this.path}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(tempPath, this.path);
  }
}
