import {
  SUPPORTED_EXTENSIONS,
  EXCLUDED_DIRS,
  EXCLUDED_FILES,
  EXCLUDED_PATTERNS,
  MAX_FILE_SIZE,
  MAX_FILE_COUNT,
} from './constants';

export interface FileData {
  path: string;
  content: string;
}

export interface ProcessingResult {
  files: FileData[];
  totalFiles: number;
  filteredCount: number;
  skippedReasons: {
    excludedDirs: number;
    unsupportedExtension: number;
    tooLarge: number;
    binary: number;
    other: number;
  };
}

type SkipReason = 'excludedDirs' | 'unsupportedExtension' | 'tooLarge' | 'excludedFile' | 'excludedPattern' | null;

/**
 * Check if a file should be included based on filtering rules
 * Returns null if file should be included, or the reason it was skipped
 */
function getSkipReason(relativePath: string, size: number): SkipReason {
  // Check file size
  if (size > MAX_FILE_SIZE) {
    return 'tooLarge';
  }

  // Check excluded directories
  const parts = relativePath.split('/');
  for (const dir of EXCLUDED_DIRS) {
    if (parts.includes(dir)) {
      return 'excludedDirs';
    }
  }

  // Check excluded files
  const fileName = parts[parts.length - 1];
  if (EXCLUDED_FILES.includes(fileName)) {
    return 'excludedFile';
  }

  // Check excluded patterns
  for (const pattern of EXCLUDED_PATTERNS) {
    if (pattern.test(relativePath)) {
      return 'excludedPattern';
    }
  }

  // Check extension
  const lastDotIndex = relativePath.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return 'unsupportedExtension'; // No extension
  }
  const ext = relativePath.substring(lastDotIndex).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return 'unsupportedExtension';
  }

  return null; // Include the file
}

/**
 * Process local files from directory picker
 * Filters files based on extension, excluded directories, and file size
 * Returns processing result with files and statistics
 */
export async function processLocalFiles(files: FileList): Promise<ProcessingResult> {
  const fileArray = Array.from(files);
  const totalFiles = fileArray.length;

  if (totalFiles > MAX_FILE_COUNT) {
    throw new Error(`Directory contains too many files (${totalFiles}). Maximum is ${MAX_FILE_COUNT}.`);
  }

  const processed: FileData[] = [];
  const skippedReasons = {
    excludedDirs: 0,
    unsupportedExtension: 0,
    tooLarge: 0,
    binary: 0,
    other: 0,
  };

  for (const file of fileArray) {
    // Get relative path from webkitRelativePath (removes the root directory name)
    const fullPath = file.webkitRelativePath;
    const parts = fullPath.split('/');
    const relativePath = parts.slice(1).join('/');

    // Skip if path is empty (shouldn't happen, but safety check)
    if (!relativePath) {
      skippedReasons.other++;
      continue;
    }

    // Apply filters
    const skipReason = getSkipReason(relativePath, file.size);
    if (skipReason) {
      if (skipReason === 'excludedDirs') {
        skippedReasons.excludedDirs++;
      } else if (skipReason === 'unsupportedExtension' || skipReason === 'excludedFile' || skipReason === 'excludedPattern') {
        skippedReasons.unsupportedExtension++;
      } else if (skipReason === 'tooLarge') {
        skippedReasons.tooLarge++;
      }
      continue;
    }

    try {
      const content = await file.text();

      // Skip binary files (files with null bytes)
      if (content.includes('\0')) {
        skippedReasons.binary++;
        continue;
      }

      processed.push({ path: relativePath, content });
    } catch {
      skippedReasons.other++;
      console.warn(`Failed to read file: ${relativePath}`);
    }
  }

  return {
    files: processed,
    totalFiles,
    filteredCount: processed.length,
    skippedReasons,
  };
}

/**
 * Get the root directory name from selected files
 */
export function getRootDirectoryName(files: FileList): string | null {
  if (files.length === 0) {
    return null;
  }
  const firstPath = files[0].webkitRelativePath;
  const parts = firstPath.split('/');
  return parts[0] || null;
}
