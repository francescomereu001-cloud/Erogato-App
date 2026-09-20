export type DealerScopeRow = {
  year: number;
  dealerLabel: string;
  dealerCode?: string;
  puntoVendita?: string;
  convenzionato?: string;
  agenteCode?: string;
  agente?: string;
  subagenteCode?: string;
  subagente?: string;
};

export type ManagedDealer = {
  id: string;
  label: string;
  managementKey: string;
  identityQuality: 'stable-code' | 'legacy-fallback';
};

export type ManagedDealerScope = {
  dealers: ManagedDealer[];
  dealerIdForRow: (row: DealerScopeRow) => string | null;
  excludedUnassigned: number;
};

const normalized = (value?: string) => (value || '').trim().toLocaleUpperCase('it-IT').replace(/\s+/g, ' ');

/**
 * Management precedence mirrors the imported portfolio fields: AGENTE code/name,
 * then SUBAGENTE code/name for legacy rows. An archive occurrence alone is never
 * sufficient to make a dealer managed in the analysis year.
 */
export function managementKey(row: DealerScopeRow): string | null {
  const agentCode = normalized(row.agenteCode);
  if (agentCode) return `AGENT:${agentCode}`;
  const agent = normalized(row.agente);
  if (agent) return `AGENT_NAME:${agent}`;
  const branchCode = normalized(row.subagenteCode);
  if (branchCode) return `BRANCH:${branchCode}`;
  const branch = normalized(row.subagente);
  if (branch && branch !== 'N/D') return `BRANCH_NAME:${branch}`;
  return null;
}

export function stableDealerId(row: DealerScopeRow): string | null {
  const point = normalized(row.puntoVendita);
  if (point) return `PV:${point}`;
  const agreement = normalized(row.convenzionato);
  if (agreement) return `CONV:${agreement}`;
  const generic = normalized(row.dealerCode);
  return generic ? `DEALER:${generic}` : null;
}

function legacySignature(row: DealerScopeRow) {
  const manager = managementKey(row);
  const label = normalized(row.dealerLabel);
  return manager && label ? `${manager}|LABEL:${label}` : null;
}

/** Builds the current managed universe separately from rows used as history. */
export function buildManagedDealerScope(rows: DealerScopeRow[], analysisYear: number): ManagedDealerScope {
  const currentAssignments = rows.filter(row => row.year === analysisYear && managementKey(row));
  const codedBySignature = new Map<string, Set<string>>();
  for (const row of rows) {
    const signature = legacySignature(row), coded = stableDealerId(row);
    if (!signature || !coded) continue;
    const ids = codedBySignature.get(signature) || new Set<string>();
    ids.add(coded); codedBySignature.set(signature, ids);
  }

  const dealerIdForRow = (row: DealerScopeRow): string | null => {
    const coded = stableDealerId(row);
    if (coded) return coded;
    const signature = legacySignature(row);
    if (!signature) return null;
    const candidates = codedBySignature.get(signature);
    // Reconcile a missing code only when label + management scope has one
    // unambiguous coded identity. Never merge same-name dealers across scopes.
    if (candidates?.size === 1) return [...candidates][0];
    return `LEGACY:${signature}`;
  };

  const managed = new Map<string, ManagedDealer>();
  for (const row of currentAssignments) {
    const id = dealerIdForRow(row), manager = managementKey(row);
    if (!id || !manager) continue;
    const candidate: ManagedDealer = {
      id, label: row.dealerLabel || 'N/D', managementKey: manager,
      identityQuality: stableDealerId(row) ? 'stable-code' : 'legacy-fallback',
    };
    const prior = managed.get(id);
    if (!prior || prior.identityQuality === 'legacy-fallback' && candidate.identityQuality === 'stable-code') managed.set(id, candidate);
  }
  return {
    dealers: [...managed.values()].sort((a, b) => a.id.localeCompare(b.id)),
    dealerIdForRow,
    excludedUnassigned: rows.filter(row => row.year === analysisYear && !managementKey(row)).length,
  };
}
