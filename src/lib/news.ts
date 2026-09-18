import Parser from "rss-parser";
import type { NewsItem } from "./types";

const parser = new Parser({
  timeout: 12000,
  headers: { "User-Agent": "PersonalHub/1.0 (local dashboard)" },
});

export interface NewsFeedConfig {
  id: string;
  name: string;
  category: string;
  url: string;
}

export const NEWS_FEEDS: NewsFeedConfig[] = [
  {
    id: "vnexpress",
    name: "VnExpress",
    category: "Việt Nam",
    url: "https://vnexpress.net/rss/tin-moi-nhat.rss",
  },
  {
    id: "tuoitre",
    name: "Tuổi Trẻ",
    category: "Việt Nam",
    url: "https://tuoitre.vn/rss/tin-moi-nhat.rss",
  },
  {
    id: "thanhnien",
    name: "Thanh Niên",
    category: "Việt Nam",
    url: "https://thanhnien.vn/rss/home.rss",
  },
  {
    id: "bbc-world",
    name: "BBC World",
    category: "Thế giới",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
  },
  {
    id: "reuters",
    name: "Reuters",
    category: "Thế giới",
    url: "https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best",
  },
  {
    id: "techcrunch",
    name: "TechCrunch",
    category: "Công nghệ",
    url: "https://techcrunch.com/feed/",
  },
  {
    id: "theverge",
    name: "The Verge",
    category: "Công nghệ",
    url: "https://www.theverge.com/rss/index.xml",
  },
  {
    id: "coindesk",
    name: "CoinDesk",
    category: "Tài chính",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
  },
];

export async function fetchNewsFromFeeds(
  feedIds?: string[],
  limitPerFeed = 8,
): Promise<NewsItem[]> {
  const feeds = feedIds?.length
    ? NEWS_FEEDS.filter((f) => feedIds.includes(f.id))
    : NEWS_FEEDS;

  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return (parsed.items ?? []).slice(0, limitPerFeed).map((item, idx) => ({
        id: `${feed.id}-${idx}-${item.guid ?? item.link ?? item.title}`,
        title: item.title ?? "Không có tiêu đề",
        link: item.link ?? "#",
        source: feed.name,
        category: feed.category,
        publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
        summary: stripHtml(item.contentSnippet ?? item.content ?? "").slice(0, 280),
      }));
    }),
  );

  const items: NewsItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value);
  }

  return items.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export function getNewsCategories(): string[] {
  return [...new Set(NEWS_FEEDS.map((f) => f.category))];
}
