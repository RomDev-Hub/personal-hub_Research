import { NextResponse } from "next/server";
import {
  buildConfigFieldsView,
  clearAllFileOverrides,
  clearConfigField,
  hasHubConfigBackup,
  readHubConfigFile,
  restoreHubConfigFromBackup,
  saveConfigField,
} from "@/lib/hub-config";
import { validateTelegramChatId } from "@/lib/telegram-validate";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section");
  let fields = buildConfigFieldsView();
  if (section === "telegram") fields = fields.filter((f) => f.key.startsWith("telegram."));
  else if (section === "api" || section === "hub") {
    fields = fields.filter((f) => f.key.startsWith("hub."));
  }

  const file = readHubConfigFile();
  return NextResponse.json({
    fields,
    updatedAt: file.updatedAt ?? null,
    hasBackup: hasHubConfigBackup(),
    note: "Lưu qua UI ghi thẳng data/hub-config.json trên đĩa — giữ khi tắt/mở lại app. File ghi đè .env.local lúc chạy. Khôi phục = hub-config.backup.json.",
    persistFile: "data/hub-config.json",
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "save" | "clear" | "restore_backup" | "restore_env";
      key?: string;
      value?: string;
    };

    if (body.action === "restore_backup") {
      const ok = restoreHubConfigFromBackup();
      if (!ok) {
        return NextResponse.json({ error: "Chưa có bản backup" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, fields: buildConfigFieldsView() });
    }

    if (body.action === "restore_env") {
      clearAllFileOverrides();
      return NextResponse.json({ ok: true, fields: buildConfigFieldsView() });
    }

    if (!body.key) {
      return NextResponse.json({ error: "Thiếu key" }, { status: 400 });
    }

    if (body.action === "clear") {
      clearConfigField(body.key);
      return NextResponse.json({ ok: true, fields: buildConfigFieldsView() });
    }

    if (body.action === "save") {
      if (typeof body.value !== "string" || !body.value.trim()) {
        return NextResponse.json({ error: "Giá trị không được trống" }, { status: 400 });
      }
      if (body.key === "telegram.chatId") {
        const chatErr = validateTelegramChatId(body.value);
        if (chatErr) {
          return NextResponse.json({ error: chatErr }, { status: 400 });
        }
      }
      saveConfigField(body.key, body.value);
      return NextResponse.json({ ok: true, fields: buildConfigFieldsView() });
    }

    return NextResponse.json({ error: "action không hợp lệ" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi lưu cấu hình" },
      { status: 500 },
    );
  }
}
