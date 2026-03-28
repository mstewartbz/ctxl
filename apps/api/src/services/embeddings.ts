// Embedding service - generates vector embeddings for semantic search
// Uses OpenAI text-embedding-3-small for cost-effectiveness

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMS = 1536;

interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<{ embedding: number[]; tokens: number }> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000), // truncate to avoid token limits
      dimensions: EMBEDDING_DIMS,
    }),
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error (${response.status}): ${err}`);
  }
  
  const data: EmbeddingResponse = await response.json();
  
  return {
    embedding: data.data[0].embedding,
    tokens: data.usage.total_tokens,
  };
}

export async function generateEmbeddings(
  texts: string[],
  apiKey: string
): Promise<{ embeddings: number[][]; tokens: number }> {
  const truncated = texts.map(t => t.slice(0, 8000));
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: truncated,
      dimensions: EMBEDDING_DIMS,
    }),
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error (${response.status}): ${err}`);
  }
  
  const data: EmbeddingResponse = await response.json();
  
  return {
    embeddings: data.data.sort((a, b) => a.index - b.index).map(d => d.embedding),
    tokens: data.usage.total_tokens,
  };
}

// Cosine similarity between two vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// Convert float array to blob for D1 storage
export function embeddingToBlob(embedding: number[]): ArrayBuffer {
  const buffer = new ArrayBuffer(embedding.length * 4);
  const view = new Float32Array(buffer);
  for (let i = 0; i < embedding.length; i++) {
    view[i] = embedding[i];
  }
  return buffer;
}

// Convert blob back to float array
export function blobToEmbedding(blob: ArrayBuffer): number[] {
  const view = new Float32Array(blob);
  return Array.from(view);
}

// Estimate tokens in text (rough: ~4 chars per token)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export { EMBEDDING_DIMS };
