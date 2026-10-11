import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { Hono, type Context } from "hono";
import { MemoryStore, rateLimiter, type HonoConfigProps } from "hono-rate-limiter";
import { describe, expect, test, vi } from "vitest";
import type { HonoAppBindings } from "@/lib/types/common";
import { AppError, getClientIp } from "@/lib/utils";
import { errorHandler } from "@/middleware/errorHandler/errorHandler";
import { validateWithZodMiddleware } from "@/middleware/validateWithZodMiddleware";
import { authRateLimiterOptions, getRateLimitedMessage } from "./rateLimiterOptions";

vi.mock("@/lib/logger", () => ({
	appLogger: {
		pretty: { error: vi.fn() },
		structured: { error: vi.fn() },
	},
}));

vi.mock("@/services/cache/cacheClient", () => ({
	redisCacheClient: { scriptLoad: vi.fn(() => Promise.resolve("sha")) },
}));

// == Same options as production, with an in-memory store instead of Redis
const withMemoryStore = <TOptions extends Pick<HonoConfigProps, "store">>(options: TOptions) => ({
	...options,
	store: new MemoryStore(),
});

const VALID_PASSWORD = "correct-password";

// == Mirrors the real /auth/signin chain: routes on a sub-app, errors handled by the parent's onError
const createSignInApp = () => {
	const signInRoutes = new Hono().post(
		"/signin",
		rateLimiter(withMemoryStore(authRateLimiterOptions["signin-ip"])),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/auth/signin"].body),
		rateLimiter(withMemoryStore(authRateLimiterOptions.signin)),
		(ctx) => {
			const { password } = ctx.req.valid("json");

			// == Fake credential check; only the response status matters to the limiter
			if ([VALID_PASSWORD].includes(password)) {
				return ctx.json({ status: "success" });
			}

			throw new AppError({ code: 401, message: "Email or password is incorrect" });
		}
	);

	const app = new Hono<HonoAppBindings>();

	app.onError(errorHandler);
	app.route("/auth", signInRoutes);

	return app;
};

type SignInOptions = { email: string; ip?: string; password?: string };

const signIn = async (app: Hono<HonoAppBindings>, options: SignInOptions) => {
	const { email, ip = "203.0.113.10", password = "wrong-password" } = options;

	const response = await app.request("/auth/signin", {
		body: JSON.stringify({ email, password }),
		headers: { "content-type": "application/json", "do-connecting-ip": ip },
		method: "POST",
	});

	const body = (await response.json()) as { message?: string };

	return { body, headers: response.headers, status: response.status };
};

// == Sequential on purpose: each request's outcome depends on the counts left by the previous ones
const signInRepeatedly = async (
	app: Hono<HonoAppBindings>,
	count: number,
	getOptions: (attempt: number) => SignInOptions
) => {
	const statuses: number[] = [];

	for (let attempt = 1; attempt <= count; attempt++) {
		// eslint-disable-next-line no-await-in-loop -- requests must hit the limiter in order
		const { status } = await signIn(app, getOptions(attempt));

		statuses.push(status);
	}

	return statuses;
};

const repeatStatus = (status: number, count: number) => Array.from({ length: count }, () => status);

const signInLimit = authRateLimiterOptions.signin.limit as number;
const signInIpLimit = authRateLimiterOptions["signin-ip"].limit as number;

