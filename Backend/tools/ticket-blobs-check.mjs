// Self-check for src/lib/ticketBlobs.ts (attachments moved out of the ticket JSON). No DB needed:
//   cd Backend && node tools/ticket-blobs-check.mjs
import assert from "node:assert/strict";
import { build } from "esbuild";

const { outputFiles } = await build({ entryPoints: ["src/lib/ticketBlobs.ts"], bundle: true, format: "esm", platform: "node", write: false });
const { externalize, inflate, hasBlobs, stripBlobs, BLOB_MIN } = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));

const disk = new Map(); // fake blob table
let puts = 0;
const store = { put: async (id, c) => { puts++; disk.set(id, c); }, get: async (ids) => new Map(ids.filter((i) => disk.has(i)).map((i) => [i, disk.get(i)])) };

const big = "data:image/png;base64," + "A".repeat(BLOB_MIN + 10);
const big2 = "data:image/png;base64," + "B".repeat(BLOB_MIN + 10);
const small = "data:image/png;base64," + "C".repeat(1000);
const ticket = {
  id: "t1", status: "open", diagramUrl: big, diagramUrls: [big],
  messages: [{ id: "m1", text: "hi", attachmentUrl: big, attachmentUrls: [big, small] }, { id: "m2", text: "x", attachmentUrls: [big2] }],
};
const before = JSON.stringify(ticket).length;

const light = await externalize(ticket, store);
assert.ok(JSON.stringify(light).length < 2000, "ticket is small once attachments are out");
assert.ok(before > 3 * BLOB_MIN, "fixture really was big");
assert.equal(light.messages[0].attachmentUrls[1], small, "small attachment stays inline");
assert.equal(disk.size, 2, "two different big files -> two blobs (same file shared one)");
assert.equal(light.diagramUrl, light.messages[0].attachmentUrl, "same file -> same marker");
assert.equal(ticket.diagramUrl, big, "input is not modified");

assert.deepEqual(await inflate(light, store), ticket, "inflate gives back the exact original");

const putsBefore = puts;
assert.deepEqual(await externalize(light, store), light, "externalizing twice changes nothing");
assert.equal(puts, putsBefore, "...and writes nothing");

assert.equal(hasBlobs(light), true);
assert.equal(hasBlobs(ticket), false);
assert.equal(hasBlobs({ text: "edurain-blob:not-a-real-marker" }), false, "look-alike text is not a marker");

const gone = { a: "edurain-blob:" + "0".repeat(32) };
assert.deepEqual(await inflate(gone, store), gone, "missing blob: marker left as is, no crash");

const listed = stripBlobs(light);
assert.equal(listed.diagramUrl, "[attachment]");
assert.equal(listed.messages[0].attachmentUrls[1], small, "list keeps small inline attachments");
assert.equal(await inflate({ plain: "hello" }, store).then((v) => v.plain), "hello");
console.log(`ticket-blobs-check: all asserts passed (ticket ${(before / 1048576).toFixed(2)} MB -> ${(JSON.stringify(light).length / 1024).toFixed(1)} KB)`);
