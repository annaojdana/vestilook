# Specyfikacja Techniczna – Moduł Autentykacji Vestilook

## Informacje ogólne

**Wersja dokumentu:** 1.1
**Data ostatniej aktualizacji:** 2025-11-05
**Zakres:** Rejestracja, logowanie, wylogowanie i odzyskiwanie hasła użytkowników
**Stack:** Astro 5 (SSR), React 19, TypeScript 5, Supabase Auth

---

## ⚠️ KLUCZOWE ZMIANY WZGLĘDEM WERSJI 1.0

**Data reconciliacji z PRD:** 2025-11-05

### Zmiany wprowadzone po analizie zgodności z PRD:

1. **Email Confirmation: WYŁĄCZONE**
   - **Poprzednio:** Wymagane potwierdzenie emaila po rejestracji
   - **Obecnie:** Użytkownik może korzystać z aplikacji natychmiast po rejestracji
   - **Uzasadnienie:** PRD (US-001) nie wymienia weryfikacji emaila. Priorytet: szybki onboarding bez dodatkowych kroków

2. **Flow rejestracji uproszczony**
   - **Usunięto:** Kroki wysyłania emaila weryfikacyjnego i klikania linku
   - **Dodano:** Natychmiastowe utworzenie sesji po pomyślnej rejestracji

3. **Komunikaty użytkownika zaktualizowane**
   - Usunięto wzmianki o "sprawdzeniu skrzynki email"
   - Dodano komunikat: "Konto utworzone pomyślnie! Witamy w Vestilook."

### Co jest W ZAKRESIE tego dokumentu:
- ✅ Rejestracja użytkownika (email + hasło)
- ✅ Logowanie użytkownika
- ✅ Wylogowanie
- ✅ Resetowanie hasła (przez email)
- ✅ Zarządzanie sesją (JWT tokens)
- ✅ Middleware ochrony ścieżek
- ✅ Trigger bazy danych dla profili użytkowników
- ✅ Inicjalizacja quota darmowych generacji

### Co jest POZA ZAKRESEM tego dokumentu:
- ❌ System zgody (consent) - opisany w osobnej specyfikacji
- ❌ Upload i zarządzanie Personą Bazową
- ❌ Generowanie wizualizacji VTON
- ❌ Walidacja i przetwarzanie obrazów
- ❌ System oceny jakości
- ❌ Zarządzanie plikami tymczasowymi (lifecycle management)

**Te funkcje są pokryte w innych specyfikacjach technicznych lub w PRD.**

---

## 1. ARCHITEKTURA INTERFEJSU UŻYTKOWNIKA

### 1.1. Nowe strony Astro

#### 1.1.1. `/src/pages/auth/login.astro`

**Opis:**
Strona logowania dla istniejących użytkowników. Renderowana server-side z renderem hydrated React component dla formularza.

**Odpowiedzialność:**
- Renderowanie layoutu strony logowania
- Osadzenie komponentu `<LoginForm />`
- Obsługa query parameters: `?redirect=/path` – ścieżka powrotu po zalogowaniu
- Obsługa query parameters: `?error=message` – komunikat błędu z Supabase email confirmation
- Metadata SEO i canonical URL

**Props przekazywane do komponentów React:**
- `redirectTo?: string` – ścieżka docelowa po udanym logowaniu (domyślnie: `/onboarding/consent`)
- `errorMessage?: string` – komunikat błędu do wyświetlenia przy ładowaniu strony

**Struktura:**
```astro
---
import AuthLayout from "../../layouts/AuthLayout.astro";
import { LoginForm } from "../../components/auth/LoginForm.tsx";

const canonical = Astro.site ? new URL(Astro.url.pathname, Astro.site).href : undefined;
const redirectTo = Astro.url.searchParams.get('redirect') ?? '/onboarding/consent';
const errorMessage = Astro.url.searchParams.get('error') ?? undefined;
---

<AuthLayout
  title="Vestilook — Logowanie"
  description="Zaloguj się do swojego konta Vestilook."
  canonical={canonical}
>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-accent/30 via-transparent to-primary/10 px-6 py-12">
    <LoginForm client:load redirectTo={redirectTo} errorMessage={errorMessage} />
  </div>
</AuthLayout>
```

**Nawigacja:**
- Link do `/auth/register` – "Nie masz jeszcze konta? Zarejestruj się"
- Link do `/auth/reset-password` – "Zapomniałeś hasła?"

---

#### 1.1.2. `/src/pages/auth/register.astro`

**Opis:**
Strona rejestracji nowych użytkowników z email + hasło.

**Odpowiedzialność:**
- Renderowanie layoutu strony rejestracji
- Osadzenie komponentu `<RegisterForm />`
- Obsługa query parameters: `?redirect=/path`
- Metadata SEO i canonical URL

**Props przekazywane do komponentów React:**
- `redirectTo?: string` – domyślnie: `/onboarding/consent`

**Struktura:**
```astro
---
import AuthLayout from "../../layouts/AuthLayout.astro";
import { RegisterForm } from "../../components/auth/RegisterForm.tsx";

const canonical = Astro.site ? new URL(Astro.url.pathname, Astro.site).href : undefined;
const redirectTo = Astro.url.searchParams.get('redirect') ?? '/onboarding/consent';
---

<AuthLayout
  title="Vestilook — Rejestracja"
  description="Stwórz nowe konto w Vestilook."
  canonical={canonical}
>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-accent/30 via-transparent to-primary/10 px-6 py-12">
    <RegisterForm client:load redirectTo={redirectTo} />
  </div>
</AuthLayout>
```

**Nawigacja:**
- Link do `/auth/login` – "Masz już konto? Zaloguj się"

---

#### 1.1.3. `/src/pages/auth/reset-password.astro`

**Opis:**
Strona inicjująca proces odzyskiwania hasła – użytkownik podaje email.

**Odpowiedzialność:**
- Renderowanie layoutu strony resetowania hasła
- Osadzenie komponentu `<ResetPasswordRequestForm />`
- Metadata SEO i canonical URL

**Props przekazywane do komponentów React:**
- Brak (komponent obsługuje stan lokalnie)

**Struktura:**
```astro
---
import AuthLayout from "../../layouts/AuthLayout.astro";
import { ResetPasswordRequestForm } from "../../components/auth/ResetPasswordRequestForm.tsx";

const canonical = Astro.site ? new URL(Astro.url.pathname, Astro.site).href : undefined;
---

<AuthLayout
  title="Vestilook — Resetowanie hasła"
  description="Zresetuj hasło do swojego konta Vestilook."
  canonical={canonical}
>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-accent/30 via-transparent to-primary/10 px-6 py-12">
    <ResetPasswordRequestForm client:load />
  </div>
</AuthLayout>
```

**Nawigacja:**
- Link do `/auth/login` – "Powrót do logowania"

---

#### 1.1.4. `/src/pages/auth/update-password.astro`

**Opis:**
Strona ustawiania nowego hasła – użytkownik trafia tu z linku email (magic link z Supabase).

**Odpowiedzialność:**
- Renderowanie layoutu strony aktualizacji hasła
- Osadzenie komponentu `<UpdatePasswordForm />`
- Walidacja obecności tokenu recovery w URL (przez Supabase Auth helper)
- Metadata SEO i canonical URL

**Props przekazywane do komponentów React:**
- Brak (token jest obsługiwany przez Supabase)

**Struktura:**
```astro
---
import AuthLayout from "../../layouts/AuthLayout.astro";
import { UpdatePasswordForm } from "../../components/auth/UpdatePasswordForm.tsx";

const canonical = Astro.site ? new URL(Astro.url.pathname, Astro.site).href : undefined;
---

<AuthLayout
  title="Vestilook — Ustaw nowe hasło"
  description="Ustaw nowe hasło dla swojego konta Vestilook."
  canonical={canonical}
>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-accent/30 via-transparent to-primary/10 px-6 py-12">
    <UpdatePasswordForm client:load />
  </div>
</AuthLayout>
```

---

### 1.2. Nowy layout Astro

