import { Select } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"

const scopes = [
  { value: "objects", label: "Objects" },
  { value: "keys", label: "Keys" },
  { value: "pageText", label: "Page text" },
  { value: "text", label: "File text" },
  { value: "hex", label: "File hex" },
  { value: "decoded", label: "Decoded streams" },
]

export function SearchScopeSelect({
  value,
  onValueChange,
}: {
  value: string
  onValueChange: (value: string) => void
}) {
  return (
    <Select.Root
      value={value}
      items={scopes}
      modal={false}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next)
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
                <Select.Item
                  className="search-scope-option"
                  key={scope.value}
                  value={scope.value}
                >
                  <Select.ItemText>{scope.label}</Select.ItemText>
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
  )
}
