"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	INVENTORY_BULK_IMPORT_COLUMNS,
	INVENTORY_BULK_IMPORT_MAX_ROWS,
} from "@vitastock/shared/validation/backendApiSchema";
import { waitFor } from "@zayne-labs/toolkit-core";
import type { ExtractUnion } from "@zayne-labs/toolkit-type-helpers";
import { useMemo, useState } from "react";
import { DialogAnimated } from "@/components/animated/ui";
import * as DropZoneInput from "@/components/common/DropZoneInput";
import { For, ForWithWrapper } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { Show } from "@/components/common/show";
import { Switch } from "@/components/common/switch";
import { SpinnerIcon } from "@/components/icons/SpinnerIcon";
import { ScrollArea } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { createDataTableColumnHelper, useDataTable } from "@/components/ui/data-table";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
import {
	dashboardOverviewQuery,
	inventoryActivityQuery,
	inventoryAlertsQuery,
	inventoryAlertsUnreadCountQuery,
	inventoryDrugsQuery,
	inventorySummaryQuery,
	sessionQuery,
} from "@/lib/react-query/queryOptions";
import { cnJoin } from "@/lib/utils/cn";
import { formatCalendarDateInTimezone, formatDate } from "@/lib/utils/formatters";
import { EMPTY_DISPLAY_VALUE } from "@/pages/(protected)/dashboard/-components/constants";
import {
	MAX_BULK_IMPORT_FILE_SIZE_BYTES,
	parseCsvFile,
	parseXlsxFile,
	validateBulkImportSheet,
	type BulkImportRowResult,
} from "../-utils/bulkImportParsers";
import { DashboardDataTable } from "../../-components/DashboardDataTableShared";

type BulkImportProcessingStep = "detecting-columns" | "preparing-preview" | "reading" | "validating-rows";

const BULK_IMPORT_PROCESSING_STEPS = [
	{ key: "reading", label: "Reading spreadsheet" },
	{ key: "detecting-columns", label: "Detecting columns" },
	{ key: "validating-rows", label: "Validating rows" },
	{ key: "preparing-preview", label: "Preparing preview" },
] as const satisfies Array<{ key: BulkImportProcessingStep; label: string }>;

const BULK_IMPORT_IMPORTING_STEPS = [
	{ key: "importing", label: "Creating inventory records and alerts" },
] as const;

type BulkImportStage =
	| {
			duplicateRows: Array<Extract<BulkImportRowResult, { status: "duplicate" }>>;
			idempotencyKey: string;
			invalidRows: Array<Extract<BulkImportRowResult, { status: "invalid" }>>;
			stage: "importing";
			validRows: Array<Extract<BulkImportRowResult, { status: "valid" }>>;
	  }
	| {
			duplicateRows: Array<Extract<BulkImportRowResult, { status: "duplicate" }>>;
			idempotencyKey: string;
			invalidRows: Array<Extract<BulkImportRowResult, { status: "invalid" }>>;
			stage: "preview";
			validRows: Array<Extract<BulkImportRowResult, { status: "valid" }>>;
	  }
	| { error?: string; file: File | null; stage: "upload" }
	| { stage: "processing"; step: BulkImportProcessingStep };

const describeBulkImportHeaderIssues = (issues: string[]) => issues.join(". ");

const yieldToUi = () => waitFor(0);

const EMPTY_BULK_IMPORT_PREVIEW_ROWS: BulkImportRowResult[] = [];

const bulkImportPreviewColumnHelper = createDataTableColumnHelper<BulkImportRowResult>();

type BulkImportPreviewField = ExtractUnion<typeof INVENTORY_BULK_IMPORT_COLUMNS, "values">;
type ValidBulkImportRow = Extract<BulkImportRowResult, { status: "valid" }>;
type InvalidBulkImportRow = Extract<BulkImportRowResult, { status: "invalid" }>;