#### 1.2.1. `/src/layouts/AuthLayout.astro`

**Opis:**
Dedykowany layout dla stron autentykacji, uproszczony (bez nawigacji), z centrum na formularzu.

**Odpowiedzialność:**
- Renderowanie HTML boilerplate
- Wczytanie globalnych stylów
- SEO meta tags
- Logo Vestilook (opcjonalnie na górze)

**Props:**
- `title: string` – tytuł strony
- `description: string` – meta description
- `canonical?: string` – canonical URL

**Struktura:**
```astro
---
import "../styles/global.css";

interface Props {
  title: string;
  description: string;
  canonical?: string;
}

const { title, description, canonical } = Astro.props;
---

<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    {canonical && <link rel="canonical" href={canonical} />}
    <link rel="icon" type="image/png" href="/favicon.png" />
    <meta name="generator" content={Astro.generator} />
    <title>{title}</title>
  </head>
  <body class="antialiased">
    <slot />
  </body>
</html>
```

---

### 1.3. Nowe komponenty React (client-side)

#### 1.3.1. `<LoginForm />`

**Lokalizacja:** `/src/components/auth/LoginForm.tsx`

**Opis:**
Formularz logowania z polami email i hasło, wykorzystujący Supabase Auth `signInWithPassword`.

**Props:**
```typescript
interface LoginFormProps {
  redirectTo?: string;
  errorMessage?: string;
}
```

**Stan wewnętrzny:**
```typescript
interface LoginFormState {
  email: string;
  password: string;
  isSubmitting: boolean;
  error: string | null;
}
```

**Walidacja:**
- Email: format email (regex), wymagane pole
- Hasło: min. 6 znaków, wymagane pole

**Komunikaty błędów:**
- `"Nieprawidłowy format adresu email"` – błąd walidacji email
- `"Hasło musi mieć co najmniej 6 znaków"` – błąd walidacji hasła
- `"Nieprawidłowy email lub hasło"` – błąd 400/401 z Supabase
- `"Sesja wygasła. Zaloguj się ponownie."` – błąd przekazany przez `errorMessage` prop
- `"Wystąpił problem z połączeniem. Spróbuj ponownie."` – błąd sieciowy

**Scenariusze:**
1. **Happy path:**
   - Użytkownik wypełnia email i hasło
   - Kliknięcie "Zaloguj się"
   - `supabaseClient.auth.signInWithPassword({ email, password })`
   - Sukces → zapisanie sesji w localStorage przez Supabase
   - Toast sukcesu: "Zalogowano pomyślnie"
   - Redirect na `redirectTo` path (domyślnie `/onboarding/consent`)

2. **Błędne dane:**
   - Supabase zwraca błąd 400/401
   - Wyświetlenie komunikatu "Nieprawidłowy email lub hasło"
   - Focus na polu email

3. **Błąd sieci:**
   - Catch exception
   - Wyświetlenie komunikatu o problemie z połączeniem
   - Przycisk pozostaje aktywny

**Użycie React Hook Form + Zod:**
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Nieprawidłowy format adresu email'),
  password: z.string().min(6, 'Hasło musi mieć co najmniej 6 znaków'),
});

type LoginFormValues = z.infer<typeof loginSchema>;
```

**Struktura UI:**
- Karta (`<Card />` z shadcn/ui)
- Nagłówek: "Zaloguj się do Vestilook"
- Pole `<Input />` dla email (type="email", autocomplete="email")
- Pole `<Input />` dla hasła (type="password", autocomplete="current-password")
- Przycisk `<Button />` – "Zaloguj się" (disabled podczas submitu, z loaderem)
- Link do `/auth/reset-password` – "Zapomniałeś hasła?"
- Link do `/auth/register` – "Nie masz jeszcze konta? Zarejestruj się"
- `<Alert />` dla komunikatów błędów (wariant `destructive`)

**Integracja z Supabase:**
```typescript
import { supabaseClient } from '@/db/supabase.client';

