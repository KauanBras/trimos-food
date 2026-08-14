-- Temporary compatibility for the currently deployed health check and sitemap.
-- Only explicitly public columns are exposed; customer writes remain locked to
-- the rate-limited server API. Remove this after the projection-based build is live.

grant select (id, slug, status, updated_at) on public.restaurants to anon;

drop policy if exists restaurants_legacy_public_projection on public.restaurants;
create policy restaurants_legacy_public_projection
on public.restaurants for select to anon
using (status = 'active');
