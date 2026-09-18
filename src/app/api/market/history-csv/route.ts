import { NextResponse } from "next/server";
import { readHistory } from "@/lib/cache";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "timestamp",
  "gold",
  "silver",
  "usdVnd",
  "eurUsd",
  "sjcSell",
  "sjcBuy",
  "nhanSell",
  "nhanBuy",
  "goldWorldVnd",
  "silverVnd",
] as const;

function csvCell(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  try {
    const history = await readHistory();
    const lines: string[] = [COLUMNS.join(",")];

    for (const p of history) {
      lines.push(
        COLUMNS.map((key) =>
          csvCell(p[key as keyof typeof p] as string | number | undefined),
        ).join(","),
      );
    }

    const body = `\uFEFF${lines.join("\n")}`;
    const name = `price-history_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không đọc được lịch sử" },
      { status: 500 },
    );
  }
}