describe("sign-in rate limiting", () => {
	test("failed sign-ins (401 thrown as AppError) count towards the limit", async () => {
		const app = createSignInApp();

		const statuses = await signInRepeatedly(app, signInLimit, () => ({ email: "jane@pharmacy.test" }));

		expect(statuses).toEqual(repeatStatus(401, signInLimit));

		const blocked = await signIn(app, { email: "jane@pharmacy.test" });

		expect(blocked.status).toBe(429);
		expect(blocked.headers.get("Retry-After")).toBeTruthy();
		expect(blocked.body.message).toBe("Too many attempts. Please try again in about 15 minutes.");

		// == Even the right password is refused once the limit is hit
		const blockedValid = await signIn(app, { email: "jane@pharmacy.test", password: VALID_PASSWORD });

		expect(blockedValid.status).toBe(429);
	});

	test("successful sign-ins do not count towards the limit", async () => {
		const app = createSignInApp();

		const successStatuses = await signInRepeatedly(app, signInLimit * 2, () => ({
			email: "jane@pharmacy.test",
			password: VALID_PASSWORD,
		}));

		expect(successStatuses).toEqual(repeatStatus(200, signInLimit * 2));

		// == The full failure budget is still available after all those successes
		const failureStatuses = await signInRepeatedly(app, signInLimit + 1, () => ({
			email: "jane@pharmacy.test",
		}));

		expect(failureStatuses).toEqual([...repeatStatus(401, signInLimit), 429]);
	});

	test("the limit is keyed on IP + normalised email", async () => {
		const app = createSignInApp();

		await signInRepeatedly(app, signInLimit, () => ({ email: "Jane@Pharmacy.test" }));

		// == Same email after trim/lowercase -> same bucket
		const sameEmail = await signIn(app, { email: "  jane@pharmacy.TEST " });
		expect(sameEmail.status).toBe(429);

		// == A colleague on the same pharmacy IP is unaffected
		const colleague = await signIn(app, { email: "tunde@pharmacy.test" });
		expect(colleague.status).toBe(401);

		// == The same email from a different IP is unaffected
		const otherIp = await signIn(app, { email: "jane@pharmacy.test", ip: "198.51.100.7" });
		expect(otherIp.status).toBe(401);
	});

	test("the per-IP backstop blocks failures spread across many emails", async () => {
		const app = createSignInApp();

		const statuses = await signInRepeatedly(app, signInIpLimit, (attempt) => ({
			email: `user${attempt}@pharmacy.test`,
		}));

		expect(statuses).toEqual(repeatStatus(401, signInIpLimit));

		const blocked = await signIn(app, { email: "fresh@pharmacy.test" });

		expect(blocked.status).toBe(429);
		expect(blocked.body.message).toBe("Too many attempts. Please try again in about an hour.");

		// == Other IPs are unaffected
		const otherIp = await signIn(app, { email: "fresh@pharmacy.test", ip: "198.51.100.7" });
		expect(otherIp.status).toBe(401);
	});
});

const getMessageForReset = async (resetInMs: number | null) => {
	const app = new Hono().get("/message", (ctx: Context) => {
		ctx.set(
			"rateLimit" as never,
			{
				limit: 10,
				remaining: 0,
				resetTime: resetInMs === null ? undefined : new Date(Date.now() + resetInMs),
				used: 11,
			} as never
		);

		return ctx.text(getRateLimitedMessage(ctx, 30 * 60 * 1000));
	});

	const response = await app.request("/message");

	return response.text();
};

describe("auth rate limiter options", () => {
	test("each auth route has its own Redis prefix", () => {
		const prefixes = Object.entries(authRateLimiterOptions).map(([route, options]) => {
			const { prefix } = options.store as unknown as { prefix: string };

			expect(prefix).toBe(`rate-limit:auth:${route}:`);

			return prefix;
		});

		expect(new Set(prefixes).size).toBe(prefixes.length);
	});

	test("429 message is computed from the limiter's reset time", async () => {
		await expect(getMessageForReset(12 * 60 * 1000 - 500)).resolves.toBe(
			"Too many attempts. Please try again in about 12 minutes."
		);
		await expect(getMessageForReset(20 * 1000)).resolves.toBe(
			"Too many attempts. Please try again in about a minute."
		);
		await expect(getMessageForReset(65 * 60 * 1000)).resolves.toBe(
			"Too many attempts. Please try again in about an hour."
		);

		// == Falls back to the window when the store gives no reset time
		await expect(getMessageForReset(null)).resolves.toBe(
			"Too many attempts. Please try again in about 30 minutes."
		);
	});
});

const requestIp = async (headers: Record<string, string>, env?: unknown) => {
	const app = new Hono().get("/ip", (ctx) => ctx.text(getClientIp(ctx) ?? "undefined"));

	const response = await app.request("/ip", { headers }, env);

	return response.text();
};

describe("getClientIp", () => {
	test("prefers DigitalOcean's do-connecting-ip over x-forwarded-for", async () => {
		await expect(
			requestIp({ "do-connecting-ip": "203.0.113.10", "x-forwarded-for": "10.0.0.1" })
		).resolves.toBe("203.0.113.10");
	});

	test("falls back to the first x-forwarded-for entry, then x-real-ip", async () => {
		await expect(requestIp({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" })).resolves.toBe(
			"203.0.113.10"
		);
		await expect(requestIp({ "x-real-ip": "203.0.113.11" })).resolves.toBe("203.0.113.11");
	});

	test("falls back to the socket address when no proxy header is present", async () => {
		const env = { incoming: { socket: { remoteAddress: "127.0.0.1" } } };

		await expect(requestIp({}, env)).resolves.toBe("127.0.0.1");
	});

	test("returns undefined only when neither headers nor a Node socket are available", async () => {
		await expect(requestIp({})).resolves.toBe("undefined");
	});
});
