# UI Design System

## Scope

This document defines a unified UI Design System for the current project based on:

- The existing project structure and current visual implementation
- The uploaded `前端UI开发规范（试行版）`
- A target visual language that blends:
  - Apple minimalism
  - Linear precision
  - Arc Browser layering
  - OpenAI restraint
  - Claude calm utility
  - Microsoft Fluent translucency

This is a design standard document only. It does not modify implementation code.

## Design Principles

### 1. Calm technology

- Prefer low-noise, high-clarity interfaces.
- Emphasize hierarchy through spacing, contrast, blur, and typography instead of decoration.

### 2. Minimal but not empty

- Keep the UI light and breathable.
- Avoid dense borders, heavy textures, and over-saturated color blocks.

### 3. Layered spatial depth

- Use glass, surface elevation, and soft shadow to express hierarchy.
- Differentiate shell, panels, overlays, and focused content clearly.

### 4. Strong system consistency

- All visual decisions must be reusable through tokens.
- Colors, spacing, radius, shadow, and transitions should come from one system.

### 5. PC-first workbench experience

- This system is optimized for desktop workbench scenarios:
  - map-centric layouts
  - floating panels
  - side navigation
  - dense but controlled professional workflows

## Theme Strategy

Two themes are required:

- `Light`
  - default business work mode
  - bright, glassy, precision-oriented
- `Dark`
  - immersive map and monitoring mode
  - deep, quiet, high-contrast, translucent

Theme switching must preserve:

- structure
- spacing
- typography
- layout rhythm
- interaction logic

Only the color and depth expressions should change.

---

## 1. Color System

The color system follows the project规范主轴 `#17233d / #2d8cf0 / #ffffff`, then extends into a modern glass-tech palette.

### Core Palette

| Token | Light | Dark | Usage |
|---|---|---|---|
| `Primary` | `#2D8CF0` | `#5CADFF` | Primary actions, focus, active states |
| `Primary Hover` | `#5AA7F5` | `#7DBDFF` | Hover on primary elements |
| `Primary Active` | `#1F70D6` | `#3E9BFF` | Pressed primary state |
| `Secondary` | `#17233D` | `#DCE7F8` | Secondary emphasis, dark shell identity |
| `Success` | `#22C55E` | `#4ADE80` | Success state, connected status |
| `Warning` | `#FF9D2B` | `#FFB84D` | Warning and pending states |
| `Danger` | `#E74C3C` | `#FF7875` | Error, destructive actions |

### Surface and Background Palette

| Token | Light | Dark | Usage |
|---|---|---|---|
| `Background` | `#F4F7FB` | `#17233D` | Page base background |
| `Surface` | `#FFFFFF` | `#23344F` | Main elevated container |
| `Surface Soft` | `#EEF3F8` | `#2A3E5D` | Secondary surface |
| `Card` | `rgba(255,255,255,0.88)` | `rgba(35,52,79,0.82)` | Floating cards and panels |
| `Overlay Surface` | `rgba(255,255,255,0.72)` | `rgba(23,35,61,0.72)` | Glass panels, overlays |
| `Header Background` | `#17233D` | `#17233D` | Top navigation shell |
| `Sidebar Background` | `#17233D` | `#17233D` | Sidebar shell |
| `Sidebar Sub Background` | `#2C4360` | `#23344F` | Secondary grouped menus |

### Border Palette

| Token | Light | Dark | Usage |
|---|---|---|---|
| `Border` | `rgba(23,35,61,0.14)` | `rgba(255,255,255,0.14)` | Standard border |
| `Border Strong` | `rgba(23,35,61,0.24)` | `rgba(255,255,255,0.24)` | Focused or strong division |
| `Border Subtle` | `rgba(23,35,61,0.08)` | `rgba(255,255,255,0.08)` | Hairline, subtle separators |

### Text Palette

| Token | Light | Dark | Usage |
|---|---|---|---|
| `Text Primary` | `#17233D` | `#FFFFFF` | Main readable text |
| `Text Secondary` | `#62708A` | `#B8C2D1` | Supporting text |
| `Text Tertiary` | `#8B95A7` | `#8FA2BC` | Placeholder, muted labels |
| `Text Disabled` | `rgba(23,35,61,0.35)` | `rgba(255,255,255,0.35)` | Disabled text |
| `Text Inverse` | `#FFFFFF` | `#17233D` | Text on colored backgrounds |

