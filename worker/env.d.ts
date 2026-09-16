interface SqlStorageCursor<T = Record<string, unknown>> {
  one(): T;
}

interface SqlStorage {
  exec<T extends Record<string, unknown> = Record<string, unknown>>(
    query: string,
    ...bindings: Array<string | number | null>
  ): SqlStorageCursor<T>;
}

interface DurableObjectState {
  storage: { sql: SqlStorage };
}

interface DurableObjectId {
  toString(): string;
}

interface DurableObjectStub {
  fetch(input: Request, init?: RequestInit): Promise<Response>;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

interface WorkerEnv {
  GENERATE_STATS: DurableObjectNamespace;
  ASSETS?: { fetch(input: Request, init?: RequestInit): Promise<Response> };
}
