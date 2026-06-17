import type { RequestActionNeeded, RequestCategory, RequestPriority } from "./types";

export type CategorizationRuleKind = "priority" | "category";

export type CategorizationRule = {
  id?: string;
  kind: CategorizationRuleKind;
  label: string;
  pattern: string;
  category?: RequestCategory | null;
  priority?: RequestPriority | null;
  actionNeeded?: RequestActionNeeded | null;
  isActive: boolean;
  notes: string;
};

export const requestCategoryOptions: RequestCategory[] = ["access", "facilities", "vendor", "invoice", "other"];
export const requestPriorityOptions: RequestPriority[] = ["urgent", "high", "normal", "low"];
export const requestStatusOptions = ["new", "in_progress", "done"] as const;
export const requestActionOptions: RequestActionNeeded[] = ["emergency_response", "access_follow_up", "facility_repair", "vendor_follow_up", "invoice_review", "board_review"];

export const actionByCategory: Record<RequestCategory, RequestActionNeeded> = {
  access: "access_follow_up",
  facilities: "facility_repair",
  vendor: "vendor_follow_up",
  invoice: "invoice_review",
  other: "board_review"
};

export const defaultCategorizationRules: CategorizationRule[] = [
  { kind: "priority", label: "Urgent safety/access emergency", pattern: "flood|fire|injur|broken gate|no access|locked out|security|emergency", priority: "urgent", actionNeeded: "emergency_response", isActive: true, notes: "Moves emergencies to the top of the queue." },
  { kind: "priority", label: "High operational issue", pattern: "pool closed|leak|gate|access|tennis|clubhouse|repair", priority: "high", isActive: true, notes: "Important operating issues that should be reviewed quickly." },
  { kind: "priority", label: "Low informational message", pattern: "fyi|newsletter|notice", priority: "low", isActive: true, notes: "Informational messages can be handled after active requests." },
  { kind: "category", label: "Invoice and billing", pattern: "invoice|bill|payment due|remittance", category: "invoice", actionNeeded: "invoice_review", isActive: true, notes: "Routes payment documents to invoice review." },
  { kind: "category", label: "Vendor communication", pattern: "proposal|quote|vendor|contractor|w-9", category: "vendor", actionNeeded: "vendor_follow_up", isActive: true, notes: "Routes vendor paperwork and proposals." },
  { kind: "category", label: "Facility repair", pattern: "pool|tennis|clubhouse|light|gate|landscap|repair|leak|broken", category: "facilities", actionNeeded: "facility_repair", isActive: true, notes: "Routes common amenity and repair issues." },
  { kind: "category", label: "Access credentials", pattern: "access|key|fob|credential|gate code|locked out", category: "access", actionNeeded: "access_follow_up", isActive: true, notes: "Routes resident access and credential issues." }
];

export function safeRegex(pattern: string) {
  return new RegExp(`\\b(${pattern})\\b`, "i");
}

export function validateRuleInput(input: Pick<CategorizationRule, "kind" | "label" | "pattern" | "category" | "priority" | "actionNeeded">) {
  const label = input.label.trim();
  const pattern = input.pattern.trim();
  if (!label) throw new Error("Rule label is required.");
  if (!pattern) throw new Error("Keyword pattern is required.");
  safeRegex(pattern);
  if (input.kind === "category" && !input.category) throw new Error("Category rules must choose a category.");
  if (input.kind === "priority" && !input.priority) throw new Error("Priority rules must choose a priority.");
}
