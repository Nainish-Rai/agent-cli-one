# 🌺 Orchids Agentic Database Agent

## Overview

The Orchids Database Agent is now a **truly agentic AI system** that uses advanced tool calling and feedback loops to understand your project structure and implement database features autonomously. Unlike traditional script-based approaches, this agent thinks, explores, and acts iteratively using AI-powered tools.

## 🧠 Agentic Features

### Tool-Powered Intelligence

The agent uses several tools to understand and modify your project:

- **`list_files`** - Explores project directory structure
- **`read_file`** - Reads and analyzes existing code
- **`write_file`** - Creates/modifies files with proper directory creation
- **`execute_command`** - Runs shell commands (migrations, installs, etc.)
- **`analyze_project`** - Gets comprehensive project analysis

### Feedback Loop System

The agent operates in an intelligent feedback loop:

1. **Analyzes** your query and project structure
2. **Plans** the implementation approach
3. **Executes** tools to gather information
4. **Iterates** based on results (up to 15 iterations)
5. **Implements** database features step by step
6. **Validates** and adjusts as needed

### Conversation Memory

- Maintains conversation history across tool calls
- Learns from previous interactions in the session
- Can reference earlier decisions and implementations

## 🚀 Usage

### Interactive Mode (Recommended)

```bash
npm run agent
# or
npm run agent -- --interactive
```

This starts an interactive session where you can:

- Have ongoing conversations with the agent
- See real-time tool usage and thinking process
- Clear history, view commands, get help
- Build complex features through iterative dialogue

### Single Query Mode

```bash
npm run agent "Can you store the recently played songs in a table"
```

### Available Commands in Interactive Mode

- `help` - Show available commands and examples
- `history` - View conversation history
- `clear` - Clear conversation memory
- `exit` - Exit the agent

## 🔧 Configuration

### Required Environment Variables

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

### Fallback Mode

Without an API key, the agent falls back to the legacy workflow (limited functionality).

## 🎯 Example Queries

The agent can handle complex, natural language requests:

### Database Schema Creation

```
"Can you store the recently played songs in a table"
"Create a user profiles table with authentication"
"Store the Made for you and Popular albums in tables"
```

### Advanced Features

```
"Add a playlist management system with songs and user relationships"
"Create a music recommendation engine with user preferences"
"Implement a social feature where users can follow each other"
```

### Frontend Integration

```
"Show the recently played songs in the main Spotify interface"
"Create a new section for user playlists in the sidebar"
"Add a dashboard showing user listening statistics"
```

## 🛠 How It Works

### 1. Project Analysis

The agent first explores your project structure:

```
🔧 Tool 1: analyze_project()
🔧 Tool 2: list_files(src)
🔧 Tool 3: read_file(src/components/spotify-main-content.tsx)
```

### 2. Schema Generation

Creates optimized database schemas:

```
🔧 Tool 4: write_file(src/db/schema/recently_played.ts)
🔧 Tool 5: execute_command(npx drizzle-kit generate)
```

### 3. API Development

Generates RESTful API endpoints:

```
🔧 Tool 6: write_file(src/app/api/recently-played/route.ts)
```

### 4. Frontend Integration

Updates React components to use new data:

```
🔧 Tool 7: read_file(src/components/spotify-main-content.tsx)
🔧 Tool 8: write_file(src/components/hooks/useRecentlyPlayed.ts)
```

## 🎨 Advanced Features

### Multi-Table Operations

The agent can create complex relational schemas:

```
"Create a music streaming database with users, playlists, songs, and listening history"
```

### Automatic Migrations

Handles database migrations and updates:

- Generates migration files
- Runs `drizzle-kit generate`
- Updates schema index files

### Smart Frontend Integration

- Analyzes existing components
- Creates appropriate React hooks
- Updates UI to display new data
- Maintains existing design patterns

### Error Recovery

- Validates generated code
- Fixes common issues automatically
- Provides clear error messages
- Falls back gracefully when needed

## 🔍 Monitoring Agent Behavior

### Verbose Mode

```bash
npm run agent -- --verbose "your query here"
```

Shows detailed tool execution:

```
🔧 Tool 1: list_files({"path": "src"})
🔧 Tool 2: read_file({"filepath": "package.json"})
🔧 Tool 3: analyze_project({})
```

### Real-time Feedback

The agent shows its thinking process:

```
🤔 Thinking: Starting agentic workflow...
🔍 Analyzing: Understanding project structure...
🛠️  Creating: Generating database schema...
🔗 Integrating: Updating frontend components...
```

## 🚦 Best Practices

### 1. Be Specific but Natural

❌ "Create table"
✅ "Store recently played songs with artist, title, and timestamp"

### 2. Mention Integration Needs

❌ "Create user table"
✅ "Create user profiles and show them in the sidebar"

### 3. Use Interactive Mode for Complex Features

For multi-step implementations, use interactive mode to guide the agent through the process.

### 4. Review Generated Code

The agent generates production-ready code, but always review before deploying.

## 🔐 Security & Safety

- Sandbox execution environment
- Read-only by default, writes only when explicitly needed
- Validates all generated code
- No network access beyond API calls
- All file operations are logged

## 🐛 Troubleshooting

### Agent Not Responding

1. Check `GEMINI_API_KEY` is set correctly
2. Ensure you have internet connectivity
3. Try the legacy mode fallback

### Generated Code Issues

1. The agent auto-validates most issues
2. Use `history` command to see conversation context
3. Ask the agent to fix specific problems

### Performance Issues

1. Clear conversation history with `clear`
2. Restart interactive mode
3. Use specific queries instead of very broad requests

## 🔄 Comparison: Agentic vs Legacy Mode

| Feature               | Agentic Mode                     | Legacy Mode              |
| --------------------- | -------------------------------- | ------------------------ |
| Project Understanding | ✅ Deep analysis via tools       | ❌ Basic assumptions     |
| Code Quality          | ✅ Context-aware generation      | ⚠️ Template-based        |
| Error Handling        | ✅ Auto-correction               | ❌ Manual fixes needed   |
| Frontend Integration  | ✅ Intelligent component updates | ⚠️ Basic integration     |
| Conversation Memory   | ✅ Full context awareness        | ❌ No memory             |
| Iterative Improvement | ✅ Feedback-driven refinement    | ❌ Single-pass execution |

The agentic mode represents a fundamental shift from scripted automation to intelligent, context-aware development assistance.
