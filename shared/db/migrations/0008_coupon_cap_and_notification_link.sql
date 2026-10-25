-- Coupon cap and notification link
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_discount_amount integer;
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS link text;
