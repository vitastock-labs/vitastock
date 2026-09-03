# VitaStock Project Memory

This file is the handoff context for continuing VitaStock in a new Codex task. Read it together with `AGENTS.md` before editing.

`AGENTS.md` is the authoritative engineering rulebook. This file records VitaStock-specific architecture, established product decisions, recurring corrections, current implementation areas, and verification boundaries. When either document conflicts with a newer explicit user instruction or a corrected local pattern, follow the newer instruction or corrected code.

## First Actions In A New Task

1. Read `AGENTS.md` and this file completely.
2. Run `git status --short`; treat every existing modification as user-owned work.
3. Inspect the exact route/module and the nearest corrected reference before editing.
4. Read the relevant skill under `.agents/skills/` before changing table infrastructure or behavior.
5. Do not start a development server, open a port, sync a schema, seed a database, or run a migration without explicit permission.
6. Run commands from the actual package directory and use the narrowest relevant check.
7. Treat supplied PRDs, architecture documents, spreadsheets, screenshots, and corrected code as source material, not loose inspiration.

## User Working Style

- The user expects direct implementation after focused local inspection. Repeated proposals, broad exploration, needless abstractions, and unnecessary commands waste time.
- Corrections already made by the user are the strongest local examples. Read them before changing nearby code.
- Match the user's established structure rather than introducing a merely valid alternative.
- Prefer one source of truth across DB schema, shared Zod contracts, backend behavior, and frontend inference.
- Explain consequential backend and database choices clearly when asked, including SQL behavior, constraints, indexes, transactions, queues, and lifecycle semantics.
- Do not claim completion when required behavior or verification remains unfinished. State exactly what was and was not run.

## Product And Repository Architecture

- VitaStock is a workspace-scoped pharmacy inventory application.
- The repository is a pnpm/Turbo monorepo:
   - `apps/frontend`: Vite + React frontend.
   - `apps/backend`: Hono API and background-process entry points.
   - `packages/db`: Drizzle PostgreSQL schema and seeders.
   - `packages/shared`: cross-boundary Zod API contracts and shared validation.
   - `packages/env`: environment validation.
   - `packages/transactional`: React Email templates.
- The backend supports server and worker entry points. Queue/background code must remain understandable and removable from the web process when hosting changes.
- Workspace isolation always comes from authenticated request context. Workspace-scoped routes never accept `workspaceId` from frontend input.
- Frontend API request/response/form types come from `backendApiSchemaRoutes`; database and shared schemas remain the canonical sources for domain shapes and enums.

## Durable Domain Decisions

### Users And Memberships

- `users` owns identity, authentication, and security state.
- Workspace role and suspension belong to workspace membership, not the user identity row.
- The current product rule is one workspace membership per user, enforced in a way that can be removed cleanly if multi-workspace support is introduced later.
- Membership suspension is represented by `suspendedAt`; do not reintroduce a redundant two-value active/suspended status unless the lifecycle expands enough to justify it.
- A workspace has at most one owner through a partial unique owner index. Application flows must also protect the sole owner from demotion or removal.

### Inventory Model

- `drugs` is the workspace-scoped drug master. Drug name, generic name, strength, dosage form, and inventory unit are distinct fields.
- `stockBatches` stores physical stock by drug, quantity, expiry date, and batch number. Matching batches share workspace, drug, normalized batch number, and expiry date.
- `stockTransactions` identifies one logical stock operation and supplies idempotency scope.
- `stockLogs` is the immutable batch-level audit ledger. A logical movement can produce several log rows when FEFO spans batches.
- There is no persisted `inventorySummary` table. Inventory summaries, dashboard totals, filters, and counts are derived from current batches and grouped SQL queries.
- Expiry is a PostgreSQL calendar `date`, transported as `YYYY-MM-DD`. Stock is usable throughout its expiry date and becomes expired on the following workspace-local calendar day.
- Inventory condition is multi-dimensional:
   - primary `stockStatus`: `normal | low_stock | out_of_stock`;
   - independent usable, expired, and near-expiry batch counts.