const onSubmit = async (values: LoginFormValues) => {
  setIsSubmitting(true);
  setError(null);

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: values.email,
    password: values.password,
  });

  if (error) {
    setError('Nieprawidłowy email lub hasło');
    setIsSubmitting(false);
    return;
  }

  if (data?.session) {
    toast.success('Zalogowano pomyślnie');
    window.location.href = redirectTo;
  }
};
```

---

#### 1.3.2. `<RegisterForm />`

**Lokalizacja:** `/src/components/auth/RegisterForm.tsx`

**Opis:**
Formularz rejestracji z polami: email, hasło, potwierdzenie hasła. Wykorzystuje `signUp` z Supabase Auth.

**Props:**
```typescript
interface RegisterFormProps {
  redirectTo?: string;
}
```

**Stan wewnętrzny:**
```typescript
interface RegisterFormState {
  email: string;
  password: string;
  confirmPassword: string;
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
}
```

**Walidacja:**
- Email: format email (regex), wymagane pole
- Hasło: min. 8 znaków, musi zawierać wielką literę, małą literę i cyfrę, wymagane pole
- Potwierdzenie hasła: musi być identyczne z hasłem, wymagane pole

**Komunikaty błędów:**
- `"Nieprawidłowy format adresu email"` – błąd walidacji email
- `"Hasło musi mieć co najmniej 8 znaków i zawierać wielką literę, małą literę oraz cyfrę"` – błąd walidacji hasła
- `"Hasła muszą być identyczne"` – błąd walidacji confirmPassword
- `"Ten adres email jest już zarejestrowany"` – błąd 400 z Supabase (user already exists)
- `"Wystąpił problem z rejestracją. Spróbuj ponownie."` – błąd ogólny

**Komunikat sukcesu:**
```
"Konto utworzone pomyślnie! Witamy w Vestilook."
```
**UWAGA:** Usunięto wzmiankę o weryfikacji emaila, zgodnie z konfiguracją bez email confirmation.

**Scenariusze:**
1. **Happy path (bez email confirmation - zgodnie z PRD):**
   - Użytkownik wypełnia email, hasło, powtórzenie hasła
   - Kliknięcie "Zarejestruj się"
   - `supabaseClient.auth.signUp({ email, password })`
   - Sukces → Supabase automatycznie tworzy sesję (bez wymagania potwierdzenia emaila)
   - Toast sukcesu: "Konto utworzone pomyślnie!"
   - Automatyczny redirect na `redirectTo` (domyślnie `/onboarding/consent`)
   - **UWAGA:** Email confirmation jest WYŁĄCZONE zgodnie z PRD, aby przyspieszyć onboarding

2. **Email już istnieje:**
   - Supabase zwraca błąd `"User already registered"`
   - Wyświetlenie komunikatu: "Ten adres email jest już zarejestrowany"
   - Link do `/auth/login` – "Masz już konto? Zaloguj się"

3. **Błąd walidacji:**
   - React Hook Form wyświetla błędy pod odpowiednimi polami
   - Przycisk pozostaje aktywny po poprawie

**Użycie React Hook Form + Zod:**
```typescript
const registerSchema = z.object({
  email: z.string().email('Nieprawidłowy format adresu email'),
  password: z
    .string()
    .min(8, 'Hasło musi mieć co najmniej 8 znaków')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Hasło musi zawierać wielką literę, małą literę oraz cyfrę'
    ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Hasła muszą być identyczne',
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;
```

**Struktura UI:**
- Karta (`<Card />`)
- Nagłówek: "Stwórz nowe konto"
- Pole `<Input />` dla email (type="email", autocomplete="email")
- Pole `<Input />` dla hasła (type="password", autocomplete="new-password")
- Pole `<Input />` dla potwierdzenia hasła (type="password", autocomplete="new-password")
- Wskaźnik siły hasła (opcjonalnie, progres bar)
- Przycisk `<Button />` – "Zarejestruj się" (disabled podczas submitu, z loaderem)
- Link do `/auth/login` – "Masz już konto? Zaloguj się"
- `<Alert />` dla komunikatów błędów i sukcesu

**Integracja z Supabase:**
```typescript
const onSubmit = async (values: RegisterFormValues) => {
  setIsSubmitting(true);
  setError(null);

  const { data, error } = await supabaseClient.auth.signUp({
    email: values.email,
    password: values.password,
    // UWAGA: Bez emailRedirectTo, ponieważ email confirmation jest WYŁĄCZONE
  });

  if (error) {
    // Obsługa błędu - sprawdź czy użytkownik już istnieje
    if (error.message.includes('already registered')) {
      setError('Ten adres email jest już zarejestrowany');
    } else {
      setError('Wystąpił problem z rejestracją. Spróbuj ponownie.');
    }
    setIsSubmitting(false);
    return;
  }

  // Sukces - użytkownik jest od razu zalogowany (sesja utworzona automatycznie)
  if (data?.session) {
    toast.success('Konto utworzone pomyślnie! Witamy w Vestilook.');
    // Redirect na onboarding
    window.location.href = redirectTo;
  }
};
```

---

#### 1.3.3. `<ResetPasswordRequestForm />`

**Lokalizacja:** `/src/components/auth/ResetPasswordRequestForm.tsx`

**Opis:**
Formularz żądania resetu hasła – użytkownik podaje email, Supabase wysyła link z tokenem recovery.

**Props:**
- Brak

**Stan wewnętrzny:**
```typescript
interface ResetPasswordRequestFormState {
  email: string;
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
}
```

**Walidacja:**
- Email: format email (regex), wymagane pole

**Komunikaty błędów:**
- `"Nieprawidłowy format adresu email"` – błąd walidacji
- `"Wystąpił problem. Spróbuj ponownie."` – błąd ogólny

**Komunikat sukcesu:**
```
"Link do resetowania hasła został wysłany na adres {email}. Sprawdź swoją skrzynkę pocztową."
```

**Scenariusze:**
1. **Happy path:**
   - Użytkownik wpisuje email
   - Kliknięcie "Wyślij link"
   - `supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/auth/update-password' })`
   - Sukces → wyświetlenie komunikatu sukcesu
   - Formularz zostaje ukryty, pokazuje się instrukcja

2. **Email nie istnieje:**
   - Supabase z zasady zwraca sukces (dla bezpieczeństwa)
   - Wyświetl zawsze komunikat sukcesu

**Użycie React Hook Form + Zod:**
```typescript
const resetPasswordRequestSchema = z.object({
  email: z.string().email('Nieprawidłowy format adresu email'),
});

type ResetPasswordRequestFormValues = z.infer<typeof resetPasswordRequestSchema>;
```

**Struktura UI:**
- Karta (`<Card />`)
- Nagłówek: "Resetowanie hasła"
- Opis: "Podaj adres email powiązany z Twoim kontem. Wyślemy Ci link do resetowania hasła."
- Pole `<Input />` dla email (type="email", autocomplete="email")
- Przycisk `<Button />` – "Wyślij link" (disabled podczas submitu, z loaderem)
- Link do `/auth/login` – "Powrót do logowania"
- `<Alert />` dla komunikatów błędów i sukcesu

**Integracja z Supabase:**
```typescript
const onSubmit = async (values: ResetPasswordRequestFormValues) => {
  setIsSubmitting(true);
  setError(null);

  const { error } = await supabaseClient.auth.resetPasswordForEmail(values.email, {
    redirectTo: `${window.location.origin}/auth/update-password`,
  });

  if (error) {
    setError('Wystąpił problem. Spróbuj ponownie.');
    setIsSubmitting(false);
    return;
  }

  setSuccessMessage(
    `Link do resetowania hasła został wysłany na adres ${values.email}. Sprawdź swoją skrzynkę pocztową.`
  );
  setIsSubmitting(false);
};
```

---

#### 1.3.4. `<UpdatePasswordForm />`

**Lokalizacja:** `/src/components/auth/UpdatePasswordForm.tsx`

**Opis:**
Formularz ustawiania nowego hasła – użytkownik trafia tu po kliknięciu w link z emaila. Token recovery jest automatycznie obsługiwany przez Supabase.

**Props:**
- Brak

**Stan wewnętrzny:**
```typescript
interface UpdatePasswordFormState {
  password: string;
  confirmPassword: string;
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
}
```

**Walidacja:**
- Hasło: min. 8 znaków, musi zawierać wielką literę, małą literę i cyfrę, wymagane pole
- Potwierdzenie hasła: musi być identyczne z hasłem, wymagane pole

**Komunikaty błędów:**
- `"Hasło musi mieć co najmniej 8 znaków i zawierać wielką literę, małą literę oraz cyfrę"` – błąd walidacji
- `"Hasła muszą być identyczne"` – błąd walidacji confirmPassword
- `"Link wygasł lub jest nieprawidłowy. Zażądaj nowego linku do resetowania hasła."` – błąd z Supabase (token invalid/expired)
- `"Wystąpił problem. Spróbuj ponownie."` – błąd ogólny

**Komunikat sukcesu:**
```
"Hasło zostało zmienione pomyślnie! Za chwilę zostaniesz przekierowany do panelu."
```

**Scenariusze:**
1. **Happy path:**
   - Użytkownik trafia na stronę z tokenem w URL (automatycznie obsłużony przez Supabase)
   - Wpisuje nowe hasło i potwierdzenie
   - Kliknięcie "Zmień hasło"
   - `supabaseClient.auth.updateUser({ password: newPassword })`
   - Sukces → wyświetlenie komunikatu sukcesu
   - Redirect na `/onboarding/consent` po 2 sekundach

2. **Token wygasł:**
   - `updateUser` zwraca błąd
   - Wyświetlenie komunikatu o wygasłym linku
   - Link do `/auth/reset-password` – "Zażądaj nowego linku"

**Użycie React Hook Form + Zod:**
```typescript
const updatePasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Hasło musi mieć co najmniej 8 znaków')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Hasło musi zawierać wielką literę, małą literę oraz cyfrę'
    ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Hasła muszą być identyczne',
  path: ['confirmPassword'],
});

type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>;
```

**Struktura UI:**
- Karta (`<Card />`)
- Nagłówek: "Ustaw nowe hasło"
- Pole `<Input />` dla hasła (type="password", autocomplete="new-password")
- Pole `<Input />` dla potwierdzenia hasła (type="password", autocomplete="new-password")
- Wskaźnik siły hasła (opcjonalnie, progres bar)
- Przycisk `<Button />` – "Zmień hasło" (disabled podczas submitu, z loaderem)
- `<Alert />` dla komunikatów błędów i sukcesu

**Integracja z Supabase:**
```typescript
const onSubmit = async (values: UpdatePasswordFormValues) => {
  setIsSubmitting(true);
  setError(null);

  const { error } = await supabaseClient.auth.updateUser({
    password: values.password,
  });

  if (error) {
    if (error.message.includes('expired') || error.message.includes('invalid')) {
      setError('Link wygasł lub jest nieprawidłowy. Zażądaj nowego linku do resetowania hasła.');
    } else {
      setError('Wystąpił problem. Spróbuj ponownie.');
    }
    setIsSubmitting(false);
    return;
  }

  setSuccessMessage('Hasło zostało zmienione pomyślnie! Za chwilę zostaniesz przekierowany do panelu.');

  setTimeout(() => {
    window.location.href = '/onboarding/consent';
  }, 2000);
};
```

---

### 1.4. Rozszerzenie istniejących komponentów

#### 1.4.1. Przycisk wylogowania

**Lokalizacja:** `/src/components/auth/LogoutButton.tsx` (nowy komponent)

**Opis:**
Przycisk wylogowania dostępny w chronionych widokach (np. w nawigacji, w profilu użytkownika).

**Props:**
```typescript
interface LogoutButtonProps {
  variant?: 'default' | 'ghost' | 'outline';
  onLogoutStart?: () => void;
  onLogoutComplete?: () => void;
}
```

**Scenariusz:**
1. Użytkownik klika "Wyloguj się"
2. `supabaseClient.auth.signOut()`
3. Toast sukcesu: "Wylogowano pomyślnie"
4. Redirect na `/auth/login`

**Integracja:**
```typescript
import { supabaseClient } from '@/db/supabase.client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const LogoutButton: FC<LogoutButtonProps> = ({
  variant = 'ghost',
  onLogoutStart,
  onLogoutComplete
}) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    onLogoutStart?.();

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      toast.error('Wystąpił problem podczas wylogowywania.');
      setIsLoggingOut(false);
      return;
    }

    toast.success('Wylogowano pomyślnie');
    onLogoutComplete?.();
    window.location.href = '/auth/login';
  };

  return (
    <Button
      variant={variant}
      onClick={handleLogout}
      disabled={isLoggingOut}
    >
      {isLoggingOut ? 'Wylogowywanie...' : 'Wyloguj się'}
    </Button>
  );
};
```

---

### 1.5. Routing i nawigacja

#### 1.5.1. Publiczne ścieżki (dostępne bez logowania)

- `/auth/login` – strona logowania
- `/auth/register` – strona rejestracji
- `/auth/reset-password` – żądanie resetu hasła
- `/auth/update-password` – ustawienie nowego hasła (wymaga tokenu z emaila)
- `/` – strona główna (landing page)

#### 1.5.2. Chronione ścieżki (wymagają aktywnej sesji)

- `/onboarding/consent` – strona zgody (wymaga zalogowania)
- `/onboarding/persona` – upload persony (wymaga zalogowania + zgody)
- `/generations/new` – nowa generacja (wymaga zalogowania + zgody + persony)
- `/generations/:id` – szczegóły generacji (wymaga zalogowania)
- `/profile` – profil użytkownika (wymaga zalogowania)

#### 1.5.3. Logika przekierowań

**Niezalogowany użytkownik próbuje dostać się na chronioną ścieżkę:**
- Middleware wykrywa brak sesji
- Przekierowanie na `/auth/login?redirect=/original-path`
- Po zalogowaniu → powrót na `/original-path`

**Zalogowany użytkownik próbuje dostać się na publiczne ścieżki autentykacji:**
- Middleware wykrywa aktywną sesję
- Przekierowanie na `/onboarding/consent` lub ostatnio odwiedzaną chronioną stronę

---

### 1.6. Obsługa komunikatów błędów

**Komunikaty są wyświetlane w następujących miejscach:**
1. **Inline pod polami formularza** – błędy walidacji (React Hook Form)
2. **Alert na górze formularza** – błędy API (Supabase Auth errors)
3. **Toast notifications** – sukces akcji (Sonner)

**Kategorie błędów:**
- **Walidacja (400):** Nieprawidłowy format, brakujące pole, hasła się nie zgadzają
- **Autentykacja (401):** Nieprawidłowe dane logowania, sesja wygasła
- **Autoryzacja (403):** Brak dostępu (teoretycznie nie powinno wystąpić w autentykacji)
- **Sieć (network error):** Problem z połączeniem, timeout
- **Serwer (500):** Nieoczekiwany błąd Supabase

---

### 1.7. Scenariusze UX

#### Scenariusz 1: Nowy użytkownik (rejestracja → onboarding)

⚠️ **ZAKTUALIZOWANE:** Usunięto krok weryfikacji emaila zgodnie z PRD

1. Użytkownik wchodzi na `/auth/register`
2. Wypełnia formularz rejestracji (email, hasło, potwierdzenie hasła)
3. Klika "Zarejestruj się"
4. Toast sukcesu: "Konto utworzone pomyślnie! Witamy w Vestilook."
5. **Natychmiastowe przekierowanie** na `/onboarding/consent` (sesja aktywna od razu)
6. Akceptuje politykę zgody na przetwarzanie wizerunku
7. Upload persony na `/onboarding/persona`
8. Generacja stylizacji na `/generations/new`

**ZMIANA:** Usunięto kroki 4-5 z oryginalnego scenariusza (sprawdzanie emaila i klikanie linku)

#### Scenariusz 2: Istniejący użytkownik (logowanie)

1. Użytkownik wchodzi na `/auth/login`
2. Wypełnia email i hasło
3. Klika "Zaloguj się"
4. Zostaje przekierowany na `/onboarding/consent` (lub ostatnią odwiedzoną stronę)

#### Scenariusz 3: Użytkownik zapomniał hasła

1. Użytkownik wchodzi na `/auth/login`
2. Klika "Zapomniałeś hasła?"
3. Zostaje przekierowany na `/auth/reset-password`
4. Podaje email
5. Klika "Wyślij link"
6. Widzi komunikat sukcesu
7. Otwiera email od Supabase i klika link resetujący
8. Zostaje przekierowany na `/auth/update-password`
9. Wpisuje nowe hasło
10. Klika "Zmień hasło"
11. Zostaje przekierowany na `/onboarding/consent`

#### Scenariusz 4: Sesja wygasła podczas korzystania z aplikacji

1. Użytkownik jest na chronionej stronie (np. `/generations/new`)
2. Próbuje wykonać akcję (np. wysłać formularz generacji)
3. Endpoint API zwraca 401 Unauthorized
4. Frontend wykrywa błąd i wywołuje `supabaseClient.auth.signOut()`
5. Toast: "Sesja wygasła. Zaloguj się ponownie."
6. Redirect na `/auth/login?redirect=/generations/new`

---

## 2. LOGIKA BACKENDOWA

### 2.1. Endpointy API

**Uwaga:** Supabase Auth obsługuje większość operacji autentykacji po stronie klienta. Nie ma potrzeby tworzenia dedykowanych endpointów API dla logowania, rejestracji czy resetu hasła, ponieważ Supabase dostarcza własne API.

**Wyjątek:** Opcjonalny endpoint pomocniczy dla weryfikacji sesji server-side lub profilowania użytkownika.

#### 2.1.1. `GET /api/auth/session` (opcjonalny)

**Opis:**
Endpoint weryfikujący aktywną sesję użytkownika i zwracający podstawowe dane użytkownika.

**Odpowiedzialność:**
- Weryfikacja Bearer token z nagłówka `Authorization`
- Sprawdzenie sesji przez `supabase.auth.getUser(token)`
- Zwrócenie danych użytkownika lub błędu 401

**Request:**
```http
GET /api/auth/session
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "emailVerified": true,
    "createdAt": "2024-03-01T10:00:00Z"
  },
  "session": {
    "accessToken": "...",
    "expiresAt": 1234567890
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Implementacja:**
```typescript
// /src/pages/api/auth/session.ts
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../db/database.types';

const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_KEY;

export const GET: APIRoute = async ({ request }) => {
  const token = extractBearerToken(request.headers.get('authorization'));

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      user: {
        id: data.user.id,
        email: data.user.email,
        emailVerified: data.user.email_confirmed_at !== null,
        createdAt: data.user.created_at,
      },
      session: {
        accessToken: token,
        expiresAt: data.user.aud,
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token?.trim() : null;
}
```

---

### 2.2. Middleware autentykacji

#### 2.2.1. Rozszerzenie `/src/middleware/index.ts`

**Opis:**
Middleware sprawdza obecność aktywnej sesji Supabase dla chronionych ścieżek. Jeśli sesja jest nieważna lub brak sesji, przekierowuje na `/auth/login`.

**Odpowiedzialność:**
- Weryfikacja sesji na podstawie cookies (Supabase przechowuje token w cookie)
- Ochrona ścieżek wymagających autentykacji
- Przekierowanie niezalogowanych użytkowników na `/auth/login?redirect=<original-path>`
- Przekierowanie zalogowanych użytkowników z publicznych stron autentykacji na `/onboarding/consent`
- Dodanie danych użytkownika do `context.locals.user`

**Implementacja:**
```typescript
// /src/middleware/index.ts
import { defineMiddleware } from 'astro:middleware';
import { supabaseClient } from '../db/supabase.client.ts';

const PROTECTED_ROUTES = [
  '/onboarding/consent',
  '/onboarding/persona',
  '/generations',
  '/profile',
];

const AUTH_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/reset-password',
];

export const onRequest = defineMiddleware(async (context, next) => {
  // Dodaj klienta Supabase do context
  context.locals.supabase = supabaseClient;

  const path = context.url.pathname;

  // Pobierz sesję z cookies
  const { data: { session }, error } = await supabaseClient.auth.getSession();

  // Sprawdź czy użytkownik jest zalogowany
  const isAuthenticated = !!session && !error;

  // Dodaj dane użytkownika do context
  if (isAuthenticated && session) {
    context.locals.user = session.user;
  } else {
    context.locals.user = null;
  }

  // Logika ochrony ścieżek
  const isProtectedRoute = PROTECTED_ROUTES.some((route) => path.startsWith(route));
  const isAuthRoute = AUTH_ROUTES.some((route) => path.startsWith(route));

  // Niezalogowany użytkownik próbuje dostać się na chronioną ścieżkę
  if (isProtectedRoute && !isAuthenticated) {
    const redirectUrl = `/auth/login?redirect=${encodeURIComponent(path)}`;
    return context.redirect(redirectUrl, 302);
  }

  // Zalogowany użytkownik próbuje dostać się na stronę logowania/rejestracji
  if (isAuthRoute && isAuthenticated) {
    return context.redirect('/onboarding/consent', 302);
  }

  // Jeśli wszystko OK, przejdź dalej
  return next();
});
```

**Rozszerzenie typów Astro Locals:**
```typescript
// /src/env.d.ts
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    supabase: import('@supabase/supabase-js').SupabaseClient<import('./db/database.types').Database>;
    user: import('@supabase/supabase-js').User | null;
  }
}
```

---

### 2.3. Walidacja danych wejściowych

**Walidacja po stronie klienta:**
- React Hook Form + Zod (opisane w sekcji 1.3)
- Natychmiastowa walidacja inline pod polami formularza

**Walidacja po stronie serwera:**
- Supabase Auth wykonuje własną walidację (format email, siła hasła)
- Dodatkowa walidacja w endpointach API (jeśli zostaną stworzone) przez helper functions

**Przykład helper function:**
```typescript
// /src/lib/validation.ts
import { z } from 'zod';

