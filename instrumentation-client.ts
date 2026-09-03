/**
 * @mcp-b/global auto-initializes document.modelContext when the module is
 * imported.  The import side-effect alone is enough — no manual calls needed.
 *
 * Previously this file deleted document.modelContext before re-calling
 * initializeWebModelContext(), but the library's internal `runtime` guard
 * treated the second call as a no-op, leaving modelContext destroyed.
 */
import "@mcp-b/global";
