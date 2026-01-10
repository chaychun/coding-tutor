/**
 * Generates a short session title from the first user message.
 * Extracts key words and creates a readable summary.
 */
export function generateTitleFromMessage(message: string): string {
  // Strip markdown code blocks
  let cleaned = message.replace(/```[\s\S]*?```/g, "");

  // Strip inline code
  cleaned = cleaned.replace(/`[^`]+`/g, "");

  // Strip markdown links, keeping the text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Strip markdown formatting
  cleaned = cleaned.replace(/[*_~#]/g, "");

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // If empty after cleaning, return default
  if (!cleaned) {
    return "Untitled Session";
  }

  // Take first sentence (up to period, question mark, or exclamation)
  const sentenceMatch = cleaned.match(/^[^.!?]+[.!?]?/);
  const sentence = sentenceMatch ? sentenceMatch[0].trim() : cleaned;

  // If short enough, use it directly
  if (sentence.length <= 40) {
    return capitalizeFirstLetter(sentence);
  }

  // Otherwise, take first 6-8 words and truncate
  const words = sentence.split(" ");
  const maxWords = 6;
  const truncated = words.slice(0, maxWords).join(" ");

  // Truncate to 40 chars if still too long, preferring word boundaries
  if (truncated.length <= 40) {
    return capitalizeFirstLetter(truncated);
  }

  // Find last space within first 37 chars to avoid cutting words
  const lastSpace = truncated.slice(0, 37).lastIndexOf(" ");
  const safeSlice = lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated.slice(0, 37);
  return capitalizeFirstLetter(safeSlice) + "...";
}

function capitalizeFirstLetter(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
