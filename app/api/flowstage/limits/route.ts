import { NextResponse } from "next/server";
import { FlowstageError, getLimits } from "@/lib/flowstage/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const limits = await getLimits();
    return NextResponse.json(limits);
  } catch (err) {
    if (err instanceof FlowstageError) {
      return NextResponse.json(
        { error: err.message, body: err.body },
        { status: err.status },
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
