const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const {PGlite}=require('@electric-sql/pglite');
test('shared catalogs preserve documents, isolate versions and support ingestion upserts',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table leads_ghl_contacts(ghlid text primary key,lead_id text not null unique,location_id text not null,latest_payload jsonb not null,fields jsonb not null,last_event_id uuid not null,source_updated_at timestamptz,updated_at timestamptz not null default now());
 create table csm_ghl_contacts(ghlid text primary key,csm_id text not null unique,location_id text,latest_payload jsonb not null,fields jsonb not null,last_event_id uuid not null,updated_at timestamptz not null default now());
 grant select on leads_ghl_contacts,csm_ghl_contacts to service_role;
 create view leads_ghl_field_values as select ghlid,key,value from leads_ghl_contacts cross join lateral jsonb_each(fields);
 create function metricas_leads_ghl_ingest(p_id text,p_doc jsonb,p_fields jsonb) returns void language plpgsql as $$begin
 insert into leads_ghl_contacts(ghlid,lead_id,location_id,latest_payload,fields,last_event_id) values(p_id,p_id,'location',p_doc,p_fields,'00000000-0000-0000-0000-000000000001')
 on conflict(ghlid) do update set latest_payload=excluded.latest_payload,fields=leads_ghl_contacts.fields||excluded.fields,updated_at=now();end$$;
 create function metricas_csm_ghl_ingest(p_id text,p_doc jsonb,p_fields jsonb) returns void language plpgsql as $$begin
 insert into csm_ghl_contacts(ghlid,csm_id,location_id,latest_payload,fields,last_event_id) values(p_id,p_id,'location',p_doc,p_fields,'00000000-0000-0000-0000-000000000001')
 on conflict(ghlid) do update set latest_payload=excluded.latest_payload,fields=csm_ghl_contacts.fields||excluded.fields,updated_at=now();end$$;`);
 const catalog=[{id:'field-1',name:'Contrato',options:['pendiente','firmado']}];
 const fields={customFieldDefinitions:catalog,Contrato:'firmado',email:'client@example.com'};
 const payload={customFieldDefinitions:catalog,data:{customFieldDefinitions:catalog,privateNote:'keep me'},contact_id:'one'};
 for(const kind of ['leads','csm'])await db.query(`select metricas_${kind}_ghl_ingest('one',$1,$2)`,[payload,fields]);
 const before=(await db.query('select to_jsonb(c) as row from csm_ghl_contacts c')).rows;
 await db.exec(fs.readFileSync('supabase/migrations/20261105180000_share_ghl_field_catalogs.sql','utf8'));
 for(const kind of ['leads','csm'])assert.equal((await db.query(`select compact_ghl_catalog_batch('${kind}_ghl_contacts',10) as n`)).rows[0].n,1);
 assert.deepEqual((await db.query('select to_jsonb(c) as row from csm_ghl_contacts c')).rows,before);
 assert.equal((await db.query('select count(*)::int as n from ghl_field_catalogs')).rows[0].n,1);
 assert.equal((await db.query("select fields ? 'customFieldDefinitions' as stored from csm_ghl_contacts_store")).rows[0].stored,false);
 // Latest payload replacement can omit the catalog; merged fields must retain it.
 await db.query("select metricas_csm_ghl_ingest('one',$1,$2)",[{contact_id:'one'},{Contrato:'pendiente'}]);
 let row=(await db.query('select * from csm_ghl_contacts')).rows[0];assert.deepEqual(row.latest_payload,{contact_id:'one'});assert.deepEqual(row.fields.customFieldDefinitions,catalog);assert.equal(row.fields.Contrato,'pendiente');
 const newer=[...catalog,{id:'field-2',name:'new'}];
 await db.query("select metricas_csm_ghl_ingest('one',$1,$2)",[{customFieldDefinitions:newer},{customFieldDefinitions:newer}]);
 assert.deepEqual((await db.query('select fields from csm_ghl_contacts')).rows[0].fields.customFieldDefinitions,newer);
 assert.deepEqual((await db.query('select fields from leads_ghl_contacts')).rows[0].fields.customFieldDefinitions,catalog);
 assert.equal((await db.query('select count(*)::int as n from ghl_field_catalogs')).rows[0].n,2);
 // Preserve explicit JSON null, typed field wrappers, arrays and nested payload data.
 const wrapped={type:'array',label:'customFieldDefinitions',value:catalog};
 await db.query("select metricas_leads_ghl_ingest('two',$1,$2)",[{data:{customFieldDefinitions:null,privateNote:'unchanged'},customFieldDefinitions:[]},{customFieldDefinitions:wrapped,email:{value:'other@example.com'}}]);
 const second=(await db.query("select fields,latest_payload from leads_ghl_contacts where ghlid='two'")).rows[0];
 assert.deepEqual(second.fields.customFieldDefinitions,wrapped);
 assert.deepEqual(second.latest_payload,{data:{customFieldDefinitions:null,privateNote:'unchanged'},customFieldDefinitions:[]});
 assert.equal((await db.query("select count(*)::int n from ghl_catalog_compaction_audit where before_hash<>after_hash")).rows[0].n,0);
 // If any other trigger alters a value, the batch must fail and roll back.
 await db.exec(`alter table csm_ghl_contacts_store disable trigger aa_share_catalog;
 insert into csm_ghl_contacts_store(ghlid,csm_id,latest_payload,fields,last_event_id) values('rollback','rollback','{}','{"email":"original"}','00000000-0000-0000-0000-000000000001');
 alter table csm_ghl_contacts_store enable trigger aa_share_catalog;
 create function test_tamper() returns trigger language plpgsql as $$begin new.fields:=new.fields||'{"email":"changed"}'::jsonb;return new;end$$;
 create trigger zz_test_tamper before update on csm_ghl_contacts_store for each row execute function test_tamper();`);
 await assert.rejects(db.query("select compact_ghl_catalog_batch('csm_ghl_contacts',10)"),/Compaction changed document/);
 assert.equal((await db.query("select fields->>'email' email from csm_ghl_contacts where ghlid='rollback'")).rows[0].email,'original');
 await db.exec('drop trigger zz_test_tamper on csm_ghl_contacts_store;');
 await db.exec('set role service_role');assert.equal((await db.query('select * from csm_ghl_contacts')).rows.length,2);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from csm_ghl_contacts'),/permission/);
 }finally{await db.close();}
});
