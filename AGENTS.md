# VitaStock Engineering Guide

Apply these conventions to all repository changes unless a more specific `AGENTS.md` exists below the edited file or the user gives a newer explicit instruction.

## Source Of Truth

- Read surrounding code before editing and follow the patterns already established by the user.
- Inspect the working tree and preserve user-owned changes. Never revert unrelated work.
- Derive frontend request, response, mutation, and form types from `backendApiSchemaRoutes`; do not manually duplicate backend contract types.
- Keep database schemas, shared API schemas, and exported constants as the source of truth. Derive enum-like values rather than recreating arrays that can drift.
- Use the table skills in `.agents/skills/` whenever table infrastructure or behavior changes. VitaStock uses TanStack React Table v9.
- Treat supplied screenshots and product documents as source material. Do not invent missing flows or approximate a visible design.

## Working Discipline

- Keep changes scoped. Do not add speculative abstractions, placeholder flows, or unrelated cleanup.
- Do not start a development server or open ports without explicit permission.
- Run commands from the actual workspace directory, not through root-level filtered commands.
- Run the narrowest relevant checks. Do not repeatedly run slow root checks when a package check is sufficient.
- Use `apply_patch` for manual source edits.
- Do not edit generated icon output. Add icons to `apps/frontend/monicon.config.ts`.
- Do not report a feature as complete while required behavior or verification remains unfinished.

## Placement And Ownership

- Keep route-specific state, queries, forms, columns, mutations, dialogs, and helpers local to the route or component that owns them.
- Extract route-local code only when it is reused or sufficiently independent and complex to deserve its own module.
- Put reusable dashboard table composition in `apps/frontend/src/pages/(protected)/dashboard/-components/DashboardDataTableShared.tsx`.
- Keep generic UI primitives portable and free of VitaStock page styling. Apply product styling through dashboard composition and exposed slots.
- Shared composition files use a `Shared.tsx` suffix. Exported components use natural domain names without repeating `Shared`.
- Prefer existing primitives and composition APIs over creating parallel components.

## React And TypeScript

- Follow current repository conventions even when another React pattern is valid.
- Keep queries, mutations, form state, and dialog state local when no parent or sibling needs them.
- Forms submit by awaiting `callBackendApiForQuery` inside `form.handleSubmit`. Reserve React Query mutations for actions outside form submission.
- Do not manually type mutation parameters when they can be inferred from the API schema.
- Do not pass form-value generics to `useForm` when resolver/default-value inference is sufficient.
- Use Form primitives for form markup and `Form.Watch` for reactive form values.
- Components may use function declarations. Non-component functions use arrow functions.
- Do not use nested ternaries. Use guards, a lookup, a small IIFE, or straightforward conditional classes.
- Use a single-line `if` only for a pure control-flow guard with an empty `return`, `break`, or `continue`. When an `if` returns a value or performs work, give it a block body.
- Do not name tiny one-use values, types, class maps, or helpers unless the name adds domain meaning or reuse.
- Do not add broad fallback values that make missing API data look valid. Model required and nullable fields honestly.
- Use `row.original` for row-specific domain data rather than treating accessor IDs as a second domain model.
- Use `cnJoin` for conditional class lists and `cnMerge` when caller overrides must merge safely.
- Use `defineEnum` for flat enum-like constants. Keep one source of truth.
- In files under `apps/frontend/src/pages`, use `For` instead of JSX `.map()`. Use `ForWithWrapper` when the collection has one direct intrinsic wrapper.

## Markup And Styling

- Use semantic elements where they fit: `header`, `main`, `section`, `article`, `nav`, `footer`, `ul`, and `li`.
- Reserve `section` for meaningful page-boundary or thematic regions, normally with an associated heading. Do not use it as a generic flex/grid wrapper inside forms, dialogs, cards, or other sections.
- Avoid nested `section` elements used only for layout. Use `article`, `div`, lists, or the owning component according to the content semantics.
- Avoid wrappers that exist only to carry classes when an existing component can own the class.
- Prefer `gap-*` to `space-*`.
- Prefer parent `gap-*` for consistent spacing between flex or grid children.
- Prefer parent gap to sibling `mt-*` when spacing is regular or there are only two children.
- Use `mt-*` when one child needs additional separation beyond the parent gap, and prefer it over placing `mb-*` on the preceding child.
- Do not replace external spacing with `pt-*`; padding is for space inside an element, while margin controls separation between sibling elements
- Use pixel values for arbitrary measurements; do not author rem values.
- Use existing VitaStock and shadcn design tokens before raw colors. Use Tailwind palette colors only for semantic states without an existing token.
- Do not add decorative shadows, transitions, gradients, or rounded treatments without a functional or design reason.
- Use `className` when only a component root needs styling. When a component exposes slots and a non-root slot needs styling, use `classNames` and keep slot overrides flat.
- Ensure dialogs remain inside the viewport. Assign one clear scroll owner instead of nesting competing scroll containers.
- Keep controls and text legible and non-overlapping at mobile and desktop sizes.

## URL State And Navigation

- Use `nuqs` for refresh-sensitive or shareable UI state such as search, filters, tabs, selected records, and table pagination.
- Build destination search strings with `createSearchParams` and pass links as pathname/search objects.
- Use `NavLinkEphemeral` for declarative action navigation instead of button-driven `navigate` calls.
- Reset actions must clear both table state and corresponding URL state.

## Dates And Money

- Use `date-fns` for all date parsing, comparison, manipulation, and formatting on frontend and backend.
- Do not mutate `Date` objects manually.
- Store and return monetary values as integer kobo.
- Accept naira in user-facing inputs, multiply by 100 before persistence, and divide by 100 at the presentation boundary.
- Reuse shared formatter utilities rather than creating `Intl` formatters in individual files.

## Tables

- Use TanStack React Table v9 through the repository table infrastructure. Do not introduce v8 APIs or ad hoc table state.
- Define columns with `createDataTableColumnHelper` and render through the existing DataTable composition.
- Use `DashboardDataTable` for dashboard-facing tables and override its slots only for genuine page-specific behavior.
- Keep generic DataTable primitives free of VitaStock colors and page layout decisions.
- Keep URL-backed filters synchronized with TanStack state. Do not duplicate filter state in unrelated React state.
- Every visible filter and action must work.
- Keep sorting enabled unless the design or domain explicitly requires otherwise.
- Tables with constrained height must have one explicit scroll owner. Use a stable table minimum width when horizontal scrolling is expected.
- Apply row-specific states through the `tableRow` slot and `row.original`.

## Backend And Data

- Keep workspace isolation derived from authenticated context. Never accept a workspace ID from the frontend for workspace-scoped operations.
- Use Zod for transport-shape and cross-boundary validation. Keep file parsing concerns in parsers and transactional/database invariants in services and PostgreSQL.
- Reuse shared canonical helpers when a rule must be enforced at multiple boundaries.
- Use database constraints for concurrency-sensitive invariants. Do not rely only on existence checks.
- Keep transactions focused around writes that must succeed or fail atomically.
- Use direct `emitAppEvent` calls and register subscribers near their affected modules. Events are observability/decoupling tools, not delivery guarantees.
- Never log passwords, tokens, cookies, verification codes, reset links, or raw auth payloads.

## Final Review

- Confirm the implementation follows VitaStock patterns rather than copied repository-specific conventions.
- Confirm visible controls, scrolling, loading, error, and empty states work.
- Confirm URL-worthy state survives refresh.
- Confirm no nested ternaries, duplicated contract types, direct page JSX maps, runtime icon mode, or unnecessary abstractions were introduced.
- Run the narrowest affected typecheck/tests and report anything not verified.
