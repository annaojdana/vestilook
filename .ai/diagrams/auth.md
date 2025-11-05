# Diagram Architektury Autentykacji - Vestilook

**Wersja:** 1.0
**Data utworzenia:** 2025-11-05
**Autor:** Claude Code
**Źródła:** PRD, auth-spec.md, analiza codebase

---

## Przegląd

Niniejszy dokument zawiera kompleksowy diagram sekwencyjny przedstawiający przepływy autentykacji w aplikacji Vestilook. Diagram wizualizuje:

- **Rejestrację użytkownika** (bez weryfikacji emaila - zgodnie z PRD)
- **Logowanie użytkownika**
- **Ochronę ścieżek przez Middleware Astro**
- **Wywołania API z weryfikacją Bearer Token**
- **Automatyczne odświeżanie tokenów JWT**
- **Proces resetowania hasła** (dwufazowy)
- **Wylogowanie użytkownika**

## Kluczowe technologie

- **Frontend:** Astro 5 (SSR) + React 19 + TypeScript 5
- **Backend:** Supabase Auth (JWT tokens)
- **Database:** Supabase Postgres + Row Level Security (RLS)
- **Storage:** Supabase Storage (obrazy persony, generacje)
- **Session Management:** JWT (access token: 1h, refresh token: 30 dni)

---

## Analiza Autentykacji

<authentication_analysis>

### 1. Przepływy autentykacji zidentyfikowane

#### 1.1. Rejestracja użytkownika (bez email confirmation)
**KLUCZOWA ZMIANA:** Email confirmation jest **WYŁĄCZONE** zgodnie z PRD (US-001).

- Użytkownik wypełnia formularz rejestracji (email, hasło min. 8 znaków z wielką/małą literą i cyfrą)
- Walidacja kliencka przez React Hook Form + Zod
- Wywołanie `supabaseClient.auth.signUp()`
- Supabase tworzy użytkownika w `auth.users` z `email_confirmed_at = NOW()`
- **Sesja jest aktywna od razu** - użytkownik może korzystać z aplikacji natychmiast
- Trigger bazy danych (`on_auth_user_created`) automatycznie tworzy profil w `profiles`:
  - `consent_version = 'v0'` (nieaktualna, wymusza akceptację polityki)
  - `free_generation_quota = 3`
  - `quota_renewal_at = NOW() + 30 dni`
- Automatyczne przekierowanie na `/onboarding/consent`

#### 1.2. Logowanie użytkownika
- Formularz logowania: email + hasło (min. 6 znaków dla kompatybilności wstecznej)
- Wywołanie `supabaseClient.auth.signInWithPassword()`
- Supabase weryfikuje dane i zwraca JWT tokens (access + refresh)
- Tokeny zapisywane automatycznie w localStorage przez Supabase Client
- Przekierowanie na `redirectTo` (domyślnie `/onboarding/consent`)

#### 1.3. Reset hasła (dwufazowy)

**Faza 1: Żądanie resetu**
- Użytkownik podaje email na `/auth/reset-password`
- Wywołanie `supabaseClient.auth.resetPasswordForEmail(email, {redirectTo})`
- Supabase wysyła email z magic link zawierającym token recovery
- Komunikat sukcesu wyświetlany **zawsze** (nawet dla nieistniejącego emaila - dla bezpieczeństwa)

**Faza 2: Ustawienie nowego hasła**
- Użytkownik klika link w emailu
- Supabase weryfikuje token recovery i tworzy tymczasową sesję
- Automatyczne przekierowanie na `/auth/update-password`
- Użytkownik wpisuje nowe hasło (walidacja: min. 8 znaków, wielka/mała litera, cyfra)
- Wywołanie `supabaseClient.auth.updateUser({password})`
- Przedłużenie sesji, przekierowanie na `/onboarding/consent`

#### 1.4. Wylogowanie
- Przycisk "Wyloguj się" → `supabaseClient.auth.signOut()`
- Usunięcie tokenów z localStorage
- Unieważnienie sesji server-side
- Przekierowanie na `/auth/login`

