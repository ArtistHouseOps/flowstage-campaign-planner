import { NextResponse } from "next/server";
import { FlowstageError, getSocialAccounts } from "@/lib/flowstage/client";
import { KV_KEYS, redis } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { accounts } = await getSocialAccounts();
    await redis().set(KV_KEYS.accountsCache(), accounts);
    return NextResponse.json({ accounts });
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
