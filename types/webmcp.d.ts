interface WebMCPRegisteredTool {
  name: string;
  description?: string;
  inputSchema?: object;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
    untrustedContentHint?: boolean;
  };
  origin?: string;
  title?: string;
}

interface WebMCPModelContext extends EventTarget {
  registerTool(
    tool: {
      name: string;
      description: string;
      inputSchema?: object;
      outputSchema?: object;
      annotations?: {
        readOnlyHint?: boolean;
        destructiveHint?: boolean;
        idempotentHint?: boolean;
        openWorldHint?: boolean;
        untrustedContentHint?: boolean;
      };
      execute: (
        input: Record<string, unknown> | undefined,
      ) => unknown | Promise<unknown>;
    },
    options?: { signal?: AbortSignal; exposedTo?: string[] },
  ): Promise<void> | void;
  getTools(options?: { fromOrigins?: string[] }): Promise<WebMCPRegisteredTool[]>;
  executeTool?(
    tool: WebMCPRegisteredTool,
    inputJson: string,
    options?: { signal?: AbortSignal },
  ): Promise<string | null>;
}

interface Document {
  modelContext?: WebMCPModelContext;
}
