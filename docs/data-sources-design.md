> **Author:** Mr.Rom\
> **Version:** v0.2.0\
> **Created:** 16/05/2026\
> **Last updated:** 16/05/2026

# Thiết kế — Trang Nguồn dữ liệu (Data Sources)

Tài liệu này cố định **phương án** và **mô hình dữ liệu** cho trang cấu hình **Nguồn dữ liệu**: người dùng tự sửa/tạo nguồn, khai báo **giá trị thô** và **giá trị sau xử lý**, chọn **pipeline thân thiện trên web**; các kênh tiêu thụ (Telegram, tab Market, …) chỉ **chọn key** để dùng — nguồn chỉ là **metadata phụ** (tránh nhầm key trùng tên).

---

## 1. Mục tiêu & nguyên tắc

| Mục tiêu | Ghi chú |
|----------|---------|
| **1 nhóm = 1 nguồn** | Mọi thứ chung (URL, auth, loại phương thức) thuộc **cùng một nhóm**. |
| **Keypoint** | Một điểm extract trong nhóm → **luôn có ≥1 key thô** + **≥1 key sau xử lý** (có thể nhiều output). |
| **Key thô** | User nhập slug (vd `gold`) → hệ thống **tự** xuất `gold_raw` (hậu tố `_raw` cố định). |
| **Key sau xử lý** | User đặt tên tự do (`gold`, `tg_gold`, `vn_gold`…); mỗi output một kiểu xử lý (xem mục 3). |
| **Transform trên web** | Chọn **loại xử lý** có form (không `eval` JS); công thức chỉ tham chiếu **key đã resolve** trong cùng lần chạy. |
| **Tương thích cũ** | **Chỉ thêm** schema/UI; **không xóa** `api-variable-registry.json` / binding hiện có; migrate = copy + bổ sung field mới. |
| **Nhiều phương thức** | Nhóm chọn **loại nguồn** trước; form chi tiết **phụ thuộc loại** (API, sau này mở rộng). |
| **Mẫu / restore** | Bộ preset đóng gói sẵn (read-only hoặc copy-on-write) + **snapshot người dùng** export/import. |
| **UI** | Danh sách **nhóm** (tóm tắt); trong nhóm liệt kê **keypoint** (tên key, trạng thái); **cấu hình chi tiết ẩn** đến khi mở (accordion). |

**Nguyên tắc bảo mật:** mọi HTTP từ cấu hình user chỉ chạy **trên server** (API route / server action), timeout, không `eval`, không fetch nội bộ (SSRF) — có thể bổ sung **allowlist domain** ở phase sau.

---

## 2. Mô hình miền (domain)

### 2.1. `DataSourceGroup` (nhóm = nguồn)

| Trường | Ý nghĩa |
|--------|---------|
| `id` | UUID / stable id. |
| `order` | Thứ tự kéo thả. |
| `enabled` | Bật/tắt cả nhóm. |
| `name` | Tên hiển thị nhóm (vd: “Giá quốc tế TG”). |
| `description` | Mô tả ngắn (metadata cho user). |
| `kind` | Loại phương thức: `http_json` \| `builtin_hub` \| `static` \| … (mở rộng). |
| `kindVersion` | Số phiên bản schema của `kind` (để migrate file cũ). |
| `shared` | Payload **riêng theo `kind`** (URL, headers, query, poll hint, …). |
| `keypoints[]` | Danh sách điểm lấy dữ liệu (xem 2.2). |
| `presetId` | (Tuỳ chọn) id preset gốc nếu nhóm được tạo từ mẫu — hỗ trợ “reset về mẫu” vs “chỉ xem đã derive từ mẫu nào”. |

### 2.2. `Keypoint` (điểm trong nhóm)

| Trường | Ý nghĩa |
|--------|---------|
| `id` | UUID. |
| `order` | Thứ tự trong nhóm. |
| `enabled` | Bật/tắt keypoint. |
| `label` | Nhãn UI ngắn (vd: “Vàng spot USD/oz”). |
| `note` | Chú thích user. |
| `keySlug` | Slug do user nhập (vd `gold`, `vn_gold`) — **không** gồm `_raw`. |
| `extract` | Cấu hình lấy giá trị từ nguồn nhóm (JSON path, builtin field, …). |
| `outputs[]` | Danh sách **key sau xử lý** (mục 2.3). Raw luôn derive: `{keySlug}_raw`. |

