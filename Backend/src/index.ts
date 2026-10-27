import http from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { initSocket } from "./socket";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);
initSocket(server);

import { sendSlackAlert } from "./lib/slackAlert";
import { ensureMentorshipSchema } from "./lib/mentorshipSchema";

ensureMentorshipSchema().catch((err) => {
  logger.error({ err }, "Schema initialization warning on startup");
});

server.listen(port, () => {
  logger.info({ port }, "Server listening with Socket.io");
});

// Process-level alarms: Catch unhandled crashes before server dies
process.on("uncaughtException", async (err) => {
  logger.fatal({ err }, "FATAL: Uncaught Exception detected!");
  await sendSlackAlert("FATAL Server Crash: Uncaught Exception", err);
  process.exit(1);
});

process.on("unhandledRejection", async (reason) => {
  logger.error({ reason }, "Unhandled Promise Rejection detected!");
  await sendSlackAlert("Unhandled Promise Rejection", reason);
});

export * from "./middleware/auth";

