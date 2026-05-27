import type { db } from "@vitastock/db";
import {
	emailVerificationCodes,
	passwordResetTokens,
	type SelectUserType,
} from "@vitastock/db/schema/auth";
import type { EmailJobOptions } from "@vitastock/transactional/emails";
import { add } from "date-fns";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { generateRandom6DigitCode, generateRandomBytes } from "@/lib/utils/random";
import { addEmailToQueue } from "@/services/queues";
import { hashToken, hashValue } from "./hash";
import { encodeJwtToken } from "./token";

export const sendVerificationEmail = async (
	user: Pick<SelectUserType, "email" | "fullName" | "id">,
	dbClient: typeof db
) => {
	const rawCode = generateRandom6DigitCode();

	const hashedCode = await hashValue(rawCode);

	const codeExpiry = add(new Date(), { minutes: 15 });

	await dbClient
		.insert(emailVerificationCodes)
		.values({
			code: hashedCode,
			expiresAt: codeExpiry,
			userId: user.id,
		})
		.onConflictDoUpdate({
			set: {
				code: hashedCode,
				createdAt: new Date(),
				expiresAt: codeExpiry,
			},
			target: emailVerificationCodes.userId,
		});

	await addEmailToQueue({
		data: {
			email: user.email,
			name: user.fullName,
			to: { email: user.email, name: user.fullName },
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
	user: Pick<SelectUserType, "email" | "fullName" | "id">,
	dbClient: typeof db,
	passwordResetWindowActive: boolean
) => {
	const rawToken = generateRandomBytes();

	const tokenExpiry = add(new Date(), { minutes: 20 });

	const encodedToken = encodeJwtToken({ token: rawToken }, { schema: TokenSchema });

	const hashedToken = hashToken(rawToken);

	await dbClient
		.insert(passwordResetTokens)
		.values({
			email: user.email,
			expiresAt: tokenExpiry,
			retriedAt: new Date(),
			retryCount: 1,
			tokenHash: hashedToken,
			userId: user.id,
		})
		.onConflictDoUpdate({
			set: {
				createdAt: new Date(),
				expiresAt: tokenExpiry,
				retriedAt: passwordResetWindowActive ? passwordResetTokens.retriedAt : new Date(),
				retryCount: passwordResetWindowActive ? sql`${passwordResetTokens.retryCount} + 1` : 1,
				tokenHash: hashedToken,
			},
			target: passwordResetTokens.userId,
		});

	await addEmailToQueue({
		data: {
			name: user.fullName,
			priority: "high",
			to: { email: user.email, name: user.fullName },
			token: encodedToken,
		},
		onError: async () => {
			await dbClient.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
		},
		type: "resetPassword",
	});
};

export const sendResetPasswordCompleteEmail = async (user: Pick<SelectUserType, "email" | "fullName">) => {
	await addEmailToQueue({
		data: {
			name: user.fullName,
			priority: "high",
			to: { email: user.email, name: user.fullName },
		},
		type: "resetPasswordComplete",
	});
};

export const sendPharmacistInviteEmail = async (
	options: Omit<Extract<EmailJobOptions, { type: "pharmacistInvite" }>["data"], "priority" | "to">
) => {
	const { defaultPassword, invitedByEmail, inviteeEmail, inviteeName, role, token, workspaceName } =
		options;

	await addEmailToQueue({
		data: {
			defaultPassword,
			invitedByEmail,
			inviteeEmail,
			inviteeName,
			priority: "high",
			role,
			to: { email: inviteeEmail, name: inviteeName },
			token,
			workspaceName,
		},
		type: "pharmacistInvite",
	});
};
