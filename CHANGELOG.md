# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Backend v1.7.0] - Enterprise Security Hardening, Audit Compliance & Architecture Verification

### Added
- **OAuth Token Refresh & Persistence (`src/modules/gmail/gmail.client.service.ts`):** Implemented secure encryption and persistence of Google OAuth refresh tokens to `emailAccountConnection` during token refresh events.
- **CSRF & Socket.IO Identity Verification:** Integrated `validateCsrfOrigin` directly into `requireAuth` middleware and wrapped Express session middleware in Socket.IO connections to prevent identity spoofing.
- **Gmail Webhook & Rate Limiting Hardening:** Added OIDC token verification for Gmail push notifications and configured multi-instance fail-open Redis rate limiting.
- **Database Connection Health Check (`src/routes/v1/health.route.ts`):** Updated `/api/v1/health` to return `HTTP 503 Service Unavailable` with `status: 'degraded'` when PostgreSQL is disconnected.
- **Search Offset Type Safety (`src/modules/knowledge/services/search.service.ts`):** Added `sourceOffsetStart` and `sourceOffsetEnd` to `SearchResult` interface, eliminating unsafe type casts in `mergeNeighbors`.
- **Activity Log Logout Type (`src/services/auth.service.ts`):** Added `LOGOUT` value to `ActivityType` enum in `schema.prisma` and updated `AuthService.logLogout` to record true logout events.
- **Worker Lifecycle Management:** Added graceful shutdown hooks in `worker-manager.ts` to stop background workers and clear intervals on `SIGTERM` and `SIGINT`.
- **Implemented User & Profile Lookups:** Implemented real database queries for `getProfile` and `getEmail` endpoints with standardized `ApiResponse` payloads.

## [Frontend v1.2.0] - Security Headers, CSP & API Client Hardening

### Added
- **Content Security Policy & HTTP Security Headers (`next.config.ts`):** Added comprehensive Content-Security-Policy, X-Frame-Options DENY, HSTS, X-Content-Type-Options, and Referrer-Policy headers to secure all frontend routes.
- **Unified API Base URL & Port Resolution (`src/lib/api.ts`):** Exported `API_URL` constant from central API module and imported it in `AuthProvider.tsx` to eliminate fallback port 3001 discrepancies.

### Fixed
- **React Query Provider Cleanup (`src/app/(dashboard)/analytics/page.tsx`):** Removed duplicate isolated `QueryClient` and `QueryClientProvider` instantiation on the Analytics dashboard page.

## [Backend v1.6.0] - Codebase Refactoring, Distributed Caching & Stability Polish

### Added
- **Unified Cache & Distributed Lock Service (`src/lib/cache.service.ts`):** Implemented a unified caching and distributed locking service with automatic fail-open fallback between Redis and in-memory storage based on `RATE_LIMIT_STORE`.
- **Centralized User Queue Module (`src/utils/user-queue.ts`):** Added `UserSerialQueue` for per-user FIFO task sequencing and `FairConcurrencyQueue` for fair multi-user concurrency scheduling with automatic transient retry and exponential backoff.
- **Distributed Mutex Locks:** Migrated Gmail sync state, webhook queues, AI pipeline email analysis (`ai:lock:<userId>`), and draft generation (`draft:lock:<emailId>`) to use unified distributed locking via `cacheService`.

### Changed
- **Consolidated Queue Logic:** Refactored `ai.pipeline.service.ts` and `draft.service.ts` to use `UserSerialQueue`, and refactored `groq.service.ts` to use `FairConcurrencyQueue`, eliminating 125+ lines of duplicate scheduler boilerplate.
- **Top-Level ES6 Imports:** Replaced mid-function `require()` calls in `server.ts` and `gmail.sync.service.ts` with clean top-level ES6 imports and property injections.
- **Structured Logging Across Controllers:** Replaced all raw `console.log/warn/error` calls across `auth.controller.ts`, `gmail.controller.ts`, and `analytics.controller.ts` with structured JSON `logger` calls.
- **HistoryId Watermark Advancement:** Updated Gmail incremental sync so that the `historyId` watermark advances only after all threads process without errors.

### Fixed
- **Draft Update Verification:** Added row count verification for `updateMany` in `draft.db.service.ts` to throw a 404 error when attempting to update a non-existent draft.
- **500 Server Error Logging:** Updated error middleware to log 500 server errors in all environments including production.
- **Silent Catch Blocks:** Uncommented silent catch blocks in Gmail sync and routed sync errors through the shared logger.

## [Backend v1.5.0] - Standalone AI Worker Microservice & WORKER_MODE Switch