const partitionBulkImportRows = (
	rows: ValidBulkImportRow[],
	issues: Array<{ message: string; rowIndex: number }>
) => {
	const issueByRowIndex = new Map(issues.map((issue) => [issue.rowIndex, issue.message]));
	const invalidRows: InvalidBulkImportRow[] = [];
	const validRows: ValidBulkImportRow[] = [];

	for (const [rowIndex, row] of rows.entries()) {
		const message = issueByRowIndex.get(rowIndex);

		if (!message) {
			validRows.push(row);
			continue;
		}

		invalidRows.push({
			errors: [{ field: "root", message }],
			rawRow: row.data,
			rowNumber: row.rowNumber,
			status: "invalid",
		});
	}

	return { invalidRows, validRows };
};

const getBulkImportPreviewFieldValue = (result: BulkImportRowResult, field: BulkImportPreviewField) => {
	if (result.status === "valid") {
		const value = result.data[field];

		if (value === undefined) {
			return EMPTY_DISPLAY_VALUE;
		}

		if (field === "expiryDate") {
			return formatDate(String(value));
		}

		return String(value);
	}

	const raw = result.rawRow[field];

	if (raw === undefined || raw === null || raw === "") {
		return EMPTY_DISPLAY_VALUE;
	}

	if (raw instanceof Date) {
		return formatDate(raw);
	}
	if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
		return String(raw);
	}

	return EMPTY_DISPLAY_VALUE;
};

const getBulkImportFieldError = (result: BulkImportRowResult, field: BulkImportPreviewField) => {
	if (result.status !== "invalid") return;

	return result.errors.find(
		(error) => error.field === field || (field === "name" && error.field === "root")
	)?.message;
};

function BulkImportPreviewCell(props: { field: BulkImportPreviewField; result: BulkImportRowResult }) {
	const { field, result } = props;

	const value = getBulkImportPreviewFieldValue(result, field);
	const fieldError = getBulkImportFieldError(result, field);
	const isDuplicateAnchor = result.status === "duplicate" && field === "name";

	if (!fieldError && !isDuplicateAnchor) {
		return <span>{value}</span>;
	}

	const tone = fieldError ? "red" : "orange";

	const message =
		fieldError
		?? (result.status === "duplicate" ? `Duplicate of row ${result.duplicateOfRowNumber}` : "");

	return (
		<div className="flex flex-col gap-1">
			<span
				className={cnJoin(
					"rounded-sm border px-2 py-1",
					tone === "red" ?
						"border-red-300 bg-red-50 text-red-700"
					:	"border-orange-300 bg-orange-50 text-orange-700"
				)}
			>
				{value === EMPTY_DISPLAY_VALUE ? "[Empty]" : value}
			</span>
			<span
				className={cnJoin(
					"flex items-center gap-1 text-[11px] font-medium",
					tone === "red" ? "text-red-600" : "text-orange-600"
				)}
			>
				<IconBox icon="lucide:triangle-alert" className="size-3 shrink-0" />
				{message}
			</span>
		</div>
	);
}

function BulkImportPreviewStatusIcon(props: { result: BulkImportRowResult }) {
	const { result } = props;

	if (result.status === "valid") {
		return (
			<span className="grid size-6 place-items-center rounded-full bg-green-600 text-white">
				<IconBox icon="lucide:check" className="size-3.5" />
			</span>
		);
	}

	if (result.status === "duplicate") {
		return (
			<span className="grid size-6 place-items-center rounded-full bg-orange-500 text-white">
				<IconBox icon="lucide:triangle-alert" className="size-3.5" />
			</span>
		);
	}

	return (
		<span className="grid size-6 place-items-center rounded-full bg-red-600 text-white">
			<IconBox icon="lucide:x" className="size-3.5" />
		</span>
	);
}

type BulkImportChecklistItemStatus = "active" | "done" | "pending";

const getBulkImportChecklistItemStatus = (
	index: number,
	stepIndex: number
): BulkImportChecklistItemStatus => {
	if (index < stepIndex) {
		return "done";
	}

	if (index === stepIndex) {
		return "active";
	}

	return "pending";
};

