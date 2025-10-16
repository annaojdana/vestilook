# Przegląd
- Widok **Generowanie — Formularz** na `/generations/new` pozwala użytkownikowi wgrać zdjęcie ubrania, odnowić zgodę na przetwarzanie wizerunku oraz uruchomić kolejkę VTON.
- Dane startowe (profil, quota, status zgody) są pobierane przez `GET /api/profile`, aby przed wypełnieniem formularza znać bieżące ograniczenia.
- Formularz blokuje wysyłkę, dopóki nie zostanie spełniona walidacja pliku, brak limitu oraz odnowiona zgoda.
- Po sukcesie `POST /api/vton/generations` odświeża wskaźniki limitu i nawigacja przechodzi do widoku szczegółów generacji (np. `/generations/:id` lub strona statusu, zależnie od istniejącej ścieżki).

# Routing widoku
- Strona Astro pod `/src/pages/generations/new.astro`.
- SSR pobiera `ProfileResponseDto`; przy braku sesji przekierowuje do logowania (zależnie od globalnego guardu).
- Przy odpowiedzi 204 (brak profilu/persony) kieruje do ścieżki onboardingu persony lub prezentuje komunikat o konieczności uzupełnienia profilu i wyłącza formularz.

# Struktura komponentów
- `GenerationNewPage` (Astro)  
  └── `GenerationForm` (React, client:load)  
&nbsp;&nbsp;&nbsp;&nbsp;├── `QuotaIndicator`  
&nbsp;&nbsp;&nbsp;&nbsp;├── `GarmentUploadField`  
&nbsp;&nbsp;&nbsp;&nbsp;├── `ConsentReaffirmation`  
&nbsp;&nbsp;&nbsp;&nbsp;├── `RetentionSelector`  
&nbsp;&nbsp;&nbsp;&nbsp;├── `FormAlerts`  
&nbsp;&nbsp;&nbsp;&nbsp;└── `GeneratePrimaryButton`

# Szczegóły komponentu
## GenerationNewPage
- **Opis**: Komponent Astro odpowiada za SSR danych profilu i hydratację Reacta.
- **Elementy**: `Layout` z sekcją główną, wrapper `ClientOnly`/`<div id="generation-form-root">`.
- **Zdarzenia**: Brak bezpośrednich, przekazuje `profileData` jako props.
- **Walidacja**: Obsługa null-check na `profile` (204) -> fallback UI lub redirect.
- **Typy**: Własny interfejs `GenerationNewPageProps` zawierający `profile: ProfileResponseDto | null`.
- **Propsy**: `profile`, `consentRequired`, `personaMissing`.

## GenerationForm
- **Opis**: Kontener formularza, zarządza stanem i wysyłką.
- **Elementy**: `form`, siatka Tailwind, dzieci określone poniżej.
- **Zdarzenia**: `onSubmit`, `onGarmentChange`, `onConsentToggle`, `onRetentionChange`.
- **Walidacja**: Komponuje błędy dzieci; w `handleSubmit` sprawdza `garment.valid`, `consent.checkboxChecked`, `!quota.hardLimitReached`, `retainForHours` w [24,72].
- **Typy**: `GenerationFormState`, `GenerationFormActions`, `GenerationErrorState`.
- **Propsy**: `initialProfile: ProfileResponseDto`, `onSuccess?(id: string)`, `defaultRetention?: number`.

## GarmentUploadField
- **Opis**: Kontrolka do wyboru pliku i prezentacji walidacji.
- **Elementy**: shadcn `Card`, `Label`, `Input type="file"`, `Button` do resetu, `p` z komunikatami.
- **Zdarzenia**: `onChange(fileList)`, `onClear`.
- **Walidacja**: MIME (`image/jpeg` | `image/png`), rozdzielczość >=1024x1024, opcjonalnie rozmiar <= `env.maxGarmentBytes`.
- **Typy**: `GarmentFileState`, `GarmentValidationError`.
- **Propsy**: `value: GarmentFileState | null`, `onValidated(GarmentFileState | null)`, `constraints: ImageValidationConstraints`.

## ConsentReaffirmation
- **Opis**: Sekcja z checkboxem zgody i przypomnieniem polityki.
- **Elementy**: shadcn `Checkbox`, `Label`, link do polityki, `Alert` gdy wersja niezgodna.
- **Zdarzenia**: `onToggle(checked: boolean)`.
- **Walidacja**: Checkbox musi być zaznaczony; jeśli `!isCompliant`, komponent pokazuje ostrzeżenie i `GenerationForm` wymusi wywołanie `POST /api/profile/consent`.
- **Typy**: `ConsentFormState`.
- **Propsy**: `state: ConsentFormState`, `onChange(Partial<ConsentFormState>)`.

