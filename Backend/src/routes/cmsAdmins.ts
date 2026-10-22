import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { UserRecord } from "firebase-admin/auth";
import { db, usersTable } from "@workspace/db";
import { firebaseAuth } from "../lib/firebase-admin";
import { HttpError } from "../lib/http-error";
import { logger } from "../lib/logger";
import { SUPER_ADMIN_EMAIL, hasPrivilegedClaims, isSuperAdminEmail } from "../lib/superAdmin";
import { requireSuperAdmin } from "../middlewares/auth";
import { INVITABLE_ROLES, ROLE_LABELS, deskRoleFromClaims, isDeskRole, type InvitableRole } from "../lib/deskRoles";
import { ABOUT_MAX_LENGTH, getStaffProfiles, setStaffAbout, updateStaffProfile, type StaffProfile } from "../lib/staffProfiles";
import { toPublicUrl } from "../lib/media";

// /api/cms/admins — Super Admin only (requireSuperAdmin). Invites and removes staff accounts:
//  - admin: users.role = 'admin' plus the Firebase `admin` claim, exactly like admins set up with
//    tools/set-admin.mjs; every other CMS route treats them the same as the Super Admin.
//  - mentor / teacher_assistant: users.role plus the Firebase `role` claim. They sign in on the
//    study website and can only use their own desk (see lib/deskRoles.ts); no CMS access.
const router = Router();
router.use(requireSuperAdmin);