### Interactive State Palette

| Token | Light | Dark | Usage |
|---|---|---|---|
| `Hover` | `rgba(45,140,240,0.08)` | `rgba(92,173,255,0.14)` | Surface hover |
| `Hover Strong` | `rgba(45,140,240,0.14)` | `rgba(92,173,255,0.20)` | Strong hover |
| `Selected` | `rgba(45,140,240,0.12)` | `rgba(92,173,255,0.18)` | Selected state |
| `Focus Ring` | `rgba(45,140,240,0.24)` | `rgba(92,173,255,0.30)` | Keyboard and field focus |
| `Disabled Fill` | `rgba(23,35,61,0.06)` | `rgba(255,255,255,0.06)` | Disabled background |

### Shadow Palette

| Token | Value | Usage |
|---|---|---|
| `Shadow XS` | `0 2px 8px rgba(15,23,42,0.06)` | Inputs, micro elements |
| `Shadow SM` | `0 6px 18px rgba(15,23,42,0.10)` | Small cards, menus |
| `Shadow MD` | `0 12px 30px rgba(15,23,42,0.14)` | Panels, modals |
| `Shadow LG` | `0 20px 48px rgba(15,23,42,0.18)` | High-priority overlays |
| `Shadow Glass` | `0 14px 34px rgba(15,23,42,0.16)` | Glass surfaces |

### Color Rules

- Primary blue is the only global action accent.
- Do not use multiple bright accents on the same screen unless there is strong semantic need.
- Danger red must be reserved for:
  - destructive actions
  - error states
  - critical alerts
- Warning orange must be used for:
  - pending
  - caution
  - reconnecting
- Success green must be used for:
  - completed
  - synced
  - healthy system states

---

## 2. Typography System

Typography is based on the project规范 font family and tightened into a modern desktop workbench hierarchy.

### Font Family

```css
"微软雅黑","Helvetica Neue",Helvetica,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",Arial,sans-serif
```

### Type Scale

| Token | Size | Weight | Line Height | Letter Spacing | Usage |
|---|---|---|---|---|---|
| `H1` | `32px` | `700` | `40px` | `-0.02em` | Page hero titles, special emphasis |
| `H2` | `24px` | `650` | `32px` | `-0.01em` | Main section titles |
| `H3` | `20px` | `600` | `28px` | `-0.01em` | Workbench block titles |
| `H4` | `16px` | `600` | `24px` | `0` | Card headers, panel titles |
| `Body` | `14px` | `400` | `22px` | `0` | Standard body text |
| `Caption` | `12px` | `400` | `18px` | `0.01em` | Secondary labels, meta information |
| `Button` | `14px` | `500` | `20px` | `0` | Button labels |

### Font Weight Rules

| Role | Weight |
|---|---|
| Hero / Strong emphasis | `700` |
| Major headings | `650` / `600` |
| Panel headings | `600` |
| Action text | `500` |
| Body | `400` |
| Muted helper text | `400` |

### Typography Rules

- Avoid using `14px` for all headings. Headings must visibly separate from body text.
- `12px` is only for:
  - captions
  - status notes
  - secondary labels
  - helper and metadata text
- Long-form UI body text should remain `14px`.
- Panel titles should default to `16px / 600`.
- Main workspace section titles should default to `20px / 600`.

---

## 3. Button System

Buttons should feel restrained, precise, and native to a premium desktop product.

### Shared Button Tokens

| Token | Value |
|---|---|
| Height SM | `32px` |
| Height MD | `36px` |
| Height LG | `40px` |
| Horizontal Padding | `12px` / `16px` |
| Radius | `10px` |
| Icon Size | `16px` |
| Icon Gap | `8px` |

### Primary Button

- Background: `Primary`
- Text: `Text Inverse`
- Border: transparent
- Shadow: `Shadow XS`
- Hover:
  - background: `Primary Hover`
  - shadow: `Shadow SM`
- Active:
  - background: `Primary Active`
  - transform: slight press depth only
- Disabled:
  - background: `Disabled Fill`
  - text: `Text Disabled`
  - shadow: none

### Secondary Button