## QuotaIndicator
- **Opis**: Prezentuje stan darmowych generacji, TTL i CTA do upgrade'u (opcjonalnie).
- **Elementy**: shadcn `Badge`/`Alert`, tekst z `remaining/total`, tooltip z `renewsAt`.
- **Zdarzenia**: Brak (opcjonalnie link).
- **Walidacja**: Gdy `hardLimitReached` lub `remaining <= 0`, przekazuje flagę do rodzica.
- **Typy**: `QuotaViewModel`.
- **Propsy**: `quota: QuotaViewModel`.

## RetentionSelector
- **Opis**: Pozwala wybrać retencję 24/48/72 h z objaśnieniem TTL.
- **Elementy**: shadcn `RadioGroup` lub `Select`, opis z przypomnieniem o prywatności.
- **Zdarzenia**: `onChange(value: number)`.
- **Walidacja**: Tylko enumerowane wartości; weryfikowane dodatkowo przy submit.
- **Typy**: `RetentionOption`.
- **Propsy**: `value: number`, `options: RetentionOption[]`, `onChange(number)`.

## FormAlerts
- **Opis**: Zbiorczy komponent prezentujący błędy i komunikaty globalne.
- **Elementy**: shadcn `Alert` (variant error/warning/info).
- **Zdarzenia**: Brak.
- **Walidacja**: Wyświetla według `GenerationErrorState`.
- **Typy**: `GenerationErrorState`.
- **Propsy**: `error: GenerationErrorState | null`.

## GeneratePrimaryButton
- **Opis**: Główny przycisk do wysyłki formularza z loaderem.
- **Elementy**: shadcn `Button` z `Spinner`.
- **Zdarzenia**: `onClick` (delegowane do `form`), `disabled` na podstawie stanu.
- **Walidacja**: Disabled gdy brak pliku, brak zgody, brak quota, błąd walidacji, `submitting`.
- **Typy**: Referencja do flag stanu (`FormAvailability`).
- **Propsy**: `disabled: boolean`, `loading: boolean`, `remainingQuota: number`.

# Typy
- **GenerationFormState**  
  ```ts
  interface GenerationFormState {
    garment: GarmentFileState | null;
    consent: ConsentFormState;
    retainForHours: number;
    quota: QuotaViewModel;
    status: 'idle' | 'validating' | 'submitting' | 'success' | 'error';
    error: GenerationErrorState | null;
  }
  ```
- **GarmentFileState**  
  ```ts
  interface GarmentFileState {
    file: File;
    previewUrl: string;
    width: number;
    height: number;
    validationError?: GarmentValidationError;
  }
  ```
- **GarmentValidationError**: `{ code: GarmentValidationErrorCode; message: string; details?: Record<string, unknown>; }`.
- **ConsentFormState**  
  ```ts
  interface ConsentFormState {
    currentVersion: string;
    acceptedVersion: string | null;
    isCompliant: boolean;
    acceptedAt?: string | null;
    checkboxChecked: boolean;
  }
  ```
- **QuotaViewModel**  
  ```ts
  interface QuotaViewModel {
    remaining: number;
    total: number;
    renewsAt: string | null;
    hardLimitReached: boolean;
  }
  ```
- **RetentionOption**: `{ value: number; label: string; description?: string }`.
- **GenerationErrorState**: `{ code: string; message: string; field?: 'garment' | 'consent' | 'form'; retryAfterSeconds?: number }`.
- **GenerationSubmissionResult**: `{ id: string; quota: { remainingFree: number }; etaSeconds: number; }` (subset `GenerationQueuedResponseDto`).
- Wszystkie typy korzystają z `ProfileResponseDto`, `ImageValidationConstraints`, `GarmentValidationErrorCode`, `GenerationQueuedResponseDto` z `src/types.ts`.

# Zarządzanie stanem
- Logika w `GenerationForm` korzysta z hooków Reacta (`useState`, `useMemo`, `useCallback`) do przechowywania `GenerationFormState`.
- `useEffect` pilnuje zwolnienia `previewUrl` (revokeObjectURL).
- Custom hook `useGarmentValidation(constraints)` asynchronicznie weryfikuje plik (odczyt metadanych, walidacja MIME/rozmiaru/rozmiarów) i zwraca `GarmentFileState`.
- Custom hook `useGenerationSubmission` przyjmuje profile i expose `submitGeneration` oraz `updateConsentIfRequired`. Zapewnia sekwencję: opcjonalnie `POST /api/profile/consent` (gdy `!isCompliant`), następnie `POST /api/vton/generations`, obsługując stany loading i błędy.
- Derived flags (`isSubmitDisabled`, `shouldShowQuotaLock`, `showConsentWarning`) liczone w `useMemo`.

