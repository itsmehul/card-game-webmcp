import { NextResponse } from "next/server";

/** Default download is the playbook, not the schema reference. */
export function GET(request: Request) {
  return NextResponse.redirect(
    new URL("/skills/card-table/SKILL.md", request.url),
    307,
  );
}
