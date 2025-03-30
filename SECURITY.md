# dekaveAI Security Documentation

This document outlines the security measures implemented in the dekaveAI application to protect user data, prevent abuse, and ensure system integrity.

## API Rate Limiting

All API endpoints implement rate limiting to prevent abuse:

1. **Generate API**: Limited to 5 requests per minute per IP address
2. **Payment API**: Limited to 5 requests per minute per IP address
3. **Stripe Webhook**: Limited to 30 requests per minute per IP address
4. **Track API**: No rate limiting implemented yet, but access is restricted by environment

## Database Security

### Row Level Security (RLS)

Supabase Row Level Security policies are implemented to ensure users can only access their own data:

1. **Users Table**: Users can only read and update their own non-critical data
2. **Generation Records**: Users can only access their own generation records

### Database Rate Limiting

Database triggers implement rate limiting at the database level:

1. **Generation Records**: Rate limits enforced by database triggers
   - Standard rate limit: 10 records per minute for all users

## Authentication

1. **Google OAuth**: Secure authentication using Google OAuth 2.0
2. **Supabase Auth**: NextAuth integration with Supabase adapter

## Payment Security

1. **Stripe Integration**: All payments processed through Stripe
2. **Webhook Verification**: Stripe signatures verified for webhook calls
3. **User ID Tracking**: Client reference IDs used to track payments

## Future Improvements

1. **Distributed Rate Limiting**: Replace in-memory rate limiting with Redis for multi-server deployments
2. **Webhook Enhancements**: Add more robust validation for webhook payment confirmations
3. **Client-Side Security**: Remove all client-side Supabase calls to prevent token exposure

## Environment Variables

Ensure the following environment variables are set for security features to work:

- `STRIPE_WEBHOOK_SECRET`: For Stripe webhook signature verification
- `SUPABASE_SERVICE_ROLE_KEY`: For secure server-side Supabase operations
- `NEXTAUTH_SECRET`: For secure session management

## Security Contacts

If you discover a security vulnerability, please contact [security@dekaveai.com](mailto:security@dekaveai.com) instead of using the issue tracker. 