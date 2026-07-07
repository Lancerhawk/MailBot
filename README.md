<div align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/mail.svg" alt="MailBot Logo" width="100" height="100" style="margin-bottom: 20px" />

  # MailBot
  
  **The Next-Generation AI-Powered Email Intelligence Platform**
  
  [![Frontend Version](https://img.shields.io/badge/Frontend-v0.5.0-000000?style=for-the-badge&logo=next.js)](frontend/package.json)
  [![Backend Version](https://img.shields.io/badge/Backend-v0.6.0-339933?style=for-the-badge&logo=nodedotjs)](backend/package.json)
  [![Database](https://img.shields.io/badge/Prisma_&_PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)](#)
  [![AI](https://img.shields.io/badge/Powered_by_Groq-f55036?style=for-the-badge&logo=openai&logoColor=white)](#)

  <br />
  <i>Seamlessly integrating with Gmail to automate workflows, categorize communications, and draft intelligent responses in real-time.</i>
</div>

<br />

## Core Capabilities

<table>
  <tr>
    <td width="50%">
      <h3> Real-Time Synchronization</h3>
      <p>Direct integration with Google Cloud Pub/Sub webhooks ensures your inbox state is updated instantly the millisecond an email arrives.</p>
    </td>
    <td width="50%">
      <h3> AI-Assisted Drafting</h3>
      <p>Leverages lightning-fast LLMs (like Groq) to deeply analyze incoming threads and automatically propose context-aware, ready-to-send draft replies.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3> Intelligent Organization</h3>
      <p>Auto-categorizes emails, extracts rich metadata, and groups messages into unified, beautifully designed chronological threads.</p>
    </td>
    <td width="50%">
      <h3> Automated CRM</h3>
      <p>Passively builds a directory of contacts and organizations by extracting sender data and interaction history from every email.</p>
    </td>
  </tr>
</table>

<br />

---

## Diagrams

### 1. User Experience & Application Flow
```mermaid
graph TD
    A[User visits MailBot] --> B{Authenticated?}
    B -->|No| C[Landing Page]
    C --> D[Click 'Log In with Google']
    D --> E[Google OAuth Consent Screen]
    E --> F[Backend /auth/google/callback]
    F --> G[Initialize Session & Register Gmail Watch]
    G --> H[Redirect to /auth/callback]
    H --> I[Dashboard]
    B -->|Yes| I[Dashboard]
    I --> J[View Inbox & Threads]
    I --> K[View AI Generated Drafts]
    K --> L[Approve & Send Email]
```

### 2. Class / Component Diagram
```mermaid
classDiagram
    class Frontend {
        +AuthContext
        +SocketContext
        +api (AxiosClient)
        +DashboardLayout()
        +LandingPage()
    }
    class Backend_Controllers {
        +googleAuth()
        +googleCallback()
        +getCurrentUser()
        +processWebhook()
    }
    class Backend_Services {
        +AuthService
        +GmailSyncService
        +GmailDbService
        +WatchRenewalService
    }
    class External_APIs {
        +Google OAuth
        +Gmail API
        +Google Pub/Sub
        +Groq LLM
    }
    Frontend --> Backend_Controllers : REST API calls
    Backend_Controllers --> Backend_Services : Logic delegation
    Backend_Services --> External_APIs : Fetches / Pushes data
    External_APIs --> Backend_Controllers : Webhooks (Push)
```

### 3. Data Flow Diagram (DFD)
```mermaid
flowchart LR
    User([User]) -->|HTTP GET / POST| UI[Next.js Frontend]
    UI -->|API Requests| API[Express Backend]
    Gmail([Gmail Servers]) -->|Pub/Sub Webhook| API
    API -->|Read/Write via Prisma| DB[(PostgreSQL)]
    API -->|Fetch Email Content| Gmail
    API -->|Send Content for Analysis| LLM([Groq AI])
    LLM -->|Return Draft| API
```

---

## Comprehensive Folder & File Structure

```text
mailman/
├── backend/
│   ├── prisma/
│   │   ├── migrations/              # Database migration history
│   │   └── schema.prisma            # Main Prisma schema definition
│       │           └── watch-renewal.service.ts # Renews the Gmail Pub/Sub watch expiration
│       ├── routes/
│       │   ├── v1/
│       │   │   ├── auth.route.ts    # Routes for /api/v1/auth
│       │   │   ├── health.route.ts  # Standard uptime check
│       │   │   └── index.ts         # Main router entrypoint
│       └── app.ts                   # Express app configuration (CORS, Morgan, helmet)
│       └── server.ts                # Starts the HTTP server and Prisma client
└── frontend/
    └── src/
        ├── app/
        │   ├── (dashboard)/         # Protected application layout group
        │   │   ├── analytics/page.tsx # Renders charts for email activity
        │   │   ├── drafts/page.tsx    # Renders pending AI drafts
        │   │   ├── inbox/page.tsx     # Renders the primary email feed
        │   │   └── layout.tsx       # Sidebar and Topbar wrapper for the dashboard
        │   ├── auth/callback/
        │   │   └── page.tsx         # Rehydrates user state after Google OAuth redirect
        │   ├── error.tsx            # Next.js global error boundary
        │   ├── globals.css          # Tailwind base directives and CSS variables
        │   ├── layout.tsx           # The root Next.js document layout
        │   └── page.tsx             # The unauthenticated marketing/landing page
        ├── components/
        │   ├── auth/                # ProtectedRoute wrapper
        │   ├── dashboard/           # Specific dashboard widgets (Sidebar, Navbar)
        │   └── ui/                  # Reusable Radix/Tailwind components (Buttons, Modals)
        ├── lib/
        │   ├── api.ts               # Pre-configured Axios instance with credentials
        │   └── utils.ts             # Tailwind class merging (cn)
        └── providers/
            ├── AuthProvider.tsx     # React Context for global User state
            └── SocketProvider.tsx   # React Context for WebSocket connections
```

---

## Full Database Schema (Entity-Relationship)

```mermaid
erDiagram
    User {
        String id PK
        String email UK
        String name
        String avatarUrl
        String timezone
        String locale
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }
    
    EmailAccountConnection {
        String id PK
        String userId FK
        EmailProvider provider
        String providerAccountId
        String emailAddress
        String encryptedAccessToken
        String encryptedRefreshToken
        DateTime accessTokenExpiresAt
        String scope
        String syncToken
        BigInt lastHistoryId
        DateTime lastSuccessfulSyncAt
        DateTime watchExpiration
        SyncStatus syncStatus
        String lastSyncError
        Boolean isActive
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }
    
    Organization {
        String id PK
        String userId FK
        String domain
        String name
        String industry
        String companyWebsite
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }
    
    Contact {
        String id PK
        String userId FK
        String organizationId FK
        String emailAddress
        String displayName
        String avatarUrl
        String jobTitle
        String phoneNumber
        String preferredTone
        ContactRelationship relationship
        Int interactionCount
        DateTime lastInteraction
        String customNotes
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }
    
    EmailThread {
        String id PK
        String userId FK
        String accountConnectionId FK
        String providerThreadId
        String subject
        Int messageCount
        DateTime lastMessageAt
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }
    
    Email {
        String id PK
        String userId FK
        String accountConnectionId FK
        String emailThreadId FK
        String providerMessageId
        String providerConversationId
        String internetMessageId
        String inReplyTo
        String[] referencesHeader
        String subject
        String plainBody
        String htmlBody
        String snippet
        DateTime providerInternalDate
        DateTime receivedAt
        DateTime sentAt
        Boolean isRead
        Boolean isStarred
        Boolean isImportant
        Boolean isDraft
        Boolean isDeleted
        Boolean isArchived
        Boolean isSpam
        EmailCategory category
        Priority priority
        Boolean needsReply
        ReplyStatus replyStatus
        String summary
        Sentiment sentiment
        Intent intent
        Float confidence
        ProcessingStatus processingStatus
        Boolean hasAttachments
        BigInt providerHistoryId
        Json metadata
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }
    
    EmailLabel {
        String id PK
        String emailId FK
        String providerLabelId
        String name
        EmailLabelType type
        String color
        DateTime createdAt
    }
    
    EmailParticipant {
        String id PK
        String emailId FK
        String contactId FK
        String emailAddress
        String displayName
        ParticipantRole role
    }
    
    Attachment {
        String id PK
        String emailId FK
        String filename
        String mimeType
        AttachmentCategory mimeCategory
        Int sizeBytes
        String storagePath
        StorageProvider storageProvider
        String checksum
        ProcessingStatus processingStatus
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }
    
    AiDraftReply {
        String id PK
        String emailId FK
        String userId FK
        String generatedText
        AiProvider provider
        String modelName
        String promptVersion
        Float temperature
        Int promptTokens
        Int completionTokens
        Int totalTokens
        Int generationLatencyMs
        Decimal cost
        Float confidence
        ApprovalStatus approvalStatus
        String editedText
        Boolean isFinal
        Json reasoningMetadata
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }
    
    SentReply {
        String id PK
        String originalEmailId FK
        String draftId FK
        String sentEmailId
        String providerMessageId
        DeliveryStatus deliveryStatus
        String failureReason
        DateTime sentAt
    }
    
    KnowledgeBaseDocument {
        String id PK
        String userId FK
        String title
        String description
        String fileType
        String mimeType
        Int fileSize
        String checksum
        String storagePath
        StorageProvider storageProvider
        KnowledgeSource source
        ProcessingStatus processingStatus
        Int version
        Boolean isEmbedded
        DateTime embeddedAt
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }
    
    KnowledgeBaseChunk {
        String id PK
        String documentId FK
        Int chunkIndex
        String content
        Int tokenCount
        String embeddingModel
        Unsupported embedding
        Json metadata
    }
    
    PromptTemplate {
        String id PK
        String userId FK
        String name
        String description
        PromptType type
        String content
        Int version
        Boolean isActive
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }
    
    UserSetting {
        String id PK
        String userId FK
        Boolean autoReply
        String businessHoursStart
        String businessHoursEnd
        String businessHoursTimezone
        String replySignature
        AiProvider preferredAiProvider
        String preferredAiModel
        String theme
        Boolean notifyOnNewEmail
        Boolean notifyOnDraftReady
        Boolean notifyOnErrors
        Float confidenceThreshold
        DraftApprovalMode draftApprovalMode
        Json dynamicConfig
        DateTime createdAt
        DateTime updatedAt
    }
    
    Notification {
        String id PK
        String userId FK
        NotificationType type
        String title
        String message
        Boolean isRead
        String linkUrl
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }
    
    ProcessingJob {
        String id PK
        String userId FK
        JobType jobType
        ProcessingEntityType entityType
        String entityId
        ProcessingStatus status
        Int priority
        Int attempts
        Int maxAttempts
        String errorLog
        String workerId
        DateTime nextRetryAt
        DateTime startedAt
        DateTime completedAt
        DateTime createdAt
        DateTime updatedAt
    }
    
    Analytics {
        String id PK
        String userId FK
        DateTime date
        Int emailsReceived
        Int emailsClassified
        Int emailsSummarized
        Int emailsReplied
        Int draftsGenerated
        Int draftsApproved
        Int draftsRejected
        Float averageConfidence
        Float averageLatency
        Float averageReplyGenerationTime
        Int totalPromptTokens
        Int totalCompletionTokens
        Decimal estimatedCost
        Int timeSavedSeconds
        DateTime createdAt
        DateTime updatedAt
    }
    
    ActivityLog {
        String id PK
        String userId FK
        ActivityType action
        String entityType
        String entityId
        Severity severity
        String ipAddress
        String userAgent
        Json metadata
        DateTime createdAt
    }
    
    ApiKey {
        String id PK
        String userId FK
        String keyHash
        String name
        Boolean isActive
        DateTime expiresAt
        DateTime lastUsedAt
        DateTime lastRotatedAt
        DateTime createdAt
        DateTime updatedAt
        DateTime deletedAt
    }

    User ||--o| UserSetting : has
    User ||--o{ EmailAccountConnection : has
    User ||--o{ EmailThread : has
    User ||--o{ Email : has
    User ||--o{ Contact : has
    User ||--o{ Organization : has
    User ||--o{ AiDraftReply : has
    User ||--o{ KnowledgeBaseDocument : has
    User ||--o{ PromptTemplate : has
    User ||--o{ Notification : has
    User ||--o{ ProcessingJob : has
    User ||--o{ Analytics : has
    User ||--o{ ActivityLog : has
    User ||--o{ ApiKey : has

    EmailAccountConnection ||--o{ EmailThread : contains
    EmailAccountConnection ||--o{ Email : contains

    Organization ||--o{ Contact : has

    Contact ||--o{ EmailParticipant : is

    EmailThread ||--o{ Email : contains

    Email ||--o{ EmailParticipant : has
    Email ||--o{ Attachment : has
    Email ||--o{ EmailLabel : has
    Email ||--o{ AiDraftReply : has
    Email ||--o{ SentReply : has

    AiDraftReply ||--o| SentReply : generates
    
    KnowledgeBaseDocument ||--o{ KnowledgeBaseChunk : contains
```

---

## How to Run Locally

### Prerequisites
1. Node.js (v18+)
2. PostgreSQL (or Supabase Connection Pool)
3. Google Cloud Console credentials for OAuth and Webhook Pub/Sub
4. Groq API Key (or other LLM API keys)

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your `.env` file (Database URL, Google OAuth IDs, Session Secrets).
4. Run migrations and generate Prisma client:
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```
5. Start the backend:
   ```bash
   npm run dev
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Ensure you have the `NEXT_PUBLIC_API_URL` environment variable set if testing against a deployed backend.
4. Start the frontend:
   ```bash
   npm run dev
   ```
