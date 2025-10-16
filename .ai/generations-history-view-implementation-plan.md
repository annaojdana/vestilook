**Przegląd**
- Widok historii generacji prezentuje listę wyników VTON dla zalogowanego użytkownika z filtrowaniem po statusie i zakresie dat, spełniając FR-002/FR-006/FR-009.
- Interfejs umożliwia pobieranie w wysokiej jakości, ocenianie, podgląd TTL i przyspieszone czyszczenie wpisów, realizując US-008/US-009/US-010 oraz wspierając kontrolę kosztów (FR-010).
- Layout łączy Astro i React: statyczny szablon hostuje interaktywny komponent reagujący na zmiany filtrów i paginację bez przeładowań.
- Architektura kładzie nacisk na dostępność (semantyczna tabela, aria-atrybuty, fokusowalne akcje) oraz wydajność (paginacja, memoizacja rzędów, pojedynczy timer TTL).

**Routing widoku**
- Ścieżka: `/generations/history` jako `src/pages/generations/history.astro` z globalnym layoutem i poprawnymi meta tagami SEO.
- Strona ładuje `GenerationsHistoryView` z dyrektywą `client:load`, aby umożliwić natychmiastową interakcję i View Transitions.
- Middleware (`src/middleware/index.ts`) powinno wymuszać sesję Supabase; brak autoryzacji skutkuje przekierowaniem, a komponent obsługuje `401` podczas fetch.
- Węzeł `head` ustawia `title` i `description`, a w razie potrzeby rejestruje `aria-live` container do zgłaszania błędów filtrowania.

**Struktura komponentów**
- GenerationsHistoryPage (Astro) → Layout + `<main>` + osadzony React `GenerationsHistoryView`.
- GenerationsHistoryView → FilterToolbar + HistoryList + PaginationControls + ConfirmDeleteDialog + Toaster (Sonner).
- HistoryList → TableHeader + TableBody(HistoryRow) + EmptyState/LoadingOverlay.
- HistoryRow → Thumbnail + StatusBadge + TTLWarningBadge + InlineRating + ActionButtons (download/open/delete).

**Szczegóły komponentu**
- GenerationsHistoryPage: odpowiedzialny za pobranie sesji Supabase, renderuje layout i przekazuje sesję/filtry; markup `<Layout><main></main></Layout>`; waliduje obecność sesji; props { session?: Session }.
- GenerationsHistoryView: `<section>` z nagłówkiem i treścią; korzysta z hooków `useGenerationHistory`, `useGenerationActions`, `useCountdown`; resetuje cursor przy zmianach filtrów; używa typów `GenerationListResponseDto`, `GenerationHistoryFilters`; props { initialFilters?: GenerationHistoryFilters, session?: Session }.
- FilterToolbar: formularz z `Select` dla statusu, dwoma `Input type="date"` i `Button` (zastosuj/wyczyść); emituje `onChange`, `onSubmit`, `onReset`; waliduje `from <= to` oraz dopuszczalne statusy; typ `GenerationHistoryFilters`; props { value, onChange, onSubmit, isPending }.
- HistoryList: wykorzystuje `ui/table` (thead/tbody/tfoot), wbudowuje komunikat `aria-live` przy pustych danych; obsługuje `onRetry`; waliduje `items.length` i `error`; props { items: GenerationHistoryItemViewModel[], isLoading, error, onRetry }.
- HistoryRow: `<tr>` z kolumnami miniatury, statusu, TTL, oceny i akcji; obsługuje `onDownload`, `onOpen`, `onRate`, `onDelete`; waliduje dostępność akcji przez `HistoryActionAvailability`; props { item: GenerationHistoryItemViewModel, actions: HistoryRowActions }.

