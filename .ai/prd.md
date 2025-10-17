# 📘 Dokument Wymagań Produktu (PRD) - Vestilook

## 1. Przegląd produktu

Ten dokument przedstawia wymagania dla **Vestilook**, aplikacji, która wykorzystuje zaawansowane funkcje sztucznej inteligencji do generowania fotorealistycznych wizualizacji wirtualnego przymierzania ubrań.

| **Atrybut** | **Wartość** |
|--------------|-------------|
| **Nazwa Produktu** | Vestilook |
| **Wersja** | Minimum Viable Product (MVP) |
| **Cel** | Umożliwienie użytkownikowi wirtualnego przymierzania ubrań w wysokiej jakości, łącząc zdjęcie osoby ze zdjęciem ubrania. |
| **Kluczowa Technologia** | Google Vertex AI Virtual Try-On (VTON) API |
| **Stack Technologiczny** | Frontend: Astro/React<br>Backend/DB/Auth/Storage: Supabase<br>AI Engine: Google Cloud Platform |
| **Planowany Czas Realizacji MVP** | 6 tygodni |
| **Główna Persona** | Zwykły konsument, bez powiązania z marką, testujący na własnym przykładzie. |

---

## 2. Problem użytkownika

**Problem:**  
Użytkownicy często mają trudności z wizualizacją, jak nowe lub posiadane ubrania będą faktycznie wyglądać na ich sylwetce, zwłaszcza w przypadku zakupów online lub niestandardowych stylizacji. Istniejące rozwiązania wirtualnego przymierzania często oferują niską jakość wizualną lub są ograniczone do katalogów konkretnych sklepów.

**Rozwiązanie Produktowe:**  
Dostarczenie prostej, ale zaawansowanej technicznie platformy, która generuje fotorealistyczne wizualizacje poprzez precyzyjne nałożenie materiału z uwzględnieniem fałd i sylwetki, wykorzystując najnowszą technologię **VTON**.

---

## 3. Wymagania funkcjonalne

### Wymagania podstawowe (Core VTON)
- **FR-001:** System musi implementować logikę wywołującą Google Vertex AI Virtual Try-On API, wykorzystując stałe zdjęcie Persony i tymczasowe zdjęcie ubrania.  
- **FR-002:** System musi zapewnić funkcję pobierania wygenerowanego obrazu w wysokiej jakości (.png lub .jpg), zachowując rozdzielczość równą plikom wejściowym (np. 1024x1024).

### Zarządzanie danymi i przechowywanie
- **FR-003:** System musi przechowywać na stałe tylko jedno zdjęcie bazowe osoby (Persona Bazowa) dla każdego użytkownika, z możliwością jego edycji lub zmiany.  
- **FR-004:** Użytkownik musi mieć możliwość przesłania zdjęcia Persony oraz zdjęcia ubrania wyłącznie przez upload pliku z urządzenia (bez linków ani URL).  
- **FR-005:** Całe przechowywanie danych (zdjęcia Persony, zdjęcia ubrań, wyniki generacji) musi odbywać się w Supabase Storage.  
- **FR-006:** System musi wykorzystywać mechanizm (np. Life Cycle Management w Supabase lub customowy cron job) do automatycznego usuwania zdjęć ubrań i wyników generacji po upływie 2–3 dni od ich utworzenia.

### Interfejs i walidacja
- **FR-007:** Przed pierwszym uploadem zdjęcia Persony i przed każdą generacją system musi wyświetlić obowiązkowy ekran zgody/checkbox akceptujący warunki przetwarzania wizerunku przez Google AI.  
- **FR-008:** Interfejs uploadu musi wymuszać walidację po stronie klienta (frontend) w celu zapewnienia minimalnej rozdzielczości wejściowej (np. 1024x1024 pikseli) oraz akceptowalnych formatów plików (JPEG/PNG).  
- **FR-009:** System musi implementować prostą 5-gwiazdkową skalę ocen, umożliwiającą użytkownikowi ocenę jakości każdej wygenerowanej wizualizacji.

### Kontrola kosztów i bezpieczeństwo
- **FR-010:** System musi zaimplementować twardy, bardzo niski limit darmowych generacji na użytkownika.

---

## 4. Granice produktu

| **W zakresie (In Scope - MVP)** | **Poza zakresem (Out of Scope - MVP)** |
|----------------------------------|----------------------------------------|
| Implementacja podstawowej logiki VTON (jedna generacja). | Obsługa wielu profili Persony (tylko jedna Persona Bazowa). |
| Użycie Supabase jako JEDYNEGO dostawcy Storage/DB/Auth. | Integracja z katalogami sklepów lub pobieranie zdjęć ubrań po URL. |
| Automatyczne czyszczenie zdjęć ubrań i generacji (2–3 dni). | Zaawansowane funkcje edycji zdjęcia Persony (np. kadrowanie). |
| Walidacja inputu (rozdzielczość, format) na froncie. | Zaawansowane zarządzanie autoryzacją GCP (do weryfikacji po PoC). |
| Pobieranie wygenerowanego obrazu. | Obsługa innych modeli AI lub typów przymierzania. |
| Dwukrotna, świadoma zgoda na przetwarzanie wizerunku. | — |

