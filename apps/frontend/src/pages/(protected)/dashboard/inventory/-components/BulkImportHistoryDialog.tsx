"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DialogAnimated } from "@/components/animated/ui";
import { ForWithWrapper } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { Show } from "@/components/common/show";
import { Switch } from "@/components/common/switch";
import { ScrollArea } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { removeInventoryBulkImportMutation } from "@/lib/react-query/mutationOptions";
import {
	inventoryBulkImportsQuery,
	inventoryDrugsQuery,
	sessionQuery,
	type InventoryBulkImportsQueryResultType,
} from "@/lib/react-query/queryOptions";
import { formatDate, formatDateTime } from "@/lib/utils/formatters";
import { invalidateStockMovementQueries } from "../../-utils/invalidateStockMovementQueries";

type BulkImportHistoryItem = InventoryBulkImportsQueryResultType[number];

export function BulkImportHistoryDialog() {
	const bulkImportsQueryResult = useQuery(inventoryBulkImportsQuery());
	const sessionQueryResult = useQuery(sessionQuery());
	const isOwner = sessionQueryResult.data?.user.role === "owner";

	return (
		<DialogAnimated.Content
			withCloseButton={false}
			className="flex max-h-[calc(100svh-32px)] max-w-[560px] flex-col gap-0 overflow-hidden rounded-lg"
		>
			<header
				className="flex shrink-0 items-start justify-between gap-6 border-b border-shadcn-border/70
					p-5"
			>
				<div className="flex flex-col gap-1">
					<DialogAnimated.Title className="text-[18px] font-extrabold text-shadcn-foreground">
						Import History
					</DialogAnimated.Title>
					<DialogAnimated.Description className="text-[13px] font-medium text-vitastock-body-color">
						{isOwner ?
							"Remove an import that went in wrong, as long as none of its stock has been used yet."
						:	"Only the pharmacy owner can remove an import."}
					</DialogAnimated.Description>
				</div>

				<DialogAnimated.Close
					className="rounded-lg p-1 text-vitastock-body-color hover:bg-shadcn-muted"
				>
					<IconBox icon="lucide:x" className="size-6" />
					<span className="sr-only">Close</span>
				</DialogAnimated.Close>
			</header>

			<ScrollArea.Root
				type="auto"
				classNames={{ base: "grid min-h-0 flex-1", viewport: "h-auto min-h-0" }}
			>
				<Switch.Root>
					<Switch.Match when={bulkImportsQueryResult.isLoading}>
						<p className="p-6 text-center text-[14px] text-vitastock-body-color">
							Loading imports...
						</p>
					</Switch.Match>

					<Switch.Match when={bulkImportsQueryResult.isError}>
						<p className="p-6 text-center text-[14px] text-shadcn-destructive">
							Failed to load imports. Try reopening this dialog.
						</p>
					</Switch.Match>

					<Switch.Match when={bulkImportsQueryResult.data?.length === 0}>
						<p className="p-6 text-center text-[14px] text-vitastock-body-color">No imports yet.</p>
					</Switch.Match>

					<Switch.Default>
						<ForWithWrapper
							as="ul"
							className="flex flex-col divide-y divide-shadcn-border/70"
							each={bulkImportsQueryResult.data ?? []}
							renderItem={(bulkImport) => (
								<BulkImportHistoryRow
									key={bulkImport.id}
									bulkImport={bulkImport}
									canRemove={isOwner}
								/>
							)}
						/>
					</Switch.Default>
				</Switch.Root>
			</ScrollArea.Root>
		</DialogAnimated.Content>
	);
}

function BulkImportHistoryRow(props: { bulkImport: BulkImportHistoryItem; canRemove: boolean }) {
	const { bulkImport, canRemove } = props;

	return (
		<li className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
			<div className="flex flex-col gap-1">
				<p className="text-[14px] font-bold text-shadcn-foreground">
					{formatDateTime(bulkImport.createdAt)}
				</p>
				<p className="text-[13px] text-vitastock-body-color">
					By {bulkImport.importedBy} · {bulkImport.drugCount.toLocaleString()} drugs ·{" "}
					{bulkImport.unitCount.toLocaleString()} units
				</p>

				<Show.Root when={bulkImport.removal}>
					{bulkImport.removal && (
						<p className="text-[12px] font-semibold text-shadcn-destructive">
							Removed by {bulkImport.removal.removedBy} on{" "}
							{formatDate(bulkImport.removal.removedAt)}
						</p>
					)}
				</Show.Root>

				<Show.Root when={!bulkImport.removal && canRemove && bulkImport.removalBlockedReason !== null}>
					<p className="text-[12px] font-medium text-vitastock-body-color/80">
						{bulkImport.removalBlockedReason}
					</p>
				</Show.Root>
			</div>

			<Show.Root when={canRemove && !bulkImport.removal}>
				<RemoveBulkImportButton bulkImport={bulkImport} />
			</Show.Root>
		</li>
	);
}

function RemoveBulkImportButton(props: { bulkImport: BulkImportHistoryItem }) {
	const { bulkImport } = props;

	const queryClient = useQueryClient();
	const removeImportMutationResult = useMutation({
		...removeInventoryBulkImportMutation(),
		onSuccess: () =>
			Promise.all([
				invalidateStockMovementQueries(queryClient),
				queryClient.invalidateQueries({ queryKey: inventoryDrugsQuery().queryKey.slice(0, -1) }),
			]),
	});

	return (
		<DialogAnimated.Root>
			<DialogAnimated.Trigger asChild={true}>
				<Button
					theme="secondary-outline"
					className="h-9 shrink-0 px-3 text-[13px] text-shadcn-destructive"
					isDisabled={bulkImport.removalBlockedReason !== null}
				>
					<IconBox icon="lucide:trash" className="size-4" />
					Remove this import
				</Button>
			</DialogAnimated.Trigger>

			<DialogAnimated.Content className="max-w-[420px] rounded-lg">
				<DialogAnimated.Header className="text-left">
					<DialogAnimated.Title className="text-[18px] font-extrabold">
						Remove this import?
					</DialogAnimated.Title>
					<DialogAnimated.Description className="text-[14px] text-vitastock-body-color">
						Remove {bulkImport.drugCount.toLocaleString()} drugs and{" "}
						{bulkImport.unitCount.toLocaleString()} units added on {formatDate(bulkImport.createdAt)}
						? This cannot be undone.
					</DialogAnimated.Description>
				</DialogAnimated.Header>

				<DialogAnimated.Footer className="flex-row justify-end gap-3 *:flex-1 md:*:flex-none">
					<DialogAnimated.Close asChild={true}>
						<Button theme="primary-ghost" className="h-10 px-4">
							Cancel
						</Button>
					</DialogAnimated.Close>

					<Button
						className="h-10 bg-shadcn-destructive px-4 hover:bg-shadcn-destructive/90"
						isLoading={removeImportMutationResult.isPending}
						isDisabled={removeImportMutationResult.isPending}
						onClick={() => removeImportMutationResult.mutate({ stockTransactionId: bulkImport.id })}
					>
						Remove import
					</Button>
				</DialogAnimated.Footer>
			</DialogAnimated.Content>
		</DialogAnimated.Root>
	);
}
