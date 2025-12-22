# ProductWiki - Vercel Edition

AI-powered documentation generator for GitHub repositories. This version is deployed on Vercel with Gemma-3-27b-it and Upstash Vector.

## Quick Start

### Prerequisites

1. **Upstash Vector Index** (already created as `p9-upstash`)
   - Dimensions: 768
   - Metric: cosine
   - Get your REST URL and Token from [Upstash Console](https://console.upstash.com/vector)

2. **Google API Key**
   - Get from [Google AI Studio](https://aistudio.google.com/apikey)
   - Used for Gemma-3-27b-it LLM and text-embedding-004

### Environment Variables

Create a `.env.local` file for local development:

```env
GOOGLE_API_KEY=your_google_api_key
UPSTASH_VECTOR_REST_URL=https://your-index.upstash.io
UPSTASH_VECTOR_REST_TOKEN=your_token
```

For Vercel deployment, set these in your Vercel project settings.

### Local Development

```bash
# Install dependencies
npm install

# Run Vercel dev server (includes API routes)
npm run vercel-dev

# In another terminal, run Vite dev server
npm run dev

# Open http://localhost:5173
```

### Deployment

```bash
# Deploy to Vercel
vercel deploy

# Or deploy to production
vercel --prod
```

Make sure to set the environment variables in your Vercel project settings before deploying.

## Architecture

### Backend (Serverless)
- **API**: Hono with Vercel adapter (`/api/[[...route]].ts`)
- **LLM**: Gemma-3-27b-it via Google AI Studio
- **Embeddings**: Google text-embedding-004 (768 dimensions)
- **Vector DB**: Upstash Vector (serverless-compatible)
- **SSE Streaming**: Real-time generation with Server-Sent Events

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **Routing**: React Router v7
- **UI**: shadcn/ui + Tailwind CSS
- **Storage**: IndexedDB for user settings (with localStorage fallback)

## Features

- **Repository Indexing**: Index GitHub repositories via public API
- **RAG-Powered Generation**: Semantic search with vector embeddings
- **Wiki Documentation**: Generate structured technical documentation
- **Product Docs**: End-user focused documentation
- **Migration Prompts**: Generate prompts for Electron migration or reimplementation
- **API Key Management**: Optional user keys with backend defaults for demo

## API Endpoints

All endpoints are under `/api`:

- `POST /api/index` - Index a GitHub repository (SSE)
- `GET /api/index/status/:owner/:repo` - Check index status
- `GET /api/projects` - List all indexed projects
- `GET /api/projects/:owner/:repo` - Get project metadata
- `POST /api/generate/docs` - Generate documentation (SSE)
- `POST /api/generate/package-prompt` - Generate Electron migration prompt (SSE)
- `POST /api/generate/reimplement-prompt` - Generate reimplementation prompt (SSE)
- `POST /api/wiki/brief` - Generate brief wiki (SSE)
- `POST /api/wiki/detailed` - Generate detailed wiki (SSE)
- `POST /api/wiki/dynamic` - Generate dynamic wiki (SSE)
- `POST /api/wiki/product-docs` - Generate product documentation (SSE)

## Configuration

### LLM Model

Default: `gemma-3-27b-it`

You can customize the model in the Settings UI or via environment:
- The model must be available via Google AI Studio
- Gemma models are specially handled (no systemInstruction parameter)

### Vector Database

Using Upstash Vector with:
- Index: `p9-upstash`
- Dimensions: 768
- Similarity: Cosine

Metadata is stored as special vectors with `type: 'metadata'` filter.

## User Settings

Settings are stored in IndexedDB and synced to localStorage:
- **API Keys**: Optional (backend provides defaults)
- **LLM Provider**: Gemini or Ollama (Gemini default)
- **Model**: Customizable model name

## Rate Limiting

The backend includes automatic rate limit handling:
- 30-second cooldown per key when rate limited
- Round-robin rotation between multiple keys
- Supports both user-provided and default backend keys

## Notes

- This is a **demo/limited production** version
- Default API keys are provided - users can optionally add their own
- Job registry removed (serverless is stateless)
- No "one repo per day" rate limiting implemented
- Logs are not persisted (use Vercel dashboard for monitoring)

## Troubleshooting

### "Repository not found"
- Repository must be public
- Check GitHub URL format: `https://github.com/owner/repo`

### "Rate limit exceeded"
- Add more API keys in Settings
- Wait for cooldown period (30 seconds per key)
- Or use your own Google API key

### "Failed to store embeddings"
- Check Upstash Vector credentials
- Verify index dimensions match (768)
- Check Vercel function timeout settings

## Development

```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint

# Build
npm run build

# Preview production build
npm run preview
```

## Stack

- React 18.3.1
- TypeScript 5.6.2
- Vite 6.0.5
- Hono 4.11.1
- Google Generative AI 0.21.0
- Upstash Vector 1.2.2
- IndexedDB (via idb 8.0.3)
- Tailwind CSS 3.4.17
- shadcn/ui

## License

See LICENSE file.
