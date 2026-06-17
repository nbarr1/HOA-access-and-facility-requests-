import { defaultCategorizationRules, type CategorizationRule } from "@/domain/categorization-rules";
import type { RequestActionNeeded, RequestCategory, RequestPriority } from "@/domain/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type RuleRow = {
  id: string;
  kind: "priority" | "category";
  label: string;
  pattern: string;
  category: RequestCategory | null;
  priority: RequestPriority | null;
  action_needed: RequestActionNeeded | null;
  is_active: boolean;
  notes: string | null;
  sort_order: number;
};

function fromRow(row: RuleRow): CategorizationRule {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    pattern: row.pattern,
    category: row.category,
    priority: row.priority,
    actionNeeded: row.action_needed,
    isActive: row.is_active,
    notes: row.notes ?? ""
  };
}

export async function getCategorizationRules(supabase: SupabaseClient, activeOnly = false): Promise<CategorizationRule[]> {
  let query = supabase
    .from("request_categorization_rules")
    .select("id,kind,label,pattern,category,priority,action_needed,is_active,notes,sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return defaultCategorizationRules;
    throw error;
  }
  const rules = ((data ?? []) as RuleRow[]).map(fromRow);
  return rules.length > 0 ? rules : defaultCategorizationRules;
}
