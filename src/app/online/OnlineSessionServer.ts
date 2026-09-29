import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';
import type { FrameView } from './PlayerFrameRenderer';
import { PLAYER_PAGE_HTML } from './playerPage';
import { parseStreamRequest, type PlayerStreamRequest } from './playerStreamRequest';

/** Keeps idle connections open through routers and proxies that drop silent sockets. */
const HEARTBEAT_MS = 20_000;
/** Commands are tiny JSON objects; anything larger is not from the player page. */
const MAX_BODY_BYTES = 4096;

/** What the session does with players; the server only carries messages. */
export interface OnlineSessionHandlers {
  onJoin(playerId: string, request: PlayerStreamRequest): void;
  onLeave(playerId: string): void;
  /** A player moved their camera (the parsed JSON body). */
  onCamera(playerId: string, body: unknown): void;
  /** Applies a player's command (the parsed JSON body); returns whether it was accepted. */
  onCommand(body: unknown): boolean;
}

interface PlayerConnection {
  response: ServerResponse;
  /** The socket buffer is full: no new frame until it drains, the player's connection is the limit. */
  isBlocked: boolean;
}

/**
 * HTTP server players reach with their link. It serves the player page and keeps one
 * Server-Sent Events stream per player (`/events`), which carries that player's frames
 * and what every player shares (the tokens they control, whether they follow the DM's
 * camera). Players send their camera (`POST /camera`) and commands (`POST /command`).
 * Every request must carry the session key.
 */
export class OnlineSessionServer {
  private server: Server | null = null;
  private readonly players = new Map<string, PlayerConnection>();
  /** Shared events a player receives when they connect, by name. */
  private readonly shared = new Map<string, string>();
  private heartbeat: number | null = null;

  constructor(
    private readonly secret: string,
    private readonly handlers: OnlineSessionHandlers,
  ) {}

  get playerCount(): number {
    return this.players.size;
  }

  /** Resolves once the port is open; rejects when it is taken or unavailable. */
  listen(port: number): Promise<void> {
    const server = createServer((request, response) => this.handle(request, response));
    this.server = server;
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '0.0.0.0', () => {
        server.off('error', reject);
        this.heartbeat = window.setInterval(() => this.players.forEach((player) => player.response.write(': ping\n\n')), HEARTBEAT_MS);
        resolve();
      });
    });
  }

  close(): void {
    if (this.heartbeat !== null) window.clearInterval(this.heartbeat);
    this.heartbeat = null;
    [...this.players.keys()].forEach((playerId) => this.disconnect(playerId));
    this.server?.close();
    // close() only stops accepting: idle keep-alive sockets would otherwise outlive the session
    this.server?.closeAllConnections();
    this.server = null;
    this.shared.clear();
  }

  /** Whether `playerId` can take a new frame now. */
  isReady(playerId: string): boolean {
    const player = this.players.get(playerId);
    return !!player && !player.isBlocked;
  }

  /** Sends `playerId` a frame (JPEG) seen through `view`, the DM's camera when `isDmCamera`. */
  sendFrame(playerId: string, image: Uint8Array, view: FrameView, isDmCamera: boolean): void {
    const player = this.players.get(playerId);
    if (!player) return;
    const header = JSON.stringify({ ...view, isDmCamera });
    const flushed = player.response.write(sseEvent('frame', `${header}\ndata: ${Buffer.from(image).toString('base64')}`));
    if (!flushed) {
      player.isBlocked = true;
      player.response.once('drain', () => { player.isBlocked = false; });
    }
  }

  /** Sends `data` to every player now, and to every player who connects later. */
  share(event: string, data: unknown): void {
    const message = sseEvent(event, JSON.stringify(data));
    this.shared.set(event, message);
    this.players.forEach((player) => player.response.write(message));
  }

  /** Sends `data` to every player now only. */
  broadcast(event: string, data: unknown): void {
    const message = sseEvent(event, JSON.stringify(data));
    this.players.forEach((player) => player.response.write(message));
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
      case '/camera': {
        const playerId = url.searchParams.get('id') ?? '';
        this.receive(request, response, (body) => {
          if (!this.players.has(playerId)) return false;
          this.handlers.onCamera(playerId, body);
          return true;
        });
        return;
      }
      case '/command':
        this.receive(request, response, (body) => this.handlers.onCommand(body));
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
    const playerId = crypto.randomUUID();
    response.write('retry: 2000\n\n');
    response.write(sseEvent('hello', JSON.stringify({ id: playerId })));
    this.shared.forEach((message) => response.write(message));
    this.players.set(playerId, { response, isBlocked: false });
    this.handlers.onJoin(playerId, streamRequest);
    request.on('close', () => this.disconnect(playerId));
  }

  /** Reads a small JSON body and answers 204 when `apply` accepts it, 409 otherwise. */
  private receive(request: IncomingMessage, response: ServerResponse, apply: (body: unknown) => boolean): void {
    if (request.method !== 'POST') {
      response.writeHead(405).end();
      return;
    }
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) request.destroy();
    });
    request.on('end', () => {
      let accepted = false;
      try {
        accepted = apply(JSON.parse(body));
      } catch (error) {
        console.error('[OnlineSessionServer] Could not apply a player request:', error);
      }
      response.writeHead(accepted ? 204 : 409).end();
    });
  }

  private disconnect(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    this.players.delete(playerId);
    player.response.end();
    this.handlers.onLeave(playerId);
  }
}

function sseEvent(name: string, data: string): string {
  return `event: ${name}\ndata: ${data}\n\n`;
}
