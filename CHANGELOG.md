# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Frontend v0.1.0] - Application Foundation & Architecture

### Added
- **Application Skeleton:** Complete Next.js 15 App Router foundation.
- **State Management & Providers:** Configured `AppProviders` (Theme, Toast, future context).
- **Global Layout:** Implemented responsive `MainLayout`, `Sidebar` (with mobile overlay), and `Header` components.
- **Theming & Aesthetics:** Implemented Dark/Light mode using `next-themes` and a custom Tailwind v4 theme featuring an elegant Outfit font and an Orange/Red primary color scheme.
- **Animations:** Added smooth Framer Motion transitions and layout animations for interactive elements.
- **Components:** Built foundational UI components (`Button`, `Input`, `Sidebar`, `EmptyState`) according to modern SaaS design principles.

## [Backend v0.2.0] - Express Foundation & AI Strategy

### Added
- **Express Skeleton:** Production-ready REST API architecture with separation of concerns.
- **Server Initialization:** Centralized entry point (`server.ts`) and Express app (`app.ts`) with Graceful Shutdown.
- **Middlewares:** Configured Helmet, CORS, Compression, and express-rate-limit.
- **Logging:** Structured JSON logging via Pino for production and pino-pretty for development.
- **Validation:** Strict environment configuration validation using Zod.
- **Database:** Singleton Prisma client instance wrapper to prevent connection exhaustion.
- **Utilities:** Custom `ApiError`, `ApiResponse`, and `catchAsync` wrappers.
- **Health Check:** `GET /api/v1/health` endpoint integrated with Prisma for live database connectivity checks.

### Changed
- **Schema Refinement:** Updated `AiProvider` enum to include `GROQ` and set `UserSetting` default to Groq for MailBot Version 1.

## [Backend v0.1.0] - Database Schema Architecture

### Added
- **Database Architecture (Phase 1):** Complete Prisma schema for a production AI email platform.
- **AI & RAG Foundation:** `KnowledgeBaseDocument` and `KnowledgeBaseChunk` models with `pgvector` for AI embeddings.
- **Core Email Models:** `Email`, `EmailThread`, `EmailAccountConnection` optimized for Gmail/Outlook integrations.
- **CRM System:** `Contact` and `Organization` models for relationship tracking.
- **Background Workers:** `ProcessingJob` model for distributed async tasks.

## [Backend v0.0.0] & [Frontend v0.0.0] - Initial Setup

### Added
- Root project structure establishing separation between frontend and backend.
- Initial Next.js 15 (App Router) scaffolding with Tailwind CSS and TypeScript.
- Foundational Express.js backend structure with TypeScript and Prisma.
- Comprehensive ESLint and Prettier configurations for code formatting and linting.
- Root and backend `.gitignore` configurations.
- Base configurations including `tsconfig.json`, `nodemon.json`, and `.env.example`.
- Project `README.md`, `CHANGELOG.md`, and MIT `LICENSE`.
