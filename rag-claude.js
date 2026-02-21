const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse"); // pdf-parse@1.1.1
const mammoth = require("mammoth"); // used for .docx text extraction
const Anthropic = require("@anthropic-ai/sdk");
require("dotenv").config();

// Initialize Claude client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// -------- STEP 1: Load a single file (PDF or TXT) --------
async function loadFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  } else if (ext === ".txt") {
    return fs.readFileSync(filePath, "utf-8");
  } else if (ext === ".docx") {
    // use mammoth to extract raw text from DOCX
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else {
    return ""; // skip unsupported files
  }
}

// -------- STEP 2: Load all files from 'docs' folder --------
async function loadDocsFolder(folderPath) {
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

// -------- STEP 3: Chunk text --------
function chunkText(text, chunkSize = 1000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

// -------- STEP 4: Simple keyword retrieval --------
function simpleSearch(chunks, query) {
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
async function askClaude(contextChunks, question) {
  const context = contextChunks.join("\n\n");

  const response = await anthropic.messages.create({
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

  return response.content[0].text;
}

// -------- MAIN --------
async function main() {
  try {
    const folderPath = "./docs"; // folder containing PDF, TXT, and DOCX files

    // Grab the question from CLI arguments
    const args = process.argv.slice(2);
    let question = "What are these documents about?"; // default question
    if (args.length > 0) {
      //   console.error("Please provide a question as a CLI argument.");
      //   console.error("Example: node index.js \"What is this about?\"");
      //   process.exit(1);
      question = args.join(" ");
    }

    const allText = await loadDocsFolder(folderPath);
    console.log(
      `Loaded all files from ${folderPath}, total length:`,
      allText.length,
    );

    const chunks = chunkText(allText);

    const relevantChunks = simpleSearch(chunks, question);
    const answer = await askClaude(relevantChunks, question);

    console.log("Answer:\n", answer);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
