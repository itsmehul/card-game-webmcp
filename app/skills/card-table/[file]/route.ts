import { readFile } from "node:fs/promises";
import path from "node:path";

const FILES = new Set(["SKILL.md", "reference.md"]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ file: string }> },
) {
  const { file } = await context.params;
  if (!FILES.has(file)) {
    return new Response("Not found", { status: 404 });
  }

  const body = await readFile(
    path.join(process.cwd(), ".cursor/skills/card-table", file),
    "utf8",
  );

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
