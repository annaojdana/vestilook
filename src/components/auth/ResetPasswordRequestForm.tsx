import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabaseClient } from '@/db/supabase.client';
import {
  resetPasswordRequestSchema,
  type ResetPasswordRequestFormValues,
} from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function ResetPasswordRequestForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordRequestFormValues>({
    resolver: zodResolver(resetPasswordRequestSchema),
  });

  const onSubmit = async (values: ResetPasswordRequestFormValues) => {
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { error: authError } = await supabaseClient.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (authError) {
        setError('Wystąpił problem. Spróbuj ponownie.');
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(
        `Link do resetowania hasła został wysłany na adres ${values.email}. Sprawdź swoją skrzynkę pocztową.`,
      );
      setIsSubmitting(false);
    } catch (err) {
      console.error('Reset password error:', err);
      setError('Wystąpił problem. Spróbuj ponownie.');
      setIsSubmitting(false);
    }
  };

  if (successMessage) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sprawdź swoją skrzynkę pocztową</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
          <div className="text-center">
            <a href="/auth/login" className="text-primary hover:underline text-sm">
              Powrót do logowania
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Resetowanie hasła</CardTitle>
        <CardDescription>
          Podaj adres email powiązany z Twoim kontem. Wyślemy Ci link do resetowania hasła.
        </CardDescription>
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

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Wysyłanie...' : 'Wyślij link'}
          </Button>

          <div className="text-center text-sm">
            <a href="/auth/login" className="text-primary hover:underline">
              Powrót do logowania
            </a>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
