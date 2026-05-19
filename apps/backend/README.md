# @vitastock/backend

The backend API server for VitaStock, built with Hono and Node.js.

## Features

- **Framework**: Hono
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT & OAuth (Google)
- **Validation**: Zod (Shared with frontend)
- **Cloud Storage**: Cloudinary integration
- **Logging**: Pino logger

## Project Structure

```text
apps/backend/src/
├── app/               # Feature-based modules (routes, services)
│   ├── auth/          # Authentication logic
├── config/            # Configuration (CORS, Rate Limits)
├── lib/               # Shared utilities & factory functions
├── middleware/        # Global middleware (Auth, Error Handling)
└── server.ts          # Entry point
```

## Scripts

```bash
# Development
pnpm dev          # Start server in watch mode

# Build
pnpm build        # Build using tsdown
pnpm start        # Start production server

# Code Quality
pnpm lint:eslint  # Run ESLint
pnpm lint:format  # Format code with Prettier
pnpm lint:type-check # Run TypeScript type checking
```

## API Documentation

This project uses Bruno for API testing and documentation.
You can find the collection in the root directory under `(bruno)-(vitastock)`.
