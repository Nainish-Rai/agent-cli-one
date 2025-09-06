# Orchids Database Agent CLI

A friendly, agentic CLI tool for implementing database features in your Next.js + Drizzle ORM project.

## Setup

1. **Install dependencies** (already done):

   ```bash
   npm install
   ```

2. **Set up environment variables**:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your Gemini API key:

   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

3. **Get a Gemini API key**:
   - Visit https://makersuite.google.com/app/apikey
   - Create a new API key
   - Add it to your `.env` file

## Usage

Run the agent with natural language queries:

```bash
# Using npm script
npm run agent "store recently played songs in a table"

# Or run directly with npx
npx tsx scripts/agent.ts "store recently played songs in a table"
```

## Example Queries

### Store Recently Played Songs

```bash
npm run agent "Can you store the recently played songs in a table"
```

### Store Made for You & Popular Albums

```bash
npm run agent "Can you store the 'Made for you' and 'Popular albums' in a table"
```

### General Database Operations

```bash
npm run agent "create a user preferences table with theme and language settings"
npm run agent "add a favorites table for users to save their favorite tracks"
npm run agent "create an API endpoint to get user playlists"
```

## Features

The agent provides:

- 🤔 **Agentic Logging**: See what the agent is thinking and doing
- 🔍 **Smart Analysis**: AI-powered understanding of your requirements
- 📋 **Implementation Planning**: Detailed steps for database features
- 🛠️ **Auto-Generation**: Database schemas, migrations, API routes, and UI integration

## What the Agent Can Do

- ✅ Create database schemas using Drizzle ORM
- ✅ Generate and run migrations
- ✅ Create API routes for database operations
- ✅ Plan frontend integration with existing Spotify clone UI
- ✅ Analyze existing project structure
- ✅ Provide TypeScript-first implementations

## Project Structure

The agent works with:

- **Schemas**: `src/db/schema/`
- **Migrations**: `src/db/migrations/`
- **API Routes**: `src/app/api/`
- **Components**: `src/components/`

## Example Output

When you run a query, you'll see:

```
🌺 Orchids Database Agent
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤔 Processing your request...
✓ Project analysis complete
🔍 Understanding your requirements...
✓ AI analysis complete

📋 Implementation Plan:
Database schema for recently played songs with API integration

📄 Creating database schema definition
   📁 Files: src/db/schema/recently-played.ts
🔄 Running database migrations
   📁 Files: src/db/migrations/
⚡ Generating API route
   📁 Files: src/app/api/recently-played/route.ts
🔗 Integrating with frontend UI
   📁 Files: src/components/

✅ Planning complete! Ready to implement database features.
```
