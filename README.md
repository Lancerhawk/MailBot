# MailBot

MailBot is a production-quality, AI-powered email management platform.

## Current Status

**Backend Version 0.2.0 (Phase 2 Completed)**
The project is currently configured as a modular monolith. The frontend and backend are completely decoupled into distinct projects, each with their own versioning (`backend/package.json` vs `frontend/package.json`), allowing for a clean separation of concerns.

## Database Architecture

MailBot uses a comprehensive PostgreSQL schema orchestrated via Prisma, featuring AI embedding capabilities via `pgvector`.

## AI Integration Strategy

*   **MailBot Version 1 uses Groq as its default inference provider.**
*   The database schema remains completely **provider-agnostic** to support future integrations.
*   Future versions can seamlessly switch between providers (OpenAI, Anthropic, Gemini, Custom) without requiring any schema redesign or migrations.

```mermaid
erDiagram
    User {
        String id PK
        String email
        String name
        String timezone
    }
    EmailAccountConnection {
        String id PK
        String emailAddress
        String provider
        DateTime lastSuccessfulSyncAt
    }
    Organization {
        String id PK
        String domain
        String name
    }
    Contact {
        String id PK
        String emailAddress
        String displayName
        Int interactionCount
    }
    EmailThread {
        String id PK
        String providerThreadId
        String subject
        Int messageCount
    }
    Email {
        String id PK
        String providerMessageId
        String subject
        String category
        Boolean needsReply
        String replyStatus
    }
    EmailParticipant {
        String id PK
        String emailAddress
        String role
    }
    EmailLabel {
        String id PK
        String name
    }
    Attachment {
        String id PK
        String filename
        String mimeType
        Int sizeBytes
    }
    AiDraftReply {
        String id PK
        String generatedText
        String approvalStatus
        Decimal cost
    }
    SentReply {
        String id PK
        String deliveryStatus
        DateTime sentAt
    }
    KnowledgeBaseDocument {
        String id PK
        String title
        String fileType
        String processingStatus
    }
    KnowledgeBaseChunk {
        String id PK
        Int chunkIndex
        String content
        Vector embedding
    }
    PromptTemplate {
        String id PK
        String name
        String type
    }
    UserSetting {
        String id PK
        Boolean autoReply
        String preferredAiModel
    }
    Notification {
        String id PK
        String type
        String message
    }
    ProcessingJob {
        String id PK
        String jobType
        String status
        Int priority
    }
    Analytics {
        String id PK
        DateTime date
        Int emailsReceived
        Int timeSavedSeconds
    }
    ActivityLog {
        String id PK
        String action
        String severity
    }
    ApiKey {
        String id PK
        String name
        String keyHash
    }

    User ||--o{ EmailAccountConnection : owns
    User ||--o{ EmailThread : owns
    User ||--o{ Email : owns
    User ||--o{ Contact : owns
    User ||--o{ Organization : owns
    User ||--o{ KnowledgeBaseDocument : owns
    User ||--o{ PromptTemplate : owns
    User ||--|| UserSetting : has
    User ||--o{ Notification : receives
    User ||--o{ ProcessingJob : queues
    User ||--o{ Analytics : tracks
    User ||--o{ ActivityLog : logs
    User ||--o{ ApiKey : manages
    User ||--o{ AiDraftReply : drafts
    
    EmailAccountConnection ||--o{ EmailThread : connects
    EmailAccountConnection ||--o{ Email : syncs
    
    EmailThread ||--o{ Email : groups
    
    Email ||--o{ EmailParticipant : has
    Email ||--o{ Attachment : contains
    Email ||--o{ EmailLabel : tagged_with
    Email ||--o{ AiDraftReply : drafted_for
    Email ||--o{ SentReply : generates
    
    AiDraftReply ||--o| SentReply : becomes
    
    Contact ||--o{ EmailParticipant : participates_as
    Organization ||--o{ Contact : employs
    
    KnowledgeBaseDocument ||--o{ KnowledgeBaseChunk : chunked_into
```

## Tech Stack

**Frontend:**
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- React Query, React Hook Form, Zod
- Shadcn UI, Lucide React

**Backend:**
- Node.js & Express
- TypeScript
- Prisma ORM
- PostgreSQL (Supabase)
- Pino (Logging), Socket.IO (WebSockets)

## Folder Structure

```text
mailbot/
├── backend/
├── frontend/
├── CHANGELOG.md
├── LICENSE
└── README.md
```

## Installation Instructions

1. **Clone the repository**
2. **Setup Frontend:**
   ```bash
   cd frontend
   npm install
   ```
3. **Setup Backend:**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   npx prisma generate
   ```

## Development Commands

- **Start Frontend:** `cd frontend && npm run dev`
- **Start Backend:** `cd backend && npm run dev`

## Future Roadmap
- Phase 1: Authentication & Core Architecture (Current)
- Phase 2: Email Provider Integrations (Gmail/Outlook)
- Phase 3: AI Categorization & Parsing
- Phase 4: Migration to Microservices (Event-Driven Architecture)

## License
This project is licensed under the MIT License - see the LICENSE file for details.