const CreateAdminBody = z.object({
  email: z.string({ required_error: "Email is required" }).trim().toLowerCase().min(1, "Email is required").max(254).email("Enter a valid email address"),
  // Optional for backward compatibility: older CMS builds send only { email } for admins
  role: z.enum(INVITABLE_ROLES).default("admin"),
  name: z.string().trim().max(80, "Name is too long").optional().transform((v) => (v ? v : undefined)),
    // "About Mentor" (optional, mentors only): experience, subjects, qualifications, achievements
    about: z
    .string()
    .trim()
    .max(ABOUT_MAX_LENGTH, `About Mentor is too long (max ${ABOUT_MAX_LENGTH} characters)`)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

/** The staff role an account has now (from the database row and Firebase claims), if any. */
const currentStaffRole = (dbRole: string | null | undefined, claims: Record<string, unknown> | undefined): string | null => {
  const role = dbRole?.trim().toLowerCase();
  if (role === "admin" || role === "faculty" || isDeskRole(role)) return role;
  if (claims?.admin === true) return "admin";
  const deskRole = deskRoleFromClaims(claims);
  if (deskRole) return deskRole;
  if (hasPrivilegedClaims(claims)) return "faculty";
  return null;
};

const roleLabel = (role: string) => (role in ROLE_LABELS ? ROLE_LABELS[role as InvitableRole] : role === "faculty" ? "Faculty" : role);

/** Firebase claims for an invited role; other staff claims are dropped so the role is unambiguous. */
const claimsFor = (role: InvitableRole, existing: Record<string, unknown> | undefined) => {
  const { admin: _admin, faculty: _faculty, role: _role, ...other } = existing ?? {};
  return role === "admin" ? { ...other, admin: true, role: "admin" } : { ...other, role };
};

const getFirebaseUser = async (lookup: () => Promise<UserRecord>): Promise<UserRecord | null> => {
  try {
    return await lookup();
  } catch (err) {
    if ((err as { code?: string }).code === "auth/user-not-found") return null;
    throw err;
  }
};

// GET /api/cms/admins — every admin, mentor and teacher assistance account
router.get("/", async (req, res) => {
  const rows = await db
    .select({ uid: usersTable.firebaseUid, email: usersTable.email, name: usersTable.name, role: usersTable.role, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(sql`lower(${usersTable.role}) in ('admin', 'mentor', 'teacher_assistant')`)
    .orderBy(usersTable.createdAt);
  // Mentor profiles ("About Mentor", headline, institute…); a failure here must not hide the list
  const profiles = await getStaffProfiles(rows.filter((r) => r.role?.toLowerCase() === "mentor").map((r) => r.uid)).catch((err) => {
    logger.error({ err }, "Could not load staff profiles");
    return new Map<string, StaffProfile>();
  });

  // Firebase account details (disabled, created, last sign-in) in batches of 100
  const records = new Map<string, UserRecord>();
  for (let i = 0; i < rows.length; i += 100) {
    const result = await firebaseAuth.getUsers(rows.slice(i, i + 100).map((r) => ({ uid: r.uid })));
    for (const user of result.users) records.set(user.uid, user);
  }

  const admins = rows.map((row) => {
    const record = records.get(row.uid);
    const email = record?.email ?? row.email;
    const superAdmin = isSuperAdminEmail(email);
    const self = row.uid === req.auth?.uid;
    return {
      uid: row.uid,
      email,
      name: record?.displayName ?? row.name,
      role: (row.role ?? "admin").toLowerCase(),
      about: profiles.get(row.uid)?.about ?? null,
      profile: (() => {
        const p = profiles.get(row.uid);
        return p ? { ...p, photo: p.photo ? toPublicUrl(p.photo, req) : null } : null;
      })(),
      status: !record ? "NO_ACCOUNT" : record.disabled ? "DISABLED" : record.metadata.lastSignInTime ? "ACTIVE" : "INVITED",
      isSuperAdmin: superAdmin,
      isSelf: self,
      canDelete: !superAdmin && !self,
      createdAt: record?.metadata.creationTime ? new Date(record.metadata.creationTime).toISOString() : row.createdAt,
      lastSignInAt: record?.metadata.lastSignInTime ? new Date(record.metadata.lastSignInTime).toISOString() : null,
    };
  });
  admins.sort((a, b) => Number(b.isSuperAdmin) - Number(a.isSuperAdmin));

  res.json({ data: admins });
});

// POST /api/cms/admins { email, role?, name? } — invite an Admin (default), Mentor or Teacher Assistance.
// Creates the Firebase account when it does not exist yet (no password; the CMS then has
// Firebase email a "set your password" link), sets the role claim and the users.role.
router.post("/", async (req, res) => {
  const { email, role, name, about } = CreateAdminBody.parse(req.body);
  if (isSuperAdminEmail(email)) throw new HttpError(400, "This email already belongs to the Super Admin");

  let record = await getFirebaseUser(() => firebaseAuth.getUserByEmail(email));
  if (record) {
    const [row] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.firebaseUid, record.uid)).limit(1);
    const current = currentStaffRole(row?.role, record.customClaims);
    if (role === "admin") {
      // Unchanged admin rule; an account with another staff role must be removed first
      if (record && hasPrivilegedClaims(record.customClaims) && (!row || row.role?.toLowerCase() === "admin")) {
        throw new HttpError(409, "This email is already an admin");
      }
      if (current && current !== "admin" && current !== "faculty") {
        throw new HttpError(409, `This email is already a ${roleLabel(current)}. Remove that role first.`);
      }
    } else if (current && !(current === role && row?.role?.toLowerCase() !== role)) {
      // (Re-inviting the same role is allowed when the database row lost it, e.g. a failed earlier invite)
      throw new HttpError(
        409,
        current === role ? `This email is already a ${roleLabel(role)}` : `This email is already a ${roleLabel(current)}. Remove that role first.`,
      );
    }
  }

  const created = !record;
  if (!record) {
    record = await firebaseAuth.createUser({ email, emailVerified: false, ...(name ? { displayName: name } : {}) });
  } else if (name && !record.displayName) {
    record = await firebaseAuth.updateUser(record.uid, { displayName: name });
  }
  await firebaseAuth.setCustomUserClaims(record.uid, claimsFor(role, record.customClaims));

  // Same users row the auth middleware would create on first sign-in, with the admin role
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`${usersTable.firebaseUid} = ${record.uid} OR lower(${usersTable.email}) = ${email}`)
    .limit(1);
  if (existing) {
    await db
      .update(usersTable)
      .set({ role, firebaseUid: record.uid, ...(name ? { name } : {}), updatedAt: new Date() })
      .where(eq(usersTable.id, existing.id));
  } else {
    await db.insert(usersTable).values({ firebaseUid: record.uid, email, name: name || record.displayName || email.split("@")[0], role });
  }

  // Saved against the same Firebase uid, so it is never a second record. Left as it is when the
  // field is empty (a re-invite without a description keeps the earlier one).
  let aboutSaved = true;
  if (role === "mentor" && about) {
    try {
      await setStaffAbout(record.uid, about);
    } catch (err) {
      // The account is already invited; report it instead of failing the whole invite
      aboutSaved = false;
      logger.error({ err, uid: record.uid }, "Could not save About Mentor");
    }
  }

  logger.info({ uid: record.uid, role, created, by: req.auth?.uid }, "Staff account invited");
  res.status(201).json({ data: { uid: record.uid, email, role, createdAccount: created, about: role === "mentor" ? about ?? null : null, aboutSaved } });
});
// Same rule as course photos: our own uploads ("/uploads/<file>", also sent back as absolute
// URLs) or an https URL
const OWN_UPLOAD_URL_RE = /^https?:\/\/[^/]+(\/uploads\/[A-Za-z0-9-]+\.(?:png|jpe?g|webp))$/;
const photoField = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().replace(OWN_UPLOAD_URL_RE, "$1") : v),
  z
    .string()
    .max(500)
    .refine((v) => /^\/uploads\/[A-Za-z0-9-]+\.(?:png|jpe?g|webp)$/.test(v) || /^https:\/\/\S+$/.test(v), "Invalid photo")
    .nullable(),
);
const text = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long (max ${max} characters)`)
    .nullable()
    .transform((v) => (v ? v : null));

const MentorProfileBody = z
  .object({
    headline: text(120, "Short description"),
    about: text(ABOUT_MAX_LENGTH, "About Mentor"),
    institute: text(120, "College / institute"),
    achievement: text(120, "Achievement"),
    languages: text(80, "Languages"),
    photo: photoField,
    sessionMinutes: z.number().int().min(15).max(120),
    verified: z.boolean(),
    active: z.boolean(),
  })
  .partial()
  .strict();

// PATCH /api/cms/admins/:uid/profile — edit a mentor's public profile (Super Admin only).
// "verified" and "active" can only be set here, never by the mentor.
router.patch("/:uid/profile", async (req, res) => {
  const uid = String(req.params.uid ?? "");
  if (!/^[\w-]{1,128}$/.test(uid)) throw new HttpError(400, "Invalid user id");
  const patch = MentorProfileBody.parse(req.body);
  const [row] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.firebaseUid, uid)).limit(1);
  if (row?.role?.toLowerCase() !== "mentor") throw new HttpError(404, "Mentor not found");

  await updateStaffProfile(uid, patch);
  const profile = (await getStaffProfiles([uid])).get(uid)!;
  logger.info({ uid, fields: Object.keys(patch), by: req.auth?.uid }, "Mentor profile updated");
  res.json({ data: { uid, profile: { ...profile, photo: profile.photo ? toPublicUrl(profile.photo, req) : null } } });
});

// DELETE /api/cms/admins/:uid — remove an admin's, mentor's or teacher assistance's access.
// Clears the role claims, signs them out everywhere and sets users.role back to 'student'.
// Their Firebase account and any other data (purchases, profile) are kept.
router.delete("/:uid", async (req, res) => {
  const uid = String(req.params.uid ?? "");
  if (!/^[\w-]{1,128}$/.test(uid)) throw new HttpError(400, "Invalid admin id");
  if (uid === req.auth?.uid) throw new HttpError(400, "You cannot delete your own account");

  const record = await getFirebaseUser(() => firebaseAuth.getUser(uid));
  const [row] = await db
    .select({ email: usersTable.email, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.firebaseUid, uid))
    .limit(1);

  const email = (record?.email ?? row?.email ?? "").toLowerCase();
  if (isSuperAdminEmail(email) || email === SUPER_ADMIN_EMAIL) throw new HttpError(403, "The Super Admin account cannot be deleted");
  const dbRole = row?.role?.toLowerCase();
  const isStaffNow =
    dbRole === "admin" || isDeskRole(dbRole) || (record ? hasPrivilegedClaims(record.customClaims) || !!deskRoleFromClaims(record.customClaims) : false);
  if (!isStaffNow) throw new HttpError(404, "Account not found");

  // Firebase first: the old tokens stop working at once (the auth middleware checks revocation
  // for any token that carries admin claims)
  if (record) {
    const { admin: _admin, role: _role, faculty: _faculty, ...otherClaims } = record.customClaims ?? {};
    await firebaseAuth.setCustomUserClaims(uid, otherClaims);
    await firebaseAuth.revokeRefreshTokens(uid);
  }
  await db.update(usersTable).set({ role: "student", updatedAt: new Date() }).where(eq(usersTable.firebaseUid, uid));

  logger.info({ uid, role: dbRole, by: req.auth?.uid }, "Staff access removed");
  res.json({ data: { uid, email } });
});

export default router;