export const emailSchema = z.string().email('Nieprawidłowy format adresu email');

export const passwordSchema = z
  .string()
  .min(8, 'Hasło musi mieć co najmniej 8 znaków')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Hasło musi zawierać wielką literę, małą literę oraz cyfrę'
  );

export function validateEmail(email: string): { valid: boolean; error?: string } {
  const result = emailSchema.safeParse(email);
  return result.success ? { valid: true } : { valid: false, error: result.error.errors[0].message };
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  const result = passwordSchema.safeParse(password);
  return result.success ? { valid: true } : { valid: false, error: result.error.errors[0].message };
}
```

---

### 2.4. Obsługa wyjątków

**Strategia obsługi błędów:**
1. **Client-side (React komponenty):**
   - Try-catch wokół wywołań `supabaseClient.auth.*`
   - Mapowanie błędów Supabase na user-friendly komunikaty
   - Wyświetlenie błędów w `<Alert />` lub toast

2. **Server-side (middleware, endpointy API):**
   - Logowanie błędów do konsoli (lub zewnętrzny serwis, np. Sentry)
   - Zwracanie standardowych kodów HTTP z JSON body
   - Unikanie ujawniania szczegółów technicznych użytkownikowi

**Przykład mapowania błędów Supabase:**
```typescript
// /src/lib/auth-errors.ts
export function mapSupabaseAuthError(error: { message: string; status?: number }): string {
  const message = error.message.toLowerCase();

  if (message.includes('invalid login credentials')) {
    return 'Nieprawidłowy email lub hasło';
  }

  if (message.includes('user already registered')) {
    return 'Ten adres email jest już zarejestrowany';
  }

  if (message.includes('email not confirmed')) {
    return 'Potwierdź swój adres email, aby się zalogować';
  }

  if (message.includes('password') && message.includes('weak')) {
    return 'Hasło jest zbyt słabe. Użyj silniejszego hasła.';
  }

  if (message.includes('rate limit')) {
    return 'Zbyt wiele prób. Spróbuj ponownie za chwilę.';
  }

  if (message.includes('expired') || message.includes('invalid')) {
    return 'Link wygasł lub jest nieprawidłowy';
  }

  return 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.';
}
```

**Użycie w komponencie:**
```typescript
import { mapSupabaseAuthError } from '@/lib/auth-errors';

