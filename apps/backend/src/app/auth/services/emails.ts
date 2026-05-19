import type { db } from "@vitastock/db";
import { emailVerificationCodes, users, type SelectUserType } from "@vitastock/db/schema/auth";
import { add } from "date-fns";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { generateRandom6DigitCode, generateRandomBytes } from "@/lib/utils/random";
import { addEmailToQueue } from "@/services/queues";
import { hashValue } from "./hash";
import { encodeJwtToken } from "./token";

export const sendVerificationEmail = async (
	user: Pick<SelectUserType, "email" | "firstName" | "id">,
	dbClient: typeof db
) => {
	const rawCode = generateRandom6DigitCode();

	const hashedCode = await hashValue(rawCode);

	const codeExpiry = add(new Date(), { minutes: 15 });

	await dbClient.delete(emailVerificationCodes).where(eq(emailVerificationCodes.userId, user.id));

	await dbClient.insert(emailVerificationCodes).values({
		code: hashedCode,
		expiresAt: codeExpiry,
		userId: user.id,
	});

	await addEmailToQueue({
		data: {
			email: user.email,
			name: user.firstName,
			to: user.email,
			validationCode: rawCode,
		},
		onError: async () => {
			await dbClient.delete(emailVerificationCodes).where(eq(emailVerificationCodes.userId, user.id));
		},
		type: "verifyEmail",
	});
};

export const TokenSchema = z.object({
	token: z.string(),
});

export const sendPasswordResetEmail = async (
	user: Pick<SelectUserType, "email" | "firstName" | "id">,
	dbClient: typeof db
) => {
	const rawToken = generateRandomBytes();

	const tokenExpiry = add(new Date(), { minutes: 20 });

	const encodedToken = encodeJwtToken({ token: rawToken }, { schema: TokenSchema });

	await dbClient
		.update(users)
		.set({ passwordResetToken: rawToken, passwordResetTokenExpiresAt: tokenExpiry })
		.where(eq(users.id, user.id));

	await addEmailToQueue({
		data: {
			name: user.firstName,
			priority: "high",
			to: user.email,
			token: encodedToken,
		},
		onError: async () => {
			await dbClient
				.update(users)
				.set({ passwordResetToken: null, passwordResetTokenExpiresAt: null })
				.where(eq(users.id, user.id));
		},
		type: "resetPassword",
	});
};

export const sendResetPasswordCompleteEmail = async (
	user: Pick<SelectUserType, "email" | "firstName">
) => {
	await addEmailToQueue({
		data: {
			name: user.firstName,
			priority: "high",
			to: user.email,
		},
		type: "resetPasswordComplete",
	});
};