#### 1.5. Ochrona ścieżek (Middleware)
- Middleware Astro interceptuje wszystkie żądania HTTP
- Wywołanie `supabaseClient.auth.getSession()` (odczyt z cookies)
- Dla chronionych ścieżek bez sesji → redirect na `/auth/login?redirect=<path>`
- Dla zalogowanych użytkowników na ścieżkach `/auth/*` → redirect na `/onboarding/consent`
- Dodanie `user` do `context.locals` dla użycia w komponentach Astro

#### 1.6. Weryfikacja API (Bearer Token)
- Endpointy API (`/api/profile`, `/api/profile/consent`, `/api/profile/persona`) wymagają Bearer token
- Wyodrębnienie tokenu z nagłówka `Authorization: Bearer <token>`
- Wywołanie `supabase.auth.getUser(token)` server-side
- Weryfikacja JWT: podpis, ważność (exp), użytkownik istnieje
- Zwrócenie 401 dla nieprawidłowych tokenów

#### 1.7. Odświeżanie tokenów (automatyczne)
- **Access Token:** wygasa po 1 godzinie
- **Refresh Token:** wygasa po 30 dniach
- Supabase Client automatycznie wykrywa zbliżające się wygaśnięcie (10s przed)
- Wywołanie `POST /auth/v1/token?grant_type=refresh_token` w tle
- Nowy access token zapisywany w localStorage
- Proces transparentny dla użytkownika

#### 1.8. Integracja z systemem consent
- Po rejestracji/logowaniu → redirect na `/onboarding/consent`
- Trigger bazy ustawia `consent_version = 'v0'` (wymusza akceptację aktualnej polityki)
- API endpoints sprawdzają zgodę przed wykonaniem akcji (persona upload, generacje VTON)

### 2. Główni aktorzy i ich interakcje

#### Aktor 1: Przeglądarka (User/Browser)
- Renderuje komponenty React (LoginForm, RegisterForm, etc.)
- Wywołuje metody Supabase Client API
- Przechowuje tokeny JWT w localStorage
- Automatycznie dołącza tokeny do requestów API

#### Aktor 2: Middleware Astro
- Interceptuje wszystkie żądania HTTP
- Sprawdza obecność aktywnej sesji (cookies)
- Przekierowuje niezalogowanych użytkowników z chronionych ścieżek
- Dodaje dane użytkownika do `context.locals` dla SSR

#### Aktor 3: Astro API Endpoints
- Obsługują żądania API (`/api/profile`, `/api/profile/consent`, `/api/profile/persona`)
- Wymagają Bearer token w nagłówku Authorization
- Weryfikują token przez `supabase.auth.getUser(token)`
- Zwracają dane profilu, consent status, persona metadata

#### Aktor 4: Supabase Auth
- Zarządza użytkownikami w tabeli `auth.users`
- Generuje i weryfikuje JWT tokens (HS256 algorithm)
- Obsługuje rejestrację, logowanie, reset hasła
- Automatycznie odświeża tokeny
- Wysyła emaile transakcyjne (reset hasła)

#### Aktor 5: Supabase Database (Postgres + RLS)
- Tabela `profiles`: dane użytkownika (consent, persona, quota)
- Tabela `vton_generations`: historia generacji wizualizacji
- Trigger `on_auth_user_created`: automatyczne tworzenie profilu po rejestracji
- RLS Policies: użytkownicy mogą tylko odczytać/edytować własne dane (`auth.uid() = user_id`)

#### Aktor 6: LocalStorage
- Przechowuje `access_token` i `refresh_token` (zarządzane przez Supabase Client)
- Automatyczne dołączanie tokenów do requestów HTTP
- Synchronizacja między kartami przeglądarki

### 3. Procesy weryfikacji i odświeżania tokenów

#### 3.1. Generowanie tokenów (przy logowaniu/rejestracji)
1. Supabase Auth generuje:
   - **Access Token (JWT):** Zawiera `user_id`, `email`, `role`, `exp` (expires at: NOW + 1h)
   - **Refresh Token:** Długotrwały token (30 dni) do odświeżania access tokena
