import { execFile, execFileSync } from "node:child_process";
import path from "node:path";
import { getCliToolsExtraPathSegments } from "../../config.js";
import { getCliToolByKey } from "./cli-tool-registry.js";
import type { CliToolDefinition } from "./cli-tool-registry.js";
import {
  isCustomCliProgram,
  parseArgsText,
  validateCustomArgv,
} from "./parse-cli-args.js";

export type CliToolRunResult = {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  error?: string;
};

/** `go install` drops binaries here; shells/IDEs often omit it from PATH. */
function goInstallBinDirs(): string[] {
  const dirs: string[] = [];
  const home = process.env.HOME ?? process.env.USERPROFILE;
  if (home) dirs.push(path.join(home, "go", "bin"));
  try {
    const gopath = execFileSync("go", ["env", "GOPATH"], { encoding: "utf8" }).trim();
    if (gopath) dirs.push(path.join(gopath, "bin"));
  } catch {
    /* go missing */
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of dirs) {
    const n = path.normalize(d);
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

function pathContainsSegment(envPath: string | undefined, segment: string): boolean {
  if (!envPath || !segment) return false;
  let resolvedSeg: string;
  try {
    resolvedSeg = path.resolve(segment);
  } catch {
    return false;
  }
  for (const p of envPath.split(path.delimiter)) {
    if (!p) continue;
    try {
      if (path.resolve(p) === resolvedSeg) return true;
    } catch {
      /* ignore bad path entries */
    }
  }
  return false;
}

function augmentEnvPathWithGoBin(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const cur = env.PATH ?? "";
  const manual = getCliToolsExtraPathSegments();
  const goBins = goInstallBinDirs();
  const extra = [...manual, ...goBins].filter((d) => !pathContainsSegment(cur, d));
  if (extra.length === 0) return env;
  return {
    ...env,
    PATH: `${extra.join(path.delimiter)}${path.delimiter}${cur}`,
  };
}

function execFileUtf8(
  file: string,
  args: string[],
  opts: { timeout: number; maxBuffer: number; env: NodeJS.ProcessEnv },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      {
        ...opts,
        encoding: "utf8",
        shell: false,
      },
      (err, stdout, stderr) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });
}

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_BUFFER = 512 * 1024;

export async function runCliSpawn(
  program: string,
  args: string[],
  options: { timeoutMs?: number; maxBuffer?: number } = {},
): Promise<CliToolRunResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBuffer = options.maxBuffer ?? DEFAULT_MAX_BUFFER;
  const t0 = Date.now();
  const env = augmentEnvPathWithGoBin(process.env);
  try {
    const r = await execFileUtf8(program, args, {
      timeout: timeoutMs,
      maxBuffer,
      env,
    });
    const durationMs = Date.now() - t0;
    return {
      ok: true,
      exitCode: 0,
      stdout: r.stdout.slice(0, 256_000),
      stderr: r.stderr.slice(0, 64_000),
      durationMs,
    };
  } catch (e: unknown) {
    const durationMs = Date.now() - t0;
    const err = e as {
      code?: number | string;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    const stderr = String(err.stderr ?? "");
    const stdout = String(err.stdout ?? "");
    const exitCode =
      typeof err.code === "number" && Number.isFinite(err.code) ? Math.trunc(err.code) : 1;
    const ok = exitCode === 0;
    return {
      ok,
      exitCode,
      stdout: stdout.slice(0, 256_000),
      stderr: (stderr || err.message || "").slice(0, 64_000),
      durationMs,
      error: typeof err.code === "string" ? err.code : undefined,
    };
  }
}

export async function runAllowlistedCliTool(toolKey: string): Promise<CliToolRunResult> {
  const def = getCliToolByKey(toolKey);
  if (!def) {
    return {
      ok: false,
      exitCode: 2,
      stdout: "",
      stderr: "",
      durationMs: 0,
      error: "unknown_tool_key",
    };
  }
  return runCliFromDefinition(def);
}

export async function runCliFromDefinition(def: CliToolDefinition): Promise<CliToolRunResult> {
  return runCliSpawn(def.program, def.args, {
    timeoutMs: def.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxBuffer: def.maxBuffer ?? DEFAULT_MAX_BUFFER,
  });
}

/** Operator free-text argv for allowlisted `*-pp-cli` basenames only (no shell). */
export async function runCustomCliFromText(
  program: string,
  argsText: string,
): Promise<CliToolRunResult> {
  if (!isCustomCliProgram(program)) {
    return {
      ok: false,
      exitCode: 2,
      stdout: "",
      stderr: "",
      durationMs: 0,
      error: "invalid_program",
    };
  }
  const argv = parseArgsText(argsText);
  const v = validateCustomArgv(argv);
  if (!v.ok) {
    return {
      ok: false,
      exitCode: 2,
      stdout: "",
      stderr: v.message,
      durationMs: 0,
      error: v.message,
    };
  }
  return runCliSpawn(program, v.argv, {
    timeoutMs: 120_000,
    maxBuffer: 2 * 1024 * 1024,
  });
}