function BulkImportChecklistItem(props: { label: string; status: BulkImportChecklistItemStatus }) {
	const { label, status } = props;

	return (
		<li
			className={cnJoin(
				"flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors",
				status === "active" && "bg-vitastock-primary-main/10 text-vitastock-primary-main",
				status === "done" && "text-shadcn-foreground",
				status === "pending" && "text-vitastock-body-color/60"
			)}
		>
			<Switch.Root>
				<Switch.Match when={status === "done"}>
					<span
						className="grid size-5 shrink-0 place-items-center rounded-full
							bg-vitastock-primary-main"
					>
						<IconBox icon="lucide:check" className="size-3 text-white" />
					</span>
				</Switch.Match>

				<Switch.Match when={status === "active"}>
					<span
						className="grid size-5 shrink-0 place-items-center rounded-full border-2
							border-vitastock-primary-main"
					>
						<SpinnerIcon className="size-2.5 text-vitastock-primary-main" />
					</span>
				</Switch.Match>

				<Switch.Default>
					<span
						className="grid size-5 shrink-0 place-items-center rounded-full border-2
							border-shadcn-border text-vitastock-body-color/50"
					>
						<IconBox icon="lucide:ellipsis" className="size-3" />
					</span>
				</Switch.Default>
			</Switch.Root>

			{label}
		</li>
	);
}

function BulkImportStatusScreen(props: {
	description: string;
	progress?: number;
	stepIndex: number;
	steps: ReadonlyArray<{ key: string; label: string }>;
	title: string;
}) {
	const { description, progress, stepIndex, steps, title } = props;

	return (
		<>
			<div className="flex flex-col items-center gap-1.5 px-10 py-14 text-center">
				<SpinnerIcon className="size-9 text-vitastock-primary-main" />

				<DialogAnimated.Title className="mt-4 text-[20px] font-extrabold text-shadcn-foreground">
					{title}
				</DialogAnimated.Title>
				<DialogAnimated.Description
					className="max-w-80 text-[13px] font-medium text-vitastock-body-color"
				>
					{description}
				</DialogAnimated.Description>

				<ul className="mt-6 flex w-full max-w-76 flex-col gap-1">
					<For
						each={steps}
						renderItem={(step, index) => (
							<BulkImportChecklistItem
								key={step.key}
								label={step.label}
								status={getBulkImportChecklistItemStatus(index, stepIndex)}
							/>
						)}
					/>
				</ul>
			</div>

			{progress !== undefined && (
				<div
					role="progressbar"
					aria-label="Inventory import progress"
					aria-valuemax={100}
					aria-valuemin={0}
					aria-valuenow={progress}
					className="h-1 w-full bg-shadcn-muted"
				>
					<div
						className="h-full bg-vitastock-primary-main transition-all duration-300"
						style={{ width: `${progress}%` }}
					/>
				</div>
			)}
		</>
	);
}

const bulkImportPreviewColumns = bulkImportPreviewColumnHelper.columns([
	bulkImportPreviewColumnHelper.accessor("rowNumber", {
		cell: ({ row }) => row.original.rowNumber,
		header: () => "#",
		meta: { classNames: { column: "w-14 min-w-14" } },
	}),
	bulkImportPreviewColumnHelper.display({
		cell: ({ row }) => <BulkImportPreviewCell field="name" result={row.original} />,
		header: () => "Drug Name",
		id: "name",
		meta: { classNames: { column: "min-w-48" } },
	}),
	bulkImportPreviewColumnHelper.display({
		cell: ({ row }) => <BulkImportPreviewCell field="genericName" result={row.original} />,
		header: () => "Generic Name",
		id: "genericName",
		meta: { classNames: { column: "min-w-60" } },
	}),
	bulkImportPreviewColumnHelper.display({
		cell: ({ row }) => <BulkImportPreviewCell field="strength" result={row.original} />,
		header: () => "Strength",
		id: "strength",
		meta: { classNames: { column: "min-w-36" } },
	}),
	bulkImportPreviewColumnHelper.display({
		cell: ({ row }) => <BulkImportPreviewCell field="form" result={row.original} />,
		header: () => "Form",
		id: "form",
		meta: { classNames: { column: "min-w-32" } },
	}),
	bulkImportPreviewColumnHelper.display({
		cell: ({ row }) => <BulkImportPreviewCell field="unit" result={row.original} />,
		header: () => "Unit",
		id: "unit",
		meta: { classNames: { column: "min-w-28" } },
	}),
	bulkImportPreviewColumnHelper.display({
		cell: ({ row }) => <BulkImportPreviewCell field="quantity" result={row.original} />,
		header: () => "Quantity",
		id: "quantity",
		meta: { classNames: { column: "min-w-24" } },
	}),
	bulkImportPreviewColumnHelper.display({
		cell: ({ row }) => <BulkImportPreviewCell field="expiryDate" result={row.original} />,
		header: () => "Expiry Date",
		id: "expiryDate",
		meta: { classNames: { column: "min-w-36" } },
	}),
	bulkImportPreviewColumnHelper.display({
		cell: ({ row }) => <BulkImportPreviewStatusIcon result={row.original} />,
		header: () => "Status",
		id: "status",
		meta: { classNames: { column: "w-20 min-w-20" } },
	}),
]);

