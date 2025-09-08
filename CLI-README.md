# 🌺 Orchids Agentic Database Agent

An advanced AI-powered CLI tool that creates full-stack database implementations for Next.js projects using natural language queries. Built with Google Gemini AI and Drizzle ORM.

## Features

### 🤖 Agentic AI Capabilities
- **Interactive Mode**: Conversational interface with persistent context
- **Project Exploration**: Automatically analyzes your codebase using AI tools
- **Real-time Feedback**: Live updates on what the AI is thinking and doing
- **Smart Decision Making**: AI decides which tools to use based on your queries

### 🗄️ Database Operations
- **Schema Generation**: Creates Drizzle ORM schemas from natural language
- **Migration Management**: Automatic migration generation and execution
- **API Endpoints**: Generates complete CRUD API routes
- **Seed Data**: Creates realistic sample data for testing
- **Frontend Integration**: Updates React components to use database APIs

### 🎵 Spotify Clone Integration
- Seamless integration with the existing Spotify clone frontend
- Updates main content and sidebar components
- Generates React hooks for database operations
- Maintains UI/UX consistency

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up your environment variables:
```bash
# .env
GEMINI_API_KEY=your_google_gemini_api_key
DATABASE_URL=your_postgresql_connection_string
```

## Usage

### Interactive Mode (Recommended)

Start the interactive agentic mode:
```bash
npm run agent:interactive
```

This opens a conversational interface where you can:
- Ask questions about your project
- Request database implementations
- Get real-time AI assistance
- See the AI's thought process and tool usage

Example conversation:
```
🌺 orchids-agent> Can you store the recently played songs in a table
🤖 AI Agent is thinking...
🔧 Using tool: list_files
🔧 Using tool: read_file
🔧 Using tool: implement_database_feature
✅ Successfully implemented recently_played table with API endpoints and frontend integration
```

### Direct Query Mode

For single commands:
```bash
npm run agent "Can you store the recently played songs in a table"
```

## Test Queries

The agent is designed to handle the assignment's test queries:

### Query 1: Recently Played Songs
```bash
npm run agent "Can you store the recently played songs in a table"
```

**What it does:**
- Creates `recently_played` table with appropriate schema
- Generates migration files
- Creates API endpoints (`/api/recently-played/`)
- Populates with realistic sample data
- Updates frontend components to display the data

### Query 2: Made for You & Popular Albums
```bash
npm run agent "Can you store the 'Made for you' and 'Popular albums' in a table"
```

**What it does:**
- Creates `made_for_you` and `popular_albums` tables
- Generates proper relationships and constraints
- Creates API endpoints for both tables
- Seeds with album data
- Integrates with Spotify UI components

### Additional Examples

```bash
# Explore project structure
npm run agent:interactive
> Show me the current database schema

# Add user profiles
npm run agent "Create a user profiles table with preferences"

# Add playlist functionality
npm run agent "Store user playlists and their songs"
```

## Architecture

### Agentic AI System
```
User Query → Gemini AI → Tool Selection → Code Generation → Integration
```

**Available Tools:**
- `list_files`: Explore project structure
- `read_file`: Analyze existing code
- `implement_database_feature`: Execute database implementation

### Database Workflow
1. **Analysis**: AI explores project structure and existing schemas
2. **Schema Design**: Generates Drizzle ORM schemas using AI
3. **Migration**: Creates and runs database migrations
4. **API Generation**: Creates Next.js API routes with full CRUD
5. **Seeding**: Generates realistic sample data
6. **Frontend Integration**: Updates React components and hooks

### Generated File Structure
```
src/
├── db/
│   ├── schema/
│   │   ├── recently_played.ts     # Generated schema
│   │   ├── made_for_you.ts        # Generated schema
│   │   └── index.ts               # Updated exports
│   ├── migrations/                # Auto-generated migrations
│   └── seeds/                     # Realistic sample data
├── app/api/
│   ├── recently-played/           # CRUD endpoints
│   └── made-for-you-albums/       # CRUD endpoints
└── hooks/
    ├── use-recently-played.ts     # React hooks
    └── use-made-for-you.ts        # React hooks
```

## AI-Powered Features

### Intelligent Code Generation
- **Context-Aware**: AI reads existing code to maintain consistency
- **Best Practices**: Follows Next.js and Drizzle ORM conventions
- **Type Safety**: Generates proper TypeScript types
- **Error Handling**: Includes comprehensive error handling

### Smart Frontend Integration
- **Component Analysis**: AI analyzes existing React components
- **Hook Generation**: Creates reusable data fetching hooks
- **UI Updates**: Modifies components to use real database data
- **Styling Consistency**: Maintains existing design patterns

### Realistic Data Generation
- **Domain-Specific**: Creates music-related sample data
- **Relationships**: Maintains referential integrity
- **Variety**: Generates diverse, realistic datasets
- **Testing Ready**: Perfect for development and testing

## Commands Reference

```bash
# Interactive mode (full AI experience)
npm run agent:interactive

# Direct query mode
npm run agent "your natural language query"

# With verbose logging
npm run agent:interactive --verbose

# Development server
npm run dev

# Database migrations (manual)
npx drizzle-kit generate
npx drizzle-kit migrate
```

## Configuration

### Environment Variables
```bash
# Required for AI features
GEMINI_API_KEY=your_api_key

# Required for database
DATABASE_URL=postgresql://username:password@host:port/database

# Optional
NODE_ENV=development
```

### Drizzle Configuration
The agent automatically uses the existing `drizzle.config.ts` configuration.

## Troubleshooting

### Common Issues

**Missing API Key:**
```bash
⚠️  No GEMINI_API_KEY found
   Add your API key to .env file or use --apiKey option
```
→ Set `GEMINI_API_KEY` in your `.env` file

**Database Connection:**
```bash
❌ Migration error: Connection failed
```
→ Verify `DATABASE_URL` in your `.env` file

**Interactive Mode:**
```bash
❌ Interactive mode requires a Gemini API key
```
→ Ensure API key is set for interactive features

### Getting Help

In interactive mode, you can ask:
- "What tables exist in my database?"
- "Show me the project structure"
- "How do I use the generated API endpoints?"
- "What files were modified?"

## Assignment Compliance

This implementation fulfills all assignment requirements:

✅ **CLI Tool**: Interactive and direct query modes
✅ **Live Updates**: Real-time agent process display
✅ **Context Gathering**: AI explores existing project
✅ **Database Implementation**: Schema, migration, operations
✅ **API Endpoints**: Complete CRUD functionality
✅ **Frontend Integration**: Updates Spotify UI components
✅ **Test Queries**: Handles both required test cases
✅ **Drizzle ORM**: Uses recommended database framework
✅ **TypeScript**: Full type safety throughout

## Advanced Usage

### Custom Queries
The AI can handle complex database requirements:
```bash
"Create a social features system with user follows, likes, and comments"
"Add analytics tables to track user listening patterns"
"Set up a recommendation engine with user preferences"
```

### Development Workflow
1. Start interactive mode: `npm run agent:interactive`
2. Describe your feature: Natural language query
3. Watch AI implement: Live feedback and tool usage
4. Test integration: `npm run dev`
5. Iterate: Ask follow-up questions or refinements

---

**Built with ❤️ for the Orchids Full Stack SWE Assignment**
