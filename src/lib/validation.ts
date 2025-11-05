import { z } from 'zod';

/**
 * Validation schemas for authentication forms
 * Based on auth-spec.md section 2.3
 */

// Email validation
export const emailSchema = z.string().email('Nieprawidłowy format adresu email');

// Password validation for login (min 6 chars for backward compatibility)
export const loginPasswordSchema = z.string().min(6, 'Hasło musi mieć co najmniej 6 znaków');

// Password validation for registration (min 8 chars with complexity)
export const registerPasswordSchema = z
  .string()
  .min(8, 'Hasło musi mieć co najmniej 8 znaków')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Hasło musi zawierać wielką literę, małą literę oraz cyfrę',
  );

// Login form schema
export const loginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

// Registration form schema
export const registerSchema = z
  .object({
    email: emailSchema,
    password: registerPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Hasła muszą być identyczne',
    path: ['confirmPassword'],
  });

// Reset password request schema
export const resetPasswordRequestSchema = z.object({
  email: emailSchema,
});

// Update password schema
export const updatePasswordSchema = z
  .object({
    password: registerPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Hasła muszą być identyczne',
    path: ['confirmPassword'],
  });

// Type exports
export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type ResetPasswordRequestFormValues = z.infer<typeof resetPasswordRequestSchema>;
export type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>;

// Validation helper functions
export function validateEmail(email: string): { valid: boolean; error?: string } {
  const result = emailSchema.safeParse(email);
  return result.success ? { valid: true } : { valid: false, error: result.error.errors[0].message };
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  const result = registerPasswordSchema.safeParse(password);
  return result.success ? { valid: true } : { valid: false, error: result.error.errors[0].message };
}
