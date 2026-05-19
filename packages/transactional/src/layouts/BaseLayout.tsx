/* eslint-disable react/purity */
import * as React from "react";
import {
	Body,
	Container,
	Font,
	Head,
	Html,
	Img,
	pixelBasedPreset,
	Preview,
	Section,
	Tailwind,
	Text,
} from "react-email";
import { FRONTEND_URL } from "../constants";

type EmailLayoutProps = {
	children: React.ReactNode;
	preview: string;
};

export function BaseLayout(props: EmailLayoutProps) {
	const { children, preview } = props;

	return (
		<Html>
			<Head>
				<Font
					fontFamily="Work Sans"
					fallbackFontFamily="sans-serif"
					webFont={{
						format: "woff2",
						url: "https://fonts.gstatic.com/s/worksans/v19/QGY_z_wNahGAdqQ43RhVcIgYT2Xz5u32K0nZN08.woff2",
					}}
					fontWeight={400}
					fontStyle="normal"
				/>
				<Font
					fontFamily="Work Sans"
					fallbackFontFamily="sans-serif"
					webFont={{
						format: "woff2",
						url: "https://fonts.gstatic.com/s/worksans/v19/QGY_z_wNahGAdqQ43RhVcIgYT2Xz5u32K0nZN08.woff2",
					}}
					fontWeight={600}
					fontStyle="normal"
				/>
			</Head>

			<Preview>{preview}</Preview>

			<Tailwind
				config={{
					presets: [pixelBasedPreset],
					theme: {
						extend: {
							colors: {
								medinfo: {
									body: {
										color: "hsl(0, 0%, 20%)",
									},
									dark: {
										1: "hsl(0, 0%, 25%)",
										2: "hsl(0, 0%, 35%)",
										3: "hsl(0, 0%, 45%)",
										4: "hsl(0, 0%, 55%)",
									},
									light: {
										1: "hsl(152, 17%, 79%)",
										2: "hsl(150, 8%, 85%)",
										3: "hsl(144, 20%, 95%)",
										4: "hsl(150, 25%, 98%)",
									},
									primary: {
										darker: "hsl(150, 21%, 17%)",
										lighter: "hsl(150, 19%, 48%)",
										main: "hsl(150, 20%, 25%)",
										subtle: "hsl(150, 75%, 88%)",
									},
									secondary: {
										darker: "hsl(46, 15%, 63%)",
										lighter: "hsl(46, 15%, 92%)",
										main: "hsl(46, 15%, 83%)",
										subtle: "hsl(46, 15%, 97%)",
									},
								},
							},
							fontFamily: {
								sans: ["Work Sans", "sans-serif"],
							},
						},
					},
				}}
			>
				<Body className="bg-medinfo-secondary-subtle py-12 font-sans text-medinfo-body-color">
					<Container className="mx-auto max-w-145 px-4">
						<Section className="mb-8 text-center">
							<Img
								src={`${FRONTEND_URL}/logo.png`}
								width="80"
								height="80"
								alt="MedInfo"
								className="mx-auto h-20 w-auto"
							/>
						</Section>

						<Section
							className="rounded-3xl border border-medinfo-light-2 bg-white px-10 py-12 shadow-xl"
						>
							{children}
						</Section>

						<Section className="mt-10 text-center">
							<Text className="mb-2 text-xs text-medinfo-dark-4">
								© {new Date().getFullYear()} MedInfo Nigeria. All rights reserved.
							</Text>
							<Text className="text-xs text-medinfo-dark-4">123 Health Avenue, Lagos, Nigeria</Text>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}
