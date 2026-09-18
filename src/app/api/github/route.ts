import { NextResponse } from "next/server";
import { fetchGitHubTrending, GITHUB_LANGUAGES } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language") ?? "all";
  const since = (searchParams.get("since") ?? "daily") as "daily" | "weekly" | "monthly";
  const q = searchParams.get("q")?.toLowerCase().trim();

  try {
    let repos = await fetchGitHubTrending({ language, since });

    if (q) {
      repos = repos.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.language.toLowerCase().includes(q),
      );
    }

    return NextResponse.json({ repos, languages: GITHUB_LANGUAGES });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi GitHub" },
      { status: 500 },
    );
  }
}
