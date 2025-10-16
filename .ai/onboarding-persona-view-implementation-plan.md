**Przegląd**
- Widok `/onboarding/persona` realizuje pierwszy upload Persony Bazowej z natychmiastową walidacją formatów (JPEG/PNG) i rozdzielczości ≥1024×1024, zgodnie z FR-003, FR-004, FR-007 oraz FR-008.
- Strona zapewnia opt-in na przetwarzanie wizerunku (obsługa POST `/api/profile/consent`), prezentuje zasady jakości (TTL, bezpieczeństwo) i pokazuje status uploadu wraz z podglądem.
- W przypadku zakończenia sukcesem aktualizuje stan profilu użytkownika w pamięci i wyświetla wizualne potwierdzenie (US-003).

**Routing widoku**
- Ścieżka: `/onboarding/persona` (Astro page w `src/pages/onboarding/persona.astro`).
- Hydratacja `OnboardingPersonaShell` (React) z parametrem `client:load` dla pełnej dostępności drag&drop i natychmiastowej walidacji.
- Ochrona trasy: middleware sprawdza autoryzację; brak sesji kieruje do logowania.

**Struktura komponentów**
- `OnboardingPersonaShell` (React)  
  - `ConsentStatusBanner`  
  - `PersonaUploader`  
    - `PersonaPreviewCard`  
    - `FileDropzone`  
    - `ValidationSummary`  
  - `UploadGuidelines`  
  - `ActionFooter` (CTA + link do pomocy)  
  - `ProgressToast` (portal)
- Globalne provider’y: `PersonaUploadContext`, `ToastProvider` (opcjonalnie reuse shadcn/ui).

**Szczegóły komponentu**
- `OnboardingPersonaShell`
  - Cel: pobiera snapshot profilu (`ProfileResponseDto`), zarządza stanem widoku oraz orkiestruje wywołania API (consent + upload).
  - Skład: wrapper `<main role="main">`, layout grid/stack, sekcje tytułowe + dzieci.
  - Zdarzenia: `handleRequestConsent`, `handleUploadSuccess`, `handleUploadError`, `handleRetry`.
  - Walidacja: blokuje upload bez zgodnego `consent.isCompliant`; synchronizuje się z `PersonaUploader`.
  - Typy: korzysta z `PersonaViewModel`, `ConsentRequirement`, `UploadConstraints`.
  - Props: `{ profile: ProfileResponseDto | null }` przekazywane z Astro; fallback 204 -> `null`.

- `ConsentStatusBanner`
  - Cel: informuje o stanie zgody i pozwala na ręczne wymuszenie POST `/api/profile/consent`.
  - Skład: `<section role="status">`, tekst + przyciski (`Button` z shadcn/ui).
  - Zdarzenia: `onRequestConsent()`; emisja po kliknięciu CTA.
  - Walidacja: aktywny tylko gdy `!consent.isCompliant`.
  - Typy: `ConsentRequirement`.
  - Props: `{ consent: ConsentRequirement; onConsentResolved: (receipt: ConsentReceipt) => void; loading: boolean }`.

- `PersonaUploader`
  - Cel: umożliwia wybór, walidację i wysłanie pliku Persony; integruje podgląd i komunikaty błędów.
  - Skład: `<section>` z `<header>`, `FileDropzone`, `PersonaPreviewCard`, `ValidationSummary`, kontrolki `Upload`/`Remove`.
  - Zdarzenia: `onSelectFile(file: File)`, `onDrop(files: FileList)`, `onUpload()`, `onRemove()`, `onValidationError(errors)`.
  - Walidacja: sprawdza MIME (`image/jpeg`, `image/png`), rozdzielczość ≥1024, ewentualnie rozmiar ≤ limit (np. 10MB zgodnie z backendem lub `ImageValidationConstraints`); wymusza maskowanie metadanych przed wysyłką (re-encode do Blob).
  - Typy: `PersonaUploadState`, `PersonaValidationError`, `PersonaUploadCommand`.
  - Props: `{ consentReady: boolean; constraints: UploadConstraints; initialPersona?: PersonaAssetMetadata; onUploadRequest: (command: SanitizedPersonaUploadCommand) => Promise<PersonaUploadResponseDto>; onUploadProgress?: (progress: UploadProgress) => void; disabled?: boolean }`.

