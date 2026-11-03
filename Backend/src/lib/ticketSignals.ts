import { getApp } from "firebase-admin/app";
import "./firebase-admin";
import { logger } from "./logger";

// Live doubt chat on Lambda, where there is no socket server. After a ticket is saved, one small write to
// Firebase Realtime Database tells whoever is listening that it changed: the student's app listens to
// ticketSignals/<id>, the Teacher Assistant desk to ticketSignals/_pool. They then read only what is new
// from this API. Nothing private goes there: the ticket id, its message count and status.
// Off (and the apps simply poll) until FIREBASE_DATABASE_URL is set.
const DB_URL = (process.env.FIREBASE_DATABASE_URL || "").replace(/\/+$/, "");
const SAFE_KEY = /^[^.#$[\]/]+$/; // Realtime Database keys can't contain these

export async function signalTicketChange(id: string, messageCount: number, status: string): Promise<void> {
  if (!DB_URL || !SAFE_KEY.test(id)) return;
  try {
    const credential = getApp().options.credential;
    if (!credential) return; // no service account (local dev): polling only
    const { access_token } = await credential.getAccessToken(); // cached until it expires
    const signal = { n: messageCount, s: status, at: { ".sv": "timestamp" } };
    // One request updates both: the ticket's own signal and the desk's "something changed" signal
    const res = await fetch(`${DB_URL}/ticketSignals.json?access_token=${encodeURIComponent(access_token)}`, {
      method: "PATCH",
      body: JSON.stringify({ [id]: signal, _pool: { id, ...signal } }),
      signal: AbortSignal.timeout(1500), // a slow Firebase must not slow every reply down
    });
    if (!res.ok) logger.warn({ status: res.status, id }, "Ticket live signal rejected");
  } catch (err) {
    // The apps still poll as a safety net, so a missed signal only means the old delay
    logger.warn({ err, id }, "Ticket live signal failed");
  }
}
