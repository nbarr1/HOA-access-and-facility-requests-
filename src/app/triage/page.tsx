import { Badge } from "@/components/Badge";
import { Nav } from "@/components/Nav";
import { demoRequests } from "@/db/demo-data";

const weight = { urgent: 0, high: 1, normal: 2, low: 3 } as const;

export default function TriagePage() {
  const sorted = [...demoRequests].sort((a, b) => weight[a.priority] - weight[b.priority]);
  return <><Nav /><main><h1>Request triage queue</h1><p>Inbound HOA email is parsed into structured request records and sorted so urgent access/facility issues surface first.</p><table className="table"><thead><tr><th>Priority</th><th>Category</th><th>Subject</th><th>From</th><th>Status</th></tr></thead><tbody>{sorted.map((request) => <tr key={request.id}><td><Badge value={request.priority} /></td><td>{request.category}</td><td>{request.subject}</td><td>{request.from_email}</td><td><Badge value={request.status} /></td></tr>)}</tbody></table></main></>;
}
