# cloude-ai-rag

Simple Retrieval-Augmented Generation (RAG) example using Anthropic/Claude.

## Files

- `rag-claude.js`: A minimal RAG example that builds an in-memory embedding index from `./docs` (or sample texts) and queries Claude via the REST API.

## Prerequisites

- Node.js 18+ (for built-in `fetch`) or run with a fetch polyfill
- An Anthropic API key in the `ANTHROPIC_API_KEY` environment variable

## Setup

Install any dependencies (none required for the example if using Node 18+):

```bash
# Optional if you need a fetch polyfill on older Node versions
# npm install node-fetch
```

If you want PDF support (recommended to index `.pdf` files placed in `docs/`), install `pdf-parse`:

```bash
npm install pdf-parse
```

## Running

Run a single question (Windows example):

```powershell
set ANTHROPIC_API_KEY=your_key_here
node rag-claude.js "What is retrieval-augmented generation?"
```

Start an interactive prompt:

```powershell
set ANTHROPIC_API_KEY=your_key_here
node rag-claude.js --ask
```

Build the in-memory index only:

```powershell
set ANTHROPIC_API_KEY=your_key_here
node rag-claude.js --build
```

## Notes

- Place text files into a `docs` directory at the repository root to index your own documents. If no `docs` folder is found the script uses small sample texts.
- The example uses the Anthropic REST endpoints `https://api.anthropic.com/v1/embeddings` and `https://api.anthropic.com/v1/complete`. Adjust model names via `CLAUDE_EMBEDDING_MODEL` and `CLAUDE_CHAT_MODEL` environment variables.
- For production, persist embeddings in a vector DB (Pinecone, Weaviate, etc.) and add batching, retries, and rate-limit handling.

