// Radio-style tile shared across /kasse flows: 18px square dot + content
// slot, rose border + ring when selected, oak outline on the dot by
// default. Used for fulfilment, delivery context, payment method, and
// the address-book picker.
//
// Content lives in `children` so each caller decides layout (simple
// title/sub lines, or structured rows with labels + multiple fields).
export function CoTile({
  selected,
  onClick,
  disabled = false,
  ariaLabel,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="radio"
      aria-checked={selected}
      aria-label={ariaLabel}
      className={`text-left h-full px-4 py-[15px] bg-white border flex gap-3.5 items-start transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
        selected
          ? "border-rose shadow-[0_0_0_1px_var(--color-rose)]"
          : "border-mist hover:border-oak"
      }`}
    >
      <span
        aria-hidden
        className={`shrink-0 w-[18px] h-[18px] mt-0.5 box-border ${
          selected
            ? "border-0 bg-rose bg-[linear-gradient(#fff,#fff)] bg-center bg-no-repeat [background-size:6px_6px]"
            : "border-[1.5px] border-oak"
        }`}
      />
      <span className="flex flex-col gap-1 min-w-0 flex-1">{children}</span>
    </button>
  );
}
