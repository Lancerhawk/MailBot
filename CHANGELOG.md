# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
