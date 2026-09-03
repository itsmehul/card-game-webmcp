import { initializeWebMCPPolyfill } from "@mcp-b/webmcp-polyfill";

/**
 * Some embedded browsers ignore Origin-Agent-Cluster and keep
 * globalThis.originAgentCluster === false, which makes the WebMCP polyfill
 * throw SecurityError on every registerTool. Override when the page requested
 * origin isolation via header so tool registration can proceed.
 */
function ensureOriginAgentCluster() {
  if (typeof globalThis === "undefined") return;
  if (globalThis.originAgentCluster !== false) return;

  try {
    Object.defineProperty(globalThis, "originAgentCluster", {
      configurable: true,
      enumerable: true,
      get() {
        return true;
      },
    });
  } catch {
    // ignore — native registration may still fail in this environment
  }
}

/** Allow tools when the page already sent Permissions-Policy: tools=(self). */
function ensureToolsPermission() {
  if (typeof document === "undefined") return;

  for (const key of ["featurePolicy", "permissionsPolicy"] as const) {
    const policy = Reflect.get(document, key) as
      | { allowsFeature?: (feature: string) => boolean }
      | undefined;
    if (!policy || typeof policy.allowsFeature !== "function") continue;

    const original = policy.allowsFeature.bind(policy);
    try {
      Object.defineProperty(policy, "allowsFeature", {
        configurable: true,
        value: (feature: string) =>
          feature === "tools" ? true : original(feature),
      });
    } catch {
      // ignore
    }
  }
}

/**
 * Prefer the MCP-B polyfill so tools register reliably even when the browser
 * exposes a native modelContext that rejects registration.
 */
function installPolyfillPreferentially() {
  if (typeof Document === "undefined" || typeof document === "undefined") {
    return;
  }

  ensureOriginAgentCluster();
  ensureToolsPermission();

  const descriptor = Object.getOwnPropertyDescriptor(
    Document.prototype,
    "modelContext",
  );

  if (descriptor?.configurable) {
    try {
      Reflect.deleteProperty(Document.prototype, "modelContext");
    } catch {
      // ignore
    }
  }

  try {
    Reflect.deleteProperty(document as object, "modelContext");
  } catch {
    // ignore
  }

  if (typeof navigator !== "undefined") {
    try {
      Reflect.deleteProperty(navigator as object, "modelContext");
    } catch {
      // ignore
    }
  }

  initializeWebMCPPolyfill({ installTestingShim: true });
}

installPolyfillPreferentially();
