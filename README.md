# wave-ui-react

A comprehensive React component library inspired by Fluent UI 2 design language with shadcn/ui-inspired patterns. 58 accessible, composable components built with TypeScript, Tailwind CSS, and a flexible slot system.

## Installation

```bash
npm install wave-ui-react
```

## Quick Start

```tsx
import { WaveProvider, Button } from 'wave-ui-react';
import 'wave-ui-react/styles/globals.css';

function App() {
  return (
    <WaveProvider theme="light">
      <Button appearance="primary" onClick={() => alert('Clicked!')}>
        Get Started
      </Button>
    </WaveProvider>
  );
}
```

Wrap your app (or subtree) in `<WaveProvider>` to apply Wave UI theming. All components inherit theme tokens automatically.

## Component Catalog

### Buttons & Actions

| Component | Description |
|---|---|
| `Button` | Standard button with primary, outline, subtle, transparent appearances |
| `CompoundButton` | Button with primary and secondary text lines |
| `ToggleButton` | Button with pressed/unpressed toggle state |
| `SplitButton` | Two-part button: main action + dropdown menu trigger |
| `MenuButton` | Button with integrated dropdown chevron |
| `Link` | Styled anchor with inline, standalone, and subtle variants |
| `Toolbar` | Container for grouping button controls |

### Inputs & Forms

| Component | Description |
|---|---|
| `Input` | Text input with contentBefore/contentAfter slots |
| `Textarea` | Multi-line text input |
| `Select` | Dropdown select element |
| `Checkbox` | Checkbox with label, supports indeterminate state |
| `Switch` | Toggle switch control |
| `RadioGroup` | Radio button group with vertical/horizontal orientation |
| `SearchBox` | Search input with icon and clear button |
| `Slider` | Range input with visual track and thumb |
| `SpinButton` | Numeric input with increment/decrement buttons |
| `Field` | Form field wrapper with label, hint, and error support |
| `Label` | Form label with required indicator and size variants |
| `Combobox` | Filterable dropdown with type-ahead, Option/OptionGroup sub-components |
| `Dropdown` | Non-editable selection dropdown with Option/OptionGroup |
| `SwatchPicker` | Color swatch grid with radiogroup selection pattern |
| `ColorPicker` | Hex color input with preset swatches and opacity slider |
| `TagPicker` | Multi-select input with dismissible tags and filterable dropdown |
| `Rating` | Star-based rating input with hover preview and keyboard navigation |

### Data Display

| Component | Description |
|---|---|
| `Avatar` | User avatar with image, initials, or icon |
| `AvatarGroup` | Multiple avatars with overflow handling |
| `Badge` | Labeled badge with appearance and color variants |
| `CounterBadge` | Numeric badge with overflow display |
| `PresenceBadge` | User presence status indicator |
| `Tag` | Labeled tag with optional dismiss |
| `InfoLabel` | Label with info tooltip |
| `Persona` | Avatar with name and status display |
| `Divider` | Separator with optional label |
| `Image` | Styled image with fit modes, shapes, and shadow support |
| `List` | Vertical list with single/multi-select and keyboard navigation |

### Typography

| Component | Description |
|---|---|
| `Text` | Polymorphic text with 11 Wave UI typography variants |

### Layout

| Component | Description |
|---|---|
| `Card` | Container with Header, Body, Footer sub-components |
| `Accordion` | Expandable sections (single or multiple open) |
| `TabList` | Tab navigation with horizontal/vertical orientation |
| `Tree` | Hierarchical expandable list with TreeItem sub-components |
| `Carousel` | Content slider with prev/next buttons and dot indicators |
| `Overflow` | Overflow detection container with OverflowItem sub-components |

### Feedback

| Component | Description |
|---|---|
| `MessageBar` | Status messages (info, success, warning, error) |
| `ProgressBar` | Linear progress indicator with indeterminate mode |
| `Skeleton` | Loading placeholder (text, circular, rectangular) |
| `Spinner` | Animated loading indicator |
| `Toast` | Floating notification with auto-dismiss, status variants, and Toaster container |

### Navigation

| Component | Description |
|---|---|
| `Breadcrumb` | Breadcrumb navigation with chevron separators |
| `Menu` | Dropdown menu with icons, shortcuts, and dividers |
| `Nav` | Sidebar navigation with NavCategory, NavItem, NavSubItem |

### Overlays

| Component | Description |
|---|---|
| `Dialog` | Modal dialog with trigger, content, and footer |
| `Drawer` | Slide-out panel (left or right) |
| `Popover` | Floating content with trigger |
| `Tooltip` | Hover/focus tooltip (dark and light variants) |
| `TeachingPopover` | Step-based onboarding popover with navigation controls |

### Data

| Component | Description |
|---|---|
| `Table` | Data table with Head, Body, Row, Cell sub-components |
| `DataGrid` | Interactive data grid with sorting and row selection |

### Provider

| Component | Description |
|---|---|
| `WaveProvider` | Theme and direction provider (light, dark, high-contrast) |

## Theming

### Built-in Themes

```tsx
<WaveProvider theme="light">    {/* Default */}
<WaveProvider theme="dark">     {/* Dark mode */}
<WaveProvider theme="high-contrast"> {/* High contrast */}
```

### Direction (RTL Support)

```tsx
<WaveProvider theme="light" dir="rtl">
  {/* Right-to-left content */}
</WaveProvider>
```

### Theme Context

Access the current theme in any component:

```tsx
import { useWaveTheme } from 'wave-ui-react';

function MyComponent() {
  const { theme, dir } = useWaveTheme();
  // theme: 'light' | 'dark' | 'high-contrast'
  // dir: 'ltr' | 'rtl'
}
```

## Design Tokens

The library uses CSS custom properties for consistent styling:

| Token | Light Value | Description |
|---|---|---|
| `--color-primary` | `#0f6cbd` | Brand / primary actions |
| `--color-foreground` | `#242424` | Default text |
| `--color-background` | `#ffffff` | Page background |
| `--color-muted-foreground` | `#707070` | Secondary text |
| `--color-border` | `#d1d1d1` | Default borders |
| `--color-destructive` | `#c50f1f` | Error states |
| `--color-success` | `#107c10` | Success states |
| `--color-warning` | `#bc8b00` | Warning states |

### Spacing

4px base unit grid — all spacing follows multiples of 4px.

### Typography

Segoe UI font family with 11 size variants from `caption-2` (10px) to `display` (68px).

### Border Radius

4px default (Wave medium), consistent across all components.

## Hooks

| Hook | Description |
|---|---|
| `useControllable` | Manage controlled/uncontrolled component state |
| `useId` | Generate stable unique IDs for accessibility |
| `useEventCallback` | Stable callback reference without stale closures |
| `useRovingTabIndex` | Roving tab index for keyboard navigation in composite widgets |

## Slot System

Components support a flexible slot system for customizable sub-elements:

```tsx
<Input
  contentBefore={<SearchIcon />}
  contentAfter={{ children: '🔍', className: 'text-lg' }}
/>
```

Slots accept `ReactNode` for simple cases or `SlotObject` for full control over props.

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests (774 unit tests)
npx vitest run

# Type check
npx tsc --noEmit

# Build
npm run build

# Launch Storybook
npx storybook dev -p 6006
```

## Storybook

Browse all 58 components with interactive controls:

```bash
npx storybook dev -p 6006
```

Then open [http://localhost:6006](http://localhost:6006) to explore components, adjust props via the Controls panel, and see all variants.

## License

MIT
