/**
 * CLI option parsing + config-file fallback for the zvid-mcp entry point.
 *
 * Credential resolution order (first match wins per field):
 *   1. command-line flags   --api-key / --api-url
 *   2. env vars             ZVID_API_KEY / ZVID_API_URL
 *   3. config file          ~/.zvid-mcp.json  { "apiKey": "...", "apiUrl": "..." }
 *   4. default API URL      https://api.zvid.io
 *
 * Flags exist because some MCP hosts offer no way to set environment
 * variables on a server entry; the config file exists because some hosts
 * cache a server's env/args until an app restart — dropping a
 * ~/.zvid-mcp.json lets you fix a missing field without restarting the host:
 *
 *   npx -y zvid-mcp --api-key zvid_xxx --api-url http://localhost:4000
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface CliOptions {
  apiKey?: string;
  apiUrl?: string;
}

export interface FileConfig extends CliOptions {
  /**
   * When true, the file's values take precedence over env vars (flags still
   * win over everything). Escape hatch for MCP hosts that cache a server's
   * env until an app restart: editing this file + a server respawn is enough
   * to change credentials, no host restart needed.
   */
  override?: boolean;
}

export const CONFIG_FILE_NAME = ".zvid-mcp.json";

/**
 * Read ~/.zvid-mcp.json (or the file at ZVID_MCP_CONFIG). Returns {} when the
 * file is absent or unreadable — the config file is always optional.
 */
export function loadConfigFile(filePath?: string): FileConfig {
  const target =
    filePath ?? process.env.ZVID_MCP_CONFIG ?? path.join(os.homedir(), CONFIG_FILE_NAME);
  try {
    const raw = JSON.parse(fs.readFileSync(target, "utf8")) as Record<string, unknown>;
    const opts: FileConfig = {};
    if (typeof raw.apiKey === "string" && raw.apiKey) opts.apiKey = raw.apiKey;
    if (typeof raw.apiUrl === "string" && raw.apiUrl) opts.apiUrl = raw.apiUrl;
    if (raw.override === true) opts.override = true;
    return opts;
  } catch {
    return {};
  }
}

/**
 * Resolve the effective credentials from flags, env and the config file.
 * Order: flags > env > file — unless the file sets override: true, in which
 * case: flags > file > env.
 */
export function resolveCredentials(
  cli: CliOptions,
  env: { apiKey?: string; apiUrl?: string },
  file: FileConfig
): { apiKey: string; apiUrl?: string } {
  const first = (...vals: Array<string | undefined>) => vals.find((v) => !!v);
  const apiKey = file.override
    ? first(cli.apiKey, file.apiKey, env.apiKey)
    : first(cli.apiKey, env.apiKey, file.apiKey);
  const apiUrl = file.override
    ? first(cli.apiUrl, file.apiUrl, env.apiUrl)
    : first(cli.apiUrl, env.apiUrl, file.apiUrl);
  return { apiKey: apiKey ?? "", apiUrl };
}

export function parseCliOptions(argv: string[]): CliOptions {
  const opts: CliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const grab = (name: string): string | undefined => {
      if (arg === name) return argv[++i];
      if (arg.startsWith(name + "=")) return arg.slice(name.length + 1);
      return undefined;
    };
    const key = grab("--api-key");
    if (key !== undefined) {
      opts.apiKey = key;
      continue;
    }
    const url = grab("--api-url");
    if (url !== undefined) {
      opts.apiUrl = url;
      continue;
    }
  }
  return opts;
}
