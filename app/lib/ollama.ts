import { Ollama } from "ollama";

const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";

export const ollama = new Ollama({ host: ollamaHost });

export async function generateEmbedding(text: string) {
  const response = await ollama.embeddings({
    model: "nomic-embed-text",
    prompt: text,
  })
  return response.embedding;
}