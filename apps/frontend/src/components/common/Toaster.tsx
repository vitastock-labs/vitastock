import { Toaster as Sonner } from "sonner";
import { IconBox } from "@/components/common/IconBox";
import { useThemeStore } from "@/lib/zustand/themeStore";

type ToasterProps = React.ComponentProps<typeof Sonner>;

function ToastIcon(props: { type: "error" | "success" }) {
	const { type } = props;

	return (
		<span className="grid size-8 shrink-0 place-items-center rounded-md bg-white/15">
			<IconBox
				icon={type === "success" ? "lucide:circle-check" : "lucide:triangle-alert"}
				className="size-4.5 text-white"
			/>
		</span>
	);
}

const SonnerToaster = (props: ToasterProps) => {
	const theme = useThemeStore((state) => state.theme);

	return (
		<Sonner
			closeButton={true}
			theme={theme}
			position="bottom-right"
			icons={{
				error: <ToastIcon type="error" />,
				success: <ToastIcon type="success" />,
			}}
			duration={4000}
			visibleToasts={3}
			toastOptions={{
				classNames: {
					closeButton: `absolute -top-2 -right-2 grid size-5 place-items-center rounded-[50%]
					bg-black/25! text-white! backdrop-blur-lg`,
					default: "border-vitastock-primary-main bg-vitastock-primary-dark",
					description: "text-[13px] leading-5 text-white/80",
					error: "border-sonner-error-border bg-sonner-error-bg",
					success: "border-vitastock-primary-main bg-vitastock-primary-dark",
					title: "text-[14px] leading-5 font-semibold text-white",
					toast: `flex min-h-[60px] w-[calc(100vw-32px)] max-w-[300px] items-center gap-3
					rounded-[8px] border px-3 py-2.5 text-white shadow-md md:max-w-[400px]`,
				},
				unstyled: true,
			}}
			{...props}
		/>
	);
};

export { SonnerToaster };
