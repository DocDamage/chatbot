# Database Setup Guide

## SQLite (Development)

The database integration uses `better-sqlite3` which requires native compilation.

### Windows Installation Issues

If you encounter build errors on Windows:
1. Install Visual Studio Build Tools
2. Or use PostgreSQL instead (recommended for production)

### Alternative: Use PostgreSQL

Set in `.env`:
```env
DB_TYPE=postgresql
DB_CONNECTION_STRING=postgresql://user:password@localhost:5432/chatbot
```

## PostgreSQL (Production)

1. Install PostgreSQL
2. Create database:
```sql
CREATE DATABASE chatbot;
```
3. Configure connection string in `.env`

## Database Features

- **Sessions**: Persistent session storage
- **Messages**: Chat history
- **Episodic Memory**: Long-term memory storage
- **Documents**: Knowledge base metadata

The database is optional - the system works without it using in-memory storage.

