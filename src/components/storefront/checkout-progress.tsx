const STEPS = [
  { key: "warenkorb", label: "Warenkorb" },
  { key: "lieferung", label: "Lieferung" },
  { key: "angaben", label: "Angaben" },
  { key: "bestaetigen", label: "Bestätigen" },
] as const;

export type CheckoutStep = (typeof STEPS)[number]["key"];

// Four-step progress bar reused across /warenkorb, /kasse/lieferung,
// /kasse/angaben, /kasse/bestaetigen so the customer always knows where
// they are in the funnel.
export function CheckoutProgress({ current }: { current: CheckoutStep }) {
  return (
    <ol
      aria-label="Bestellschritte"
      className="m-0 p-0 list-none flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-sage"
    >
      {STEPS.flatMap((step, i) => {
        const isActive = step.key === current;
        const nodes: React.ReactNode[] = [];
        if (i > 0) {
          nodes.push(
            <li
              key={`sep-${step.key}`}
              aria-hidden
              className="w-10 h-px bg-mist"
            />,
          );
        }
        nodes.push(
          <li
            key={step.key}
            {...(isActive ? { "aria-current": "step" as const } : {})}
            className={`inline-flex items-center gap-2.5 ${
              isActive ? "text-bark font-semibold" : ""
            }`}
          >
            <span
              className={`w-6 h-6 grid place-items-center text-[12px] ${
                isActive
                  ? "bg-rose border border-rose text-ivory"
                  : "border border-mist"
              }`}
            >
              {i + 1}
            </span>
            {step.label}
          </li>,
        );
        return nodes;
      })}
    </ol>
  );
}
