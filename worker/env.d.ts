interface WorkerEnv {
  ASSETS?: { fetch(input: Request, init?: RequestInit): Promise<Response> };
}
