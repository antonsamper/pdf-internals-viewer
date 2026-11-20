import { Select } from '@base-ui/react/select';
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
      <Select.Trigger className="search-mode" aria-label="Search scope">
        <span className="search-mode-label">
          <span className="search-mode-divider" aria-hidden="true">
            |
          </span>
          <Select.Value />
        </span>
        <Select.Icon>
          <ChevronDown size={14} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          className="search-scope-positioner"
          sideOffset={6}
          align="end"
          alignItemWithTrigger={false}
          collisionPadding={12}
        >
          <Select.Popup className="search-scope-popup">
            <Select.List>
              {scopes.map((scope) => (
                <Select.Item className="search-scope-option" key={scope.value} value={scope.value} aria-label={scope.label}>
                  <span className="search-scope-text">
                    <Select.ItemText>{scope.label}</Select.ItemText>
                    <span className="search-scope-hint">{scope.hint}</span>
                  </span>
                  <Select.ItemIndicator>
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
