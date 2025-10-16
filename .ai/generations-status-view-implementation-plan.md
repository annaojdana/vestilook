# Przegląd
- Modalny/drawerowy widok `/generations/:id/status` śledzi przebieg jobu Vertex VTON i aktualizuje użytkownika o stanie, czasach oraz wymaganych akcjach.
- Panel działa zarówno jako nakładka po kliknięciu „Generuj”, jak i jako ponownie otwierany status z listy generacji, z zachowaniem dostępności (`aria-live`, zarządzanie fokusem).
- Po zakończeniu zadania kieruje do wyniku, udostępnia CTA do pobrania, oceny lub ponowienia generacji, a przy błędach prezentuje jasne instrukcje naprawy.

# Routing widoku
- Ręczna trasa Astro/React: `/generations/[id]/status` renderowana jako modal/drawer nad kontekstem listy; fallback do pełnej strony przy bezpośrednim wejściu.
- Wywołanie panelu z innych widoków poprzez `router.navigate('/generations/${id}/status')` lub otwarcie lokalnego stanu i synchronizacja z URL (np. `useSearchParams` z `status=open`).
- Zamknięcie panelu usuwa parametr trasy i przywraca fokus do elementu wywołującego; dodatkowo emituje toast z ostatnim statusem.

# Struktura komponentów
```
JobStatusPanel (Dialog/Sheet)
 ├─ JobStatusHeader
 │   ├─ StatusBadge
 │   ├─ EtaCountdown
 │   └─ CloseButton
 ├─ StatusActionBar
 │   ├─ PrimaryCTA (View Result / Retry)
 │   └─ SecondaryCTA (Download / Keep Working)
 ├─ ProgressTimeline
 ├─ StatusMetadataSection
 │   ├─ AssetPreview persona
 │   └─ AssetPreview garment
 ├─ ErrorAlert (conditional)
 │   └─ FailureHelpCTA
 └─ JobStatusFooter
     ├─ InfoChips (expiresAt, quota remaining)
     └─ DismissButton
```

# Szczegóły komponentu
## JobStatusPanel
- **Opis:** Kontener modalu/drawera bazujący na `Dialog` lub `Sheet` z shadcn/ui; zarządza otwarciem, fokusem, `aria-live` oraz przekazywaniem view modelu do sekcji potomnych.
- **Elementy:** `Dialog`, `DialogContent`, `DialogHeader`, `DialogFooter`, `ScrollArea` dla treści, `VisuallyHidden` region z `aria-live`.
- **Zdarzenia:** `onOpenChange`, `onClose`, `onStatusSettled`, `onToastRequest`.
- **Walidacje:** Odmowa renderowania bez `generationId`; przerwanie pollingu gdy status ∈ {`succeeded`, `failed`, `expired`}; potwierdzenie dostępności `resultUrl` przed aktywacją CTA.
- **Typy:** przyjmuje `GenerationStatusViewModel`, `GenerationStatusPanelCallbacks`.
- **Props:** `{ open: boolean; generationId: string; initialData?: GenerationQueuedResponseDto; onClose(): void; onNavigateToResult(id: string): void; onRetry?(id: string): void; onStatusChange?(vm: GenerationStatusViewModel): void; }`.

## JobStatusHeader
- **Opis:** Nagłówek z nazwą zadania, odznaką statusu, informacją głosową (`aria-live="assertive"`) i przewidywanym czasem.
- **Elementy:** `DialogTitle`, `Badge`, `Tooltip`, `EtaCountdown`, `Icon`.
- **Zdarzenia:** Brak zewnętrznych; reaguje na zmiany statusu (trigger `announceStatus`).
- **Walidacje:** Status musi mapować się na znaną etykietę; `etaTarget` > bieżący czas przy statusach aktywnych.
- **Typy:** Wykorzystuje `StatusHeaderViewModel`.
- **Props:** `{ status: GenerationStatusViewModel["status"]; statusLabel: string; announcedText: string; eta?: EtaCountdownViewModel; onAnnounce?(text: string): void; }`.

## StatusActionBar
- **Opis:** Sekcja CTA z głównymi i dodatkowymi przyciskami na podstawie dostępnych akcji (np. „Zobacz wynik”, „Spróbuj ponownie”).
- **Elementy:** `Button`, `DropdownMenu` dla dodatkowych opcji, `Tooltip`.
- **Zdarzenia:** `onPrimaryAction`, `onRetry`, `onDownload`, `onKeepWorking`.
- **Walidacje:** Kontroluje aktywność przycisków w zależności od `canViewResult`, `canRetry`, `canDownload`, `canKeepWorking`.
- **Typy:** `StatusActionPermissions`, `StatusActionIntent`.
- **Props:** `{ actions: StatusActionPermissions; onAction(intent: StatusActionIntent): void; busy?: boolean; }`.

