// Proxy-aware HTTP helpers.
//
// Node's built-in global `fetch` does not honour HTTP_PROXY / HTTPS_PROXY on
// its own. This environment's egress is routed through a local proxy
// (HTTPS_PROXY), so we need a dispatcher that actually uses it.
//
// Preferred path: `undici`'s ProxyAgent, dynamically imported so the script
// still runs in environments where the package isn't resolvable (it ships
// inside Node's internals but is not always importable as a bare
// specifier — see the runtime notes in scripts/README.md).
//
// Fallback path: shell out to `curl`, which already respects
// HTTP_PROXY/HTTPS_PROXY and the CA bundle configured for this session, and
// is present on every box we care about.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

const USER_AGENT = "complete-shelf-cover-fetcher/1.0 (+astro build script)";
const DEFAULT_TIMEOUT_MS = 20_000;

let strategyPromise;

/**
 * Decide once, lazily, how we're going to make outbound requests.
 * Returns { kind: 'undici', fetch, dispatcher } or { kind: 'curl' }.
 */
async function getStrategy() {
  if (!strategyPromise) {
    strategyPromise = (async () => {
      const proxyUrl =
        process.env.HTTPS_PROXY ||
        process.env.https_proxy ||
        process.env.HTTP_PROXY ||
        process.env.http_proxy;

      if (proxyUrl) {
        try {
          const undici = await import("undici");
          const dispatcher = new undici.ProxyAgent(proxyUrl);
          return { kind: "undici", fetchImpl: undici.fetch, dispatcher };
        } catch {
          // undici not importable as a bare specifier in this runtime —
          // fall through to the curl-based strategy below.
        }
      }

      return { kind: "curl" };
    })();
  }
  return strategyPromise;
}

/**
 * Fetch a URL's body as a Buffer, following redirects, with a status code.
 * Never throws for ordinary HTTP failure statuses — only for transport-level
 * problems (DNS, timeout, curl missing, etc). Callers should treat a
 * non-2xx status or a thrown error the same way: "no image here".
 */
export async function fetchBuffer(url, { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} } = {}) {
  const strategy = await getStrategy();

  if (strategy.kind === "undici") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await strategy.fetchImpl(url, {
        dispatcher: strategy.dispatcher,
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, ...headers },
      });
      const buffer = Buffer.from(await res.arrayBuffer());
      return { status: res.status, buffer, contentType: res.headers.get("content-type") || "" };
    } finally {
      clearTimeout(timer);
    }
  }

  return fetchBufferViaCurl(url, { timeoutMs, headers });
}

/** Fetch a URL's body as UTF-8 text (used for the Google Books JSON API). */
export async function fetchText(url, opts = {}) {
  const { status, buffer, contentType } = await fetchBuffer(url, opts);
  return { status, text: buffer.toString("utf8"), contentType };
}

async function fetchBufferViaCurl(url, { timeoutMs, headers }) {
  const dir = await mkdtemp(path.join(tmpdir(), "covers-http-"));
  const outFile = path.join(dir, "body");
  try {
    const args = [
      "-sS",
      "-L",
      "--max-time",
      String(Math.ceil(timeoutMs / 1000)),
      "-A",
      USER_AGENT,
      "-o",
      outFile,
      "-w",
      "%{http_code}",
    ];
    for (const [key, value] of Object.entries(headers)) {
      args.push("-H", `${key}: ${value}`);
    }
    args.push(url);

    const { stdout } = await execFileAsync("curl", args, { maxBuffer: 1024 * 1024 });
    const status = Number.parseInt(stdout.trim(), 10) || 0;
    const buffer = await readFile(outFile).catch(() => Buffer.alloc(0));
    return { status, buffer, contentType: "" };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
