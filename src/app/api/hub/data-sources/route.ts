import { NextResponse } from "next/server";
import { groupsFromLegacyRegistry } from "@/lib/data-sources/migrate-registry";
import { BUNDLED_PRESETS, BUILTIN_FIELD_OPTIONS, getPresetById } from "@/lib/data-sources/presets";
import { testKeypoint, findDuplicateKeys } from "@/lib/data-sources/resolve";
import {
  readDataSourcesFile,
  writeDataSourcesFile,
  getDataSourcesPersistPath,
} from "@/lib/data-sources/storage";
import type { DataSourceGroup, DataSourcesFile, Keypoint } from "@/lib/data-sources/types";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = readDataSourcesFile();
  return NextResponse.json({
    ...data,
    persistFile: getDataSourcesPersistPath(),
    presets: BUNDLED_PRESETS.map((p) => ({
      id: p.presetId ?? p.id,
      name: p.name,
      description: p.description,
      kind: p.kind,
    })),
    builtinFieldOptions: BUILTIN_FIELD_OPTIONS,
    duplicateKeys: findDuplicateKeys(data),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "save" | "test_keypoint" | "add_preset" | "import_registry";
      file?: DataSourcesFile;
      group?: DataSourceGroup;
      keypoint?: Keypoint;
      presetId?: string;
    };

    if (body.action === "save" && body.file?.groups) {
      writeDataSourcesFile(body.file);
      return NextResponse.json({ ok: true, ...readDataSourcesFile() });
    }

    if (body.action === "test_keypoint" && body.group && body.keypoint) {
      const r = await testKeypoint(body.group, body.keypoint);
      return NextResponse.json(r);
    }

    if (body.action === "add_preset" && body.presetId) {
      const preset = getPresetById(body.presetId);
      if (!preset) return NextResponse.json({ error: "Không tìm thấy mẫu" }, { status: 404 });
      const file = readDataSourcesFile();
      preset.order = file.groups.length;
      writeDataSourcesFile({ groups: [...file.groups, preset] });
      return NextResponse.json({ ok: true, groups: readDataSourcesFile().groups });
    }

    if (body.action === "import_registry") {
      const file = readDataSourcesFile();
      const imported = groupsFromLegacyRegistry();
      imported.order = file.groups.length;
      writeDataSourcesFile({ groups: [...file.groups, imported] });
      return NextResponse.json({ ok: true, groups: readDataSourcesFile().groups });
    }

    return NextResponse.json({ error: "action không hợp lệ" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi" },
      { status: 500 },
    );
  }
}