2. Tokeny zapisywane w localStorage przez Supabase Client
3. Access Token automatycznie dołączany do wszystkich requestów API

#### 3.2. Weryfikacja tokenu przez Middleware
1. Middleware odczytuje sesję z cookies (`sb-access-token`, `sb-refresh-token`)
2. Supabase Client sprawdza ważność access tokena (exp timestamp)
3. **Scenariusz A:** Token ważny → middleware przekazuje żądanie dalej (`next()`)
4. **Scenariusz B:** Token wygasł, refresh token ważny → automatyczne odświeżenie access tokena
5. **Scenariusz C:** Refresh token wygasł → redirect na `/auth/login?redirect=<path>`

#### 3.3. Weryfikacja tokenu przez API Endpoints
1. Endpoint wyodrębnia Bearer token z nagłówka `Authorization: Bearer <token>`
2. Wywołanie `supabase.auth.getUser(token)` server-side
3. Supabase weryfikuje:
   - **Podpis JWT** (HMAC-SHA256 z secret key)
   - **Ważność tokenu** (exp > NOW)
   - **Użytkownik istnieje** w `auth.users`
4. Zwrócenie danych użytkownika lub błędu 401 Unauthorized

#### 3.4. Automatyczne odświeżanie tokenu (Background Process)
1. Supabase Client monitoruje czas wygaśnięcia access tokena w tle
2. **10 sekund przed wygaśnięciem** automatycznie wywołuje:
   ```
   POST /auth/v1/token?grant_type=refresh_token
   Body: { refresh_token: "<refresh_token>" }
   ```
3. Supabase Auth weryfikuje refresh token i generuje nowy access token
4. Nowy token zapisywany w localStorage (zastępuje stary)
5. Wszystkie kolejne requesty używają nowego tokena
6. **Proces jest transparentny** - użytkownik nie zauważa przerwy

#### 3.5. Obsługa wygasłej sesji (Refresh Token Expired)
1. Jeśli refresh token wygasł (po 30 dniach bez aktywności)
2. API endpoint zwraca 401 Unauthorized
3. Frontend wykrywa błąd i wywołuje:
   ```typescript
   await supabaseClient.auth.signOut(); // Usuń lokalne tokeny
   toast.error('Sesja wygasła. Zaloguj się ponownie.');
   window.location.href = '/auth/login?redirect=' + currentPath;
   ```

### 4. Szczegółowy opis kroków (Flow Rejestracji)

1. **Użytkownik:** Wchodzi na `/auth/register`
2. **Przeglądarka:** Renderuje `<RegisterForm />` (React component)
3. **Użytkownik:** Wypełnia email, hasło (min. 8 znaków), potwierdzenie hasła
4. **React Hook Form:** Waliduje dane klienckie (Zod schema):
   - Email: format email (regex)
   - Hasło: min. 8 znaków + wielka litera + mała litera + cyfra
   - Potwierdzenie: identyczne z hasłem
5. **Przeglądarka:** `supabaseClient.auth.signUp({email, password})`
6. **Supabase Auth:**
   - Tworzy użytkownika w `auth.users`
   - Ustawia `email_confirmed_at = NOW()` (email traktowany jako potwierdzony)
   - Generuje JWT: access_token (1h) + refresh_token (30 dni)
7. **Trigger DB:** `on_auth_user_created` tworzy profil w `profiles`:
   ```sql
   INSERT INTO profiles (user_id, consent_version, free_generation_quota)
   VALUES (NEW.id, 'v0', 3);
   ```
8. **Supabase Auth:** Zwraca sesję do przeglądarki
9. **Przeglądarka:** Zapisuje tokeny w localStorage
10. **Przeglądarka:** Toast sukcesu: "Konto utworzone pomyślnie! Witamy w Vestilook."
11. **Przeglądarka:** Redirect na `/onboarding/consent`

</authentication_analysis>

---

## Diagram Sekwencyjny