---

## 5. Historyjki użytkowników

Poniższa lista zawiera wszystkie niezbędne historyjki użytkownika i kryteria akceptacji dla fazy MVP.

| **ID** | **Tytuł** | **Opis** | **Kryteria akceptacji** |
|---------|------------|-----------|--------------------------|
| **US-001** | Uwierzytelnianie użytkownika | Jako nowy użytkownik, chcę się zalogować/zarejestrować, aby móc przechowywać moją Personę Bazową. | 1. Użytkownik musi pomyślnie ukończyć proces rejestracji/logowania (Supabase Auth).<br>2. System musi automatycznie generować unikalny identyfikator użytkownika (UID) i go wykorzystywać do segmentacji danych (Supabase Storage). |
| **US-002** | Pierwsza zgoda na wizerunek | Jako nowy użytkownik, chcę zobaczyć i zaakceptować informację o przetwarzaniu mojego wizerunku przez Google AI, zanim prześlę moje zdjęcie. | 1. Przy pierwszym wejściu lub przed pierwszym uploadem Persony wyświetlany jest jasny komunikat o konieczności zgody.<br>2. Nie można przejść do ekranu uploadu Persony bez zaznaczenia checkboxa zgody (FR-007). |
| **US-003** | Ustawienie Persony Bazowej | Jako użytkownik, chcę przesłać (uploadować) moje zdjęcie bazowe, które będzie używane do wszystkich wirtualnych przymiarek. | 1. Zdjęcie jest przesyłane wyłącznie z pliku lokalnego.<br>2. Po pomyślnym przesłaniu i zapisaniu zdjęcia w Supabase Storage, jest ono ustawiane jako aktywna "Persona Bazowa".<br>3. Użytkownik widzi wizualne potwierdzenie (toast + podgląd), że Persona Bazowa jest ustawiona.<br>4. Interfejs pokazuje pasek postępu podczas uploadu oraz blokuje ponowny wybór pliku do czasu zakończenia operacji.<br>5. Niewłaściwy format, rozdzielczość (<1024px) lub rozmiar (>15MB) są odrzucane z komunikatem o błędzie, bez wysyłania żądania do backendu. |
| **US-004** | Zmiana Persony Bazowej | Jako użytkownik, chcę móc zmienić moje bazowe zdjęcie Persony w dowolnym momencie. | 1. Nowe zdjęcie zastępuje poprzednie zdjęcie w Supabase Storage.<br>2. System musi automatycznie oznaczyć i usunąć stare zdjęcie Persony po zaktualizowaniu nowym (lub użyć mechanizmu nadpisywania). |
| **US-005** | Generowanie wizualizacji (sukces) | Jako użytkownik, chcę przesłać zdjęcie ubrania i uruchomić proces VTON, aby otrzymać fotorealistyczny wynik. | 1. Zdjęcie ubrania przechodzi walidację (US-006).<br>2. Użytkownik ponownie klika checkbox zgody przed wywołaniem API (FR-007).<br>3. Po kliknięciu "Generuj", wyświetlany jest szczegółowy stan ładowania.<br>4. System zwraca wygenerowany obraz VTON, który jest tymczasowo przechowywany w Supabase Storage.<br>5. Formularz wymusza wybór retencji (24/48/72 h) i blokuje wysyłkę przy nieaktywnej zgodzie lub przekroczonym limicie.<br>6. Po sukcesie użytkownik otrzymuje komunikat potwierdzający i jest przekierowywany do widoku szczegółowego generacji (`/generations/:id`). |
| **US-006** | Walidacja inputu (niepowodzenie) | Jako użytkownik, chcę zostać poinformowany na froncie o zbyt małej rozdzielczości lub nieobsługiwanym formacie pliku. | 1. Jeśli przesłane zdjęcie nie spełnia kryterium 1024x1024 lub nie jest JPEG/PNG, system natychmiast wyświetla komunikat o błędzie na froncie.<br>2. Wywołanie API VTON jest blokowane, jeśli walidacja nie powiedzie się, oszczędzając koszty (FR-008). |
| **US-007** | Przekroczenie limitu | Jako użytkownik, chcę wiedzieć, że osiągnąłem limit darmowych generacji, aby uniknąć nieoczekiwanych opłat. | 1. Przed kliknięciem "Generuj", interfejs wyświetla liczbę pozostałych generacji (lub komunikat o braku generacji).<br>2. Po osiągnięciu limitu, przycisk "Generuj" jest nieaktywny, a użytkownik widzi komunikat o braku dostępnych darmowych generacji (FR-010).<br>3. Wskaźnik limitu informuje o czasie odnowienia i proponuje dalsze kroki (np. kontakt z zespołem Vestilook). |
| **US-008** | Pobieranie wyniku | Jako użytkownik, chcę pobrać wygenerowaną wizualizację na moje urządzenie w wysokiej jakości. | 1. Po wyświetleniu wyniku generacji, przycisk "Pobierz" jest aktywowany.<br>2. Pobierany plik ma jakość i rozdzielczość zgodną z FR-002. |
| **US-009** | Ocena jakości | Jako użytkownik, chcę opcjonalnie ocenić jakość wizualizacji w celu wsparcia ulepszania modelu. | 1. Użytkownik może kliknąć jedną z 5 gwiazdek po obejrzeniu wygenerowanego obrazu.<br>2. Ocena jest zapisywana w Supabase DB wraz z identyfikatorem generacji, ale nie jest obowiązkowa (FR-009). |
| **US-010** | Czyszczenie plików tymczasowych | Jako system, chcę automatycznie usuwać wszystkie zdjęcia ubrań i wygenerowane obrazy po 2–3 dniach, aby chronić prywatność i oszczędzać miejsce. | 1. Zdjęcia Persony (US-003) są wykluczone z mechanizmu czyszczenia.<br>2. Wszystkie pliki ubrań i generacji otrzymują znacznik czasu.<br>3. Systematycznie (co najmniej raz dziennie) uruchamiany jest mechanizm (funkcja Supabase lub skrypt), który trwale usuwa pliki starsze niż 3 dni (FR-006). |

