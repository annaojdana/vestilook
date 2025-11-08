# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Widok `/generations/new` renderujący formularz generacji z obsługą limitów, retencji i ponownej zgody.
- Komponenty UI: `GarmentUploadField`, `ConsentReaffirmation`, `QuotaIndicator`, `RetentionSelector`, `FormAlerts`, `GeneratePrimaryButton` wraz z modułami walidacji (`useGarmentValidation`) i orchestracją wysyłki (`useGenerationSubmission`).
- Zestaw testów Vitest obejmujący walidację plików, orchestrację żądań VTON oraz integracyjny scenariusz `GenerationForm`.
- Dokumentacja PRD/README rozszerzona o wymagania formularza generacji, konfigurację zmiennych środowiskowych i nowe scenariusze E2E.
- Logger klienta (`src/lib/client-logger.ts`) z przełącznikiem `PUBLIC_ENABLE_CLIENT_LOGS` oraz telemetria w `LoginForm` ułatwiająca debugowanie procesu logowania.

### Changed
- Zmodernizowany layout `/generations/new` (gradient, responsywne kolumny, tryb dark) dla zwiększenia czytelności i UX.
- Refaktoryzacja `GenerationForm` – nowy `useGenerationFormController`, integracja z React Hook Form, lżejsze zarządzanie stanem i nowe testy kontrolera.
