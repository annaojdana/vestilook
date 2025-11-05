import { type FC, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const resetPasswordRequestSchema = z.object({
  email: z.string().email("Nieprawidłowy format adresu email"),
});

type ResetPasswordRequestFormValues = z.infer<typeof resetPasswordRequestSchema>;

export const ResetPasswordRequestForm: FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ResetPasswordRequestFormValues>({
    resolver: zodResolver(resetPasswordRequestSchema),
  });

  const onSubmit = async (values: ResetPasswordRequestFormValues) => {
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    // TODO: Implement Supabase Auth integration
    // const { error } = await supabaseClient.auth.resetPasswordForEmail(values.email, {
    //   redirectTo: `${window.location.origin}/auth/update-password`,
    // });
    //
    // if (error) {
    //   setError('Wystąpił problem. Spróbuj ponownie.');
    //   setIsSubmitting(false);
    //   return;
    // }
    //
    // setSuccessMessage(
    //   `Link do resetowania hasła został wysłany na adres ${values.email}. Sprawdź swoją skrzynkę pocztową.`
    // );
    // setIsSubmitting(false);

    console.log("Reset password request submitted:", values);

    // Temporary: simulate success after 1 second
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessMessage(
        `Link do resetowania hasła został wysłany na adres ${values.email}. Sprawdź swoją skrzynkę pocztową.`
      );
    }, 1000);
  };

  if (successMessage) {
    return (
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Email wysłany</CardTitle>
          <CardDescription>Sprawdź swoją skrzynkę pocztową</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="success">
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Kliknij w link w emailu, aby ustawić nowe hasło.</p>
            <p>
              Jeśli nie otrzymasz emaila w ciągu kilku minut, sprawdź folder spam lub{" "}
              <button
                type="button"
                onClick={() => {
                  setSuccessMessage(null);
                  setError(null);
                }}
                className="text-primary hover:underline"
              >
                spróbuj ponownie
              </button>
              .
            </p>
          </div>

          <Button asChild variant="outline" className="w-full">
            <a href="/auth/login">Powrót do logowania</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Resetowanie hasła</CardTitle>
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
              placeholder="twoj@email.com"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Wysyłanie..." : "Wyślij link"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            <a href="/auth/login" className="text-primary hover:underline">
              Powrót do logowania
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
};
