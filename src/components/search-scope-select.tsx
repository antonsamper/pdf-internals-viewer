import { Select } from '@base-ui/react/select';
import { cn } from 'cn';
import { Check, ChevronDown } from 'lucide-react';
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
        if (next !== null) onValueChange(next);
      }}
    >
      <Select.Trigger
        className={cn(
          'flex flex-[0_0_132px] items-center justify-between [grid-area:mode]',
          'h-7 w-[132px]',
          'gap-2 pr-2 pl-0',
          'whitespace-nowrap text-foreground',
          'bg-background',
          'focus-visible:shadow-[inset_0_0_0_2px_var(--ring)] data-[popup-open]:bg-muted',
          'text-[11px]! outline-none!',
          'max-w900:relative max-w900:h-9 max-w900:rounded-[6px] max-w900:bg-muted max-w900:before:absolute max-w900:before:-inset-x-0.5 max-w900:before:-inset-y-1 max-w900:data-[popup-open]:bg-accent',
          'max-w360:w-full max-w360:px-2.5 max-w360:text-[13px]!',
          'min-w360:max-w900:w-auto min-w360:max-w900:max-w-[104px] min-w360:max-w900:gap-1 min-w360:max-w900:px-2 min-w360:max-w900:text-[12px]!'
        )}
        aria-label="Search scope"
      >
        <span className="flex items-center gap-2 min-w360:max-w900:min-w-0">
          <span className={cn('text-[13px] leading-none font-normal text-border', 'max-w900:hidden')} aria-hidden="true">
            |
          </span>
          <Select.Value className="min-w360:max-w900:min-w-0 min-w360:max-w900:overflow-hidden min-w360:max-w900:text-ellipsis min-w360:max-w900:whitespace-nowrap" />
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
              'p-1',
              'text-foreground',
              'bg-background',
              'rounded-[8px] border shadow-[0_8px_24px_rgb(25_12_40_/_16%)] outline-none'
            )}
          >
            <Select.List>
              {scopes.map((scope) => (
                <Select.Item
                  className={cn(
                    'flex items-center justify-between',
                    'min-h-8',
                    'gap-5 px-2.5 py-1.5',
                    'text-[12px]',
                    'rounded-[4px] outline-none',
                    'cursor-pointer',
                    'data-[highlighted]:bg-muted data-[selected]:text-(--reference)',
                    'max-w900:min-h-11'
                  )}
                  key={scope.value}
                  value={scope.value}
                  aria-label={scope.label}
                >
                  <span className="flex min-w-0 flex-col gap-px">
                    <Select.ItemText>{scope.label}</Select.ItemText>
                    <span className="text-[11px] leading-[1.3] text-muted-foreground">{scope.hint}</span>
                  </span>
                  <Select.ItemIndicator className="flex">
                    <Check size={14} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
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
