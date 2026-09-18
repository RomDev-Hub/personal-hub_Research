import { NextResponse } from "next/server";
import { fetchNewsFromFeeds, getNewsCategories, NEWS_FEEDS } from "@/lib/news";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q")?.toLowerCase().trim();
  const limit = Math.min(Number(searchParams.get("limit") ?? 60), 100);

  try {
    const feedIds =
      category && category !== "all"
        ? NEWS_FEEDS.filter((f) => f.category === category).map((f) => f.id)
        : undefined;

    let items = await fetchNewsFromFeeds(feedIds, 10);

    if (q) {
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.summary?.toLowerCase().includes(q) ||
          item.source.toLowerCase().includes(q),
      );
    }

    return NextResponse.json({
      items: items.slice(0, limit),
      categories: getNewsCategories(),
      feeds: NEWS_FEEDS.map((f) => ({ id: f.id, name: f.name, category: f.category })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi tin tức" },
      { status: 500 },
    );
  }
}
