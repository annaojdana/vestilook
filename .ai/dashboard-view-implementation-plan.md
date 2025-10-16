## Przeglad
Widok dashboardu zapewnia centralny przeglad stanu konta: zgodnosc z polityka zgody, status Persony, limity darmowych generacji oraz ostrzezenia TTL powiazane z cachem materialow. Sekcja zarzadzania Persona wspiera zmiane oraz usuniecie zdjecia bazowego zgodnie z FR-003 i US-004, a komponent quota informuje o pozostalych generacjach (FR-010, US-007). Widok oferuje tez podsumowanie ostatnich generacji i rekomendacje kolejnych krokow.

## Routing widoku
Widok jest dostepny pod sciezka `/dashboard`. Strona Astro (`src/pages/dashboard.astro`) laduje wstecznie profil oraz przydzial kwoty, przekazujac dane do komponentu React `DashboardView`.

## Struktura komponentow
```
DashboardPage (Astro)
└─ DashboardView (React island)
   ├─ DashboardHeader
   ├─ StatusCardGrid
   │  ├─ StatusCard (Consent)
   │  ├─ StatusCard (Persona)
   │  └─ StatusCard (Quota)
   ├─ PersonaSection
   │  ├─ PersonaCard
   │  └─ PersonaDeleteDialog (portal)
   ├─ QuotaSection
   │  ├─ QuotaSummary
   │  └─ QuotaProgress
   ├─ NextStepsBanner
   ├─ RecentGenerationsSection
   │  └─ GenerationListItem*
   └─ LiveAnnouncements (aria-live)
```
`GenerationListItem` jest oznaczone gwiazdka, poniewaz wymaga istniejacego endpointu listy generacji; w planie przewidziana jest integracja, ale mozna ja wypelnic danymi mock do czasu implementacji backendu.

## Szczegoly komponentu
### DashboardPage (Astro)
- Cel: SSR guard dla autoryzowanych uzytkownikow, pobranie profilu (GET `/api/profile`) oraz kwoty (GET `/api/profile/quota`) przed hydracja React.
- Elementy: layout bazowy, import `DashboardView`, przekazanie initialData.
- Zdarzenia: brak bezposrednich; przekazuje handler redirect (np. onboarding).
- Walidacja: obsluga odpowiedzi 204 z `/api/profile` poprzez redirect na onboarding; obsluga statusow 401/403.
- Props: `profile`, `quota`, `hardLimitReached`, `initialGenerations`.

### DashboardView
- Cel: nadrzedny komponent zarzadzajacy stanem klienta, odswiezaniem danych i renderowaniem sekcji.
- Elementy: wrapper Tailwind, provider dla toasts (shadcn/ui), kontekst stanu dashboardu.
- Zdarzenia: `onRefreshProfile`, `onDeletePersona`, `onPersonaChanged`.
- Walidacja: weryfikacja spojnosc profilu i kwoty (np. brak Persona -> wymusza next step).
- Props: `initialData: DashboardResource`.

### StatusCardGrid i StatusCard
- Cel: trzy karty statusu (Zgoda, Persona, Quota) z ikona, statusem i CTA.
- Elementy: siatka Tailwind, `Card` z shadcn/ui, ikonografia Lucide.
- Zdarzenia: `onAction(id)` dla CTA.
- Walidacja: sprawdzenie `consent.isCompliant`, `persona` null, `quota.free.remaining`.
- Props StatusCard: `{ model: StatusCardViewModel; onAction?: () => void }`.

### PersonaCard
- Cel: prezentacja zdjecia Persony, metadanych oraz akcji zmiany/usuniecia.
- Elementy: `AspectRatio`, `Avatar`/`Image`, buttony `Button` z shadcn/ui, informacje `updatedAt`, `contentType`, `dimensions`.
- Zdarzenia: `onChange`, `onDeleteRequest`, `onView`.
- Walidacja: jesli `persona` null -> pokaz placeholder i CTA dodania; jesli `width` < 1024 lub `height` < 1024 -> ostrzezenie (NextSteps + badge).
- Props: `{ model: PersonaCardViewModel; onChange: () => void; onDelete: () => void }`.

### PersonaDeleteDialog
- Cel: modal z podwojnym potwierdzeniem usuniecia Persony zgodnie z wymaganiem.
- Elementy: `Dialog` shadcn/ui, dwustopniowy `AlertDestructive`, check confirmation input lub checkbox.
- Zdarzenia: `onConfirmStage(stage)`, `onClose`.
- Walidacja: w drugim kroku wymagany checkbox lub wpisanie slowa kluczowego.
- Props: `{ open: boolean; stage: DeleteStage; onConfirm: () => Promise<void>; onCancel: () => void }`.

### QuotaSummary
- Cel: prezentacja licznika pozostalych generacji, daty odnowienia i ostrzezen limitu.
- Elementy: `Card`, `Badge`, progres `Progress` z shadcn/ui.
- Zdarzenia: `onLearnMore`, `onRefreshQuota`.
- Walidacja: wartosci liczbowe >= 0, `renewsAt` > now => obliczenie countdown; `hardLimitReached` -> status krytyczny.
- Props: `{ model: QuotaSummaryViewModel; onRefresh?: () => void }`.

