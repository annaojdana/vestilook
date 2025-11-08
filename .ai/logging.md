# Logowanie klienta

- `src/lib/client-logger.ts` udostępnia `clientLogger`, który korzysta z `createLogger`, ale działa tylko w środowisku deweloperskim (`import.meta.env.DEV`) lub gdy `PUBLIC_ENABLE_CLIENT_LOGS="true"`.
- W trybie produkcyjnym logger jest no-opem, dzięki czemu w konsoli użytkownika nie pojawiają się żadne wpisy.
- Aby tymczasowo włączyć logi klienta na środowisku testowym/beta, ustaw w `.env`:
  ```
  PUBLIC_ENABLE_CLIENT_LOGS=true
  ```
  i zrestartuj `npm run dev`.
- `LoginForm` wykorzystuje logger do debugowania przepływu logowania (statusy Supabase, domena email, docelowy redirect). Dane wrażliwe (pełen email, hasło) nie są logowane.
