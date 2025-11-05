-- migration: add automatic profile creation trigger for new users
-- purpose: automatically create user profile with default values when auth.users record is created
-- affected objects: public.handle_new_user(), trigger on_auth_user_created
-- notes: based on auth-spec.md section 4.1 - creates profile with consent_version='v0' to force acceptance

-- function to create profile automatically when new user registers
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    user_id,
    consent_version,
    consent_accepted_at,
    free_generation_quota,
    free_generation_used,
    quota_renewal_at
  )
  values (
    new.id,
    'v0', -- default version that forces user to accept current policy (v1)
    now(),
    3, -- default free generation quota
    0, -- no generations used yet
    now() + interval '30 days' -- quota renews after 30 days
  );
  return new;
end;
$$;

-- trigger that fires after user is created in auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- grant execute permission to service_role
grant execute on function public.handle_new_user() to service_role;

-- comment for documentation
comment on function public.handle_new_user() is 'Automatically creates a profile for new users with default quota and consent settings. Consent version v0 forces user to accept current policy (v1) before first use.';
