import { join } from 'path';
import { writeFile } from 'fs/promises';
import { config } from '../config/index.js';
import { processRepository } from './repository.js';
import { storeEmbeddings } from './vectorStore.js';
import { embedBatch } from '../providers/embeddings.js';

/**
 * Split text into words
 */
function splitIntoWords(text) {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Chunk a document into overlapping pieces
 */
function chunkDocument(doc) {
  const words = splitIntoWords(doc.content);
  const chunks = [];

  if (words.length <= config.chunkSize) {
    // Document is smaller than chunk size, keep as single chunk
    chunks.push({
      id: `${doc.path}#0`,
      path: doc.path,
      content: doc.content,
      chunkIndex: 0,
      totalChunks: 1,
      extension: doc.extension,
    });
  } else {
    // Split into overlapping chunks
    let start = 0;
    let chunkIndex = 0;

    while (start < words.length) {
      const end = Math.min(start + config.chunkSize, words.length);
      const chunkWords = words.slice(start, end);
      const chunkContent = chunkWords.join(' ');

      chunks.push({
        id: `${doc.path}#${chunkIndex}`,
        path: doc.path,
        content: chunkContent,
        chunkIndex,
        totalChunks: -1, // Will be updated after
        extension: doc.extension,
      });

      chunkIndex++;
      start += config.chunkSize - config.chunkOverlap;

      // Prevent infinite loop
      if (start >= words.length - config.chunkOverlap && end === words.length) {
        break;
      }
    }

    // Update total chunks
    for (const chunk of chunks) {
      chunk.totalChunks = chunks.length;
    }
  }

  return chunks;
}

/**
 * Index a repository
 */
export async function indexRepository(url, apiKey) {
  console.log(`Indexing repository: ${url}`);

  // Clone and read files
  const { owner, repo, files } = await processRepository(url);

  console.log(`Found ${files.length} files to index`);

  // Chunk all documents
  const allChunks = [];
  for (const file of files) {
    const chunks = chunkDocument(file);
    allChunks.push(...chunks);
  }

  console.log(`Created ${allChunks.length} chunks`);

  // Embed all chunks in batches
  const texts = allChunks.map((chunk) => chunk.content);
  const embeddings = await embedBatch(texts, apiKey);

  // Attach embeddings to chunks
  for (let i = 0; i < allChunks.length; i++) {
    allChunks[i].vector = embeddings[i];
  }

  // Store in vector database
  await storeEmbeddings(owner, repo, allChunks);

  // Save metadata
  const metadata = {
    owner,
    repo,
    url,
    indexedAt: new Date().toISOString(),
    fileCount: files.length,
    chunkCount: allChunks.length,
  };

  const metaPath = join(config.metaDir, `${owner}_${repo}.json`);
  await writeFile(metaPath, JSON.stringify(metadata, null, 2));

  console.log(`Indexing complete for ${owner}/${repo}`);

  return metadata;
}