**Quy tắc key thô (cố định):**

- User nhập `keySlug` = `gold` → key thô publish = **`gold_raw`** (UI hiển thị read-only, không sửa tay hậu tố).
- Nếu user nhập nhầm `gold_raw` làm slug → chuẩn hóa thành `gold` (strip `_raw` ở cuối slug) rồi mới derive.

**Key sau xử lý:** user đặt tên từng output trong `outputs[]`; có thể trùng “ý nghĩa” với slug (`gold` processed từ `gold` raw) hoặc khác (`tg_gold`, `vn_sjc`, …).

**Unique:** mọi key **enabled** (raw + mọi output + key sinh từ `expand_*`) **unique toàn file**; trùng → cảnh báo + chặn Lưu.

**Khi tiêu thụ (Telegram/UI):** user chọn **key nào cũng được** (`gold_raw`, `gold`, `vn_gold`…); dropdown = `key · nhóm · label · note`.

### 2.3. `ProcessedOutput` (một key sau xử lý)

Mỗi keypoint có **ít nhất một** output; có thể thêm nhiều output (vd vừa `passthrough` vừa `formula` ra key khác).

| Trường | Ý nghĩa |
|--------|---------|
| `id` | UUID output. |
| `enabled` | Bật output. |
| `outputKey` | Tên key publish (user nhập, vd `gold`, `vn_gold`). |
| `mode` | Loại xử lý (mục 3). |
| `config` | Payload theo `mode`. |

**Mặc định khi tạo keypoint mới:** một output `mode: passthrough`, `outputKey` = `keySlug` (copy giá trị thô đã stringify).

### 2.3. `shared` theo `kind` (ví dụ)

**`http_json`**

- `baseUrl` (bắt buộc)
- `method` (mặc định `GET`; POST phase sau nếu cần body template)
- `headers[]` | `auth` preset: `none` \| `bearer` \| `api_key_header` (tên header + secret ref — không lưu plaintext nếu dùng secret store)
- `defaultTimeoutMs`
- (Tuỳ chọn) `cacheTtlMs` cho server cache theo nhóm

**`builtin_hub`**

- `connectorId` (vd: `metals_live`, `frankfurter_usd`, `giavang_vn`) — map tới code đã có trong `lib/`
- `params` object nhỏ (vd số bản tin RSS)

**`static`**

- `value` string (test / placeholder / fallback)

Các `kind` khác (webhook, file local read-only, …) thêm sau bằng cách mở rộng `shared` + validator.

---

## 3. Loại xử lý sau extract (`ProcessedOutput.mode`)

Resolver chạy theo **thứ tự phụ thuộc**: mọi `*_raw` của keypoint enabled trước → sau đó outputs theo `order` trong file / topological sort nếu `formula` tham chiếu key khác.

### 3.1. `passthrough` (mặc định — “không đổi”)

- `outputKey` nhận **đúng** chuỗi sau extract (đã stringify).
- Dùng khi consumer cần key “sạch” (`gold`) tách với `gold_raw` để debug/so sánh.

### 3.2. `formula` (công thức có tham chiếu key)

- User nhập biểu thức **hạn chế**, vd: `tg_gold * usd_vnd` hoặc `(gold_raw + 1) / 2`.
- Toán tử cho phép: `+ - * / ( )` và tham chiếu identifier key (`a-z0-9_`) đã có trong **context resolve hiện tại**.
- **Không** đổi nguồn gốc dữ liệu: `vn_gold` vẫn nên có keypoint extract từ API VN; công thức chỉ là **derived tùy chọn** (vd ước lượng), không thay connector `giavang`.
- Kết quả: string (số format theo tùy chọn `decimals` / `locale` trong config).

```json
{
  "mode": "formula",
  "config": {
    "expression": "tg_gold * usd_vnd",
    "decimals": 0,
    "locale": "vi-VN"
  }
}
```

### 3.3. `boolean` (điều kiện → hai giá trị cố định)

- Điều kiện: biểu thức so sánh an toàn, vd `tg_gold >= 10000` (operand là key hoặc literal số).
- `whenTrue` / `whenFalse`: chuỗi user nhập (vd `"cao"` / `"thấp"`) hoặc `"true"` / `"false"`.
- Output `outputKey` = một trong hai chuỗi đó.