- `FileDropzone`
  - Cel: dostępny drag&drop i przycisk wyboru pliku.
  - Skład: `<div role="button" tabIndex={0}>`, układ ikon + tekst, ukryty `<input type="file" accept="image/png,image/jpeg">`.
  - Zdarzenia: `onFileAccepted(file)`, `onFileRejected(reason)`, `onKeyboardActivate`.
  - Walidacja: blokuje `DataTransferItem` typu URL (FR-004).
  - Typy: `DropzoneValidationResult`.
  - Props: `{ onFileAccepted: (file: File) => void; onRejected: (errors: PersonaValidationError[]) => void; busy: boolean }`.

- `PersonaPreviewCard`
  - Cel: pokazuje aktualny lub nowo wybrany obraz, status oraz parametry (wymiary, typ).
  - Skład: `<figure>` z `<img aria-describedby>`, overlay status (`Badge`, `Spinner`).
  - Zdarzenia: `onRemove` (opcjonalnie).
  - Walidacja: jeżeli brak obrazu -> placeholder z instrukcją.
  - Typy: `PersonaPreviewModel`.
  - Props: `{ preview: PersonaPreviewModel; onRemove?: () => void; loading: boolean }`.

- `ValidationSummary`
  - Cel: aria-live `polite` komponent wypisujący błędy walidacji powiązane via `aria-describedby`.
  - Skład: `<ul role="alert">` z elementami `<li>`.
  - Zdarzenia: brak.
  - Walidacja: renderuje listę `PersonaValidationError`.
  - Typy: `PersonaValidationError`.
  - Props: `{ errors: PersonaValidationError[] }`.

- `UploadGuidelines`
  - Cel: statyczne zasady jakości, TTL, bezpieczeństwa i maskowania metadanych.
  - Skład: `<aside>` z listą `<ol>` (kroki) + `<dl>` (parametry min. 1024x1024, tylko JPEG/PNG, TTL 72h).
  - Zdarzenia: brak.
  - Walidacja: brak (treść).
  - Typy: brak nowych; korzysta z constant `UPLOAD_GUIDELINES`.
  - Props: `{ constraints: UploadConstraints }`.

- `ActionFooter`
  - Cel: finalne CTA (“Zapisz i kontynuuj”), link do wsparcia.
  - Skład: `<footer>` z przyciskiem `Button`, link `Anchor`.
  - Zdarzenia: `onContinue`.
  - Walidacja: aktywny gdy persona ustawiona.
  - Typy: `PersonaUploadState`.
  - Props: `{ canContinue: boolean; onContinue: () => void }`.

- `ProgressToast`
  - Cel: informuje o postępie i wynikach uploadu (sukces/błąd) z aria-live.
  - Skład: shadcn/ui `Toast` + `Progress`.
  - Zdarzenia: `onDismiss`, `onRetry`.
  - Walidacja: pokazuje w zależności od `ToastPayload`.
  - Typy: `ToastPayload`, `UploadProgress`.
  - Props: `{ toasts: ToastPayload[]; onDismiss: (id: string) => void; onRetry?: (context: RetryContext) => void }`.

- `ConsentDialog` (modal)
  - Cel: zebrać akceptację polityki gdy `403 Forbidden` lub `!isCompliant`.
  - Skład: shadcn/ui `Dialog`, checkbox z potwierdzeniem, link do polityki.
  - Zdarzenia: `onSubmit`, `onCancel`.
  - Walidacja: wymaga zaznaczenia checkbox `accepted`.
  - Typy: `ConsentUpsertCommand`, `ConsentRequirement`.
  - Props: `{ open: boolean; requirement: ConsentRequirement; onAccept: (payload: ConsentUpsertCommand) => Promise<ConsentReceipt>; loading: boolean }`.