- Never replace Out of stock with Expired. A drug may simultaneously have no usable stock and still have expired physical batches.
- Inventory does not track prices, costs, valuation, or financial loss. Stock creation and import record quantities and expiry without monetary fields.

### Stock Movement And FEFO

- Patient and ward dispensing use automatic FEFO. The backend orders usable batches by expiry date, then creation time, then ID and rejects a frontend-supplied batch override.
- The UI must show physical guidance when a drug has multiple usable expiry dates: usable batch count, nearest batch number, expiry date, available quantity, and notice that VitaStock deducts FEFO automatically.
- Damaged and expired removals are physical-batch operations and require an eligible `batchId` selected from the backend batch endpoint.
- Drug IDs submitted by forms are selected entity IDs; they are never workspace IDs and must still be ownership-validated in the backend.
- Stock mutations use the `x-idempotency-key` header. The frontend does not invent a stock transaction ID.
- A drug cannot be deactivated while any usable or expired batch retains positive quantity.

### Alerts And Delivery

- Inventory alerts are persisted lifecycle records and are distinct from current derived inventory condition.
- Alert types are low stock, expiring soon, and expired. Acknowledgement clears unread state but does not resolve the underlying condition.
- Alert evaluation derives current conditions and raises/resolves persisted alerts idempotently.
- The alert outbox provides a durable boundary between committed database alert changes and BullMQ email enqueueing. In-process events remain observability/decoupling tools, not delivery guarantees.
- Immediate email and daily unresolved digest delivery use BullMQ/Redis. Recipients are the configured alert address plus active owner/admin emails, deduplicated.
- Scheduled maintenance uses Croner where an in-process scheduler is appropriate; GitHub Actions may invoke maintenance scripts when hosting should not keep a paid worker alive.
- Bull Board is infrastructure administration and is protected with separate Basic Auth credentials regardless of environment.
- SSE is deferred. React Query invalidation and normal refetch behavior remain the current frontend update strategy.

### Bulk Import

- Bulk import accepts the VitaStock template and validates before submission; invalid files cannot be imported.
- File parsing stays in frontend parser modules. Cross-boundary row/header rules belong in shared Zod where they can be reused consistently.
- The backend revalidates and imports transactionally. Imported stock follows the same drug, batch, expiry, idempotency, alert, and workspace rules as manual stock entry.
- Keep bulk-import dialog state and implementation in its route-local component rather than overloading the main inventory page.

## Frontend Architecture And Corrections

- Page composition and markup follow `AGENTS.md`. Main pages compose meaningful section components inside `Main`.
- Shared dashboard table composition is `apps/frontend/src/pages/(protected)/dashboard/-components/DashboardDataTableShared.tsx`.
- Shared form field composition is `apps/frontend/src/pages/(home)/-components/FormPartsShared.tsx`. Shared fields own label, description, binding, invalid state, and error rendering.
- Portable data-table primitives live under `apps/frontend/src/components/ui/data-table/`; VitaStock styling belongs in dashboard composition and exposed slots.
- The app uses TanStack React Table v9. Use `createDataTableColumnHelper`, `useDataTable`, v9 state/subscription patterns, and the local table skills.
- Use `nuqs` for URL-worthy search, filters, tabs, actions, and pagination. Do not duplicate URL-owned filter state in unrelated React state.
- Use `NavLinkEphemeral` for declarative action navigation and pathname/search destination objects built with the repository search-param helper.
- Forms await `callBackendApiForQuery` inside `form.handleSubmit`. React Query mutations are reserved for non-form actions.
- `Form.Watch` always receives `control={form.control}`; watch multiple fields with one array-based `name`.
- Unbounded drug and batch selectors use the existing searchable Combobox and submit UUID values while displaying readable labels.
- Use `Switch` for substantial loading/error/empty/content branches, `Show` for conditional content, and `For`/`ForWithWrapper` instead of direct page-JSX maps.
- Use existing empty-state, dialog, date-picker, dropzone, tabs, card, icon, and toaster primitives before creating alternatives.
- Icons are registered in `apps/frontend/monicon.config.ts`; generated icon output is not edited manually.