```json
{
  "mode": "boolean",
  "config": {
    "condition": "tg_gold >= 10000",
    "whenTrue": "true",
    "whenFalse": "false"
  }
}
```

### 3.4. `conditional_text` (if/else → chọn nội dung từ ô nhập)

- Giống `boolean` nhưng `whenTrue` / `whenFalse` là **text tự do** (vd “Giá cao”, “Giá thấp”) — phù hợp Telegram/HTML.

### 3.5. `expand_collection` (mảng hoặc chuỗi có phân cách → nhiều key)

- User đặt `outputKey` gốc (vd `vn_gold_array`) — **không** publish key gốc (hoặc publish optional `vn_gold_array` = join preview).
- Engine sinh thêm: `vn_gold_array_1`, `vn_gold_array_2`, … theo số phần tử.
- `source`: `from_raw` \| `from_key` (key khác đã resolve).
- `split`:
  - `type: json_array` — raw là JSON array hoặc extract trả array.
  - `type: delimiter` — tách chuỗi: `delimiter` (`,`, `|`, …) hoặc `newline`.
- `maxItems` (cap, vd 20) tránh nổ key.
- Tuỳ chọn `itemTransform`: `passthrough` \| `trim` trên từng phần tử.

> Ví dụ user: slug `vn_prices`, raw là chuỗi `"10,20,30"`, expand → `vn_prices_1`…`vn_prices_3`.

### 3.6. Op nhỏ gắn thêm (chain trong một output — phase 1b)

Sau mode chính, có thể thêm tối đa N bước phụ (dropdown): `trim`, `to_fixed`, `locale_string`, `prefix`, `suffix` — không thay thế các mode trên.

### 3.7. Ý tưởng bổ sung (phase sau)

| Mode | Mục đích |
|------|----------|
| `map_lookup` | Bảng map value → label (vd mã → tên sàn). |
| `template` | Ghép chuỗi có `{{key}}` (giống Telegram, scope resolver). |
| `coalesce` | `first_non_empty(key_a, key_b, "—")`. |
| `date_format` | Parse ISO → `dd/MM/yyyy HH:mm`. |

**An toàn:** parser biểu thức riêng (không `Function`/`eval`); giới hạn độ dài input; timeout resolve cả file.

---

## 4. Hợp đồng với phần “tiêu thụ” (sau này)

- **Resolver tập trung** (server): `resolveDataSourceKeys(): Promise<Record<string, string>>`  
  - Key = `outputKeyRaw` / `outputKeyProcessed` (prefix namespace tuỳ chọn, vd `ds.gold` vs `gold`).  
  - Consumer (Telegram template, StatCard mapping, …) chỉ cần **dropdown key** + tooltip `(groupName · label · note)`.

- **Trùng key:** **không** dùng thứ tự ưu tiên im lặng — bắt **unique** khi lưu; nếu cần hai giá trị “vàng” khác nhau thì user tự đặt tên khác nhau (`gold`, `tg_gold`, `vn_gold`, …).

---

## 5. Lưu trữ & mẫu

| Thành phần | Vị trí đề xuất |
|-------------|----------------|
| Cấu hình user | `data/data-sources.json` (gitignore giống các file `data/*.json` khác). |
| Preset gói app | `src/lib/data-sources/presets/*.json` hoặc một `bundled-presets.json` **trong repo** (read-only seed). |
| Export/import user | JSON snapshot (cùng schema + `exportVersion`) — nút Tải xuống / Upload trong trang Nguồn. |

**Restore mẫu:** “Thêm nhóm từ mẫu” = deep copy preset → `DataSourceGroup` mới trong file user; “Reset nhóm này về mẫu” = chỉ khi `presetId` còn khớp bản bundled (hoặc lưu snapshot `presetSnapshot` lúc tạo).

---

## 6. UI/UX — gọn, nhiều đối tượng, không “bảng khổng lồ”

**Nguyên tắc layout (desktop ưu tiên, vẫn responsive):**

