// DynamoDB-backed store, master PRD section 9. Readings and weather share wajah-readings; fires are cached per
// day in S3 (fires/{dataset}/{date}.json) because a busy day can exceed DynamoDB's 400 KB item limit.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Dataset, Fire, Incident, Reading, Weather } from '@wajah/shared';
import { STATIONS } from '../lib/stations';
import { iso, matchIncident, newestFirst, type IncidentFilter, type Store } from './types';

const TTL_DAYS = 30;            // live rows expire (master PRD section 9)
const BATCH = 25;               // BatchWriteItem limit
const WEATHER = '_weather';

const required = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
};

export class DynamoStore implements Store {
  private readonly doc: DynamoDBDocumentClient;
  private readonly s3: S3Client;
  private readonly readingsTable: string;
  private readonly incidentsTable: string;
  private readonly bucket: string;

  constructor(opts: { readingsTable?: string; incidentsTable?: string; bucket?: string } = {}) {
    this.doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
    this.s3 = new S3Client({});
    this.readingsTable = opts.readingsTable ?? required('READINGS_TABLE');
    this.incidentsTable = opts.incidentsTable ?? required('INCIDENTS_TABLE');
    this.bucket = opts.bucket ?? required('EVIDENCE_BUCKET');
  }

  private async batchPut(items: Record<string, unknown>[]) {
    for (let i = 0; i < items.length; i += BATCH) {
      let req: Record<string, { PutRequest: { Item: Record<string, unknown> } }[]> | undefined = {
        [this.readingsTable]: items.slice(i, i + BATCH).map((Item) => ({ PutRequest: { Item } })),
      };
      for (let attempt = 0; req && Object.keys(req).length && attempt < 6; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 100 * 2 ** attempt));
        const res = await this.doc.send(new BatchWriteCommand({ RequestItems: req }));
        req = res.UnprocessedItems as typeof req;
      }
    }
  }

  private ttl(ds: Dataset, ts: string) {
    return ds === 'live' ? Math.floor(Date.parse(ts) / 1000) + TTL_DAYS * 86400 : undefined;
  }

  private async query<T>(pk: string, from: string, to: string, opts: { limit?: number; newestFirst?: boolean } = {}): Promise<T[]> {
    const out: T[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const res = await this.doc.send(new QueryCommand({
        TableName: this.readingsTable,
        KeyConditionExpression: 'pk = :pk AND ts BETWEEN :from AND :to',
        ExpressionAttributeValues: { ':pk': pk, ':from': from, ':to': to },
        ScanIndexForward: !opts.newestFirst,
        Limit: opts.limit,
        ExclusiveStartKey: start,
      }));
      for (const item of res.Items ?? []) {
        const { pk: _pk, ttl: _ttl, ...row } = item;
        out.push(row as T);
      }
      start = opts.limit ? undefined : res.LastEvaluatedKey;
    } while (start);
    return out;
  }

  async putReadings(ds: Dataset, rows: Reading[]) {
    await this.batchPut(rows.map((r) => {
      const ts = iso(r.ts);
      return { ...r, ts, pk: `${ds}#${r.stationId}`, ttl: this.ttl(ds, ts) };
    }));
  }

  getReadings(ds: Dataset, stationId: string, fromIso: string, toIso: string) {
    return this.query<Reading>(`${ds}#${stationId}`, iso(fromIso), iso(toIso));
  }

  async getLatestReadings(ds: Dataset) {
    const latest = await Promise.all(STATIONS.map((s) =>
      this.query<Reading>(`${ds}#${s.id}`, '0000', '9999', { limit: 1, newestFirst: true })));
    return latest.flat();
  }

  async putWeather(ds: Dataset, rows: Weather[]) {
    await this.batchPut(rows.map((w) => {
      const ts = iso(w.ts);
      return { ...w, ts, pk: `${ds}#${WEATHER}`, ttl: this.ttl(ds, ts) };
    }));
  }

  getWeather(ds: Dataset, fromIso: string, toIso: string) {
    return this.query<Weather>(`${ds}#${WEATHER}`, iso(fromIso), iso(toIso));
  }

  async putFires(ds: Dataset, date: string, rows: Fire[]) {
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket, Key: `fires/${ds}/${date}.json`, Body: JSON.stringify(rows), ContentType: 'application/json',
    }));
  }

  async getFires(ds: Dataset, fromIso: string, toIso: string) {
    const from = iso(fromIso), to = iso(toIso);
    const days: string[] = [];
    let token: string | undefined;
    do {
      const res = await this.s3.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: `fires/${ds}/`, ContinuationToken: token }));
      for (const o of res.Contents ?? []) {
        const day = o.Key!.slice(`fires/${ds}/`.length, -'.json'.length);
        if (day >= from.slice(0, 10) && day <= to.slice(0, 10)) days.push(o.Key!);
      }
      token = res.NextContinuationToken;
    } while (token);
    const all = await Promise.all(days.map(async (Key) => {
      const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key }));
      return JSON.parse(await res.Body!.transformToString()) as Fire[];
    }));
    return all.flat().filter((f) => {
      const t = iso(f.acquiredAt);
      return t >= from && t <= to;
    });
  }

  async putIncident(incident: Incident) {
    await this.doc.send(new PutCommand({ TableName: this.incidentsTable, Item: incident }));
  }

  async getIncident(id: string) {
    const res = await this.doc.send(new GetCommand({ TableName: this.incidentsTable, Key: { id } }));
    return (res.Item as Incident | undefined) ?? null;
  }

  async listIncidents(f: IncidentFilter) {
    const out: Incident[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const res = await this.doc.send(new ScanCommand({
        TableName: this.incidentsTable,
        FilterExpression: '#ds = :ds',
        ExpressionAttributeNames: { '#ds': 'dataset' },
        ExpressionAttributeValues: { ':ds': f.dataset },
        ExclusiveStartKey: start,
      }));
      out.push(...((res.Items ?? []) as Incident[]));
      start = res.LastEvaluatedKey;
    } while (start);
    return out.filter((i) => matchIncident(i, f)).sort(newestFirst);
  }
}