const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

if (error) {
  setError(mapSupabaseAuthError(error));
  return;
}
```

---

### 2.5. Aktualizacja renderowania server-side

**Obecna konfiguracja:**
- `astro.config.mjs` już ma `output: "server"`
- Adapter: `@astrojs/node` w trybie `standalone`

**Zmiana:** Brak konieczności aktualizacji konfiguracji Astro. SSR jest już włączony.

**Dodatkowe usprawnienia:**
- Wykorzystanie `Astro.locals.user` w komponentach Astro do conditionalnego renderowania (np. wyświetlenie przycisku "Wyloguj się" tylko dla zalogowanych użytkowników)

**Przykład użycia w komponencie Astro:**
```astro
---
// /src/components/Header.astro
const user = Astro.locals.user;
---

<header>
  <nav>
    <a href="/">Home</a>
    {user ? (
      <>
        <a href="/generations/new">Nowa generacja</a>
        <a href="/profile">Profil</a>
        <LogoutButton client:load />
      </>
    ) : (
      <>
        <a href="/auth/login">Zaloguj się</a>
        <a href="/auth/register">Zarejestruj się</a>
      </>
    )}
  </nav>
</header>
```

---

## 3. SYSTEM AUTENTYKACJI

### 3.1. Integracja z Supabase Auth

**Supabase Auth** to w pełni zarządzana usługa autentykacji oparta na PostgreSQL i JWT tokens. Obsługuje:
- Rejestrację z email + hasło
- Logowanie z email + hasło
- Resetowanie hasła przez email
- Email confirmation (weryfikacja adresu email)
- OAuth providers (opcjonalnie: Google, GitHub, etc.)
- JWT access tokens i refresh tokens

**Konfiguracja Supabase Auth:**
- Panel Supabase → Authentication → Settings
- **Email confirmation:** ⚠️ **WYŁĄCZONE** (zgodnie z PRD - użytkownik powinien móc od razu korzystać z aplikacji po rejestracji)
- **Password requirements:** Min. 8 znaków dla nowych rejestracji (Supabase domyślnie: 6 znaków, ale walidacja kliencka wymusza 8)
- **Email templates:** Customizacja szablonów emaili dla resetu hasła
- **Redirect URLs:** Dodanie `http://localhost:3000/auth/update-password` i `https://vestilook.com/auth/update-password` do whitelist
- **UWAGA:** PRD nie wymaga weryfikacji emaila. Priorytetem jest szybki onboarding bez dodatkowych kroków.

**Zmienne środowiskowe:**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

**Inicjalizacja klienta:**
```typescript
// /src/db/supabase.client.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Sesja zapisywana w localStorage
    autoRefreshToken: true, // Automatyczne odświeżanie tokenu
    detectSessionInUrl: true, // Wykrywanie sesji w URL (dla magic links)
  },
});
```

---

### 3.2. Flow rejestracji

⚠️ **UWAGA:** Email confirmation jest **WYŁĄCZONE** zgodnie z PRD. Użytkownik może od razu korzystać z aplikacji po rejestracji.

**Krok 1: Formularz rejestracji**
- Użytkownik wypełnia `<RegisterForm />` (email, hasło, potwierdzenie hasła)
- Walidacja kliencka (React Hook Form + Zod)
- Kliknięcie "Zarejestruj się"

**Krok 2: Wywołanie Supabase Auth**
```typescript
const { data, error } = await supabaseClient.auth.signUp({
  email: 'user@example.com',
  password: 'SecurePassword123',
  // Bez options.emailRedirectTo - email confirmation wyłączone
});
```

