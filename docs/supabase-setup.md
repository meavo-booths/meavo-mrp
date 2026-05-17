# Supabase Setup (one-time)

After creating your Supabase project (Frankfurt region, Free tier — see
[`accounts-checklist.md`](./accounts-checklist.md)), run the SQL below in
**SQL Editor** to:

1. Sync `public.users` rows when new auth users sign in (so we have a row
   with our `role` per user).
2. Create Storage buckets `originals` and `thumbnails` with the right
   row-level-security policies.

> Run each section once. Re-running the trigger DDL is idempotent if you use
> `OR REPLACE`.

---

## 1. Mirror auth.users → public.users

```sql
-- Enable required extensions (usually pre-enabled)
create extension if not exists pgcrypto;

-- A trigger that creates a row in public.users on every new auth.users insert.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url',
             new.raw_user_meta_data->>'picture'),
    'scanner'
  )
  on conflict (id) do update
  set email     = excluded.email,
      full_name = coalesce(excluded.full_name, public.users.full_name),
      avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Also keep emails in sync if a user updates their email later.
create or replace function public.handle_auth_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set email = new.email,
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_auth_user_update();
```

## 2. Storage buckets — create + RLS

In the dashboard, **Storage → New bucket**:

| Bucket name | Public | Notes |
| --- | --- | --- |
| `originals` | **Private** | Source images / PDFs |
| `thumbnails` | **Private** | Compressed previews |

Then, in **SQL Editor**, paste the following to enforce per-user access:

```sql
-- Each user can read/write only objects under a `<their-uid>/...` prefix.
-- This works because we name files like `{user_id}/{document_id}/...`.

-- 1) authenticated users can upload to their prefix
create policy "users can upload to their own prefix (originals)"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'originals'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can upload to their own prefix (thumbnails)"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'thumbnails'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2) authenticated users can read their own objects (originals + thumbnails)
create policy "users can read their own (originals)"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'originals'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can read their own (thumbnails)"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'thumbnails'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3) admins (role='admin' in public.users) can read all objects.
create policy "admins can read all (originals)"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'originals'
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );
```

## 3. Database row-level security (recommended later)

For the pilot we are running with the service-role key from server routes
(no RLS bypass concerns), but we should enable RLS on every public table
before opening the app to non-admins. A starting policy set:

```sql
alter table public.users           enable row level security;
alter table public.suppliers       enable row level security;
alter table public.documents       enable row level security;
alter table public.line_items      enable row level security;
alter table public.correction_logs enable row level security;
alter table public.supplier_extraction_profiles enable row level security;
alter table public.sync_attempts   enable row level security;

-- Each user sees the documents they created; admins see everything.
create policy "documents owner read"
  on public.documents for select
  to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from public.users u
                where u.id = auth.uid() and u.role in ('admin','reviewer'))
  );

create policy "documents owner write"
  on public.documents for insert
  to authenticated
  with check (created_by = auth.uid());

-- Repeat similar policies for line_items / correction_logs as needed.
```

## 4. Apply migrations

Once the buckets and triggers are in place, run from your local machine:

```bash
pnpm db:push      # for development (idempotent against current schema)
# or
pnpm db:migrate   # for production deploys
```
