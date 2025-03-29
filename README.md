# dekaveAI - AI-Powered Product Ad Generator

A Next.js application that uses OpenAI's latest models to transform product photos into professional marketing ads.

## Features

- 🖼️ Upload product images and generate professional advertisements
- 🤖 AI-powered ad generation using OpenAI's DALL-E and GPT models
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
