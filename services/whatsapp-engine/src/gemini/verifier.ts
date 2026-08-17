/**
 * Gemini 2.5 Flash Proof-of-Post scorer. Structured output only. The score is a
 * queue-priority SIGNAL, not an approval (production spec §5). Auto-release stays off
 * until there is real false-positive data on WhatsApp-Status screenshots specifically.
 */
export interface PopScore {
  isValid: boolean;
  confidenceScore: number; // 0..1 — sorts the review queue ascending (low first)
  viewCount: number | null;
  isDurationValid: boolean;
  rejectionReason: string | null;
}

export interface PopInput {
  imageUrl: string;
  brief: string;
  expectedHandle: string;
}

export async function scoreProofOfPost(_input: PopInput): Promise<PopScore> {
  // TODO: call the Google GenAI SDK with a responseSchema matching PopScore.
  // OCR the screenshot, match timestamp + handle + brief, return the structured score.
  // Placeholder keeps the service type-safe until the model call is wired.
  return { isValid: false, confidenceScore: 0, viewCount: null, isDurationValid: false, rejectionReason: 'not_implemented' };
}
