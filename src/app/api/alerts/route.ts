import { NextResponse } from "next/server";
import { deleteAlert, listAlerts, upsertAlert } from "@/lib/alerts";
import type { AlertAsset } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_ASSETS: AlertAsset[] = ["gold", "silver", "usdVnd", "sjcSell", "nhanSell"];

export async function GET() {
  try {
    const alerts = await listAlerts();
    return NextResponse.json({ alerts });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi đọc cảnh báo" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      asset: AlertAsset;
      upper?: number | null;
      lower?: number | null;
      enabled?: boolean;
      notifyTelegram?: boolean;
    };

    if (!body.asset || !VALID_ASSETS.includes(body.asset)) {
      return NextResponse.json({ error: "asset không hợp lệ" }, { status: 400 });
    }

    const upper = body.upper ?? null;
    const lower = body.lower ?? null;

    if (upper == null && lower == null) {
      return NextResponse.json({ error: "Cần ít nhất ngưỡng trên hoặc dưới" }, { status: 400 });
    }

    if (upper != null && lower != null && lower >= upper) {
      return NextResponse.json({ error: "Ngưỡng dưới phải nhỏ hơn ngưỡng trên" }, { status: 400 });
    }

    const alert = await upsertAlert({
      id: body.id,
      asset: body.asset,
      upper,
      lower,
      enabled: body.enabled ?? true,
      notifyTelegram: body.notifyTelegram ?? false,
    });

    return NextResponse.json({ alert });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi lưu cảnh báo" },
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

  const ok = await deleteAlert(id);
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy cảnh báo" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
