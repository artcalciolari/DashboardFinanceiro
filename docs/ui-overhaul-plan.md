# Saldo Claro — UI Overhaul Plan ("Quiet Ledger")

> **Audience:** this document is a complete, self-contained implementation brief for the
> engineer/agent executing the redesign. It assumes zero prior knowledge of the decisions
> behind it. Follow it literally. Where a choice is not specified, prefer the conservative
> option and keep the existing behavior.

---

## 1. Mission

Rebuild the visual layer of the `frontend/` React app so it feels like a high-end,
modern fintech product (reference points: **Mercury**, **Ramp**, **Linear**, **Copilot
Money**, **Wise**) — quiet, editorial, precise — while keeping every piece of
functionality, every route, every pt-BR string, and the entire test suite intact.

This is a **reskin + refinement**, not a re-architecture. No new runtime dependencies.
No routing changes. No API changes. No state-management changes.

### 1.1 Design concept

**"Quiet Ledger"** — a premium personal-finance dashboard with an editorial voice:

- **Restrained color.** A warm bone canvas, white cards, hairline borders. The deep
  forest green is reserved for the sidebar, the hero card, and primary actions. Lime is
  an *accent* used sparingly (active states, sparkline, badges, selection) — it should
  feel like a highlighter, never wallpaper.
- **Decisive typography.** Big tabular display numerals for money, tiny uppercase
  "eyebrow" labels for section context, one consistent body size.
- **Depth through subtlety.** 1px hairlines + near-invisible resting shadows; elevation
  appears on hover and in overlays. No heavy drop shadows on static cards.
- **Soft, fast motion.** 120–280 ms entrances with an ease-out-expo curve; everything
  respects `prefers-reduced-motion`.
- **Density with air.** Compact 13–13.5px UI text, but generous padding inside cards
  and clear vertical rhythm between sections.

### 1.2 What is wrong with the current UI (audit)

| Area | Problem |
|---|---|
| Sidebar + hero card + month picker | Three large dark-green blocks compete; no hierarchy. |
| Cards | 20px radius + flat borders read "generic Tailwind template". No hover feedback anywhere. |
| KPI cards | Plain; labels and values share similar sizes; weak hierarchy. |
| Charts | Default recharts look: square legend icons, harsh gridlines, default tooltip. |
| Loading states | Plain "Carregando..." text — feels unfinished. |
| Empty states | Inconsistent (some dashed boxes, some plain text, some icons). |
| Transactions list | Rows are fine but undifferentiated; totals float unanchored at top-right. |
| Focus states | Inconsistent; some elements have no visible keyboard focus. |
| Motion | Single `sc-rise` keyframe; modals and overlays feel abrupt. |

---

## 2. Hard constraints (read first — violating these breaks CI)

1. **All user-facing pt-BR strings stay byte-identical.** Tests query by text and by
   `aria-label`. Protected examples (non-exhaustive): `Saldo Claro`, `Finanças
   pessoais`, `Visão geral`, `Transações`, `Contas & cartões`, `Categorias`,
   `Parcelamentos`, `Assinaturas`, `Alertas`, `Nova transação`, `Exportar`, `Hoje`,
   `Buscar transações`, `Mês anterior`, `Próximo mês`, `Carregando...` (keep the string
   even if rendered inside a skeleton wrapper — see §10), `Carregar mais`, `Limpar
   filtros`, `Filtros`, `Tentar novamente`, page titles (`Transações`, …), widget
   titles (`Suas contas`, `Comprometido este mês`, `Alertas de gastos`, `Onde você
   gastou`, `Fluxo & saldo acumulado`), `Ver todos`, `Nenhum parcelamento ativo`, etc.
   **Rule of thumb: if a test fails on a text/label query, you changed protected copy —
   revert your copy change, never the test.**
2. **Class-name assertions that MUST keep passing** (do not remove these classes from
   these elements):
   - `src/components/ui/Button.test.tsx`: secondary variant keeps `bg-white`; danger
     keeps `bg-expense/10`; ghost keeps `hover:bg-chip`; loading spinner keeps
     `.animate-spin`.
   - `src/pages/Accounts.test.tsx`: each account card wrapper keeps the `.card` class
     (`getByText('Cartão XP').closest('.card')`).
   - `src/components/Dashboard/ActiveInstallmentsWidget.test.tsx`: the progress bar
     keeps `bg-income` when `pct >= 75` (queried via `document.querySelector('.bg-income')`).
3. **100% coverage gate.** `pnpm run test:coverage` enforces 100% lines/functions/
   branches/statements on `src/**`. **Every new file you create needs a test file with
   full branch coverage. Every new conditional branch you add to an existing file needs
   a test.** Specs for the new tests are in §13.
4. **Tailwind v3** (`tailwind.config.js` + `@apply` in `index.css`). Do not migrate to
   v4, do not add CSS-in-JS, do not add component libraries.
5. Keep `recharts`, `lucide-react`, `clsx`, `tailwind-merge` — no new dependencies.
6. Keep all existing ARIA attributes and focus-trap logic in `Modal.tsx`; you may add
   attributes, never remove them.
7. Keep the `sc-rise` keyframe name (referenced by `Layout.tsx` via arbitrary value).
8. Do not touch `src/services/`, `src/context/`, `src/types/`, `src/utils/` (except
   purely additive helpers if truly needed), `App.tsx` routes, or `main.tsx`.
9. Verification after **every** phase: `cd frontend && pnpm test && pnpm run build`.
   Before finishing: `pnpm run test:coverage` must be green at 100%.

---

## 3. Design tokens

