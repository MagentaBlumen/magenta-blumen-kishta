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
      className="flex overflow-x-auto lg:flex-col lg:overflow-visible lg:border-t lg:border-hair border-b lg:border-b-0"
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
              "flex items-center justify-between gap-3 shrink-0 text-[15px] transition-colors",
              "h-11 lg:h-[52px] px-3.5 lg:pr-3.5 lg:border-b lg:border-hair",
              "border-b-2 lg:border-l-[3px]",
              isActive
                ? "border-b-rose lg:border-b-hair lg:border-l-rose lg:bg-cream text-bark font-semibold lg:pl-[14px]"
                : "border-b-transparent lg:border-l-transparent text-sage hover:text-bark hover:lg:bg-cream lg:pl-[17px]",
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
