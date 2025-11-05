import { type FC, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const registerSchema = z
  .object({
    email: z.string().email("Nieprawidłowy format adresu email"),
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

type RegisterFormValues = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  redirectTo?: string;
}

export const RegisterForm: FC<RegisterFormProps> = ({ redirectTo = "/onboarding/consent" }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
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

  const onSubmit = async (values: RegisterFormValues) => {
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    // TODO: Implement Supabase Auth integration
    // const { data, error } = await supabaseClient.auth.signUp({
    //   email: values.email,
    //   password: values.password,
    // });
    //
    // if (error) {
    //   if (error.message.includes('already registered')) {
    //     setError('Ten adres email jest już zarejestrowany');
    //   } else {
    //     setError('Wystąpił problem z rejestracją. Spróbuj ponownie.');
    //   }
    //   setIsSubmitting(false);
    //   return;
    // }
    //
    // if (data?.session) {
    //   toast.success('Konto utworzone pomyślnie! Witamy w Vestilook.');
    //   window.location.href = redirectTo;
    // }

    console.log("Register form submitted:", values, "Redirect to:", redirectTo);

    // Temporary: simulate success after 1 second
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessMessage("Konto utworzone pomyślnie! Witamy w Vestilook.");
      alert("Register UI ready - Backend integration pending");
    }, 1000);
  };

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Stwórz nowe konto</CardTitle>
        <CardDescription>Dołącz do Vestilook i zacznij stylizować swoje zdjęcia</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert variant="success">
              <AlertDescription>{successMessage}</AlertDescription>
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

          <div className="space-y-2">
            <Label htmlFor="password">Hasło</Label>
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
            <Label htmlFor="confirmPassword">Potwierdź hasło</Label>
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
            {isSubmitting ? "Rejestracja..." : "Zarejestruj się"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Masz już konto?{" "}
            <a href="/auth/login" className="text-primary hover:underline">
              Zaloguj się
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
};