**Krok 3: Supabase tworzy użytkownika i sesję**
- Nowy rekord w `auth.users` z `email_confirmed_at = NOW()` (email traktowany jako potwierdzony)
- Automatyczne wygenerowanie JWT tokenu (access token + refresh token)
- **Sesja jest aktywna od razu** - użytkownik może korzystać z aplikacji

**Krok 4: Trigger bazy danych**
- Po utworzeniu użytkownika w `auth.users`, trigger automatycznie tworzy profil w `profiles`:
  ```sql
  CREATE OR REPLACE FUNCTION handle_new_user()
  RETURNS TRIGGER AS $$
  BEGIN
    INSERT INTO public.profiles (user_id, consent_version, consent_accepted_at)
    VALUES (NEW.id, 'v0', NOW());
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
  ```

**Krok 5: Automatyczny redirect**
- Klient zapisuje sesję w localStorage (automatycznie przez Supabase)
- Użytkownik jest przekierowany na `/onboarding/consent`
- **Brak kroku weryfikacji emaila** - onboarding jest natychmiastowy

---

### 3.3. Flow logowania

**Krok 1: Formularz logowania**
- Użytkownik wypełnia `<LoginForm />` (email, hasło)
- Walidacja kliencka
- Kliknięcie "Zaloguj się"

**Krok 2: Wywołanie Supabase Auth**
```typescript
const { data, error } = await supabaseClient.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'SecurePassword123',
});
```

**Krok 3: Supabase weryfikuje dane**
- Sprawdzenie czy email istnieje w `auth.users`
- Weryfikacja hasła (bcrypt hash)
- Sprawdzenie czy email jest potwierdzony (jeśli email confirmation jest włączone)

**Krok 4: Supabase zwraca sesję**
```typescript
{
  data: {
    session: {
      access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      refresh_token: "...",
      expires_in: 3600,
      expires_at: 1234567890,
      user: {
        id: "uuid",
        email: "user@example.com",
        // ...
      }
    },
    user: { /* ... */ }
  },
  error: null
}
```

**Krok 5: Klient zapisuje sesję**
- Supabase automatycznie zapisuje `access_token` i `refresh_token` w `localStorage`
- Klient przekierowuje użytkownika na `redirectTo` (np. `/onboarding/consent`)

---

### 3.4. Flow odzyskiwania hasła

**Krok 1: Żądanie resetu hasła**
- Użytkownik wypełnia `<ResetPasswordRequestForm />` (email)
- Walidacja kliencka
- Kliknięcie "Wyślij link"

**Krok 2: Wywołanie Supabase Auth**
```typescript
const { error } = await supabaseClient.auth.resetPasswordForEmail('user@example.com', {
  redirectTo: `${window.location.origin}/auth/update-password`,
});
```

**Krok 3: Supabase wysyła email z linkiem**
- Email z magic link: `https://your-project.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=/auth/update-password`
- **Uwaga:** Supabase zawsze zwraca sukces, nawet jeśli email nie istnieje (dla bezpieczeństwa)

**Krok 4: Użytkownik klika link w emailu**
- Supabase weryfikuje token recovery
- Automatyczne utworzenie tymczasowej sesji (access token + refresh token)
- Redirect na `/auth/update-password`

**Krok 5: Formularz ustawienia nowego hasła**
- Użytkownik wypełnia `<UpdatePasswordForm />` (nowe hasło, potwierdzenie)
- Walidacja kliencka
- Kliknięcie "Zmień hasło"

**Krok 6: Wywołanie Supabase Auth**
```typescript
const { error } = await supabaseClient.auth.updateUser({
  password: 'NewSecurePassword123',
});
```

**Krok 7: Supabase aktualizuje hasło**
- Zmiana hasła w `auth.users`
- Automatyczne przedłużenie sesji (użytkownik pozostaje zalogowany)
- Redirect na `/onboarding/consent`

---

### 3.5. Zarządzanie sesją

**Mechanizm sesji:**
- **Access Token (JWT):** Krótkotrwały token (domyślnie 1 godzina), przechowywany w `localStorage`
- **Refresh Token:** Długotrwały token (domyślnie 30 dni), przechowywany w `localStorage`
- **Automatyczne odświeżanie:** Supabase client automatycznie odświeża access token przed jego wygaśnięciem (jeśli `autoRefreshToken: true`)

**Monitorowanie sesji:**
```typescript
// /src/lib/auth-session.ts
import { supabaseClient } from '@/db/supabase.client';

export function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth event:', event, session);
    callback(event, session);
  });
}
```

**Hook React dla zarządzania sesją:**
```typescript
// /src/hooks/useAuth.ts
import { useEffect, useState } from 'react';
import { supabaseClient } from '@/db/supabase.client';
import type { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Pobierz aktualną sesję
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Nasłuchuj zmian sesji
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, session, loading };
}
```

**Użycie w komponencie:**
```typescript
import { useAuth } from '@/hooks/useAuth';

export const ProtectedComponent = () => {
  const { user, loading } = useAuth();

  if (loading) return <div>Ładowanie...</div>;
  if (!user) return <div>Musisz się zalogować</div>;

  return <div>Witaj, {user.email}!</div>;
};
```

---

### 3.6. Ochrona ścieżek

**Middleware Astro (opisane w sekcji 2.2.1):**
- Sprawdza sesję na podstawie cookies
- Przekierowuje niezalogowanych użytkowników z chronionych ścieżek na `/auth/login`
- Przekierowuje zalogowanych użytkowników z publicznych ścieżek autentykacji na `/onboarding/consent`

**Client-side guard (opcjonalny, dla React komponentów):**
```typescript
// /src/components/auth/ProtectedRoute.tsx
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  redirectTo = '/auth/login'
}) => {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = `${redirectTo}?redirect=${window.location.pathname}`;
    }
  }, [user, loading, redirectTo]);

  if (loading) {
    return <div className="flex items-center justify-center p-8">Ładowanie...</div>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};
```

---

### 3.7. Integracja z obecnym systemem consent

**Wymaganie z PRD (US-002):**
- Przed pierwszym uploadem persony użytkownik musi zaakceptować politykę zgody
- Przed każdą generacją użytkownik musi ponownie potwierdzić zgodę (jeśli polityka się zmieniła)

**Flow integracji:**
1. Użytkownik rejestruje się / loguje
2. Middleware przekierowuje na `/onboarding/consent`
3. `OnboardingConsentPage` sprawdza stan zgody przez `GET /api/profile/consent`
4. Jeśli zgoda nieaktualna → wyświetla formularz zgody
5. Po zaakceptowaniu zgody → `POST /api/profile/consent`
6. Redirect na `/onboarding/persona`

**Aktualizacja profilu po rejestracji:**
- Trigger bazy danych tworzy profil z domyślnymi wartościami:
  ```sql
  INSERT INTO profiles (user_id, consent_version, consent_accepted_at)
  VALUES (NEW.id, 'v0', NOW());
  ```
- `consent_version = 'v0'` oznacza brak aktualnej zgody
- `OnboardingConsentPage` wymusza aktualizację do najnowszej wersji (np. `v1`)

---

### 3.8. Obsługa wygasłej sesji

**Scenariusz:**
- Użytkownik jest zalogowany
- Refresh token wygasa (po 30 dniach domyślnie)
- Użytkownik próbuje wykonać akcję wymagającą autentykacji

**Obsługa:**
1. Supabase client nie może odświeżyć access tokena (refresh token wygasł)
2. API endpoint zwraca 401 Unauthorized
3. Frontend wykrywa błąd 401:
   ```typescript
   if (error?.status === 401 || error?.message.includes('unauthorized')) {
     await supabaseClient.auth.signOut();
     toast.error('Sesja wygasła. Zaloguj się ponownie.');
     window.location.href = `/auth/login?redirect=${window.location.pathname}`;
   }
   ```

