# dekaveAI - Product Ad Generator

A Next.js application that uses OpenAI's latest models to transform product photos into professional marketing ads.

## Features

- 🖼️ Upload product images and generate professional advertisements
- 🤖 Ad generation using OpenAI's DALL-E and GPT models
- 💰 Token-based pricing model with HD/Standard quality options
- 📱 Responsive UI designed for desktop and mobile
- 🔒 Google authentication integration
- 📊 Comprehensive analytics and tracking
- 💾 Persistent image storage with Vercel Blob Storage

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, TailwindCSS
- **AI**: OpenAI (GPT-4o-mini, DALL-E 3)
- **Storage**: Vercel Blob Storage
- **Analytics**: Vercel Analytics
- **Authentication**: NextAuth.js with Google OAuth
- **Styling**: TailwindCSS, Framer Motion

## Getting Started

### Prerequisites

- Node.js 18+
- NPM or Yarn
- OpenAI API key
- Google OAuth credentials
- Vercel account (for deployment)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/cramingle/dekaveai.git
   cd dekaveai
   ```

2. Install dependencies
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create a `.env.local` file in the root directory with the following variables:
   ```
   # NextAuth Configuration
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secret-key

   # Google OAuth
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret

   # OpenAI API
   OPENAI_API_KEY=your-openai-api-key

   # Vercel Blob Storage
   BLOB_READ_WRITE_TOKEN=your-blob-storage-token
   ```

4. Run the development server
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment

The application is designed to be deployed on Vercel, with built-in support for Vercel Blob Storage and Vercel Analytics.

1. Push your code to GitHub
2. Import the repository in Vercel
3. Set up the environment variables
4. Deploy

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- OpenAI for providing the AI models
- Vercel for the hosting platform and tools
- NextAuth.js for authentication support

## Setup and Deployment

### Supabase Setup

Before deploying to Vercel, you need to set up the NextAuth schema in your Supabase database:

1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Create a new query
4. Paste the contents of the `setup-nextauth-schema.sql` file from this repository
5. Click "Run" to execute the SQL

### Environment Variables for Vercel

Set the following environment variables in your Vercel project:

#### Authentication (NextAuth + Supabase)
- `NEXTAUTH_URL`: Your app's URL (e.g., https://yourdomain.com)  
- `NEXTAUTH_SECRET`: A secret string for NextAuth.js (generate with `openssl rand -base64 32`)
- `GOOGLE_CLIENT_ID`: Your Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

#### DANA Payment Integration
- `DANA_API_KEY`: Your DANA API key
- `DANA_API_SECRET`: Your DANA API secret
- `DANA_MERCHANT_ID`: Your DANA merchant ID
- `DANA_ENVIRONMENT`: Set to 'sandbox' or 'production'
- `NEXT_PUBLIC_DANA_ENABLED`: Set to 'true' to enable DANA payments
- `NEXT_PUBLIC_DANA_ENVIRONMENT`: Set to the same value as DANA_ENVIRONMENT

### Running the Project Locally

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm run dev
   ```

### Deployment to Vercel

1. Push your code to a Git repository
2. Connect the repository to Vercel
3. Configure the environment variables as outlined above
4. Deploy the project
