import type { RequestCategory, RequestPriority, TriageRequest } from "./types";

export type Classification = { category: RequestCategory; priority: RequestPriority; reason: string };
export interface RequestClassifier { classify(request: TriageRequest): Classification; }

const priorityRules: Array<[RequestPriority, RegExp]> = [
  ["urgent", /\b(flood|fire|injur|broken gate|no access|locked out|security|emergency)\b/i],
  ["high", /\b(pool closed|leak|gate|access|tennis|clubhouse|repair)\b/i],
  ["low", /\b(fyi|newsletter|notice)\b/i]
];

const categoryRules: Array<[RequestCategory, RegExp]> = [
  ["invoice", /\b(invoice|bill|payment due|remittance)\b/i],
  ["vendor", /\b(proposal|quote|vendor|contractor|w-9)\b/i],
  ["facilities", /\b(pool|tennis|clubhouse|light|gate|landscap|repair|leak|broken)\b/i],
  ["access", /\b(access|key|fob|credential|gate code|locked out)\b/i]
];

export class RuleBasedRequestClassifier implements RequestClassifier {
  classify(request: TriageRequest): Classification {
    const text = `${request.fromEmail} ${request.subject} ${request.bodyText}`;
    const priority = priorityRules.find(([, re]) => re.test(text))?.[0] ?? "normal";
    const category = categoryRules.find(([, re]) => re.test(text))?.[0] ?? "other";
    return { category, priority, reason: `Rule-based keyword match selected ${category}/${priority}.` };
  }
}
