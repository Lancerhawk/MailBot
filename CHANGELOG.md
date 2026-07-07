# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Frontend v0.5.0] & [Backend v0.6.0] - Full Email Client & AI Drafts Experience

### Added
- **AI Draft Generation:** Integrated automatic backend generation of AI email replies using Groq when `needsReply` is true. The AI uses full chronological thread context.
- **Manual & AI Reply Composers:** A dynamic composer inside the thread viewer allowing users to edit AI drafts, regenerate them, or write completely manual replies.
- **Gmail Send Integration:** Sending replies through MailBot natively uses the Gmail API, automatically marks spam as inbox upon reply, and supports sending without an AI draft.
- **Instant Background Prefetching:** Added a `ThreadCacheProvider` that silently fetches full thread details in the background upon initial inbox load, resulting in 0ms load times when clicking emails.
- **Infinite Scrolling:** Implemented Intersection Observer-based infinite pagination for all list views (Inbox, Spam, Trash, Drafts).
- **Rate Limit Splitting:** Separated strict authentication rate limits (20 req / 15m) from broader API rate limits (300 req / 1m) to accommodate aggressive background caching.
- **AI Eligibility Tweaks:** Adjusted AI prompts to explicitly skip newsletters, system alerts, and "thank you" notes from draft generation.
- **Dynamic Contextual UI:** The Thread Viewer now dynamically displays "Not Spam" or "Restore" buttons if a thread is opened from Spam or Trash, and disables replying when in Trash.
- **Loading Animations:** Real-time Socket.IO feedback indicating when background Gmail synchronization is active and when AI Analysis is processing.

## [Frontend v0.4.0] & [Backend v0.5.0] - AI Integration & Real-time Sync Bugfixes

### Added
- **AI Eligibility Engine:** Advanced filtering to prevent Groq API token burns on historical imports and self-sent messages.
- **Resilient AI Pipeline:** Implemented graceful failure handling and status management for AI summaries, preventing UI glitches on `FAILED` or `SKIPPED` states.
- **Smart Message Counts:** Refactored Prisma count logic in `upsertThreadAndEmails` to actively filter out soft-deleted and trashed emails, ensuring UI thread counters always perfectly match visible emails.
- **Hard Delete Synchronization:** Upgraded the `markMessagesAsDeleted` hook to instantly recalculate and sync parent thread counts when messages are permanently deleted via Webhook.
- **Status Persistence Fix:** Patched a race condition where incremental syncs overwrote completed AI processing statuses when a user replied to a thread.

## [Frontend v0.3.0] & [Backend v0.4.0] - Gmail Sync Engine & Inbox Overhaul

### Added
- **Gmail Sync Engine:** Robust incremental synchronization via Gmail History API, handling pagination, batching, and history expiration fallbacks.
- **Inbox UI Overhaul:** Complete redesign of the Inbox interface featuring color-coded avatars, unread indicators, stagger animations, and skeleton loaders.
- **Thread Viewer:** Advanced email viewer with thread collapsing, HTML body isolation (safe dark mode), and proper overflow handling.
- **Live Dashboard:** Dynamic stats grid pulling realtime sync status and recent conversations.
- **Performance:** Optimized backend sync to reduce API calls and frontend polling logic for real-time sync progress updates.

## [Frontend v0.2.0] & [Backend v0.3.0] - Authentication & OAuth

### Added
- **OAuth Integration:** Complete Google OAuth 2.0 flow integrated on the backend.
- **Server-Side Sessions:** Secure HTTP-only sessions via `express-session` and `connect-pg-simple`.
- **Token Encryption:** AES-256-GCM encryption for storing OAuth tokens in PostgreSQL.
- **User Management:** Automatic user and `EmailAccountConnection` upserts during OAuth callback.
- **Security Middlewares:** CSRF verification logic and `requireAuth` guards.
- **Auth UI:** Integrated `AuthProvider` and `ProtectedRoute` components in Next.js.
- **Landing Page Evolution:** Upgraded the root page to feature a hero section with a "Continue with Google" flow and authenticated user state tracking.

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
