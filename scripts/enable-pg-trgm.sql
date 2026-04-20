-- Enable pg_trgm for fuzzy search (similarity scoring, % operator, GIN indexes)
-- Run: psql $DATABASE_URL -f scripts/enable-pg-trgm.sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Optional: add GIN indexes for faster trigram searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_first_name_trgm ON customers_projection USING gin (first_name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_last_name_trgm ON customers_projection USING gin (last_name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_email_trgm ON customers_projection USING gin (email gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_title_trgm ON products_projection USING gin (title gin_trgm_ops);
