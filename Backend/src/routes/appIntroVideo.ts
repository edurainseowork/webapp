import { Router } from "express";
import { logger } from "../lib/logger";
import { bunnyVideoInfo, clearIntroVideo, getIntroVideo, setIntroVideo } from "../lib/appIntroVideo";

// GET /api/app-intro-video: what the mobile app plays once after a student logs in ({ video: null } when none)
export const appIntroVideoRouter = Router();
appIntroVideoRouter.get("/", async (_req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=60");
    res.json({ video: await getIntroVideo() });
  } catch (err) {
    logger.error({ err }, "Intro video read failed");
    res.status(500).json({ error: "Could not load the intro video" });
  }
});

// /api/cms/app-intro-video (admins): set after uploading to Bunny from the CMS, or remove
export const cmsAppIntroVideoRouter = Router();
cmsAppIntroVideoRouter.get("/", async (_req, res) => {
  try {
    const video = await getIntroVideo();
    const info = video ? await bunnyVideoInfo(video.videoId).catch(() => null) : null;
    res.json({ video, ready: info?.ready ?? null });
  } catch (err) {
    logger.error({ err }, "Intro video read failed");
    res.status(500).json({ error: "Could not load the intro video" });
  }
});

cmsAppIntroVideoRouter.put("/", async (req, res) => {
  const videoId = String(req.body?.videoId || "").trim();
  const title = req.body?.title ? String(req.body.title).slice(0, 200) : null;
  if (!/^[0-9a-f-]{36}$/i.test(videoId)) {
    res.status(400).json({ error: "A Bunny video ID is required" });
    return;
  }
  try {
    const info = await bunnyVideoInfo(videoId).catch(() => null);
    if (info && !info.ready && info.lengthSec === null) {
      // Saved anyway: Bunny may still be processing a fresh upload; the CMS shows its status
      logger.info({ videoId }, "Intro video saved before Bunny finished processing");
    }
    const video = await setIntroVideo(videoId, title, info?.lengthSec ?? null);
    res.json({ video, ready: info?.ready ?? null });
  } catch (err) {
    logger.error({ err }, "Intro video save failed");
    res.status(500).json({ error: "Could not save the intro video" });
  }
});

cmsAppIntroVideoRouter.delete("/", async (_req, res) => {
  try {
    await clearIntroVideo();
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Intro video delete failed");
    res.status(500).json({ error: "Could not remove the intro video" });
  }
});
