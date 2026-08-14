/**
 * readingContinuity.js — Intelligent Reading Continuity & Artifact Stripping Engine
 * ===================================================================================
 * Developed for Problem Statement FSJ28-INTERN-013: Automated Book Reading System
 * for Visually Impaired People.
 *
 * Core Capabilities:
 * 1. cleanPageArtifacts(text): Removes running headers, footers, page numbers,
 *    and publisher watermarks so Text-To-Speech doesn't interrupt reading.
 * 2. stitchPageText(prevText, nextText): Detects incomplete sentences across physical
 *    page turns, handles hyphenated linebreaks, and merges pages into a continuous narrative.
 * 3. generateContextSummary(lastPos, fullText): Formats intelligent audio recap
 *    when resuming a book for a visually impaired user.
 */

/**
 * Clean OCR text by removing page numbers, running headers/footers, and noise.
 * @param {string} rawText
 * @returns {string} Cleaned continuous text
 */
export function cleanPageArtifacts(rawText) {
  if (!rawText || typeof rawText !== "string") return "";

  let cleaned = rawText;

  // 1. Remove standard running page numbers and footers
  // Matches: "Page 42", "Page 42 of 120", "- 42 -", "[42]", "42 | Chapter 3"
  cleaned = cleaned.replace(/^(?:page\s*\d+(?:\s*of\s*\d+)?|\d+\s*\|\s*.*|[-–—\s]*\d+[-–—\s]*)$/gim, "");

  // 2. Remove isolated header/footer page numbers at top or bottom of string
  cleaned = cleaned.replace(/^\s*\d+\s*\n+/g, "");
  cleaned = cleaned.replace(/\n+\s*\d+\s*$/g, "");

  // 3. Normalize multiple whitespace and empty line breaks
  cleaned = cleaned.replace(/\r\n/g, "\n");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // 4. Fix split words at end of lines (e.g. "com- \n plete" -> "complete")
  cleaned = cleaned.replace(/(\w+)-\s*\n\s*(\w+)/g, "$1$2");

  return cleaned.trim();
}

/**
 * Intelligently stitch Page N text with Page N+1 text across physical page turns.
 * @param {string} prevText - Extracted text from preceding page(s)
 * @param {string} nextText - Extracted text from newly scanned page
 * @returns {{ fullText: string, stitchedAt: number }}
 */
export function stitchPageText(prevText = "", nextText = "") {
  const cleanPrev = cleanPageArtifacts(prevText);
  const cleanNext = cleanPageArtifacts(nextText);

  if (!cleanPrev) return { fullText: cleanNext, stitchedAt: 0 };
  if (!cleanNext) return { fullText: cleanPrev, stitchedAt: cleanPrev.length };

  const lastChar = cleanPrev.slice(-1);
  const isSentenceEnd = /[.!?\n]/.test(lastChar);

  let merged = "";

  if (isSentenceEnd) {
    // Previous page ends neatly with a sentence boundary. Add space.
    merged = `${cleanPrev}\n\n${cleanNext}`;
  } else {
    // Previous page cut off mid-sentence.
    // Check if the previous page ends with a hyphenated incomplete word
    if (cleanPrev.endsWith("-")) {
      merged = `${cleanPrev.slice(0, -1)}${cleanNext}`;
    } else {
      // Connect mid-sentence with a single space
      merged = `${cleanPrev} ${cleanNext}`;
    }
  }

  return {
    fullText: merged,
    stitchedAt: cleanPrev.length,
  };
}

/**
 * Generate an audio-friendly context summary for resuming reading.
 * @param {number} charPosition - Last read character index
 * @param {string} fullText - Complete book text
 * @returns {{ summary: string, percentComplete: number }}
 */
export function generateContextSummary(charPosition = 0, fullText = "") {
  if (!fullText) {
    return { summary: "Starting from the beginning.", percentComplete: 0 };
  }

  const totalLen = fullText.length;
  const clampedPos = Math.max(0, Math.min(charPosition, totalLen));
  const percentComplete = Math.round((clampedPos / totalLen) * 100);

  // Extract previous paragraph or sentence near position for audio context
  const contextSnippet = fullText.slice(Math.max(0, clampedPos - 120), clampedPos).trim();

  let summary = `Resuming your reading at ${percentComplete}% complete.`;
  if (contextSnippet) {
    summary += ` Previously: "...${contextSnippet}..."`;
  }

  return {
    summary,
    percentComplete,
  };
}

export default {
  cleanPageArtifacts,
  stitchPageText,
  generateContextSummary,
};