function BulkImportDialog(props: { onImported?: () => void }) {
	const { onImported } = props;

	const queryClient = useQueryClient();
	const sessionQueryResult = useQuery(sessionQuery());

	const [state, setState] = useState<BulkImportStage>({ file: null, stage: "upload" });

	const previewState = state.stage === "preview" ? state : undefined;
	const importingState = state.stage === "importing" ? state : undefined;
	const showChrome = state.stage === "upload" || state.stage === "preview";
	const previewHasIssues =
		previewState !== undefined
		&& (previewState.invalidRows.length > 0 || previewState.duplicateRows.length > 0);

	const previewRows = useMemo(() => {
		const source = previewState ?? importingState;

		if (!source) {
			return EMPTY_BULK_IMPORT_PREVIEW_ROWS;
		}

		return [...source.validRows, ...source.invalidRows, ...source.duplicateRows].sort(
			(a, b) => a.rowNumber - b.rowNumber
		);
	}, [previewState, importingState]);

	const previewTable = useDataTable({
		columns: bulkImportPreviewColumns,
		data: previewRows,
		getRowId: (row) => String(row.rowNumber),
		initialState: {
			pagination: { pageIndex: 0, pageSize: 25 },
		},
	});

	const handleContinue = async () => {
		if (state.stage !== "upload" || !state.file) return;

		const { file } = state;
		const workspaceTimezone = sessionQueryResult.data?.workspace.timezone;

		if (!workspaceTimezone) {
			setState({ error: "Unable to determine the workspace timezone", file, stage: "upload" });
			return;
		}

		try {
			setState({ stage: "processing", step: "reading" });
			await yieldToUi();

			const isXlsx = file.name.toLowerCase().endsWith(".xlsx");
			const sheetRows = isXlsx ? await parseXlsxFile(file) : await parseCsvFile(file);

			setState({ stage: "processing", step: "detecting-columns" });
			await yieldToUi();

			setState({ stage: "processing", step: "validating-rows" });
			await yieldToUi();

			const result = validateBulkImportSheet(
				sheetRows,
				formatCalendarDateInTimezone(new Date(), workspaceTimezone)
			);

			if (result.status === "header-error") {
				setState({ error: describeBulkImportHeaderIssues(result.issues), file, stage: "upload" });
				return;
			}

			if (result.status === "too-many-rows") {
				setState({
					error: `This file has ${result.rowCount} rows. The maximum allowed is ${INVENTORY_BULK_IMPORT_MAX_ROWS}.`,
					file,
					stage: "upload",
				});
				return;
			}

			if (result.validRows.length === 0) {
				setState({
					duplicateRows: result.duplicateRows,
					idempotencyKey: crypto.randomUUID(),
					invalidRows: result.invalidRows,
					stage: "preview",
					validRows: [],
				});
				return;
			}

			setState({ stage: "processing", step: "preparing-preview" });
			await yieldToUi();

			const backendValidation = await callBackendApiForQuery("@post/inventory/bulk-import/validate", {
				body: { rows: result.validRows.map((row) => row.data) },
			});
			const partitionedRows = partitionBulkImportRows(result.validRows, backendValidation.data.issues);

			setState({
				duplicateRows: result.duplicateRows,
				idempotencyKey: crypto.randomUUID(),
				invalidRows: [...result.invalidRows, ...partitionedRows.invalidRows],
				stage: "preview",
				validRows: partitionedRows.validRows,
			});
		} catch (error) {
			setState({
				error: error instanceof Error ? error.message : "Failed to process file",
				file,
				stage: "upload",
			});
		}
	};

	const handleImport = async () => {
		if (state.stage !== "preview") return;

		const { duplicateRows, idempotencyKey, invalidRows, validRows } = state;

		setState({
			duplicateRows,
			idempotencyKey,
			invalidRows,
			stage: "importing",
			validRows,
		});
		await yieldToUi();

		try {
			await callBackendApiForQuery("@post/inventory/bulk-import", {
				body: {
					rows: validRows.map((row) => row.data),
				},
				headers: {
					"x-idempotency-key": idempotencyKey,
				},
				meta: { toast: { success: true } },
				onSuccess: () => {
					void queryClient.invalidateQueries(inventorySummaryQuery());
					void queryClient.invalidateQueries(dashboardOverviewQuery());
					void queryClient.invalidateQueries(inventoryAlertsUnreadCountQuery());
					void queryClient.invalidateQueries({
						queryKey: inventoryAlertsQuery().queryKey.slice(0, -1),
					});
					void queryClient.invalidateQueries({
						queryKey: inventoryActivityQuery().queryKey.slice(0, -1),
					});
					void queryClient.invalidateQueries({
						queryKey: inventoryDrugsQuery().queryKey.slice(0, -1),
					});
				},
			});

			setState({ file: null, stage: "upload" });
			onImported?.();
		} catch {
			setState({ duplicateRows, idempotencyKey, invalidRows, stage: "preview", validRows });
		}
	};

	const dialogDescription =
		previewState ?
			"Step 2: Preview & Validation"
		:	"Step 1: Upload a csv/excel file containing your drug stock to add your stock in bulk";

	return (
		<DialogAnimated.Content
			withCloseButton={false}
			onEscapeKeyDown={(event) => {
				if (state.stage === "importing") {
					event.preventDefault();
				}
			}}
			onPointerDownOutside={(event) => {
				if (state.stage === "importing") {
					event.preventDefault();
				}
			}}
			className={cnJoin(
				`flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-400px)] flex-col gap-0 overflow-hidden rounded-lg
				border-shadcn-border bg-shadcn-background p-0`,
				previewState ? "h-[calc(100dvh-2rem)] max-w-none" : "max-w-175"
			)}
		>
			<Switch.Root>
				<Switch.Match when={showChrome}>
					<>
						<header
							className="flex items-start justify-between gap-6 border-b border-shadcn-border/70
								px-7 py-5"
						>
							<div className="flex flex-col gap-1">
								<DialogAnimated.Title className="text-[22px] font-extrabold text-shadcn-foreground">
									Bulk Import Stock
								</DialogAnimated.Title>
								<DialogAnimated.Description
									className="text-[13px] font-medium text-vitastock-body-color/90"
								>
									{dialogDescription}
								</DialogAnimated.Description>
							</div>

							<DialogAnimated.Close
								className="rounded-lg p-1 text-vitastock-body-color hover:bg-shadcn-muted"
							>
								<IconBox icon="lucide:x" className="size-6" />
								<span className="sr-only">Close</span>
							</DialogAnimated.Close>
						</header>

						<Switch.Root>
							<Switch.Match when={state.stage === "upload"}>
								<ScrollArea.Root className="min-h-0 flex-1">
									<div className="flex flex-col gap-6 p-7">
										<DropZoneInput.Root
											allowedFileTypes={[".csv", ".xlsx"]}
											maxFileCount={1}
											maxFileSize={{ mb: MAX_BULK_IMPORT_FILE_SIZE_BYTES / (1024 * 1024) }}
											onChange={(file) => setState({ file, stage: "upload" })}
										>
											<DropZoneInput.Area
												classNames={{
													container: `grid min-h-54 cursor-pointer place-items-center
													rounded-lg border border-dashed border-vitastock-primary-light
													bg-shadcn-muted/40 transition-colors
													hover:border-vitastock-primary-main
													data-[drag-over=true]:border-vitastock-primary-main
													data-[drag-over=true]:bg-vitastock-primary-main/5`,
												}}
												unstyled={true}
											>
												<article
													className="flex w-full flex-col items-center gap-1 text-center"
												>
													<span
														className="grid size-14 place-items-center rounded-lg
															bg-vitastock-primary-main/15 text-vitastock-primary-main"
													>
														<IconBox icon="lucide:file-down" className="size-7" />
													</span>

													<p className="mt-4 text-[16px] font-bold text-shadcn-foreground">
														Drag and drop your file here or click to browse
													</p>
													<p className="text-[13px] font-medium text-vitastock-body-color">
														CSV or Excel files only (max 10MB)
													</p>

													<Button className="mt-4 h-9 px-4" type="button">
														Browse Files
													</Button>
												</article>
											</DropZoneInput.Area>

											<DropZoneInput.ImagePreview
												classNames={{
													listContainer: "mt-4 w-full max-w-110",
													listItem: "min-h-16",
													preview: `grid size-10 place-items-center rounded-lg
													bg-vitastock-primary-main/10 text-vitastock-primary-main`,
												}}
											/>
										</DropZoneInput.Root>

										{state.stage === "upload" && state.error && (
											<p
												className="rounded-lg bg-red-50 p-3 text-[13px] font-medium
													text-red-700"
											>
												{state.error}
											</p>
										)}

										<article className="flex flex-col gap-5 rounded-lg bg-shadcn-muted/70 p-5">
											<header className="flex items-center justify-between gap-4">
												<h4
													className="flex items-center gap-2 text-[14px] font-bold
														text-shadcn-foreground"
												>
													<IconBox
														icon="lucide:circle"
														className="size-4 rounded-full text-vitastock-primary-main"
													/>
													File Requirements
												</h4>

												<a
													href="/templates/bulk-import-template.xlsx"
													download={true}
													className="flex items-center gap-1.5 text-[13px] font-bold
														text-vitastock-primary-main hover:underline"
												>
													<IconBox icon="lucide:download" className="size-4" />
													Download Sample Template
												</a>
											</header>

											<div className="grid gap-6 md:grid-cols-2">
												<div className="flex flex-col gap-2">
													<p
														className="text-[11px] font-bold tracking-wider
															text-vitastock-body-color uppercase"
													>
														Required Fields
													</p>
													<ul
														className="space-y-1.5 text-[13px] font-medium
															text-vitastock-body-color"
													>
														<li className="flex items-center gap-2">
															<span className="size-1.5 rounded-full bg-shadcn-destructive" />
															Drug Name and Generic Name
														</li>
														<li className="flex items-center gap-2">
															<span className="size-1.5 rounded-full bg-shadcn-destructive" />
															Quantity
														</li>
														<li className="flex items-center gap-2">
															<span className="size-1.5 rounded-full bg-shadcn-destructive" />
															Expiry Date (must be a future date)
														</li>
													</ul>
												</div>

												<div className="flex flex-col gap-2">
													<p
														className="text-[11px] font-bold tracking-wider
															text-vitastock-body-color uppercase"
													>
														Optional Fields
													</p>
													<ul
														className="space-y-1.5 text-[13px] font-medium
															text-vitastock-body-color"
													>
														<li className="flex items-center gap-2">
															<span className="size-1.5 rounded-full bg-shadcn-border" />
															Strength, Dosage Form, Unit
														</li>
													</ul>
												</div>
											</div>
										</article>
									</div>
								</ScrollArea.Root>
							</Switch.Match>

							<Switch.Match when={previewState !== undefined}>
								{previewState && (
									<div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden p-7">
										<ForWithWrapper
											as="div"
											aria-label="Import validation summary"
											className="grid grid-cols-4 gap-3"
											each={[
												{
													label: "Total Rows",
													value:
														previewState.validRows.length
														+ previewState.invalidRows.length
														+ previewState.duplicateRows.length,
												},
												{ label: "Valid", value: previewState.validRows.length },
												{ label: "Invalid", value: previewState.invalidRows.length },
												{ label: "Duplicate", value: previewState.duplicateRows.length },
											]}
											renderItem={(stat) => (
												<article
													key={stat.label}
													className="rounded-lg bg-shadcn-muted/50 p-3 text-center"
												>
													<p className="text-[20px] font-extrabold text-shadcn-foreground">
														{stat.value}
													</p>
													<p
														className="text-[11px] font-bold text-vitastock-body-color
															uppercase"
													>
														{stat.label}
													</p>
												</article>
											)}
										/>

										<aside
											className={cnJoin(
												"flex items-start gap-3 rounded-lg p-3 text-[13px] font-medium",
												previewHasIssues ? "bg-red-50 text-red-700" : (
													"bg-green-50 text-green-700"
												)
											)}
										>
											<IconBox
												icon="lucide:triangle-alert"
												className="mt-0.5 size-4 shrink-0"
											/>
											<span>
												{previewHasIssues ?
													`${previewState.invalidRows.length + previewState.duplicateRows.length} rows require correction. Fix the source file and upload it again.`
												:	`All ${previewState.validRows.length} rows passed validation and are ready to import.`
												}
											</span>
										</aside>

										<DashboardDataTable
											table={previewTable}
											emptyMessage="No rows detected in this file."
											classNames={{
												base: "min-h-70 grow",
												tableContainer: "min-h-0 grow rounded-lg border border-shadcn-border",
												tableHead: "sticky top-0 z-1 bg-shadcn-muted",
												tableRoot: "min-w-250",
											}}
										/>
									</div>
								)}
							</Switch.Match>
						</Switch.Root>

						<DialogAnimated.Footer
							className="flex-row items-center justify-between gap-5 border-t
								border-shadcn-border/70 bg-shadcn-muted/30 p-5"
						>
							<Show.Root when={previewState !== undefined}>
								<Show.Content>
									<Button
										unstyled={true}
										className="flex items-center gap-1.5 text-[13px] font-bold
											text-vitastock-body-color hover:text-shadcn-foreground"
										onClick={() => setState({ file: null, stage: "upload" })}
									>
										<IconBox icon="lucide:arrow-left" className="size-4" />
										Back
									</Button>
								</Show.Content>
							</Show.Root>

							<div className="ml-auto flex items-center gap-5">
								<DialogAnimated.Close asChild={true}>
									<Button theme="secondary-outline">Cancel</Button>
								</DialogAnimated.Close>

								{state.stage === "upload" && (
									<Button
										isDisabled={!state.file}
										className="h-12 min-w-38 gap-2 rounded-lg px-6 text-[15px]"
										onClick={() => void handleContinue()}
									>
										Continue
										<IconBox icon="lucide:arrow-right" className="size-4" />
									</Button>
								)}

								{previewState && (
									<Button
										isDisabled={
											previewState.invalidRows.length > 0
											|| previewState.duplicateRows.length > 0
											|| previewState.validRows.length === 0
										}
										className="h-12 min-w-38 gap-2 rounded-lg px-6 text-[15px]"
										onClick={() => void handleImport()}
									>
										Import {previewState.validRows.length} Rows
										<IconBox icon="lucide:arrow-right" className="size-4" />
									</Button>
								)}
							</div>
						</DialogAnimated.Footer>
					</>
				</Switch.Match>

				<Switch.Match when={state.stage === "processing"}>
					<BulkImportStatusScreen
						description="Please wait while we validate and prepare your inventory data."
						steps={BULK_IMPORT_PROCESSING_STEPS}
						stepIndex={BULK_IMPORT_PROCESSING_STEPS.findIndex(
							(step) => state.stage === "processing" && step.key === state.step
						)}
						title="Processing Inventory File"
					/>
				</Switch.Match>

				<Switch.Match when={importingState !== undefined}>
					{importingState && (
						<BulkImportStatusScreen
							description="Your inventory is being added to the workspace."
							steps={BULK_IMPORT_IMPORTING_STEPS}
							stepIndex={0}
							title="Importing Inventory"
						/>
					)}
				</Switch.Match>
			</Switch.Root>
		</DialogAnimated.Content>
	);
}

export { BulkImportDialog };
