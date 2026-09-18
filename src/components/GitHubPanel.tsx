"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, GitFork, RefreshCw, Search, Star } from "lucide-react";
import type { GitHubRepo } from "@/lib/types";
import { formatNumber } from "@/lib/format";

interface LanguageOption {
  value: string;
  label: string;
}

export function GitHubPanel({ compact = false }: { compact?: boolean }) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [language, setLanguage] = useState("all");
  const [since, setSince] = useState<"daily" | "weekly" | "monthly">("daily");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ language, since });
      if (debouncedQuery) params.set("q", debouncedQuery);
      const res = await fetch(`/api/github?${params}`);
      if (!res.ok) throw new Error("Không tải được GitHub trending");
      const json = (await res.json()) as { repos: GitHubRepo[]; languages: LanguageOption[]; error?: string };
      if (json.error) throw new Error(json.error);
      setRepos(json.repos ?? []);
      setLanguages(json.languages ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi GitHub");
      setRepos([]);
    } finally {
      setLoading(false);
    }
  }, [language, since, debouncedQuery]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GitHubHeader />
        <button type="button" onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="search"
            placeholder="Lọc repo, mô tả..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input w-full pl-10"
          />
        </div>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="input min-w-[140px]">
          {languages.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <select
          value={since}
          onChange={(e) => setSince(e.target.value as typeof since)}
          className="input min-w-[120px]"
        >
          <option value="daily">Hôm nay</option>
          <option value="weekly">Tuần này</option>
          <option value="monthly">Tháng này</option>
        </select>
      </div>

      <div className="space-y-2">
        {loading && repos.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Đang tải trending...</p>
        ) : (
          repos.slice(0, compact ? 8 : 30).map((repo, idx) => (
            <RepoRow key={repo.id} repo={repo} rank={idx + 1} />
          ))
        )}
      </div>
    </div>
  );
}

function GitHubHeader() {
  return (
    <div>
      <h2 className="text-xl font-bold">GitHub Trending</h2>
      <p className="text-sm text-[var(--muted)]">Repo hot — lọc ngôn ngữ, khoảng thời gian</p>
    </div>
  );
}

function RepoRow({ repo, rank }: { repo: GitHubRepo; rank: number }) {
  return (
    <div className="flex gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--accent)]/30">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-sm font-bold text-[var(--muted)]">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <a
          href={repo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline"
        >
          {repo.fullName}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        {repo.description && (
          <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{repo.description}</p>
        )}
        <RepoStats repo={repo} />
      </div>
    </div>
  );
}

function RepoStats({ repo }: { repo: GitHubRepo }) {
  return (
    <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
      <span className="rounded bg-[var(--surface)] px-2 py-0.5">{repo.language}</span>
      <span className="flex items-center gap-1">
        <Star className="h-3.5 w-3.5" /> {formatNumber(repo.stars)}
      </span>
      <span className="flex items-center gap-1">
        <GitFork className="h-3.5 w-3.5" /> {formatNumber(repo.forks)}
      </span>
      {repo.todayStars > 0 && (
        <span className="text-emerald-400">+{formatNumber(repo.todayStars)} hôm nay</span>
      )}
    </div>
  );
}