### Added
- **Standalone Worker Microservice (`src/worker.ts`):** Dedicated entry point for processing CPU/RAM-heavy AI embedding (`@xenova/transformers`) and description jobs in the background without bloating the main API web server.
- **WORKER_MODE Toggle:** Added `WORKER_MODE="local" | "remote"` to `.env`. In `local` mode, workers run inside the API server; in `remote` mode, the API server skips local worker initialization for millisecond boot times and minimal RAM overhead.
- **Secret-Authenticated Internal Webhooks:** Implemented `POST /api/v1/internal/jobs/callback` secured by `INTERNAL_WORKER_SECRET` to receive job completion notifications from remote worker servers and emit real-time Socket.IO events to connected frontend clients.
- **Worker Process Safeguard:** Added an automatic check in `worker.ts` that immediately exits if `WORKER_MODE === "local"` to prevent duplicate job processing.
- **New NPM Scripts:** Added `npm run dev:worker` and `npm run start:worker` in `package.json`.

## [Backend v1.4.0] - Security Hardening & Authentication Verification

### Added
- **Gmail Webhook OIDC Verification:** Implemented strict Google OIDC ID token verification (`OAuth2Client.verifyIdToken`) for incoming Pub/Sub push notifications to prevent unauthenticated webhook requests.
- **Socket.IO Session Authentication:** Added middleware to verify Express sessions on Socket.IO handshakes and automatically join sockets to user-scoped rooms, eliminating client-side `userId` spoofing.
- **Active CSRF Protection:** Enforced custom header / double-submit cookie CSRF validation across state-changing API routes.
- **OAuth Access Token Persistence:** Added automatic database updates for refreshed OAuth access tokens during Gmail API token renewals.

### Changed
- **Unified Rate Limiter Key Generator:** Refactored rate limiter key generation into a shared helper (`getClientIp`) that cleanly strips IPv4-mapped IPv6 prefixes (`::ffff:`), preventing bucket collisions across limiters.

## [Backend v1.3.0] - Shared Redis Rate Limiting & Outage Resiliency

### Added
- **Shared Redis Rate-Limit Store:** Added support for storing rate limits in a central Redis instance (`RATE_LIMIT_STORE="redis"`) so multiple backend servers can share request counts.
- **Outage Fallback (Fail-Open):** Added fail-open protection (`passOnStoreError: true`) and connection state checks so requests pass through without hanging if Redis is offline.
- **Redis Connection Logging:** Added event listeners (`error`, `reconnecting`, `ready`) to log connection state changes and fallback mode warnings.

### Changed
- **Rate Limiter Prefix Isolation:** Created separate `RedisStore` instances with unique prefixes (`rate-limit:api:`, `rate-limit:auth:`, etc.) for each limiter to avoid store reuse validation errors.
- **IP Parsing Normalization:** Standardized `req.ip.replace(/^::ffff:/, '')` across all rate limiters for consistent client IP handling.
- **Default IPv4 Connection:** Changed default `REDIS_URL` in `.env` to `127.0.0.1` instead of `localhost` to prevent IPv6 resolution timeouts on Windows Docker setups.

## [Frontend v1.1.0] - React Query Caching & UI Performance Polish

### Added
- **Global Caching Engine:** Migrated the entire application state to React Query with a strict 60-second `staleTime` and background re-fetching for hyper-optimized network performance.
- **Optimistic UI Updates:** Edit actions on the Knowledge Base (Renaming, Description updates, Folder changes) and Document Card deletions now execute instantly on the client via `queryClient.setQueryData`, eliminating perceived network latency.
- **Upload Queue Editing:** Added the ability to inline-edit document titles directly within the Upload Modal queue before triggering the upload.

### Changed
- **Framer Motion Layout Optimization:** Fixed severe grid jumping bugs in Knowledge Base and Contacts by implementing `<AnimatePresence mode="popLayout">`, allowing deleted cards to fade seamlessly while the surrounding grid glides naturally into place.
- **CSS Transition Conflicts:** Removed generic `transition-all` classes across all interactive cards in favor of explicit `transition-colors` and `transition-shadow` to prevent layout calculations from clashing with Framer Motion.
- **UI & Tooltip Polish:** Cleaned up heavy inline warning text across Knowledge Base and Analytics pages by migrating them into sleek, properly-themed hover tooltips. Upgraded UI consistency across buttons and icons.
- **Strict TypeScript Typing:** Resolved legacy `any` types in `Contacts.tsx` and mapping functions to enforce strict `Contact` and `Organization` interfaces.

