import { IconBox, type MoniconIconBoxProps } from "@/components/common/IconBox";
import { Empty } from "@/components/ui";

type EmptyStateProps = React.ComponentProps<typeof Empty.Root> & {
	action?: React.ReactNode;
	description: string;
	icon: MoniconIconBoxProps["icon"];
	title: string;
};

function EmptyState(props: EmptyStateProps) {
	const { action, className, description, icon, title, ...restOfProps } = props;

	return (
		<Empty.Root className={className} {...restOfProps}>
			<Empty.Header className="max-w-[420px] gap-0">
				<Empty.Media
					variant="icon"
					className="relative mb-0 size-18 rounded-xl bg-white text-vitastock-primary-main shadow-sm
						ring-1 ring-shadcn-border"
				>
					<IconBox icon={icon} className="size-8" />
					<span
						className="absolute -right-1 -bottom-1 size-3 rounded-full border-2 border-white
							bg-vitastock-primary-main"
					/>
				</Empty.Media>

				<Empty.Title className="mt-6 text-[20px] font-extrabold text-black">{title}</Empty.Title>

				<Empty.Description
					className="mt-2 max-w-[420px] text-[14px]/6 font-medium text-vitastock-body-color"
				>
					{description}
				</Empty.Description>
			</Empty.Header>

			{Boolean(action) && <Empty.Content className="mt-2 w-auto">{action}</Empty.Content>}
		</Empty.Root>
	);
}

export { EmptyState };