Poniższy diagram przedstawia kompletny przepływ autentykacji w aplikacji Vestilook, obejmujący:
- Rejestrację (bez email confirmation)
- Logowanie
- Ochronę ścieżek przez middleware
- Wywołania API z weryfikacją Bearer Token
- Automatyczne odświeżanie tokenów
- Reset hasła (dwufazowy)
- Wylogowanie

```mermaid
sequenceDiagram
    autonumber

    participant U as Przeglądarka
    participant MW as Middleware Astro
    participant API as Astro API
    participant SA as Supabase Auth
    participant DB as Supabase DB
    participant LS as LocalStorage

    Note over U,LS: REJESTRACJA (bez email confirmation)

    U->>U: Użytkownik wypełnia formularz rejestracji
    Note over U: Email, hasło (min. 8 znaków),<br/>potwierdzenie hasła

    U->>U: Walidacja kliencka (React Hook Form + Zod)

    U->>SA: signUp(email, password)
    activate SA

    SA->>DB: INSERT INTO auth.users
    Note over SA,DB: email_confirmed_at = NOW()<br/>(email traktowany jako potwierdzony)

    DB->>DB: Trigger: on_auth_user_created
    Note over DB: Automatyczne utworzenie profilu:<br/>consent_version='v0',<br/>free_generation_quota=3

    SA->>SA: Generuj JWT (access + refresh token)

    SA-->>U: Zwróć sesję (tokeny + user data)
    deactivate SA

    U->>LS: Zapisz access_token i refresh_token

    U->>U: Toast sukcesu:<br/>"Konto utworzone pomyślnie!"

    U->>MW: Redirect na /onboarding/consent

    Note over U,LS: LOGOWANIE

    U->>U: Użytkownik wypełnia formularz logowania
    Note over U: Email, hasło (min. 6 znaków)

    U->>U: Walidacja kliencka

    U->>SA: signInWithPassword(email, password)
    activate SA

    SA->>DB: SELECT FROM auth.users WHERE email = ?
    DB-->>SA: Dane użytkownika

    SA->>SA: Weryfikuj hasło (bcrypt)

    alt Hasło poprawne
        SA->>SA: Generuj nowe tokeny JWT
        SA-->>U: Zwróć sesję (tokeny + user data)
        U->>LS: Zapisz tokeny
        U->>U: Toast sukcesu: "Zalogowano pomyślnie"
        U->>MW: Redirect na /onboarding/consent
    else Hasło niepoprawne
        SA-->>U: Błąd 401: Invalid credentials
        deactivate SA
        U->>U: Wyświetl komunikat:<br/>"Nieprawidłowy email lub hasło"
    end

    Note over U,LS: OCHRONA ŚCIEŻEK (Middleware)

    U->>MW: GET /onboarding/consent
    activate MW

    MW->>LS: Odczytaj sesję z cookies/localStorage
    LS-->>MW: access_token, refresh_token

    MW->>SA: getSession()
    activate SA

    SA->>SA: Sprawdź ważność access_token

    alt Token ważny
        SA-->>MW: Sesja aktywna (user data)
        deactivate SA
        MW->>MW: Dodaj user do context.locals
        MW->>U: Renderuj stronę /onboarding/consent
        deactivate MW
    else Token wygasł, ale refresh_token ważny
        SA->>SA: Automatyczne odświeżenie access_token
        SA-->>MW: Nowa sesja (nowy access_token)
        deactivate SA
        MW->>LS: Zapisz nowy access_token
        MW->>MW: Dodaj user do context.locals
        MW->>U: Renderuj stronę
        deactivate MW
    else Brak sesji lub refresh_token wygasł
        SA-->>MW: Błąd: No session
        deactivate SA
        MW->>U: Redirect 302 na<br/>/auth/login?redirect=/onboarding/consent
        deactivate MW
    end

    Note over U,LS: WYWOŁANIE API (Bearer Token)

    U->>LS: Odczytaj access_token
    LS-->>U: access_token

    U->>API: GET /api/profile<br/>Authorization: Bearer {token}
    activate API

    API->>API: Wyodrębnij Bearer token z nagłówka

    API->>SA: getUser(token)
    activate SA

    SA->>SA: Weryfikuj JWT:<br/>- Podpis<br/>- Ważność (exp)<br/>- Użytkownik istnieje

    alt Token ważny
        SA-->>API: User data (id, email, etc.)
        deactivate SA

        API->>DB: SELECT FROM profiles<br/>WHERE user_id = {user.id}
        Note over DB: RLS Policy automatycznie<br/>filtruje dane użytkownika

        DB-->>API: Profile data<br/>(consent, persona, quota)

        API-->>U: 200 OK: ProfileResponseDto
        deactivate API

        U->>U: Wyświetl dane profilu
    else Token nieważny lub wygasły
        SA-->>API: Błąd 401: Invalid token
        deactivate SA

        API-->>U: 401 Unauthorized
        deactivate API

        U->>SA: signOut()
        activate SA
        SA->>LS: Usuń tokeny
        deactivate SA

        U->>U: Toast:<br/>"Sesja wygasła. Zaloguj się ponownie."

        U->>MW: Redirect na<br/>/auth/login?redirect=/current-path
    end

    Note over U,LS: AUTOMATYCZNE ODŚWIEŻANIE TOKENU

    Note over U: Access token wygasa za 10 sekund

    U->>U: Supabase Client wykrywa<br/>zbliżające się wygaśnięcie

    U->>SA: POST /auth/v1/token?grant_type=refresh_token
    activate SA
    Note over U,SA: Body: { refresh_token }

    SA->>SA: Weryfikuj refresh_token

    alt Refresh token ważny
        SA->>SA: Generuj nowy access_token
        SA-->>U: Nowy access_token
        deactivate SA

        U->>LS: Zapisz nowy access_token

        Note over U: Użytkownik kontynuuje pracę<br/>bez przerwy (transparent)
    else Refresh token wygasł
        SA-->>U: Błąd 401: Refresh token expired
        deactivate SA

        U->>SA: signOut()
        activate SA
        SA->>LS: Usuń tokeny
        deactivate SA

        U->>U: Toast: "Sesja wygasła"
        U->>MW: Redirect na /auth/login
    end

    Note over U,LS: RESET HASŁA - FAZA 1

    U->>U: Użytkownik wpisuje email na<br/>/auth/reset-password

    U->>SA: resetPasswordForEmail(email,<br/>{redirectTo: '/auth/update-password'})
    activate SA

    SA->>SA: Wygeneruj token recovery

    SA->>U: Wyślij email z magic link
    Note over SA,U: Link zawiera token recovery:<br/>supabase.co/auth/v1/verify?<br/>token=...&type=recovery

    SA-->>U: Sukces (zawsze, nawet<br/>dla nieistniejącego emaila)
    deactivate SA

    U->>U: Wyświetl komunikat:<br/>"Link wysłany na {email}"

    Note over U,LS: RESET HASŁA - FAZA 2

    U->>SA: Kliknięcie linku w emailu
    activate SA

    SA->>SA: Weryfikuj token recovery

    alt Token ważny
        SA->>SA: Utwórz tymczasową sesję
        SA->>LS: Zapisz tymczasowe tokeny
        SA->>U: Redirect 302 na<br/>/auth/update-password
        deactivate SA

        U->>U: Użytkownik wpisuje nowe hasło

        U->>SA: updateUser({password: newPassword})
        activate SA

        SA->>DB: UPDATE auth.users<br/>SET encrypted_password = hash(newPassword)

        SA->>SA: Przedłuż sesję (nowe tokeny)

        SA-->>U: Sukces + nowa sesja
        deactivate SA

        U->>LS: Zapisz nowe tokeny

        U->>U: Toast: "Hasło zmienione pomyślnie!"

        U->>MW: Redirect na /onboarding/consent
    else Token wygasł lub nieprawidłowy
        SA-->>U: Błąd 401: Token expired/invalid
        deactivate SA

        U->>U: Wyświetl komunikat:<br/>"Link wygasł. Zażądaj nowego linku."
    end

    Note over U,LS: WYLOGOWANIE

    U->>U: Użytkownik klika "Wyloguj się"

    U->>SA: signOut()
    activate SA

    SA->>LS: Usuń access_token i refresh_token

    SA->>DB: Unieważnij sesję server-side

    SA-->>U: Sukces
    deactivate SA

    U->>U: Toast: "Wylogowano pomyślnie"

    U->>MW: Redirect na /auth/login
```

