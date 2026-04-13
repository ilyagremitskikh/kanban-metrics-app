import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  message: string;
  type: 'info' | 'error' | 'success' | 'hidden';
}

const VARIANTS = {
  info: 'info',
  error: 'destructive',
  success: 'success',
} as const;

const TITLES = {
  info: 'Статус',
  error: 'Ошибка',
  success: 'Готово',
};

export function StatusBar({ message, type }: Props) {
  if (type === 'hidden') return null;
  return (
    <Alert variant={VARIANTS[type]}>
      <AlertDescription>
        <span className="mr-2 font-semibold">{TITLES[type]}:</span>
        {message}
      </AlertDescription>
    </Alert>
  );
}
