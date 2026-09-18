export type ReplyBuiltinKind = "help" | "market" | "digest" | "news" | "custom";

/** Mẫu HTML gốc — map từ nội dung bot đang dùng; sửa tự do + biến {{...}}. */
export const REPLY_TEMPLATES: Record<ReplyBuiltinKind, string> = {
  help: `<b>🤖 Personal Hub Bot</b>

<b>Lệnh đang bật:</b>
{{helpList}}

<i>{{updatedAt}}</i>`,

  market: `<b>📈 Thị trường — Personal Hub</b>

🥇 Vàng: <b>\${{gold}}</b>/oz
🥈 Bạc: <b>\${{silver}}</b>/oz
💵 USD/VND: <b>{{usdVnd}}</b>
🇻🇳 Vàng ≈ <b>{{goldVnd}}</b> VND/oz
💶 EUR/USD: <b>{{eurUsd}}</b>

<i>Cập nhật: {{updatedAt}}</i>`,

  digest: `<b>☀️ Bản tin Personal Hub</b>

🥇 Vàng: <b>\${{gold}}</b>/oz
🥈 Bạc: <b>\${{silver}}</b>/oz
💵 USD/VND: <b>{{usdVnd}}</b>
📰 <i>{{headline}}</i>

<i>{{updatedAt}}</i>`,

  news: `<b>📰 Tin mới nhất</b>

{{newsList}}`,

  custom: `<b>{{label}}</b>

Nội dung tùy chỉnh — ví dụ vàng \${{gold}}, USD/VND {{usdVnd}}.

<i>{{updatedAt}}</i>`,
};

export function getDefaultReplyTemplate(kind: ReplyBuiltinKind): string {
  return REPLY_TEMPLATES[kind] ?? REPLY_TEMPLATES.custom;
}

/** Mẫu nhanh 1–3 — Apply ghi đè HTML + nguồn dữ liệu của nhóm đó. */
export const QUICK_REPLY_PRESETS: {
  id: number;
  label: string;
  kind: ReplyBuiltinKind;
  template: string;
}[] = [
  { id: 1, label: "Mẫu 1 — Help", kind: "help", template: REPLY_TEMPLATES.help },
  { id: 2, label: "Mẫu 2 — Giá live", kind: "market", template: REPLY_TEMPLATES.market },
  { id: 3, label: "Mẫu 3 — Tin RSS", kind: "news", template: REPLY_TEMPLATES.news },
];