---

## Kluczowe obserwacje

### 1. Rejestracja bez email confirmation
Zgodnie z PRD (US-001), email confirmation jest **WYŁĄCZONE**. Użytkownik może korzystać z aplikacji natychmiast po rejestracji, co przyspiesza onboarding.

**Implikacje:**
- ✅ Szybszy onboarding użytkownika
- ⚠️ Ryzyko spam accounts (wymaga monitoringu)
- ✅ Trigger bazy automatycznie tworzy profil z quota

### 2. Automatyczne odświeżanie tokenów
Supabase Client automatycznie odświeża access token w tle (10s przed wygaśnięciem). Proces jest **transparentny** dla użytkownika.

**Implikacje:**
- ✅ Użytkownik nie musi ponownie logować się co godzinę
- ✅ Brak przerw w pracy (seamless UX)
- ⚠️ Refresh token ważny przez 30 dni - po tym czasie wymaga ponownego logowania

### 3. Row Level Security (RLS)
Wszystkie zapytania do bazy danych są automatycznie filtrowane przez RLS policies (`auth.uid() = user_id`).

**Implikacje:**
- ✅ Silna izolacja danych między użytkownikami
- ✅ Brak możliwości nieuprawnionego dostępu do danych innych użytkowników
- ✅ Uproszczona implementacja backend (brak potrzeby ręcznej weryfikacji user_id)

