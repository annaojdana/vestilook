import { type FC, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Hasło musi mieć co najmniej 8 znaków")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Hasło musi zawierać wielką literę, małą literę oraz cyfrę"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Hasła muszą być identyczne",
    path: ["confirmPassword"],
  });

type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>;

export const UpdatePasswordForm: FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
  });

  const password = watch("password");

  const getPasswordStrength = (pwd: string): { label: string; color: string; width: string } => {
    if (!pwd) return { label: "", color: "", width: "0%" };

    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    const length = pwd.length;

    let strength = 0;
    if (hasLower) strength++;
    if (hasUpper) strength++;
    if (hasNumber) strength++;
    if (hasSpecial) strength++;
    if (length >= 8) strength++;
    if (length >= 12) strength++;

    if (strength <= 2) return { label: "Słabe", color: "bg-destructive", width: "33%" };
    if (strength <= 4) return { label: "Średnie", color: "bg-amber-500", width: "66%" };
    return { label: "Silne", color: "bg-emerald-500", width: "100%" };
  };

  const passwordStrength = getPasswordStrength(password);

  const onSubmit = async (values: UpdatePasswordFormValues) => {
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    // TODO: Implement Supabase Auth integration
    // const { error } = await supabaseClient.auth.updateUser({
    //   password: values.password,
    // });
    //
    // if (error) {
    //   if (error.message.includes('expired') || error.message.includes('invalid')) {
    //     setError('Link wygasł lub jest nieprawidłowy. Zażądaj nowego linku do resetowania hasła.');
    //   } else {
    //     setError('Wystąpił problem. Spróbuj ponownie.');
    //   }
    //   setIsSubmitting(false);
    //   return;
    // }
    //
    // setSuccessMessage('Hasło zostało zmienione pomyślnie! Za chwilę zostaniesz przekierowany do panelu.');
    //
    // setTimeout(() => {
    //   window.location.href = '/onboarding/consent';
    // }, 2000);

    console.log("Update password submitted:", values);

    // Temporary: simulate success after 1 second
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessMessage("Hasło zostało zmienione pomyślnie! Za chwilę zostaniesz przekierowany do panelu.");

      // Simulate redirect after 2 seconds
      setTimeout(() => {
        alert("Update password UI ready - Backend integration pending");
      }, 2000);
    }, 1000);
  };

  if (successMessage) {
    return (
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Hasło zmienione</CardTitle>
          <CardDescription>Twoje hasło zostało zaktualizowane</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="success">
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>

          <p className="text-center text-sm text-muted-foreground">
            Przekierowujemy Cię do panelu...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Ustaw nowe hasło</CardTitle>
        <CardDescription>Wprowadź nowe hasło dla swojego konta</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                {error}
                {error.includes("wygasł") && (
                  <>
                    {" "}
                    <a href="/auth/reset-password" className="underline">
                      Zażądaj nowego linku
                    </a>
                  </>
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
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            {password && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Siła hasła:</span>
                  <span className={`font-medium ${
                    passwordStrength.color === "bg-destructive" ? "text-destructive" :
                    passwordStrength.color === "bg-amber-500" ? "text-amber-600" :
                    "text-emerald-600"
                  }`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all ${passwordStrength.color}`}
                    style={{ width: passwordStrength.width }}
                  />
                </div>
              </div>
            )}
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Potwierdź nowe hasło</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              aria-invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Zmiana hasła..." : "Zmień hasło"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