## [Backend v1.2.0] - AI Document Description & Metadata Retrieval Pipeline

### Added
- **Automatic AI Document Description Generation:** Every uploaded document automatically gets a concise AI-generated description after embedding completes.
- **Background Description Worker:** Description generation runs asynchronously after processing, so it never blocks uploads or retrieval.
- **Intelligent Large Document Sampling:** Huge documents are sampled across beginning, middle, end, and major sections instead of sending the entire document to the LLM.
- **Hybrid Metadata Search Service:** Added PostgreSQL metadata search using Full-Text Search (tsvector), fuzzy matching (pg_trgm), and filename/title/description matching.
- **Detailed Metadata Debug Logging:** Logs now show metadata scores, full-text scores, similarity scores, and retrieval decisions, making the pipeline much easier to debug and tune.
- **Configurable Retrieval Threshold:** Metadata confidence threshold is configurable through environment variables for future tuning.

### Changed
- **Idempotent Description Generation:** Existing valid descriptions are not regenerated unless the document content changes or a refresh is requested.
- **User Description Protection:** If the user manually edits a description, the AI never overwrites it.
- **Fault-Tolerant Processing:** Even if description generation fails after retries, the document remains fully searchable via vector search.
- **Metadata-Aware Retrieval Decision:** Before expensive AI reasoning, the system checks whether the email matches uploaded document metadata.
- **High-Confidence Metadata Bypass:** Strong metadata matches immediately trigger retrieval without calling the AI retrieval classifier.
- **AI Classifier Fallback:** If metadata confidence is low, the AI classifier makes the final decision on whether retrieval is needed.
- **Global Vector Search Preserved:** Vector search remains unchanged and continues searching across all embedded chunks without metadata reranking.
- **Cleaner Search Query Extraction:** Email content is cleaned by removing greetings, signatures, quoted replies, and boilerplate before metadata search.
- **Document-Aware Retrieval Pipeline:** Retrieval decisions are now informed by uploaded document metadata instead of relying solely on AI classification.
- **Improved Hallucination Prevention:** The AI is instructed to answer only from retrieved knowledge and ask for clarification instead of inventing missing information.
- **Concurrent Webhook Execution:** Implemented a pending webhook queue to seamlessly sync back-to-back emails without rejecting concurrent Pub/Sub triggers.

## [Backend v1.1.0] - Local Embedding Model Migration

### Changed
- **Local AI Worker:** Replaced external Google Gemini API with a local CPU-based `bge-small-en-v1.5` Transformers.js embedding model for document chunking, completely eliminating API costs and rate limits.
- **Worker Configuration:** Added `.env` flags for `EMBEDDING_WORKERS` and `EMBEDDING_BATCH_SIZE` to safely control memory consumption on free-tier EC2 instances.

## [Frontend v1.0.0] & [Backend v1.0.0] - Settings Center & UI Perfection

### Added (Frontend)
- **Settings Center UI:** Implemented a full, production-grade Settings page featuring a premium dark zinc and glassmorphic design system.
- **Account Profile Section:** Designed a beautifully balanced user profile header displaying live account information (Avatar, Email, Connection Status, and abbreviated Account ID).
- **Responsive Layout:** Upgraded the settings dashboard to dynamically adapt across themes with soft orange gradients for light mode and sleek dark zinc for dark mode.
- **Coming Soon Previews:** Added read-only toggles and fields for upcoming features (Auto-reply, Business Hours, RAG Confidence thresholds) with interactive "Coming Soon" badges and tooltip indicators.

### Added (Backend)
- **Settings Payload Expansion:** Updated the `getCurrentUser` authentication payload to automatically join and include the user's `UserSettings` from the database, eliminating the need for fallback configuration states.

### Changed
- **Dashboard Cleanup:** Cleaned up the Dashboard "Coming Soon" section to remove completed features like Email Analytics and Support Center.
- **Sidebar Navigation:** Streamlined the sidebar by removing unused Support navigation routes.

## [Frontend v0.9.0] & [Backend v0.9.0] - Analytics & AI Insights Dashboard

