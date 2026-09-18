# Personal Hub

> **Author:** Mr.Rom\
> **Version:** v1.4.2\
> **Created:** 15/05/2026\
> **Last updated:** 15/05/2026

## 🚀 Personal Hub là gì?

Bảng tin web **chạy local** trên máy bạn — giao diện tiếng Việt, không public host. Theo dõi vàng/bạc/USD, tin tức RSS, GitHub trending, và gửi bản tin qua Telegram.

## 🌟 Tính năng

1. **Thị trường** — giá vàng (XAU), bạc (XAG), tỷ giá USD (Frankfurter), quy đổi VND; biểu đồ lịch sử lưu local.
2. **Tin tức** — RSS VnExpress, Tuổi Trẻ, BBC, TechCrunch… lọc chủ đề + từ khóa.
3. **GitHub Trending** — repo hot, lọc ngôn ngữ và khoảng thời gian.
4. **Telegram** — gửi tin thử, bản tin thị trường, tin nhắn tùy chỉnh qua Bot.
5. **Cảnh báo giá** — ngưỡng trên/dưới cho vàng TG, bạc TG, USD/VND, **SJC và nhẫn** (nhập triệu VND như chart); toast + Telegram.
6. **Biểu đồ nâng cao** — 24h / 7d / 30d / 1 năm / 5 năm; zoom/pan (Lightweight Charts); tooltip format theo khoảng thời gian và loại tài sản; đường ngưỡng cảnh báo trên chart.
7. **Xuất CSV** — tải toàn bộ `data/price-history.json` dạng UTF-8 (nút trong tab Thị trường).
8. **Lịch Telegram** — gửi tự động theo giờ (vd 08:00 mỗi ngày); sửa, bật/tắt từng lịch.
9. **Bot trả lời** — nhắn `/market`, `/tin`, `giá vàng`… bot trả thông tin ngay.

## ⚙️ Cách chạy

**Yêu cầu:** Node.js 20+

```bash
cd 05_Projects/personal-hub
npm install
cp .env.example .env.local   # tùy chọn — cho Telegram
chmod +x scripts/start.sh
./scripts/start.sh
```

Mở trình duyệt: **http://localhost:3000**

Chế độ production (build trước):

```bash
./scripts/start.sh prod
```

## 📱 Cấu hình Telegram

1. Telegram → **@BotFather** → `/newbot` → lấy token.
2. Nhắn **`/start`** cho bot của bạn.
3. Mở `https://api.telegram.org/bot<TOKEN>/getUpdates` → copy `chat.id`.
4. Điền vào `.env.local`:

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

5. Khởi động lại app → tab **Telegram** → **Gửi thử**.

## 🤖 Lệnh Telegram Bot

| Lệnh | Tác dụng |
|------|----------|
| `/help` | Danh sách lệnh |
| `/market` hoặc `/gia` | Giá vàng, bạc, USD/VND chi tiết |
| `/digest` | Bản tin thị trường |
| `/tin` hoặc `/news` | 5 tin RSS mới |

Nhắn tự nhiên: *giá vàng*, *usd*, *tin tức* cũng được.

`./scripts/start.sh` tự chạy **hub-worker** (lịch + quét tin trả lời mỗi 45s). Tắt worker: `HUB_NO_WORKER=1 ./scripts/start.sh`

Tab Telegram **không** gọi `/api/hub/tick` từ trình duyệt theo mặc định (tránh trùng với worker); chỉ **làm mới** trạng thái và hộp thư sau mỗi `NEXT_PUBLIC_TELEGRAM_UI_REFRESH_MS` (mặc định 60s). Chỉ khi chạy không có worker, đặt biến `NEXT_PUBLIC_HUB_CLIENT_TICK_MS` lớn hơn `0` (ms) để trình duyệt đảm nhận tick + poll (xem `.env.example`).

## 📝 Changelog

- **v1.4.2 (15/05/2026)**: Tab Telegram chỉ làm mới UI theo interval; không double tick với worker (tuỳ chọn `NEXT_PUBLIC_HUB_CLIENT_TICK_MS`). Lịch — sửa / bật-tắt từng job; tooltip chart format theo range + loại serie.
- **v1.4.1 (15/05/2026)**: Cảnh báo SJC + nhẫn (ngưỡng triệu VND, đường trên chart); export CSV lịch sử (`/api/market/history-csv` + nút UI).
- **v1.4.0 (15/05/2026)**: Hub-trading UI — status bar nguồn/live, stat card % 24h (arrow + tooltip "so với …"), chart hero full-width 30–34 rem, deep link `?tab=market`, fix EMFILE trên macOS, fix hydration mismatch clock.
- **v1.3.0 (15/05/2026)**: UX polish — mobile menu, tooltip chart, ngưỡng trên biểu đồ, poll 30s, khoảng 1y/5y.
- **v1.2.0 (15/05/2026)**: Lịch gửi Telegram; gửi chủ động mở rộng; bot trả lời tin nhắn.
- **v1.1.0 (15/05/2026)**: UI/biểu đồ chuyên nghiệp hơn; cảnh báo ngưỡng + Telegram; khoảng thời gian chart.
- **v1.0.0 (15/05/2026)**: Phiên bản đầu — thị trường, tin tức, GitHub, Telegram, UI tiếng Việt.

## Ghi chú extension / công cụ

| Công cụ | Mục đích |
|---------|----------|
| **Node.js 20+** | Bắt buộc — chạy Next.js |
| Không cần extension Cursor | Mình đã build sẵn trong repo |

Nguồn dữ liệu: [metals.live](https://metals.live), [Frankfurter](https://www.frankfurter.app), RSS các báo, [gh-trending-api](https://github.com/skidding/gh-trending-api).
