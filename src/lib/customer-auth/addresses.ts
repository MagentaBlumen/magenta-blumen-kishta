import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { customerAddress } from "@/db/schema/customer";

export type CustomerAddressRow = {
  id: number;
  labelDe: string | null;
  recipientName: string;
  street: string;
  plz: string;
  city: string;
  phone: string | null;
  notes: string | null;
};

export async function fetchCustomerAddresses(
  customerId: number,
): Promise<CustomerAddressRow[]> {
  return db
    .select({
      id: customerAddress.id,
      labelDe: customerAddress.labelDe,
      recipientName: customerAddress.recipientName,
      street: customerAddress.street,
      plz: customerAddress.plz,
      city: customerAddress.city,
      phone: customerAddress.phone,
      notes: customerAddress.notes,
    })
    .from(customerAddress)
    .where(eq(customerAddress.customerId, customerId))
    .orderBy(asc(customerAddress.labelDe), asc(customerAddress.recipientName));
}
