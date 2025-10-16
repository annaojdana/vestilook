# Generations Result View — Plan wdrożenia

## Przegląd
- Widok prezentuje pojedynczy wynik generacji VTON wraz z metadanymi, oceną i możliwością pobrania.
- Wspiera pełny cykl życia wyniku: podgląd, informacja o ważności, zapis oceny, pobranie pliku oraz komunikaty o wygaśnięciu.
- Musi spełniać wymagania dostępności (ARIA, obsługa klawiatury) i zapewniać bezpieczne zarządzanie wygasającymi zasobami.

## Routing widoku
- Ścieżka: `/generations/[id]` (Astro strona SSR/SSG z Reactowym komponentem klienckim dla logiki interakcji).
- Route korzysta z parametru `id` do pobrania danych poprzez `/api/vton/generations/{id}` po stronie klienta (lub server loader, jeśli istnieje infrastruktura).

## Struktura komponentów
- `ResultGenerationPage` (wrapper Astro + React root)
  - `ResultGenerationView` (komponent kontenerowy React z logiką danych)
    - `ExpiryBanner`
    - `ResultLayout` (komponent układu, np. `main` + `aside`)
      - `ResultPreviewSection`
        - `ResultPreview`
        - `DownloadButton`
        - `RatingStars`
      - `ResultSidebar`
        - `MetadataPanel`
        - `ActionHistoryList`
        - (opcjonalnie) `GenerationSupportActions` (link do pomocy/usunięcia)
    - `ToastRegion` / `sr-only aria-live` (dla powiadomień i komunikatów dostępności)

## Szczegóły komponentu

### ResultGenerationView
- **Opis**: Główny komponent odpowiedzialny za pobranie danych generacji, zbudowanie modelu widoku, przekazanie stanu do komponentów potomnych oraz zarządzanie interakcjami (download, rating, odświeżenie).
- **Struktura**: renderuje `ExpiryBanner`, `ResultLayout`, dostarcza kontekst stanu (np. React Context dla download/rating).
- **Zdarzenia**: montaż (fetch), zmiana parametrów, kliknięcie pobierania, wysłanie oceny, automatyczne odświeżenie TTL.
- **Walidacja**: sprawdza status (`succeeded`, `processing`, `failed`), TTL (`expiresAt` vs `now`), dostępność `resultPath`.
- **Typy**: przyjmuje `ResultGenerationViewProps { generationId: string }`; korzysta z `GenerationResultViewModel`.

### ExpiryBanner
- **Opis**: Wyświetla stan ważności wyniku, liczniki czasu oraz ostrzeżenia (w tym aria-live na 1h przed wygaśnięciem).
- **Elementy**: `<section role="alert">` z tekstem, ikoną ostrzeżenia; w tle `aria-live="polite"`/`assertive` dla kluczowych komunikatów.
- **Zdarzenia**: aktualizacja co minutę/sekunę na podstawie hooka `useExpiryCountdown`.
- **Walidacja**: `isExpired`, `isExpiringSoon (<= 1h)`, `expiresAt` null -> ukrycie.
- **Typy**: `ExpiryBannerProps { expiry: ExpiryState }`.

### ResultPreview
- **Opis**: Prezentuje duży obraz wyniku; obsługuje placeholdery dla statusów innych niż `succeeded`.
- **Elementy**: `<figure>` z `<img>` (alt z krótkim opisem); fallback skeleton/placeholder.
- **Zdarzenia**: `onError` -> zgłoszenie do `ResultGenerationView` (wyświetlenie komunikatu, ewentualne odświeżenie signed URL).
- **Walidacja**: renderuje obraz tylko, gdy `viewModel.asset.previewUrl` istnieje i `status === "succeeded"`; w przeciwnym razie placeholder + CTA (np. "Generacja w toku").
- **Typy**: `ResultPreviewProps { asset: GenerationAssetPreview; status: GenerationStatus }`.

### DownloadButton
- **Opis**: Przycisk pobierania wynikowego pliku; ładuje signed URL i wyzwala pobranie.
- **Elementy**: `shadcn/ui` Button z ikoną; aria-disabled oraz tooltip/aria-describedby dla komunikatów.
- **Zdarzenia**: `onClick` → `useGenerationDownload` (GET download), otwarcie URL (anchor lub `window.open`), obsługa błędów.
- **Walidacja**: aktywny tylko, gdy `status === "succeeded"`, `!expiry.isExpired`, `resultPath` istnieje; disable + komunikat dla `423`/`410`.
- **Typy**: `DownloadButtonProps { state: DownloadState; onDownload: () => Promise<void>; disabledReason?: string }`.