**Typy**
- Nowe interfejsy (TypeScript) do umieszczenia w `src/types.ts` lub dedykowanym module:
  - `type UploadConstraints = Pick<ImageValidationConstraints, "minWidth" | "minHeight" | "allowedMimeTypes"> & { maxBytes: number };`
  - `interface PersonaViewModel { persona: PersonaAssetMetadata | null; consent: ConsentRequirement; constraints: UploadConstraints; isUploading: boolean; uploadProgress: UploadProgress | null; errors: PersonaValidationError[]; }`
  - `interface ConsentRequirement { requiredVersion: string; acceptedVersion: string | null; isCompliant: boolean; acceptedAt: string | null; }` (mapa z `ConsentStateSnapshot`).
  - `interface PersonaUploadState { file: File | null; previewUrl: string | null; metadata?: PersonaPreviewMetadata; errors: PersonaValidationError[]; status: "idle" | "validating" | "ready" | "uploading" | "success" | "error"; }`
  - `interface PersonaPreviewMetadata { width: number; height: number; contentType: string; size: number; }`
  - `type PersonaValidationError = { code: "unsupported_format" | "resolution_too_low" | "missing_file" | "file_too_large"; message: string; };`
  - `type UploadProgress = { id: string; value: number; label: string; stage: "preparing" | "uploading" | "processing"; };`
  - `interface ToastPayload { id: string; type: "progress" | "success" | "error"; title: string; description?: string; progress?: UploadProgress; retryContext?: RetryContext; }`
  - `interface RetryContext { file?: File; consentVersion: string; }`
  - `type SanitizedPersonaUploadCommand = PersonaUploadCommand & { persona: File | Blob; checksum: string; };`
  - `interface PersonaPreviewModel { status: "empty" | "ready" | "uploading" | "error"; imageUrl?: string; width?: number; height?: number; contentType?: string; updatedAt?: string; }`
- Reuse istniejących DTO: `ProfileResponseDto`, `PersonaAssetMetadata`, `PersonaUploadResponseDto`, `ConsentReceipt`, `ConsentUpsertCommand`.

**Zarządzanie stanem**
- `usePersonaProfile()` (nowy hook) – tworzy `PersonaViewModel` na podstawie `ProfileResponseDto`; aktualizuje po udanym uploadzie.
- `useConsentRequirement(profile)` – memoizuje `ConsentRequirement`, eksponuje `requestConsent` (POST `/api/profile/consent`), zwraca loading/error.
- `usePersonaUploader(constraints, consent)` – zarządza `PersonaUploadState`, wykonuje walidację (FileReader + `createImageBitmap`), re-enkoduje obraz, oblicza checksum (np. `crypto.subtle.digest("SHA-256", arrayBuffer)`), publikuje `UploadProgress`, wywołuje PUT `/api/profile/persona`.
- `useToastQueue()` – integracja z shadcn `ToastProvider` do zarządzania `ToastPayload`.
- Stany globalne w komponencie shell: `viewModel`, `pendingConsent`, `activeToast`, `retryContext`.

**Integracja API**
- GET `/api/profile` (już istnieje) – wykonywane w Astro `getStaticPaths`/`get` (SSR) lub przez `fetch` w React `useEffect` jeśli brak prefetch; mapuje wynik na `PersonaViewModel`. Obsłużyć 204 (brak profilu) -> `persona = null`.
- PUT `/api/profile/persona` – wywołanie w `usePersonaUploader`. Request: multipart/form-data (`persona` plik + opcjonalnie `contentType`); dodać nagłówek `Authorization: Bearer <token>` (z Supabase session). Response: `PersonaUploadResponseDto`; status 200/201. Na sukces: aktualizacja `PersonaAssetMetadata`, reset błędów, toast `success`. Obsłużyć 403 -> trigger `ConsentDialog`.
- POST `/api/profile/consent` – wywołanie gdy `!consent.isCompliant` lub przy błędzie 403. Body JSON { version, accepted: true }. Po sukcesie -> odświeżenie `consent` w modelu, ponowna próba uploadu (jeśli `retryContext`).
- Obsługa sesji: użyć Supabase `auth.getSession()` w przeglądarce, przekazywać tokeny w fetch. W Astro SSR – wstrzyknąć token via cookies (Astro middleware).

**Interakcje użytkownika**
- Wybór pliku przez kliknięcie/Enter/Space => otwiera okno wyboru; po wyborze walidacja, generacja podglądu.
- Przeciągnięcie pliku => dropzone akceptuje; odrzuca inne typy (pokazuje `ValidationSummary`).
- Naciśnięcie przycisku „Prześlij Personę” => start uploadu, toast z postępem, disable input. 
- Kliknięcie „Usuń” => reset stanu i lokalnego podglądu (bez API).
- Wypełnienie zgody w modalu => zapis poprzez POST `/api/profile/consent`, po czym upload wznawia się.
- Kontynuacja („Przejdź dalej”) => nawigacja do kolejnego kroku onboarding (np. `/onboarding/garment`), tylko gdy `persona` istnieje.

