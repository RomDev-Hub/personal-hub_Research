import { NextResponse } from "next/server";
import { deleteSchedule, listSchedules, upsertSchedule } from "@/lib/schedule";
import type { ScheduleAction } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const jobs = await listSchedules();
    return NextResponse.json({ jobs });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi lịch" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      name: string;
      time: string;
      days?: number[];
      action: ScheduleAction;
      customMessage?: string;
      enabled?: boolean;
    };

    if (!body.name?.trim() || !body.time?.match(/^\d{2}:\d{2}$/)) {
      return NextResponse.json({ error: "Tên và giờ (HH:mm) không hợp lệ" }, { status: 400 });
    }

    if (body.action === "custom" && !body.customMessage?.trim()) {
      return NextResponse.json({ error: "Cần nội dung tin nhắn cho lịch tùy chỉnh" }, { status: 400 });
    }

    const job = await upsertSchedule({
      id: body.id,
      name: body.name.trim(),
      time: body.time,
      days: body.days ?? [],
      action: body.action,
      customMessage: body.customMessage,
      enabled: body.enabled,
    });

    return NextResponse.json({ job });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi lưu lịch" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  }
  const ok = await deleteSchedule(id);
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