### RatingStars
- **Opis**: Interaktywna skala 1–5; aktualizuje wynik poprzez POST rating.
- **Elementy**: pięć przycisków/`role="radio"` w grupie `radiogroup`, obsługa klawiatury (strzałki, spacja).
- **Zdarzenia**: `onChange` -> `useGenerationRating`, optimistic update, toast przy sukcesie.
- **Walidacja**: `status === "succeeded"` oraz `!expiry.isExpired`; przy błędach revert stanu; wczytuje rating początkowy z `viewModel.rating`.
- **Typy**: `RatingStarsProps { rating: number | null; onRate: (value: GenerationRatingValue) => void; submitting: boolean; disabled: boolean }`.

### MetadataPanel
- **Opis**: Listuje metadane generacji (ID, status, timestamps, rozdzielczość, TTL, rozmiar pliku jeśli dostępny).
- **Elementy**: definicyjna lista (`<dl>`), semantyczne tytuły; wbudowany `StatusBadge`.
- **Zdarzenia**: brak aktywnych, tylko wyświetlenie.
- **Walidacja**: formatowanie dat (`toLocaleString` z preferencją użytkownika), fallback `—` dla wartości null.
- **Typy**: `MetadataPanelProps { meta: GenerationMeta }`.

### ActionHistoryList
- **Opis**: Pokazuje historię (utworzenie, start, zakończenie, ocena, planowane wygaśnięcie).
- **Elementy**: lista w `<ol>` z ikonami stanu.
- **Zdarzenia**: brak, jedynie wyświetlanie.
- **Walidacja**: ukrywa pozycje bez dat; wyróżnia bieżący status.
- **Typy**: `ActionHistoryListProps { items: GenerationHistoryItem[] }`.

### GenerationSupportActions (opcjonalnie)
- **Opis**: Link/sekcja do usunięcia wyniku (DELETE) lub kontaktu pomocy.
- **Elementy**: button/link; alert dialog przed usunięciem.
- **Zdarzenia**: `onDelete` → wywołanie `DELETE /api/vton/generations/{id}`, odświeżenie listy / redirect.
- **Walidacja**: Dostępne tylko dla właściciela, `!deleteInProgress`.
- **Typy**: `GenerationSupportActionsProps { onDelete: () => Promise<void>; loading: boolean }`.

## Typy
- `GenerationResultViewModel`
  - `id: string`
  - `status: GenerationStatus`
  - `asset: GenerationAssetPreview`
  - `meta: GenerationMeta`
  - `history: GenerationHistoryItem[]`
  - `rating: GenerationRatingValue | null`
  - `expiry: ExpiryState`
  - `hasPersonaSnapshot: boolean`
  - `hasClothSnapshot: boolean`
- `GenerationAssetPreview`
  - `previewUrl: string | null` (signed URL do `<img>`)
  - `downloadFilename: string`
  - `resolution: { width: number; height: number } | null`
  - `contentType: string | null`
- `GenerationMeta`
  - `createdAt: Date`
  - `startedAt: Date | null`
  - `completedAt: Date | null`
  - `ratedAt: Date | null`
  - `vertexJobId: string | null`
  - `expiresAt: Date | null`
  - `statusLabel: string`
- `GenerationHistoryItem`
  - `key: "created" | "started" | "completed" | "rated" | "expired"`
  - `label: string`
  - `timestamp: Date | null`
  - `tone: "info" | "success" | "warning"`
- `ExpiryState`
  - `isExpired: boolean`
  - `isExpiringSoon: boolean`
  - `remainingMs: number`
  - `expiresAt: Date | null`
  - `warningAt: Date | null` (moment 1h przed wygaśnięciem)
- `DownloadState`
  - `status: "idle" | "loading" | "success" | "error"`
  - `error?: string`
  - `lastDownloadedAt?: Date`
- `RatingState`
  - `value: GenerationRatingValue | null`
  - `submitting: boolean`
  - `error?: string`
  - `lastSubmittedAt?: Date`
- Wszystkie pola bazują na DTO z `src/types.ts`: `GenerationDetailResponseDto`, `GenerationDownloadResponseDto`, `GenerationRatingCommand`, `GenerationRatingResponseDto`.

## Zarządzanie stanem
- Hook `useGenerationDetail(id)`:
  - Fetch `GET /api/vton/generations/{id}`, mapuje do `GenerationResultViewModel`.
  - Zapewnia rewalidację (manualną i automatyczną co X sekund, gdy status ≠ succeeded).
- Hook `useExpiryCountdown(expiresAt)`:
  - Zwraca `ExpiryState`, aktualizuje `remainingMs` w interwale (np. 30 s).
  - Wywołuje callback `onWarning` przy przekroczeniu progu 1h (do aria-live).
- Hook `useGenerationDownload(id)`:
  - Stan `DownloadState`, wywołuje `GET /api/vton/generations/{id}/download`, zwraca `signedUrl`, aktualizuje `previewUrl` (opcjonalnie).
  - Obsługuje `410` i `423` różnymi komunikatami.
- Hook `useGenerationRating(id, initialValue)`:
  - Przechowuje `RatingState`, wysyła `POST /api/vton/generations/{id}/rating`.
  - Obsługuje optimistic UI i odświeża dane detalu po sukcesie.
