import * as lancedb from '@lancedb/lancedb';
import { config } from '../config/index.js';

let db = null;

/**
 * Get or initialize the LanceDB connection
 */
async function getDb() {
  if (!db) {
    db = await lancedb.connect(config.vectorsDir);
  }
  return db;
}

/**
 * Get table name for a repo
 */
function getTableName(owner, repo) {
  return `${owner}_${repo}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Check if a repository is indexed
 */
export async function isIndexed(owner, repo) {
  try {
    const database = await getDb();
    const tableName = getTableName(owner, repo);
    const tables = await database.tableNames();
    return tables.includes(tableName);
  } catch {
    return false;
  }
}

/**
 * Store embeddings in LanceDB
 */
export async function storeEmbeddings(owner, repo, chunks) {
  const database = await getDb();
  const tableName = getTableName(owner, repo);

  // Prepare data for LanceDB
  const data = chunks.map((chunk) => ({
    id: chunk.id,
    path: chunk.path,
    content: chunk.content,
    chunkIndex: chunk.chunkIndex,
    totalChunks: chunk.totalChunks,
    extension: chunk.extension,
    vector: chunk.vector,
  }));

  // Drop existing table if exists
  const tables = await database.tableNames();
  if (tables.includes(tableName)) {
    await database.dropTable(tableName);
  }

  // Create new table
  await database.createTable(tableName, data);

  console.log(`Stored ${data.length} chunks in table ${tableName}`);
}

/**
 * Search for similar chunks
 */
export async function searchSimilar(owner, repo, queryVector, limit = 20) {
  const database = await getDb();
  const tableName = getTableName(owner, repo);

  const table = await database.openTable(tableName);
  const results = await table
    .vectorSearch(queryVector)
    .limit(limit)
    .toArray();

  return results.map((row) => ({
    id: row.id,
    path: row.path,
    content: row.content,
    chunkIndex: row.chunkIndex,
    totalChunks: row.totalChunks,
    extension: row.extension,
    distance: row._distance,
  }));
}

/**
 * Get all chunks for a repository
 */
export async function getAllChunks(owner, repo) {
  const database = await getDb();
  const tableName = getTableName(owner, repo);

  const table = await database.openTable(tableName);
  const results = await table.query().toArray();

  return results.map((row) => ({
    id: row.id,
    path: row.path,
    content: row.content,
    chunkIndex: row.chunkIndex,
    totalChunks: row.totalChunks,
    extension: row.extension,
  }));
}

/**
 * Get chunk count for a repository
 */
export async function getChunkCount(owner, repo) {
  const database = await getDb();
  const tableName = getTableName(owner, repo);

  try {
    const table = await database.openTable(tableName);
    const count = await table.countRows();
    return count;
  } catch {
    return 0;
  }
}
