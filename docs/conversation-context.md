# Conversation Context Implementation

This document outlines how conversation context is implemented in the dekaveAI application, allowing users to maintain meaningful exchanges with the AI across image generation sessions.

## Overview

When users interact with the AI to generate images, maintaining context from previous exchanges improves the user experience by:

1. Remembering user preferences and styles
2. Building upon previous image generation results
3. Creating a more natural conversation flow
4. Reducing repetition of information

## Technical Implementation

### Data Storage

- **Where stored**: User conversation context is stored in the Supabase database in the `users` table
- **Format**: JSON serialized conversation history in the `conversation_context` field
- **Last used tracking**: `conversation_last_used` timestamp field helps manage and expire old conversations

### Key Components

1. **ConversationManager** (`src/lib/conversation-manager.ts`)
   - Manages storing and retrieving conversation context
   - Handles message history format required by OpenAI API
   - Implements automatic conversation summarization when conversations get too long
   - Provides serialization/deserialization of conversation state

2. **API Routes** (`src/app/api/generate/route.ts`)
   - Loads user conversation context from database when processing requests
   - Passes context to image generation functions
   - Saves updated context back to database

3. **Supabase Integration** (`src/lib/supabase.ts`)
   - `storeConversationContext()` - Saves context to user record
   - `getConversationContext()` - Retrieves context for a user
   - Data model includes `conversation_context` and `conversation_last_used` fields

4. **Front-end Components** (`src/components/Chat.tsx`)
   - Detects when user has a stored conversation
   - Offers option to continue or start fresh
   - Manages conversation UI display

## Conversation Summarization

To manage token usage and keep conversations efficient:

1. When a conversation exceeds a defined length (default: 10 messages):
   - System creates a summary of the conversation using GPT-3.5 Turbo
   - The summary replaces older messages while preserving critical context
   - Recent messages are kept intact to maintain immediate context
   - This prevents token limits from being exceeded
   - Reduces API costs for long running conversations

2. Summarization prompt focuses on:
   - Extracting product details
   - User preferences
   - Style requirements
   - Brand information

## Database Schema

The following SQL schema changes support conversation context:

```sql
ALTER TABLE public.users 
ADD COLUMN conversation_context TEXT,
ADD COLUMN conversation_last_used TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_users_conversation_last_used 
ON public.users (conversation_last_used);
```

## Cleanup Process

To manage database size and remove unused conversations:

1. A SQL function `cleanup_old_conversations()` removes context older than 30 days
2. The function can be scheduled via Supabase Edge Functions or a cron job

## Best Practices

When extending this functionality:

1. Keep sensitive information out of context storage
2. Consider implementing client-side encryption for conversation data
3. Allow users to explicitly delete their conversation history
4. Optimize summarization prompts for your specific use case
5. Monitor token usage to balance context retention vs. cost

## Session Management

The NextAuth session includes conversation context information:

```typescript
session.user.hasStoredConversation = true/false;
session.user.conversationLastUsed = timestamp;
```

This allows the UI to detect when a user has a previous conversation available. 