# API Endpoint Implementation Plan: POST /api/vton/generations

## 1. Przegląd punktu końcowego
- Kolejkujemy zadanie Google Vertex AI Virtual Try-On dla uwierzytelnionego użytkownika, wykorzystując zapisane dane persony i nowo przesłany plik ubrania.
- Endpoint atomowo aktualizuje darmową pulę generacji, wykonuje snapshot aktualnych zasobów (`persona`, `cloth`) i odkłada zadanie do przetworzenia asynchronicznego.
- Zwracamy `202 Accepted` z informacją o stanie kolejki, identyfikatorze Vertex, przewidywanym ETA oraz zaktualizowanym stanem darmowego limitu.

## 2. Szczegóły żądania
- Metoda HTTP: `POST`
- Struktura URL: `/api/vton/generations`
- Parametry:
  - Wymagane: `garment` (`File`, JPEG/PNG, minimalna rozdzielczość 1024×1024), `consentVersion` (`string`)
  - Opcjonalne: `retainForHours` (`integer`, domyślnie 48, dopuszczalny zakres 24–72)
- Treść żądania: `multipart/form-data` z częścią binarną pliku oraz polami tekstowymi; parser powinien obsługiwać duże pliki w strumieniu.
- Walidacje wejścia:
  - Odrzuć brakujące części, niedozwolone MIME (`image/jpeg`, `image/png`), obrazy poniżej limitu rozdzielczości, brak zgodności `consentVersion` z aktualną polityką.
  - `retainForHours` waliduj na int, fallback 48, blokuj wartości spoza zakresu.
  - Weryfikuj, że profil użytkownika istnieje, ma zaakceptowaną zgodę i osobę (`persona_path`) oraz ewentualnie dostępny `cloth_path` lub aktualizuj cache po wysłaniu pliku do storage.
- DTO i komendy:
  - `GenerationCreateCommand` na wejściu serwisu (zawiera `garment`, `consentVersion`, `retainForHours`).
  - Wewnętrzne modele pomocnicze: `PersonaAssetMetadata`, `ClothCacheDescriptor`, `FreeQuotaSnapshot` z `src/types.ts` dla snapshotów.

## 3. Szczegóły odpowiedzi
- Sukces (`202 Accepted`):
  - Zwracany typ: `GenerationQueuedResponseDto` (`id`, `status`, `vertexJobId`, `etaSeconds`, `quota.remainingFree`, `createdAt`, `personaSnapshotPath`, `clothSnapshotPath`, `expiresAt`).
- Nagłówki:
  - `Content-Type: application/json`
  - Opcjonalnie `Location: /api/vton/generations/{id}` do późniejszego śledzenia statusu.
- Błędy: zgodne z sekcją 6 (400, 401, 403, 404, 409, 422, 429, 500) z ciałem JSON opisującym kod, wiadomość, identyfikator korelacji (dla logowania).

## 4. Przepływ danych
- Astro endpoint (`src/pages/api/vton/generations/index.ts`) pobiera sesję użytkownika przez Supabase client, parsuje form-data (np. z pomocą `busboy`/`undici`).
- Serwis `src/lib/vton/generation.service.ts` przyjmuje `GenerationCreateCommand` i kontekst użytkownika.
- Kroki serwisu:
  - Pobierz rekord profilu (`supabase.from('profiles')`) i sprawdź `consent_version`, dostępność `persona_path`, aktualizuj `cloth_path` jeśli potrzeba (zapis pliku do Supabase Storage / GCS).
  - Waliduj quotas i wykonaj transakcję (np. RPC lub Supabase `pg` client) zwiększając `free_generation_used`, zapisując nowy rekord w `vton_generations` z snapshotami ścieżek i wyliczonym `expires_at` (bazując na `retainForHours`).
  - Wygeneruj zadanie Vertex: wykorzystać adapter `src/lib/vertex/vton.client.ts` i otrzymać `vertex_job_id`, plus ewentualne async pre-checki (w razie błędu rollback transakcji).
  - Zwróć dane do endpointu do serializacji.
- Snapshoty plików: kopia persony i garmentu w storage (folder per user, wersjonowanie), zapis ścieżek w nowym wierszu `vton_generations`.
- ETA obliczany heurystycznie (np. konfiguracja `import.meta.env.VITE_VTON_DEFAULT_ETA_SECONDS`).

## 5. Względy bezpieczeństwa
- Uwzględnij weryfikację uwierzytelnienia poprzez Supabase Auth; brak sesji → 401.
- Wymuś zgodność wersji zgody i obecność persona przed kolejką; brak zgodności → 403.
- Waliduj plik (MIME, rozdzielczość, rozmiar) i rozważ skan AV (np. integracja z Cloud Storage Malware Scan) przed zapisem.
- Zastosuj transakcję/lock (Supabase `rpc` lub `pg` `select ... for update`) dla pól limitów, aby uniknąć wyścigu przy wielu żądaniach.
- Przechowuj poświadczenia Vertex w bezpiecznych zmiennych środowiskowych (`import.meta.env.PRIVATE_*`), nie loguj wrażliwych danych.
- Wymuś polityki RLS dla tabel `profiles`, `vton_generations` (READ/WRITE tylko właściciel).
- Rate limiting: rozważ wykorzystanie middleware (`src/middleware/index.ts`) do ograniczenia liczby żądań.

