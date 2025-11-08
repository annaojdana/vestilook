# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Widok `/onboarding/garment` domykający onboarding (podsumowanie persony, checklisty ubrań, wybór retencji i CTA do `/generations/new`) wraz z dokumentacją planu implementacyjnego.
- Pasek `MobileNavigation` dokowany do dolnej krawędzi, renderowany w `Layout.astro` dla ekranów `< md`, z linkami do dashboardu/generacji/profilu, CTA „Nowa stylizacja” oraz integracją z `UserNavigation`.
- Wspólny kanał zdarzeń (`layout:user-navigation-sheet`, `layout:mobile-navigation-panel`) i wsparcie dla ukrywania marketingowych stopek oznaczonych `data-site-footer="true"` w trybie mobilnym.
- Widok `/generations/new` renderujący formularz generacji z obsługą limitów, retencji i ponownej zgody.
- Komponenty UI: `GarmentUploadField`, `ConsentReaffirmation`, `QuotaIndicator`, `RetentionSelector`, `FormAlerts`, `GeneratePrimaryButton` wraz z modułami walidacji (`useGarmentValidation`) i orchestracją wysyłki (`useGenerationSubmission`).
- Zestaw testów Vitest obejmujący walidację plików, orchestrację żądań VTON oraz integracyjny scenariusz `GenerationForm`.
- Dokumentacja PRD/README rozszerzona o wymagania formularza generacji, konfigurację zmiennych środowiskowych i nowe scenariusze E2E.
- Logger klienta (`src/lib/client-logger.ts`) z przełącznikiem `PUBLIC_ENABLE_CLIENT_LOGS` oraz telemetria w `LoginForm` ułatwiająca debugowanie procesu logowania.
- Statyczna strona `/legal/polityka-przetwarzania-wizerunku` wykorzystywana przez ekran zgody, zapewniająca domyślną treść regulaminu przetwarzania wizerunku.
- Złagodzona walidacja persony: minimalna rozdzielczość zdjęcia to teraz 512×512 zamiast 1024×1024, dzięki czemu akceptujemy zdjęcia z większości smartfonów bez dodatkowej obróbki.
- Mobilne profile Playwright (`mobile-chrome`, `mobile-safari`) oraz przewodnik w README, które ułatwiają testy responsywności Pixel 7 / iPhone 14 Pro.
- Komponent `InlineRating` zgodny z ARIA (radiogroup, sterowanie klawiaturą, 44 px targety) osadzony w widoku historii/wyników.
- `FilterToolbar` z przyciskami `aria-pressed`, polami daty i limitem wyników oraz `TTLWarningBadge` z żywym countdownem do wygaśnięcia wpisu historii.
- `PaginationControls` jako opisany `nav` z przyciskami poprzedni/następny oraz scenariusze testowe (FilterToolbar, TTLWarningBadge, PaginationControls, GenerationsHistoryView) w Vitest.
- Endpoint `GET /api/vton/generations` z filtrowaniem i kursorem oraz hook `useGenerationHistory`, które dostarczają realne dane do widoku historii.

### Changed
- Zmodernizowany layout `/generations/new` (gradient, responsywne kolumny, tryb dark) dla zwiększenia czytelności i UX.
- Refaktoryzacja `GenerationForm` – nowy `useGenerationFormController`, integracja z React Hook Form, lżejsze zarządzanie stanem i nowe testy kontrolera.
- Footery akcji onboardingowych i dropzone persony respektują `env(safe-area-inset-bottom)` oraz udostępniają w pełni dostępny przycisk „Wybierz plik”.
- Hook `useCountdown` aktualizuje się płynnie (setTimeout, mniejsza częstotliwość) i zasila `TTLWarningBadge`, poprawiając komunikaty o wygasaniu wyników.