### 4. Integracja z systemem consent
Po każdej rejestracji/logowaniu użytkownik jest przekierowany na `/onboarding/consent`, gdzie musi zaakceptować politykę przetwarzania wizerunku (wymóg PRD FR-007).

**Implikacje:**
- ✅ Zgodność z RODO i wymaganiami prawno-etycznymi Google AI
- ✅ Trigger bazy ustawia `consent_version = 'v0'` (wymusza akceptację)
- ✅ API endpoints blokują akcje bez aktualnej zgody

---

## Testowanie

### Testy E2E (Playwright)

**Scenariusz 1: Rejestracja → Onboarding → Consent**
```typescript
test('user can register and accept consent', async ({ page }) => {
  await page.goto('/auth/register');
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'SecurePass123');
  await page.fill('input[name="confirmPassword"]', 'SecurePass123');
  await page.click('button:has-text("Zarejestruj się")');

  // Sprawdź automatyczne przekierowanie na consent
  await expect(page).toHaveURL('/onboarding/consent');
  await expect(page.locator('text=polityki zgody')).toBeVisible();
});
```

**Scenariusz 2: Wygaśnięcie sesji → Wylogowanie**
```typescript
test('expired refresh token logs out user', async ({ page }) => {
  // Mock wygasłego refresh tokena
  await page.addInitScript(() => {
    localStorage.setItem('sb-refresh-token', 'expired-token');
  });

  await page.goto('/onboarding/consent');

  // Sprawdź przekierowanie na login
  await expect(page).toHaveURL('/auth/login?redirect=/onboarding/consent');
  await expect(page.locator('text=Sesja wygasła')).toBeVisible();
});
```

---

## Referencje

- **PRD:** `/home/user/vestilook/.ai/prd.md`
- **Auth Spec:** `/home/user/vestilook/.ai/auth-spec.md`
- **Middleware:** `/home/user/vestilook/src/middleware/index.ts`
- **Supabase Client:** `/home/user/vestilook/src/db/supabase.client.ts`
- **Profile Service:** `/home/user/vestilook/src/lib/profile-service.ts`

---

**Koniec dokumentu.**
