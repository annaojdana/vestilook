---
description: 
globs: 
alwaysApply: false
---
## Plan testów Vestilook

### 1. Wprowadzenie i cele testowania
- Zweryfikowanie jakości procesu wirtualnego przymierzania z wykorzystaniem Vertex AI VTON przy pełnym zachowaniu wymogów bezpieczeństwa, prywatności oraz zgodności ze zgodami użytkownika.
- Potwierdzenie poprawności kluczowych przepływów aplikacji: autentykacja, onboarding (zgody i persona), generowanie stylizacji, historia wyników i zarządzanie limitami.
- Walidacja integracji z Supabase (Auth, Postgres, Storage) oraz Google Vertex AI (enqueue jobów, limity).
- Zapewnienie regresji poprzez automatyzację testów i monitorowanie jakości w pipeline CI/CD.

### 2. Zakres testów
- Warstwa frontendowa (Astro 5 + React 19, Tailwind 4, shadcn/ui) – komponenty formularzy, walidacje, routing chroniony middleware.
- Warstwa serwerowa Astro – endpointy `/api/profile`, `/api/vton/generations`, logika multipart, mapowanie statusów Vertex, logger.
- Integracje Supabase: sesje Auth, RLS profili, przechowywanie Persony/Ubrań, limity kwotowe, cache ubrań.
- Integracja Google Vertex AI VTON: konfiguracja środowiska, queueing jobów, obsługa błędów i ETA.
- UX i dostępność: komunikaty, fallbacki, aria, responsywność, stany awaryjne.
- Poza zakresem: płatności, integracje katalogów sklepów, multi-persona (poza MVP).

### 3. Typy testów
- Testy jednostkowe: hooki React (`useGarmentValidation`, `useGenerationSubmission`), serwisy (`vton/config`, `generation.service`, `profile-service`, `multipart`), mapery DTO.
- Testy integracyjne (Vitest + MSW): przepływ API z mockami Supabase/Vertex, walidacja RLS, limity quota, błędy storage.
- Testy kontraktowe API: porównanie odpowiedzi z modelami DTO (`ProfileResponseDto`, `GenerationQueuedResponseDto`) i sprawdzenie statusów HTTP.
- Testy e2e (Playwright): scenariusze użytkownika z mockowanym Vertex na staging, smoke z prawdziwym Vertex w oknach serwisowych.
- Testy wydajnościowe (k6/Artillery): kolejki generacji, upload plików granicznych, zachowanie przy wielokrotnych jobach.
- Testy bezpieczeństwa: weryfikacja RLS, autoryzacji middleware, próby nadużyć (złośliwe pliki, brak zgody, replay tokenów), analiza logów.
- Testy dostępności (axe-core, NVDA/VoiceOver): formularze, CTA, alerty, nawigacja klawiaturą.
- Testy regresyjne: smoke w CI dla PR, pełna regresja przed releasem.

### 4. Scenariusze testowe
- **Autentykacja i middleware**: logowanie, rejestracja, reset hasła, redirecty (gość → login, zalogowany → onboarding/dash), wygaśnięcie tokenu.
- **Zgoda i onboarding**: brak zgody → blokada, akceptacja wersji `v1`, wymuszenie odnowienia po zmianie wersji, obsługa błędów API.
- **Persona upload**: walidacja wymogów pliku (MIME, rozmiar, rozdzielczość), checksum, błędy Storage, retry, brak sieci.
- **Generowanie stylizacji**: end-to-end (upload ubrania → walidacja → zapis snapshotów → enqueue Vertex), kontrola limitów, retencja (24/48/72 h), brak persony, nieaktualna zgoda, brak tokenu, błędy Vertex/Supabase.
- **Historia i dashboard**: statusy jobów, rating, CTA pomocy, brak danych, ochrony przed dostępem innego użytkownika.
- **API `/api/profile`**: 200/204/401/403/500, walidacja danych (quota, consent, cloth cache).
- **Multipart**: limit rozmiaru, wiele plików, złośliwe nazwy, cleanup zasobów tymczasowych.
- **Dzienniki**: logi błędów Vertex i quota bez ujawniania PII, weryfikacja requestId.
- **Dostępność**: poprawne aria-labels, focus management, tryb dark/high contrast.

### 5. Środowisko testowe
- Lokalne: `npm run dev`, Supabase CLI (Docker), Vertex stub (MSW/WireMock), osobne `.env.test`.
- Staging: niezależny projekt Supabase z RLS, środowisko Vertex testowe (oddzielny projekt/bucket, klucze testowe), czyszczenie jobów i assetów.
- Smoke produkcyjne: ograniczone konta testowe, kontrola kosztów Vertex, monitoring logów.
- Dane testowe: seedy SQL (użytkownik aktywny, bez persony, z wykorzystanym limitem), narzędzia generujące tokeny Supabase.

### 6. Narzędzia
- Vitest + React Testing Library + MSW.
- Playwright (CI, trace viewer) do e2e.
- Supabase CLI, k6/Artillery, axe-core, eslint/prettier checks.
- Allure lub Playwright HTML reporter dla raportów.
- Logger interceptors/sonner test utils do asercji logów.

### 7. Harmonogram
- T1: przygotowanie środowisk, unit testy krytycznych serwisów/hooków.
- T2: integracje API, podstawowe e2e (auth, onboarding, generacja sukces).
- T3: e2e scenariusze błędów/limitów, testy dostępności i UX eksploracyjne.
- T4: wydajność, bezpieczeństwo, smoke staging/produkcja, pełna regresja przed MVP.
- Ciągłe: smoke w CI dla każdego PR (unit+integracje), pełny pakiet nocny/przed wdrożeniem.

### 8. Kryteria akceptacji
- Wszystkie testy automatyczne zielone, pokrycie kluczowych modułów ≥80%.
- Brak otwartych defektów krytycznych/wysokich, średnie z planem naprawy.
- Raporty wydajności spełniają SLA (enqueue ≤2 s, ETA zgodne z konfiguracją).
- Potwierdzona zgodność dostępności (WCAG 2.1 AA dla kluczowych widoków).
- Akceptacja PO po demo z rzeczywistym przepływem generacji.

### 9. Role i odpowiedzialności
- QA Lead: owner strategii testów, raporty statusowe, plan regresji.
- QA Automation: implementacja/utrzymanie testów Vitest/Playwright, integracja z CI.
- QA Manual: testy eksploracyjne, dostępność, smoke Vertex produkcyjny.
- Developerzy: TDD, utrzymanie stubów i logiki testów jednostkowych, szybkie fixy.
- DevOps: provisioning Supabase/Vertex, pipeline GitHub Actions, monitoring kosztów.
- PO/UX: zatwierdzenie scenariuszy, feedback UX, weryfikacja komunikatów.

### 10. Raportowanie błędów
- Defekty w Linear/Jira z priorytetem, krokami, środowiskiem, logami (requestId, bez PII), załączniki (screeny/wideo).
- Krytyczne błędy natychmiast na kanale incident (Slack/Teams), eskalacja do DevOps.
- Codzienny triage defektów, SLA: krytyczne ≤24 h, wysokie ≤48 h.
- Po naprawie: retest + dodanie testu regresyjnego do pakietu automatycznego.
- Raport końcowy releasu: pokrycie, status defektów, zidentyfikowane ryzyka i rekomendacje.
