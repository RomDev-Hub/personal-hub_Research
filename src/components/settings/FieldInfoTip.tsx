"use client";

interface FieldInfoTipProps {
  label: string;
  active: boolean;
  onToggle: () => void;
}

/** Nút ⓘ — bấm để mở/đóng hướng dẫn (panel nằm dưới hàng, không che form). */
export function FieldInfoTip({ label, active, onToggle }: FieldInfoTipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`ml-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none transition ${
        active
          ? "bg-[var(--accent)] text-black"
          : "bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--accent)]"
      }`}
      aria-label={label}
      aria-expanded={active}
    >
      i
    </button>
  );
}