## ProgressTimeline
- **Opis:** Liniowy wykres postępu dla kroków `queued → processing → succeeded|failed|expired`, z etykietami czasowymi i opisami.
- **Elementy:** `Stepper` custom (Flex + `aria-current`), `Tooltip`, `Time` tag, `Icon`.
- **Zdarzenia:** Brak interaktywnych (czysto prezentacyjny).
- **Walidacje:** Każdy krok posiada `timestamp` lub dedykowany opis; status końcowy tylko jeden aktywny.
- **Typy:** `ProgressTimelineProps` wykorzystuje `ProgressItem[]`.
- **Props:** `{ steps: ProgressItem[]; currentKey: ProgressItem["key"]; }`.

## StatusMetadataSection
- **Opis:** Blok informacyjny z miniaturami Persony/Ubrania, szczegółami czasu (`createdAt`, `startedAt`, `completedAt`, `expiresAt`) i identyfikatorami.
- **Elementy:** `Card`, `CardContent`, `DefinitionList (dl)`, `Skeleton` przy ładowaniu, `Image` (via `<img>` z signed URL), `CopyButton`.
- **Zdarzenia:** `onOpenPersona`, `onOpenGarment` (np. otwarcie pełnego podglądu), `onCopyVertexJobId`.
- **Walidacje:** Zweryfikować dostępność `personaPreviewUrl` i `garmentPreviewUrl`; w razie braku wyświetlić placeholder/komunikat.
- **Typy:** `StatusMetadataViewModel`.
- **Props:** `{ metadata: StatusMetadataViewModel; loading?: boolean; }`.

## FailureHelpCTA
- **Opis:** Dedykowany komponent pomocy dla stanów `failed` lub `errorReason` ≠ null, mapuje kod błędu na czytelny komunikat i CTA.
- **Elementy:** `Alert`, `AlertTitle`, `AlertDescription`, `Button` (Retry/Support), `Accordion` dla logów.
- **Zdarzenia:** `onRetry`, `onContactSupport`, `onViewLogs`, `onUploadAgain`.
- **Walidacje:** Wymaga `failure` z `code`; fallback tekst przy nieznanych kodach; logi opcjonalne.
- **Typy:** `FailureContext`, `FailureHelpCTAProps`.
- **Props:** `{ failure: FailureContext; onAction(intent: FailureActionIntent): void; }`.

## EtaCountdown
- **Opis:** Wizualizacja pozostałego czasu (`mm:ss`) oparta na `etaSeconds` lub docelowym czasie; ukrywana po statusach końcowych.
- **Elementy:** `Countdown` (custom hook + `Text`), `Progress` (opcjonalnie), `VisuallyHidden` dla dostępności.
- **Zdarzenia:** wewnętrzny timer `setInterval`, emituje `onElapsed`.
- **Walidacje:** Aktywna tylko gdy `remainingSeconds > 0` i status ∈ {`queued`, `processing`}.
- **Typy:** `EtaCountdownViewModel`.
- **Props:** `{ targetTime: Date; initialSeconds: number; state: "active" | "settled"; onElapsed?(): void; }`.

# Typy
- **`GenerationStatusViewModel`**  
  `{ id: string; status: GenerationStatus; statusLabel: string; statusDescription: string; personaPreviewUrl?: string; garmentPreviewUrl?: string; resultUrl?: string; vertexJobId?: string | null; errorCode?: string | null; errorMessage?: string | null; etaSeconds?: number | null; etaTarget?: string | null; createdAt: string; startedAt?: string | null; completedAt?: string | null; expiresAt?: string | null; timeline: ProgressItem[]; actions: StatusActionPermissions; quotaRemaining?: number | null; }`.
- **`ProgressItem`**  
  `{ key: "queued" | "processing" | "succeeded" | "failed" | "expired"; label: string; description?: string; timestamp?: string; isCurrent: boolean; isCompleted: boolean; tone: "info" | "success" | "warning" | "error"; }`.
- **`StatusActionPermissions`**  
  `{ canViewResult: boolean; canDownload: boolean; canRetry: boolean; canRate: boolean; canKeepWorking: boolean; disabledReason?: string; }`.
- **`StatusActionIntent`**  
  Literal union: `"view-result" | "retry" | "download" | "rate" | "keep-working" | "close"`.
