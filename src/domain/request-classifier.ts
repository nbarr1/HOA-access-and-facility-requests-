import { actionByCategory, defaultCategorizationRules, safeRegex, type CategorizationRule } from "./categorization-rules";
import type { RequestActionNeeded, RequestCategory, RequestPriority, TriageRequest } from "./types";

export type Classification = { category: RequestCategory; priority: RequestPriority; actionNeeded: RequestActionNeeded; reason: string };
export interface RequestClassifier { classify(request: TriageRequest): Classification; }

function compileRule(rule: CategorizationRule) {
  return safeRegex(rule.pattern);
}

const accSenderEmails = new Set(["accplantersrow@gmail.com"]);

const accFormMarkers: RegExp[] = [
  /\barchitectural committee\b/i,
  /\bacc request\b/i,
  /\barchitectural request\b/i,
  /\bexterior modification\b/i,
  /\bdesign review\b/i
];

export class RuleBasedRequestClassifier implements RequestClassifier {
  constructor(private readonly rules: CategorizationRule[] = defaultCategorizationRules) {}

  classify(request: TriageRequest): Classification {
    const text = `${request.fromEmail} ${request.subject} ${request.bodyText}`;
    const activeRules = this.rules.filter((rule) => rule.isActive);
    const priorityRule = activeRules.find((rule) => rule.kind === "priority" && rule.priority && compileRule(rule).test(text));
    const categoryRule = activeRules.find((rule) => rule.kind === "category" && rule.category && compileRule(rule).test(text));
    const priority = priorityRule?.priority ?? "normal";
    const category = categoryRule?.category ?? "other";
    const actionNeeded = priority === "urgent" ? "emergency_response" : categoryRule?.actionNeeded ?? actionByCategory[category];
    const reason = `${categoryRule?.label ?? "No category rule"}; ${priorityRule?.label ?? "normal priority"}.`;
    return { category, priority, actionNeeded, reason: `Rule-based keyword match selected ${category}/${priority}; action ${actionNeeded}. ${reason}` };
  }
}

export function isAccFormEmail(request: Pick<TriageRequest, "fromEmail" | "subject" | "bodyText">): boolean {
  const fromEmail = request.fromEmail.trim().toLowerCase();
  if (accSenderEmails.has(fromEmail)) return true;

  const text = `${request.fromEmail} ${request.subject} ${request.bodyText}`;
  return accFormMarkers.some((marker) => marker.test(text));
}
