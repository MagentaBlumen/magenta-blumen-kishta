import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { product } from "@/db/schema/catalogue";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Read-only product list. Editing lands in chunk 3b (/admin/produkte/[id]).
// Categories join is deferred - not needed for the first-cut overview.
export default async function ProdukteListPage() {
  const products = await db
    .select({
      id: product.id,
      slug: product.slug,
      nameDe: product.nameDe,
      pricingMode: product.pricingMode,
      isAvailable: product.isAvailable,
      isOnlineOrderable: product.isOnlineOrderable,
      isArchived: product.isArchived,
      sortOrder: product.sortOrder,
    })
    .from(product)
    .orderBy(asc(product.sortOrder), asc(product.nameDe));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Produkte</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {products.length === 0
              ? "Noch keine Produkte."
              : `${products.length} ${
                  products.length === 1 ? "Produkt" : "Produkte"
                } insgesamt.`}
          </p>
        </div>
        <Link href="/admin/produkte/neu" className={buttonVariants()}>
          Neues Produkt
        </Link>
      </div>

      {products.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Modus</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sortierung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      href={`/admin/produkte/${p.id}`}
                      className="font-medium hover:underline"
                    >
                      {p.nameDe}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {p.slug}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {pricingModeLabel(p.pricingMode)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge product={p} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {p.sortOrder}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-12 text-center">
      <h2 className="text-lg font-medium">Noch keine Produkte</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        Beginnen Sie mit dem Anlegen des ersten Produkts.
      </p>
      <Link href="/admin/produkte/neu" className={buttonVariants()}>
        Erstes Produkt anlegen
      </Link>
    </div>
  );
}

function pricingModeLabel(mode: "variant" | "per_unit" | "enquiry") {
  switch (mode) {
    case "variant":
      return "Varianten";
    case "per_unit":
      return "Pro Stück";
    case "enquiry":
      return "Anfrage";
  }
}

type ProductRow = {
  isAvailable: boolean;
  isOnlineOrderable: boolean;
  isArchived: boolean;
};

function StatusBadge({ product: p }: { product: ProductRow }) {
  if (p.isArchived) {
    return <Badge variant="secondary">Archiviert</Badge>;
  }
  if (!p.isAvailable) {
    return <Badge variant="destructive">Ausverkauft</Badge>;
  }
  if (!p.isOnlineOrderable) {
    return <Badge variant="outline">Nur im Laden</Badge>;
  }
  return <Badge>Aktiv</Badge>;
}