- **Không** table nhiều cột (>4) — dùng **card xếp dọc**, mỗi keypoint = 1 hàng tóm tắt + accordion chi tiết.
- Font **10–11px** cho field label; input `text-[11px]`; `truncate` + `title` tooltip cho key dài.
- Grid chi tiết: **1 cột** mobile, **2 cột** `sm+` chỉ cho cặp field ngắn (slug + mode).
- Khối **“Cấu hình nâng cao”** đóng mặc định (extract path, headers, formula, điều kiện).
- Nút **Test** trên hàng tóm tắt; kết quả trong **popover/drawer** (raw + từng output), không inline `<pre>` cao cả trang.
- **Sticky** thanh Lưu / Thêm nhóm trên mobile.

**Cấu trúc trang:**

1. Header gọn: Thêm nhóm · Mẫu · Import/Export · Lưu.  
2. **Nhóm (card):** tên · badge `kind` · `3 điểm · 8 key` · ☑ · kéo · chevron.  
3. **Trong nhóm:**  
   - Hàng 1: `kind` (select).  
   - Accordion “Kết nối chung” (URL, auth…).  
   - List keypoint:  
     - **Tóm tắt:** `label` · `gold_raw` → `gold`, `vn_gold` (+2) · trạng thái · Test.  
     - **Mở rộng:**  
       - Slug + **read-only** `*_raw`  
       - Extract (path / builtin field)  
       - **Outputs** (sub-card nhỏ từng dòng): `outputKey` · `mode` select · form mode (1–3 field) · xóa  
       - Nút “+ Thêm output”  
4. Drawer **Mẫu** (không chiếm chiều cao list chính).

**Tránh mất chữ:** `min-w-0` + `truncate` trên flex children; monospace chỉ cho key; không fixed width quá hẹp cho label tiếng Việt.

---

## 7. API (Next) — giai đoạn 1

| Method | Path | Ý nghĩa |
|--------|------|---------|
| `GET` | `/api/hub/data-sources` | Đọc file + liệt kê preset bundled (metadata). |
| `POST` | `/api/hub/data-sources` | `action: save` \| `action: test_group` \| `action: test_keypoint` \| `action: import`. |

Test trả về: `rawPreview`, `processedPreview`, `httpStatus`, `timingMs`, (tuỳ chọn) `bodySnippet` đã redact / truncate.

---

## 8. Migration & tương thích (chỉ thêm, không phá dữ liệu cũ)

| Hiện có | Cách xử lý |
|---------|------------|
| `data/api-variable-registry.json` | **Giữ nguyên** đọc/ghi; trang cũ vẫn hoạt động cho đến khi user migrate. |
| Binding `variableKey: gold` | Import → nhóm builtin tương ứng: `keySlug: gold`, raw `gold_raw`, output `passthrough` → `gold`. |
| Preset / default trong code | **Cập nhật nội dung mẫu** theo schema mới (thêm field), **không đổi** URL/connector VN (`giavang`), metals, frankfurter. |
| Telegram `{{gold}}` | Vẫn resolve; sau này merge thêm key từ `data-sources.json` (union, unique enforced). |

**Wizard “Nhập từ registry”:** copy-only, không xóa file cũ.

**Ví dụ migrate một dòng cũ:**

```text
variableKey: gold  →  keySlug: gold, raw: gold_raw, outputs: [{ mode: passthrough, outputKey: gold }]
variableKey: usdVnd → keySlug: usdVnd, raw: usdVnd_raw, outputs: [{ passthrough, outputKey: usdVnd }]
```

---

## 9. Lộ trình triển khai (gợi ý)

| Phase | Nội dung |
|-------|-----------|
| **P0** | Schema `data-sources.json` + raw `_raw` auto + output `passthrough` + UI gọn accordion + test popover + builtin_hub/http_json. |
| **P1** | `formula`, `boolean`, `conditional_text` + unique key + import registry. |
| **P2** | `expand_collection` + preset bundled + export/import. |
| **P3** | Resolver union cho Telegram/UI; giữ registry cũ song song. |

---

## 10. Changelog

- **v0.2.0 (16/05/2026):** `keySlug` + auto `*_raw`; nhiều `ProcessedOutput`/mode (passthrough, formula, boolean, conditional_text, expand_collection); UI gọn; migration additive-only.
- **v0.1.1 (16/05/2026):** Key do user đặt tự do (`gold` / `tg_gold` / `vn_gold`…); unique toàn file + dropdown kèm metadata nhóm.
- **v0.1.0 (16/05/2026):** Bản thiết kế đầu — nhóm nguồn, keypoint, raw/processed, transform whitelist, preset, UI accordion.
