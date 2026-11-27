import { X } from 'lucide-react';

import { Notice } from '@/components/inspector/notes';
import { Button } from '@/components/ui/button';

export const ErrorBanner = ({ message, onDismiss }: { message: string; onDismiss: () => void }) => {
  return (
    <Notice className="items-center justify-between" role="alert">
      <span>{message}</span>
      <Button variant="ghost" size="icon-sm" aria-label="Dismiss error" onClick={onDismiss}>
        <X size={14} />
      </Button>
    </Notice>
  );
};
