import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { supabaseClient } from '@/db/supabase.client';
import { registerSchema, type RegisterFormValues } from '@/lib/validation';
import { mapSupabaseAuthError } from '@/lib/auth-errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface RegisterFormProps {
  redirectTo?: string;
}

export function RegisterForm({ redirectTo = '/onboarding/consent' }: RegisterFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const password = watch('password');

  // Calculate password strength
  const calculatePasswordStrength = (pwd: string): number => {
    if (!pwd) return 0;
    let strength = 0;
    if (pwd.length >= 8) strength += 25;
    if (pwd.length >= 12) strength += 15;
    if (/[a-z]/.test(pwd)) strength += 20;
    if (/[A-Z]/.test(pwd)) strength += 20;
    if (/\d/.test(pwd)) strength += 20;
    return Math.min(strength, 100);
  };

  // Update password strength on password change
  useState(() => {
    setPasswordStrength(calculatePasswordStrength(password || ''));
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: authError } = await supabaseClient.auth.signUp({
        email: values.email,
        password: values.password,
      });

      if (authError) {
        if (authError.message.toLowerCase().includes('already registered')) {
          setError('Ten adres email jest już zarejestrowany');
        } else {
          setError(mapSupabaseAuthError(authError));
        }
        setIsSubmitting(false);
        return;
      }

      if (data?.session) {
        toast.success('Konto utworzone pomyślnie! Witamy w Vestilook.');
        window.location.href = redirectTo;
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError('Wystąpił problem z rejestracją. Spróbuj ponownie.');
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Stwórz nowe konto</CardTitle>
        <CardDescription>Rozpocznij swoją przygodę z Vestilook</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
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
              autoComplete="new-password"
              placeholder="••••••••"
              {...register('password')}
              disabled={isSubmitting}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
            {password && password.length > 0 && (
              <div className="space-y-1">
                <Progress value={calculatePasswordStrength(password)} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Siła hasła: {calculatePasswordStrength(password) < 50 ? 'Słabe' : calculatePasswordStrength(password) < 80 ? 'Średnie' : 'Silne'}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Powtórz hasło</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              {...register('confirmPassword')}
              disabled={isSubmitting}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Rejestracja...' : 'Zarejestruj się'}
          </Button>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Masz już konto? </span>
            <a href="/auth/login" className="text-primary hover:underline">
              Zaloguj się
            </a>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
