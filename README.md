# Calendar Alternative

A small calendar where you describe what you need to do, and an AI helps find where it fits.

The app works as a normal calendar first. The AI is an extra layer: you write something like
"I need two hours of Java before Friday, preferably in the evening", and the app suggests free
time slots. You confirm a suggestion before anything changes in the calendar.

## Features

- Week and month views with simple previous/next navigation
- Create, edit, delete and drag and drop events
- AI chat for scheduling: describe an activity, get suggested slots, confirm one
- AI rescheduling: select an event or mention it in chat, get alternative slots, confirm one
- The AI only suggests. Nothing is added or moved without a click from the user

## Tech stack

| Part     | Technology                                                   |
| -------- | ------------------------------------------------------------ |
| Frontend | React, TypeScript, Vite, Tailwind CSS, shadcn/ui, date-fns   |
| Backend  | ASP.NET Core Web API (C#, .NET 10)                           |
| Database | SQLite with Entity Framework Core                            |
| AI       | Google Gemini API (free tier), using structured JSON output  |

## Architecture

```text
Browser (React)
   |  /api/*  (proxied by the Vite dev server)
   v
ASP.NET Core Web API
   |-- Controllers  ->  Services  ->  SQLite (EF Core)
   '-- GeminiClient ->  Google Gemini API
```

### How the AI chat works

```text
User message
   -> ChatController
   -> ChatService
   -> GeminiClient       Gemini turns the text into a structured request (JSON)
   -> validation         the response is checked and sanitized in C#
   -> SchedulingService  deterministic slot search against existing events
   -> suggested slots    shown in the chat
   -> user confirms      the frontend calls the normal events API
```

Key design decisions:

- **Gemini only understands language.** It converts a message into structured data
  (duration, deadline, preferred time, preferred days). It does not decide when anything happens.
- **Scheduling is plain C#.** The scheduling engine is a pure function: given a request, the
  existing events and the current time, it returns ranked free slots. The same engine is used for
  new events and for rescheduling.
- **The calendar never leaves the backend.** Gemini receives only the text the user typed
  (plus the user's few most recent messages as context). Event titles and times are never sent.
- **The API key stays on the backend.** It is never exposed to the frontend.
- **Times are local wall-clock values.** Events are stored and sent as plain local date-times
  such as `2026-10-07T18:00:00`, with no time zone conversion.

### Scheduling engine

- Hard constraints: the slot must be in the future, fit the duration, end before the deadline,
  stay within waking hours, and not overlap an existing event.
- Soft preferences: preferred days and time of day (morning, afternoon, evening) affect ranking
  but do not exclude slots, so there are always alternatives when preferences cannot be met.
- Candidates are generated in 30 minute steps, and the best slot of each day is returned.

### API endpoints

| Method | Path                           | Purpose                                      |
| ------ | ------------------------------ | -------------------------------------------- |
| GET    | `/api/events?from=...&to=...`  | Events overlapping a date range              |
| POST   | `/api/events`                  | Create an event                              |
| PUT    | `/api/events/{id}`             | Update or move an event                      |
| DELETE | `/api/events/{id}`             | Delete an event                              |
| POST   | `/api/scheduling/suggestions`  | Find free slots from a structured request    |
| POST   | `/api/chat`                    | Natural language message to suggested slots  |
| GET    | `/api/health`                  | Health check                                 |

### Project structure

```text
backend/
  Controllers/    HTTP endpoints
  Services/       EventService, SchedulingService, GeminiClient, ChatService
  DTOs/           Request and response shapes
  Models/         Database entities
  Data/           EF Core DbContext
  Migrations/     Database migrations
  Program.cs      Service registration and request pipeline
frontend/
  src/components/ Calendar views, event dialog, chat panel, shadcn/ui components
  src/lib/        API client, form drafts, drag and drop helpers
  src/types.ts    Shared TypeScript types
```

## Getting started

### Prerequisites

- .NET SDK 10
- Node.js 22 or newer
- A Gemini API key from [Google AI Studio](https://aistudio.google.com)
- The EF Core command line tool: `dotnet tool install --global dotnet-ef`

### Backend

```bash
cd backend

# Store the API key outside the repository (see Configuration below)
dotnet user-secrets set "Gemini:ApiKey" "<your-api-key>"

# Create the SQLite database
dotnet ef database update

# Run the API
dotnet run --urls http://localhost:5080
```

User secrets are only loaded in the `Development` environment, so set it before running:

```bash
# macOS / Linux
export ASPNETCORE_ENVIRONMENT=Development

# Windows PowerShell
$env:ASPNETCORE_ENVIRONMENT = "Development"
```

The startup log should print `Hosting environment: Development`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` to the backend on port 5080.

## Configuration

| Setting                     | Where                                      | Notes                                                        |
| --------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| `Gemini:ApiKey`             | .NET user secrets, or env var `Gemini__ApiKey` | Required for the chat. Never commit it.                  |
| `Gemini:Model`              | `backend/appsettings.json`                 | Gemini model name. Google retires models regularly, so check which models are currently available on the free tier. |
| `ConnectionStrings:Default` | `backend/appsettings.json`                 | Defaults to the local file `calendar.db`.                    |
| `ASPNETCORE_ENVIRONMENT`    | Environment variable                       | Set to `Development` to load user secrets.                   |

The Gemini free tier has rate limits and can occasionally answer with a temporary overload error.
The backend retries automatically, and the chat shows a "Try again" button if a request still fails.

To move from SQLite to another relational database such as PostgreSQL, change the provider in
`Program.cs` and create new migrations. The rest of the application does not depend on SQLite.