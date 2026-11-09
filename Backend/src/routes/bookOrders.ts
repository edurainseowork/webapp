import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { requireAuth } from "../middlewares/auth.js";
import { logger } from "../lib/logger";
import { DELIVERY_STATUSES, listShipments, parseShipping, saveShipment, updateShipment, type DeliveryStatus } from "../lib/bookShipments";

const studentId = async (req: any): Promise<number | null> => {
  if (req.user?.id) return req.user.id;
  if (!req.auth?.uid) return null;
  const [row] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.firebaseUid, req.auth.uid)).limit(1);
  return row?.id ?? null;
};

// POST /api/book-orders: delivery details for a "<batch> Books" order, sent after /api/razorpay/order and before paying
export const bookOrdersRouter = Router();
bookOrdersRouter.post("/", requireAuth, async (req, res) => {
  const razorpayOrderId = typeof req.body?.razorpayOrderId === "string" ? req.body.razorpayOrderId.trim() : "";
  if (!/^order_[A-Za-z0-9]{6,40}$/.test(razorpayOrderId)) {
    res.status(400).json({ error: "Invalid order" });
    return;
  }
  const parsed = parseShipping(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  try {
    const userId = await studentId(req);
    if (!userId) {
      res.status(404).json({ error: "User not found. Please log in again." });
      return;
    }
    const result = await saveShipment(userId, razorpayOrderId, parsed.details);
    if ("error" in result) {
      res.status(result.status ?? 400).json({ error: result.error });
      return;
    }
    res.json({ success: true, shipmentId: result.id, bookName: result.bookName });
  } catch (err) {
    logger.error({ err }, "Saving book delivery details failed");
    res.status(500).json({ error: "Could not save the delivery details. Please try again." });
  }
});

// /api/cms/book-orders (admins): the orders to pack and ship
export const cmsBookOrdersRouter = Router();
cmsBookOrdersRouter.get("/", async (req, res) => {
  try {
    const filter = req.query.status === "all" ? "all" : "paid";
    res.json({ data: await listShipments(filter) });
  } catch (err) {
    logger.error({ err }, "Book orders list failed");
    res.status(500).json({ error: "Could not load book orders" });
  }
});

cmsBookOrdersRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const status = req.body?.deliveryStatus;
  if (status !== undefined && !DELIVERY_STATUSES.includes(status)) {
    res.status(400).json({ error: "Invalid delivery status" });
    return;
  }
  const field = (v: unknown, max: number) => (v === undefined ? undefined : v === null || v === "" ? null : String(v).trim().slice(0, max));
  try {
    const row = await updateShipment(id, {
      deliveryStatus: status as DeliveryStatus | undefined,
      courier: field(req.body?.courier, 80),
      trackingNumber: field(req.body?.trackingNumber, 80),
      adminNote: field(req.body?.adminNote, 500),
    });
    if (!row) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json({ data: row });
  } catch (err) {
    logger.error({ err }, "Book order update failed");
    res.status(500).json({ error: "Could not update the order" });
  }
});
