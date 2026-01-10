import * as fs from "fs/promises";
import * as path from "path";

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

// Write JSON file with directory creation
export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
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
