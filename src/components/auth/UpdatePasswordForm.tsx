import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabaseClient } from '@/db/supabase.client';
import { updatePasswordSchema, type UpdatePasswordFormValues } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

export function UpdatePasswordForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
  });

  const password = watch('password');

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

  const onSubmit = async (values: UpdatePasswordFormValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const { error: authError } = await supabaseClient.auth.updateUser({
        password: values.password,
      });

      if (authError) {
        if (
          authError.message.toLowerCase().includes('expired') ||
          authError.message.toLowerCase().includes('invalid')
        ) {
          setError(
            'Link wygasł lub jest nieprawidłowy. Zażądaj nowego linku do resetowania hasła.',
          );
        } else {
          setError('Wystąpił problem. Spróbuj ponownie.');
        }
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(
        'Hasło zostało zmienione pomyślnie! Za chwilę zostaniesz przekierowany do panelu.',
      );

      setTimeout(() => {
        window.location.href = '/onboarding/consent';
      }, 2000);
    } catch (err) {
      console.error('Update password error:', err);
      setError('Wystąpił problem. Spróbuj ponownie.');
      setIsSubmitting(false);
    }
  };

  if (successMessage) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sukces!</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Ustaw nowe hasło</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                {error}
                {error.includes('wygasł') && (
                  <div className="mt-2">
                    <a href="/auth/reset-password" className="underline">
                      Zażądaj nowego linku
                    </a>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Nowe hasło</Label>
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
                  Siła hasła:{' '}
                  {calculatePasswordStrength(password) < 50
                    ? 'Słabe'
                    : calculatePasswordStrength(password) < 80
                      ? 'Średnie'
                      : 'Silne'}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Powtórz nowe hasło</Label>
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
            {isSubmitting ? 'Zmiana hasła...' : 'Zmień hasło'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
