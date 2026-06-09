import { RuleBasedRequestClassifier, type Classification } from "@/domain/request-classifier";
import type { RequestActionNeeded, RequestCategory, RequestPriority, TriageRequest } from "@/domain/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type FeedbackRow = {
  to_category: RequestCategory;
  to_priority: RequestPriority;
  to_action_needed: RequestActionNeeded;
  tokens: string[];
};

export type LearnedClassification = Classification & {
  confidence: number;
  needsReview: boolean;
  note: string;
};

const stopWords = new Set(["the", "and", "for", "with", "that", "this", "from", "have", "need", "please", "can", "you", "our", "hoa", "unit"]);

export function tokensForRequest(request: Pick<TriageRequest, "fromEmail" | "subject" | "bodyText">) {
  return `${request.fromEmail} ${request.subject} ${request.bodyText}`
    .toLowerCase()
    .match(/[a-z0-9]{3,}/g)
    ?.filter((token) => !stopWords.has(token))
    .slice(0, 80) ?? [];
}

function learnedMatch(tokens: string[], feedbackRows: FeedbackRow[]) {
  const tokenSet = new Set(tokens);
  let best: { row: FeedbackRow; score: number } | null = null;
  for (const row of feedbackRows) {
    const score = row.tokens.reduce((count, token) => count + (tokenSet.has(token) ? 1 : 0), 0);
    if (!best || score > best.score) best = { row, score };
  }
  return best && best.score >= 2 ? best : null;
}

export async function classifyWithLearning(supabase: SupabaseClient, request: TriageRequest): Promise<LearnedClassification> {
  const tokens = tokensForRequest(request);
  const { data, error } = await supabase
    .from("request_classification_feedback")
    .select("to_category,to_priority,to_action_needed,tokens")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const match = learnedMatch(tokens, (data ?? []) as FeedbackRow[]);
  if (match) {
    const confidence = Math.min(0.95, 0.55 + match.score * 0.08);
    return {
      category: match.row.to_category,
      priority: match.row.to_priority,
      actionNeeded: match.row.to_action_needed,
      reason: `Learned from board corrections with ${match.score} matching tokens.`,
      confidence,
      needsReview: confidence < 0.75,
      note: "Machine-learned classification from board feedback."
    };
  }

  const fallback = new RuleBasedRequestClassifier().classify(request);
  const needsReview = fallback.category === "other";
  return {
    ...fallback,
    confidence: needsReview ? 0.35 : 0.85,
    needsReview,
    note: needsReview ? "Could not determine a specific category; marked for board review." : "Rule-based classification."
  };
}