# Integracja API
- **GET /api/profile**: wywołanie SSR w Astro lub `use` w React; oczekuje `ProfileResponseDto`. Obsługa statusów: 200 -> dane, 204 -> redirect/disabled state, 401/403 -> guard, 500 -> komunikat błędu.
- **POST /api/profile/consent**: JSON `{ version: consent.currentVersion, accepted: true }`. Wywoływany tylko gdy `!consent.isCompliant` i checkbox zaznaczony. Po sukcesie aktualizuje `consent.acceptedVersion`, `isCompliant`, `acceptedAt`.
- **POST /api/vton/generations**: multipart `FormData` z `garment`, `consentVersion` (=`consent.currentVersion`), `retainForHours`. Nagłówek `Authorization: Bearer ...` (przez fetch z credentials). Sukces (202) zwraca `GenerationQueuedResponseDto` → aktualizuje quota (`quota.remaining = payload.quota.remainingFree`) i nawigacja do `/generations/${id}`.
- Po błędach 400/409/422 odświeża `GET /api/profile`, by zsynchronizować stan (np. quota lub wersja zgody).

# Interakcje użytkownika
- Wejście na stronę → widok ładuje dane profilu, pokazuje resztę generacji i status zgody.
- Wybór pliku → walidacja natychmiastowa; sukces pokazuje podgląd/parametry, porażka komunikat z kodem i reset przycisku.
- Zaznaczenie checkboxu zgody → aktywuje możliwość wysyłki; gdy wersja zmieniona, informacja o konieczności ponownej zgody i automatyczny call przy submit.
- Wybór retencji → predefiniowane opcje 24/48/72 h, wysłane w żądaniu.
- Kliknięcie „Generuj” → disabled button + spinner, informacja o TTL i czasie oczekiwania; przy sukcesie przekierowanie.
- Przekroczenie limitu → UI pokazuje ostrzeżenie, button nieaktywny.

# Warunki i walidacja
- `garment`: obecność pliku, MIME w `allowedGarmentMimeTypes`, wymiary >= `minGarmentWidth/minGarmentHeight`, rozmiar <= `maxGarmentBytes`.
- `consent`: checkbox zaznaczony; jeżeli `acceptedVersion !== currentVersion`, wymagane `POST /api/profile/consent` (zawrzeć w flow).
- `quota`: `remaining > 0` i `!hardLimitReached` (z `ProfileResponseDto.quota.free` i ewentualnego pola `hardLimitReached` jeśli dostępne w innym DTO).
- `retainForHours`: wartość w zbiorze {24, 48, 72}; domyślnie 48.
- Walidacja wykonana przed wysłaniem oraz aktualizowana po odpowiedzi API (np. quota w 202).

# Obsługa błędów
- Walidacja klienta (kody `missing_file`, `unsupported_mime`, `invalid_dimensions`, `below_min_resolution`, `exceeds_max_size`) mapowana na przyjazne komunikaty.
- Błędy HTTP:
  - 400/422 → pokazanie informacji o błędnych danych (np. brak zgody, niepoprawna retencja). Po 409 (conflict) odświeżenie `GET /api/profile`.
  - 401/403 → przekierowanie do logowania / komunikat o braku dostępu.
  - 404 (np. brak persony) → informacja i link do konfiguracji profilu.
  - 429 → komunikat o limicie, aktualizacja quota, blokada przycisku.
  - 500 → ogólny alert z rekomendacją ponowienia później; logowanie w konsoli (tylko development).
- Obsługa wyjątków sieciowych (fetch rejection) → `FormAlerts` z możliwością ponowienia.

# Kroki implementacji
1. **SSR danych**: Utworzyć stronę Astro `/generations/new.astro`, pobrać `ProfileResponseDto` (fetch do API z cookie), zająć się scenariuszami 204/401/403.
2. **Hooki pomocnicze**: Zaimplementować `useGarmentValidation` (przetwarzanie `File` → `GarmentFileState`) oraz `useGenerationSubmission` (API orchestration).
3. **Stan formularza**: W `GenerationForm` zainicjować `GenerationFormState` na bazie `ProfileResponseDto` (mapowanie na `ConsentFormState`, `QuotaViewModel`, domyślny `retainForHours`).
4. **UI komponentów**: Zbudować `GarmentUploadField`, `ConsentReaffirmation`, `QuotaIndicator`, `RetentionSelector`, `FormAlerts`, `GeneratePrimaryButton` w oparciu o shadcn/ui i Tailwind.
5. **Walidacja**: Podłączyć hook walidacyjny do `GarmentUploadField`, w `GenerationForm` ustawić disabled states i komunikaty.
6. **Integracja API**: W `handleSubmit` zastosować sekwencję: walidacja → opcjonalny `POST /api/profile/consent` → `POST /api/vton/generations` (FormData). Obsłużyć odpowiedzi, aktualizować quota i nawigować.
7. **Obsługa błędów**: Zaimplementować mapowanie kodów błędów na UI w `FormAlerts` oraz reset stanu przy ponownej próbie.
8. **Testy manualne i automatyczne**: Przygotować scenariusze testowe (happy path, walidacja, limit quota, zgoda wymagająca odnowienia, błędy 4xx/5xx). Rozważyć testy jednostkowe hooków (np. walidacji pliku) i integracyjne dla komponentu formularza (React Testing Library).
9. **Dokumentacja**: Zaktualizować `.ai/prd.md` (jeśli wymagane), README i changelog o nowy widok, w razie zmian w konfiguracji dodać notę do `.env.example`.