### QuotaProgress
- Cel: wizualizacja zuzycia limitu (uzycie vs total).
- Elementy: `Progress` i etykiety.
- Zdarzenia: brak.
- Walidacja: normalizacja procentu (0-100).
- Props: `{ used: number; total: number }`.

### NextStepsBanner
- Cel: agregacja krokow do wykonania (np. brak zgody, brak Persony, konczacy sie TTL).
- Elementy: `Alert`, lista CTA, linki do akcji.
- Zdarzenia: `onAction(stepId)`.
- Walidacja: budowane z `NextStepItem[]`, filtrowanie duplikatow.
- Props: `{ steps: NextStepItem[]; onAction: (id: NextStepId) => void }`.

### RecentGenerationsSection
- Cel: prezentacja ostatnich generacji (thumbnail, status, rating).
- Elementy: lista `Card`/`List`, placeholder gdy brak danych.
- Zdarzenia: `onViewGeneration`, `onRate`.
- Walidacja: `expiresAt` < now -> badge "Wygaslo"; `status` -> kolor.
- Props: `{ items: GenerationSummaryDto[]; onOpen: (id: string) => void }`.

### LiveAnnouncements
- Cel: aria-live region dla ostrzezen TTL i ograniczen.
- Elementy: `div` z `role="status"` i `aria-live="polite"`.
- Zdarzenia: brak (tylko odswiezenie zawartosci).
- Walidacja: konsolidacja komunikatow, brak duplikatow.
- Props: `{ messages: string[] }`.

### DashboardSkeleton (opcjonalny)
- Cel: skeleton UI podczas ladowania lub revalidacji.
- Elementy: `Skeleton` z shadcn/ui.
- Props: brak.

## Typy
- `DashboardResource`: `{ profile: ProfileResponseDto | null; quota: QuotaSummaryResponseDto | null; generations: GenerationSummaryDto[]; lastFetchedAt: string; }`.
- `StatusCardViewModel`: `{ id: "consent" | "persona" | "quota"; title: string; state: "ok" | "warning" | "error"; message: string; ctaLabel?: string; icon: ReactNode; disabled?: boolean; }`.
- `PersonaCardViewModel`: `{ hasPersona: boolean; imageUrl?: string; updatedAt?: string; width?: number; height?: number; contentType?: string; warnings: string[]; allowDelete: boolean; }`.
- `DeleteStage`: `"idle" | "confirm" | "processing"`.
- `QuotaSummaryViewModel`: `{ total: number; used: number; remaining: number; renewsAt: string | null; hardLimitReached: boolean; warnThreshold: number; ttlWarning?: string; }`.
- `NextStepItem`: `{ id: "accept-consent" | "upload-persona" | "quota-upgrade" | "cloth-cache-renew"; label: string; description: string; actionLabel?: string; severity: "info" | "warning" | "critical"; route?: string; }`.
- `TtlWarningViewModel`: `{ source: "clothCache"; message: string; expiresAt: string; severity: "warning" | "critical"; }`.
- `DashboardErrorState`: `{ message: string; retryable: boolean; source: "profile" | "quota" | "persona-delete"; }`.

## Zarzadzanie stanem
`DashboardView` korzysta z `useReducer` lub `useState` do zarzadzania lokalnymi stanami (`deleteStage`, `isRefreshing`, `errors`, `nextSteps`). Dane z serwera sa inicjalizowane przez `useDashboardResource` (custom hook) wykorzystujacy `use` (React 19) do pobrania `GET /api/profile` i `GET /api/profile/quota` równolegle. Hook udostepnia metody `refreshProfile`, `refreshQuota`, `invalidateAll`. Po udanym `DELETE /api/profile/persona` hook wymusza ponowne pobranie. Live region wykorzystuje `useEffect` do aktualizacji `messages` przy zmianie TTL warnings. Stan dialogu usuwania i toasts przechowywany jest lokalnie; do obslugi powiadomien wykorzystywany jest `useToast` z shadcn/ui.

## Integracja API
- `GET /api/profile`: odpytanie podczas SSR i na zadanie `refreshProfile`. Oczekuje `ProfileResponseDto`. Przy statusie 204 następuje redirect na onboarding. Cache-control prywatny, dlatego odswiezanie po mutacji konieczne.
- `DELETE /api/profile/persona`: wywolywane w `PersonaDeleteDialog.onConfirm`. Zwraca `PersonaDeletionResponseDto`. Po sukcesie hook wykonuje `refreshProfile` i resetuje dialog.
- `GET /api/profile/quota`: pobierane rownolegle do profilu oraz podczas manualnego odswiezania kwoty. Oczekuje `QuotaSummaryResponseDto`. Pole `hardLimitReached` uzywane do dezaktywacji CTA generowania.
- (Opcjonalnie) `GET /api/generations?limit=5`: jezeli endpoint istnieje, mapuje do `GenerationSummaryDto[]`; w przeciwnym razie plan zaklada przygotowanie adaptera gotowego do integracji.