### 3.1 Color palette (exact hex values)

| Token | Value | Usage |
|---|---|---|
| `ink` | `#0F1F19` | Primary text |
| `muted` | `#5A6861` | Secondary text |
| `faint` | `#8B968F` | Tertiary text, placeholders |
| `forest` | `#0B3529` | Primary buttons, sidebar base, key accents |
| `forest.hover` | `#082A20` | Primary button hover |
| `forest.deep` | `#06231B` | Sidebar/hero gradient end, overlay tint |
| `forest.soft` | `#EAF1ED` | Tinted chips/badges on light surfaces |
| `lime` | `#C8F169` | Accent: active nav, sparkline, badges, selection |
| `lime.strong` | `#B5E04C` | Accent hover |
| `lime.soft` | `#F2FAD9` | Accent tint backgrounds |
| `paper` | `#F5F4EF` | App canvas |
| `card` | `#FFFFFF` | Card surface |
| `border` | `#E6E4DB` | Hairline borders |
| `border.faint` | `#EFEDE4` | Inner row separators |
| `chip` | `#EFEDE4` | Inset fills (segmented controls, progress tracks) |
| `income` | `#0E7A50` | Positive amounts |
| `expense` | `#BE4A33` | Negative amounts, destructive |
| `amber` | `#A8741A` | Warning states |
| `category.*` | unchanged | Keep existing seven category tokens as-is |

### 3.2 Typography

Fonts stay: **Bricolage Grotesque** (display, 500–800) + **Instrument Sans** (UI,
400–600) via the existing Google Fonts import.

Named scale (add to `tailwind.config.js` `fontSize`; use these utilities everywhere
instead of ad-hoc pixel values):

| Utility | Spec | Usage |
|---|---|---|
| `text-display-xl` | 40px / 44px / 700 / -0.02em | Hero balance numeral |
| `text-display-lg` | 28px / 34px / 700 / -0.015em | Page titles |
| `text-display-md` | 22px / 28px / 700 / -0.01em | KPI values, modal titles |
| `text-eyebrow` | 11px / 14px / 600 / +0.07em, uppercase | Section eyebrows, card overlines |
| (default body) | 13–13.5px / 20px / 400–500 | UI text |
| micro | 11.5–12px / 15px / 500 | Captions, metadata |

Rules:
- All monetary amounts get the existing `.tabular` class (`font-variant-numeric:
  tabular-nums`).
- Page titles: `font-display text-display-lg`.
- Card titles: `font-display text-[15px] font-semibold` (unchanged size, keep).
- Eyebrow labels are always paired with `uppercase` and a `text-faint`/`text-muted`
  color.

### 3.3 Radii, shadows, motion

| Token | Value |
|---|---|
| `rounded-card` | **16px** (down from 20px — tighter, more modern) |
| `rounded-control` | **10px** (down from 12px) |
| `rounded-pill` | **999px** (true pill; was 20px) |
| `shadow-card` | `0 1px 2px rgba(15,31,25,0.05)` |
| `shadow-card-hover` | `0 10px 28px -10px rgba(15,31,25,0.14)` |
| `shadow-popover` | `0 12px 32px -8px rgba(15,31,25,0.18)` |
| `shadow-modal` | `0 24px 64px -12px rgba(6,35,27,0.35)` |
| `shadow-focus-forest` | `0 0 0 3px rgba(11,53,41,0.12)` (keep name; used by inputs) |
| `shadow-focus-lime` | `0 0 0 3px rgba(200,241,105,0.35)` (focus on dark surfaces) |
| easing `ease-out-expo` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| durations | hover 120–150ms · entrances 200–280ms · route rise 350ms |

---

## 4. File: `frontend/tailwind.config.js` (full replacement)

Replace the file with exactly this (values from §3; keyframes stay in CSS — see §5):

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0F1F19',
        muted: '#5A6861',
        faint: '#8B968F',
        forest: {
          DEFAULT: '#0B3529',
          hover: '#082A20',
          deep: '#06231B',
          soft: '#EAF1ED',
        },
        lime: {
          DEFAULT: '#C8F169',
          strong: '#B5E04C',
          soft: '#F2FAD9',
        },
        paper: '#F5F4EF',
        card: '#FFFFFF',
        border: {
          DEFAULT: '#E6E4DB',
          faint: '#EFEDE4',
        },
        chip: '#EFEDE4',
        income: '#0E7A50',
        expense: '#BE4A33',
        amber: '#A8741A',
        category: {
          moradia: '#0C3B2E',
          alimentacao: '#12664A',
          transporte: '#2E8B63',
          lazer: '#57A97F',
          saude: '#86C6A0',
          assinaturas: '#B7844A',
          outros: '#9AA39B',
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Instrument Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['40px', { lineHeight: '44px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-lg': ['28px', { lineHeight: '34px', letterSpacing: '-0.015em', fontWeight: '700' }],
        'display-md': ['22px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '700' }],
        eyebrow: ['11px', { lineHeight: '14px', letterSpacing: '0.07em', fontWeight: '600' }],
      },
      borderRadius: {
        card: '16px',
        control: '10px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,31,25,0.05)',
        'card-hover': '0 10px 28px -10px rgba(15,31,25,0.14)',
        popover: '0 12px 32px -8px rgba(15,31,25,0.18)',
        modal: '0 24px 64px -12px rgba(6,35,27,0.35)',
        'focus-forest': '0 0 0 3px rgba(11,53,41,0.12)',
        'focus-lime': '0 0 0 3px rgba(200,241,105,0.35)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      animation: {
        'sc-rise': 'sc-rise .35s cubic-bezier(0.22,1,0.36,1) both',
        'sc-fade': 'sc-fade .25s ease both',
        'sc-scale-in': 'sc-scale-in .22s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};
```

> Note: `lime` becomes a color scale. Every existing usage is `bg-lime`, `text-lime`,
> `bg-lime/[0.14]` etc., which keeps working because `DEFAULT` is defined. Search for
> `lime-` usages after the change to confirm nothing referenced a bare `lime-strong`
> before (it doesn't exist today).

---

## 5. File: `frontend/src/index.css` (full replacement)

Keep the font import, keep keyframes `sc-rise` (name referenced by `Layout.tsx`), add
the rest as written:

```css
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html,
  body,
  #root {
    min-height: 100%;
  }

  * {
    box-sizing: border-box;
  }

  body {
    @apply bg-paper text-ink antialiased;
    font-family: 'Instrument Sans', system-ui, -apple-system, sans-serif;
    margin: 0;
    text-rendering: optimizeLegibility;
  }

  h1, h2, h3 {
    font-family: 'Bricolage Grotesque', system-ui, sans-serif;
  }

  ::selection {
    background: #C8F169;
    color: #0B3529;
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    @apply bg-border rounded-full;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #D8D5C9;
  }

  @keyframes sc-rise {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: none; }
  }

  @keyframes sc-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes sc-scale-in {
    from { opacity: 0; transform: scale(0.97) translateY(6px); }
    to { opacity: 1; transform: none; }
  }

  @keyframes sc-shimmer {
    100% { transform: translateX(100%); }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      scroll-behavior: auto !important;
      transition-duration: 0.01ms !important;
    }
  }
}

