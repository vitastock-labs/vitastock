import type { cors } from "hono/cors";

const corsOptions = {
	credentials: true,
	origin: ["http://localhost:5173", "http://localhost:5174", "https://vitastock.vercel.app"],
} satisfies Parameters<typeof cors>[0];

export { corsOptions };
