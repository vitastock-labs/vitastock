export class OAuth2TransportError extends Error {
	override readonly name = "OAuth2TransportError";

	constructor(cause: unknown) {
		super("Failed to send OAuth 2.0 request", { cause });
	}
}

export class OAuth2ResponseError extends Error {
	readonly body: unknown;
	override readonly name: string = "OAuth2ResponseError";
	readonly status: number;

	constructor(status: number, body: unknown) {
		super(`OAuth 2.0 endpoint returned HTTP ${status}`);
		this.body = body;
		this.status = status;
	}
}

export class OAuth2RequestError extends OAuth2ResponseError {
	readonly code: string;
	readonly description: string | null;
	override readonly name = "OAuth2RequestError";
	readonly state: string | null;
	readonly uri: string | null;

	constructor(
		status: number,
		code: string,
		description: string | null,
		uri: string | null,
		state: string | null,
		body: Record<string, unknown>
	) {
		super(status, body);
		this.code = code;
		this.description = description;
		this.message = description ?? `OAuth 2.0 request failed: ${code}`;
		this.state = state;
		this.uri = uri;
	}
}