Dodatkowe komponenty:
- InlineRating: pięć przycisków/`RadioGroup` z etykietami ARIA; obsługuje `onRate` i `onFocus`; waliduje rating 1–5 i blokuje interakcję podczas requestu; typy `GenerationRatingValue`, `RatingPayload`; props { value: number | null, onRate, disabled, isSubmitting }.
- TTLWarningBadge: bazuje na `ui/badge`, prezentuje countdown i ostrzeżenia; obsługuje aktualizację co tick; waliduje `expiresAt` i `status`; props { expiresAt?: string | null, status: GenerationStatus, countdown: CountdownState }.
- PaginationControls: `nav` z przyciskami wstecz/dalej i informacją o zakresie; korzysta z `useTransition`; waliduje obecność kursora; props { pageInfo: PaginationState, onPageChange, isPending }.
- ConfirmDeleteDialog: oparty o `ui/alert-dialog`, pokazuje opis konsekwencji TTL; obsługuje `onConfirm`, `onCancel`; waliduje brak równoległej mutacji; props { target?: GenerationHistoryItemViewModel, onConfirm, isSubmitting }.
- EmptyState: `div role="status"` z ikoną i CTA do generowania nowej stylizacji; żadnych zdarzeń; props { filters: GenerationHistoryFilters }.

**Typy**
- GenerationHistoryFilters: `{ status: GenerationStatus[]; from?: string; to?: string; limit: number; cursor?: string | null }` – reprezentuje formularz filtrów i query string.
- GenerationHistoryQuery: `{ signal: AbortSignal; sessionToken: string; filters: GenerationHistoryFilters }` – struktura przekazywana do fetchera hooka.
- GenerationHistoryItemViewModel: `{ id: string; createdAt: string; createdAtLabel: string; completedAtLabel?: string; status: GenerationStatus; statusLabel: string; statusVariant: "info"|"success"|"warning"|"destructive"; thumbnailUrl: string; rating: number | null; ratingLabel: string; expiresAt: string | null; countdown: CountdownState; actions: HistoryActionAvailability; errorReason?: string }`.
- HistoryActionAvailability: `{ canDownload: boolean; canOpen: boolean; canRate: boolean; canDelete: boolean; disableReason?: string }` – steruje stanem przycisków i tooltipów.
- CountdownState: `{ remainingMs: number; remainingLabel: string; severity: "neutral"|"warning"|"danger"; isExpired: boolean; nextTickMs: number }` – wyliczenia TTL badge.
- RatingPayload: `{ id: string; rating: GenerationRatingValue }` – parametry mutacji POST rating.
- DeletePayload: `{ id: string }` – struktura używana przez wywołanie DELETE w hooku mutacji.

**Zarządzanie stanem**
- `const [filters, setFilters] = useState<GenerationHistoryFilters>` w `GenerationsHistoryView`, synchronizowane z parametrami URL (np. `useEffect` + `history.replaceState`).
- `useGenerationHistory(filters)` wykorzystuje `useEffect` + `AbortController` lub `useSWR` do pobrania `GenerationListResponseDto`, wystawia `data`, `isLoading`, `error`, `refetch`, `pageInfo`.
- `useGenerationActions()` kapsułkuje mutacje download/rate/delete, używa `useTransition` do zarządzania pending state i zwraca funkcje wraz z flagami.
- `useCountdown(expiresAt)` tworzy pojedynczy `setInterval` współdzielony przez badge, zwraca `CountdownState` i aktualizuje po zmianie daty.
- Globalne powiadomienia inicjowane przez `ui/sonner` w `GenerationsHistoryView`, a sesja Supabase przechowywana w stanie komponentu lub context.

**Integracja API**
- GET `/api/vton/generations` z parametrami `status`, `from`, `to`, `limit`, `cursor`; headers `Authorization: Bearer ${session.access_token}`; response mapowany na `GenerationHistoryItemViewModel`; obsługa `400/401/500`.
- GET `/api/vton/generations/{id}/download` zwraca `GenerationDownloadResponseDto`; powoduje `window.open(signedUrl)` lub stworzenie hidden `<a download>`; reaguje na `403/404/410/423`.
- POST `/api/vton/generations/{id}/rating` z body `GenerationRatingCommand`; na `200` aktualizuje lokalny rating, `409` synchronizuje z serwerem.
- DELETE `/api/vton/generations/{id}` usuwa wpis przed TTL; po sukcesie usuwa wiersz z cache i odświeża paginację.
- Wszystkie wywołania logują zdarzenia przez `createLogger` (opcjonalnie) i propagują błędy do Sonner.

