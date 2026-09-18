import { NextResponse } from "next/server";
import {
  applyNamedTemplate,
  DEFAULT_REPLY_COMMANDS,
  deleteNamedTemplate,
  hydrateReplyCommands,
  previewReplyCommand,
  readTelegramRepliesFile,
  resetTelegramReplyCommands,
  REPLY_TEMPLATES,
  REPLY_VARIABLE_HINTS,
  saveNamedTemplate,
  saveTelegramReplyCommands,
  type TelegramReplyCommand,
} from "@/lib/telegram-replies";
import { readApiVariableRegistry } from "@/lib/api-variable-registry";
import { collectPublishedKeys } from "@/lib/data-sources/resolve";
import { readDataSourcesFile } from "@/lib/data-sources/storage";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET() {
  const file = readTelegramRepliesFile();
  const reg = readApiVariableRegistry();
  const customHints = reg.bindings
    .filter((b) => b.enabled && b.variableKey.trim())
    .map((b) => `{{${b.variableKey.replace(/[{}]/g, "").trim()}}}`);
  const dsHints = collectPublishedKeys(readDataSourcesFile()).map((x) => `{{${x.key}}}`);
  const variableHints = [...new Set([...REPLY_VARIABLE_HINTS, ...customHints, ...dsHints])];

  return NextResponse.json({
    commands: hydrateReplyCommands(file.commands),
    savedTemplates: file.savedTemplates ?? [],
    defaultTemplates: REPLY_TEMPLATES,
    defaultDisabledReply: file.defaultDisabledReply,
    unknownReply: file.unknownReply,
    updatedAt: file.updatedAt ?? null,
    variableHints,
    persistFile: "data/telegram-replies.json",
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?:
        | "save"
        | "reset"
        | "test"
        | "preview"
        | "save_template"
        | "delete_template"
        | "apply_template";
      commands?: TelegramReplyCommand[];
      defaultDisabledReply?: string;
      unknownReply?: string;
      commandId?: string;
      send?: boolean;
      templateName?: string;
      templateId?: string;
    };

    if (body.action === "reset") {
      const file = resetTelegramReplyCommands();
      return NextResponse.json({ ok: true, ...file, defaults: DEFAULT_REPLY_COMMANDS });
    }

    if (body.action === "save" && body.commands) {
      saveTelegramReplyCommands(body.commands, {
        defaultDisabledReply: body.defaultDisabledReply,
        unknownReply: body.unknownReply,
      });
      return NextResponse.json({ ok: true, commands: readTelegramRepliesFile().commands });
    }

    if ((body.action === "test" || body.action === "preview") && body.commandId) {
      const { text } = await previewReplyCommand(body.commandId);
      if (body.action === "test" && body.send !== false) {
        const sent = await sendTelegramMessage(text);
        return NextResponse.json({ ok: sent.ok, text, error: sent.error, sent: true });
      }
      return NextResponse.json({ ok: true, text, sent: false });
    }

    if (body.action === "save_template" && body.templateName?.trim()) {
      const current = readTelegramRepliesFile();
      const t = saveNamedTemplate(body.templateName.trim(), {
        commands: current.commands,
        defaultDisabledReply: current.defaultDisabledReply,
        unknownReply: current.unknownReply,
      });
      return NextResponse.json({ ok: true, template: t, savedTemplates: readTelegramRepliesFile().savedTemplates });
    }

    if (body.action === "delete_template" && body.templateId) {
      const ok = deleteNamedTemplate(body.templateId);
      if (!ok) return NextResponse.json({ error: "Không tìm thấy mẫu" }, { status: 404 });
      return NextResponse.json({ ok: true, savedTemplates: readTelegramRepliesFile().savedTemplates });
    }

    if (body.action === "apply_template" && body.templateId) {
      const ok = applyNamedTemplate(body.templateId);
      if (!ok) return NextResponse.json({ error: "Không tìm thấy mẫu" }, { status: 404 });
      const file = readTelegramRepliesFile();
      return NextResponse.json({
        ok: true,
        commands: file.commands,
        defaultDisabledReply: file.defaultDisabledReply,
        unknownReply: file.unknownReply,
      });
    }

    return NextResponse.json({ error: "action không hợp lệ" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi" },
      { status: 500 },
    );
  }
}
