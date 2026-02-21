# Claude RAG (Retrieval-Augmented Generation)

A Node.js Retrieval-Augmented Generation (RAG) system that uses Claude (Anthropic) to answer questions based on local documents. The script loads text from `.pdf` and `.txt` files, performs keyword-based retrieval, and uses Claude to generate context-aware answers.

## Features

- **Multi-Format Document Loading**: Reads `.txt`, `.pdf`, and `.docx` files from a `./docs` folder
- **PDF Extraction**: Uses `pdf-parse` library for reliable PDF text extraction
- **Keyword-Based Retrieval**: Simple but effective search using term matching
- **Claude Integration**: Uses official `@anthropic-ai/sdk` for API calls
- **CLI Arguments**: Pass custom questions via command line (no code editing needed)
- **Response Caching**: Answers are saved to `cache.json` so repeated queries with the same context return instantly without additional API calls
- **Easy Setup**: Minimal configuration required

## Prerequisites

- **Node.js 14+**
- **npm** or **yarn**
- **ANTHROPIC_API_KEY**: Get it from [console.anthropic.com](https://console.anthropic.com)

## Installation

```bash
# Clone or navigate to the project directory
cd cloude-ai-rag

# Install dependencies (includes pdf-parse, mammoth for DOCX, etc.)
npm install
```

## Setup

Create a `.env` file in the project root with your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-your_key_here
```

## Usage

### 1. Prepare Your Documents

Place your documents in a `./docs` folder:

```
./docs/
  ├── document1.txt
  ├── document2.pdf
  ├── document3.docx
  └── ...
```

### 2. Run the Script

> **Caching note:** The script now stores answers in `cache.json` next to the code. If you ask the same question again with unchanged documents, the answer will come from the cache and the API will not be called.

### 2. Run the Script

**With a custom question:**
```bash
node rag-claude.js "What are the main topics in these documents?"
```

**With default question:**
```bash
node rag-claude.js
```
(Runs with default: "What are these documents about?")

The script will:
1. Load all `.txt` and `.pdf` files from the `./docs` folder
2. Search for relevant content based on your question
3. Pass the relevant chunks to Claude
4. Display Claude's answer

### 3. Usage Examples

**Ask about specific topics:**
```bash
node rag-claude.js "What is the document about?"
node rag-claude.js "Summarize the key points"
node rag-claude.js "What are the technical specifications?"
```

**Multi-word questions (no escaping needed):**
```bash
node rag-claude.js What information is in these documents?
node rag-claude.js Explain the main concepts
```

**Run with default question:**
```bash
node rag-claude.js
```

## How It Works

### Text Loading Pipeline

```
[PDF/TXT/DOCX Files] 
      ↓
 [loadFile()]     → Extract text from individual files
      ↓
[loadDocsFolder()] → Combine all file contents
      ↓
[Raw Text]
```

### Retrieval & Generation

```
[Raw Text]
    ↓
[chunkText()] → Split into 1000-char chunks for context
    ↓
[simpleSearch()] → Keyword matching (top-3 chunks)
    ↓
[Retrieved Chunks]
    ↓
[askClaude()] → Send context + question to Claude API
    ↓
[Answer] → Display Claude's response
```

## Key Functions

| Function | Purpose |
|----------|---------|
| `loadCache()` | Read existing cache from `cache.json` |
| `saveCache()` | Persist cache object to disk |
| `chunkText(text, chunkSize)` | Split text into manageable chunks (default: 1000 chars) |
| `simpleSearch(chunks, query)` | Keyword-based retrieval; returns top-3 matching chunks |
| `askClaude(contextChunks, question)` | Call Claude API with context and question; uses cache to avoid repeat calls |
| `main()` | Main entry point |

## Configuration

| Function | Purpose |
|----------|---------|
| `loadFile(filePath)` | Load and extract text from a single PDF, TXT or DOCX file |
| `loadDocsFolder(folderPath)` | Load all documents from the `./docs` folder |
| `chunkText(text, chunkSize)` | Split text into manageable chunks (default: 1000 chars) |
| `simpleSearch(chunks, query)` | Keyword-based retrieval; returns top-3 matching chunks |
| `askClaude(contextChunks, question)` | Call Claude API with context and question |
| `main()` | Main entry point |

## Configuration

### Document Folder

Change the folder path in `main()`:

```javascript
const folderPath = "./docs"; // change this path
```

### Chunk Size

Adjust text chunk size in `main()`:

```javascript
const chunks = chunkText(allText, 500); // 500 characters instead of default 1000
```

### Claude Model

Edit the model selection in `askClaude()` (line 74):

```javascript
model: "claude-3-5-sonnet-20241022", // change this to another Claude model
```

Available Claude models: `claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku`, etc.

### Max Tokens

Change the response length in `askClaude()`:

```javascript
max_tokens: 2000, // increase from 1000
```

## Output Example

```bash
# first run (cache miss)
Loaded all files from ./docs, total length: 45238

Answer:
 Based on the documents, the main topics covered are: ...

# second run (cache hit)
Loaded all files from ./docs, total length: 45238
Cache hit for question. Returning cached answer.
Answer:
 Based on the documents, the main topics covered are: ...
```


```
Loaded all files from ./docs, total length: 45238

Answer:
 Based on the documents, the main topics covered are:
1. Node.js fundamentals and async/await patterns
2. PDF processing and text extraction
3. RAG systems and context-aware AI responses
4. Claude API usage and best practices
```

## Troubleshooting

### "Error: ENOENT: no such file or directory, scandir './docs'"

**Solution**: Create a `./docs` folder in the project root and add `.txt` or `.pdf` files to it.

### "Error: pdf-parse is not a function"

**Solution**: Reinstall dependencies:
```bash
npm install
```

### "Error: 401 Unauthorized" or "Invalid API Key"

**Solution**: Check your `.env` file:
- Ensure `ANTHROPIC_API_KEY=sk-ant-...` is correct
- Make sure there are no extra spaces or quotes
- Verify the key is active on [console.anthropic.com](https://console.anthropic.com)

### "Error: Rate limit exceeded"

**Solution**: Wait a few moments before running the script again. The script makes API calls; respect Anthropic's rate limits.

## Limitations

- **Simple Retrieval**: Uses keyword matching, not semantic/embedding-based search (good for quick prototyping)
- **No Caching**: Re-runs embeddings and API calls each time (consider adding cache for production)
- **Sequential Processing**: Files are loaded and processed one at a time

## Future Enhancements

- [ ] Implement embedding-based retrieval (currently keyword-based)
- [ ] Interactive Q&A mode for multiple questions
- [ ] Embeddings cache persistence

## Dependencies

- `@anthropic-ai/sdk`: Official Anthropic SDK for Claude API calls
- `pdf-parse`: PDF text extraction
- `dotenv`: Load environment variables from `.env`

## License

MIT

## Support

- **Anthropic Docs**: [docs.anthropic.com](https://docs.anthropic.com)
- **API Console**: [console.anthropic.com](https://console.anthropic.com)
- **Node.js SDK**: [github.com/anthropics/anthropic-sdk-js](https://github.com/anthropics/anthropic-sdk-js)
