import { DateTime } from "luxon";
import { fetchCustomerDetail, fetchCustomerList } from "@/lib/admin/customers";
import {
  KundenView,
  type KundeDetailData,
  type KundeListItem,
} from "@/components/admin/kunden-view";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    selected?: string;
    dsg?: string;
  }>;
};

export default async function KundenPage({ searchParams }: PageProps) {
  const { q, selected, dsg } = await searchParams;
  const query = (q ?? "").trim();
  const list = await fetchCustomerList(query);

  // fetchCustomerList doesn't include addresses yet; the list 'city'
  // stays null for now. Future: widen the SELECT or JOIN
  // customer_address for the first saved address per customer.
  const customers: KundeListItem[] = list.map((r) => ({
    id: r.id,
    name:
      [r.firstName, r.lastName].filter(Boolean).join(" ") || r.email,
    email: r.email,
    phone: r.phone,
    city: null,
    orderCount: r.orderCount,
    anonymised: r.anonymisedAt != null,
  }));

  const selectedIdRaw = selected ? Number(selected) : NaN;
  const selectedId = Number.isFinite(selectedIdRaw)
    ? selectedIdRaw
    : customers[0]?.id ?? null;

  const detailRow =
    selectedId != null ? await fetchCustomerDetail(selectedId) : null;

  const initialDetail: KundeDetailData | null = detailRow
    ? {
        id: detailRow.id,
        name:
          [detailRow.firstName, detailRow.lastName].filter(Boolean).join(" ") ||
          detailRow.email,
        email: detailRow.email,
        phone: detailRow.phone,
        address: detailRow.addresses[0]
          ? `${detailRow.addresses[0].street}, ${detailRow.addresses[0].plz} ${detailRow.addresses[0].city}`
          : null,
        since: DateTime.fromJSDate(detailRow.createdAt, {
          zone: "Europe/Zurich",
        })
          .setLocale("de-CH")
          .toFormat("LLLL yyyy"),
        orders: detailRow.orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          placedAt: DateTime.fromJSDate(o.placedAt, {
            zone: "Europe/Zurich",
          })
            .setLocale("de-CH")
            .toFormat("ccc, d. LLL"),
          what: o.recipientName,
          price: o.totalGross,
          status: o.status,
        })),
      }
    : null;

  const subline = `${customers.length} ${customers.length === 1 ? "Kunde" : "Kunden"}`;

  return (
    <div className="adm-wrap">
      <div className="adm-head">
        <div>
          <h1>Kunden</h1>
          <p>{subline}</p>
        </div>
      </div>

      {dsg === "ok" && detailRow?.anonymisedAt && (
        <p className="done-msg" role="status">
          Die Kundendaten wurden gelöscht.
        </p>
      )}

      <KundenView
        customers={customers}
        initialDetail={initialDetail}
        initialQuery={query}
      />
    </div>
  );
}

