// Numbered question card used across /kasse/* — bordered section with
// a bark-filled square numeral, display-font title, and optional hint
// text above a hairline-separated body.
export function CoBox({
  number,
  title,
  hint,
  children,
}: {
  number: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-[#E1D5C7] bg-ivory p-6 lg:p-7 flex flex-col gap-5">
      <div className="flex gap-3.5 items-start">
        <span
          aria-hidden
          className="w-7 h-7 mt-0.5 bg-bark text-ivory grid place-items-center font-display text-[15px] shrink-0"
        >
          {number}
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-display font-normal text-[22px] lg:text-[24px] leading-[1.2] text-bark">
            {title}
          </h2>
          {hint && (
            <p className="m-0 text-[14px] leading-[1.5] text-sage">{hint}</p>
          )}
        </div>
      </div>
      <div className="pt-5 border-t border-[#E6DDD2] flex flex-col gap-4">
        {children}
      </div>
    </section>
  );
}
