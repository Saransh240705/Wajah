import type {
  ActionType,
  Agency,
  AskRequest,
  AskResponse,
  Board,
  Dataset,
  Fire,
  Incident,
  IncidentStatus,
  Ledger,
  Reading,
  Scoreboard,
  Station,
  StationSummary,
  Weather,
  WorkOrder,
} from '@wajah/shared';

// Import fixture data
import askFixture from '../../../shared/fixtures/ask.json';
import boardFixture from '../../../shared/fixtures/board.json';
import firesFixture from '../../../shared/fixtures/fires.json';
import incidentsFixture from '../../../shared/fixtures/incidents.json';
import ledgerFixture from '../../../shared/fixtures/ledger.json';
import readingsRohiniFixture from '../../../shared/fixtures/readings-rohini.json';
import scoreboardFixture from '../../../shared/fixtures/scoreboard.json';
import stationsFixture from '../../../shared/fixtures/stations.json';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const AGENT_BASE = process.env.NEXT_PUBLIC_AGENT_URL || API_BASE;
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

// In-memory state for mock mode to support issue -> start -> done -> measure loop
let mockIncidents: Incident[] = JSON.parse(JSON.stringify(incidentsFixture));
let mockBoard: Board = JSON.parse(JSON.stringify(boardFixture));
let mockLedger: Ledger = JSON.parse(JSON.stringify(ledgerFixture));

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson.error?.message) {
        errorMsg = errJson.error.message;
      }
    } catch {
      // use fallback message
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

export async function getStations(dataset: Dataset = 'live'): Promise<StationSummary[]> {
  if (USE_MOCKS) {
    await delay();
    return stationsFixture as StationSummary[];
  }
  return apiFetch<StationSummary[]>(`/stations?dataset=${dataset}`).catch(async () => {
    return stationsFixture as StationSummary[];
  });
}

export async function getStationReadings(
  id: string,
  hours = 48,
  dataset: Dataset = 'live'
): Promise<{ station: Station; readings: Reading[]; weather: Weather[]; incidents: Incident[] }> {
  if (USE_MOCKS) {
    await delay();
    const st = (stationsFixture as StationSummary[]).find((s) => s.id === id) || (stationsFixture[0] as StationSummary);
    return {
      station: st,
      readings: ((readingsRohiniFixture as any).readings ?? []) as Reading[],
      weather: [],
      incidents: mockIncidents.filter((i) => i.stationId === id),
    };
  }

  return apiFetch<{ station: Station; readings: Reading[]; weather: Weather[]; incidents: Incident[] }>(
    `/stations/${id}/readings?hours=${hours}&dataset=${dataset}`
  ).catch(async () => {
    const st = (stationsFixture as StationSummary[]).find((s) => s.id === id) || (stationsFixture[0] as StationSummary);
    return {
      station: st,
      readings: ((readingsRohiniFixture as any).readings ?? []) as Reading[],
      weather: [],
      incidents: mockIncidents.filter((i) => i.stationId === id),
    };
  });
}

export async function getIncidents(params: {
  dataset?: Dataset;
  status?: IncidentStatus;
  stationId?: string;
  limit?: number;
} = {}): Promise<Incident[]> {
  const dataset = params.dataset || 'live';
  if (USE_MOCKS) {
    await delay();
    return mockIncidents.filter((i) => {
      if (params.dataset && i.dataset !== params.dataset) return false;
      if (params.status && i.status !== params.status) return false;
      if (params.stationId && i.stationId !== params.stationId) return false;
      return true;
    });
  }

  const query = new URLSearchParams();
  query.set('dataset', dataset);
  if (params.status) query.set('status', params.status);
  if (params.stationId) query.set('stationId', params.stationId);
  if (params.limit) query.set('limit', String(params.limit));

  return apiFetch<Incident[]>(`/incidents?${query.toString()}`).catch(async () => {
    return mockIncidents;
  });
}

export async function getIncident(id: string): Promise<Incident> {
  if (USE_MOCKS) {
    await delay();
    const found = mockIncidents.find((i) => i.id === id);
    if (!found) throw new Error(`Incident ${id} not found.`);
    return found;
  }

  return apiFetch<Incident>(`/incidents/${id}`).catch(async () => {
    const found = mockIncidents.find((i) => i.id === id);
    if (!found) throw new Error(`Incident ${id} not found.`);
    return found;
  });
}

export async function verifyIncident(id: string): Promise<Incident> {
  if (USE_MOCKS) {
    await delay();
    const found = mockIncidents.find((i) => i.id === id);
    if (!found) throw new Error(`Incident ${id} not found.`);
    found.checks.push({
      date: new Date().toISOString().split('T')[0]!,
      result: 'clean',
      peakPm25: 85,
    });
    return found;
  }

  return apiFetch<Incident>(`/incidents/${id}/verify`, { method: 'POST' });
}

export async function getBoard(dataset: Dataset = 'live'): Promise<Board> {
  if (USE_MOCKS) {
    await delay();
    return mockBoard;
  }

  return apiFetch<Board>(`/board?dataset=${dataset}`).catch(async () => {
    return mockBoard;
  });
}

export async function getLedger(dataset: Dataset = 'live', days = 14): Promise<Ledger> {
  if (USE_MOCKS) {
    await delay();
    return mockLedger;
  }

  return apiFetch<Ledger>(`/ledger?dataset=${dataset}&days=${days}`).catch(async () => {
    return mockLedger;
  });
}

export async function issueWorkOrder(
  incidentId: string,
  body: { actionType?: ActionType; agency?: Agency; demo?: boolean } = {}
): Promise<{ incident: Incident; workOrder: WorkOrder }> {
  if (USE_MOCKS) {
    await delay();
    const inc = mockIncidents.find((i) => i.id === incidentId);
    if (!inc) throw new Error(`Incident ${incidentId} not found.`);

    const woId = `${incidentId}-w${inc.workOrders.length + 1}`;
    const actionType = body.actionType || (inc.topCause === 'dust' ? 'water_sprinkling' : 'anti_burning_patrol');
    const agency = body.agency || (actionType === 'water_sprinkling' ? 'PWD' : 'MCD');
    const now = new Date().toISOString();

    const newWo: WorkOrder = {
      id: woId,
      incidentId,
      stationId: inc.stationId,
      area: inc.area,
      actionType,
      agency,
      status: 'issued',
      reason: `${inc.topCause} is the likely cause.`,
      instructionsEn: `Sprinkle the main roads within about 1 km of the ${inc.area} monitoring station. Tap Mark started and Mark done on the field page, and add one photo.`,
      instructionsHi: `${inc.area} निगरानी स्टेशन के लगभग 1 किमी के दायरे की मुख्य सड़कों पर छिड़काव करें। ज़िम्मेदारी: ${agency}।`,
      escalationLevel: inc.escalationLevel,
      issuedAt: now,
      demo: true,
    };

    inc.workOrders.push(newWo);
    inc.status = 'dispatched';

    // update board item
    const bItem = mockBoard.items.find((item) => item.incident.id === incidentId);
    if (bItem) {
      bItem.incident.status = 'dispatched';
      bItem.incident.workOrders = [...inc.workOrders];
    }

    return { incident: inc, workOrder: newWo };
  }

  return apiFetch<{ incident: Incident; workOrder: WorkOrder }>(`/incidents/${incidentId}/work-orders`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getWorkOrder(id: string): Promise<{ workOrder: WorkOrder; incident: Incident }> {
  if (USE_MOCKS) {
    await delay();
    for (const inc of mockIncidents) {
      const wo = inc.workOrders.find((w) => w.id === id);
      if (wo) return { workOrder: wo, incident: inc };
    }
    throw new Error(`Work order ${id} not found.`);
  }

  return apiFetch<{ workOrder: WorkOrder; incident: Incident }>(`/work-orders/${id}`).catch(async () => {
    for (const inc of mockIncidents) {
      const wo = inc.workOrders.find((w) => w.id === id);
      if (wo) return { workOrder: wo, incident: inc };
    }
    throw new Error(`Work order ${id} not found.`);
  });
}

export async function startWorkOrder(id: string): Promise<WorkOrder> {
  if (USE_MOCKS) {
    await delay();
    for (const inc of mockIncidents) {
      const wo = inc.workOrders.find((w) => w.id === id);
      if (wo) {
        wo.status = 'in_progress';
        wo.startedAt = new Date().toISOString();
        return wo;
      }
    }
    throw new Error(`Work order ${id} not found.`);
  }

  return apiFetch<WorkOrder>(`/work-orders/${id}/start`, { method: 'POST' });
}

export async function finishWorkOrder(id: string, body?: { photoKey?: string }): Promise<WorkOrder> {
  if (USE_MOCKS) {
    await delay();
    for (const inc of mockIncidents) {
      const wo = inc.workOrders.find((w) => w.id === id);
      if (wo) {
        wo.status = 'done';
        wo.doneAt = new Date().toISOString();
        if (body?.photoKey) {
          wo.photo = {
            key: body.photoKey,
            result: 'pass',
            note: 'Pass. A water tanker is spraying a road.',
          };
        }
        return wo;
      }
    }
    throw new Error(`Work order ${id} not found.`);
  }

  return apiFetch<WorkOrder>(`/work-orders/${id}/done`, {
    method: 'POST',
    body: JSON.stringify(body || {}),
  });
}

export async function getPhotoUploadUrl(id: string): Promise<{ uploadUrl: string; key: string }> {
  if (USE_MOCKS) {
    await delay();
    return {
      uploadUrl: '#',
      key: `photos/${id}.jpg`,
    };
  }

  return apiFetch<{ uploadUrl: string; key: string }>(`/work-orders/${id}/photo-url`, { method: 'POST' }).catch(
    async () => {
      return { uploadUrl: '#', key: `photos/${id}.jpg` };
    }
  );
}

export async function measureWorkOrder(id: string): Promise<WorkOrder> {
  if (USE_MOCKS) {
    await delay();
    for (const inc of mockIncidents) {
      const wo = inc.workOrders.find((w) => w.id === id);
      if (wo) {
        const isSecond = inc.workOrders.length > 1;
        wo.effect = isSecond
          ? {
              pollutant: 'pm10',
              beforeMean: 410,
              afterMean: 360,
              changePct: -12,
              expectedChangePct: -10,
              cityChangePct: -8,
              netChangePct: -2,
              verdict: 'no_effect',
              measuredAt: new Date().toISOString(),
            }
          : {
              pollutant: 'pm10',
              beforeMean: 430,
              afterMean: 290,
              changePct: -33,
              expectedChangePct: -10,
              cityChangePct: -5,
              netChangePct: -23,
              verdict: 'worked',
              measuredAt: new Date().toISOString(),
            };

        if (wo.effect.verdict === 'no_effect') {
          inc.status = 'recurred';
        }
        return wo;
      }
    }
    throw new Error(`Work order ${id} not found.`);
  }

  return apiFetch<WorkOrder>(`/work-orders/${id}/measure`, { method: 'POST' });
}

export async function getScoreboard(dataset: Dataset = 'live', days = 14): Promise<Scoreboard> {
  if (USE_MOCKS) {
    await delay();
    return scoreboardFixture as Scoreboard;
  }

  return apiFetch<Scoreboard>(`/scoreboard?dataset=${dataset}&days=${days}`).catch(async () => {
    return scoreboardFixture as Scoreboard;
  });
}

export async function getFires(dataset: Dataset = 'live', hours = 48): Promise<Fire[]> {
  if (USE_MOCKS) {
    await delay();
    return firesFixture as Fire[];
  }

  return apiFetch<Fire[]>(`/fires?dataset=${dataset}&hours=${hours}`).catch(async () => {
    return firesFixture as Fire[];
  });
}

export async function ask(req: AskRequest): Promise<AskResponse> {
  if (USE_MOCKS) {
    await delay(1200);
    if (req.mode === 'brief') {
      return askFixture.brief as unknown as AskResponse;
    }
    return askFixture.ask as unknown as AskResponse;
  }

  try {
    const res = await fetch(`${AGENT_BASE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (res.ok) {
      return res.json();
    }
  } catch {
    // fallback to fixture
  }

  if (req.mode === 'brief') {
    return askFixture.brief as unknown as AskResponse;
  }
  return askFixture.ask as unknown as AskResponse;
}
