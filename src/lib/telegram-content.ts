import { fetchForex, vndPerUsd } from "./forex";
import { fetchMetalSpots } from "./metals";
import { fetchNewsFromFeeds } from "./news";
function formatMarketDigest(opts: {
  gold: number;
  silver: number;
  usdVnd?: number;
  headline?: string;
}): string {
  const lines = [
    "<b>☀️ Bản tin Personal Hub</b>",
    "",
    `🥇 Vàng: <b>$${opts.gold.toFixed(2)}</b>/oz`,
    `🥈 Bạc: <b>$${opts.silver.toFixed(2)}</b>/oz`,
  ];
  if (opts.usdVnd) lines.push(`💵 USD/VND: <b>${opts.usdVnd.toLocaleString("vi-VN")}</b>`);
  if (opts.headline) {
    lines.push("", `📰 <i>${opts.headline}</i>`);
  }
  lines.push("", `<i>${new Date().toLocaleString("vi-VN")}</i>`);
  return lines.join("\n");
}

export async function buildMarketDigestText(): Promise<string> {
  const [metals, forex, news] = await Promise.all([
    fetchMetalSpots(),
    fetchForex(),
    fetchNewsFromFeeds(undefined, 1),
  ]);
  const gold = metals.find((m) => m.key === "gold")?.priceUsd ?? 0;
  const silver = metals.find((m) => m.key === "silver")?.priceUsd ?? 0;
  return formatMarketDigest({
    gold,
    silver,
    usdVnd: vndPerUsd(forex),
    headline: news[0]?.title,
  });
}

export async function buildDetailedMarketText(): Promise<string> {
  const [metals, forex] = await Promise.all([fetchMetalSpots(), fetchForex()]);
  const gold = metals.find((m) => m.key === "gold");
  const silver = metals.find((m) => m.key === "silver");
  const vnd = vndPerUsd(forex);
  const eur = forex.rates.find((r) => r.code === "EUR");

  const lines = [
    "<b>📈 Thị trường — Personal Hub</b>",
    "",
    `🥇 Vàng: <b>$${gold?.priceUsd.toFixed(2) ?? "—"}</b>/oz`,
    `🥈 Bạc: <b>$${silver?.priceUsd.toFixed(2) ?? "—"}</b>/oz`,
  ];

  if (vnd) {
    lines.push(`💵 USD/VND: <b>${vnd.toLocaleString("vi-VN")}</b>`);
    if (gold?.priceUsd) {
      lines.push(`🇻🇳 Vàng ≈ <b>${(gold.priceUsd * vnd).toLocaleString("vi-VN")} VND</b>/oz`);
    }
  }

  if (eur) {
    lines.push(`💶 EUR/USD: <b>${eur.rate.toFixed(4)}</b>`);
  }

  lines.push("", `<i>Cập nhật: ${new Date().toLocaleString("vi-VN")}</i>`);
  return lines.join("\n");
}

export async function buildNewsSnippetText(): Promise<string> {
  const news = await fetchNewsFromFeeds(undefined, 5);
  if (!news.length) return "📰 Chưa lấy được tin tức.";

  const lines = ["<b>📰 Tin mới nhất</b>", ""];
  for (const item of news.slice(0, 5)) {
    lines.push(`• <a href="${item.link}">${item.title}</a>`);
    lines.push(`  <i>${item.source} · ${item.category}</i>`);
  }
  return lines.join("\n");
}

export function buildHelpText(): string {
  return buildHelpTextFromCommands(null);
}

export function buildHelpTextFromCommands(
  enabledCommands: Array<{ label: string; commands: string[]; keywords: string[] }> | null,
): string {
  const lines = ["<b>🤖 Personal Hub Bot</b>", "", "<b>Lệnh đang bật:</b>"];

  const list = enabledCommands?.length
    ? enabledCommands
    : [
        { label: "Giá thị trường", commands: ["/market", "/gia"], keywords: ["giá vàng"] },
        { label: "Bản tin", commands: ["/digest"], keywords: [] },
        { label: "Tin RSS", commands: ["/tin", "/news"], keywords: [] },
        { label: "Trợ giúp", commands: ["/help"], keywords: [] },
      ];

  for (const cmd of list) {
    const triggers = [...cmd.commands, ...cmd.keywords].join(", ") || cmd.label;
    lines.push(`• <b>${cmd.label}</b> — ${triggers}`);
  }

  lines.push("", "<i>Chạy local trên máy bạn — cấu hình trong Personal Hub.</i>");
  return lines.join("\n");
}
