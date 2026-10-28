import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { UPLOAD_DIR } from "./lib/media";
import {
  apiContentSecurityPolicy,
  backpressureGuard,
  corsOptions,
  rateLimit,
  securityHeaders,
} from "./middlewares/security";
import { errorHandler } from "./middlewares/error-handler";

const app: Express = express();

app.disable("x-powered-by");
// Number of reverse proxies in front of the app (API Gateway / load balancer / Cloudflare), so req.ip
// safely reads X-Forwarded-For without IP spoofing (PRD Section 15: default 1 hop).
const trustProxy = process.env.TRUST_PROXY ?? "1";
app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(securityHeaders);
app.use(cors(corsOptions()));
// 5 MB JSON limit for tickets router to support compressed image attachments
const ticketsJsonParser = express.json({ limit: "5mb", verify: (req: any, _res: any, buf: Buffer) => { req.rawBody = buf; } });
app.use((req, res, next) => {
  if (req.path.startsWith("/api/tickets") || req.path.startsWith("/api/teacher-assistant-desk/tickets") || req.url.includes("/tickets")) {
    return ticketsJsonParser(req, res, next);
  }
  next();
});

// Global express.json and express.urlencoded with default limits, skipping tickets paths
const defaultJsonParser = express.json({ verify: (req: any, _res: any, buf: Buffer) => { req.rawBody = buf; } });
const defaultUrlencodedParser = express.urlencoded({ extended: true });

app.use((req, res, next) => {
  if (req.path.startsWith("/api/tickets") || req.path.startsWith("/api/teacher-assistant-desk/tickets") || req.url.includes("/tickets")) {
    return next();
  }
  defaultJsonParser(req, res, (err) => {
    if (err) return next(err);
    defaultUrlencodedParser(req, res, next);
  });
});

app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    dotfiles: "deny",
    index: false,
    redirect: false,
    fallthrough: false,
  }),
);

app.use("/api", apiContentSecurityPolicy, backpressureGuard({ maxConcurrent: 400 }), rateLimit({ windowMs: 60_000, max: 300 }), router);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);

export default app;
