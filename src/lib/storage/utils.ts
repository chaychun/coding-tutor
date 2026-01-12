import * as fs from "fs/promises";
import * as path from "path";

// Simple file lock implementation to prevent concurrent writes
const fileLocks = new Map<string, Promise<void>>();

async function acquireLock(filePath: string): Promise<() => void> {
  // Wait for any existing lock on this file
  while (fileLocks.has(filePath)) {
    await fileLocks.get(filePath);
  }

  // Create a new lock
  let releaseLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  fileLocks.set(filePath, lockPromise);

  return () => {
    fileLocks.delete(filePath);
    releaseLock!();
  };
}

// Get the data path from environment or use default
export function getDataPath(): string {
  // In development, use .dev-data in the project root
  if (process.env.NODE_ENV === "development") {
    return path.join(process.cwd(), ".dev-data");
  }

  // In production, prefer DATA_PATH env var
  if (process.env.DATA_PATH) {
    return process.env.DATA_PATH;
  }

  // Fall back to home directory (HOME should always be set on Unix systems)
  const homeDir = process.env.HOME;
  if (!homeDir) {
    throw new Error("DATA_PATH environment variable is required when HOME is not set");
  }
  return path.join(homeDir, "coding-tutor-data");
}

// Ensure a directory exists
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

// Read JSON file with error handling
export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as T;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

// Atomic read-modify-write operation with file locking
export async function updateJsonFile<T>(
  filePath: string,
  updater: (current: T | null) => T | null
): Promise<T | null> {
  const release = await acquireLock(filePath);
  try {
    const current = await readJsonFile<T>(filePath);
    const updated = updater(current);
    if (updated !== null) {
      await ensureDir(path.dirname(filePath));
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      await fs.writeFile(tempPath, JSON.stringify(updated, null, 2), "utf-8");
      await fs.rename(tempPath, filePath);
    }
    return updated;
  } finally {
    release();
  }
}

// Write JSON file with directory creation and atomic write
export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  const release = await acquireLock(filePath);
  try {
    await ensureDir(path.dirname(filePath));
    // Write to temp file first, then rename for atomic operation
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf-8");
    await fs.rename(tempPath, filePath);
  } finally {
    release();
  }
}

// List directories in a directory (filters out files like .DS_Store)
export async function listDirectories(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

// List files in a directory (filters out directories and hidden files)
export async function listFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
      .map((entry) => entry.name);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

// Generate a unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
