"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; count: number | null };

export function KontoNav({
  orderCount,
  addressCount,
}: {
  orderCount: number;
  addressCount: number;
}) {
  const pathname = usePathname();
  const items: Item[] = [
    { href: "/konto", label: "Übersicht", count: null },
    { href: "/konto/bestellungen", label: "Bestellungen", count: orderCount },
    { href: "/konto/adressen", label: "Adressbuch", count: addressCount },
    { href: "/konto/einstellungen", label: "Einstellungen", count: null },
  ];

  return (
    <nav
      aria-label="Mein Konto"
      // Phones: 2x2 grid of outlined cards. Desktop: left-rail with
      // hair-line separators. The two layouts share no border/padding
      // classes so a single utility string can't express both — split
      // per-breakpoint via the array-join.
      className="grid grid-cols-2 gap-1.5 lg:flex lg:flex-col lg:gap-0 lg:border-t lg:border-hair"
    >
      {items.map((item) => {
        const isActive =
          item.href === "/konto"
            ? pathname === "/konto"
            : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={[
              "flex items-center justify-between gap-3 text-[15px] transition-colors",
              "h-12 lg:h-[52px] px-3.5",
              "border lg:border-0 lg:border-b lg:border-hair",
              "lg:border-l-[3px]",
              isActive
                ? "border-rose bg-ivory shadow-[0_0_0_1px_var(--color-rose)] lg:bg-cream lg:shadow-none lg:border-l-rose lg:pl-[14px] text-bark font-semibold"
                : "border-mist text-sage hover:text-bark hover:bg-cream lg:border-l-transparent lg:pl-[17px]",
            ].join(" ")}
          >
            <span>{item.label}</span>
            {item.count !== null && (
              <span
                className={`text-[12px] tabular-nums ${
                  isActive ? "text-rose font-semibold" : "text-sage"
                }`}
              >
                {item.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
