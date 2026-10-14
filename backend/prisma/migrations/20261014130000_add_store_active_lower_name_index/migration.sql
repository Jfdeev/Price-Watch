CREATE INDEX "Store_active_lower_name_idx" ON "Store" (lower("name")) WHERE "isActive";
