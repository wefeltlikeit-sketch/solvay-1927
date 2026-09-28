import type { IncomingMessage, ServerResponse } from 'node:http';
export function handleApi(req: IncomingMessage, res: ServerResponse): Promise<void>;