- Kontekst `GenerationActionsContext` (opcjonalnie) do współdzielenia `onDownload`, `onRate`, `expiry`.

## Integracja API
- `GET /api/vton/generations/{id}`:
  - Odpowiedź mapowana do `GenerationResultViewModel`.
  - Przy `404` → widok błędu, `410` → oznaczenie wygaśnięcia.
- `GET /api/vton/generations/{id}/download`:
  - Wywoływany przy kliknięciu pobierz i przy inicjalizacji preview (jeśli brak publicznego URL).
  - Zwraca `signedUrl`, `contentType`, `expiresAt`; UI tworzy `a` z `downloadFilename`.
- `POST /api/vton/generations/{id}/rating`:
  - Payload `GenerationRatingCommand { rating }`.
  - Po sukcesie aktualizuje `rating`, `ratedAt`.
- (Opcja) `DELETE /api/vton/generations/{id}`:
  - Po potwierdzeniu usuwa rekord, przekierowanie do listy.
- Wszelkie fetch-e opakowane w helper (np. `lib/apiClient.ts`) z obsługą supabase auth token.

## Interakcje użytkownika
- Wejście na widok → automatyczne pobranie danych, focus na nagłówku.
- Kliknięcie `Pobierz` → pobranie pliku, spinner w trakcie, toast przy błędzie/sukcesie.
- Ocena gwiazdką → natychmiastowe zaznaczenie, wysłanie na backend, komunikat potwierdzenia.
- Zbliżający się koniec TTL → baner zmienia kolor, aria-live ogłasza ostrzeżenie.
- Wygasły wynik → baner informuje o niedostępności, przycisk pobierania dezaktywowany.
- Historia działań → statyczny podgląd, brak interakcji.

## Warunki i walidacja
- Pobieranie: dozwolone tylko przy `status === "succeeded"` i `expiry.isExpired === false`; w innym przypadku `disabled` + komunikat (np. 410).
- Ocena: akceptuje tylko wartości 1–5 (`GenerationRatingValue`), blokuje przy `expiry.isExpired`.
- Wyświetlanie preview: wymaga ważnego `previewUrl`; w przeciwnym razie fallback (info o przetwarzaniu).
- TTL: `ExpiryBanner` ukryty, gdy `expiresAt` brak; ostrzeżenie przy `remainingMs <= 3600000`.
- Dostępność: wszystkie interaktywne elementy mają focus outline, aria-labels, role; `ToastRegion` z `aria-live="polite"`.

## Obsługa błędów
- `GET detail`: 
  - `404` → sekcja z komunikatem „Nie znaleziono generacji” + link powrotny.
  - `410` → oznaczenie jako wygasłe, przycisk pobierania wyłączony.
  - `500/Network` → retry CTA, log błędu w konsoli + powiadomienie.
- `Download`:
  - `410` → update `expiry.isExpired`, komunikat w banerze.
  - `423` → ustaw `disabledReason` („Generacja jeszcze się przetwarza”), automatyczne odświeżenie statusu.
  - Inne błędy → toast z prośbą o ponowienie.
- `Rating`:
  - `400/409` → przywrócenie poprzedniego ratingu, komunikat walidacyjny.
  - `401/403` → przekierowanie do logowania.
- Fallback: globalny `ErrorBoundary` (jeśli używany) przekierowuje do strony błędu.

## Kroki implementacji
1. Przygotuj routę `/generations/[id].astro`, osadź klientowy `ResultGenerationView` z przekazaniem `id`.
2. Zaimplementuj helpery API (`lib/vtonClient.ts`) typowane `GenerationDetailResponseDto`, `GenerationDownloadResponseDto`, `GenerationRatingCommand`.
3. Utwórz hook `useGenerationDetail` z mapowaniem DTO → `GenerationResultViewModel` i obsługą retry.
4. Dodaj hook `useExpiryCountdown` oraz aria-live provider do ostrzeżeń TTL.
5. Zaimplementuj `ResultGenerationView` łączący hooki (detail, expiry, download, rating) i przekazujący dane do potomków.
6. Zbuduj komponenty prezentacyjne (`ExpiryBanner`, `ResultPreview`, `DownloadButton`, `RatingStars`, `MetadataPanel`, `ActionHistoryList`) z Tailwind + shadcn/ui.
7. Zapewnij testy jednostkowe hooków (np. mock fetch) oraz testy integracyjne komponentu (React Testing Library) weryfikujące stany TTL, pobieranie i rating.
8. Dodaj dostępnościowe atrybuty (aria-live, role, focus management) oraz e2e scenariusz (jeśli używany Playwright) dla ścieżek pobierania i oceny.
9. Zaktualizuj dokumentację `.ai/ui-shadcn-helper.md` i README/CHANGELOG (jeśli wymagane) po wdrożeniu widoku.
10. Zweryfikuj działanie w przeglądarkach docelowych, szczególnie ponowne uzyskiwanie signed URL przed wygaśnięciem.
