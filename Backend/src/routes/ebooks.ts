import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { pool } from "../db/index.js";
import { optionalAuth, requireAdminOrFaculty, authenticateToken } from "../middleware/auth.js";
import { toPublicUrl, deleteLocalUpload } from "../lib/media.js";
import { logger } from "../lib/logger.js";

const router = Router();

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-south-1";
const bucket =
  process.env.AWS_S3_BUCKET ||
  process.env.AWS_S3_BUCKET_NAME ||
  process.env.AWS_BUCKET_NAME ||
  process.env.S3_BUCKET ||
  "";

const s3Client = bucket
  ? new S3Client({
      region,
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
              ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {}),
            }
          : undefined,
    })
  : null;

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

let isTableInitialized = false;

export async function initEbooksTable() {
  if (isTableInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ebooks (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        subject VARCHAR(100) NOT NULL DEFAULT 'General',
        course_id INTEGER,
        course_title VARCHAR(255),
        total_pages INTEGER NOT NULL DEFAULT 100,
        pages_read INTEGER NOT NULL DEFAULT 0,
        rating REAL NOT NULL DEFAULT 4.9,
        is_course_book BOOLEAN NOT NULL DEFAULT true,
        pdf_url TEXT NOT NULL,
        file_size VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    isTableInitialized = true;
  } catch (err) {
    logger.error({ err }, "[ebooks] Error initializing ebooks table");
  }
}

// GET /api/ebooks
router.get("/", optionalAuth, async (req: Request, res: Response) => {
  await initEbooksTable();
  try {
    const { courseId } = req.query;
    let query = `SELECT * FROM ebooks`;
    const params: any[] = [];
    if (courseId && courseId !== "all") {
      params.push(Number(courseId));
      query += ` WHERE course_id = $1`;
    }
    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);
    const formatted = result.rows
      .filter((row) => row.pdf_url && !String(row.pdf_url).startsWith("/uploads/"))
      .map((row) => ({
        id: row.id,
        title: row.title,
        subject: row.subject,
        courseId: row.course_id,
        courseTitle: row.course_title,
        totalPages: row.total_pages,
        pagesRead: row.pages_read,
        rating: Number(row.rating) || 4.9,
        isCourseBook: row.is_course_book,
        pdfUrl: row.pdf_url.startsWith("http") ? row.pdf_url : toPublicUrl(row.pdf_url, req),
        fileSize: row.file_size,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

    // S3 ListObjectsV2 scanning disabled to prevent excessive AWS API billing and spam.
    // All valid ebooks are already stored and managed in the PostgreSQL database.
    res.json({ success: true, ebooks: formatted });
  } catch (err: any) {
    logger.error({ err }, "[ebooks] Failed to fetch ebooks");
    res.status(500).json({ error: "Failed to fetch ebooks" });
  }
});

// POST /api/ebooks
router.post("/", authenticateToken, requireAdminOrFaculty, async (req: Request, res: Response) => {
  await initEbooksTable();
  try {
    const {
      title,
      subject = "General",
      courseId,
      courseTitle,
      totalPages = 100,
      pagesRead = 0,
      rating = 4.9,
      isCourseBook = true,
      pdfUrl,
      fileSize,
    } = req.body || {};

    if (!title || typeof title !== "string" || !title.trim()) {
      res.status(400).json({ error: "Book title is required" });
      return;
    }
    if (!pdfUrl || typeof pdfUrl !== "string" || !pdfUrl.trim()) {
      res.status(400).json({ error: "PDF URL is required" });
      return;
    }

    const id = `ebook-${crypto.randomUUID()}`;
    const cleanCourseId = courseId ? Number(courseId) : null;
    const cleanTotalPages = Number(totalPages) > 0 ? Number(totalPages) : 100;
    const cleanRating = Number(rating) > 0 ? Number(rating) : 4.9;
    const cleanPdfUrl = pdfUrl.trim();

    await pool.query(
      `INSERT INTO ebooks (id, title, subject, course_id, course_title, total_pages, pages_read, rating, is_course_book, pdf_url, file_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        title.trim(),
        (subject || "General").trim(),
        cleanCourseId,
        courseTitle ? courseTitle.trim() : null,
        cleanTotalPages,
        Number(pagesRead) || 0,
        cleanRating,
        Boolean(isCourseBook),
        cleanPdfUrl,
        fileSize || null,
      ],
    );

    const inserted = {
      id,
      title: title.trim(),
      subject: (subject || "General").trim(),
      courseId: cleanCourseId,
      courseTitle: courseTitle ? courseTitle.trim() : null,
      totalPages: cleanTotalPages,
      pagesRead: Number(pagesRead) || 0,
      rating: cleanRating,
      isCourseBook: Boolean(isCourseBook),
      pdfUrl: cleanPdfUrl.startsWith("http") ? cleanPdfUrl : toPublicUrl(cleanPdfUrl, req),
      fileSize: fileSize || null,
    };

    logger.info({ id, title, pdfUrl: inserted.pdfUrl }, "E-Book created successfully");
    res.status(201).json({ success: true, ebook: inserted });
  } catch (err: any) {
    logger.error({ err }, "[ebooks] Failed to create ebook");
    res.status(500).json({ error: err.message || "Failed to create ebook" });
  }
});

// DELETE /api/ebooks/:id
router.delete("/:id", authenticateToken, requireAdminOrFaculty, async (req: Request, res: Response) => {
  await initEbooksTable();
  try {
    const { id } = req.params;
    const existing = await pool.query(`SELECT pdf_url FROM ebooks WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: "E-book not found" });
      return;
    }

    const pdfUrl: string = existing.rows[0].pdf_url;
    await pool.query(`DELETE FROM ebooks WHERE id = $1`, [id]);

    // Clean up from S3 if stored in our S3 bucket
    const s3Prefix = bucket ? `https://${bucket}.s3.${region}.amazonaws.com/` : "";
    if (s3Client && bucket && s3Prefix && pdfUrl.startsWith(s3Prefix)) {
      const key = pdfUrl.slice(s3Prefix.length);
      if (key.startsWith("ebooks/")) {
        await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch((err) => {
          logger.warn({ err, key }, "[ebooks] Could not delete S3 object");
        });
      }
    } else {
      await deleteLocalUpload(pdfUrl);
    }

    logger.info({ id }, "E-Book deleted successfully");
    res.json({ success: true, message: "E-book deleted successfully" });
  } catch (err: any) {
    logger.error({ err }, "[ebooks] Failed to delete ebook");
    res.status(500).json({ error: err.message || "Failed to delete ebook" });
  }
});

export default router;
