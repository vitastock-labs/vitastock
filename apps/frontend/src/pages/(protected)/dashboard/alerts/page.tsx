"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSearchParams } from "@zayne-labs/toolkit-core";
import { parseAsStringEnum, useQueryStates } from "nuqs";
import { TabsAnimated } from "@/components/animated/ui";
import { For } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { NavLinkEphemeral } from "@/components/common/NavLink";
import { Switch } from "@/components/common/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StockMovementLogTypeSchema, StockOutReasonSchema } from "@/lib/api/callBackendApi/apiSchema";
import { acknowledgeInventoryAlertMutation } from "@/lib/react-query/mutationOptions";
import {
	inventoryAlertsQuery,
	inventoryAlertsQueryKey,
	inventoryAlertsUnreadCountQuery,
	type InventoryAlertsQueryResultType,
} from "@/lib/react-query/queryOptions";
import { cnJoin } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/formatters";
import { EmptyState } from "@/pages/(protected)/dashboard/-components/EmptyState";
import { Main } from "../-components/Main";

const filterCategories = ["all", "expired", "expiring_soon", "low_stock"] as const;
const alertStatuses = ["active", "resolved"] as const;
type FilterCategory = (typeof filterCategories)[number];
type AlertStatus = InventoryAlertsQueryResultType["alerts"][number]["status"];

const filterLabels: Record<FilterCategory, string> = {
	all: "All Alerts",
	expired: "Expired",
	expiring_soon: "Expiring Soon",
	low_stock: "Low Stock",
};

const alertPresentation = {
	expired: {
		icon: "lucide:triangle-alert",
		title: "Expired stock must be removed",
	},
	expiring_soon: {
		icon: "lucide:clock",
		title: "Stock is approaching expiry",
	},
	low_stock: {
		icon: "lucide:archive",
		title: "Low stock requires attention",
	},
} as const;

const alertActionPresentation = {
	remove: {
		icon: "lucide:trash-2",
		label: "Remove",
	},
	restock: {
		icon: "lucide:shopping-cart",
		label: "Restock",
	},
	review: {
		icon: "lucide:arrow-right",
		label: "Review",
	},
} as const;

