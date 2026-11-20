import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';

export const ErrorBanner = ({ message, onDismiss }: { message: string; onDismiss: () => void }) => (
  <div className="error-banner" role="alert">
    <span>{message}</span>
    <Button variant="ghost" size="icon-sm" aria-label="Dismiss error" onClick={onDismiss}>
      <X size={14} />
    </Button>
  </div>
);
