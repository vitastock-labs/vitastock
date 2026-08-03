import { z } from "zod";

export const sharedEnvSchema = z.object({
	BASE_BACKEND_HOST: z
		.literal(["https://api-vitastock.vercel.app", "https://api-vitastock.onrender.com"])
		.default("https://api-vitastock.onrender.com"),
	BASE_BACKEND_HOST_DEV: z.literal("http://localhost:8000").default("http://localhost:8000"),
	BASE_BACKEND_HOST_STAGING: z
		.literal("https://api-vitastock-staging.onrender.com")
		.default("https://api-vitastock-staging.onrender.com"),
	BASE_FRONTEND_HOST: z.literal("https://vitastock.vercel.app").default("https://vitastock.vercel.app"),
	BASE_FRONTEND_HOST_DEV: z.literal("http://localhost:5173").default("http://localhost:5173"),
	BASE_FRONTEND_HOST_STAGING: z
		.literal("https://vitastock-staging.vercel.app")
		.default("https://vitastock-staging.vercel.app"),
	NODE_ENV: z.literal(["development", "production", "staging"]).default("development"),
});
