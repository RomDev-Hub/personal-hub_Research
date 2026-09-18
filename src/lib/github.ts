import type { GitHubRepo } from "./types";

const TRENDING_API = "https://gh-trending-api.vercel.app/repositories";

interface TrendingApiItem {
  url?: string;
  name?: string;
  nameWithOwner?: string;
  description?: string | null;
  language?: string | null;
  stargazersCount?: number;
  forksCount?: number;
  starsToday?: number;
}

export async function fetchGitHubTrending(options: {
  language?: string;
  since?: "daily" | "weekly" | "monthly";
}): Promise<GitHubRepo[]> {
  const params = new URLSearchParams();
  if (options.language && options.language !== "all") {
    params.set("language", options.language);
  }
  if (options.since) {
    params.set("since", options.since);
  }

  const url = `${TRENDING_API}?${params.toString()}`;

  const res = await fetch(url, {
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    return fetchGitHubSearchFallback(options.language);
  }

  const data = (await res.json()) as TrendingApiItem[];

  return data.slice(0, 30).map((item, idx) => {
    const fullName = item.nameWithOwner ?? item.name ?? `repo-${idx}`;
    return {
      id: fullName,
      name: item.name ?? fullName.split("/").pop() ?? fullName,
      fullName,
      url: item.url ?? `https://github.com/${fullName}`,
      description: item.description ?? "",
      language: item.language ?? "Khác",
      stars: item.stargazersCount ?? 0,
      forks: item.forksCount ?? 0,
      todayStars: item.starsToday ?? 0,
    };
  });
}

async function fetchGitHubSearchFallback(language?: string): Promise<GitHubRepo[]> {
  const q = language && language !== "all" ? `language:${language}` : "stars:>100";
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const date = since.toISOString().split("T")[0];

  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q + ` created:>${date}`)}&sort=stars&order=desc&per_page=25`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "PersonalHub-Local",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    items: Array<{
      id: number;
      name: string;
      full_name: string;
      html_url: string;
      description: string | null;
      language: string | null;
      stargazers_count: number;
      forks_count: number;
    }>;
  };

  return data.items.map((item) => ({
    id: String(item.id),
    name: item.name,
    fullName: item.full_name,
    url: item.html_url,
    description: item.description ?? "",
    language: item.language ?? "Khác",
    stars: item.stargazers_count,
    forks: item.forks_count,
    todayStars: 0,
  }));
}

export const GITHUB_LANGUAGES = [
  { value: "all", label: "Tất cả ngôn ngữ" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "java", label: "Java" },
  { value: "kotlin", label: "Kotlin" },
  { value: "swift", label: "Swift" },
  { value: "vue", label: "Vue" },
];
