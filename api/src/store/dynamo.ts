import type { Store } from './types';

// A5.1: DynamoDB-backed store. Placeholder until the AWS step.
export class DynamoStore implements Store {
  constructor() {
    throw new Error('DynamoStore is not built yet (A5.1). Use STORE=memory.');
  }
  putReadings!: Store['putReadings'];
  getReadings!: Store['getReadings'];
  getLatestReadings!: Store['getLatestReadings'];
  putWeather!: Store['putWeather'];
  getWeather!: Store['getWeather'];
  putFires!: Store['putFires'];
  getFires!: Store['getFires'];
  putIncident!: Store['putIncident'];
  getIncident!: Store['getIncident'];
  listIncidents!: Store['listIncidents'];
}
