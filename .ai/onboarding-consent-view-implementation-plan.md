# Plan wdrożenia widoku „Onboarding — Zgoda”

## Przegląd
- Widok wymusza zaakceptowanie aktualnej polityki przetwarzania wizerunku przed przejściem do kolejnego kroku onboardingowego (FR-007, US-002).
- Strona działa jako guard – blokuje dostęp do uploadu Persony i pozostałych funkcji, dopóki użytkownik nie zaakceptuje wymaganej wersji zgody.
- Treść zgody jest wersjonowana; widok pobiera najnowszą wersję, prezentuje politykę i zapisuje akceptację poprzez dedykowane API.

## Routing widoku
- Ścieżka: `/onboarding/consent`, zdefiniowana w `src/pages/onboarding/consent.astro`.
- Strona dostępna wyłącznie po uwierzytelnieniu; middleware/guard powinien przekierować niezalogowanych do logowania (Supabase Auth).
- Po pozytywnej akceptacji widok przekierowuje do `/onboarding/persona` lub innego kroku zwróconego przez globalny guard.
- W przypadku wykrycia, że `isCompliant === true`, strona natychmiast deleguje do kolejnego kroku, aby uniknąć ponownej prezentacji.

## Struktura komponentów
- `OnboardingConsentRoute` (Astro)  
  - `OnboardingLayout` (istniejący lub nowy wrapper)  
    - `OnboardingConsentPage` (React)  
      - `ConsentGateModal`  
        - `PolicyContent`  
        - `ConsentFormSection`  
          - `ConsentCheckboxField`  
          - `PrimaryActionBar`  
        - `InlineFeedbackRegion` (aria-live)

## Szczegóły komponentu

### `OnboardingConsentRoute` (`src/pages/onboarding/consent.astro`)
- **Opis**: Routerowa strona Astro odpowiedzialna za wstrzyknięcie layoutu onboardingowego i osadzenie komponentu React. Pobiera metadane SEO (tytuł, canonical).
- **Elementy**: wrapper layoutu, `Suspense` dla klienta, kontener z tłem i blokadą scrolla.
- **Zdarzenia**: brak (statyczny).
- **Walidacja**: brak; logika walidacyjna przekazana do React.
- **Typy**: korzysta z `PageProps` Astro; nie wymaga dodatkowych DTO.
- **Propsy**: przekazuje konfigurację (np. link do polityki) do komponentu React jako `client:load`.

### `OnboardingConsentPage` (`src/components/onboarding/OnboardingConsentPage.tsx`)
- **Opis**: Główny komponent klienta, zarządza pobraniem statusu zgody, obsługą akceptacji i nawigacją do kolejnego kroku.
- **Elementy**: `TanStack Query` (hook `useConsentStatusQuery`), `ConsentGateModal`, logika przekierowania, skeleton loader.
- **Zdarzenia**: mount → fetch GET; `onAccept` → submit POST; `onRetry` → refetch.
- **Walidacja**: sprawdza `isCompliant`, `requiredVersion`, obecność odpowiedzi; przekazuje błędy do modalu.
- **Typy**: używa `ConsentStatusResponseDto`, `ConsentUpsertCommand`, `ConsentUpsertResponseDto`, `ConsentViewModel`.
- **Propsy**: `{ policyUrl: string; nextPath?: string }`.

### `ConsentGateModal` (`src/components/onboarding/ConsentGateModal.tsx`)
- **Opis**: Pełnoekranowy modal z focus trapem, prezentujący treść polityki i formularz akceptacji.
- **Elementy**: nagłówek z wersją, scrollowalna sekcja `PolicyContent`, formularz zgody, pasek akcji, aria-live dla błędów.
- **Zdarzenia**: `onSubmit`, `onCheckboxChange`, `onOpenPolicyLink`.
- **Walidacja**: wymusza zaznaczenie checkboxa; sprawdza `formState.policyAccepted`, `apiError`.
- **Typy**: `ConsentGateProps` z polami `viewModel`, `isSubmitting`, `error`, `onSubmit`.
- **Propsy**: `{ viewModel: ConsentViewModel; isSubmitting: boolean; error: ConsentErrorState | null; onSubmit(): void; onRetry(): void; }`.

### `PolicyContent` (`src/components/onboarding/PolicyContent.tsx`)
- **Opis**: Renderuje treść polityki (markdown lub HTML z CMS) wraz z linkami, zapewniając scroll i oznaczenia dostępności.
- **Elementy**: `article` z nagłówkami, `a` z `target="_blank" rel="noreferrer noopener"`, region informacyjny o Google AI.
- **Zdarzenia**: `onClick` linków (opcjonalne logowanie).
- **Walidacja**: brak walidacji; odpowiada za `aria-labelledby` i `aria-describedby`.
- **Typy**: `PolicyContentProps` (`version: string; content: string; policyUrl: string`).
- **Propsy**: jw.