@layer components {
  .card {
    @apply bg-card rounded-card border border-border shadow-card p-6;
  }

  /* Interactive card (whole card is clickable / hoverable) */
  .card-interactive {
    @apply card transition-all duration-150 ease-out-expo hover:shadow-card-hover hover:-translate-y-px hover:border-[#DDDAD0];
  }

  .btn-primary {
    @apply bg-forest hover:bg-forest-hover text-white font-semibold py-2.5 px-4 rounded-control shadow-card transition-all duration-150 active:scale-[0.98];
  }

  .btn-secondary {
    @apply bg-white hover:bg-chip text-ink font-semibold py-2.5 px-4 rounded-control border border-border transition-all duration-150 active:scale-[0.98];
  }

  .btn-danger {
    @apply bg-expense/10 hover:bg-expense/20 text-expense font-semibold py-2.5 px-4 rounded-control transition-all duration-150 active:scale-[0.98];
  }

  /* Accent action — use sparingly: header CTA, empty-state CTA */
  .btn-accent {
    @apply bg-lime hover:bg-lime-strong text-forest font-semibold py-2.5 px-4 rounded-control shadow-card transition-all duration-150 active:scale-[0.98];
  }

  .input {
    @apply w-full border border-border rounded-control px-3 py-2 text-sm text-ink bg-white outline-none transition-shadow placeholder:text-faint;
  }

  .input:focus {
    @apply border-forest shadow-focus-forest;
  }

  .label {
    @apply block text-xs font-semibold text-muted mb-1.5;
  }

  .eyebrow {
    @apply text-eyebrow uppercase text-faint;
  }

  .tabular {
    font-variant-numeric: tabular-nums;
  }

  /* Skeleton shimmer block */
  .skeleton {
    @apply relative overflow-hidden rounded-lg bg-chip;
  }

  .skeleton::after {
    content: '';
    @apply absolute inset-0 -translate-x-full;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.65), transparent);
    animation: sc-shimmer 1.4s infinite;
  }

  /* Decorative keyboard hint */
  .kbd {
    @apply inline-flex h-5 items-center rounded-md border border-border bg-paper px-1.5 text-[10.5px] font-semibold text-faint;
  }
}
```

---

## 6. Layout system

### 6.1 `src/components/Layout/Layout.tsx`

- Keep structure (Sidebar → offset main → Header → children → TransactionFormModal).
- Change the sidebar offset from `md:ml-[250px]` to `md:ml-[260px]` (sidebar widens to
  260px, §6.2).
- `<main>`: keep `animate-[sc-rise_.4s_ease_both]` (or swap to the new `animate-sc-rise`
  utility — identical curve), keep responsive padding, and wrap `children` in a width
  container:
  ```tsx
  <main className="flex-1 p-4 pb-24 sm:p-6 md:p-8 md:pb-14 animate-sc-rise">
    <div className="mx-auto w-full max-w-[1280px]">{children}</div>
  </main>
  ```
- `Layout.test.tsx` asserts children text and the `Nova transação` button — both
  unaffected.

### 6.2 `src/components/Layout/Sidebar.tsx` (desktop, `hidden md:flex`)

Width `w-[260px]`. Replace the flat `bg-forest` with a subtle vertical gradient and
refine every region. Keep the `navItems` array, the alerts query, and the badge logic
exactly as-is. Keep both `Saldo Claro` texts (tests use `getAllByText`).

```tsx
<aside className="hidden md:flex flex-col w-[260px] min-h-screen fixed top-0 left-0 z-40 bg-gradient-to-b from-forest to-forest-deep">
  {/* Brand lockup */}
  <div className="flex items-center gap-3 px-6 pt-6 pb-6">
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-lime shadow-[0_4px_12px_rgba(200,241,105,0.25)]">
      <TrendingUp size={19} className="text-forest" strokeWidth={2.5} />
    </div>
    <div className="leading-tight">
      <div className="font-display text-[16.5px] font-bold tracking-tight text-white">Saldo Claro</div>
      <div className="text-[11px] font-medium text-[#6E9584]">Finanças pessoais</div>
    </div>
  </div>

  {/* Section caption */}
  <div className="px-6 pb-2 text-eyebrow uppercase text-[#5E7F70]">Menu</div>

  {/* Nav */}
  <nav className="flex flex-1 flex-col gap-0.5 px-3">
    {navItems.map(({ to, label, icon: Icon, end }) => (
      <NavLink
        key={to}
        to={to}
        end={end}
        className={({ isActive }) =>
          clsx(
            'group relative flex items-center gap-3 rounded-control px-3 py-2.5 text-[13.5px] transition-colors duration-150',
            isActive
              ? 'bg-white/10 font-semibold text-white'
              : 'font-medium text-[#9DBBAD] hover:bg-white/5 hover:text-white'
          )
        }
      >
        {/* render prop children: use the same isActive via NavLink children-as-function
            OR simpler: keep Icon plain and add the active bar via a span rendered
            conditionally with NavLink's className isActive — see note below */}
        <Icon size={18} strokeWidth={2.1} />
        <span className="flex-1">{label}</span>
        {to === '/alerts' && attentionCount > 0 && (
          <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-lime px-1.5 text-[11px] font-bold text-forest">
            {attentionCount}
          </span>
        )}
      </NavLink>
    ))}
  </nav>

  {/* User card */}
  <div className="m-3 flex items-center gap-3 rounded-[14px] border border-white/10 bg-white/5 px-4 py-3.5">
    <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-[#1E5C46] font-display text-[13px] font-bold text-lime">
      SC
    </div>
    <div className="min-w-0 flex-1">
      <div className="truncate text-[13px] font-semibold text-white">Saldo Claro</div>
      <div className="text-[11.5px] text-[#6E9584]">Uso pessoal</div>
    </div>
    <Settings size={16} className="text-[#6E9584] transition-colors hover:text-white" />
  </div>
</aside>
```

**Active-item lime indicator:** the signature detail. `NavLink` supports children as a
function (`{({ isActive }) => ...}`) — use it to render, when active, a
`<span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-lime" />`
as the first child, and give the `Icon` `className={isActive ? 'text-lime' : ''}`.
If you use children-as-function, move the badge inside too (same condition). Keep the
badge text node as the bare count (`getByText('2')` in tests).

### 6.3 Mobile bottom nav (`md:hidden`, same file)

- Bar: `bg-white/90 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)]`.
- Item: keep icon + label. Active: `text-forest` and the icon wrapped in
  `flex h-8 w-14 items-center justify-center rounded-pill bg-forest-soft`; inactive
  icon wrapper transparent. Label `text-[10.5px] font-semibold` when active,
  `font-medium text-faint` otherwise.
- Keep all labels identical (`getAllByText` in `Sidebar.test.tsx` matches both desktop
  and mobile copies).

### 6.4 `src/components/Layout/Header.tsx`

Keep ALL logic (`showsPeriod`, `showsSearch`, `showsExport`, month navigation,
`handleExportCSV`, `openCreate`) and ALL aria-labels/texts (`Mês anterior`, `Próximo
mês`, `Hoje`, `Buscar transações`, `Exportar`, `Nova transação`). Restyle only:

- Bar: `sticky top-0 z-30 border-b border-border bg-paper/80 backdrop-blur-md` (replace
  the hard-coded rgba), padding `px-4 py-3 md:px-8`.
- **Period picker** — segmented control: container `flex items-center gap-0.5
  rounded-control border border-border bg-white p-1 shadow-card`; chevron buttons
  `h-7 w-7 rounded-lg text-muted hover:bg-chip hover:text-ink transition-colors`;
  label `min-w-[120px] text-center text-[13px] font-semibold capitalize text-ink
  tabular`.
- **"Hoje" button**: `h-9 items-center gap-1.5 rounded-control border border-border
  bg-white px-3 text-[13px] font-semibold text-forest hover:bg-chip` — prefix a
  `<span className="h-1.5 w-1.5 rounded-full bg-lime-strong" />` dot.
- **Search**: keep `w-[280px]`; input `h-10 rounded-control border-border bg-white
  pl-9 pr-12 focus:border-forest focus:shadow-focus-forest`; add a decorative
  `<span className="kbd absolute right-3 top-1/2 -translate-y-1/2">⌘K</span>` (purely
  visual, `aria-hidden="true"`, `pointer-events-none`).
- **Exportar**: `btn-secondary` look (white, hairline, `shadow-card`).
- **Nova transação CTA**: switch from forest to the accent style —
  `flex h-10 items-center gap-1.5 rounded-control bg-lime px-4 text-[13.5px] font-bold
  text-forest shadow-card transition-all duration-150 hover:bg-lime-strong
  active:scale-[0.98]`. (Tests query by accessible name `Nova transação` — unchanged.)

---

## 7. UI primitives (`src/components/ui/`)

### 7.1 `Button.tsx`

Keep the variant/size API and the protected classes (§2.2). New maps:

```ts
const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-control ' +
  'transition-all duration-150 active:scale-[0.98] ' +
  'focus-visible:outline-none focus-visible:shadow-focus-forest ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

const variants = {
  primary: 'bg-forest hover:bg-forest-hover text-white shadow-card',
  secondary: 'bg-white hover:bg-chip text-ink border border-border shadow-card',
  danger: 'bg-expense/10 hover:bg-expense/20 text-expense',
  ghost: 'hover:bg-chip text-muted',
  accent: 'bg-lime hover:bg-lime-strong text-forest shadow-card', // NEW variant
};

const sizes = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-[13.5px]',
  lg: 'h-11 px-5 text-sm',
};
```

- Add `accent` to the `variant` union type. **New branch → add a test** in
  `Button.test.tsx`: renders `accent` with `bg-lime`.
- Keep the `Loader2` spinner with `animate-spin` (tested).

### 7.2 `Input.tsx` / `Select.tsx`

- No structural change. The `.input` class already restyles them (§5). Add
  `focus-visible` parity: the `.input:focus` rule covers it.
- Error state: keep `border-expense`; additionally style the message as
  `mt-1.5 flex items-center gap-1 text-xs font-medium text-expense` (no icon import
  needed — keep it text-only to avoid touching tests).

### 7.3 `Modal.tsx`

- Keep ALL behavior (focus trap, Escape, scroll lock, portal, aria).
- Overlay: `bg-forest-deep/50 backdrop-blur-sm animate-sc-fade`.
- Panel: `rounded-[18px] bg-card shadow-modal animate-sc-scale-in` (replaces
  `animate-[sc-rise...]`), keep size map and `max-h` behavior.
- Header: title `font-display text-display-md text-ink`; close button `h-8 w-8
  rounded-lg text-muted hover:bg-chip hover:text-ink transition-colors` (drop the
  default `bg-chip` — cleaner).
- Add a hairline under the header: wrapper `border-b border-border-faint` on the
  header row, and give the content `pt-4`.

### 7.4 `ConfirmDialog.tsx`, `FormError.tsx`, `ColorPicker.tsx`

- `ConfirmDialog`: keep structure; the solid expense confirm button stays
  (`bg-expense text-white hover:bg-expense/90` inline classes already present).
- `FormError`: restyle to `rounded-control border border-expense/25 bg-expense/5 px-3.5
  py-3 text-[13px] font-medium text-expense` (keep `role="alert"`).
- `ColorPicker`: swatches `h-7 w-7 rounded-full transition-transform duration-150
  hover:scale-110`; keep the selected ring style and all aria attributes.

### 7.5 NEW `Skeleton.tsx` (+ test)

```tsx
import { clsx } from 'clsx';

export default function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={clsx('skeleton', className)} />;
}
```

`Skeleton.test.tsx`: renders with the `skeleton` class and merges `className`;
`aria-hidden` is true. (Trivial, keeps the 100% gate.)

### 7.6 NEW `EmptyState.tsx` (+ test)

```tsx
import type { LucideIcon } from 'lucide-react';
import Button from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-soft">
        <Icon size={24} className="text-forest" strokeWidth={1.8} />
      </div>
      <h3 className="font-display text-[16px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-[320px] text-[13px] text-faint">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
```

`EmptyState.test.tsx` must cover all branches: with/without `description`,
with/without action (both `actionLabel`+`onAction` present, and absent), and clicking
the action calls `onAction`.

---

## 8. Data visualization (recharts) restyle

### 8.1 NEW `src/components/Charts/ChartTooltip.tsx` (+ test)

A shared dark-pill tooltip for all recharts charts:

```tsx
import { formatCurrency } from '../../utils/formatters';

interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
}

export default function ChartTooltip({ active, label, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl bg-forest-deep px-3.5 py-2.5 shadow-popover">
      {label && <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#9DBBAD]">{label}</div>}
      <div className="flex flex-col gap-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-[12.5px]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color ?? '#C8F169' }} />
            <span className="text-[#C9D8D0]">{entry.name}</span>
            <span className="tabular ml-auto pl-4 font-semibold text-white">
              {formatCurrency(Number(entry.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Usage: `<Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(11,53,41,0.04)' }} />`.
`ChartTooltip.test.tsx`: returns null when inactive / empty payload; renders label and
formatted rows when active; covers `entry.color` undefined fallback. (All branches.)

### 8.2 `MonthlyChart.tsx`

- Card header pattern (applies to ALL dashboard cards): eyebrow + title + trailing
  slot:
  ```tsx
  <div className="mb-4 flex items-start justify-between">
    <div>
      <div className="eyebrow">Evolução</div>
      <h3 className="mt-1 font-display text-[15px] font-semibold text-ink">Fluxo & saldo acumulado</h3>
    </div>
    {/* custom legend, right-aligned */}
  </div>
  ```
  Wait — the subtitle `Últimos 6 meses` is existing copy; keep it as the eyebrow text
  instead of inventing "Evolução": `<div className="eyebrow">Últimos 6 meses</div>`
  above the title. **Do not invent new visible copy anywhere on this project; only
  restyle existing strings.** (This rule applies globally.)
- Replace recharts `<Legend>` with a custom inline legend (dot + label, `text-[12px]
  text-muted`): Receitas `#3E9E72`, Despesas `#E5A08B`, Acumulado `#0B3529`.
- Grid: `<CartesianGrid stroke="#ECEAE3" strokeDasharray="2 6" vertical={false} />`.
- XAxis: `tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: '#8B968F' }}
  dy={6}`.
- Bars: `barSize={20}`, `radius={[6,6,0,0]}`, fills above.
- Cumulative line: keep `stroke="#0B3529" strokeWidth={2.5}`, dots `r={3.5}` white
  fill; add a subtle area under the line by converting to `ComposedChart` with an
  `<Area>` (same `yAxisId="line"`, `type="monotone"`, `dataKey="cumulative"`,
  `stroke="none"`, `fill="url(#cumGradient)"`) plus
  ```tsx
  <defs>
    <linearGradient id="cumGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#0B3529" stopOpacity={0.10} />
      <stop offset="100%" stopColor="#0B3529" stopOpacity={0} />
    </linearGradient>
  </defs>
  ```
- Height 280. **Loading state: `MonthlyChart.test.tsx` asserts
  `getByText('Carregando...')` — the literal string `Carregando...` must remain in the
  DOM while loading.** Render `<Skeleton className="h-[280px] w-full" />` plus
  `<span className="sr-only">Carregando...</span>` (sr-only text still satisfies
  `getByText`).
- **Adding `<Area>` breaks three test files unless their recharts mocks are updated.**
  `vi.mock('recharts', ...)` in `src/App.test.tsx`, `src/pages/Dashboard.test.tsx`, and
  `src/components/Dashboard/MonthlyChart.test.tsx` each return a stub object that does
  not export `Area`. Add `Area: () => null,` to all three mocks (same style as the
  existing `Bar: () => null,` entries). Do this in the same commit as the chart change.
- Note: the `Tooltip` mock in `MonthlyChart.test.tsx` invokes `formatter` only when the
  prop is passed; switching to `content={<ChartTooltip />}` (no `formatter` prop) keeps
  that mock green with no changes.

### 8.3 `CategoryChart.tsx`

- Same card header pattern; keep `Onde você gastou` / `Despesas por categoria` copy and
  the trailing total.
- Rows: label row (color square `h-2.5 w-2.5 rounded-[4px]`, name `text-[13px]
  font-medium`, right side `tabular text-[13px] font-semibold` + share `%` in
  `text-[11.5px] text-faint`), track `h-2 rounded-pill bg-chip`, fill
  `rounded-pill transition-[width] duration-500 ease-out-expo` with the category color.
- Empty state: keep `Nenhuma despesa neste mês` copy, render via `EmptyState` (icon
  `PieChart`) — check the page test first; if it queries the text, `EmptyState` renders
  it as the title/description so it still matches.

### 8.4 Hero sparkline (in `SummaryCards.tsx`)

- Replace the bare `<polyline>` with an `<svg>` containing a `<defs>` lime gradient, an
  `<polygon>` area fill (`fill="url(#sparkGradient)"`, opacity handled by gradient
  stops `rgba(200,241,105,0.25)` → `0`), the polyline stroke `#C8F169`
  `strokeWidth={2.5}`, and a 3.5px end dot (`fill="#C8F169" stroke="#0B3529"`).

---

## 9. Page specifications

Global page-header pattern for EVERY page (Dashboard, Transactions, Accounts,
Categories, Installments, Subscriptions, Alerts):

```tsx
<div className="mb-6">
  <div className="eyebrow">{/* existing contextual microcopy only, e.g. month */}</div>
  <h1 className="mt-1 font-display text-display-lg tracking-tight text-ink">{/* existing title */}</h1>
  <p className="mt-1 text-[13.5px] text-muted">{/* existing subtitle */}</p>
</div>
```

If a page has no existing eyebrow-suitable string, omit the eyebrow div — **do not
invent copy**. Section spacing: `space-y-5` between card groups; grids `gap-5`.

### 9.1 Dashboard (`pages/Dashboard.tsx` + `components/Dashboard/*`)

- Greeting block: **omit the eyebrow here** (the Dashboard has no existing microcopy
  suitable for it — do not invent one, and do not duplicate the month). Keep `Olá! 👋`
  as `font-display text-display-lg tracking-tight text-ink` and the subtitle sentence
  `Aqui está o resumo de <mês>.` verbatim with its existing `<span className="capitalize">`
  structure (`Dashboard.test.tsx` asserts both `/Olá!/` and `/Aqui está o resumo de/`);
  restyle classes only.
- **Hero card (`SummaryCards`)**: `relative overflow-hidden rounded-card bg-gradient-to-br
  from-forest to-forest-deep p-7 text-white shadow-card-hover`. Keep the radial lime
  glow div (retune to `rgba(200,241,105,0.14)`), add a second faint glow bottom-left
  (`rgba(200,241,105,0.06)`). Label → `eyebrow` style in `text-[#9DBBAD]`. Numeral →
  `text-display-xl tabular` (keep `—` loading placeholder). Delta chip: positive
  `bg-lime/15 text-lime`, negative `bg-white/10 text-white` (unchanged logic).
  Sparkline per §8.4.
- **KPI cards (Receitas / Despesas pessoais)**: `card-interactive` is NOT appropriate
  (not clickable) — use `.card` + header row: eyebrow label + icon chip `h-9 w-9
  rounded-[10px]` (`bg-[#E7F5EC]`/`text-income`, `bg-[#FBEBE6]`/`text-expense` — keep);
  value `text-display-md tabular` colored; subline `text-[12px] text-faint`. Keep all
  copy and `formatSummaryAmount` logic.
- Grid: keep `lg:grid-cols-[1.4fr_1fr_1fr]` for summary, `lg:grid-cols-[1.55fr_1fr]`
  for charts, `lg:grid-cols-2` for widgets; change gaps to `gap-5`.
- **AccountSummaryWidget / ActiveInstallmentsWidget / AlertsWidget**: apply the card
  header pattern (eyebrow = existing subtitle, e.g. `Movimentação líquida do mês`),
  keep every string and the `bg-income` progress class (§2.2). Rows get
  `rounded-lg px-2 py-1.5 -mx-2 hover:bg-paper transition-colors` hover wash.
  AlertsWidget progress bars: track `h-1.5 rounded-pill bg-chip`, fill
  `transition-[width] duration-500`.
- Loading states: skeletons per §10.

### 9.2 Transactions (`pages/Transactions.tsx`)

- Page header per pattern (title `Transações`, subtitle the existing count/month line).
- **Stats strip** (currently three floating numbers top-right): wrap in
  `flex items-center gap-6 rounded-card border border-border bg-card px-5 py-3
  shadow-card`; each stat: label `eyebrow` (`Entradas`/`Saídas`/`Saldo`), value
  `tabular font-display text-[15px] font-bold` with income/expense/ink colors; separate
  stats with `<div className="h-8 w-px bg-border-faint" />`. Keep the exact label
  strings.
- **Segmented control**: container `inline-flex gap-0.5 rounded-[12px] bg-chip p-1`;
  buttons `rounded-[9px] px-4 py-1.5 text-[13px] transition-all duration-150`; active
  `bg-white text-forest font-semibold shadow-card`; inactive `text-muted font-medium
  hover:text-ink`. Keep `Todas`/`Receitas`/`Despesas`.
- **Filtros button**: keep logic + badge; restyle active state to `border-forest/25
  bg-white text-forest shadow-card`.
- **Filters panel**: `rounded-card border border-border bg-card shadow-card px-5 py-4
  animate-sc-fade`; selects keep `selectClass` but update to `h-10 rounded-control
  focus:shadow-focus-forest`.
- **List card**: `overflow-hidden rounded-card border border-border bg-card
  shadow-card`. Rows: `group flex items-center gap-4 border-b border-border-faint px-5
  py-4 transition-colors duration-150 last:border-b-0 hover:bg-[#FAF9F5]`. Icon tile:
  keep the tinted square + category color dot, radius `rounded-[12px]`, size `h-10
  w-10`. Description `text-[13.5px] font-semibold`. Meta line keep separators/badges;
  badges: `rounded-pill px-2 py-0.5 text-[11px] font-semibold` (installment/
  subscription `bg-forest-soft text-forest`; third-party `bg-amber/10 text-amber` —
  keep). Amount: `tabular font-display text-[15px] font-bold` + date `text-[11.5px]
  text-faint`. Hover actions: keep reveal-on-hover (`md:opacity-0
  md:group-hover:opacity-100`), buttons `h-8 w-8 rounded-lg`.
- **Empty state**: use `EmptyState` (icon `Search`), keeping `Nenhuma transação
  encontrada` and the conditional description/`Limpar filtros` action.
- **Error state**: keep copy + `Tentar novamente`; restyle with `EmptyState`-like
  layout (icon `AlertCircle`, `bg-expense/10 text-expense` tile) — inline markup is
  fine.
- **Loading**: skeleton rows (5 × `Skeleton className="h-[68px] w-full"`) — check
  `Transactions.test.tsx` for a `Carregando...` query first and keep an `sr-only` copy
  if asserted.
- `Carregar mais` button: `variant="secondary" size="sm"` (unchanged API).

### 9.3 Accounts (`pages/Accounts.tsx`)

- Page header pattern; keep the summary line (`1 conta(s) · ...`).
- `Nova conta` button → `variant="primary"` with `Plus` icon (keep accessible name).
- Account cards grid `sm:grid-cols-2 xl:grid-cols-3 gap-5`; each card keeps `.card`
  (§2.2) and becomes hoverable: add `transition-all duration-150 hover:shadow-card-hover
  hover:-translate-y-px`. Keep the color chip, type icon, balance display, and the
  `title="Editar conta"` / delete buttons (tests query by title). Card top accent: a
  3px `border-top` bar in the account color is a nice touch — implement as an inner
  `<div className="h-1 w-10 rounded-pill" style={{ backgroundColor: account.color }} />`
  above the name (do NOT remove existing color usage).
- Credit-card utilization bars (if present): track `h-1.5 bg-chip rounded-pill`.
- Empty/loading per §10 (icon `Wallet`).

### 9.4 Categories (`pages/Categories.tsx`)

- Two groups (Receitas/Despesas) — keep group headings and all copy.
- Category rows/cards: color dot `h-3 w-3 rounded-[4px]`, name `text-[13.5px]
  font-semibold`, hover wash `hover:bg-paper rounded-lg transition-colors`; edit/delete
  icon buttons reveal on hover like Transactions.
- Empty/loading per §10 (icon `Tag`).

### 9.5 Installments (`pages/Installments.tsx`)

- Keep the stats line and all tab logic (Ativos/Finalizados/Cancelados — exact existing
  labels).
- Installment cards: `.card` + hover elevation; progress bar track `h-2 rounded-pill
  bg-chip`, fill `bg-forest` → `bg-income` when ≥75% (mirror the widget rule),
  `transition-[width] duration-500 ease-out-expo`. Keep `Parcela X/Y`, amounts, dates,
  and all action buttons' accessible names.
- Empty/loading per §10 (icon `Calendar`).

### 9.6 Subscriptions (`pages/Subscriptions.tsx`)

- Keep the monthly-total summary and all copy.
- Subscription rows: keep the initials avatar; refine to `h-10 w-10 rounded-[12px]
  bg-forest-soft font-display text-[13px] font-bold text-forest`. Status badges:
  active `bg-forest-soft text-forest`, inactive `bg-chip text-faint` — keep existing
  badge text.
- Empty/loading per §10 (icon `RefreshCw`).

### 9.7 Alerts (`pages/Alerts.tsx`)

- Keep all copy (`Alertas`, form labels, `Bell`/`BellOff` states).
- Alert cards/rows: status icon in tinted tile (`bg-expense/10 text-expense` triggered,
  `bg-amber/10 text-amber` warning, `bg-forest-soft text-income` ok), progress bar
  `h-1.5 rounded-pill bg-chip` with fill `bg-expense`/`bg-amber` per state,
  `transition-[width] duration-500`.
- Empty/loading per §10 (icon `Bell`).

---

## 10. Loading, empty, and error states (global)

1. **Loading**: replace every centered `Carregando...` text block with `Skeleton`
   blocks shaped like the content (card lists → 4–5 rows `h-[64px]`; charts → one block
   matching chart height; KPIs → `h-6 w-24` label + `h-9 w-32` value).
   **Before removing any `Carregando...` text, grep the corresponding test file for
   `Carregando`.** If asserted, keep `<span className="sr-only">Carregando...</span>`
   inside the loading container.
2. **Empty**: route every empty state through `EmptyState` (§7.6) with the page's
   existing copy. Dashed-border boxes (e.g. `Nenhum parcelamento ativo` in the widget)
   may stay dashed inside cards — just harmonize padding/typography.
3. **Error**: keep `getApiErrorMessage` output and retry buttons; present with the
   error-tile pattern (§9.2).

---

## 11. Accessibility & polish checklist

- Every interactive element: visible `focus-visible` ring (`shadow-focus-forest` on
  light surfaces, `shadow-focus-lime` on the dark sidebar/hero).
- Icon-only buttons keep their `aria-label`/`title` (tests depend on several).
- Color is never the only signal: income/expense amounts keep their `+`/`-` prefixes.
- Contrast: `faint` (#8B968F) only for text ≥12px or non-essential meta; body text uses
  `muted` minimum.
- All new animations are covered by the existing `prefers-reduced-motion` reset.
- Touch targets ≥ 36px on mobile (bottom nav already qualifies; keep row action
  buttons at `h-9 w-9` minimum on `md:` and up, always visible on touch).

---

## 12. Implementation phases (execute in order; verify after each)

| Phase | Scope | Verify |
|---|---|---|
| 0 | `tailwind.config.js` + `index.css` replacement (§4, §5) | `pnpm test && pnpm run build` green; visual smoke: app renders, fonts load |
| 1 | Primitives: Button (+accent, +test), Input, Select, Modal, ConfirmDialog, FormError, ColorPicker; new `Skeleton` + `EmptyState` (+tests) | `pnpm test` green incl. new tests |
| 2 | Layout: Sidebar (desktop + mobile nav), Header, Layout container | `pnpm test` green; check `Sidebar/Header/Layout` tests |
| 3 | Charts: `ChartTooltip` (+test), MonthlyChart, CategoryChart, hero sparkline | `pnpm test` green |
| 4 | Dashboard page + all 5 widgets | `pnpm test` green |
| 5 | Transactions page | `pnpm test` green |
| 6 | Accounts, Categories, Installments, Subscriptions, Alerts pages | `pnpm test` green |
| 7 | Polish pass: §11 checklist, skeleton/empty-state consistency, spacing audit | `pnpm run test:coverage` = 100% on all four metrics; `pnpm run build` green |

Commands (from `frontend/`): `pnpm test` · `pnpm run test:coverage` · `pnpm run build`
(tsc + vite build — this is the effective lint; fix every type error).

Manual visual QA after Phase 7 (dev servers: backend `:3001`, frontend `:5173`):
screenshot `/`, `/transactions`, `/accounts`, `/categories`, `/installments`,
`/subscriptions`, `/alerts` at desktop (1440px) and mobile (390px) widths; verify:
hover states, focus rings (Tab through each page), modal entrance, sidebar active
indicators, chart tooltips, skeleton shimmer, reduced-motion (DevTools rendering
toggle).

---

## 13. Test changes inventory

**New test files (required for the 100% gate):**
- `src/components/ui/Skeleton.test.tsx` — class merge, `aria-hidden`.
- `src/components/ui/EmptyState.test.tsx` — all prop branches + action click.
- `src/components/Charts/ChartTooltip.test.tsx` — inactive/null payload → null; active
  → label + rows; color fallback branch.

**Existing tests to extend:**
- `Button.test.tsx` — add accent-variant case (`bg-lime`).
- `src/App.test.tsx`, `src/pages/Dashboard.test.tsx`,
  `src/components/Dashboard/MonthlyChart.test.tsx` — add `Area: () => null,` to each
  `vi.mock('recharts', ...)` return object (required by the §8.2 `<Area>` addition).
- Any component where you add a conditional branch (e.g. skeleton vs text loading) —
  extend its existing test file.

**Known loading-text assertion:** `MonthlyChart.test.tsx` asserts
`getByText('Carregando...')` — keep that string in the DOM (an `sr-only` span next to
the skeleton satisfies it). For every other `Carregando...` you replace with a
skeleton, grep the matching test file first and apply the same sr-only pattern if the
text is asserted.

**Do not modify** existing assertions except in this one situation: an assertion
targets a *visual class* this plan intentionally removes (none should — the protected
classes in §2.2 are all preserved by this spec). If you believe one must change, stop
and re-read §2; you have almost certainly deviated from the spec.

---

## 14. Explicitly out of scope (do NOT do)

- No dark mode / theme switcher. No new routes or pages. No toast system.
- No new dependencies (no framer-motion, no headless UI, no font changes).
- No changes to API calls, query keys, contexts, formatters, or types.
- No copy changes (pt-BR), including punctuation and emoji (`Olá! 👋` stays).
- No backend changes. No changes to `App.tsx`, `main.tsx`, `vite.config.ts`.
- Do not delete the `category.*` palette or any existing token still referenced.
