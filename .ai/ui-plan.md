# Architektura UI dla Vestilook
## 1. Przegląd struktury UI
Vestilook prowadzi użytkownika przez trzy spójne domeny: sekwencyjny onboarding (zgoda + Persona), przestrzeń generowania VTON oraz historię wyników, zarządzane przez globalny guard Supabase i TanStack Query jako warstwę danych. App Shell po zalogowaniu natychmiast ocenia kompletność profilu (zgoda, Persona, quota) i kieruje użytkownika do właściwego widoku, zachowując zgodność z kontraktami API. Layout jest responsywny: mobilny tryb kolumnowy z dolną nawigacją i sheetami, oraz desktopowy układ z bocznym panelem i obszarem kontentu; każdy krok zapewnia dostępność klawiaturą, aria-live w komunikatach i kontrolę bezpieczeństwa (walidacja plików, TTL, signed URL-e).

## 2. Lista widoków
**Onboarding — Zgoda** (`/onboarding/consent`)  
Cel: wymuszenie zaakceptowania aktualnej polityki przetwarzania wizerunku przed dalszym onboardingiem (FR-007, US-002).  
Kluczowe informacje: wersja wymaganej zgody, treść polityki, potwierdzenie akceptacji, komunikaty o błędach (`consent_required`).  
Kluczowe komponenty widoku: `ConsentGateModal`, `PolicyContent`, `PrimaryActionBar`.  
Interakcje API: `GET /api/profile/consent`, `POST /api/profile/consent`.  
UX, dostępność i względy bezpieczeństwa: focus trap i aria-live dla walidacji, checkbox z linkiem do polityki otwieranym w nowym oknie, blokada nawigacji i przycisków systemowych do czasu akceptacji.

**Onboarding — Persona** (`/onboarding/persona`)  
Cel: umożliwienie pierwszego uploadu Persony bazowej zgodnie z wymaganiami jakości (FR-003, FR-004, FR-008, US-003).  
Kluczowe informacje: preview obrazu, weryfikacja rozdzielczości i formatu, status uploadu, reguły bezpieczeństwa i TTL dla zasobów.  
Kluczowe komponenty widoku: `PersonaUploader`, `UploadGuidelines`, `ProgressToast`.  
Interakcje API: `PUT /api/profile/persona`, on demand `POST /api/profile/consent` gdy sesja wygasła.  
UX, dostępność i względy bezpieczeństwa: drag-and-drop obsługujący klawiaturę, aria-describedby dla komunikatów o błędach, natychmiastowa walidacja rozmiaru i typu oraz maskowanie metadanych przed wysłaniem.

**Dashboard & Profil** (`/dashboard`)  
Cel: centralny przegląd stanu konta oraz zarządzanie Personą i zgodami (FR-003, FR-007, FR-010, US-004).  
Kluczowe informacje: karty statusu (Zgoda, Persona, Quota), daty aktualizacji, licznik pozostałych generacji, ostatnie generacje i ostrzeżenia TTL.  
Kluczowe komponenty widoku: `StatusCardGrid`, `PersonaCard` z akcjami zmiany/usuń, `QuotaSummary`, `NextStepsBanner`.  
Interakcje API: `GET /api/profile`, `DELETE /api/profile/persona` (po potwierdzeniu), `GET /api/profile/quota`.  
UX, dostępność i względy bezpieczeństwa: sekcja live region dla ostrzeżeń, modale z podwójnym potwierdzeniem przed usunięciem Persony, automatyczna invalidacja cache po mutacjach, przekierowywanie do onboarding w razie niespełnionych wymagań.

