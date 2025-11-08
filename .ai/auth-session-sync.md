# Synchronizacja sesji Supabase (SSR)

- Endpoint `src/pages/api/auth/set-session.ts` przyjmuje zdarzenia `{ event: "SIGNED_IN" | "SIGNED_OUT", session }` i ustawia/usuwa cookies Supabase z wykorzystaniem `createSupabaseServerClient`.
- `LoginForm` po udanym `signInWithPassword` wywołuje ten endpoint (z `credentials: "include"`), dzięki czemu middleware (`src/middleware/index.ts`) widzi użytkownika przy kolejnych requestach.
- Aby utrzymać spójność, wylogowania (`LogoutButton`) powinny także wysyłać `event: "SIGNED_OUT"` do tego endpointu zanim przekierują użytkownika.