**Implementacja w komponencie React:**
```typescript
// /src/lib/api-client.ts
import { supabaseClient } from '@/db/supabase.client';
import { toast } from 'sonner';

export async function handleAuthError(error: any) {
  if (
    error?.status === 401 ||
    error?.message?.toLowerCase().includes('unauthorized') ||
    error?.message?.toLowerCase().includes('session')
  ) {
    await supabaseClient.auth.signOut();
    toast.error('Sesja wygasła. Zaloguj się ponownie.');
    window.location.href = `/auth/login?redirect=${window.location.pathname}`;
    return true;
  }
  return false;
}
```

**Użycie w API call:**
```typescript
import { handleAuthError } from '@/lib/api-client';

const { data, error } = await fetch('/api/profile', {
  headers: {
    Authorization: `Bearer ${session.access_token}`,
  },
});

if (error) {
  const handled = await handleAuthError(error);
  if (handled) return;
  // ... obsługa innych błędów
}
```

---

## 4. MIGRACJA BAZY DANYCH

### 4.1. Trigger tworzenia profilu

**Plik migracji:** `/supabase/migrations/YYYYMMDDHHMMSS_create_profile_trigger.sql`

```sql
-- Funkcja tworząca profil użytkownika po rejestracji
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    consent_version,
    consent_accepted_at,
    free_generation_quota,
    free_generation_used,
    quota_renewal_at
  )
  VALUES (
    NEW.id,
    'v0', -- domyślna wersja zgody (nieaktualna, wymusza akceptację)
    NOW(),
    3, -- domyślny limit darmowych generacji
    0, -- użyto 0 generacji
    NOW() + INTERVAL '30 days' -- odnowienie po 30 dniach
  );
  RETURN NEW;
END;
$$;

-- Trigger uruchamiany po utworzeniu użytkownika w auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
```

**Opis:**
- Trigger automatycznie tworzy rekord w tabeli `profiles` po utworzeniu użytkownika w `auth.users`
- Domyślna wersja zgody `'v0'` wymusza akceptację aktualnej polityki przed pierwszym użyciem
- Domyślny limit 3 darmowych generacji z odnowieniem co 30 dni

---

### 4.2. RLS Policy dla nowych użytkowników

**Plik migracji:** `/supabase/migrations/YYYYMMDDHHMMSS_update_rls_policies.sql`

```sql
-- Polityka INSERT dla profili (umożliwia triggerowi tworzenie profilu)
DROP POLICY IF EXISTS profiles_insert_policy ON public.profiles;

CREATE POLICY profiles_insert_policy
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Alternatywnie, jeśli trigger działa w kontekście SECURITY DEFINER,
-- możesz stworzyć osobną politykę dla service_role:
CREATE POLICY profiles_service_insert_policy
  ON public.profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);
```

**Opis:**
- Polityka umożliwia triggerowi automatyczne tworzenie profilu
- `SECURITY DEFINER` sprawia, że funkcja działa z uprawnieniami właściciela (postgres), omijając RLS

---

## 5. TESTY

### 5.1. Testy jednostkowe (komponentów React)

**Narzędzia:** Vitest + React Testing Library

**Przykładowe testy dla `<LoginForm />`:**
```typescript
// /src/components/auth/__tests__/LoginForm.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '../LoginForm';
import { supabaseClient } from '@/db/supabase.client';

vi.mock('@/db/supabase.client');

describe('LoginForm', () => {
  it('renders email and password fields', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hasło/i)).toBeInTheDocument();
  });

  it('shows validation error for invalid email', async () => {
    render(<LoginForm />);
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /zaloguj się/i });

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/nieprawidłowy format adresu email/i)).toBeInTheDocument();
    });
  });

  it('calls signInWithPassword on valid submission', async () => {
    const mockSignIn = vi.fn().mockResolvedValue({ data: { session: {} }, error: null });
    (supabaseClient.auth.signInWithPassword as any) = mockSignIn;

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/hasło/i), { target: { value: 'Password123' } });
    fireEvent.click(screen.getByRole('button', { name: /zaloguj się/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123',
      });
    });
  });
});
```

---

### 5.2. Testy E2E (Playwright)

**Przykładowy test dla flow logowania:**
```typescript
// /tests/auth/login.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('successful login redirects to onboarding/consent', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'SecurePassword123');
    await page.click('button:has-text("Zaloguj się")');

    await expect(page).toHaveURL('/onboarding/consent');
    await expect(page.locator('text=Witaj')).toBeVisible();
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'WrongPassword');
    await page.click('button:has-text("Zaloguj się")');

    await expect(page.locator('text=Nieprawidłowy email lub hasło')).toBeVisible();
  });
});
```

---

## 6. SECURITY CONSIDERATIONS

### 6.1. Ochrona przed atakami

**CSRF (Cross-Site Request Forgery):**
- Supabase automatycznie chroni przed CSRF przez wymóg Bearer token w nagłówku
- Middleware Astro sprawdza sesję na podstawie cookies z flagą `SameSite=Strict`

**XSS (Cross-Site Scripting):**
- React automatycznie escapuje output (JSX)
- Unikamy `dangerouslySetInnerHTML`
- Walidacja wszystkich inputów użytkownika

**Brute-force:**
- Supabase ma wbudowany rate limiting dla auth endpointów
- Opcjonalnie: dodanie CAPTCHA na formularzach po kilku nieudanych próbach

**SQL Injection:**
- Supabase używa parametryzowanych zapytań
- RLS (Row Level Security) ogranicza dostęp do danych

---

### 6.2. Przechowywanie tokenów

**Access Token i Refresh Token:**
- Przechowywane w `localStorage` przez Supabase client
- **Uwaga:** `localStorage` jest podatny na XSS, ale w tym przypadku jest to akceptowalne ryzyko (Supabase best practice)
- Alternatywa: Przechowywanie tokenów w httpOnly cookies (wymaga custom implementacji)

---

### 6.3. HTTPS Only

**Produkcja:**
- Cała komunikacja przez HTTPS
- Cookies z flagami `Secure` i `HttpOnly`
- Konfiguracja CSP (Content Security Policy) w nagłówkach HTTP

---

## 7. DEPLOYMENT

### 7.1. Zmienne środowiskowe

**Development (`.env`):**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
PUBLIC_CONSENT_POLICY_URL=/legal/polityka-przetwarzania-wizerunku
```

**Production (DigitalOcean App Platform):**
- Ustawienie zmiennych środowiskowych w panelu DigitalOcean
- **Nigdy** nie commitować `.env` do repozytorium

---

### 7.2. Konfiguracja Supabase

**Redirect URLs (whitelist):**
- Development: `http://localhost:3000/auth/update-password`, `http://localhost:3000/onboarding/consent`
- Production: `https://vestilook.com/auth/update-password`, `https://vestilook.com/onboarding/consent`

**Email Templates:**
- Customizacja szablonów emaili w panelu Supabase → Authentication → Email Templates
- Dostosowanie treści i stylów do brandu Vestilook

---

## 8. DOCUMENTATION

### 8.1. Dokumentacja dla użytkowników

**FAQ:**
- Jak się zarejestrować?
- Nie otrzymałem emaila potwierdzającego
- Zapomniałem hasła
- Jak zmienić hasło?

**Lokalizacja:** `/src/pages/help/auth-faq.astro`

---

### 8.2. Dokumentacja dla deweloperów

**README.md (aktualizacja):**
```markdown
## Autentykacja

Vestilook używa Supabase Auth do zarządzania użytkownikami.

### Konfiguracja

1. Utwórz projekt w Supabase
2. Skopiuj `SUPABASE_URL` i `SUPABASE_KEY` do `.env`
3. Uruchom migracje: `npm run migrate`

### Dodawanie nowych chronionych ścieżek

Edytuj `/src/middleware/index.ts` i dodaj nową ścieżkę do `PROTECTED_ROUTES`.
```

---

## 9. PODSUMOWANIE

### 9.1. Kluczowe komponenty

**Frontend (Astro + React):**
- `LoginForm`, `RegisterForm`, `ResetPasswordRequestForm`, `UpdatePasswordForm`
- `LogoutButton`
- `AuthLayout`
- Middleware dla ochrony ścieżek

