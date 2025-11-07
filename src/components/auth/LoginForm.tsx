import { type FC, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const loginSchema = z.object({
  email: z.string().email("Nieprawidłowy format adresu email"),
  password: z.string().min(6, "Hasło musi mieć co najmniej 6 znaków"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  redirectTo?: string;
  errorMessage?: string;
  infoMessage?: string;
}

export function LoginForm({ redirectTo = '/onboarding/consent', errorMessage, infoMessage }: LoginFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(errorMessage || null);
  const [info, setInfo] = useState<string | null>(
    infoMessage === 'check-email'
      ? 'Sprawdź swoją skrzynkę email i kliknij w link aktywacyjny, aby potwierdzić konto.'
      : null
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: authError } = await supabaseClient.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (authError) {
        setError(mapSupabaseAuthError(authError));
        setIsSubmitting(false);
        return;
      }

      if (data?.session) {
        toast.success('Zalogowano pomyślnie');
        window.location.href = redirectTo;
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Wystąpił problem z połączeniem. Spróbuj ponownie.');
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md" data-testid="login-card">
      <CardHeader>
        <CardTitle>Zaloguj się do Vestilook</CardTitle>
        <CardDescription>Wpisz swoje dane, aby kontynuować</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-testid="login-form">
          {error && (
            <Alert variant="destructive" data-testid="login-error-alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {info && (
            <Alert data-testid="login-info-alert">
              <AlertDescription>{info}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="twoj@email.pl"
              {...register('email')}
              disabled={isSubmitting}
              data-testid="login-email"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Hasło</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register('password')}
              disabled={isSubmitting}
              data-testid="login-password"
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="login-submit">
            {isSubmitting ? 'Logowanie...' : 'Zaloguj się'}
          </Button>

          <div className="space-y-2 text-center text-sm">
            <a
              href="/auth/reset-password"
              className="text-primary hover:underline"
            >
              Zapomniałeś hasła?
            </a>
            <div>
              <span className="text-muted-foreground">Nie masz jeszcze konta? </span>
              <a href="/auth/register" className="text-primary hover:underline">
                Zarejestruj się
              </a>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
