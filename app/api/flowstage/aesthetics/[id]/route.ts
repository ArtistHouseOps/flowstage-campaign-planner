import { NextResponse } from "next/server";
import { FlowstageError, getAesthetic } from "@/lib/flowstage/client";
import { KV_KEYS, redis } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const aesthetic = await getAesthetic(id);
    await redis().set(KV_KEYS.aestheticCache(id), aesthetic, { ex: 60 * 10 });
    return NextResponse.json(aesthetic);
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