### `ConsentFormSection` (`src/components/onboarding/ConsentFormSection.tsx`)
- **Opis**: Kontener formularza zawierający checkbox zgody, dodatkowe komunikaty i mapowanie ewentualnych błędów walidacji.
- **Elementy**: `form`, `Checkbox` z Shadcn/ui, etykieta z linkiem, `InlineFeedbackRegion`.
- **Zdarzenia**: `onChange` checkboxa, `onSubmit`, `onKeyDown` (obsługa Enter/Space).
- **Walidacja**: wymaga zaznaczenia checkboxa przed wywołaniem `onSubmit`; w razie braku – ustawia lokalny błąd `consent_required`.
- **Typy**: `ConsentFormProps` (`checked: boolean; onCheckedChange: (value: boolean) => void; disabled: boolean;` itd.).
- **Propsy**: `{ checked: boolean; disabled: boolean; descriptionId: string; error?: string; onCheckedChange(value: boolean): void; onSubmit(): void; }`.

### `PrimaryActionBar` (re-użycie / rozszerzenie `src/components/ui/button.tsx`)
- **Opis**: Stały pasek akcji z głównym przyciskiem „Akceptuję”. Może być istniejący komponent globalny, rozszerzony o stan ładowania.
- **Elementy**: `footer` z `Button`, informacją o wersji, liczbie kroków onboardingowych.
- **Zdarzenia**: `onClick` → delegacja do `onSubmit`.
- **Walidacja**: przycisk `disabled` jeśli checkbox nie jest zaznaczony lub trwa zapytanie.
- **Typy**: `PrimaryActionBarProps` (`ctaLabel: string; disabled: boolean; loading: boolean; onClick(): void; secondaryAction?`).
- **Propsy**: jw.

### `InlineFeedbackRegion`
- **Opis**: Obszar komunikatów o błędach i sukcesach (`aria-live="assertive"`), zmapowany na komunikaty walidacyjne i odpowiedzi API.
- **Elementy**: `div`/`Alert` z ikoną, tekstem i kodem błędu.
- **Zdarzenia**: brak (wyłącznie prezentacja).
- **Walidacja**: renderuje komunikaty dla `consent_required`, `network_error`, `server_error`, `unauthorized`, `version_conflict`.
- **Typy**: `ConsentErrorState`.
- **Propsy**: `{ message: string; tone: 'error' | 'success'; }`.

## Typy
- **Istniejące**: `ConsentStatusResponseDto`, `ConsentUpsertCommand`, `ConsentUpsertResponseDto` (z `src/types.ts`).
- **Nowe typy ViewModel**:
  - `ConsentViewModel`  
    - `requiredVersion: string`  
    - `acceptedVersion?: string | null`  
    - `acceptedAt?: string | null`  
    - `isCompliant: boolean`  
    - `policyContent: string` (renderowana treść)  
    - `policyUrl: string`  
    - `metadata: { updatedAt?: string; source: 'gcp' | 'internal' }`
  - `ConsentErrorState`  
    - `code: 'unauthorized' | 'bad_request' | 'conflict' | 'server_error' | 'network' | 'validation'`  
    - `message: string`  
    - `details?: Record<string, unknown>`
  - `ConsentSubmissionResult`  
    - `acceptedVersion: string`  
    - `acceptedAt: string`  
    - `status: 'created' | 'updated'`
  - `ConsentFormState`  
    - `isCheckboxChecked: boolean`  
    - `showValidationError: boolean`
- **DTO do POST**: używamy `ConsentUpsertCommand` (`{ version: string; accepted: true }`); odpowiedź mapowana na `ConsentSubmissionResult`.

## Zarządzanie stanem
- `TanStack Query` dla `GET /api/profile/consent` (`useQuery`, klucz `['profile','consent']`). Automatycznie refetch po `POST`.
- `useMutation` dla `POST /api/profile/consent`, z `onSuccess` → `invalidateQueries(['profile','consent'])` i `['profile']`.
- Lokalny stan w `ConsentFormState` do przechowywania zaznaczenia checkboxa oraz walidacji UI.
- Hook pomocniczy `useConsentRedirect` ocenia `data.isCompliant` i decyduje o przekierowaniu.
- Focus management: `useEffect` do ustawienia focusu na nagłówku po załadowaniu, `useRef` + `focus-trap` dla modalu.

## Integracja API
- **GET /api/profile/consent**  
  - Request: brak parametrów; wysyłany z `credentials: include` i nagłówkiem `Authorization` (Supabase session).  
  - Odpowiedź: mapowanie na `ConsentViewModel`; w razie `isCompliant === true` – przekierowanie.  
  - Obsługa błędów: `401` → wylogowanie i redirect do `/login`; inne kody → wyświetlenie w `InlineFeedbackRegion`.
