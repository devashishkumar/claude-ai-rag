# Claude RAG (Retrieval-Augmented Generation)

A Node.js Retrieval-Augmented Generation (RAG) system that uses Claude (Anthropic) to answer questions based on local documents (`.txt` and `.pdf` files). Built with Anthropic/Claude API and optional OpenAI embeddings fallback.

## Features

- **Document Loading**: Reads `.txt` and `.pdf` files from a `./docs` folder
- **PDF Extraction**: Uses `pdf-parse`, `pdfjs-dist`, or `pdftotext` (fallback) for PDF text extraction
- **Embedding Support**: 
  - Primary: Anthropic Claude embeddings
  - Fallback: OpenAI embeddings (if `OPENAI_API_KEY` is set)
- **Embedding Cache**: Persists embeddings to `.embeddings_cache.json` to avoid repeated API calls
- **RAG Pipeline**: Retrieves relevant documents and generates answers with Claude
- **CLI Interface**: Supports direct questions, interactive mode, and index building

## Prerequisites

- **Node.js 18+** (for built-in `fetch` support)
- **ANTHROPIC_API_KEY**: Required for Claude completion. Get it from [console.anthropic.com](https://console.anthropic.com)
- **OPENAI_API_KEY**: Optional, but recommended for reliable embeddings (fallback provider)

## Installation

```bash
# Install dependencies
npm install

# Install a PDF parser (optional, but recommended for PDF support)
npm install pdf-parse
# OR use pdfjs-dist as an alternative
npm install pdfjs-dist
```

If `pdf-parse` and `pdfjs-dist` are not installed, the script will try to use `pdftotext` (requires it to be available on your system PATH).

## Setup

Create a `.env` file in the project root with your API keys:

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
CLAUDE_CHAT_MODEL=claude-2.1
CLAUDE_EMBEDDING_MODEL=claude-embedding-3-small
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_PROVIDER=auto
TOP_K=3
```

**Environment Variables Explained:**

| Variable | Default | Example | Notes |
|----------|---------|---------|-------|
| `ANTHROPIC_API_KEY` | (required) | `sk-ant-...` | Your Anthropic API key |
| `OPENAI_API_KEY` | (optional) | `sk-...` | If set, used as fallback for embeddings |
| `CLAUDE_CHAT_MODEL` | `claude-2.1` | `claude-2.1` | Model for generating answers |
| `CLAUDE_EMBEDDING_MODEL` | (empty) | `claude-embedding-3-small` | Specific Anthropic embedding model (if your account has access) |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | `text-embedding-3-small` | OpenAI embedding model |
| `EMBEDDING_PROVIDER` | `auto` | `auto`\|`openai`\|`anthropic` | Force provider: `auto` prefers OpenAI if available, else Anthropic; `openai` uses only OpenAI; `anthropic` uses only Anthropic |
| `TOP_K` | `3` | `5` | Number of top documents to retrieve |

## Usage

### 1. Build the Index

First, place your documents in a `./docs` folder:
```
./docs/
  ├── file1.txt
  ├── file2.pdf
  └── ...
```

Then build the embedding index:
```bash
node rag-claude.js --build
```

This will:
- Load all `.txt` and `.pdf` files from `./docs`

### 2. Ask a Question

**Direct question:**
```bash
node rag-claude.js "What does the document say about X?"
```

**Interactive mode:**
```bash
node rag-claude.js --ask
```
Then type your question and press Enter.

**Using npm scripts:**
```bash
npm start "What does the document say about X?"
npm run ask
npm run build-index
```

## Output

The script will:
1. Retrieve the top-K most similar documents to your question
2. Send them as context to Claude
3. Return Claude's answer along with source references and similarity scores

Example output:
```
=== Answer ===
Based on the provided context...

=== Sources ===
file1.txt (score=0.8234)
file2.pdf (score=0.7891)
```

## Troubleshooting

### "No PDF parser available; skipping {pdf_file}"
**Solution**: Install a PDF parser:
```bash
npm install pdf-parse
```
Or if `pdf-parse` fails, try `pdfjs-dist`:
```bash
npm install pdfjs-dist
```
Or ensure `pdftotext` is available on your system PATH.

### "All embedding attempts failed... 404 Not Found"
**Root cause**: The Anthropic embedding models attempted are not available to your account.

**Solutions:**
1. **Use OpenAI embeddings** (recommended if you have an OpenAI key):
   - Set `OPENAI_API_KEY` in `.env`
   - The script will automatically prefer OpenAI when available
   - No code changes needed

2. **Check your Anthropic account**:
   - Set `CLAUDE_EMBEDDING_MODEL` to a model your account can access
   - Or contact Anthropic support to enable the embedding models for your account

3. **Force OpenAI-only embeddings**:
   ```
   EMBEDDING_PROVIDER=openai
   OPENAI_API_KEY=sk-...
   ```

### "ANTHROPIC_API_KEY not set"
**Solution**: Add `ANTHROPIC_API_KEY=sk-ant-...` to your `.env` file.

### Embeddings taking too long
The script caches embeddings in `.embeddings_cache.json`. Delete this file only if you:
- Changed the embedding model
- Want to recompute embeddings (not recommended, as it uses additional API credits)

## Architecture

```
[Documents] → [PDF/Text Extraction] → [Embedding] → [Index]
                                        ↓ (cache)
                                   [Cache File]
                                        ↓
[Question] → [Embedding] → [Search] → [Claude Prompt] → [Answer]
                              ↓
                          [Retrieved Docs]
```

## Key Code Components

- `loadDocuments()`: Loads and extracts text from `.txt` and `.pdf` files
- `tryEmbedding()`: Calls Anthropic embeddings endpoint
- `tryOpenAIEmbedding()`: Calls OpenAI embeddings endpoint (fallback)
- `embedWithFallback()`: Orchestrates embedding with caching and fallback logic
- `buildIndex()`: Computes embeddings for all documents
- `searchIndex()`: Finds top-K similar documents using cosine similarity
- `askClaudeWithContext()`: Sends retrieved documents + question to Claude
- `answerQuery()`: Full RAG pipeline (embed, search, ask)

## Performance Notes

- First run (without cache): ~1–3 seconds per document (depends on document size and API latency)
- Subsequent runs (with cache): ~100ms per question
- Batch embedding operations are serialized; parallel embedding is possible but would increase API quota usage

## License

MIT

## Support

For issues with:
- **Anthropic API**: [console.anthropic.com](https://console.anthropic.com)
- **OpenAI API**: [platform.openai.com](https://platform.openai.com)
- **PDF libraries**: Check `pdf-parse` or `pdfjs-dist` docs