---

## 6. Metryki sukcesu

| **Kryterium** | **Miernik** | **Cel dla Fazy Testów** |
|----------------|-------------|--------------------------|
| **Jakość Generacji (Wartość)** | Średnia ocena z 5-gwiazdkowej skali (US-009). | Utrzymanie średniej oceny na poziomie >=4.0 w testach wewnętrznych. |
| **Stabilność Integracji** | Wskaźnik udanych generacji / prób generacji (Conversion Rate). | >=90% wskaźnika konwersji (udane generacje). |
| **Kontrola Kosztów** | Koszt Jednostkowy Generacji (CPG) na użytkownika. | Utrzymanie CPG na poziomie umożliwiającym dotrzymanie budżetu i osobistej kontroli. |
| **Użyteczność** | Procent użytkowników, którzy ukończyli cykl: Upload Persony → Upload Ubrania → Generacja → Download. | 100% użytkowników w 5-osobowym teście korytarzowym musi pomyślnie ukończyć pełny cykl. |

---

## 7. Nierozwiązane kwestie i ryzyka architektoniczne

- **Integracja Storage (Supabase vs. GCS dla VTON):**  
  Konieczność weryfikacji technicznej, czy Google Vertex AI VTON API jest w stanie przyjmować pliki wejściowe (Persony i Ubrania) bezpośrednio z Supabase Storage (URI/Base64) bez konieczności uprzedniego buforowania ich w Google Cloud Storage (GCS).  
  Jest to kluczowy, nierozwiązany problem architektoniczny dla implementacji VTON.

- **Konkretny próg oceny jakości:**  
  Wymagane jest ustalenie twardego progu sukcesu (np. „4.2 z 5”) dla fazy testów, bazując na pierwszych generacjach wewnętrznych, aby precyzyjniej mierzyć cel jakości.

---

## 8. Scenariusze testów E2E — Zgoda onboardingowa

- **Akceptacja zgody (happy path):** Użytkownik z aktywną sesją przechodzi na `/onboarding/consent`, otrzymuje najnowszą treść polityki, zaznacza checkbox i zostaje przekierowany do `/onboarding/persona`. Walidacja: request POST z poprawną wersją, redirect + toast potwierdzający.
- **Wymuszenie aktualizacji polityki:** Użytkownik z zaakceptowaną starszą wersją otrzymuje komunikat o aktualizacji, ponownie zaznacza checkbox; backend zwraca `409`, front wykonuje refetch i po ponownej akceptacji przechodzi dalej.
- **Wygaśnięta sesja:** Backend zwraca `401`, aplikacja wylogowuje użytkownika i przenosi do `/login`; weryfikujemy komunikat toast oraz brak możliwości interakcji z formularzem.

## 9. Scenariusze testów E2E — Generowanie stylizacji

- **Happy path:** Użytkownik z aktywną personą odwiedza `/generations/new`, widzi swoje pozostałe generacje, przesyła poprawny plik .png, zaznacza zgodę, wybiera retencję 48h i otrzymuje komunikat o zakolejkowaniu wraz z przekierowaniem do `/generations/:id`.
- **Walidacja pliku:** Przesłany plik .jpg o rozdzielczości 800×800 powoduje natychmiastowy alert o zbyt małej rozdzielczości, formularz pozostaje zablokowany.
- **Odnowienie zgody:** Użytkownik z nieaktualną wersją polityki zaznacza checkbox, formularz automatycznie wysyła `POST /api/profile/consent` przed generacją, a po sukcesie znika ostrzeżenie o konieczności aktualizacji.
- **Limit quota:** Użytkownik z wyczerpanym limitem widzi alert blokujący przycisk „Generuj” oraz informację o czasie odnowienia.
- **Błąd serwera:** Symulowany błąd 429 z `Retry-After` prezentuje komunikat z czasem oczekiwania i zachowaniem poprzednich danych formularza, umożliwiając ponowną próbę po odświeżeniu limitu.
