import type { ReactNode } from "react";

export interface FieldHelpBlock {
  title: string;
  body: ReactNode;
}

const helpProse = "settings-help-prose";

export const FIELD_HELP: Record<string, FieldHelpBlock> = {
  "telegram.botToken": {
    title: "Cách lấy Bot Token",
    body: (
      <div className={helpProse}>
        <p>Token do @BotFather cấp — Hub dùng để gọi API Telegram thay mặt bot.</p>
        <p className="font-medium text-[var(--foreground)]">Làm từng bước:</p>
        <ol>
          <li>Mở app Telegram → tìm <strong>@BotFather</strong> (tick xanh).</li>
          <li>
            Tạo bot mới: gửi <code>/newbot</code>, đặt tên hiển thị + username (phải kết thúc{" "}
            <code>bot</code>, vd <code>RomsNewsbot</code>).
          </li>
          <li>
            BotFather trả về một dòng dài dạng{" "}
            <code>123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxx</code> — đó là <strong>Bot Token</strong>.
          </li>
          <li>
            Đã có bot rồi: <code>/mybots</code> → chọn bot → <strong>API Token</strong> → Copy.
          </li>
          <li>
            Ở đây: <strong>Sửa</strong> → dán token → <strong>Lưu</strong> (ghi file{" "}
            <code>data/hub-config.json</code>, không mất khi tắt app).
          </li>
        </ol>
        <p className="text-[var(--muted)]">
          Không chia token cho người khác. Nếu lộ → BotFather → Revoke và tạo token mới.
        </p>
      </div>
    ),
  },
  "telegram.chatId": {
    title: "Cách lấy Chat ID (số)",
    body: (
      <div className={helpProse}>
        <p>
          Chat ID là <strong>số</strong> (vd <code>5987654321</code>) — chat <em>của bạn</em> nơi bot gửi tin
          tới.
        </p>
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-red-200">
          <strong>Không</strong> điền @tên_bot (vd <code>@RomsNewsbot</code>). Bot không gửi tin cho chính nó → lỗi{" "}
          <em>the bot can&apos;t send messages to the bot</em>.
        </p>
        <p className="font-medium text-[var(--foreground)]">Làm từng bước:</p>
        <ol>
          <li>
            Trên Telegram (điện thoại/máy tính), mở đúng bot của bạn → gửi <code>/start</code> (bắt buộc, từ
            tài khoản cá nhân của bạn).
          </li>
          <li>
            Lấy <strong>Bot Token</strong> ở trên (hoặc từ <code>.env.local</code>).
          </li>
          <li>
            Mở trình duyệt, dán URL (thay <code>TOKEN</code> bằng token thật, không có khoảng trắng):
            <code className="help-url">
              https://api.telegram.org/botTOKEN/getUpdates
            </code>
          </li>
          <li>
            Trong JSON, tìm đoạn gần tin bạn vừa gửi:
            <pre className="help-pre">{`"chat": {
  "id": 5987654321,
  "first_name": "Ten ban",
  "type": "private"
}`}</pre>
            Copy <strong>chỉ số</strong> sau <code>&quot;id&quot;:</code> — vd <code>5987654321</code>.
          </li>
          <li>
            Nhóm/supergroup: <code>id</code> thường là số <strong>âm</strong> (vd <code>-1001234567890</code>) —
            copy nguyên cả số kèm dấu <code>-</code>.
          </li>
          <li>
            Quay lại Hub: <strong>Sửa</strong> ô Chat ID → dán số → <strong>Lưu</strong> → <strong>Test kết
            nối</strong> hoặc <strong>Gửi thử</strong>.
          </li>
        </ol>
        <p className="font-medium text-[var(--foreground)]">Nếu trang getUpdates trống / không có message:</p>
        <ul>
          <li>Nhắn lại <code>/start</code> cho bot, đợi vài giây, refresh trang.</li>
          <li>Kiểm tra token đúng bot (không nhầm bot khác).</li>
        </ul>
        <p className="text-[var(--muted)]">
          Lưu vào <code>hub-config.json</code> — lần sau chạy <code>./scripts/start.sh</code> vẫn dùng số này.
        </p>
      </div>
    ),
  },
  "hub.cronSecret": {
    title: "Hub tick secret",
    body: (
      <div className={helpProse}>
        <p>
          Chuỗi tùy chọn — worker gửi header <code>x-hub-secret</code> khi POST{" "}
          <code>/api/hub/tick</code>. Để trống: chỉ localhost được gọi tick.
        </p>
        <p>Đặt trong <code>.env.local</code> hoặc Lưu ở đây (cùng file hub-config).</p>
      </div>
    ),
  },
};