- Background: `Surface`
- Text: `Text Primary`
- Border: `Border`
- Hover:
  - background: `Hover`
  - border color: `Primary`
- Active:
  - background: `Selected`
- Disabled:
  - background: `Disabled Fill`
  - border: `Border Subtle`
  - text: `Text Disabled`

### Ghost Button

- Background: transparent
- Text: `Text Secondary`
- Border: transparent
- Hover:
  - background: `Hover`
  - text: `Text Primary`
- Active:
  - background: `Selected`
  - text: `Primary`

### Danger Button

- Background: `Danger`
- Text: `#FFFFFF`
- Border: transparent
- Hover:
  - background: slightly lighter danger
- Active:
  - background: slightly deeper danger
- Disabled:
  - background: `rgba(231,76,60,0.22)`
  - text: `rgba(255,255,255,0.55)`

### Button Rules

- Primary and secondary actions in the same action group must be visually distinct.
- Button groups should use `8px` spacing.
- Do not mix sharp-corner and pill buttons in the same area.
- Default radius should be `10px`, not `0`.

---

## 4. Input System

### Shared Input Tokens

| Token | Value |
|---|---|
| Height | `36px` |
| Radius | `10px` |
| Horizontal Padding | `12px` |
| Border | `1px solid Border` |
| Background | `Surface` / `Overlay Surface` |
| Text | `Text Primary` |

### Input Rules

- Height: `36px`
- Border:
  - default: `Border`
  - hover: `Border Strong`
  - focus: `Primary`
- Background:
  - light: `rgba(255,255,255,0.88)`
  - dark: `rgba(255,255,255,0.08)` or dark surface glass
- Placeholder:
  - `Text Tertiary`
- Focus:
  - border color: `Primary`
  - box shadow: `0 0 0 3px rgba(45,140,240,0.12)`
- Hover:
  - subtle border lift
- Disabled:
  - background: `Disabled Fill`
  - text: `Text Disabled`

### Error State

- Border: `Danger`
- Focus ring: `0 0 0 3px rgba(231,76,60,0.12)`
- Error text:
  - size: `12px`
  - color: `Danger`
  - margin-top: `4px`

### Input Notes

- Inputs should use glass-light or soft-surface treatment, not hard gray fills.
- Search, filter, select, and date picker fields must share the same visual baseline.

---

## 5. Card System

Cards are the default semantic container for workbench content.

### Card Tokens

| Token | Value |
|---|---|
| Radius | `16px` |
| Padding | `16px` |
| Margin | `16px` grid rhythm |
| Border | `1px solid Border` |
| Shadow | `Shadow SM` |
| Background | `Card` |

### Card Rules

- Border radius: `16px`
- Shadow:
  - default: `Shadow SM`
  - elevated card: `Shadow MD`
- Padding:
  - standard: `16px`
  - dense card: `12px`
  - large insight card: `20px`
- Margin:
  - `16px` between peer cards
  - `24px` between larger content groups
- Border:
  - always subtle, not heavy

### Card Variants

- Standard Card
  - For content panels and info blocks
- Glass Card
  - For overlays and floating UI
- Metric Card
  - For dashboards and status summaries

---

## 6. Modal System

Modals should feel focused, premium, and controlled.

### Modal Tokens

| Token | Value |
|---|---|
| Min Width | `420px` |
| Preferred Width | `560px` |
| Max Width | `min(960px, 85vw)` |
| Radius | `20px` |
| Header Height | `52px` |
| Body Padding | `20px` |
| Footer Height | `56px` |
| Footer Gap | `8px` |

### Modal Rules

- Width:
  - min: `420px`
  - standard: `560px`
  - large modal: `720px`
  - max: `85vw`
- Mask:
  - color: `rgba(10,16,28,0.34)`
  - blur: `10px`
- Title:
  - `H4`
  - weight: `600`
- Content:
  - use `20px` body padding
- Footer buttons:
  - right-aligned
  - button gap `8px`

### Modal Interaction Rules

- Standard modal close methods:
  - close icon
  - cancel button
  - explicit close action
- For critical forms and workflow modals:
  - clicking outside should not close
- For lightweight transient overlays:
  - outside click close may be allowed if explicitly defined

---

## 7. Sidebar System

The sidebar is a dark command rail plus grouped module navigator.

