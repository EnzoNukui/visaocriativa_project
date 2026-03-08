

## Dashboard Card Alignment Fix

### What changes
Single file: `src/pages/Dashboard.tsx`

### Grid container (line 61)
Change from `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8` to:
```
grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-4 items-stretch
```

### Each Card wrapper
Add `h-full min-h-[100px] overflow-hidden` to every `<Card>` className.

### Each CardContent
Change from `p-5 flex items-center gap-4` to:
```
p-4 flex items-center gap-3 h-full
```

### Icon containers
Change from `w-11 h-11` to `w-10 h-10` and add `flex-shrink-0`.

### Text wrapper div (right side of each card)
Add `flex flex-col justify-center` to the div wrapping label + value.

### Label text (all `<p>` with "text-xs text-muted-foreground")
Change to:
```
text-xs text-muted-foreground leading-tight whitespace-nowrap overflow-hidden text-ellipsis
```

### Value text (all value `<p>` tags)
Normalize all to `text-lg font-bold leading-tight` (some currently use `text-2xl` or `text-xl`), preserving any color classes like `text-green-600` or `text-yellow-700`.

### Summary
- 8 cards affected, all get identical internal structure
- No changes to data, colors, icons, order, or visibility logic
- Purely CSS class adjustments

