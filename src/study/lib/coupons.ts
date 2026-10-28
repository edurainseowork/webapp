import { apiFetch } from './api';

// Coupons made in CMS → Private/Public Coupons, used on the course page.
// GET /api/coupons/public?courseId= lists the public ones; POST /api/coupons/validate checks a code
// and works out the price for the chosen plan. The amount charged is always re-checked by the server.

export interface PublicCoupon {
  code: string;
  discountPercent: number;
  /** Rupees; null = no cap */
  maxDiscountAmount: number | null;
}

export type CouponPlan = 'basic' | 'pro' | 'proMax';

export interface AppliedCoupon {
  code: string;
  discountPercent: number;
  maxDiscountAmount: number | null;
  /** Rupees */
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
}

export async function fetchPublicCoupons(courseId: number): Promise<PublicCoupon[]> {
  const res = await apiFetch<{ data?: PublicCoupon[] }>(`/coupons/public?courseId=${courseId}`);
  return Array.isArray(res.data) ? res.data : [];
}

/** Checks a code for this course + plan. Throws with the server's message ("Invalid coupon code", …). */
export async function validateCoupon(code: string, courseId: number, plan: CouponPlan): Promise<AppliedCoupon> {
  const res = await apiFetch<{
    code: string;
    discountPercent: number;
    maxDiscountAmount: number | null;
    originalPrice: number;
    discountAmount: number;
    finalPrice: number;
  }>('/coupons/validate', { method: 'POST', body: { code: code.trim(), courseId, plan } });
  return {
    code: res.code,
    discountPercent: res.discountPercent,
    maxDiscountAmount: res.maxDiscountAmount ?? null,
    originalPrice: res.originalPrice / 100,
    discountAmount: res.discountAmount / 100,
    finalPrice: res.finalPrice / 100,
  };
}

/** "20% OFF" or "20% OFF up to ₹500" */
export const couponLabel = (c: { discountPercent: number; maxDiscountAmount: number | null }) =>
  `${c.discountPercent}% OFF${c.maxDiscountAmount ? ` up to ₹${c.maxDiscountAmount.toLocaleString('en-IN')}` : ''}`;


  