### Sidebar Tokens

| Token | Value |
|---|---|
| Expanded Width | `112px / 144px / 176px / 208px` by viewport tier |
| Collapsed Width | `64px` |
| Background | `#17233D` |
| Sub Background | `#2C4360` light theme expression / `#23344F` dark expression |
| Item Height | `36px` |
| Group Gap | `8px` |
| Inner Padding | `8px` |

### Sidebar Color Rules

- Background: deep navy
- Menu text:
  - primary: `#FFFFFF`
  - secondary: `#B8C2D1`
- Hover:
  - `rgba(255,255,255,0.06)`
- Selected:
  - background: `rgba(92,173,255,0.14)`
  - left accent: `#5CADFF`

### Sidebar Rules

- First-level nav should feel quiet and structural.
- Active items must be discoverable in under one second.
- Icon-only state must retain tooltips.
- Group titles should be visually lighter than active content.

---

## 8. Navigation Bar System

### Navigation Tokens

| Token | Value |
|---|---|
| Height | `64px` |
| Horizontal Padding | `16px` |
| Background | `Header Background` |
| Bottom Border | `1px solid rgba(255,255,255,0.08)` |
| Content Gap | `16px` |

### Navbar Rules

- Height: `64px`
- Logo:
  - icon size: `32px` to `36px`
  - text group aligned center-left
- Menu:
  - button height: `28px` to `32px`
  - horizontal padding: `10px`
  - radius: `8px`
- Status blocks:
  - glass chip treatment
  - no heavy solid pills

### Navbar Typography

- Product title:
  - `16px / 600`
- Secondary product descriptor:
  - `12px / 400`
- Header action text:
  - `12px / 500`

---

## 9. Icon System

### Icon Tokens

| Token | Value |
|---|---|
| XS | `12px` |
| SM | `16px` |
| MD | `20px` |
| LG | `24px` |
| XL | `32px` |

### Icon Rules

- Default size:
  - inline controls: `16px`
  - toolbar controls: `20px`
  - major shell icon: `24px`
- Default color:
  - inherit current text color
- Hover:
  - icon color can shift to `Primary`
  - background should carry more of the feedback than the icon itself

### Icon Behavior

- Icons must align with text baseline or optical center.
- Icon + text spacing defaults to `8px`.
- Avoid mixing visual weights from different icon families in the same zone.

---

## 10. Spacing System

Use a strict modern spacing scale.

| Token | Value | Usage |
|---|---|---|
| `space-1` | `4px` | Tight micro spacing, badges, tiny helpers |
| `space-2` | `8px` | Control spacing, icon gap, button groups |
| `space-3` | `12px` | Dense panel spacing |
| `space-4` | `16px` | Standard UI spacing |
| `space-5` | `20px` | Modal and card inner space |
| `space-6` | `24px` | Section spacing |
| `space-7` | `32px` | Major group spacing |
| `space-8` | `40px` | Large vertical separation |
| `space-9` | `48px` | Section break |
| `space-10` | `64px` | Page-level breathing room |

### Spacing Rules

- Default layout rhythm should prefer `8px` multiples.
- `12px` and `20px` are allowed as bridge values for polished balance.
- Do not mix random `6px`, `10px`, `14px` values unless justified by optical tuning.

---

## 11. Grid System

The project is a desktop-first workbench, so the grid should be pragmatic rather than marketing-page oriented.

### Canvas Width Priorities

- Primary: `1920`
- Secondary: `1440`
- Baseline compatibility: `1366`

### Grid Rules

- Overall layout:
  - left navigation rail
  - top shell
  - adaptive main work area
- Content grid inside panels:
  - `8px` base
  - `16px` default panel rhythm
- Cards and forms:
  - use `12-column` logic where needed
  - but keep implementation flexible for floating workbench panels

### Recommended Internal Panel Grid

- Small floating panel: `1-column stacked`
- Standard data panel: `2-column flexible`
- Analysis workspace: `12-column proportional`

---

## 12. Motion System

Motion should be subtle, crisp, and task-supportive.

### Transition Tokens