**Generowanie — Formularz** (`/generations/new`)  
Cel: zebranie pliku ubrania, ponowienie zgody (jeśli wymagane) i uruchomienie jobu VTON (FR-001, FR-007, FR-008, FR-010, US-005, US-006, US-007).  
Kluczowe informacje: upload garment z walidacją, checkbox zgody z wersją, licznik pozostałych generacji, opcja wyboru okna retencji (24–72 h).  
Kluczowe komponenty widoku: `GarmentUploadField`, `ConsentReaffirmation`, `QuotaIndicator`, `GeneratePrimaryButton`.  
Interakcje API: `GET /api/profile` (prefetch persona/consent/quota), `POST /api/vton/generations`, opcjonalnie `POST /api/profile/consent` dla aktualizacji wersji.  
UX, dostępność i względy bezpieczeństwa: blokada przycisku do czasu spełnienia walidacji, czytelne komunikaty dla błędów 400/422/429, przypomnienie o TTL i prywatności danych przed wysłaniem.

**Generowanie — Panel statusu** (`/generations/:id/status` jako modal/drawer)  
Cel: śledzenie przebiegu jobu Vertex i informowanie o błędach lub sukcesie (US-005).  
Kluczowe informacje: aktualny stan (`queued`, `processing`, `succeeded`, `failed`, `expired`), ETA, logi błędów, CTA przejścia do wyniku lub ponowienia.  
Kluczowe komponenty widoku: `JobStatusPanel`, `ProgressTimeline`, `FailureHelpCTA`.  
Interakcje API: `GET /api/vton/generations/{id}` w pollingu lub realtime, odświeżanie listy `GET /api/vton/generations`.  
UX, dostępność i względy bezpieczeństwa: aria-live=assertive dla zmian statusu, focus management po otwarciu i zamknięciu, jasne mapowanie kodów błędów na teksty i CTA, możliwość kontynuacji pracy w tle (toast po zamknięciu panelu).

**Generowanie — Widok wyniku** (`/generations/:id`)  
Cel: prezentacja wygenerowanego obrazu, pobieranie i rating (FR-002, FR-009, US-008, US-009).  
Kluczowe informacje: duży preview, meta (data generacji, expiresAt, rozdzielczość), rating, historia działań, komunikat o wygasaniu.  
Kluczowe komponenty widoku: `ResultPreview`, `DownloadButton`, `RatingStars`, `ExpiryBanner`.  
Interakcje API: `GET /api/vton/generations/{id}`, `GET /api/vton/generations/{id}/download`, `POST /api/vton/generations/{id}/rating`.  
UX, dostępność i względy bezpieczeństwa: obsługa gestów i klawiatury, podpisy alternatywne obrazu, ostrzeżenie aria-live na 1h przed TTL, automatyczne wygaszanie przycisku pobierania po `410 Gone`.

**Historia generacji** (`/generations/history`)  
Cel: umożliwienie przeglądania, filtrowania i zarządzania wygenerowanymi wynikami (FR-006, US-005, US-008, US-009, US-010).  
Kluczowe informacje: lista wpisów ze statusem, oceną, TTL countdown, filtr statusem i datą, akcje pobierz/otwórz/usuń.  
Kluczowe komponenty widoku: `HistoryList`, `FilterToolbar`, `InlineRating`, `TTLWarningBadge`.  
Interakcje API: `GET /api/vton/generations`, `GET /api/vton/generations/{id}/download`, `POST /api/vton/generations/{id}/rating`, `DELETE /api/vton/generations/{id}`.  
UX, dostępność i względy bezpieczeństwa: semantyczna tabela/lista dostępna z klawiatury, widoczne ostrzeżenia o wygasaniu i statusie `expired`, potwierdzenia przed usunięciem oraz paginacja bez przeładowań.

**Globalny strażnik polityki i sesji** (`/` + route guards)  
Cel: egzekwowanie logowania Supabase, kompletności profilu oraz wymuszonej ponownej zgody przy nowych wersjach (US-001 oraz nierozwiązana kwestia aktualizacji zgody).  
Kluczowe informacje: komunikaty o wymogach (brak zgody, brak Persony, quota exhausted), bannery globalne, countdown do odnowienia limitu.  
Kluczowe komponenty widoku: `AppShell`, `SessionGuard`, `PolicyUpdateModal`, `GlobalToastQueue`.  
Interakcje API: `GET /api/profile`, `GET /api/profile/quota`, `GET /api/profile/consent`, wywołania Supabase Auth.  
UX, dostępność i względy bezpieczeństwa: przekierowanie z zachowaniem celu po spełnieniu wymagań, aria-live dla alertów, odświeżenie tokenu i automatyczne wylogowanie przy błędach 401, bezpieczne przechowywanie stanu w pamięci sesji.

