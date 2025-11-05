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
}

export const LoginForm: FC<LoginFormProps> = ({ redirectTo = "/onboarding/consent", errorMessage }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(errorMessage ?? null);

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

    // TODO: Implement Supabase Auth integration
    // const { data, error } = await supabaseClient.auth.signInWithPassword({
    //   email: values.email,
    //   password: values.password,
    // });
    //
    // if (error) {
    //   setError('Nieprawidłowy email lub hasło');
    //   setIsSubmitting(false);
    //   return;
    // }
    //
    // if (data?.session) {
    //   toast.success('Zalogowano pomyślnie');
    //   window.location.href = redirectTo;
    // }

    console.log("Login form submitted:", values, "Redirect to:", redirectTo);

    // Temporary: simulate success after 1 second
    setTimeout(() => {
      setIsSubmitting(false);
      alert("Login UI ready - Backend integration pending");
    }, 1000);
  };

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Zaloguj się do Vestilook</CardTitle>
        <CardDescription>Wprowadź swoje dane, aby uzyskać dostęp do konta</CardDescription>
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

          <div className="space-y-2">
            <Label htmlFor="password">Hasło</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-end">
            <a
              href="/auth/reset-password"
              className="text-sm text-primary hover:underline"
            >
              Zapomniałeś hasła?
            </a>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Logowanie..." : "Zaloguj się"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Nie masz jeszcze konta?{" "}
            <a href="/auth/register" className="text-primary hover:underline">
              Zarejestruj się
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
};
