import type { cors } from "hono/cors";

export const allowedOrigins = [
	"http://localhost:5173",
	"http://localhost:5174",
	"https://vitastock.vercel.app",
	"https://vitastock-staging.vercel.app",
];

const corsOptions = {
	credentials: true,
	origin: allowedOrigins,
} satisfies Parameters<typeof cors>[0];

export { corsOptions };