**Warunki i walidacja**
- Format: `file.type` ∈ `constraints.allowedMimeTypes`; fallback sniff poprzez `file.slice(0, 4)` -> sprawdzenie magic numbers (PNG/JPEG).
- Rozdzielczość: `createImageBitmap` lub `<img>` do odczytu `naturalWidth/Height`; wymagane ≥1024 dla obu wymiarów.
- Rozmiar: `file.size ≤ constraints.maxBytes` (np. 15 MiB – dopasować do backendu).
- Maskowanie metadanych: canvas re-encode (`canvas.toBlob`) przed uploadem; nowy blob zastępuje oryginał.
- TTL / bezpieczeństwo: w `UploadGuidelines` komunikat o auto-usunięciu generacji po 72h, zakaz udostępniania wizerunku.
- Walidacja zgody: `consent.isCompliant === true` przed `onUpload`; inaczej otwiera `ConsentDialog`.
- Walidacja stanu: przy `status === "uploading"` wszystkie interakcje plikowe disabled.

**Obsługa błędów**
- Walidacja klienta: lista błędów z kodami -> `ValidationSummary` (aria-live). 
- HTTP 400/413: mapowane na `PersonaValidationError` (`invalid_media`, `file_too_large`) i pokazane inline oraz toast „Spróbuj z innym plikiem”.
- HTTP 401: przekierowanie do logowania (hook Supabase, `signOut` + redirect).
- HTTP 403 (consent): otwiera `ConsentDialog`, zachowuje `RetryContext`.
- HTTP 409: pokazuje toast z instrukcją odświeżenia (np. „Plik zmieniony równolegle, odśwież widok”).
- HTTP 500 / network: toast błędu + opcja „Spróbuj ponownie”.
- Niepowodzenia re-encode/checksum: fallback do surowego pliku + ostrzeżenie w konsoli, UI informuje o możliwości degradacji jakości.

**Kroki implementacji**
1. Utworzyć trasę `src/pages/onboarding/persona.astro`, pobrać `ProfileResponseDto` SSR (lub przekazać `null`), wstrzyknąć token Supabase przez `Astro.cookies`.
2. Dodać nowe typy do `src/types.ts` (lub modułu `src/types/onboarding.ts`) oraz stałe `UPLOAD_CONSTRAINTS`.
3. Zaimplementować hooki `usePersonaProfile`, `useConsentRequirement`, `usePersonaUploader`, `useToastQueue`.
4. Zbudować komponent `OnboardingPersonaShell` jako główny wrapper; przekazać dane z Astro poprzez props w hydracji.
5. Zaimplementować `ConsentStatusBanner` + `ConsentDialog` z shadcn/ui; połącz z `useConsentRequirement`.
6. Zaimplementować `PersonaUploader` i dzieci (`FileDropzone`, `PersonaPreviewCard`, `ValidationSummary`), zapewniając dostępność (rola, aria-describedby, focus ring).
7. W `usePersonaUploader` obsłużyć walidację pliku, re-encode, generowanie checksum (Web Crypto), wysyłkę `multipart` do PUT `/api/profile/persona`, aktualizację stanu i toasts.
8. Dodać `UploadGuidelines` z copy zgodnym z FR-008, FR-006 oraz maskowaniem metadanych.
9. Podłączyć `ProgressToast` do globalnego `ToastProvider` (reusing shadcn/ui) i emitować z hooków; zapewnić aria-live.
10. Dodać obsługę błędów i retry (403 -> modal; 5xx -> powiadomienie).
11. Napisać testy jednostkowe dla hooków (np. z Vitest + jsdom) sprawdzające walidację i obsługę błędów; story w Storybook/Playground (jeśli dostępny) dla weryfikacji UI i dostępności.
12. Zaktualizować dokumentację: `.ai/ui-shadcn-helper.md` (nowe komponenty), `.ai/prd.md` jeśli trzeba, oraz changelog/README jeśli widok wpływa na funkcje użytkownika.
