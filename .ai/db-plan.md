```markdown
1. **Tabele**
   - `profiles`
     - `user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
     - `persona_path text`
     - `cloth_path text`
     - `cloth_expires_at timestamptz`
     - `free_generation_quota integer NOT NULL DEFAULT 0 CHECK (free_generation_quota >= 0)`
     - `free_generation_used integer NOT NULL DEFAULT 0 CHECK (free_generation_used >= 0)`
     - `quota_renewal_at timestamptz`
     - `consent_version text NOT NULL DEFAULT 'v1'`
     - `consent_accepted_at timestamptz NOT NULL DEFAULT now()`
     - `created_at timestamptz NOT NULL DEFAULT now()`
     - `updated_at timestamptz NOT NULL DEFAULT now()`
     - Constraints:
       - `CHECK (cloth_path IS NULL OR cloth_expires_at IS NOT NULL)` — pilnuje SLA czyszczenia
   - `vton_generations`
     - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
     - `user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE`
     - `persona_path_snapshot text NOT NULL`
     - `cloth_path_snapshot text`
     - `result_path text`
     - `status generation_status NOT NULL DEFAULT 'queued'`
     - `vertex_job_id text`
     - `error_reason text`
     - `user_rating smallint CHECK (user_rating BETWEEN 1 AND 5)`
     - `created_at timestamptz NOT NULL DEFAULT now()`
     - `started_at timestamptz`
     - `completed_at timestamptz`
     - `rated_at timestamptz`
     - `expires_at timestamptz`
     - Constraints:
       - `CHECK (completed_at IS NULL OR completed_at >= created_at)`
       - `CHECK (rated_at IS NULL OR user_rating IS NOT NULL)`
   - `generation_status` (enum)
     - Wartości: `'queued'`, `'processing'`, `'succeeded'`, `'failed'`, `'expired'`
   - Rozszerzenia wymagane:
     - `CREATE EXTENSION IF NOT EXISTS pgcrypto;` — dla `gen_random_uuid()`

2. **Relacje**
   - `auth.users (1)` ↔ `profiles (1)` — relacja jeden-do-jednego (`profiles.user_id` = `auth.users.id`)
   - `profiles (1)` ↔ `vton_generations (N)` — relacja jeden-do-wielu (`vton_generations.user_id` → `profiles.user_id`)

3. **Indeksy**
   - `profiles`
     - `CREATE INDEX profiles_quota_renewal_idx ON profiles (quota_renewal_at);`
   - `vton_generations`
     - `CREATE INDEX vton_generations_user_created_idx ON vton_generations (user_id, created_at DESC);`
     - `CREATE INDEX vton_generations_status_idx ON vton_generations (status) WHERE status IN ('queued', 'processing');`
     - `CREATE INDEX vton_generations_expires_idx ON vton_generations (expires_at);`

4. **Zasady PostgreSQL (RLS)**
   - `profiles`
     - `ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;`
     - Polityka SELECT/UPDATE: `CREATE POLICY profiles_owner_policy ON profiles USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`
     - Polityka INSERT (np. w triggerze rejestracyjnym): `CREATE POLICY profiles_insert_policy ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);`
   - `vton_generations`
     - `ALTER TABLE vton_generations ENABLE ROW LEVEL SECURITY;`
     - Polityka SELECT: `CREATE POLICY vton_generations_select_policy ON vton_generations USING (auth.uid() = user_id);`
     - Polityka INSERT/UPDATE: `CREATE POLICY vton_generations_write_policy ON vton_generations FOR INSERT WITH CHECK (auth.uid() = user_id);` oraz `FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`
     - Polityka DELETE (dla właściciela rekordu): `CREATE POLICY vton_generations_delete_policy ON vton_generations FOR DELETE USING (auth.uid() = user_id);`

5. **Dodatkowe uwagi**
   - Zalecane jest dodanie triggera aktualizującego `profiles.updated_at` przy każdej zmianie (`BEFORE UPDATE SET updated_at = now()`).
   - `cloth_expires_at` wyznacza logikę czyszczenia; harmonogram Supabase powinien usuwać rekord i powiązany plik po upływie TTL, korzystając z tych samych zasad RLS (akcje wykonywane w kontekście użytkownika lub funkcji RPC).
   - Przy każdej generacji zapisywane są momentalne ścieżki Persony i ubrania w `vton_generations`, co ułatwia audyt oraz powiązanie wyników z plikami Storage nawet po aktualizacji `profiles`.
   - Warto przechowywać `result_path` i `expires_at` dla jawnego czyszczenia wygenerowanych obrazów zgodnie z wymaganiem 2–3 dni retencji.
``` 