### Added (Backend)
- **Real-Time Analytics Event Service**: Implemented a highly scalable, centralized `AnalyticsEventService`. It acts as the sole writer for the `Analytics` table using safe, atomic Prisma upserts and fire-and-forget execution to guarantee absolutely zero impact or blocking on core application performance.
- **Universal Event Integrations**: Successfully wired analytics event recording into all existing systems without modifying their business logic. Real-time events include: `EMAIL_RECEIVED`, `DRAFT_GENERATED`, `KNOWLEDGE_RETRIEVED`, `CONTACT_CREATED`, `ORGANIZATION_CREATED`, `LOGIN`, and `SETTINGS_CHANGE`.
- **Historical Analytics Backfill Engine**: Created an idempotent `AnalyticsBackfillService` capable of parsing years of historical production data (Emails, Drafts, Sent Replies, Contacts, Documents, etc.) to reconstruct exact daily time-series analytics as if they were recorded from day one.
- **Executive CSV Export System**: Re-architected CSV exports from a raw data dump into a highly structured, spreadsheet-native professional layout utilizing clean key-value pairs for KPIs and spaced tables for historical trends.
- **Advanced API Architecture**: Built a complete analytics module matching the MailBot architecture containing `/overview`, `/charts`, `/export`, and Activity endpoints. All queries are strictly protected by `userId` and optimized against N+1 queries.

### Added (Frontend)
- **Premium Analytics Dashboard**: Replaced the "Coming Soon" screen with a full-blown responsive enterprise dashboard featuring the signature dark zinc, orange accent, and glassmorphic MailBot design system.
- **Interactive Recharts Visualization**: Implemented highly animated, fluid line charts and area charts tracking Email Volume, Draft Automation Efficiency, AI Confidence Matrices, and Knowledge Base Scaling over time.
- **Live WebSocket Synchronization**: The dashboard seamlessly listens for `sync:completed` and `analytics:updated` Socket.IO events, fetching fresh data instantaneously without requiring manual page reloads or polling.
- **Executive PDF Briefing**: Completely rewrote the PDF generation engine using `jsPDF` and `jspdf-autotable`. It strips away screenshots and constructs a pure native vector PDF containing dynamic plain-English Executive Summaries followed by distinct data breakdowns.
- **Granular Date Filtering**: Added a robust state-managed date selector allowing seamless toggling between 7D, 30D, 90D, or completely custom start/end timestamp ranges.

### Changed
- **Database Schema**: Expanded the Prisma schema by activating the `Analytics` and `ActivityLog` tables, enriching them with fields for tracking document embeddings, contacts created, storage used, and processing failures.

## [Frontend v0.8.0] & [Backend v0.8.0] - Contact Intelligence CRM & Merging System

### Added (Frontend)
- **Unified Contact Profile UI**: Complete rewrite of the Contact Profile with instant-cache tabs (`Overview`, `Timeline`, `Emails`, `Merged`), preserving state across navigation.
- **Deep Email Thread Integration**: Added live-rendered email history directly inside the Contact Profile, integrated seamlessly with the native ThreadViewer component via Stale-While-Revalidate caching.
- **Merge Contacts UI**: New interface allowing users to manually merge duplicate contacts.

### Added (Backend)
- **Contact Pointer System**: Implemented a self-referencing `mergedIntoId` schema update to maintain referential integrity when merging contacts, avoiding cascade deletion of email associations.
- **Context Priority AI Pipeline**: Enhanced the prompt compilation logic to strictly respect: (1) Conversation Context, (2) Contact Intelligence (Tone/Relationship), and (3) Knowledge Base. 
- **Inherited Tone Configuration**: When an email is received from a merged/deleted contact alias, the AI now successfully resolves the merge pointer and inherits the master contact's tone and AI preferences.

### Changed
- **CI/CD Pipeline**: Added GitHub Actions workflow for automated ESLint checking across both frontend and backend on PRs and main branch pushes.
- **Frontend Type Safety**: Replaced ambiguous `any` types with strict interfaces (`KnowledgeDocument`, `Thread`, `Email`, `Draft`), resolved `set-state-in-effect` violations, and migrated to optimized Next.js `<Image>` components.
- **Backend Cleanups**: Disabled conflicting ESLint rules for circular dependencies, ignored compiled outputs, applied safe non-null assertions, and pruned genuinely unused variables across all services.

### Fixed
- **Ghost Draft 404 Crash**: Fixed a critical bug in the Gmail Sync engine where encountering a 404 error on a background-deleted draft would crash the `Promise.all` incremental sync batch.

## [Backend v0.7.1] - Fair-Share Rate Limit Scheduler

### Changed
- **O(1) Fair-Share Rate Limiter:** Refactored the Groq API scheduler to a strictly isolated, per-user sequential queue architecture. Eliminates head-of-line blocking by allowing independent users to process concurrently.
- **Worker-Owned Backoff:** Transient errors (like 429s) now hold a user-specific queue lock during sleep but release the global concurrency slot, achieving 100% CPU utilization while preserving strict intra-user task ordering.
- **Production Guardrails:** Added a configurable maximum queue limit per user (100) to prevent OOM errors, alongside `Promise.race` 60-second timeouts to protect against infinitely hanging requests.