## Interakcje uzytkownika
- Wejscie na `/dashboard` -> zobaczenie kart statusu, sekcji Persona, kwoty, ostatnich generacji.
- Klikniecie `Zmien Personę` -> wywolanie upload flow (nawigacja/otwarcie modalu z istniejacego komponentu); po sukcesie dashboard odswieza dane.
- Klikniecie `Usun Personę` -> otwiera `PersonaDeleteDialog`; po podwojnym potwierdzeniu wysyla DELETE i wyswietla toast o sukcesie.
- Klikniecie CTA w karcie zgody -> nawigacja do widoku zgody/onboardingu.
- Klikniecie przycisku odswiezania kwoty -> `refreshQuota`, wyswietlenie loadera; Hard limit -> informacja krytyczna i CTA do planu premium.
- Interakcja z NextSteps -> przenosi do stosownych podstron lub wywoluje akcje (np. otwarcie uploadu).
- Live ostrzezenia TTL pojawiaja sie automatycznie i sa odczytywane przez czytniki ekranu.

## Warunki i walidacja
- Zgoda: `consent.isCompliant` == false -> karta w stanie error + NextStep `accept-consent`; rowniez blokuje CTA generacji w innych widokach poprzez globalny stan.
- Persona: `profile.persona == null` -> karta w stanie warning, `NextStep` do uploadu, CTA `Dodaj Personę`. W przypadku metadanych < 1024 px generowane ostrzezenie.
- Kwota: `remaining <= 0` lub `hardLimitReached == true` -> karta error, komunikat o braku darmowych generacji; `QuotaProgress` pokazuje 100%. `remaining <= warnThreshold` (np. 1) -> stan warning.
- TTL: `clothCache.expiresAt` w ciagu <24h -> generowanie `TtlWarningViewModel`, dodanie do LiveAnnouncements i NextSteps.
- Redirect onboarding: brak profilu (HTTP 204) -> `Astro` przekierowuje do `/onboarding`.

## Obsluga bledow
- 401/403 z dowolnego endpointu -> `DashboardPage` wymusza redirect do logowania. 
- 500 / bledy sieci -> `DashboardView` pokazuje baner bledu z mozliwoscia retry; logi wysylane do konsoli z contextem requestId (propagacja z API).
- `DELETE` 404 -> toast informacyjny, ale profil nadal odswiezany by zsynchronizowac stan.
- Timeout fetch -> fallback skeleton + powiadomienie; zapewnic anulowanie poprzez `AbortController`.
- Bledy walidacji (np. brak potwierdzenia w dialogu) -> blokada przycisku potwierdzenia i komunikat inline.

## Kroki implementacji
1. Utworzenie pliku `src/pages/dashboard.astro` z guardem autoryzacji, fetch danych SSR oraz renderowaniem `DashboardView`.
2. Zaimportowanie bazowego layoutu Astro (`BaseLayout`) i zapewnienie ochrony przed odpowiedzia 204 (redirect na `/onboarding`).
3. Stworzenie katalogu `src/components/dashboard` z komponentami React zgodnie z powyzsza hierarchia oraz plikami styli Tailwind.
4. Zaimplementowanie `DashboardView` z kontekstem danych i hookiem `useDashboardResource` (fetch profil, kwota, generacje, revalidacja).
5. Dostarczenie `StatusCardGrid` i `StatusCard` w oparciu o shadcn/ui `Card`, wraz z mapowaniem `StatusCardViewModel`.
6. Zaimplementowanie `PersonaCard` z podgladem obrazu, metadanymi oraz integracja z istniejacym flow uploadu; dodanie ostrzezen przy niespelnieniu wymagan.
7. Dodanie `PersonaDeleteDialog` z dwustopniowym potwierdzeniem, bledami i integracja z DELETE endpointem (toast po sukcesie, invalidacja cache).
8. Zaimplementowanie `QuotaSummary` i `QuotaProgress` z obliczaniem procentu, stanami ostrzezen oraz CTA do odswiezenia.
9. Przygotowanie `NextStepsBanner`, generatora listy krokow (bazujacego na stanie zgody, persony, TTL i limicie) oraz funkcji akcji.
10. Dodanie `RecentGenerationsSection` z fallbackiem, skeletonem i przygotowaniem adaptera danych (endpoint lub mock) oraz odznaczeniem wygaslych generacji.
11. Utworzenie `LiveAnnouncements` (aria-live) i integracja z TTL warnings; zapewnienie testu czytnika (manualnego).
12. Dodanie globalnego systemu toastow i integracja z akcjami (sukces, blad).
13. Pokrycie komponentow testami jednostkowymi (np. vitest) i story (Storybook/Chromatic) dla stanu normalnego, ostrzegawczego i bledu.
14. Aktualizacja dokumentacji (`.ai/ui-shadcn-helper.md`, `README.md`, `CHANGELOG.md`) oraz konfiguracji typow jesli dodane nowe DTO.
