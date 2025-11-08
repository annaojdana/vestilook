# Mobile Navigation — Business Specification

## Background
- Obecny układ (`src/layouts/Layout.astro`) eksponuje jedynie desktopową nawigację (`<nav class="hidden md:flex …">`), przez co użytkownicy mobilni nie widzą linków do kluczowych ekranów (`/dashboard`, `/generations`) ani nie mają szybkiego kontekstu konta.
- Panel konta (`src/components/layout/UserNavigation.tsx`) obsługuje menu konta w trybie desktop, ale nie pełni roli głównej nawigacji.
- Referencyjny stos technologiczny z `@tech-stack.md` (Astro 5 + React 19 + Tailwind 4 + shadcn/ui) pozostaje obowiązujący i determinuje, jakich bibliotek i idiomów używamy przy nowym komponencie UI.

## Business Objectives
1. Zapewnić jednolite, łatwo dostępne menu głównych ścieżek (dashboard, generacje, profil) na ekranach `< md`, aby zwiększyć retencję użytkowników mobilnych.
2. Zbudować mobilny odpowiednik nawigacji, który może być rozszerzany o kolejne sekcje produktu bez naruszania obecnego układu desktop.
3. Zmniejszyć zagęszczenie elementów w dolnej części widoku mobilnego poprzez zastąpienie klasycznej stopki dedykowanym paskiem nawigacyjnym.

## In Scope
- Dodanie nowego komponentu nawigacji mobilnej w warstwie layoutu (`src/layouts/Layout.astro`) z wykorzystaniem biblioteki shadcn/ui w duchu opisanym w `@tech-stack.md`.
- Re-użycie istniejących informacji o użytkowniku z `UserNavigation` tak, aby mobilne menu respektowało stan zalogowania i nadal korzystało z Supabase session context.
- Wprowadzenie logiki widoczności, która renderuje mobilne menu wyłącznie dla `sm` i `xs`, zachowując bieżącą strukturę desktopową jako ścieżkę szczęścia.
- Definicja docelowych pozycji menu jako referencji do istniejących komponentów widoków (`src/pages/dashboard`*, `src/pages/generations`, `src/pages/profile` lub ich kontenerów React w `src/components/dashboard`, `src/components/generations`, `src/components/profile`).
- Przekierowanie uwagi z klasycznej stopki: w widokach hostowanych przez `Layout.astro` stopka (jeśli jest dodawana w slocie przez komponenty takie jak `src/components/Welcome.astro` lub dedykowany `SiteFooter` po stronie marketingu) ma być ukrywana na `< md` i zastępowana przez mobilny pasek nawigacyjny.

## Out of Scope
- Projektowanie nowych sekcji treści w `main` — zmiany ograniczamy do struktur nawigacyjnych i kontroli widoczności stopki.
- Modyfikacja logiki paneli domenowych (np. `src/components/vton/JobStatusPanel.tsx`, onboardingowe action footers) — te panele muszą się zachowywać identycznie jak dziś.
- Refaktoryzacja globalnego systemu routingu czy middleware.

## Functional Requirements
- **Mobile Entry Point**: `Layout.astro` musi renderować mobilny przełącznik/hub nawigacyjny widoczny pod nagłówkiem lub dokowany do dolnej krawędzi widoku. Powinien oferować szybkie linki do `/dashboard`, `/generations`, `/profile` i CTA związane z generowaniem stylizacji, jeżeli użytkownik ma uprawnienia.
- **Account Context**: Mobilne menu musi komunikować status zalogowania zgodnie z tym, jak robi to `UserNavigation` (inicjały, email). Nie powielamy logiki pobierania danych — komponent ma otrzymać te same propsy lub kontekst.
- **Footer Substitution**: Standardowa stopka (sekcje z linkami i kopiami marketingowymi renderowane za `<slot />` w `Layout.astro`) pozostaje bez zmian dla `md` i wyżej, ale w widoku mobilnym ma otrzymać klasę/stan „ukryj”, aby nie konkurowała z nowym paskiem.
- **State Cohesion**: Gdy mobilne menu jest otwarte, nie może blokować działania obecnych paneli (np. Sheet z `UserNavigation`). Jeśli oba komponenty są aktywne, spec preferuje hierarchię: panel konta ma priorytet, a mobilny pasek powinien zamykać się automatycznie przy otwarciu Sheet.

## Acceptance Criteria
- Na urządzeniu wąskim (`sm` i poniżej) linki do dashboardu i generacji są dostępne bez scrollowania, a stopka marketingowa nie jest widoczna.
- Na urządzeniu `md` i szerszym interfejs wygląda identycznie jak przed zmianą: główne `<nav>` pozostaje widoczne, panel `UserNavigation` zachowuje się bez zmian, stopka powraca.
- Testy manualne potwierdzają brak regresji w panelach (`UserNavigation`, onboarding footers, VTON footers).

## Dependencies & Open Questions
- **Dependencies**: Stos narzędziowy określony w `@tech-stack.md`; istniejące komponenty w `src/components/ui` (Sheet, Button, Avatar) dla zachowania spójności wizualnej.
- **Open Questions**:
  1. Czy mobilny pasek ma być konfigurowalny per-strona (np. różne CTA w `/generations/new`)? Odpowiedź wpłynie na to, czy propsy będą przekazywane z poziomu stron do `Layout.astro`.
  2. Czy klasyczna stopka powinna być całkowicie niewidoczna, czy ma być dostępna po ręcznym rozwinięciu (np. dodatkowy akordeon pod paskiem)?
- **Risks**: Konieczność zsynchronizowania stanów między `UserNavigation` a nowym komponentem; potencjalna kolizja focus management na urządzeniach z czytnikami ekranowymi.

## Implementation Notes — 2025-11-08
- `Layout.astro` ładuje nowy komponent React `MobileNavigation` (`client:load`) i przekazuje `activePath` + `user.email`, dzięki czemu dolny pasek pokazuje linki `/dashboard`, `/generations`, `/profile` oraz CTA do `/generations/new`.
- `MobileNavigation` używa `Sheet`, `Avatar`, `Button` z shadcn/ui, posiada własny panel rozsuwany z kontekstem konta i emituje zdarzenie `layout:mobile-navigation-panel`; `UserNavigation` publikuje `layout:user-navigation-sheet`, co pozwala automatycznie zamykać pasek mobilny gdy priorytet przejmuje panel konta.
- Aby uniknąć konkurencji ze stopką marketingową, dowolny komponent renderujący `<footer>` w slocie layoutu powinien dodać `data-site-footer="true"`. Layout ukrywa takie stopki na `< md`, zachowując pełną widoczność na desktopie.
