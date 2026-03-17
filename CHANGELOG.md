# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-03-17

### Added

**7 New Components** completing the layout, navigation, and input categories:

- **Inputs & Forms** (2):
  - DatePicker — Interactive calendar-based date picker with validation, min/max constraints, and customizable formatting
  - TimePicker — Dropdown time picker with searchable options, customizable intervals, and 12h/24h format support

- **Layout** (3):
  - Grid — CSS Grid layout component with customizable columns, rows, gaps, and alignment properties
  - Stack — Flexbox-based stacking layout with vertical/horizontal direction and semantic spacing
  - Flex — Low-level flexbox layout with full direction, wrapping, grow/shrink control

- **Navigation** (2):
  - Stepper — Multi-step process indicator with horizontal/vertical layouts, linear navigation, and completion tracking
  - Pagination — Page navigation with ellipsis support, customizable boundaries, and previous/next controls

**154 New Unit Tests**: Comprehensive test coverage for all 7 new components (928 total tests).

**7 New Storybook Stories**: Interactive stories with controls for all new components (65 total story files).

### Changed

- Total component count: 58 → 65
- Total test count: 774 → 928
- Version bump: 0.2.0 → 0.3.0

## [0.2.0] - 2026-03-05

### Added

**16 New Components** completing the Wave UI component catalog:

- **Tier 1 — Core** (6):
  - Image — Styled image with fit modes (none, center, contain, cover), shape (circular, rounded, square), shadow, block/inline
  - Label — Form label with required indicator, disabled styling, size variants
  - Combobox — Type-to-filter input with dropdown listbox, Option/OptionGroup sub-components
  - Dropdown — Non-editable selection dropdown with custom popup, shares Option/OptionGroup with Combobox
  - Toast/Toaster — Imperative notification system with useToastController hook, auto-dismiss, status variants
  - Tree — Hierarchical expandable list with TreeItem, icons, keyboard navigation

- **Tier 2 — Enhanced** (5):
  - DataGrid — Enhanced Table with sorting, single/multi selection, keyboard nav, aria-sort support
  - Overflow — ResizeObserver-based overflow detection with OverflowItem and useIsOverflowing hook
  - TagPicker — Combobox-style multi-select with dismissible tags, filterable dropdown
  - Rating/RatingDisplay — Star-based rating input with hover preview, keyboard nav, read-only display variant
  - TeachingPopover — Step-based onboarding popover with dot indicators, Back/Next/Done navigation

- **Tier 3 — Specialized** (5):
  - Carousel — Content slider with prev/next buttons, dot indicators, autoPlay, loop support
  - SwatchPicker — Color swatch grid with radiogroup pattern, size/shape variants
  - Nav — Sidebar navigation with NavCategory (collapsible), NavItem, NavSubItem
  - List — Vertical list with single/multi-select, keyboard navigation, action slots
  - ColorPicker — Hex input with preset color swatches and optional opacity slider

**220 New Unit Tests**: Comprehensive test coverage for all 16 new components (774 total tests).

**16 New Storybook Stories**: Interactive stories with controls for all new components (58 total story files).

### Changed

- Total component count: 42 → 58
- Total test count: 554 → 774
- Library bundle: ESM + CJS with full TypeScript declarations

## [0.1.0] - 2026-03-04

### Added

**42 Components** implementing Wave UI design tokens (inspired by Fluent UI 2 design language):

- **Buttons & Actions** (7): Button, CompoundButton, ToggleButton, SplitButton, MenuButton, Link, Toolbar
- **Inputs & Forms** (10): Input, Textarea, Select, Checkbox, Switch, RadioGroup, SearchBox, Slider, SpinButton, Field
- **Data Display** (9): Avatar, AvatarGroup, Badge, CounterBadge, PresenceBadge, Tag, InfoLabel, Persona, Divider
- **Typography** (1): Text (11 Wave UI variants)
- **Layout** (3): Card, Accordion, TabList
- **Feedback** (4): MessageBar, ProgressBar, Skeleton, Spinner
- **Navigation** (2): Breadcrumb, Menu
- **Overlays** (4): Dialog, Drawer, Popover, Tooltip
- **Data** (1): Table
- **Provider** (1): WaveProvider (light, dark, high-contrast themes + RTL)

**3 Hooks**: useControllable, useId, useEventCallback

**Slot System**: Flexible slot pattern for customizable sub-elements across all components.

**554 Unit Tests**: Comprehensive test coverage for all components using Vitest and React Testing Library.

**Storybook Documentation**: 42 story files with interactive controls, variant demonstrations, and composed usage examples.

**Design System**:
- Segoe UI typography with 11 size variants
- 4px base unit spacing grid
- Wave UI color tokens (light, dark, high-contrast)
- Dual-layer shadow system
- Full accessibility support (ARIA attributes, keyboard navigation, focus management)
