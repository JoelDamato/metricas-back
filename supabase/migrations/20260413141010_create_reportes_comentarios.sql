create table if not exists public.reportes_comentarios (
  id bigserial primary key,
  fecha_desde date not null,
  fecha_hasta date not null,
  closer text not null,
  recipient_email text,
  comment_text text not null,
  created_by_email text not null,
  created_by_name text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  read_by_email text,
  constraint reportes_comentarios_fecha_check check (fecha_hasta >= fecha_desde),
  constraint reportes_comentarios_closer_check check (length(btrim(closer)) > 0),
  constraint reportes_comentarios_text_check check (length(btrim(comment_text)) > 0)
);

create index if not exists reportes_comentarios_range_idx
  on public.reportes_comentarios (fecha_desde, fecha_hasta, closer, created_at desc);

create index if not exists reportes_comentarios_recipient_idx
  on public.reportes_comentarios (recipient_email, read_at, created_at desc);