**Backend (Supabase Auth):**
- Rejestracja: `signUp`
- Logowanie: `signInWithPassword`
- Reset hasła: `resetPasswordForEmail` + `updateUser`
- Zarządzanie sesją: JWT tokens w `localStorage`

**Database:**
- Trigger automatycznego tworzenia profilu
- RLS policies dla ochrony danych

### 9.2. Kontrakty API

**Supabase Auth API (używane przez klienta):**
- `POST /auth/v1/signup` – rejestracja
- `POST /auth/v1/token?grant_type=password` – logowanie
- `POST /auth/v1/recover` – reset hasła
- `PUT /auth/v1/user` – aktualizacja użytkownika (zmiana hasła)
- `POST /auth/v1/logout` – wylogowanie

**Własne endpointy API (opcjonalne):**
- `GET /api/auth/session` – weryfikacja sesji server-side

### 9.3. Następne kroki implementacji

1. Utworzenie layoutu `AuthLayout.astro`
2. Implementacja stron Astro: `login.astro`, `register.astro`, `reset-password.astro`, `update-password.astro`
3. Implementacja komponentów React: `LoginForm.tsx`, `RegisterForm.tsx`, etc.
4. Aktualizacja middleware `/src/middleware/index.ts`
5. Utworzenie triggera bazy danych dla automatycznego tworzenia profilu
6. Testy jednostkowe i E2E
7. Dokumentacja użytkownika i dewelopera
8. Deployment i konfiguracja produkcyjna

---

## 10. RECONCILIACJA Z PRD - RAPORT

**Data analizy:** 2025-11-05

### 10.1. Sprzeczności wykryte i rozwiązane

| # | Sprzeczność | Decyzja | Status |
|---|-------------|---------|--------|
| 1 | **Email Confirmation nie był wymieniony w PRD** | Wyłączono email confirmation w Supabase. Użytkownik korzysta z aplikacji natychmiast po rejestracji. | ✅ ROZWIĄZANE |
| 2 | **Flow rejestracji różnił się od PRD US-001** | Uproszczono flow - usunięto kroki weryfikacji emaila. Sesja tworzona automatycznie. | ✅ ROZWIĄZANE |
| 3 | **Komunikaty użytkownika sugerowały weryfikację emaila** | Zaktualizowano wszystkie komunikaty, usunięto wzmianki o emailu weryfikacyjnym. | ✅ ROZWIĄZANE |

### 10.2. Weryfikacja zgodności User Stories

| User Story | Pokrycie w auth-spec | Komentarz |
|------------|---------------------|-----------|
| US-001: Uwierzytelnianie | ✅ PEŁNE | Rejestracja i logowanie z Supabase Auth, automatyczna generacja UID |
| US-002: Pierwsza zgoda | ⚠️ CZĘŚCIOWE | Auth-spec integruje się z consent system (sekcja 3.7). Szczegóły consent w osobnej specyfikacji. |
| US-007: Przekroczenie limitu | ✅ PEŁNE | Trigger bazy (sekcja 4.1) inicjalizuje quota: 3 darmowe generacje, odnowienie co 30 dni |
| US-003 - US-006, US-008 - US-010 | ➖ POZA ZAKRESEM | Te User Stories dotyczą funkcjonalności VTON, persona upload, walidacji obrazów - poza zakresem modułu autentykacji |

### 10.3. Nadmiarowe założenia zidentyfikowane

1. **Consent flow w sekcji 3.7**
   - **Problem:** Auth-spec szczegółowo opisuje integrację z consent system, ale consent nie jest częścią modułu autentykacji
   - **Rozwiązanie:** Zachowano minimalną integrację (redirect na `/onboarding/consent`, trigger tworzy profil z `consent_version = 'v0'`). Szczegóły consent przeniesione do osobnej specyfikacji.

2. **Wielokrotne opisanie przekierowań**
   - **Problem:** Scenariusze przekierowań powtarzane w sekcjach 1.5.3, 3.7, 1.7
   - **Rozwiązanie:** Zachowano dla jasności, ale należy pamiętać o aktualizacji wszystkich miejsc przy zmianach

### 10.4. Kluczowe decyzje architektoniczne

| Decyzja | Uzasadnienie | Wpływ |
|---------|--------------|-------|
| **Email confirmation: WYŁĄCZONE** | PRD nie wymienia weryfikacji emaila jako wymagania. Priorytet: szybki onboarding. | Użytkownik może korzystać z aplikacji od razu po rejestracji. Ryzyko: spam accounts. |
| **Hasło min. 8 znaków (rejestracja)** | Zwiększone bezpieczeństwo względem domyślnych 6 znaków Supabase. | LoginForm akceptuje >=6 znaków (dla kompatybilności wstecznej), RegisterForm wymusza >=8 |
| **Trigger bazy dla profili** | Automatyczne tworzenie profilu z quota po rejestracji. | Upraszcza implementację, eliminuje potrzebę oddzielnego endpointu API |
| **Middleware ochrony ścieżek** | Centralizacja logiki autentykacji w middleware Astro. | Spójne zachowanie dla wszystkich chronionych ścieżek |

### 10.5. Nierozwiązane kwestie i ryzyka

| Kwestia | Ryzyko | Rekomendacja |
|---------|--------|--------------|
| **Brak weryfikacji emaila** | Możliwość tworzenia kont ze sfałszowanymi adresami email | Rozważyć monitoring i rate limiting rejestracji z tego samego IP |
| **Hasła 6 vs 8 znaków** | Użytkownicy mogą być zdezorientowani różnymi wymaganiami | Dokumentacja FAQ powinna wyjaśnić, że stare konta (6 znaków) są akceptowane |
| **Consent system częściowo w auth-spec** | Może powodować zamieszanie co do odpowiedzialności modułów | Stworzyć osobną specyfikację techniczną dla consent system |
| **Quota renewal logic** | Auth-spec inicjalizuje quota, ale nie opisuje logiki odnowienia | Należy stworzyć osobną specyfikację dla quota management (cron job) |

### 10.6. Następne kroki

1. ✅ Zaktualizowano auth-spec.md zgodnie z wynikami reconciliacji
2. ⏳ Wymagane: Utworzenie osobnej specyfikacji technicznej dla **Consent System**
3. ⏳ Wymagane: Utworzenie specyfikacji technicznej dla **Quota Management & Renewal**
4. ⏳ Wymagane: Utworzenie specyfikacji technicznej dla **Persona Upload & Management**
5. ⏳ Wymagane: Utworzenie specyfikacji technicznej dla **VTON Generation Flow**
6. ⏳ Zalecane: Dokumentacja FAQ dla użytkowników (pytania o hasła, brak emaila weryfikacyjnego)
7. ⏳ Zalecane: Rate limiting dla rejestracji (ochrona przed spam accounts)

### 10.7. Testy wymagane po zmianach

Po implementacji zgodnie z zaktualizowanym auth-spec należy przeprowadzić:

**Testy funkcjonalne:**
- [ ] Rejestracja bez email confirmation - użytkownik od razu ma sesję
- [ ] Logowanie z kontami mającymi hasła 6-8 znaków
- [ ] Redirect na `/onboarding/consent` po rejestracji
- [ ] Trigger bazy tworzy profil z quota = 3
- [ ] Middleware blokuje dostęp do chronionych ścieżek

**Testy E2E (Playwright):**
- [ ] Scenariusz 1: Pełny flow rejestracji → onboarding → consent
- [ ] Scenariusz 2: Logowanie → redirect na ostatnią odwiedzaną stronę
- [ ] Scenariusz 3: Reset hasła przez email
- [ ] Scenariusz 4: Wygaśnięcie sesji → redirect na login

**Testy bezpieczeństwa:**
- [ ] Próba dostępu do chronionej ścieżki bez sesji
- [ ] Próba rejestracji tego samego emaila dwukrotnie
- [ ] Rate limiting dla failed login attempts
- [ ] XSS i CSRF protection

---

**Koniec specyfikacji technicznej.**