| Token | Value |
|---|---|
| `Duration Fast` | `150ms` |
| `Duration Standard` | `200ms` |
| `Duration Slow` | `280ms` |
| `Ease Standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| `Ease Emphasized` | `cubic-bezier(0.22, 1, 0.36, 1)` |

### Motion Rules

- Hover
  - `150ms`
  - color, opacity, border, background only
- Press
  - `120ms`
  - very subtle
- Dropdown / menu open
  - `180ms` to `220ms`
  - fade + small translate
- Modal open
  - `220ms` to `280ms`
  - fade + scale or fade + slide
- Loading
  - low-noise loops only
  - no aggressive infinite motion

### Transition Examples

- Button hover:
  - background
  - border-color
  - color
- Card hover:
  - shadow
  - border-color
  - transform `translateY(-1px)` at most
- Sidebar toggle:
  - width and content fade only

---

## 13. Glass Effect System

The project already leans toward glass overlays. This should become a formal system.

### Glass Tokens

| Token | Light | Dark | Usage |
|---|---|---|---|
| `Blur` | `14px` | `14px` | Standard glass blur |
| `Opacity Surface` | `0.72` | `0.72` | Main overlay background blend |
| `Opacity Strong` | `0.88` | `0.82` | Dense glass panel |
| `Shadow` | `Shadow Glass` | `Shadow Glass` | Floating overlay depth |

### Glass Rules

- Use glass for:
  - top status chips
  - dropdowns
  - floating panels
  - popovers
  - modals over map content
- Do not use glass on everything.
- Dense content tables should sit on more solid surfaces for readability.
- Glass must always pair with:
  - subtle border
  - blur
  - soft shadow

### Glass Surface Formula

- Background:
  - light: `rgba(255,255,255,0.72~0.92)`
  - dark: `rgba(23,35,61,0.72~0.90)`
- Border:
  - subtle translucent
- Shadow:
  - soft, wide, low-noise

---

## 14. Component-Specific Rules

### Tables

- Surface: solid or near-solid, not strong glass
- Header:
  - `14px / 600`
  - soft contrast background
- Row height:
  - `40px` to `44px`
- Cell horizontal padding:
  - `12px`
- Zebra striping:
  - allowed but subtle
- Hover:
  - soft tinted row hover

### Tags

- Radius: `999px`
- Height: `24px`
- Horizontal padding: `8px`
- Default text size: `12px`

### Tooltips

- Radius: `10px`
- Padding: `8px 10px`
- Background:
  - dark elevated surface
- Text:
  - `12px`
- Delay:
  - open `0.4s` to `0.5s`

### Status Chips

- Height: `28px`
- Padding: `0 10px`
- Radius: `999px` or `12px` depending on context
- Background: glass
- Border: subtle

---

## 15. Shell-Specific Recommendations

### Home / Workbench

- The map remains the visual center.
- Panels must feel like tools orbiting the map, not replacing it.

### Header

- Keep high information density under control.
- Prefer grouping and chips over many equally weighted buttons.

### Sidebar

- Should read as a command rail.
- Group hierarchy must be clear even in dense workflows.

### Popups and Panels

- Standardize around one popup shell language.
- Avoid mixing sharp-rect dialogs with rounded glass overlays.

---

## 16. Mapping to Current Project

This design system intentionally aligns with the project’s existing core tokens:

- Existing project primary dark: `#17233d`
- Existing project primary blue: `#2d8cf0`
- Existing popup blur baseline: `14px`
- Existing popup title baseline: `16px / 600`
- Existing shell height baseline: `64px`
- Existing sidebar collapsed width baseline: `64px`

But this document tightens and upgrades the system by standardizing:

- typography ladder
- button hierarchy
- radius strategy
- glass usage
- motion language
- spacing scale

---

## 17. Final Design Direction Summary

This system should feel like:

- Apple:
  - clean, quiet, premium spacing
- Linear:
  - precision, control, hierarchy
- Arc:
  - layered, modern browser-like glass depth
- OpenAI:
  - restrained, functional, calm
- Claude:
  - soft, useful, legible
- Fluent:
  - translucency, shell depth, motion polish

### Visual Keywords

- calm
- precise
- layered
- premium
- minimal
- translucent
- map-first
- desktop workbench

### Avoid

- heavy saturation
- too many hard borders
- mixed radius language
- dense all-equal typography
- over-animated enterprise dashboard behavior
- noisy gradients
- decorative effects that reduce readability

