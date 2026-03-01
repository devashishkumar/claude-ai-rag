// index.ts
import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import crypto from "crypto";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

// Initialize Claude client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// -------- STEP 1: Load a single file (PDF, TXT, DOCX) --------
async function loadFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  } else if (ext === ".txt") {
    return fs.readFileSync(filePath, "utf-8");
  } else if (ext === ".docx") {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else {
    return ""; // skip unsupported files
  }
}

// -------- STEP 2: Load all files from 'docs' folder --------
async function loadDocsFolder(folderPath: string): Promise<string> {
  const files = fs.readdirSync(folderPath);
  let allText = "";

  for (const file of files) {
    const fullPath = path.join(folderPath, file);
    const stats = fs.statSync(fullPath);
    if (stats.isFile()) {
      const content = await loadFile(fullPath);
      allText += content + "\n\n"; // separate files
    }
  }

  return allText;
}

// -------- CACHE UTILITIES --------
const cachePath = path.resolve(__dirname, "cache.json");
let responseCache: Record<string, string> | null = null;

function loadCache(): Record<string, string> {
  if (responseCache !== null) return responseCache;
  try {
    if (fs.existsSync(cachePath)) {
      const raw = fs.readFileSync(cachePath, "utf-8");
      responseCache = JSON.parse(raw);
    } else {
      responseCache = {};
    }
  } catch (e) {
    console.warn("Failed to load cache, starting fresh", e);
    responseCache = {};
  }
  return responseCache!;
}

function saveCache(): void {
  try {
    fs.writeFileSync(cachePath, JSON.stringify(responseCache, null, 2), "utf-8");
  } catch (e) {
    console.warn("Failed to save cache", e);
  }
}

// -------- STEP 3: Chunk text --------
function chunkText(text: string, chunkSize = 1000): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

// -------- STEP 4: Simple keyword retrieval --------
function simpleSearch(chunks: string[], query: string): string[] {
  return chunks
    .map((chunk) => ({
      chunk,
      score: query
        .toLowerCase()
        .split(" ")
        .filter((word) => chunk.toLowerCase().includes(word)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((result) => result.chunk);
}

// -------- STEP 5: Ask Claude --------
async function askClaude(contextChunks: string[], question: string): Promise<string> {
  const context = contextChunks.join("\n\n");
  const cache = loadCache();

  const key = crypto
    .createHash("sha256")
    .update(question + "||" + context)
    .digest("hex");

  if (cache[key]) {
    console.log("Cache hit for question. Returning cached answer.");
    return cache[key];
  }

  const response: any = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `
You are a helpful assistant.

Use the following context to answer the question.

Context:
${context}

Question:
${question}

If the answer is not in the context, say you don't know.
        `,
      },
    ],
  });

  const answer = response.content[0].text;
  cache[key] = answer;
  saveCache();
  return answer;
}

// -------- MAIN --------
async function main() {
  try {
    const folderPath = "./docs"; // folder containing PDF, TXT, and DOCX files

    const args = process.argv.slice(2);
    let question = "What are these documents about?"; // default question
    if (args.length > 0) {
      question = args.join(" ");
    }

    const allText = await loadDocsFolder(folderPath);
    console.log(`Loaded all files from ${folderPath}, total length:`, allText.length);

    const chunks = chunkText(allText);

    const relevantChunks = simpleSearch(chunks, question);
    const answer = await askClaude(relevantChunks, question);

    console.log("Answer:\n", answer);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();