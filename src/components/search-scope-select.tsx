import { Select } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
export const SearchScopeSelect = function SearchScopeSelect({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select.Root
      value={value}
      items={scopes}
      modal={false}
      onValueChange={(next) => {
        if (next !== null) {
          onValueChange(next);
        }
      }}
    >
      <Select.Trigger
        className={cn(
          'flex shrink-0 grow-0 basis-33 items-center justify-between [grid-area:mode]',
          'h-7 w-33 gap-2 pr-2 pl-0',
          'text-detail whitespace-nowrap text-foreground',
          'bg-background outline-none',
          'focus-visible:shadow-[inset_0_0_0_2px_var(--ring)] data-[popup-open]:bg-muted',
          'narrow:relative narrow:h-9 narrow:rounded-sm narrow:bg-muted narrow:before:absolute narrow:before:-inset-x-0.5 narrow:before:-inset-y-1 narrow:data-[popup-open]:bg-accent',
          'max-w360:w-full max-w360:px-2.5 max-w360:text-body',
          'w360-w900:w-auto w360-w900:max-w-26 w360-w900:gap-1 w360-w900:px-2 w360-w900:text-small'
        )}
        aria-label="Search scope"
      >
        <span className="flex items-center gap-2 w360-w900:min-w-0">
          <span className="text-body leading-none font-normal text-border narrow:hidden" aria-hidden="true">
            |
          </span>
          <Select.Value className="w360-w900:min-w-0 w360-w900:overflow-hidden w360-w900:text-ellipsis w360-w900:whitespace-nowrap" />
        </span>
        <Select.Icon className="flex text-muted-foreground">
          <ChevronDown size={14} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="z-60" sideOffset={6} align="end" alignItemWithTrigger={false} collisionPadding={12}>
          <Select.Popup
            data-search-scope-popup=""
            className={cn(
              'overflow-auto',
              'max-h-(--available-height) min-w-[max(180px,var(--anchor-width))]',
              'bg-background p-1 text-foreground',
              'rounded-md border shadow-menu outline-none'
            )}
          >
            <Select.List>
              {scopes.map((scope) => {
                return (
                  <Select.Item
                    className={cn(
                      'flex min-h-8 items-center justify-between',
                      'gap-5 px-2.5 py-1.5 text-small',
                      'cursor-pointer rounded-[4px] outline-none',
                      'data-[highlighted]:bg-muted data-[selected]:text-reference',
                      'narrow:min-h-11'
                    )}
                    key={scope.value}
                    value={scope.value}
                    aria-label={scope.label}
                  >
                    <span className="flex min-w-0 flex-col gap-px">
                      <Select.ItemText>{scope.label}</Select.ItemText>
                      <span className="text-detail leading-[1.3] text-muted-foreground">{scope.hint}</span>
                    </span>
                    <Select.ItemIndicator className="flex">
                      <Check size={14} />
                    </Select.ItemIndicator>
                  </Select.Item>
                );
              })}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
};
const scopes = [
  { hint: 'Object IDs, labels and types', label: 'Objects', value: 'objects' },
  { hint: 'Dictionary key names', label: 'Keys', value: 'keys' },
  { hint: 'Words as shown on pages', label: 'Page text', value: 'pageText' },
  { hint: 'Raw file bytes as Latin-1 text', label: 'File text', value: 'text' },
  { hint: 'Hexadecimal byte sequences', label: 'File hex', value: 'hex' },
  { hint: 'Content after decompression', label: 'Decoded streams', value: 'decoded' },
];