## 6. Obsługa błędów
- Zmapuj typowe scenariusze:
  - 400: brakujące pole, niepoprawny format pliku, `retainForHours` poza zakresem; komunikat przyjazny użytkownikowi.
  - 401: brak sesji Supabase.
  - 403: `consentVersion` nie zgadza się, persona nie ustawiona, brak wymaganych uprawnień.
  - 404: brak rekordu profilu (np. nowy użytkownik bez profilu).
  - 409: aktywne zadanie w toku (jeśli polityka blokuje równoległe generacje) lub konflikt podczas aktualizacji limitu (retry/backoff).
  - 422: Vertex AI odrzucił obraz po pre-checku jakości.
  - 429: darmowy limit wyczerpany (`remainingFree <= 0`).
  - 500: błąd Vertex, storage, baza; loguj identyfikator korelacji.
- Logowanie:
  - Wykorzystaj `src/lib/logger.ts` (lub utwórz) zapisujący do `console` + wysyłka do Supabase `logs`/`edge` (jeśli istnieje tabela `error_events` – rejestruj `user_id`, `request_id`, `stage` i payload walidacji).
  - Zadbaj o brak wrażliwych danych w logach (łagodzenie wycieku).

## 7. Rozważania dotyczące wydajności
- Strumieniowe przetwarzanie multipart minimalizuje pamięć (avoid `arrayBuffer` na duże pliki).
- Przechowywanie plików w staging bucket z TTL / lifecycle policy, aby uniknąć nadmiernych kosztów.
- Reużywaj połączeń Supabase (singleton client) i Vertex adaptera; ogranicz liczbę zapytań (jedna transakcja obejmuje profil + quota + insert).
- Rozważ kolejkowanie zadań Vertex poprzez job queue (np. Supabase Edge Functions) jeżeli bezpośredni call spowalnia odpowiedź – endpoint może publikować event do kolejki.
- Dodaj mechanizm retry dla połączeń Vertex z eksponowanymi timeoutami.

## 8. Kroki implementacji
1. Przeanalizuj istniejące helpery w `src/lib` i przygotuj logger + util do parsowania multipart (dodaj testy jednostkowe).
2. Utwórz/rozszerz typy w `src/types.ts` (np. wynik walidacji obrazu) oraz konfigurację środowiskową (`.env.example` dla kluczy Vertex, ETA, storage bucket).
3. Zaimplementuj serwis `src/lib/vton/generation.service.ts`:
   - Funkcje: `createGeneration(command, context)` + pomocnicze `validateGarment`, `ensureQuota`.
   - Pokryj testami integracyjnymi (np. Vitest + Supabase client mock).
4. Dodaj adapter Vertex w `src/lib/vertex/vton.client.ts` lub rozszerz istniejący, z metodą `enqueueJob(snapshot)`.
5. Stwórz endpoint Astro `src/pages/api/vton/generations/index.ts`:
   - Autoryzacja (Supabase server client), parsowanie żądania, delegacja do serwisu, mapowanie `GenerationQueuedResponseDto`.
   - Obsługa błędów i mapowanie wyjątków -> kody HTTP.
6. Upewnij się, że transakcja quota działa: dodaj Supabase funkcję SQL (jeśli potrzebna) i migrację w `supabase/migrations`.
7. Zaimplementuj logowanie błędów do loggera / tabeli audytowej, w tym identyfikacje requestów.
8. Dodaj testy e2e (np. Playwright/API) symulujące poprawną ścieżkę i przypadki błędów (brak zgody, quota 0, zły format pliku).
9. Zaktualizuj dokumentację: `.ai/db-plan.md` (jeśli schema się zmienia), `.ai/view-implementation-plan.md`, `README.md`, `CHANGELOG.md`.
10. Zweryfikuj formatowanie (ESLint/Prettier) i przygotuj konwencjonalny commit.

## Status wdrożenia (bieżąca iteracja)
- [x] Kroki 1–5 zostały zrealizowane: powstał logger, parser multipart, rozszerzone typy i konfiguracja środowiska, serwis generacji z walidacją oraz adapter Vertex wraz z endpointem REST `POST /api/vton/generations`.
- [ ] Kroki 6–10 pozostają do wdrożenia: transakcje kwot, logowanie audytowe, testy e2e, finalna dokumentacja i walidacja formatowania.

## Strategia testów
- Testy jednostkowe: `src/lib/logger.test.ts`, `src/lib/multipart.test.ts`, `src/lib/vton/generation.service.test.ts`, `src/lib/vton/config.test.ts`, `src/lib/vertex/vton.client.test.ts`.
- Testy do zaplanowania: 
  - Scenariusze integracyjne dla endpointu API przy użyciu mocked Supabase/Vertex.
  - Testy e2e/API z realnym przepływem (happy-path, brak zgody, quota 0, zły format pliku).
  - Testy regresyjne dla transakcji kwotowych po dodaniu funkcji SQL (krok 6).
