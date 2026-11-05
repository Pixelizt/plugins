-- forms 0.1.0: website enquiries. Ported from the reference project.
-- Holds names, phones and emails, so (rule 12): RLS on, no anonymous policy, no write policy for anyone,
-- only server functions write (service key). admin + editor read (D16). Rows older than
-- modules.forms.retention_days (default 100, D17) are deleted by the daily cron.
create table if not exists public.submissions (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  form text not null,
  page text,
  fields jsonb not null,
  email text,
  ip_hash text,
  delivery jsonb not null default '{}'
);
create index if not exists submissions_created_idx on public.submissions (created_at desc);
create index if not exists submissions_form_idx on public.submissions (form, created_at desc);
create index if not exists submissions_ip_idx on public.submissions (ip_hash, created_at desc);

alter table public.submissions enable row level security;
revoke all on public.submissions from anon;
revoke insert, update, delete, truncate on public.submissions from authenticated;
grant select on public.submissions to authenticated;
revoke all on sequence public.submissions_id_seq from anon, authenticated;

drop policy if exists "staff read submissions" on public.submissions;
create policy "staff read submissions" on public.submissions for select to authenticated
  using (public.kit_role() in ('admin', 'editor'));
