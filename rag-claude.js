const fs = require('fs');
const path = require('path');
require('dotenv').config();

// pdf extraction (optional). Install with `npm install pdf-parse` if you want PDF support.
let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  // pdf-parse not installed — PDF files will be skipped with a warning.
}

// Simple RAG implementation using Anthropic / Claude via REST API
// Requirements: set ANTHROPIC_API_KEY environment variable and run on Node 18+ (global fetch available)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('Warning: Missing ANTHROPIC_API_KEY environment variable. Requests will fail without it.');
}

// Configuration — model names can be changed to match your Claude plan
const CHAT_MODEL = process.env.CLAUDE_CHAT_MODEL || 'claude-2.1';
const EMBEDDING_MODEL_PREFERRED = process.env.CLAUDE_EMBEDDING_MODEL || '';
const EMBEDDING_MODEL_CANDIDATES = Array.from(new Set([
  EMBEDDING_MODEL_PREFERRED,
  'claude-embedding-3-small',
  'claude-embedding-3-large',
  'embed-claude-v2',
  'text-embedding-3-small'
].filter(Boolean)));
const TOP_K = 3;

// Utility: cosine similarity
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a) {
  return Math.sqrt(dot(a, a));
}

function cosineSimilarity(a, b) {
  return dot(a, b) / (norm(a) * norm(b) + 1e-12);
}

// Load documents from ./docs (text files and PDFs) if present, otherwise sample docs
async function loadDocuments() {
  const docsDir = path.join(__dirname, 'docs');
  const docs = [];
  if (fs.existsSync(docsDir)) {
    const files = fs.readdirSync(docsDir);
    for (const f of files) {
      const full = path.join(docsDir, f);
      if (fs.statSync(full).isFile()) {
        const ext = path.extname(f).toLowerCase();
        try {
          if (ext === '.pdf') {
            if (!pdfParse) {
              console.warn(`Skipping PDF ${f}: pdf-parse not installed.`);
              continue;
            }
            const data = fs.readFileSync(full);
            const parsed = await pdfParse(data);
            const text = (parsed && parsed.text) ? parsed.text : '';
            docs.push({ id: f, text });
          } else {
            const text = fs.readFileSync(full, 'utf8');
            docs.push({ id: f, text });
          }
        } catch (err) {
          console.warn(`Failed to load ${f}: ${err.message}`);
        }
      }
    }
  }

  if (docs.length === 0) {
    docs.push({ id: 'sample-1', text: "Node.js is a JavaScript runtime built on Chrome's V8 engine." });
    docs.push({ id: 'sample-2', text: 'Retrieval-augmented generation (RAG) combines a vector store with a language model.' });
    docs.push({ id: 'sample-3', text: 'You can store document embeddings and retrieve the most similar documents for a query.' });
  }
  return docs;
}

// Create embedding using Anthropic embeddings API
async function tryEmbeddingWithModel(text, model) {
  const url = 'https://api.anthropic.com/v1/embeddings';
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': ANTHROPIC_API_KEY || '',
  };
  if (ANTHROPIC_API_KEY) headers['Authorization'] = `Bearer ${ANTHROPIC_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, input: text }),
  });
  const bodyText = await res.text();
  let parsed = null;
  try { parsed = bodyText ? JSON.parse(bodyText) : null; } catch (e) { parsed = bodyText; }
  if (!res.ok) {
    const err = new Error(`Embedding request failed for model=${model}: ${res.status} ${bodyText}`);
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  // Normalized response shapes may vary; try to extract embedding
  const embedding = parsed && (parsed.data?.[0]?.embedding || parsed.embedding || parsed[0]?.embedding);
  if (!embedding) {
    const err = new Error(`Embedding response missing embedding for model=${model}`);
    err.body = parsed;
    throw err;
  }
  return { embedding, model };
}

async function embed(text) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  const errors = [];
  for (const model of EMBEDDING_MODEL_CANDIDATES) {
    try {
      const result = await tryEmbeddingWithModel(text, model);
      if (model !== EMBEDDING_MODEL_PREFERRED && EMBEDDING_MODEL_PREFERRED) {
        console.warn(`Preferred embedding model '${EMBEDDING_MODEL_PREFERRED}' failed. Falling back to '${result.model}'.`);
      }
      // update chosen model for informational purposes
      return result.embedding;
    } catch (err) {
      errors.push({ model, status: err.status || 'N/A', body: err.body || err.message });
      // continue trying next candidate
    }
  }
  // If we get here, all candidates failed
  const msg = `All embedding model attempts failed. Tried: ${EMBEDDING_MODEL_CANDIDATES.join(', ')}. Errors: ${JSON.stringify(errors, null, 2)}`;
  throw new Error(msg);
}

async function buildIndex(docs) {
  const indexed = [];
  for (const d of docs) {
    const e = await embed(d.text);
    indexed.push({ id: d.id, text: d.text, embedding: e });
    console.log(`Indexed: ${d.id}`);
  }
  return indexed;
}

function search(index, queryEmbedding, topK = TOP_K) {
  const scored = index.map(item => ({
    id: item.id,
    text: item.text,
    score: cosineSimilarity(queryEmbedding, item.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

// Ask Claude using the completions endpoint
async function askClaude(prompt, maxTokens = 800) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  const body = {
    model: CHAT_MODEL,
    prompt: prompt,
    max_tokens_to_sample: maxTokens,
    temperature: 0.0,
  };
  const res = await fetch('https://api.anthropic.com/v1/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Claude request failed: ${res.status} ${t}`);
  }
  const j = await res.json();
  return j.completion || j.output || j.text || '';
}

async function answerQuery(index, query) {
  const qEmb = await embed(query);
  const hits = search(index, qEmb, TOP_K);

  const context = hits.map((h, i) => `Source ${i + 1} (id=${h.id} | score=${h.score.toFixed(4)}):\n${h.text}`).join('\n\n');

  const prompt = `\n\nHuman: Use the following context to answer the question. If the answer is not in the context, say you don't know.\n\nContext:\n${context}\n\nQuestion:\n${query}\n\nAssistant:`;

  const answer = await askClaude(prompt);
  return { answer, hits };
}

async function main() {
  const args = process.argv.slice(2);
  const docs = await loadDocuments();

  console.log(`Loaded ${docs.length} documents.`);

  const index = await buildIndex(docs);

  if (args.includes('--build')) {
    console.log('Index built in-memory. Run with `node rag-claude.js "your question"` to ask.');
    return;
  }

  if (args.length > 0 && !args.includes('--ask')) {
    const query = args.join(' ');
    const { answer, hits } = await answerQuery(index, query);
    console.log('\n=== Answer ===\n');
    console.log(answer || 'No answer returned.');
    console.log('\n=== Sources ===\n');
    hits.forEach(h => console.log(`${h.id} (score=${h.score.toFixed(4)})`));
    return;
  }

  if (args.includes('--ask')) {
    const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    readline.question('Question: ', async (q) => {
      const { answer, hits } = await answerQuery(index, q);
      console.log('\n=== Answer ===\n');
      console.log(answer || 'No answer returned.');
      console.log('\n=== Sources ===\n');
      hits.forEach(h => console.log(`${h.id} (score=${h.score.toFixed(4)})`));
      readline.close();
    });
    return;
  }

  console.log('Usage:');
  console.log('  set ANTHROPIC_API_KEY=your_key_here');
  console.log('  node rag-claude.js "your question"');
  console.log('  node rag-claude.js --ask');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err.message || err);
    process.exit(1);
  });
}

module.exports = { loadDocuments, buildIndex, answerQuery };