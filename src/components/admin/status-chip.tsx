import {
  contextLabelDe,
  statusLabelDe,
  type DeliveryContext,
  type OrderStatus,
} from "@/lib/admin/order-status";

const STATUS_TONE: Record<OrderStatus, string> = {
  new: "bg-stone-100 text-stone-700 border-stone-200",
  confirmed: "bg-stone-100 text-stone-700 border-stone-200",
  in_production: "bg-amber-100 text-amber-700 border-amber-200",
  ready: "bg-emerald-100 text-emerald-700 border-emerald-200",
  out_for_delivery: "bg-sky-100 text-sky-700 border-sky-200",
  delivered: "bg-slate-100 text-slate-700 border-slate-200",
  delivery_failed: "bg-rose-100 text-rose-700 border-rose-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200 line-through",
};

const CONTEXT_TONE: Record<DeliveryContext, string> = {
  residential: "bg-slate-100 text-slate-700 border-slate-200",
  business: "bg-slate-100 text-slate-700 border-slate-200",
  hospital: "bg-amber-100 text-amber-700 border-amber-200",
  funeral: "bg-rose-100 text-rose-700 border-rose-200",
};

export function StatusChip({
  status,
  size = "md",
}: {
  status: OrderStatus;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center font-medium border rounded ${pad} ${STATUS_TONE[status]}`}
    >
      {statusLabelDe(status)}
    </span>
  );
}

export function ContextChip({
  context,
  size = "md",
}: {
  context: DeliveryContext;
  size?: "sm" | "md";
}) {
  if (context === "residential") return null;
  const pad = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center font-medium border rounded ${pad} ${CONTEXT_TONE[context]}`}
    >
      {contextLabelDe(context)}
    </span>
  );
}
