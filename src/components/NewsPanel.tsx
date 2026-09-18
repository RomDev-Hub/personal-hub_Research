"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Search } from "lucide-react";
import type { NewsItem } from "@/lib/types";
import { formatRelative } from "@/lib/format";

export function NewsPanel({ compact = false }: { compact?: boolean }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("all");
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
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (debouncedQuery) params.set("q", debouncedQuery);
      params.set("limit", compact ? "12" : "50");
      const res = await fetch(`/api/news?${params}`);
      if (!res.ok) throw new Error("Không tải được tin tức");
      const json = (await res.json()) as { items: NewsItem[]; categories: string[]; error?: string };
      if (json.error) throw new Error(json.error);
      setItems(json.items ?? []);
      setCategories(json.categories ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tin tức");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [category, debouncedQuery, compact]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <NewsPanelContent
      compact={compact}
      items={items}
      categories={categories}
      category={category}
      setCategory={setCategory}
      query={query}
      setQuery={setQuery}
      loading={loading}
      error={error}
      load={load}
    />
  );
}

function NewsPanelContent(props: {
  compact: boolean;
  items: NewsItem[];
  categories: string[];
  category: string;
  setCategory: (c: string) => void;
  query: string;
  setQuery: (q: string) => void;
  loading: boolean;
  error: string | null;
  load: () => void;
}) {
  const { compact, items, categories, category, setCategory, query, setQuery, loading, error, load } =
    props;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Tin tức thế giới</h2>
          <p className="text-sm text-[var(--muted)]">RSS đa nguồn — lọc theo chủ đề và từ khóa</p>
        </div>
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
            placeholder="Tìm tiêu đề, nguồn..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input w-full pl-10"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="input min-w-[160px]"
          aria-label="Chủ đề"
        >
          <option value="all">Tất cả chủ đề</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className={`grid gap-3 ${compact ? "" : "md:grid-cols-2"}`}>
        {loading && items.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Đang tải tin...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Không có tin phù hợp bộ lọc.</p>
        ) : (
          items.map((item) => <NewsCard key={item.id} item={item} compact={compact} />)
        )}
      </div>
    </div>
  );
}

function NewsCard({ item, compact }: { item: NewsItem; compact: boolean }) {
  return (
    <article className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--accent)]/40">
      <NewsCardMeta item={item} />
      <h3 className={`font-semibold leading-snug ${compact ? "text-sm" : ""}`}>{item.title}</h3>
      {!compact && item.summary && (
        <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">{item.summary}</p>
      )}
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-sm text-[var(--accent)] hover:underline"
      >
        Đọc bài <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </article>
  );
}

function NewsCardMeta({ item }: { item: NewsItem }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[var(--accent)]">
        {item.category}
      </span>
      <span className="text-[var(--muted)]">{item.source}</span>
      <span className="text-[var(--muted)]">· {formatRelative(item.publishedAt)}</span>
    </div>
  );
}
