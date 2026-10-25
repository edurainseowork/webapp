/**
 * Local copy of the schemas the CMS uses from the monorepo's `@workspace/api-zod`
 * package (tem_application/shared/api-zod). That package only installs with pnpm
 * inside the monorepo, so this standalone CMS keeps its own copy.
 * vite.config.ts and tsconfig.app.json point `@workspace/api-zod` at this file.
 *
 * Keep these in sync with the Backend: it validates the same bodies again.
 */
import * as zod from 'zod';

/* ------------------------------------------------------------------ */
/*  Admin notifications (Notifications page)                           */
/* ------------------------------------------------------------------ */

// Push payloads are capped at 4 KB, so keep them short
export const AdminNotificationBody = zod.object({
  title: zod
    .string({ required_error: 'Title is required' })
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be at most 100 characters'),
  description: zod
    .string({ required_error: 'Description is required' })
    .trim()
    .min(3, 'Description must be at least 3 characters')
    .max(500, 'Description must be at most 500 characters'),
  link: zod
    .string()
    .trim()
    .url('Link must be a valid URL (e.g. https://youtube.com/...)')
    .or(zod.literal(''))
    .nullish()
    .transform((v) => v || null),
});

export type AdminNotificationBody = zod.infer<typeof AdminNotificationBody>;

// Notification images: PNG/JPEG/WEBP up to 1 MB (Android drops larger big-picture images)
export const NOTIFICATION_IMAGE_MAX_BYTES = 1024 * 1024;

/* ------------------------------------------------------------------ */
/*  Coupons (Coupons page)                                             */
/* ------------------------------------------------------------------ */

export const COUPON_CODE_REGEX = /^[A-Z0-9_-]{3,30}$/;

// Coupon codes are stored and matched in upper case
export const normalizeCouponCode = (code: string) => code.trim().toUpperCase();

export const CouponBody = zod
  .object({
    code: zod
      .string({ required_error: 'Coupon code is required' })
      .transform(normalizeCouponCode)
      .pipe(zod.string().regex(COUPON_CODE_REGEX, 'Coupon code must be 3–30 characters: letters, numbers, - or _')),
    discountPercent: zod.coerce
      .number({ invalid_type_error: 'Discount must be a number' })
      .int('Discount must be a whole number')
      .min(1, 'Discount must be between 1 and 100%')
      .max(100, 'Discount must be between 1 and 100%'),
    isPublic: zod.boolean({ required_error: 'Coupon type is required' }),
    courseIds: zod
      .array(zod.coerce.number().int().positive(), { required_error: 'Select at least one course' })
      .min(1, 'Select at least one course')
      .transform((ids) => [...new Set(ids)]),
    usageLimit: zod.coerce
      .number({ invalid_type_error: 'Frequency must be a number' })
      .int('Frequency must be a whole number')
      .positive('Frequency must be a positive number')
      .max(1_000_000, 'Frequency is too large')
      .nullish(),
    maxDiscountAmount: zod.coerce
      .number({ invalid_type_error: 'Cap amount must be a number' })
      .int('Cap amount must be a whole number')
      .positive('Cap amount must be a positive number')
      .max(10_000_000, 'Cap amount is too large')
      .nullish(),
  })
  .superRefine((value, ctx) => {
    if (!value.isPublic && value.usageLimit == null) {
      ctx.addIssue({ code: zod.ZodIssueCode.custom, path: ['usageLimit'], message: 'Frequency is required for private coupons' });
    }
  })
  // Public coupons are unlimited; maxDiscountAmount defaults to null if not provided
  .transform((value) => ({
    ...value,
    usageLimit: value.isPublic ? null : value.usageLimit ?? null,
    maxDiscountAmount: value.maxDiscountAmount ?? null,
  }));

export type CouponBody = zod.infer<typeof CouponBody>;

/* ------------------------------------------------------------------ */
/*  Live classes (Go Live page)                                        */
/* ------------------------------------------------------------------ */

// Standard Meet meeting code, e.g. https://meet.google.com/abc-defg-hij (an optional query string such as ?authuser=1 is allowed)
export const GOOGLE_MEET_URL_REGEX = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}(\?[^\s#]*)?$/;

export const MAX_LIVE_CLASS_DURATION_MS = 12 * 60 * 60 * 1000;

// Accepts "meet.google.com/..." without a scheme and upgrades http:// to https://
export const normalizeMeetUrl = (value: string): string => {
  const trimmed = value.trim();
  if (/^meet\.google\.com\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed.replace(/^http:\/\//i, 'https://');
};

export const CreateLiveClassBody = zod
  .object({
    title: zod
      .string({ required_error: 'Title is required' })
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .max(150, 'Title must be at most 150 characters'),
    startTime: zod
      .string({ required_error: 'Start time is required' })
      .datetime({ offset: true, message: 'Start time must be an ISO 8601 date-time' }),
    endTime: zod
      .string({ required_error: 'End time is required' })
      .datetime({ offset: true, message: 'End time must be an ISO 8601 date-time' }),
    meetUrl: zod
      .string({ required_error: 'Google Meet link is required' })
      .transform(normalizeMeetUrl)
      .pipe(zod.string().regex(GOOGLE_MEET_URL_REGEX, 'Enter a valid Google Meet link, e.g. https://meet.google.com/abc-defg-hij')),
  })
  .superRefine((value, ctx) => {
    const start = new Date(value.startTime).getTime();
    const end = new Date(value.endTime).getTime();
    if (end <= start) {
      ctx.addIssue({ code: zod.ZodIssueCode.custom, path: ['endTime'], message: 'End time must be after the start time' });
      return;
    }
    if (end - start > MAX_LIVE_CLASS_DURATION_MS) {
      ctx.addIssue({ code: zod.ZodIssueCode.custom, path: ['endTime'], message: 'A live class can be at most 12 hours long' });
    }
    if (end <= Date.now()) {
      ctx.addIssue({ code: zod.ZodIssueCode.custom, path: ['endTime'], message: 'This live class would already be over' });
    }
  });

export type CreateLiveClassBody = zod.infer<typeof CreateLiveClassBody>;