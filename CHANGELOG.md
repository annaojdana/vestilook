# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Widok `/generations/new` renderujący formularz generacji z obsługą limitów, retencji i ponownej zgody.
- Komponenty UI: `GarmentUploadField`, `ConsentReaffirmation`, `QuotaIndicator`, `RetentionSelector`, `FormAlerts`, `GeneratePrimaryButton` wraz z modułami walidacji (`useGarmentValidation`) i orchestracją wysyłki (`useGenerationSubmission`).
- Zestaw testów Vitest obejmujący walidację plików, orchestrację żądań VTON oraz integracyjny scenariusz `GenerationForm`.
- Dokumentacja PRD/README rozszerzona o wymagania formularza generacji, konfigurację zmiennych środowiskowych i nowe scenariusze E2E.
- Logger klienta (`src/lib/client-logger.ts`) z przełącznikiem `PUBLIC_ENABLE_CLIENT_LOGS` oraz telemetria w `LoginForm` ułatwiająca debugowanie procesu logowania.
- Statyczna strona `/legal/polityka-przetwarzania-wizerunku` wykorzystywana przez ekran zgody, zapewniająca domyślną treść regulaminu przetwarzania wizerunku.
- Złagodzona walidacja persony: minimalna rozdzielczość zdjęcia to teraz 512×512 zamiast 1024×1024, dzięki czemu akceptujemy zdjęcia z większości smartfonów bez dodatkowej obróbki.

### Changed
- Zmodernizowany layout `/generations/new` (gradient, responsywne kolumny, tryb dark) dla zwiększenia czytelności i UX.
- Refaktoryzacja `GenerationForm` – nowy `useGenerationFormController`, integracja z React Hook Form, lżejsze zarządzanie stanem i nowe testy kontrolera.
