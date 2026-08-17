"use client";

import type { InferProps } from "@zayne-labs/toolkit-react/utils";
import { isFile } from "@zayne-labs/toolkit-type-helpers";
import { toast } from "sonner";
import { cnMerge } from "@/lib/utils/cn";
import { DropZone } from "../ui/drop-zone";
import { IconBox } from "./IconBox";
import { ImageOnline } from "./Image";

type DropZoneInputProps = Omit<InferProps<typeof DropZone.Root>, "onChange"> & {
	onChange?: (file: File) => void;
};

function DropZoneInputRoot(props: DropZoneInputProps) {
	const { onChange, onFilesChange, onValidationError, onValidationSuccess, ...restOfProps } = props;

	const handleFileUpload: DropZoneInputProps["onFilesChange"] = (ctx) => {
		onFilesChange?.(ctx);

		if (!isFile(ctx.fileStateArray[0]?.file)) return;

		onChange?.(ctx.fileStateArray[0].file);
	};

	return (
		<DropZone.Root
			onFilesChange={handleFileUpload}
			onValidationSuccess={(ctx) => {
				toast.success("Success", { description: ctx.message });
				void onValidationSuccess?.(ctx);
			}}
			onValidationError={(ctx) => {
				toast.error("Error", { description: ctx.message });
				void onValidationError?.(ctx);
			}}
			{...restOfProps}
		/>
	);
}

type ImagePreviewProps = {
	classNames?: {
		deleteButton?: string;
		image?: string;
		listContainer?: string;
		listItem?: string;
		metadata?: string;
		preview?: string;
	};
};

function DropZoneInputImagePreview(props: ImagePreviewProps) {
	const { classNames } = props;

	return (
		<DropZone.FileList
			className={cnMerge(
				`relative mt-3.5 max-h-[140px] divide-y divide-shadcn-border overflow-y-auto
				overscroll-y-contain rounded-lg border border-shadcn-border bg-white`,
				classNames?.listContainer
			)}
		>
			{(ctx) => (
				<DropZone.FileItem
					key={ctx.fileState.id}
					fileState={ctx.fileState}
					className={cnMerge("gap-3 px-3 py-2 text-xs", classNames?.listItem)}
				>
					<DropZone.FileItemPreview
						className={cnMerge("h-11 shrink-0 gap-3", classNames?.preview)}
						renderPreview={{
							default: (
								<span className="block size-10">
									<IconBox icon="solar:file-outline" className="size-full" />
								</span>
							),

							image: {
								node: (
									<ImageOnline
										src={ctx.fileState.preview ?? ""}
										className={cnMerge(
											"size-[50px] shrink-0 rounded-md object-cover",
											classNames?.image
										)}
										width={50}
										height={50}
										priority={true}
										alt="image-preview-thumbnail"
									/>
								),
							},

							text: {
								node: (
									<span className="block size-10">
										<IconBox icon="solar:document-medicine-linear" className="size-full" />
									</span>
								),
							},
						}}
					/>

					<DropZone.FileItemMetadata
						className={cnMerge("min-w-0 grow text-left", classNames?.metadata)}
					/>

					<DropZone.FileItemDelete
						className={cnMerge(
							`grid size-8 shrink-0 place-items-center rounded-md text-shadcn-destructive
							hover:bg-shadcn-destructive/10`,
							classNames?.deleteButton
						)}
					>
						<IconBox icon="lucide:trash-2" className="size-4" />
					</DropZone.FileItemDelete>
				</DropZone.FileItem>
			)}
		</DropZone.FileList>
	);
}

export const Root = DropZoneInputRoot;

// eslint-disable-next-line react-refresh/only-export-components
export const Area = DropZone.Area;

export const ImagePreview = DropZoneInputImagePreview;
