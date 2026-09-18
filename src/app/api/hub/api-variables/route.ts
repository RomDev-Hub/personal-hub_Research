import { NextResponse } from "next/server";
import {
  BUILTIN_REGISTRY_OPTIONS,
  readApiVariableRegistry,
  testBinding,
  writeApiVariableRegistry,
  type ApiVariableBinding,
  type ApiVariableRegistryFile,
} from "@/lib/api-variable-registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = readApiVariableRegistry();
  return NextResponse.json({
    ...data,
    builtinOptions: BUILTIN_REGISTRY_OPTIONS,
    persistFile: "data/api-variable-registry.json",
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "save" | "test" | "test_one";
      registry?: ApiVariableRegistryFile;
      binding?: ApiVariableBinding;
    };

    if (body.action === "save" && body.registry?.bindings) {
      writeApiVariableRegistry({ bindings: body.registry.bindings });
      return NextResponse.json({ ok: true, bindings: readApiVariableRegistry().bindings });
    }

    if (body.action === "test_one" && body.binding) {
      const r = await testBinding(body.binding);
      return NextResponse.json(r);
    }

    return NextResponse.json({ error: "action không hợp lệ" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi" },
      { status: 500 },
    );
  }
}
