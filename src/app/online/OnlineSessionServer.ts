import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';
import { PLAYER_PAGE_HTML } from './playerPage';
import { combineStreamRequests, parseStreamRequest, type PlayerStreamRequest } from './playerStreamRequest';

/** Keeps idle connections open through routers and proxies that drop silent sockets. */
const HEARTBEAT_MS = 20_000;

interface PlayerClient {
  response: ServerResponse;
  request: PlayerStreamRequest;
  /** Number of the last frame this player received. */
  sentFrame: number;
  lastSentAt: number;
  /** The socket buffer is full: wait for it to drain, the player's connection is the limit. */
  isBlocked: boolean;
  /** Sends the latest frame once the player's frame interval has passed. */
  timer: number | null;
}

/**
 * HTTP server players reach with their link. It serves the player page and pushes
 * frames (JPEG, base64) over Server-Sent Events (`/events`), each player at its
 * own frame rate and never faster than its connection takes them. Every request
 * must carry the session key.
 */
export class OnlineSessionServer {
  private server: Server | null = null;
  private readonly clients = new Set<PlayerClient>();
  private frame: string | null = null;
  private frameNumber = 0;
  private heartbeat: number | null = null;

  constructor(
    private readonly secret: string,
    /** Called with what connected players ask for, or null when nobody is connected. */
    private readonly onRequestChange: (request: PlayerStreamRequest | null, playerCount: number) => void,
  ) {}

  /** Resolves once the port is open; rejects when it is taken or unavailable. */
  listen(port: number): Promise<void> {
    const server = createServer((request, response) => this.handle(request, response));
    this.server = server;
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '0.0.0.0', () => {
        server.off('error', reject);
        this.heartbeat = window.setInterval(() => this.clients.forEach((client) => client.response.write(': ping\n\n')), HEARTBEAT_MS);
        resolve();
      });
    });
  }

  close(): void {
    if (this.heartbeat !== null) window.clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.clients.forEach((client) => this.disconnect(client));
    this.server?.close();
    // close() only stops accepting: idle keep-alive sockets would otherwise outlive the session
    this.server?.closeAllConnections();
    this.server = null;
    this.frame = null;
  }

  /** Makes `image` (JPEG) the frame players see and sends it to each player when due. */
  publishFrame(image: Uint8Array): void {
    this.frame = Buffer.from(image).toString('base64');
    this.frameNumber++;
    this.clients.forEach((client) => this.sendLatestFrame(client));
  }

  private sendLatestFrame(client: PlayerClient): void {
    if (!this.frame || client.sentFrame === this.frameNumber || client.isBlocked || client.timer !== null) return;
    const wait = client.lastSentAt + 1000 / client.request.fps - Date.now();
    if (wait > 0) {
      client.timer = window.setTimeout(() => {
        client.timer = null;
        this.sendLatestFrame(client);
      }, wait);
      return;
    }
    client.sentFrame = this.frameNumber;
    client.lastSentAt = Date.now();
    const flushed = client.response.write(`event: frame\ndata: ${this.frame}\n\n`);
    if (!flushed) {
      client.isBlocked = true;
      client.response.once('drain', () => {
        client.isBlocked = false;
        this.sendLatestFrame(client);
      });
    }
  }

  private handle(request: IncomingMessage, response: ServerResponse): void {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.searchParams.get('k') !== this.secret) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Lien invalide');
      return;
    }
    switch (url.pathname) {
      case '/':
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(PLAYER_PAGE_HTML);
        return;
      case '/events':
        this.connect(request, response, parseStreamRequest(url.searchParams));
        return;
      default:
        response.writeHead(404).end();
    }
  }

  private connect(request: IncomingMessage, response: ServerResponse, streamRequest: PlayerStreamRequest): void {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    response.write('retry: 2000\n\n');
    const client: PlayerClient = { response, request: streamRequest, sentFrame: 0, lastSentAt: 0, isBlocked: false, timer: null };
    this.clients.add(client);
    this.notifyRequestChange();
    // Show the scene at once, even when the DM is elsewhere and no new frame comes
    this.sendLatestFrame(client);
    request.on('close', () => this.disconnect(client));
  }

  private disconnect(client: PlayerClient): void {
    if (!this.clients.delete(client)) return;
    if (client.timer !== null) window.clearTimeout(client.timer);
    client.response.end();
    this.notifyRequestChange();
  }

  private notifyRequestChange(): void {
    const requests = [...this.clients].map((client) => client.request);
    this.onRequestChange(combineStreamRequests(requests), requests.length);
  }
}