- **POST /api/profile/consent**  
  - Body: `ConsentUpsertCommand` (`{ version: requiredVersion, accepted: true }`).  
  - Sukces: `200` lub `201` → aktualizacja stanu, komunikat sukcesu, przekierowanie do `/onboarding/persona`.  
  - Błędy: `400` → inline alert i refetch; `409` → refetch i wymuszenie nowej treści; `500` → toast + link do wsparcia.

## Interakcje użytkownika
- Wejście na stronę → ładowanie statusu, focus na nagłówku.
- Przewijanie treści polityki → sticky CTA pozostaje dostępne.
- Zaznaczenie checkboxa → odblokowanie przycisku „Akceptuję”.
- Kliknięcie linku do polityki → otwarcie w nowej karcie.
- Kliknięcie „Akceptuję” → walidacja checkboxa, wysłanie POST, pokazanie spinnera.
- Błąd API → komunikat w `InlineFeedbackRegion`, fokus na komunikat.
- Sukces → krótkie potwierdzenie (opcjonalnie toast) i automatyczny redirect do kolejnego etapu.

## Warunki i walidacja
- Checkbox zgody musi być zaznaczony przed wysłaniem POST (`consent_required`).
- Przycisk CTA zablokowany, gdy zapytanie w toku lub brak zaznaczenia.
- Weryfikacja zgodności wersji: korzystamy z wartości `requiredVersion`; przesyłamy identyczną w POST.
- W przypadku `isCompliant === true` i `acceptedVersion === requiredVersion` widok nie pokazuje formularza – bezpośrednio przekierowuje.
- W razie `acceptedVersion && acceptedVersion !== requiredVersion` – UI informuje o aktualizacji polityki i wymusza ponowną akceptację.

## Obsługa błędów
- `401 Unauthorized`: komunikat o wymaganym logowaniu, wywołanie `supabase.auth.signOut()` i redirect do `/login`.
- `400 Bad Request`: prezentacja komunikatu „Wersja zgody nieobsługiwana, spróbuj ponownie”; wykonanie `refetch`.
- `409 Conflict`: komunikat o nowej wersji zgody, automatyczne odświeżenie danych i reset stanu formularza.
- `500 Internal Server Error`: czerwony alert z możliwością ponowienia i linkiem do pomocy; logowanie błędu do Sentry (jeśli skonfigurowane).
- Błędy sieci: informacja offline, przycisk „Spróbuj ponownie”.
- Walidacja lokalna (checkbox): `aria-live` + `aria-invalid` na polu; fokus przenoszony na komunikat.

## Kroki implementacji
1. **Routing i skeleton**: utwórz `src/pages/onboarding/consent.astro`, osadź layout onboardingowy i placeholder komponentu React. Dodaj meta tagi, breadcrumb w layoutach (jeśli wymagane).
2. **Konfiguracja danych**: utwórz folder `src/components/onboarding/` i dodaj `useConsentStatusQuery.ts`, `useAcceptConsentMutation.ts` bazując na TanStack Query; zdefiniuj klucze zapytań.
3. **Implementacja `OnboardingConsentPage`**: obsłuż logikę fetchowania, stany ładowania, przekierowania oraz wstrzykiwanie view-modelu do modalu.
4. **Tworzenie `ConsentGateModal`**: zaimplementuj modal z focus trapem, nagłówkiem, sekcją polityki, formularzem i aria-live dla błędów; zadbaj o responsywny layout (Tailwind).
5. **Policy content**: dodaj `PolicyContent` z przyjazną typografią, linkiem do pełnej polityki, identyfikatorami ARIA i testami scrolla.
6. **Formularz zgody**: zbuduj `ConsentFormSection` z checkboxem Shadcn/ui, walidacją, przekazywaniem błędów oraz integracją z `PrimaryActionBar`.
7. **Action bar**: jeśli nie istnieje, utwórz `PrimaryActionBar` lub rozszerz istniejący komponent przycisku o stany `loading/disabled`; zapewnij sticky pozycjonowanie na mobile i desktop.
8. **Obsługa błędów**: zaimplementuj `InlineFeedbackRegion` i mapowanie kodów błędów; podłącz logikę focusu na komunikatach.
9. **Integracja z guardem**: po sukcesie mutacji wykonaj `invalidateQueries(['profile'])`, ustaw toast i wykonaj nawigację (`Astro.redirect` lub klient `navigate`).
10. **Testy i QA**: przygotuj scenariusze E2E (np. Playwright) dla akceptacji zgody, błędów 400/409/401; testy jednostkowe hooków (msw do mockowania API).
11. **Dokumentacja**: zaktualizuj `.ai/prd.md` / `.ai/ui-plan.md` jeśli wymagane, dodaj wpis do `CHANGELOG.md` po wdrożeniu.