- **`FailureContext`**  
  `{ code: string; title: string; description: string; hint?: string; logExcerpt?: string; actions: FailureActionIntent[]; supportUrl?: string; }`.
- **`FailureActionIntent`**  
  `"retry" | "contact-support" | "view-logs" | "reupload-garment"`.
- **`StatusMetadataViewModel`**  
  `{ personaPath?: string; garmentPath?: string; personaPreviewUrl?: string; garmentPreviewUrl?: string; vertexJobId?: string | null; generationId: string; createdAt: string; startedAt?: string | null; completedAt?: string | null; expiresAt?: string | null; quotaRemaining?: number | null; }`.
- **`EtaCountdownViewModel`**  
  `{ targetTime: string; initialSeconds: number; formattedRemaining: string; isExpired: boolean; }`.
- **DTO reuse:** opieramy się na `GenerationDetailResponseDto`, `GenerationQueuedResponseDto`, `GenerationListResponseDto`. Należy zdefiniować funkcje mapujące te DTO do ViewModeli w `src/lib/vton/status.mapper.ts`.

# Zarządzanie stanem
- Hook `useGenerationStatus(generationId: string, options?: { intervalMs?: number; initialData?: GenerationQueuedResponseDto; })` wykorzystuje `fetch` + `AbortController`, zarządza pollingiem (3s, z backoffem po błędzie), zatrzymuje się po stanach finalnych i udostępnia `data`, `error`, `refresh`, `isLoading`, `isFinal`.
- Hook `useEtaCountdown(etaTarget?: string)` aktualizuje pozostały czas co sekundę; wstrzymuje się gdy `status` osiągnie stan końcowy lub `etaTarget` minie.
- Hook `useGenerationListRefresh` publikuje event (np. przez context `GenerationEventsContext`) po zakończeniu, by odświeżyć listę generacji (`GET /api/vton/generations`).
- Hook `useStatusAnnouncements` obsługuje `aria-live` teksty i przenoszenie fokusa po sukcesie/niepowodzeniu.
- Lokalny stan panelu: `isOpen`, `currentVm`, `pendingAction`, `toastRequest`.

# Integracja API
- **GET `/api/vton/generations/{id}`**
  - *Request:* `fetch` z `credentials: 'include'`, nagłówki `Accept: application/json`.
  - *Response:* 200 z `GenerationDetailResponseDto`; 401/403 -> redirect/login; 404 -> zamknij panel z komunikatem; 410 -> oznacz jako `expired`; 500 -> `FailureHelpCTA`.
  - *Polling:* 0s (initial), +3s, +3s; po `processing` > 2 min skrócić do 1s; zakończyć gdy status finalny.
- **GET `/api/vton/generations`**
  - *Użycie:* Po finalnym statusie lub kliknięciu retry; `revalidate()` listy (np. `mutate` w SWR lub dedykowany context).
- **POST `/api/vton/generations` (retry)**  
  - *Użycie:* W `onRetry` – ponownie wysłać formularz (z zachowaniem zgody i pliku). Panel może otworzyć nowy status w tym samym modalu.
- **Supabase Storage signed URLs**  
  - W helperze `getSignedUrl(bucket, path)` (client-side Supabase) do generowania podglądów; caching z TTL 60s; błąd => placeholder.
- **Toasty/Logi**  
  - Logi błędów: planowana integracja z `/api/vton/generations/{id}/status` (kiedy powstanie) – przewidzieć placeholder i fallback do `FailureHelpCTA` bez logów.

# Interakcje użytkownika
- Otwarcie panelu: fokus trafia na tytuł, `aria-live` ogłasza status początkowy; `Escape` zamyka tylko, gdy status finalny lub użytkownik potwierdzi.
- Aktualizacja statusu: dynamiczne komunikaty w `JobStatusHeader`, timeline animuje przejścia, countdown aktualizuje się w czasie rzeczywistym.
- Kliknięcie „Zobacz wynik”: nawigacja do `/generations/${id}`, panel się zamyka, lista generacji odświeża się.
- Kliknięcie „Spróbuj ponownie”: wywołanie callbacku (np. otwarcie kreatora generacji), panel przełącza się w tryb oczekiwania.
- Zamknięcie panelu przed zakończeniem: panel wysyła toast „Generowanie trwa w tle” i zapisuje stan w localStorage (`pendingGenerationId`).
- Podgląd assetów: kliknięcie miniatur otwiera nowy modal (opcjonalnie) lub nową kartę z signed URL; walidacja uprawnień.