## [Frontend v0.7.0] & [Backend v0.7.0] - Knowledge Base & Semantic AI Retrieval

### Added
- **Complete Knowledge Base Module:** Support for uploading, viewing, searching, replacing, archiving, restoring, downloading, and deleting user documents.
- **AWS S3 Integration:** Secure document storage with checksum validation, MIME type verification, storage quotas, duplicate detection, and signed download URL generation.
- **Document Parsing Pipelines:** Added support for PDF, DOCX, TXT, Markdown, CSV, and XLSX files with normalized text extraction and metadata preservation.
- **Intelligent Document Chunking:** Token-aware segmentation, overlap preservation, heading-aware splitting, and chunk metadata generation.
- **Google Gemini Embeddings:** Automatic zero-padding for seamless compatibility with the existing 1536-dimensional pgvector schema without requiring database changes.
- **Semantic Vector Search:** Powered by pgvector with similarity ranking, adjacent chunk merging, duplicate elimination, document freshness prioritization, and retrieval statistics.
- **Retrieval Orchestration:** Pipeline capable of determining whether external knowledge is required before performing semantic search.
- **RAG-Augmented Drafts:** Extended the AI draft generation workflow with Retrieval-Augmented Generation (RAG), allowing relevant user knowledge to be injected into prompts while enforcing strict context budgeting and prioritizing conversation history.
- **Retrieval Metrics:** Added document usage tracking, retrieval counters, processing status updates, embedding completion state, and document version management.
- **Asynchronous Document Processing:** Covers parsing, chunk generation, embedding creation, database persistence, and completion notifications.
- **Comprehensive Socket Events:** Real-time Socket.IO events for upload progress, parsing, chunking, embedding, processing completion, replacement, deletion, archival, restoration, and document lifecycle synchronization.
- **Knowledge Base UI:** Complete interface with drag-and-drop uploads, document cards, folder organization, filtering, searching, storage statistics, processing indicators, metadata viewing, and responsive layouts.
- **Backend Management APIs:** APIs for document management, folder statistics, semantic search, storage information, document metadata updates, and secure download generation.
- **Backward Compatibility:** Preserved compatibility with the existing Gmail synchronization, AI analysis pipeline, draft generation workflow, authentication system, Socket.IO infrastructure, and production deployment without introducing breaking changes.

## [Frontend v0.6.3] & [Backend v0.6.2] - Gmail Permissions Fallback Flow

### Added
- **Permissions Fallback Dialog:** Implemented a persistent, floating UI dialog in the frontend that detects if a user denied Gmail scopes during OAuth. It blocks the user and forces them to re-authenticate with the correct permissions.
- **Dynamic Scope Tracking:** Backend now actively saves and updates the granted OAuth scopes in the database on subsequent logins, and injects a `hasGmailAccess` flag into the `/me` endpoint.

## [Frontend v0.6.2] - Mobile Responsiveness & Layout

### Fixed
- **Dashboard Grid Optimization:** Fixed severe horizontal overflow issues on small screens by allowing grid tracks to shrink properly and aggressively squashing widget paddings.
- **Sliding Inbox Panes:** Refactored the mobile inbox layout to use dynamic sliding panes. Opening a thread on mobile now natively overlays the screen with a slide-in animation and provides a back button.

## [Frontend v0.6.1] & [Backend v0.6.1] - Refresh Stability & Security Fixes

### Fixed
- **Cache Bypassing:** The global refresh button now actively passes a `refresh=true` flag to bypass local caching across the Dashboard, Inbox, and Thread Viewer.
- **Refresh Visual Feedback:** Thread viewer now correctly displays skeleton loaders during an active manual refresh.
- **Security:** Moved rate limiting for manual refreshes from the frontend to a dedicated `refreshRateLimiter` middleware in the backend (max 10 requests per minute).

## [Frontend v0.6.0] - UI Overhaul & Premium Aesthetics

### Added
- **Marketing UI Redesign:** Complete ground-up redesign of the Privacy, Terms, and FAQ pages with glassmorphic cards and interactive layouts.
- **Fluid Typography:** Implemented modern viewport-relative typography scaling across all marketing pages for perfect responsiveness on every device.
- **Changelog Widget:** Added a premium floating action widget and split-pane version history modal for tracking platform updates.

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
- **Database Architecture:** Complete Prisma schema for a production AI email platform.
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