## Backend Architecture And Corrections

- Hono routes are thin orchestration layers: authenticate/authorize, validate transport input, call service/data-access logic, and return schema-validated responses.
- Module data access lives under each module's `services/data-access/` folder. Small shared module helpers belong under `services/utils/` or a focused common module rather than one-file services with no meaningful boundary.
- Transactions cover writes that must succeed or fail together. Database constraints enforce concurrency-sensitive invariants; pre-checks exist for clearer errors, not as the only guarantee.
- Use PostgreSQL/Drizzle aggregation for counts and totals instead of selecting entire datasets only to count or reduce in application code.
- PostgreSQL numeric aggregates may arrive as strings; convert them deliberately at the data-access boundary before response validation.
- Use `date-fns` and `@date-fns/tz` for date operations and workspace-calendar boundaries. Do not mutate `Date` manually.
- App events are retained only where they provide useful logging or decoupling. Remove events that merely announce a read request or duplicate direct control flow.
- Cache and queue Redis clients have different purposes and lifecycle. Startup must initialize dependencies before constructing consumers that use them, and failures must produce clear logs without hidden retry storms.
- Never log credentials, tokens, cookies, verification codes, passwords, raw auth payloads, or secret-bearing links.

## Testing And Verification

- Tests use Vitest and avoid deeply nested test structure. Test names may begin with the behavior category, for example `FEFO - ...`.
- Prefer disposable fixtures/builders that own setup and cleanup. Integration tests use the dedicated test database configuration.
- Run commands from the package being checked:
   - frontend: `pnpm lint:eslint`, `pnpm lint:type-check`, `pnpm test`;
   - backend: `pnpm lint:eslint`, `pnpm lint:type-check`, focused Vitest commands;
   - DB/shared: their package-local scripts.
- Do not start Docker, the test database, Redis, a dev server, or browser verification without explicit permission.
- When browser verification is authorized, test the actual interaction, not only rendering: filters, reset, pagination, scrolling, dialogs, combobox search, form errors, FEFO guidance, alert actions, and refresh persistence.
- Keep pre-existing failures separate from failures introduced by the current change.

## Current Implementation Warning

The repository may contain a large dirty working tree across inventory schema, routes, services, tests, frontend inventory UI, shared API contracts, seeders, generated icons, and editor files. Treat every existing change as user-owned. Do not reset, revert, mass-format, or regenerate unrelated files.

Inventory correctness, date-only expiry, logical activity grouping, FEFO guidance, disposal batch selection, bulk import, persisted alerts, and shared form refactoring have all been under active development. Their presence in the tree does not prove that schema sync, reseeding, integration tests, or browser checks have completed. Inspect current code and verification evidence before claiming any area complete.

## Historical Corrections Worth Remembering

- Do not duplicate API or enum types on the frontend.
- Do not use nested ternaries or ternaries whose only alternate is `undefined`.
- Do not pass form-value generics to `useForm`.
- Every form field renders its own error through shared form composition.
- Do not use direct `.map()` in page JSX or `Array.from` for count rendering.
- Do not use `className` and `classNames` together.
- Do not use `Card` as a generic page section.
- Do not create hand-built query strings or keep refresh-sensitive state only in React state.
- Do not use ad hoc tables when the DataTable composition applies.
- Do not fetch whole datasets merely to count or sum them.
- Do not create redundant persisted read models without a demonstrated need.
- Do not introduce IDs or workspace selectors into frontend payloads when the backend can derive them from authenticated context or idempotency headers.
- Do not start ports or long-running commands without permission.
- Do not report browser, seed, migration, integration, or delivery behavior as verified unless it was actually exercised.

## Final Handoff Principle

VitaStock should implement the product documents through the user's established local architecture, with one source of truth across schema, contracts, backend, and frontend. When a general best practice conflicts with a corrected VitaStock pattern, inspect the nearest working example and preserve the local pattern unless there is a concrete correctness or maintenance reason to change it.