# Warunki i walidacja
- `GenerationStatus` musi być jedną z enumeracji Supabase (`queued`, `processing`, `succeeded`, `failed`, `expired`); nieznany -> traktowany jako `failed`.
- `resultPath` wymagany dla `succeeded`; brak => `FailureHelpCTA` z kodem `missing_result`.
- `expiresAt` < `Date.now()` => status wymuszony `expired`, CTA tylko „Generuj ponownie”.
- `errorReason` mapowany do `FailureContext`; brak mapy => generuj bezpieczny komunikat + link do supportu.
- Walidacja autoryzacji: przy 401/403 panel zamyka się i kieruje na ekran loginu/przechwycenie w wrapperze.
- `etaSeconds`/`etaTarget` – jeżeli brak w detail response, fallback do wartości z `GenerationQueuedResponseDto` lub config `defaultEtaSeconds`.
- `vertexJobId` i inne identyfikatory nie mogą być prezentowane bez maskowania (tooltip, skopiuj).

# Obsługa błędów
- Błędy sieci/pollingu: wyświetlenie `Retry` w panelu (zachowanie stanu), exponential backoff (3s, 6s, 12s) i komunikat `Brak połączenia`.
- Błędy 404/410: Panel pokazuje alert „Sesja wygasła lub nie istnieje” i CTA do listy generacji.
- Błędy 500: Ogólny alert, CTA „Spróbuj ponownie później” + link do supportu.
- `errorReason` specyficzne:
  - `quota_exhausted` → CTA `Plan płatności` / `Kontakt`.
  - `persona_missing` → CTA otwiera flow uzupełnienia persony.
  - `invalid_request` z kodami walidacji → CTA `Prześlij nowe zdjęcie`.
- Gdy hook `useGenerationStatus` rzuci wyjątek, panel loguje do konsoli z `Logger` i przenosi na `FailureHelpCTA`.
- Zamknięcie panelu w trakcie generacji zapisuje `pendingGenerationId`; po ponownym wejściu aplikacja zaczytuje status i pokazuje toast.

# Kroki implementacji
1. **Przygotowanie infrastruktury**
   - Utworzyć `src/lib/vton/status.mapper.ts` z mapowaniem DTO → ViewModel (status, timeline, akcje, metadata).
   - Dodać `src/lib/vton/status-messages.ts` z mapą `errorReason` → `FailureContext`.
   - Zapewnić helper `getSignedAssetUrl(bucket, path)` z Supabase clientem.
2. **Stworzenie hooków stanu**
   - Zaimplementować `useGenerationStatus` (fetch + polling, obsługa błędów, stopping logic).
   - Zaimplementować `useEtaCountdown` i `useStatusAnnouncements`.
   - Dodać `GenerationEventsContext` lub reaktywne `EventEmitter` do revalidate listy.
3. **Implementacja UI panelu**
   - Dodać `JobStatusPanel` w `src/components/vton/JobStatusPanel.tsx` (React).
   - Skonfigurować `Dialog`/`Sheet` z focus trap, `aria-live`, `onOpenChange`.
   - Wykorzystać Tailwind 4 oraz shadcn komponenty (`Dialog`, `Badge`, `Button`, `Alert`, `ScrollArea`, `Progress`).
4. **Komponenty wewnętrzne**
   - `JobStatusHeader`, `StatusActionBar`, `ProgressTimeline`, `StatusMetadataSection`, `FailureHelpCTA`, `EtaCountdown`.
   - Zapewnić testy dostępności (np. `aria-current`, `role="status"`).
5. **Integracja z przepływem generacji**
   - Po `POST /api/vton/generations` natychmiast otwierać panel z `initialData`.
   - Uaktualnić widoki listy generacji, aby mogły otworzyć panel (`onViewStatus`).
   - Po statusie końcowym: odświeżyć listę, przygotować CTA (pobranie, ocena).
6. **Obsługa błędów i toastów**
   - Dodać mechanizm toastów (np. `sonner`) informujący o kontynuacji w tle i wynikach.
   - Zaimplementować `FailureHelpCTA` z mapowaniem akcji na callbacki (retry, upload, support).
7. **Testy i dokumentacja**
   - Napisać testy jednostkowe mapperów i hooków (status transitions, error handling).
   - Dodać testy e2e (np. Playwright) dla scenariuszy: sukces, błąd walidacji, błąd Vertex.
   - Uaktualnić `.ai/prd.md` (sekcja UX), README (opis panelu) i CHANGELOG.
