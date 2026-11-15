import { redirect } from "next/navigation";

// Deep-link fallback. The real customer detail now lives in the split
// pane on /admin/kunden?selected=<id>; this just forwards old links.
export default async function KundeDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/kunden?selected=${encodeURIComponent(id)}`);
}
