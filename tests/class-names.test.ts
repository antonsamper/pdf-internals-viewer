import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { cn } from '../src/lib/utils';

// Read the scale from the theme, so a size added there but not to `cn`'s font-size group fails here.
const theme = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const sizes = [...theme.matchAll(/--text-([a-z]+):/g)].map((match) => match[1]);

describe('cn with the type scale', () => {
  it('reads the scale from the theme', () => {
    expect(sizes).toContain('detail');
  });

  it.each(sizes)('keeps text-%s next to a text colour', (size) => {
    expect(cn(`text-${size}`, 'text-muted-foreground')).toBe(`text-${size} text-muted-foreground`);
    expect(cn('text-foreground', `text-${size}`)).toBe(`text-foreground text-${size}`);
  });

  it('lets a later size replace an earlier one', () => {
    expect(cn('text-body', 'text-detail')).toBe('text-detail');
    expect(cn('text-detail', 'text-xs')).toBe('text-xs');
    expect(cn('text-[11px]', 'text-small')).toBe('text-small');
    expect(cn('narrow:text-reading', 'narrow:text-body')).toBe('narrow:text-body');
  });

  it('keeps a line height on either side of a size', () => {
    expect(cn('leading-[1.7]', 'text-detail')).toBe('leading-[1.7] text-detail');
    expect(cn('text-detail', 'leading-[inherit]')).toBe('text-detail leading-[inherit]');
    expect(cn('leading-normal', 'text-xs')).toBe('leading-normal text-xs');
  });

  it('lets a size with a line-height modifier replace an earlier leading', () => {
    expect(cn('leading-7', 'text-small/6')).toBe('text-small/6');
  });
});

// The app's own shadows, read from the theme so a token missing from `cn`'s shadow scale fails here.
const shadows = [...theme.matchAll(/--shadow-([a-z-]+):/g)].map((match) => match[1]);

describe('cn with the theme shadows and radii', () => {
  it('reads the shadows from the theme', () => {
    expect(shadows).toContain('popover');
  });

  it.each(shadows)('merges shadow-%s as a shadow, not a shadow colour', (shadow) => {
    expect(cn(`shadow-${shadow}`, 'shadow-none')).toBe('shadow-none');
    expect(cn('shadow-none', `shadow-${shadow}`)).toBe(`shadow-${shadow}`);
    expect(cn('shadow-md', `shadow-${shadow}`)).toBe(`shadow-${shadow}`);
    expect(cn(`shadow-${shadow}`, 'shadow-reference')).toBe(`shadow-${shadow} shadow-reference`);
  });

  it.each(['xs', 'sm', 'md', 'lg'])('lets rounded-none replace rounded-%s and back', (radius) => {
    expect(cn(`rounded-${radius}`, 'rounded-none')).toBe('rounded-none');
    expect(cn('rounded-none', `rounded-${radius}`)).toBe(`rounded-${radius}`);
  });
});
