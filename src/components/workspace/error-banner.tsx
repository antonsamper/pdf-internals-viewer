import { cn } from 'cn';
import { X } from 'lucide-react';

import { NOTICE } from '@/components/inspector-styles';
import { Button } from '@/components/ui/button';

export const ErrorBanner = ({ message, onDismiss }: { message: string; onDismiss: () => void }) => (
  <div className={cn(NOTICE, 'items-center justify-between')} role="alert">
    <span>{message}</span>
    <Button variant="ghost" size="icon-sm" aria-label="Dismiss error" onClick={onDismiss}>
      <X size={14} />
    </Button>
  </div>
);
