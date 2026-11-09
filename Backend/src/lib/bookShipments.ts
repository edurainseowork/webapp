import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

// Books bought in the Android app: where to ship them. The money goes through the normal batch order
// (payments table, Razorpay): paying for "<batch> Books" also unlocks that batch. One row per Razorpay order.

let ready: Promise<void> | null = null;
export function ensureBookShipmentsSchema(): Promise<void> {
  return (ready ??= (async () => {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS book_shipments (
      id serial PRIMARY KEY,
      razorpay_order_id text NOT NULL UNIQUE,
      user_id integer NOT NULL,
      course_id integer NOT NULL,
      book_name text NOT NULL,
      student_name text NOT NULL,
      receiver_name text NOT NULL,
      receiver_phone text NOT NULL,
      email text NOT NULL,
      address_line text NOT NULL,
      city text NOT NULL,
      state text NOT NULL,
      pincode text NOT NULL,
      delivery_status text NOT NULL DEFAULT 'new',
      courier text,
      tracking_number text,
      admin_note text,
      shipped_at timestamptz,
      delivered_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now())`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS book_shipments_created_idx ON book_shipments (created_at DESC)`);
  })().catch((err) => {
    ready = null;
    throw err;
  }));
}

export interface ShippingDetails {
  studentName: string;
  receiverName: string;
  receiverPhone: string;
  email: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
}

const text = (v: unknown, min: number, max: number) => {
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  return s.length >= min && s.length <= max ? s : null;
};

/** Checks and cleans what the app sent. Returns the details, or the first problem as a message. */
export function parseShipping(body: any): { details: ShippingDetails } | { error: string } {
  const studentName = text(body?.studentName, 2, 80);
  if (!studentName) return { error: "Enter the student's name" };
  const receiverName = text(body?.receiverName, 2, 80);
  if (!receiverName) return { error: "Enter the receiver's name" };
  const phone = String(body?.receiverPhone ?? "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  if (!/^[6-9]\d{9}$/.test(phone)) return { error: "Enter a valid 10-digit receiver mobile number" };
  const email = text(body?.email, 5, 120);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address" };
  const addressLine = text(body?.addressLine, 8, 300);
  if (!addressLine) return { error: "Enter the full delivery address (house, street, area)" };
  const city = text(body?.city, 2, 60);
  if (!city) return { error: "Enter the city" };
  const state = text(body?.state, 2, 60);
  if (!state) return { error: "Enter the state" };
  const pincode = String(body?.pincode ?? "").trim();
  if (!/^[1-9]\d{5}$/.test(pincode)) return { error: "Enter a valid 6-digit pincode" };
  return { details: { studentName, receiverName, receiverPhone: phone, email: email.toLowerCase(), addressLine, city, state, pincode } };
}

/**
 * Saves where to ship the books of an order the student has just created (before they pay).
 * The order must be the student's own, not paid yet. Saving again for the same order updates the address.
 */
export async function saveShipment(userId: number, razorpayOrderId: string, details: ShippingDetails) {
  await ensureBookShipmentsSchema();
  const { rows } = await db.execute<{ course_id: number; status: string; title: string }>(sql`
    SELECT p.course_id, p.status, c.title FROM payments p JOIN courses c ON c.id = p.course_id
    WHERE p.razorpay_order_id = ${razorpayOrderId} AND p.user_id = ${userId}`);
  const order = rows[0];
  if (!order) return { error: "Order not found", status: 404 as const };
  if (order.status !== "created") return { error: "This order is already closed. Please start again.", status: 409 as const };
  const bookName = `${order.title} Books`;
  const saved = await db.execute<{ id: number }>(sql`
    INSERT INTO book_shipments (razorpay_order_id, user_id, course_id, book_name, student_name, receiver_name,
      receiver_phone, email, address_line, city, state, pincode)
    VALUES (${razorpayOrderId}, ${userId}, ${order.course_id}, ${bookName}, ${details.studentName}, ${details.receiverName},
      ${details.receiverPhone}, ${details.email}, ${details.addressLine}, ${details.city}, ${details.state}, ${details.pincode})
    ON CONFLICT (razorpay_order_id) DO UPDATE SET student_name = EXCLUDED.student_name, receiver_name = EXCLUDED.receiver_name,
      receiver_phone = EXCLUDED.receiver_phone, email = EXCLUDED.email, address_line = EXCLUDED.address_line,
      city = EXCLUDED.city, state = EXCLUDED.state, pincode = EXCLUDED.pincode, updated_at = now()
    RETURNING id`);
  return { id: saved.rows[0].id, bookName };
}

export async function listShipments(filter: "paid" | "all") {
  await ensureBookShipmentsSchema();
  const { rows } = await db.execute(sql`
    SELECT s.*, p.status AS payment_status, p.amount AS amount_paise, u.email AS account_email
    FROM book_shipments s
    LEFT JOIN payments p ON p.razorpay_order_id = s.razorpay_order_id
    LEFT JOIN users u ON u.id = s.user_id
    WHERE ${filter} = 'all' OR p.status = 'paid'
    ORDER BY s.created_at DESC
    LIMIT 500`);
  return rows;
}

export const DELIVERY_STATUSES = ["new", "packed", "shipped", "delivered", "cancelled"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export async function updateShipment(
  id: number,
  change: { deliveryStatus?: DeliveryStatus; courier?: string | null; trackingNumber?: string | null; adminNote?: string | null },
) {
  await ensureBookShipmentsSchema();
  const { rows } = await db.execute(sql`
    UPDATE book_shipments SET
      delivery_status = COALESCE(${change.deliveryStatus ?? null}, delivery_status),
      courier = CASE WHEN ${change.courier !== undefined} THEN ${change.courier ?? null} ELSE courier END,
      tracking_number = CASE WHEN ${change.trackingNumber !== undefined} THEN ${change.trackingNumber ?? null} ELSE tracking_number END,
      admin_note = CASE WHEN ${change.adminNote !== undefined} THEN ${change.adminNote ?? null} ELSE admin_note END,
      shipped_at = CASE WHEN ${change.deliveryStatus ?? null} = 'shipped' AND shipped_at IS NULL THEN now() ELSE shipped_at END,
      delivered_at = CASE WHEN ${change.deliveryStatus ?? null} = 'delivered' AND delivered_at IS NULL THEN now() ELSE delivered_at END,
      updated_at = now()
    WHERE id = ${id}
    RETURNING *`);
  return rows[0] ?? null;
}
