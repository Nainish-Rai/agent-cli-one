# Project Brief: Orchids Full Stack SWE Takehome - Database Agent

## Overview

At Orchids, we are building the best agentic AI for creating stunning apps and websites.
This challenge is focused on building a **Database Agent**—a CLI tool that integrates full database functionality into a Next.js + TypeScript project.

The Database Agent should be able to:

- Set up and manage database schemas.
- Implement database operations (CRUD).
- Create API endpoints for database queries.
- Integrate those features into the **frontend UI/UX** of the project.

The end result: given a user query, the agent modifies project files to fully implement the requested feature.

---

## Tech Stack Guidance

- **Frontend Template**: A Spotify clone built with Next.js + TypeScript (no backend yet). we only need to create cli that can modify this project.
- **Database**: PostgreSQL (can be local or hosted).
- **Database Framework**: Open choice, but **Drizzle ORM** is recommended:
  - Define schemas.
  - Run migrations.
  - Perform operations.
  - Connect to relational databases easily.

---

## Implementation

### 1. CLI Tool

- A script running at the root of the project.
- Behaves like Claude Code (or Repl CLI).
- Displays live agent process updates:
  - What it is “thinking.”
  - What file it is editing.
  - What step it is currently performing.

### 2. Database Agent

- Gathers context on the existing frontend project.
- Implements backend/database features:
  - Write schema setup files.
  - Run migrations.
  - Implement database operations.
  - Create & manage API endpoints.
- Integrates new features into the existing **Next.js frontend**.

---

## Test Queries

The agent should correctly implement the following user requests:

### Query 1

**“Can you store the recently played songs in a table”**

- Create and migrate a `recently_played` table.
- Populate it with data.
- Create a route to fetch information.
- **Bonus**: Integrate fetch route directly into the existing frontend to properly display data.

### Query 2

**“Can you store the ‘Made for you’ and ‘Popular albums’ in a table”**

- Create and migrate `made_for_you` and `popular_albums` tables.
- Populate them with data.
- Create a route to fetch information.
- **Bonus**: Integrate the routes so the frontend UI displays the new data.
