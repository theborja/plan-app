## Visual Consistency Checklist

1. **Global tokens** (already in `app/globals.css`) — confirm all pages use `--surface`, `--foreground`, `--primary-start/end`, `--border`, `--muted`, `--shadow-soft`, and accessible focus outlines.
2. **Cards and sheets** — ensure cards include `rounded-[var(--radius-card)]`, border, and `shadow-[var(--shadow-soft)]`; bottom sheets use gradient overlay and base styles from `components/BottomSheet.tsx`.
3. **Typography** — headers use bold, body uses regular; buttons `uppercase` semibold; inputs and pills sized per tokens.
4. **Spacing sequence** — sections use `space-y-4`, cards have `p-4`; inner buttons/inputs keep `round-md`.
5. **Route-specific focus**
   - `/today`: header summary, menu card, sheet; check toasts/sheets share gradient.
   - `/workout`: day picker chips, delay before schedule and rest states.
   - `/import`: CTA at top, preview sections, detail toggle.
   - `/settings`: grouped cards with subtitles, exports import + reset.
6. **Feedback states** — empty state uses `components/EmptyState` with optional actions; skeleton is present while fetching; toasts show on actionable events.
7. **Accessibility** — focus outlines exist, button targets >=44px, color contrast matches tokens.

## Next Steps

1. Audit each route for keyboard navigation and ensure bottom sheet traps focus.
2. Add micro-animations (entrance fade/scale) for cards and bottom sheet transitions.
3. Create a short smoke-test script or list verifying import/today/workout/settings flows render with tokens.
