-- The projection-based production build is live. Remove the narrow legacy
-- access that was kept temporarily to avoid downtime during deployment.

drop policy if exists restaurants_legacy_public_projection on public.restaurants;
revoke select (id, slug, status, updated_at) on public.restaurants from anon;
