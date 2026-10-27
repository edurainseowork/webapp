import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { pool } from "../db/index.js";
import { optionalAuth, requireAdminOrFaculty, authenticateToken } from "../middleware/auth.js";
import { toPublicUrl, deleteLocalUpload } from "../lib/media.js";
import { logger } from "../lib/logger.js";

const router = Router();

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
    const formatted = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      subject: row.subject,
      courseId: row.course_id,
      courseTitle: row.course_title,
      totalPages: row.total_pages,
      pagesRead: row.pages_read,
      rating: Number(row.rating) || 4.9,
      isCourseBook: row.is_course_book,
      pdfUrl: toPublicUrl(row.pdf_url, req),
      fileSize: row.file_size,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

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
        pdfUrl.trim(),
        fileSize || null,
      ]
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
      pdfUrl: toPublicUrl(pdfUrl.trim(), req),
      fileSize: fileSize || null,
    };

    logger.info({ id, title }, "E-Book created successfully");
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

    const pdfUrl = existing.rows[0].pdf_url;
    await pool.query(`DELETE FROM ebooks WHERE id = $1`, [id]);
    await deleteLocalUpload(pdfUrl);

    logger.info({ id }, "E-Book deleted successfully");
    res.json({ success: true, message: "E-book deleted successfully" });
  } catch (err: any) {
    logger.error({ err }, "[ebooks] Failed to delete ebook");
    res.status(500).json({ error: err.message || "Failed to delete ebook" });
  }
});

export default router;
