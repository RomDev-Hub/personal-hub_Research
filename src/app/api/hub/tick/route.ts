import { NextResponse } from "next/server";
import { getHubCronSecret } from "@/lib/hub-config";
import { runDueSchedules } from "@/lib/schedule-runner";
import { pollAndReplyTelegram } from "@/lib/telegram-bot";
import type { HubTickResult } from "@/lib/types";

export const dynamic = "force-dynamic";

function isLocalRequest(request: Request): boolean {
  const secret = getHubCronSecret();
  if (secret) {
    return request.headers.get("x-hub-secret") === secret;
  }
  const host = request.headers.get("host") ?? "";
  return host.startsWith("127.0.0.1") || host.startsWith("localhost");
}

export async function POST(request: Request) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [schedulesRan, telegram] = await Promise.all([runDueSchedules(), pollAndReplyTelegram()]);

    const result: HubTickResult = {
      schedulesRan,
      telegram,
      at: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Tick lỗi" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
