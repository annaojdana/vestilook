# Analiza plików w `src/components`

## TOP 5 według liczby linii

1. `src/components/onboarding/persona/usePersonaUploader.ts` – 822 LOC  
   Rozbudowany hook obejmujący walidację, sanityzację, upload i mapowanie błędów persony.
2. `src/components/generations/GenerationForm.tsx` – 485 LOC  
   Monolityczny formularz React z wieloma stanami pochodnymi i efektami synchronizującymi.
3. `src/components/vton/hooks/useGenerationStatus.ts` – 454 LOC  
   Własny mechanizm odpytywania statusu generacji z ręcznym backoffem i podpisywaniem assetów.
4. `src/components/generations/hooks/useGenerationSubmission.ts` – 441 LOC  
   Hook łączący aktualizację zgody, odświeżanie profilu i wysyłkę formularza generacji.
5. `src/components/onboarding/OnboardingConsentPage.tsx` – 375 LOC  
   Strona zgód z wewnętrznym QueryClientem oraz rozbudowaną obsługą błędów i dostępności.

## Kierunki refaktoryzacji

- **`usePersonaUploader`**:  
  - Podziel hook na mniejsze moduły: reduktor stanu UI, `personaValidationService` oraz warstwę transportową (np. `lib/uploads/sendMultipart`).  
  - Rozważ Web Workera do kosztownych operacji (checksumy, sanitizacja), aby nie blokować renderowania React 19.  
  - Przenieś wspólne helpery (`parseValidationErrors`, `formatBytes`) do `src/lib/uploads`, co ułatwi ponowne użycie i testy.

- **`GenerationForm`**:  
  - (zrealizowane) Wydzielono `useGenerationFormController` z reduktorem oraz pierwszym etapem integracji z React Hook Form (`FormProvider`, kontrola pól retencji/zgody).  
  - Kolejne kroki (do wykonania później): dalsze usuwanie efektów per pole i przenoszenie walidacji do resolvera RHF oraz serwisów domenowych.  
  - Wyodrębnij logikę submitu do serwisu domenowego zwracającego wyniki typu `Result`, aby komponent skupiał się na JSX.  
  - Ułatwi to dodanie testów Vitest i zgodność z wzorcem „guard clauses first”.

- **`useGenerationStatus`**:  
  - Przepisz polling w oparciu o TanStack Query (`useQuery` z `refetchInterval`), korzystając z wbudowanego backoffu i anulowania zapytań.  
  - Maper podglądów/metadata przenieś do czystych funkcji w `src/lib/vton`, dzięki czemu hook pozostanie cienką warstwą.  
  - Przyspieszenie dla statusu „processing” można zaimplementować jako dynamiczny `refetchInterval`.

- **`useGenerationSubmission`**:  
  - Rozdziel logikę zgody, profilu i generacji na serwisy (`lib/vton/consent`, `lib/vton/generations`) i użyj TanStack mutations do zarządzania efektami ubocznymi.  
  - Zwracaj ustrukturyzowane obiekty wynikowe zamiast mutować stan wewnątrz hooka, co upraszcza testy i obsługę błędów.

- **`OnboardingConsentPage`**:  
  - Wyniesienie `QueryClientProvider` do układu Astro zapobiegnie wielokrotnym instancjom cache.  
  - Kontroler (`useConsentPageController`) może łączyć logikę przekierowań, toasta i walidacji, a komponent pozostanie prezentacyjny.  
  - Wydzielenie tego ułatwi utrzymanie dostępności (focus management) i testy z React Testing Library.

Dokument bazuje na wymogach z `.ai/tech-stack.md` oraz ogólnych praktykach z sekcji CODING_PRACTICES.
