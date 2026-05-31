import type { AuditEntry } from "@/domain/types";

export interface AuditSink { append(entry: AuditEntry): Promise<void>; }

export class InMemoryAuditSink implements AuditSink {
  public entries: AuditEntry[] = [];
  async append(entry: AuditEntry): Promise<void> { this.entries.push(entry); }
}
