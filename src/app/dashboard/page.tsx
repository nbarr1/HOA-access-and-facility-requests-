import { Badge } from "@/components/Badge";
import { Nav } from "@/components/Nav";
import { demoRequests, demoResidents } from "@/db/demo-data";

export default function DashboardPage() {
  const pendingRequests = demoRequests.filter((r) => r.status !== "done");
  const needsAction = demoResidents.filter((r) => r.accessStatus === "pending" || r.accessStatus === "hold");
  return <><Nav /><main><section className="hero"><div><h1>Board transparency dashboard</h1><p>Central view of dues, access, human tasks, request priority, and audit-first decisions.</p></div></section><section className="grid"><div className="card"><h2>{demoResidents.length}</h2><p>Residents tracked</p></div><div className="card"><h2>{needsAction.length}</h2><p>Pending/held access decisions</p></div><div className="card"><h2>{pendingRequests.length}</h2><p>Open requests</p></div></section><h2>Resident registry</h2><table className="table"><thead><tr><th>Name</th><th>Unit</th><th>Dues</th><th>Access</th><th>Last synced</th></tr></thead><tbody>{demoResidents.map((resident) => <tr key={resident.id}><td>{resident.name}<br /><small>{resident.email}</small></td><td>{resident.unitAddress}</td><td><Badge value={resident.duesStatus} /></td><td><Badge value={resident.accessStatus} /></td><td>{resident.lastSyncedAt ?? "Never"}</td></tr>)}</tbody></table><h2>Pending human-in-the-loop cards</h2><div className="card"><strong>Revoke pool/tennis/clubhouse access for Sam Rivera</strong><p>Dues lapsed. Perform the step in AirAllow/Allow Enclave, then mark done with your board account.</p></div></main></>;
}
