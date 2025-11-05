import { useState } from 'react';
import type { FC } from 'react';
import { toast } from 'sonner';
import { supabaseClient } from '@/db/supabase.client';
import { Button } from '@/components/ui/button';

interface LogoutButtonProps {
  variant?: 'default' | 'ghost' | 'outline' | 'secondary' | 'destructive' | 'link';
  onLogoutStart?: () => void;
  onLogoutComplete?: () => void;
}

export const LogoutButton: FC<LogoutButtonProps> = ({
  variant = 'ghost',
  onLogoutStart,
  onLogoutComplete,
}) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    onLogoutStart?.();

    try {
      const { error } = await supabaseClient.auth.signOut();

      if (error) {
        toast.error('Wystąpił problem podczas wylogowywania.');
        setIsLoggingOut(false);
        return;
      }

      toast.success('Wylogowano pomyślnie');
      onLogoutComplete?.();
      window.location.href = '/auth/login';
    } catch (err) {
      console.error('Logout error:', err);
      toast.error('Wystąpił problem podczas wylogowywania.');
      setIsLoggingOut(false);
    }
  };

  return (
    <Button variant={variant} onClick={handleLogout} disabled={isLoggingOut}>
      {isLoggingOut ? 'Wylogowywanie...' : 'Wyloguj się'}
    </Button>
  );
};
