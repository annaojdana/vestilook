**Przegląd**
- Widok `/onboarding/garment` jest krokiem 3/3 procesu onboardingu. Potwierdza, że persona została już przesłana (FR-003) i przygotowuje użytkownika do pierwszego uploadu ubrania zgodnie z wymaganiami FR-006/FR-007.
- Strona pełni rolę mostu między konfiguracją konta a formularzem generacji (`/generations/new`). Dostarcza checklistę jakości dla zdjęć ubrań, skrót stanu profilu oraz CTA prowadzące do uruchomienia pierwszej stylizacji (US-004).
- Widok nie wykonuje uploadu po stronie serwera — wszystkie operacje na plikach pozostają w formularzu generacji. Jego zadaniem jest edukacja, walidacja precondition (posiadanie persony) i zebranie metadanych (np. preferowany retain window).

**Routing widoku**
- Ścieżka: `/onboarding/garment` (Astro page w `src/pages/onboarding/garment.astro`).
- SSR pobiera `ProfileResponseDto` z `/api/profile` podobnie jak krok persony. Brak profilu/persony ⇒ redirect do `/onboarding/persona`.
- Komponent główny `OnboardingGarmentShell` hydratowany z `client:load` (potrzebny dostęp do Supabase, dynamicznego podpisywania URL-i oraz interaktywnych checklist).

**Struktura komponentów**
- `OnboardingGarmentShell`
  - `PersonaStatusCard` – streszcza stan persony, wyświetla miniaturę (jeśli dostępny signed URL) oraz datę ostatniej aktualizacji.
  - `GarmentPreparationChecklist` – lista kroków oraz wymagań technicznych (min 1024×1024, JPEG/PNG, jednolite tło).
  - `RetentionSelector` – opcjonalny przełącznik preferowanego okna retencji (domyślnie 48h) zapisany w pamięci podręcznej i przekazywany do `/generations/new` (np. przez query param `retain=48`).
  - `ActionFooter` – CTA „Przejdź do tworzenia stylizacji”, link do wsparcia i fallback przycisk „Wróć do persony” gdy preconditions niespełnione.
  - `InfoBanner` – ostrzeżenie gdy persona brak / wygasła lub kiedy supabase session jest nieaktywna.

**Szczegóły komponentów**
- `OnboardingGarmentShell`
  - Props: `{ profile: ProfileResponseDto | null; nextPath: string; retainOptions: number[]; defaultRetain: number }`.
  - State: `selectedRetain`, `personaPreviewUrl` (opcjonalnie generowany przez client Supabase), `status` (loading / ready).
  - Zdarzenia: `handleContinue()` (nawigacja do `nextPath` z query `?retain=<value>`), `handleChangeRetain(value)`, `handleRefreshPersona()` (ponownie pinguje `/api/profile` na potrzeby edge cases).
  - Walidacja: `personaReady = Boolean(profile?.persona?.path)`; jeżeli `false` ⇒ disable CTA i pokaż link do `/onboarding/persona`.
- `PersonaStatusCard`
  - Props: `{ persona?: ProfileResponseDto["persona"]; previewUrl?: string | null; onRefresh?: () => void }`.
  - Render: `<section>` z nagłówkiem, miniaturą (img role="presentation"), metadanymi (ostatnia aktualizacja, rozdzielczość jeśli znana), statusem (badge success/warning).
  - Zdarzenia: `onRefresh` -> re-fetch.
- `GarmentPreparationChecklist`
  - Props: `{ constraints: ImageValidationConstraints }` (reuse `PERSONA_UPLOAD_CONSTRAINTS` analogicznie do `VTON` config: min width/height = 1024, max bytes = env).
  - Render: `<ol>` z krokami (1. Ustaw ubranie na wieszaku, 2. Użyj neutralnego tła, 3. Zrób zdjęcie >1024px, 4. Eksportuj jako PNG/JPEG).
  - Aria: `role="list"` + `aria-describedby` do dodatkowego panelu.
- `RetentionSelector`
  - Props: `{ value: number; options: number[]; onChange: (value: number) => void }`.
  - Render: segmented control / radio group (shadcn `ToggleGroup` lub `RadioGroup`).
  - Walidacja: dozwolony zakres 24–72h (zgodny z `GenerationService`).
- `ActionFooter`
  - Reuse istniejącego komponentu? Jeśli nie, lekki wariant: CTA button + secondary link.

**API i dane**
- `GET /api/profile` – weryfikuje czy persona istnieje; w razie 204 redirect do `/onboarding/persona`.
- `Supabase storage` – opcjonalne generowanie signed URL dla persony (`PRIVATE_VTON_PERSONA_BUCKET`). Warto użyć helpera `getSignedAssetUrl` (cache).
- Brak dodatkowych endpointów (garment upload i kolejka Vertex dalej obsługiwane w `/api/vton/generations`).

**Interakcje użytkownika**
- Jeśli persona gotowa: pokazujemy status success + CTA „Rozpocznij stylizację”.
- Jeśli persona missing: CTA disabled, baner z informacją + link do powrotu.
- Zmiana retain window: natychmiastowa aktualizacja opisu w CTA (np. “Utrzymaj rezultaty przez 48h”).
- Kliknięcie CTA -> `window.location.assign(\`\${nextPath}?retain=\${selectedRetain}\`)`.
- Kliknięcie „Odśwież dane persony” odpytuje `/api/profile` i aktualizuje `persona`.

**Warunki i walidacja**
- `profile` === `null` lub `profile.persona === null` => `personaReady = false`, render ostrzeżenia i link do poprzedniego kroku.
- `selectedRetain` musi być liczbą całkowitą 24–72. W innym razie fallback do `defaultRetain`.
- Przy problemach z Supabase (np. brak tokenu) – wymusić `signOut()` + redirect login analogicznie do `OnboardingPersonaShell`.

**Obsługa błędów**
- `fetch` profilu zwraca 401 => `signOut()` + redirect `/auth/login`.
- `fetch` profilu 5xx => pokaż toast + button „Spróbuj ponownie”.
- `getSignedAssetUrl` zwraca `null` => pokaż placeholder zamiast miniatury.

**Kroki implementacji**
1. Dodać plik `src/pages/onboarding/garment.astro` (SSR + redirect guard). Wykorzystać `OnboardingLayout`.
2. Utworzyć komponent `OnboardingGarmentShell.tsx` w `src/components/onboarding/`.
3. Dodać pomocnicze komponenty (`GarmentPreparationChecklist.tsx`, `PersonaStatusCard.tsx`, ewentualnie `RetentionSelector.tsx`). Każdy z testami jednostkowymi w `__tests__`.
4. Dodać helper do ponownego pobrania profilu (reuse `usePersonaProfile` lub prosty hook `useProfileSnapshot`).
5. Upewnić się, że CTA przekazuje wybrany `retainForHours` (query param).
6. Zaktualizować dokumentację (.ai plan + README jeśli onboarding flow się wydłuża) oraz e2e pamiętnik (Playwright scenario: consent → persona → garment → generations/new).
