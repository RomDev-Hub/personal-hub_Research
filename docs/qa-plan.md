# Personal Hub — QA & phát triển

> **Author:** Mr.Rom · **Cập nhật:** 15/05/2026

## Trạng thái thật (sau kiểm thử API + code review)

**Chưa “xong hoàn hảo”.** Phù hợp dùng local cá nhân; còn giới hạn nguồn dữ liệu và vài tính năng chưa làm.

---

## Ma trận kiểm thử

| # | Tính năng | Cách test | Kết quả |
|---|-----------|-----------|---------|
| 1 | Poll thị trường 30s | `GET /api/market?live=1` | Pass — `pollMs` 30000 |
| 2 | Chart 24h chi tiết phút | API `chartRange=24h` | Pass — nhiều điểm cùng ngày |
| 3 | Chart 5y không méo trục | API `chartRange=5y` | **Fail → đã fix** — trước: 120 điểm/1 ngày; sau: 1 điểm/ngày |
| 4 | 5y đủ 5 năm dữ liệu | API first timestamp | **Giới hạn nguồn** — giavang ~ từ 23/11/2025, không phải 2021 |
| 5 | Tooltip chart | Browser Thị trường / `formatChartTooltipSeriesValue` | Cần xác nhận tay sau release |
| 6 | Đường ngưỡng cảnh báo | Tạo alert + bật series | Cần xác nhận tay |
| 7 | Mobile menu | Viewport &lt; 1024px | Cần xác nhận tay |
| 8 | Tin tức lỗi mạng | API fail | Pass — hiện banner đỏ |
| 9 | GitHub lỗi | API fail | Pass — hiện banner đỏ |
| 10 | Telegram worker | `hub-worker` + tick | Cần `.env.local` |
| 10b | Telegram tab không poll trùng | Default: không `POST /hub/tick` trong UI; chỉ refresh `GET`; `NEXT_PUBLIC_HUB_CLIENT_TICK_MS` khi không worker | Pass — chỉ làm khi bật env |
| 11 | Logo TV trên chart | UI | Pass — `attributionLogo: false` |
| 12 | `?tab=market` deep link | Mở URL trực tiếp | Pass — `readTabFromUrl()` + `popstate` |
| 13 | Hydration mismatch clock | Console | Pass — render clock chỉ sau mount |
| 14 | Status bar live indicator | UI compact panel | Pass — nguồn · cập nhật · `Live · 30s` |
| 15 | Stat card % 24h | API `changes` + UI | Pass — badge xanh/đỏ + arrow, tooltip "so với …" |
| 16 | Chart hero full-width | Layout | Pass — `chart-hero` + `trading-chart-hero` 30–34 rem |
| 17 | EMFILE khi dev | Restart start.sh | Pass — `ulimit -n 524288` + polling watcher |

---

## Bug đã xác nhận & xử lý

### BUG-001 — Chart 7d/30d/1y/5y méo (ảnh user)

- **Triệu chứng:** Đoạn cuối phẳng, trục X nhảy sang `07:01`, `08:49`…
- **Nguyên nhân:** Gộp lịch sử **daily** (giavang) + **intraday** (local ghi mỗi 30s–60s) — 1 ngày có 120+ điểm.
- **Fix:** `aggregateForChartRange()` — khoảng &gt; 24h chỉ **1 điểm/ngày** (điểm mới nhất trong ngày).

### BUG-002 — “5 năm” không đủ 5 năm

- **Nguyên nhân:** API `giavang.now?days=1825` chỉ trả ~vài tháng.
- **UX:** Hiện `chartCoverageNote()` cảnh báo khi dữ liệu không phủ đủ khoảng chọn.

---

## Roadmap (ưu tiên)

### P0 — Ổn định dữ liệu chart & UX cốt lõi

- [x] Gộp 1 điểm/ngày cho 7d+
- [x] Ghi chú phạm vi dữ liệu 1y/5y
- [x] Status bar nguồn / cập nhật / Live
- [x] Stat card hiển thị % thay đổi 24h
- [x] Chart hero full-width
- [x] Deep link `?tab=market`
- [x] Fix EMFILE trên macOS (ulimit + polling)
- [ ] Test browser đầy đủ sau mỗi release

### P1 — Tính năng còn thiếu

- [x] Cảnh báo SJC / nhẫn VN (ngưỡng theo triệu, khớp chart)
- [x] Export CSV lịch sử giá (`GET /api/market/history-csv`, nút trong Thị trường)
- [x] Sửa / bật-tắt từng job lịch Telegram
- [x] Tooltip crosshair: format theo loại + khoảng thời gian (`formatChartTooltipSeriesValue`)
- [ ] Sparkline nhỏ trong stat card

### P2 — Chất lượng

- [ ] Test tự động API (`market`, `alerts`)
- [x] Không nhân đôi tick Telegram (worker mặc định; UI chỉ `load()` định kỳ; tuỳ chọn `NEXT_PUBLIC_HUB_CLIENT_TICK_MS`)
- [ ] Lưu/restore chart series + range theo URL

---

## Lệnh kiểm thử nhanh

```bash
# Phân bố điểm 5y (sau fix: max ~1/ngày)
curl -s "http://127.0.0.1:3000/api/market?chartRange=5y&live=1" | python3 -c "
import json,sys
from collections import Counter
d=json.load(sys.stdin); h=d['chartHistory']
days=Counter(p['timestamp'][:10] for p in h)
print('points',len(h),'max/day',max(days.values()))
"
```

Kỳ vọng: `max/day` = **1** (hoặc 2 nếu vừa đổi ngày UTC).