## 3. Mapa podróży użytkownika
1. Użytkownik uwierzytelnia się przez Supabase, App Shell inicjuje `GET /api/profile` i ocenia stan (US-001).  
2. Brak zgodnej polityki powoduje przekierowanie do widoku Onboarding — Zgoda, gdzie użytkownik akceptuje bieżącą wersję (US-002, FR-007).  
3. Po zapisie zgody guard kieruje do Onboarding — Persona; użytkownik wgrywa obraz spełniający wymogi, a widok potwierdza zapis (US-003, FR-003, FR-008).  
4. Dashboard & Profil prezentuje statusy konta, proponuje dalszy krok „Rozpocznij generację” i w razie potrzeby informuje o brakach (Quota, TTL).  
5. W Generowanie — Formularz użytkownik dodaje zdjęcie ubrania, ponownie zaznacza zgodę jeśli wymagana, sprawdza limit i uruchamia job (US-005, US-006, US-007).  
6. Panel statusu monitoruje przebieg zadania; w razie błędu proponuje powrót do formularza z zachowanymi danymi, a przy sukcesie umożliwia przejście do wyniku (FR-001).  
7. Widok wyniku pokazuje obraz, ostrzega o TTL i oferuje pobranie (FR-002, US-008).  
8. Użytkownik opcjonalnie wystawia ocenę w skali 1–5, co aktualizuje rekord generacji (FR-009, US-009).  
9. Historia generacji przechowuje wszystkie próby; użytkownik monitoruje wygasanie (US-010), ponownie pobiera wyniki lub usuwa wpisy, a guard przypomina o odnowieniu limitu na Dashboardzie.

## 4. Układ i struktura nawigacji
- App Shell zawiera top bar z dostępem do profilu, liczników quota i centrum powiadomień oraz boczną (desktop) lub dolną (mobile) nawigację z trzema głównymi zakładkami: Profil, Generowanie, Historia.  
- Onboarding działa jako pełnoekranowy wizard z numeracją kroków i blokadą pomijania, wyświetlany automatycznie przy brakach w profilu; po ukończeniu przekierowuje do Dashboardu.  
- W obszarze Generowania modal statusu osadza się kontekstowo na wierzchu formularza, umożliwiając szybkie przełączanie do Historii lub pozostanie w workspace; linki są również dostępne z głównego menu.  
- Historia i Dashboard udostępniają skróty wzajemne (CTA „Generuj ponownie” i „Zobacz historię”), a guard zapewnia, że bez kompletnej zgody i Persony zakładki Generowanie i Historia zostają wyszarzone.

## 5. Kluczowe komponenty
- `AppShell` – odpowiada za globalny layout, nawigację, integrację z Supabase Auth oraz TanStack Query prefetch.  
- `ConsentGateModal` – wielokrotnego użycia komponent polityki z wersjonowaniem, obsługujący onboarding oraz wymuszone aktualizacje.  
- `PersonaUploader` – dostępny uploader obrazu z walidacją pikseli/MIME, podglądem i akcjami zmiany/usunięcia.  
- `GenerationForm` – formularz przesyłania ubrania z kontrolą zgody, quota i retencji, gotowy do re-użycia w trybach wizard/desktop.  
- `JobStatusPanel` – panel do monitorowania jobów Vertex z timeline, mapowaniem kodów błędów i możliwością działania w tle.  
- `HistorySuite` – zestaw `HistoryList`, `ResultPreview` i `RatingStars` współdzielący logikę TTL, ratingów i pobierania wyników.
