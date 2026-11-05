-- Production audit: 0 idx_scan; ~60 MB indexing repeated catalog JSON.
-- Compatibility reads reconstruct fields, so this physical-fields GIN does not
-- serve those queries. Keep the identity/lead unique indexes unchanged.
BEGIN;
SET LOCAL lock_timeout='2s';
DROP INDEX IF EXISTS public.leads_ghl_contacts_fields;
COMMIT;
-- Restore if a future store query needs JSON containment:
-- CREATE INDEX CONCURRENTLY leads_ghl_contacts_fields
-- ON public.leads_ghl_contacts_store USING gin (fields jsonb_path_ops);
