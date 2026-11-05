BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='25s';
-- Store repeated, immutable GHL field catalog versions once. The public views
-- reconstruct the exact original documents; business CSM/leads tables are unchanged.
CREATE TABLE public.ghl_field_catalogs (
 id text PRIMARY KEY, document jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ghl_field_catalogs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ghl_field_catalogs FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.ghl_field_catalogs TO service_role;
CREATE FUNCTION public.ghl_intern_catalog(document jsonb) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE key text;
BEGIN
 key:=encode(sha256(convert_to(document::text,'UTF8')),'hex');
 INSERT INTO public.ghl_field_catalogs(id,document) VALUES(key,document) ON CONFLICT(id) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM public.ghl_field_catalogs c WHERE c.id=key AND c.document=ghl_intern_catalog.document)
 THEN RAISE EXCEPTION 'Catalog hash conflict'; END IF;
 RETURN key;
END $$;
REVOKE ALL ON FUNCTION public.ghl_intern_catalog(jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.ghl_restore_catalog(document jsonb, catalog_id text, data_catalog_id text DEFAULT NULL) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT (CASE WHEN catalog_id IS NULL THEN document ELSE document||jsonb_build_object('customFieldDefinitions',(SELECT c.document FROM public.ghl_field_catalogs c WHERE c.id=catalog_id)) END)
 || CASE WHEN data_catalog_id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('data',coalesce(document->'data','{}')||jsonb_build_object('customFieldDefinitions',(SELECT c.document FROM public.ghl_field_catalogs c WHERE c.id=data_catalog_id))) END;
$$;
REVOKE ALL ON FUNCTION public.ghl_restore_catalog(jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ghl_restore_catalog(jsonb,text,text) TO service_role;
CREATE FUNCTION public.ghl_compact_catalogs() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.fields ? 'customFieldDefinitions' THEN
  NEW.fields_catalog_id:=public.ghl_intern_catalog(NEW.fields->'customFieldDefinitions');
  NEW.fields:=NEW.fields-'customFieldDefinitions';
 END IF;
 IF NEW.latest_payload ? 'customFieldDefinitions' THEN
  NEW.payload_catalog_id:=public.ghl_intern_catalog(NEW.latest_payload->'customFieldDefinitions');
  NEW.latest_payload:=NEW.latest_payload-'customFieldDefinitions';
 END IF;
 IF jsonb_typeof(NEW.latest_payload->'data')='object' AND NEW.latest_payload->'data' ? 'customFieldDefinitions' THEN
  NEW.payload_data_catalog_id:=public.ghl_intern_catalog(NEW.latest_payload->'data'->'customFieldDefinitions');
  NEW.latest_payload:=jsonb_set(NEW.latest_payload,'{data}',(NEW.latest_payload->'data')-'customFieldDefinitions');
 END IF;
 NEW.catalog_compacted:=true;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ghl_compact_catalogs() FROM PUBLIC,anon,authenticated,service_role;
DO $migration$
DECLARE table_name text; columns_sql text; definition text; field_view text;
BEGIN
 field_view:=pg_get_viewdef('public.leads_ghl_field_values'::regclass,true);
 FOREACH table_name IN ARRAY ARRAY['leads_ghl_contacts','csm_ghl_contacts'] LOOP
  SELECT string_agg(CASE WHEN attname='fields' THEN 'public.ghl_restore_catalog(s.fields,s.fields_catalog_id) AS fields'
   WHEN attname='latest_payload' THEN 'public.ghl_restore_catalog(s.latest_payload,s.payload_catalog_id,s.payload_data_catalog_id) AS latest_payload'
   ELSE format('s.%I',attname) END,',' ORDER BY attnum) INTO columns_sql
  FROM pg_attribute WHERE attrelid=('public.'||table_name)::regclass AND attnum>0 AND NOT attisdropped;
  EXECUTE format('ALTER TABLE public.%I RENAME TO %I',table_name,table_name||'_store');
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN fields_catalog_id text REFERENCES public.ghl_field_catalogs(id), ADD COLUMN payload_catalog_id text REFERENCES public.ghl_field_catalogs(id), ADD COLUMN payload_data_catalog_id text REFERENCES public.ghl_field_catalogs(id), ADD COLUMN catalog_compacted boolean NOT NULL DEFAULT false',table_name||'_store');
  EXECUTE format('CREATE TRIGGER aa_share_catalog BEFORE INSERT OR UPDATE OF fields,latest_payload ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ghl_compact_catalogs()',table_name||'_store');
  EXECUTE format('CREATE VIEW public.%I WITH(security_invoker=true) AS SELECT %s FROM public.%I s',table_name,columns_sql,table_name||'_store');
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',table_name);
  EXECUTE format('GRANT SELECT ON public.%I TO service_role',table_name);
 END LOOP;
 -- Keep the field inspection view's contract, including catalog metadata.
 EXECUTE 'CREATE OR REPLACE VIEW public.leads_ghl_field_values AS '||field_view;
 FOREACH table_name IN ARRAY ARRAY['leads','csm'] LOOP
  SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='metricas_'||table_name||'_ghl_ingest';
  IF definition IS NULL OR position('insert into '||table_name||'_ghl_contacts(' in definition)=0 THEN RAISE EXCEPTION 'Unexpected ingestion function: %',table_name;END IF;
  definition:=replace(definition,'insert into '||table_name||'_ghl_contacts(', 'insert into '||table_name||'_ghl_contacts_store(');
  definition:=replace(definition,table_name||'_ghl_contacts.fields||excluded.fields',table_name||'_ghl_contacts_store.fields||excluded.fields');
  definition:=replace(definition,table_name||'_ghl_contacts.source_updated_at',table_name||'_ghl_contacts_store.source_updated_at');
  definition:=replace(definition,'on conflict(ghlid) do update set latest_payload=',
   'on conflict(ghlid) do update set fields_catalog_id=coalesce(excluded.fields_catalog_id,'||table_name||'_ghl_contacts_store.fields_catalog_id),payload_catalog_id=excluded.payload_catalog_id,payload_data_catalog_id=excluded.payload_data_catalog_id,latest_payload=');
  EXECUTE definition;
 END LOOP;
 -- The batch job changes storage only; don't re-run unrelated profile/recording writes.
 FOREACH table_name IN ARRAY ARRAY['metricas_refresh_csm_followup_profile','sync_recording_source','refresh_webinar_setter_attribution'] LOOP
  SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=table_name;
  IF definition IS NOT NULL THEN
   definition:=regexp_replace(definition,'\mbegin\M',E'begin\n if current_setting(''metricas.catalog_compaction'',true)=''on'' then return new;end if;','i');
   EXECUTE definition;
  END IF;
 END LOOP;
END $migration$;
CREATE TABLE public.ghl_catalog_compaction_audit (
 source text NOT NULL,ghlid text NOT NULL,before_hash text NOT NULL,after_hash text NOT NULL,
 checked_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(source,ghlid),CHECK(before_hash=after_hash)
);
ALTER TABLE public.ghl_catalog_compaction_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ghl_catalog_compaction_audit FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.ghl_catalog_compaction_audit TO service_role;
CREATE FUNCTION public.compact_ghl_catalog_batch(source text,batch_size integer DEFAULT 25) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record;before_doc jsonb;after_doc jsonb;done integer:=0;
BEGIN
 IF source NOT IN ('leads_ghl_contacts','csm_ghl_contacts') OR batch_size<1 OR batch_size>100 THEN RAISE EXCEPTION 'Invalid compaction batch';END IF;
 PERFORM set_config('metricas.catalog_compaction','on',true);
 FOR item IN EXECUTE format('SELECT ghlid FROM public.%I WHERE NOT catalog_compacted ORDER BY ghlid LIMIT $1 FOR UPDATE SKIP LOCKED',source||'_store') USING batch_size LOOP
  EXECUTE format('SELECT to_jsonb(v) FROM public.%I v WHERE ghlid=$1',source) INTO before_doc USING item.ghlid;
  EXECUTE format('UPDATE public.%I SET fields=fields,latest_payload=latest_payload WHERE ghlid=$1',source||'_store') USING item.ghlid;
  EXECUTE format('SELECT to_jsonb(v) FROM public.%I v WHERE ghlid=$1',source) INTO after_doc USING item.ghlid;
  IF before_doc IS DISTINCT FROM after_doc THEN RAISE EXCEPTION 'Compaction changed document: % %',source,item.ghlid;END IF;
  INSERT INTO public.ghl_catalog_compaction_audit(source,ghlid,before_hash,after_hash)
   VALUES(source,item.ghlid,encode(sha256(convert_to(before_doc::text,'UTF8')),'hex'),encode(sha256(convert_to(after_doc::text,'UTF8')),'hex'));
  done:=done+1;
 END LOOP;
 PERFORM set_config('metricas.catalog_compaction','off',true);
 RETURN done;
END $$;
REVOKE ALL ON FUNCTION public.compact_ghl_catalog_batch(text,integer) FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
