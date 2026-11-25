import { NextResponse } from "next/server";
import { cartItemCount } from "@/lib/cart/hydrate";

// Lightweight dynamic island: the storefront header fetches this on
// mount so the cart badge can show a real count without the whole
// storefront layout having to read the cart cookie. Moving this read
// off the layout is what lets product and catalogue pages cache
// (`revalidate = 300`) instead of staying per-request dynamic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const count = await cartItemCount();
  return NextResponse.json({ count });
}
