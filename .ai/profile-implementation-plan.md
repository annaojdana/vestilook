# API Endpoint Implementation Plan: GET /api/profile

## 1. Przegląd punktu końcowego
Punkt końcowy zwraca komplet informacji o profilu uwierzytelnionego użytkownika (stan persony, zgody, quota i cache odzieży), opierając się na danych z tabeli `profiles` w Supabase. W przypadku braku rekordu służy jako sygnał inicjalizacji profilu.

## 2. Szczegóły żądania
- Metoda HTTP: `GET`
- Struktura URL: `/api/profile`
- Parametry:
  - Wymagane: brak
  - Opcjonalne: brak
- Nagłówki: `Authorization: Bearer <supabase_access_token>` (lub sesja cookie Supabase)
- Request Body: brak

## 3. Wykorzystywane typy
- `ProfileRow` oraz powiązane aliasy z `src/types.ts`
- DTO wyjściowy: `ProfileResponseDto`
- Struktury wspierające mapowanie: `PersonaAssetMetadata | null`, `ConsentStateSnapshot`, `FreeQuotaSnapshot`, `ClothCacheDescriptor`
- Ewentualne typy usługowe: `SupabaseClient` (z `src/db`), typ loggera używanego globalnie

## 4. Szczegóły odpowiedzi
- Statusy sukcesu:
  - `200 OK` – rekord profilu istnieje; payload zgodny z `ProfileResponseDto`
  - `204 No Content` – profil nie został jeszcze utworzony
- Struktura `200`:
  ```json
  {
    "userId": "uuid",
    "persona": { ... } | null,
    "consent": { ... },
    "quota": {
      "free": {
        "total": number,
        "used": number,
        "remaining": number,
        "renewsAt": "ISO"
      }
    },
    "clothCache": {
      "path": "string|null",
      "expiresAt": "ISO|null"
    }
  }
  ```

## 5. Przepływ danych
1. Middleware uwierzytelniające Supabase dostarcza `userId` oraz klienta serwerowego (`serverSupabaseClient`).
2. Handler `GET /api/profile` odpyta serwis `profileService.getProfile(userId)` (nowy moduł `src/lib/profile-service.ts` lub rozszerzenie istniejącego).
3. Serwis wykona zapytanie `profiles` ograniczone do `user_id`.
4. W przypadku braku rekordu handler zwróci `204`.
5. Przy obecnym rekordzie serwis zmapuje wiersz na `ProfileResponseDto`, obliczając `remaining = max(total - used, 0)` i budując metadane persony (warunkowo).
6. Odpowiedź jest zwracana jako JSON po walidacji schematu (np. przy użyciu Zod lub własnych strażników typów).
7. Ewentualne błędy logowane przez serwis i przekazywane handlerowi.

## 6. Względy bezpieczeństwa
- Wymuszona autoryzacja: brak dostępu bez ważnej sesji Supabase → zwrot `401`.
- RLS na tabeli `profiles` musi gwarantować dostęp wyłącznie właścicielowi (`auth.uid() = user_id`); w przypadku odrzucenia przekazać `403`.
- Odpowiedź nie powinna ujawniać ścieżek storage innych niż użytkownika; serwis nie wykonuje dodatkowych zapytań po innych użytkownikach.
- Walidacja danych wejściowych przyjmie tylko `userId` z sesji, eliminując możliwość enumeracji.
- Dane timestamp oraz ścieżki należy traktować jako nieedytowalne – brak wstrzykiwania SQL (Supabase query builder).
- Dodaj ochronę przed cache'owaniem po stronie przeglądarki (nagłówki `Cache-Control: private, max-age=0`) jeżeli to wymagane polityką prywatności.

## 7. Obsługa błędów
- `401 Unauthorized`: brak sesji lub nieprawidłowy token (wychwycony przez middleware).
- `403 Forbidden`: RLS odrzuca zapytanie; loguj `warning` i identyfikator żądania.
- `500 Internal Server Error`: błąd Supabase, serializacji lub mapowania; loguj `error` z pełnym kontekstem (`userId`, nazwa operacji, oryginalny komunikat) i integruj z tabelą logów, jeżeli istnieje (`error_logs`).
- Dodatkowe walidacje: gdy `free_generation_used > free_generation_quota`, loguj ostrzeżenie i ogranicz `remaining` do zera, ale nadal zwracaj `200`.
- Wyjątki nieobsłużone: złapane i zamienione na `500` z bezpiecznym komunikatem.

## 8. Rozważania dotyczące wydajności
- Zapytanie `profiles` korzysta z klucza głównego (`user_id`); zapewnia O(1) dostęp – brak potrzeby dodatkowych indeksów.
- Unikaj dodatkowych round-tripów do storage; metadane persony odczytuj tylko z tabeli (bez pobierania obrazu).
- Reużywaj instancji Supabase klienta w ramach requestu.
- Monitoruj rozmiar odpowiedzi (kilka KB); nie wykonywać JSON serialization na duże binaria.
- Dodaj metryki czasu odpowiedzi/logowanie (np. instrumentation hook) aby obserwować ewentualne anomalie.

## 9. Etapy wdrożenia
1. Utworzyć/rozszerzyć moduł `src/lib/profile-service.ts` z funkcją `getProfile(userId, supabase)` obejmującą zapytanie, mapowanie DTO i logowanie.
2. Zaimplementować handler Astro w `src/pages/api/profile.ts` (lub odpowiedniki) wykorzystujący middleware autoryzacyjne, serwis oraz odpowiednie kody statusu `200/204`.
3. Dodać walidację i sanity checks (np. Zod schema lub manualne guardy) dla danych zwracanych przez bazę.
4. Zintegrować logger (np. `src/lib/logger`) do rejestrowania błędów i ostrzeżeń; jeżeli istnieje tabela błędów – dopisać zapis rekordów.
5. Dodać testy jednostkowe serwisu (mock Supabase) oraz testy integracyjne endpointu (np. Vitest + supertest) obejmujące scenariusze `200`, `204`, `401`, `403`, `500`.
6. Uaktualnić dokumentację: `.ai/view-implementation-plan.md` (bieżący plik), `.ai/prd.md` lub README/CHANGELOG jeśli wymagane.
7. Zweryfikować endpoint lokalnie (curl/httpie) i przygotować do wdrożenia (np. dodanie do CI pipeline).