**Interakcje użytkownika**
- Zmiana statusu lub dat w FilterToolbar aktualizuje filtr i resetuje kursor, po czym automatycznie wywołuje `fetch`.
- Kliknięcie „Pobierz” pobiera signed URL i inicjuje pobranie; w razie braku dostępności pokazuje tooltip/toast.
- Kliknięcie „Otwórz” otwiera podpisany link w nowej karcie (tylko dla `succeeded` i aktywnych TTL).
- Wybór gwiazdki w InlineRating wysyła ocenę i tymczasowo blokuje kontrolę, po czym aktualizuje ocenę i `aria-live`.
- Akcja „Usuń” otwiera ConfirmDeleteDialog; potwierdzenie wysyła DELETE, usuwa wiersz i odświeża dane.
- Paginacja (dalej/wstecz) pobiera kolejne strony, zachowując aktualne filtry i focus na pierwszej komórce listy.

**Warunki i walidacja**
- Przyciski download/open są aktywne wyłącznie dla `status === "succeeded"` oraz gdy `countdown.isExpired === false`; inaczej prezentują blokadę z komunikatem.
- Rating dostępny, gdy `actions.canRate` (status succeeded, niepending, TTL > 0); błędne wartości są odrzucane po stronie klienta przed POST.
- Usuwanie domyślnie zablokowane podczas aktywnej mutacji lub gdy status `processing`/`queued` (szare przyciski, aria-disabled).
- Formularz filtrów waliduje format ISO dat i relację `from <= to`; błędy wypisywane w `aria-live="assertive"` nad formularzem.
- Parametr `limit` ograniczony do 10–50; wartości spoza zakresu automatycznie clampowane do 20.
- TTLWarningBadge zmienia wariant stylu: `warning` przy <24h, `danger` przy <1h, etykieta „Wygasło” gdy `isExpired` lub status `expired`.

**Obsługa błędów**
- GET 400: formularz podświetla pola, lista pokazuje stan błędu z przyciskiem „Spróbuj ponownie” i logiem do konsoli dla diagnostyki.
- GET 401: czyści sesję, wyświetla toast „Sesja wygasła” i przekierowuje do logowania.
- Download 410: aktualizuje wpis jako wygasły, wyłącza akcje i informuje o konieczności regeneracji.
- Download 423 oraz status `queued/processing`: informuje użytkownika, że generacja trwa, oraz planuje automatyczny `refetch` po krótkim odstępie.
- Rating 409/404: synchronizuje rating z odpowiedzi i usuwa wpis z listy w razie `404`, pokazując toast informacyjny.
- Delete 404/500: `404` skutkuje refetchem listy, `500` pokazuje błąd z możliwością ponowienia i nie usuwa wiersza z UI.

**Kroki implementacji**
- Utworzenie `src/pages/generations/history.astro` z layoutem, metadanymi SEO i osadzeniem `GenerationsHistoryView` (client:load).
- Implementacja hooków `useGenerationHistory`, `useGenerationActions`, `useCountdown` wraz z testami jednostkowymi dla logiki filtrów i odliczania.
- Zaimplementowanie komponentów w katalogu `src/components/vton/history` (FilterToolbar, HistoryList, HistoryRow, InlineRating, TTLWarningBadge, PaginationControls, ConfirmDeleteDialog, EmptyState).
- Dodanie styli Tailwind (klasy utility, wpisy w `@layer components` dla powtarzalnych badge) i wykorzystanie istniejących komponentów shadcn/ui.
- Integracja z Supabase Auth: pobieranie tokenu dostępu, odświeżanie sesji w razie `401`, przekazywanie nagłówków `Authorization`.
- Implementacja logiki mutacji (download, rating, delete) z obsługą optimistic update, invalidacją cache i obsługą toastów (Sonner).
- Dodanie fallbacków: skeletony/loader, stany błędów, aria-live, focus management po paginacji i dialogach.
- Aktualizacja dokumentacji i checklist (README sekcja autoryzacji, CHANGELOG wpis po wdrożeniu, ewentualne rozszerzenie `.env.example` o flagi TTL).
