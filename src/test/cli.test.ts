import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfigFile, parseCliOptions, resolveCredentials } from "../cli.js";

test("parses --api-key, --api-url and --profile in both forms", () => {
  assert.deepEqual(parseCliOptions([]), {});
  assert.deepEqual(parseCliOptions(["--api-key", "zvid_abc"]), { apiKey: "zvid_abc" });
  assert.deepEqual(parseCliOptions(["--api-key=zvid_abc"]), { apiKey: "zvid_abc" });
  assert.deepEqual(
    parseCliOptions(["--api-key", "zvid_abc", "--api-url", "http://localhost:4000"]),
    { apiKey: "zvid_abc", apiUrl: "http://localhost:4000" }
  );
  assert.deepEqual(parseCliOptions(["--api-url=http://localhost:4000"]), {
    apiUrl: "http://localhost:4000",
  });
  assert.deepEqual(parseCliOptions(["--profile", "advanced"]), {
    profile: "advanced",
  });
  assert.deepEqual(parseCliOptions(["--profile=developer"]), {
    profile: "developer",
  });
});

test("ignores unknown arguments", () => {
  assert.deepEqual(parseCliOptions(["-y", "@zvid/mcp", "--verbose"]), {});
});

test("loadConfigFile reads the optional config file and tolerates absence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zvid-mcp-test-"));
  const file = path.join(dir, ".zvid-mcp.json");
  try {
    // absent file → empty options
    assert.deepEqual(loadConfigFile(file), {});

    fs.writeFileSync(file, JSON.stringify({ apiKey: "zvid_file", apiUrl: "http://localhost:4000" }));
    assert.deepEqual(loadConfigFile(file), { apiKey: "zvid_file", apiUrl: "http://localhost:4000" });

    // partial file → only the provided field
    fs.writeFileSync(file, JSON.stringify({ apiUrl: "http://localhost:4000" }));
    assert.deepEqual(loadConfigFile(file), { apiUrl: "http://localhost:4000" });

    fs.writeFileSync(file, JSON.stringify({ profile: "readonly" }));
    assert.deepEqual(loadConfigFile(file), { profile: "readonly" });

    // junk file → empty options, no throw
    fs.writeFileSync(file, "not json");
    assert.deepEqual(loadConfigFile(file), {});

    // override flag parsed only when literally true
    fs.writeFileSync(file, JSON.stringify({ apiUrl: "http://x", override: true }));
    assert.deepEqual(loadConfigFile(file), { apiUrl: "http://x", override: true });
    fs.writeFileSync(file, JSON.stringify({ apiUrl: "http://x", override: "yes" }));
    assert.deepEqual(loadConfigFile(file), { apiUrl: "http://x" });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveCredentials: flags > env > file, unless the file sets override", () => {
  const cli = { apiKey: "zvid_flag" };
  const env = { apiKey: "zvid_env", apiUrl: "http://env" };
  const file = { apiKey: "zvid_file", apiUrl: "http://file" };

  // default order
  assert.deepEqual(resolveCredentials({}, env, file), { apiKey: "zvid_env", apiUrl: "http://env" });
  assert.deepEqual(resolveCredentials(cli, env, file), { apiKey: "zvid_flag", apiUrl: "http://env" });
  assert.deepEqual(resolveCredentials({}, {}, file), { apiKey: "zvid_file", apiUrl: "http://file" });
  assert.deepEqual(resolveCredentials({}, {}, {}), { apiKey: "", apiUrl: undefined });

  // override: file beats env, flags still beat file
  const overrideFile = { ...file, override: true };
  assert.deepEqual(resolveCredentials({}, env, overrideFile), { apiKey: "zvid_file", apiUrl: "http://file" });
  assert.deepEqual(resolveCredentials(cli, env, overrideFile), { apiKey: "zvid_flag", apiUrl: "http://file" });

  // override with a partial file falls back to env for missing fields
  assert.deepEqual(resolveCredentials({}, env, { apiUrl: "http://file", override: true }), {
    apiKey: "zvid_env",
    apiUrl: "http://file",
  });
});

test("resolveCredentials applies the same precedence to tool profiles", () => {
  assert.deepEqual(
    resolveCredentials(
      { profile: "developer" },
      { apiKey: "zvid_env", profile: "advanced" },
      { profile: "readonly" },
    ),
    { apiKey: "zvid_env", apiUrl: undefined, profile: "developer" },
  );
  assert.deepEqual(
    resolveCredentials(
      {},
      { apiKey: "zvid_env", profile: "advanced" },
      { profile: "readonly", override: true },
    ),
    { apiKey: "zvid_env", apiUrl: undefined, profile: "readonly" },
  );
});