function AlertsPage() {
	const [{ alertStatus, filter: activeFilter }, setAlertSearchParams] = useQueryStates({
		alertStatus: parseAsStringEnum([...alertStatuses]).withDefault("active"),
		filter: parseAsStringEnum([...filterCategories]).withDefault("all"),
	});

	const alertsQueryResult = useQuery(inventoryAlertsQuery({ status: alertStatus }));
	const queryClient = useQueryClient();
	const acknowledgeInventoryAlertMutationResult = useMutation(acknowledgeInventoryAlertMutation());
	const alerts = alertsQueryResult.data?.alerts ?? [];
	const filteredAlerts = alerts.filter((alert) => activeFilter === "all" || alert.type === activeFilter);

	const emptyStateTitle = (() => {
		if (activeFilter !== "all") {
			return `No ${filterLabels[activeFilter].toLowerCase()} alerts`;
		}

		if (alertStatus === "resolved") {
			return "No resolved alerts";
		}

		return "No alerts";
	})();
	const emptyStateDescription = (() => {
		if (activeFilter !== "all") {
			return "No alerts match this filter.";
		}

		if (alertStatus === "resolved") {
			return "Resolved inventory issues will appear here.";
		}

		return "Your inventory is in good shape. No issues were detected.";
	})();

	const onAcknowledge = (alertId: string) => {
		acknowledgeInventoryAlertMutationResult.mutate(
			{ alertId },
			{
				onSuccess: () => {
					void Promise.all([
						queryClient.invalidateQueries({ queryKey: inventoryAlertsQueryKey }),
						queryClient.invalidateQueries(inventoryAlertsUnreadCountQuery()),
					]);
				},
			}
		);
	};

	return (
		<Main className="gap-8">
			<section className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
				<div>
					<h1 className="text-[32px] font-extrabold tracking-tight text-black">Alerts</h1>
					<p className="mt-1 text-[15px] font-medium text-vitastock-body-color/80">
						Manage critical inventory issues needing attention.
					</p>
				</div>

				<div className="flex flex-col items-end gap-3">
					<TabsAnimated.Root
						value={alertStatus}
						onValueChange={(value) => {
							void setAlertSearchParams({ alertStatus: value as AlertStatus });
						}}
					>
						<TabsAnimated.List>
							<TabsAnimated.Trigger value="active">Active</TabsAnimated.Trigger>
							<TabsAnimated.Trigger value="resolved">Resolved</TabsAnimated.Trigger>
						</TabsAnimated.List>
					</TabsAnimated.Root>

					<TabsAnimated.Root
						value={activeFilter}
						onValueChange={(value) => {
							void setAlertSearchParams({ filter: value as FilterCategory });
						}}
					>
						<TabsAnimated.List
							className="h-10 gap-1 bg-transparent p-0"
							classNames={{
								highlight: "border-vitastock-primary-main bg-vitastock-primary-main shadow-none",
							}}
						>
							<For
								each={filterCategories}
								renderItem={(filterCategory) => (
									<TabsAnimated.Trigger
										key={filterCategory}
										value={filterCategory}
										className="h-10 rounded-lg border border-shadcn-border/60 px-4 text-[14px]
											data-[state=active]:border-transparent data-[state=active]:text-white"
									>
										{filterLabels[filterCategory]}
									</TabsAnimated.Trigger>
								)}
							/>
						</TabsAnimated.List>
					</TabsAnimated.Root>
				</div>
			</section>

			<section
				className="flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-shadcn-border/40"
			>
				<Switch.Root>
					<Switch.Match when={alertsQueryResult.isLoading}>
						<div className="p-8 text-center text-[14px] text-vitastock-body-color">
							Loading alerts...
						</div>
					</Switch.Match>

					<Switch.Match when={alertsQueryResult.isError}>
						<div className="p-8 text-center text-[14px] text-shadcn-destructive">
							Failed to load inventory alerts.
						</div>
					</Switch.Match>

					<Switch.Match when={alertsQueryResult.isSuccess && filteredAlerts.length === 0}>
						<EmptyState
							icon="lucide:shield-check"
							title={emptyStateTitle}
							description={emptyStateDescription}
							className="min-h-[440px]"
						/>
					</Switch.Match>

					<Switch.Default>
						<For
							each={filteredAlerts}
							renderItem={(alert, index) => {
								const isAcknowledging =
									acknowledgeInventoryAlertMutationResult.isPending
									&& acknowledgeInventoryAlertMutationResult.variables.alertId === alert.id;
								const presentation = alertPresentation[alert.type];
								const actionPresentation = alertActionPresentation[alert.action];

								const quantityLabel =
									alert.type === "low_stock" ? "Available" : "Quantity affected";

								const alertDetail = (() => {
									if (alert.type === "low_stock") {
										return `Threshold: ${alert.threshold ?? 0}`;
									}

									if (alert.expiryDate) {
										return `Expiry: ${formatDate(alert.expiryDate)}`;
									}

									return "Expiry date unavailable";
								})();

								const actionSearch = (() => {
									if (alert.action === "remove") {
										return createSearchParams({
											batchId: alert.batchId ?? "",
											drugId: alert.drug.id,
											movement: StockMovementLogTypeSchema.enum.stock_out,
											reason: StockOutReasonSchema.enum.expired,
										}).toString();
									}

									if (alert.action === "restock") {
										return createSearchParams({
											drugId: alert.drug.id,
											movement: StockMovementLogTypeSchema.enum.stock_in,
										}).toString();
									}

									return "";
								})();

								return (
									<article
										key={alert.id}
										className={cnJoin(
											"flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between",
											index !== filteredAlerts.length - 1 && "border-b border-shadcn-border/40"
										)}
									>
										<div className="flex items-start gap-4">
											<span
												className={cnJoin(
													"grid size-12 shrink-0 place-items-center rounded-xl",
													alert.type === "expired"
														&& "bg-shadcn-destructive/10 text-shadcn-destructive",
													alert.type === "expiring_soon" && "bg-amber-500/10 text-amber-600",
													alert.type === "low_stock" && "bg-amber-400/15 text-amber-700"
												)}
											>
												<IconBox icon={presentation.icon} className="size-5.5" />
											</span>

											<div className="flex flex-col gap-1.5">
												<h3 className="text-[16px] font-bold text-black">
													{presentation.title}
												</h3>
												<div
													className="flex flex-wrap items-center gap-2 text-[13px]
														text-vitastock-body-color/70"
												>
													<Badge
														className={cnJoin(
															"rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase",
															alert.type === "expired"
																&& `border-shadcn-destructive/20 bg-shadcn-destructive/10
																text-shadcn-destructive`,
															alert.type === "expiring_soon"
																&& "border-amber-500/20 bg-amber-500/10 text-amber-700",
															alert.type === "low_stock"
																&& "border-amber-400/20 bg-amber-400/15 text-amber-700"
														)}
													>
														{filterLabels[alert.type]}
													</Badge>
													<span>
														{alert.drug.name} ({alert.drug.genericName}){" "}
														{alert.drug.strength} {alert.drug.form}
													</span>
													{alert.batchNumber && <span>Batch {alert.batchNumber}</span>}
												</div>
											</div>
										</div>

										<div
											className="flex flex-wrap items-center justify-between gap-4
												md:justify-end"
										>
											<div className="flex flex-col gap-1 text-right text-[13px]">
												<p className="text-vitastock-body-color/70">{quantityLabel}</p>
												<p className="font-medium text-black">
													{alert.quantityAffected ?? 0} units
												</p>
												<p className="text-vitastock-body-color/70">{alertDetail}</p>
											</div>

											<div className="flex items-center gap-3">
												{alert.status === "active" && !alert.acknowledgedAt && (
													<Button
														theme="primary-ghost"
														isDisabled={isAcknowledging}
														isLoading={isAcknowledging}
														loadingStyle="side-by-side"
														onClick={() => onAcknowledge(alert.id)}
													>
														Acknowledge
													</Button>
												)}

												{alert.status === "active" && (
													<NavLinkEphemeral
														to={{
															pathname: "/dashboard/inventory",
															search: actionSearch,
														}}
													>
														<Button
															className={cnJoin(
																alert.action === "remove"
																	&& `border border-shadcn-destructive bg-transparent
																	text-shadcn-destructive hover:bg-shadcn-destructive/5`,
																alert.action === "restock"
																	&& `bg-vitastock-primary-main text-white
																	hover:bg-vitastock-primary-main/90`,
																alert.action === "review"
																	&& `border border-shadcn-border bg-white text-black
																	hover:bg-shadcn-muted`
															)}
														>
															<IconBox icon={actionPresentation.icon} className="size-4" />
															{actionPresentation.label}
														</Button>
													</NavLinkEphemeral>
												)}

												{alert.status === "resolved" && (
													<Badge
														className="border-none bg-shadcn-muted px-3 py-1
															text-vitastock-body-color"
													>
														Resolved
													</Badge>
												)}
											</div>
										</div>
									</article>
								);
							}}
						/>
					</Switch.Default>
				</Switch.Root>
			</section>
		</Main>
	);
}

export default AlertsPage;
