-- migration: create profiles and vton_generations tables with rls policies
-- purpose: bootstrap user profile storage and virtual try-on generation history with strong security defaults
-- affected objects: public.profiles, public.vton_generations, public.generation_status, public.set_profiles_updated_at(), related indexes, rls policies
-- notes: requires pgcrypto for gen_random_uuid() and supabase roles anon/authenticated must exist for policy scoping

-- ensure uuid generation is available before relying on gen_random_uuid()
create extension if not exists pgcrypto;

-- enum captures the lifecycle of a generation job with explicit states to prevent invalid status values
create type public.generation_status as enum ('queued', 'processing', 'succeeded', 'failed', 'expired');

-- table stores per-user preferences and quota tracking, tightly coupled to auth.users with cascading cleanup
create table public.profiles (
    user_id uuid primary key references auth.users (id) on delete cascade,
    persona_path text,
    cloth_path text,
    cloth_expires_at timestamptz,
    free_generation_quota integer not null default 0 check (free_generation_quota >= 0),
    free_generation_used integer not null default 0 check (free_generation_used >= 0),
    quota_renewal_at timestamptz,
    consent_version text not null default 'v1',
    consent_accepted_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint profiles_cloth_requires_expiry check (cloth_path is null or cloth_expires_at is not null)
);

-- trigger function keeps updated_at in sync on every modification without relying on application code
create function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

-- trigger wires the automatic timestamp refresh before each update
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

-- supports querying users whose quota window is coming due
create index profiles_quota_renewal_idx on public.profiles (quota_renewal_at);

-- table captures immutable generation attempts for auditing and retention purposes
create table public.vton_generations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles (user_id) on delete cascade,
    persona_path_snapshot text not null,
    cloth_path_snapshot text,
    result_path text,
    status public.generation_status not null default 'queued'::public.generation_status,
    vertex_job_id text,
    error_reason text,
    user_rating smallint check (user_rating between 1 and 5),
    created_at timestamptz not null default now(),
    started_at timestamptz,
    completed_at timestamptz,
    rated_at timestamptz,
    expires_at timestamptz,
    constraint vton_generations_completed_after_created check (completed_at is null or completed_at >= created_at),
    constraint vton_generations_rating_requires_value check (rated_at is null or user_rating is not null)
);

-- accelerates history lookups ordered by newest generation per user
create index vton_generations_user_created_idx on public.vton_generations (user_id, created_at desc);

-- focuses on active work queue monitoring without scanning historical rows
create index vton_generations_status_idx on public.vton_generations (status) where status in ('queued', 'processing');

-- helps scheduled jobs find records pending expiration
create index vton_generations_expires_idx on public.vton_generations (expires_at);

-- rls: protect profile data by default and require explicit policies
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- allow authenticated users to view only their own profile row
create policy profiles_select_authenticated on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

-- deny selects to anonymous clients to keep profile data private
create policy profiles_select_anon on public.profiles
for select
to anon
using (false);

-- permit authenticated inserts where the caller is establishing their own profile
create policy profiles_insert_authenticated on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

-- prevent anonymous inserts to avoid orphaned records
create policy profiles_insert_anon on public.profiles
for insert
to anon
with check (false);

-- allow profile owners to update their own metadata and quotas
create policy profiles_update_authenticated on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- block anonymous updates entirely
create policy profiles_update_anon on public.profiles
for update
to anon
using (false)
with check (false);

-- let users remove their profile if they choose to delete their account
create policy profiles_delete_authenticated on public.profiles
for delete
to authenticated
using (auth.uid() = user_id);

-- explicitly deny anonymous deletions for defense in depth
create policy profiles_delete_anon on public.profiles
for delete
to anon
using (false);

-- rls: isolate generation records per owner while preserving operations for automation
alter table public.vton_generations enable row level security;
alter table public.vton_generations force row level security;

-- authenticated users may view only their own generation history
create policy vton_generations_select_authenticated on public.vton_generations
for select
to authenticated
using (auth.uid() = user_id);

-- anonymous clients cannot read any generation data
create policy vton_generations_select_anon on public.vton_generations
for select
to anon
using (false);

-- authenticated users can enqueue work for themselves by inserting rows
create policy vton_generations_insert_authenticated on public.vton_generations
for insert
to authenticated
with check (auth.uid() = user_id);

-- anonymous callers may not insert generations
create policy vton_generations_insert_anon on public.vton_generations
for insert
to anon
with check (false);

-- allow owners or background jobs running as the user to update their row for status tracking
create policy vton_generations_update_authenticated on public.vton_generations
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- deny updates from anonymous sessions
create policy vton_generations_update_anon on public.vton_generations
for update
to anon
using (false)
with check (false);

-- permit users to delete their own generations, for example when cleaning expired results
create policy vton_generations_delete_authenticated on public.vton_generations
for delete
to authenticated
using (auth.uid() = user_id);

-- block anonymous deletions explicitly
create policy vton_generations_delete_anon on public.vton_generations
for delete
to anon
using (false);
