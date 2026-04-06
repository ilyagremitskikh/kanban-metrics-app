interface Props {
  message: string;
  type: 'info' | 'error' | 'success' | 'hidden';
}

const STYLES: Record<string, string> = {
  info:    'bg-blue-50 text-blue-800 border border-blue-200',
  error:   'bg-red-50 text-red-800 border border-red-200',
  success: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
};

export function StatusBar({ message, type }: Props) {
  if (type === 'hidden') return null;
  return (
    <div className={`px-4 py-2.5 rounded-lg mt-4 text-sm flex items-center gap-2 ${STYLES[type]}`}>
      {message}
    </div>
  );
}
