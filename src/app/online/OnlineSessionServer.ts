import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';
import type { FrameView } from './PlayerFrameRenderer';
import { playerPageHtml } from './playerPage';
import { playerCanvasPageHtml } from './playerCanvasPage';
import { parseStreamRequest, type PlayerStreamRequest } from './playerStreamRequest';

/** Keeps idle connections open through routers and proxies that drop silent sockets. */
const HEARTBEAT_MS = 20_000;
/** Commands are tiny JSON objects; anything larger is not from the player page. */
const MAX_BODY_BYTES = 4096;

/** What the session does with players; the server only carries messages. */
export interface OnlineSessionHandlers {
  onJoin(playerId: string, request: PlayerStreamRequest): void;
  /** A player opened the canvas page (`/play`), which draws the scene itself. */
  onCanvasJoin(playerId: string): void;
  onLeave(playerId: string): void;
  /** A player moved their camera (the parsed JSON body). */
  onCamera(playerId: string, body: unknown): void;
  /** Applies a player's command (the parsed JSON body); returns whether it was accepted. */
  onCommand(body: unknown): boolean;
  /** An image file players may see (token artwork): its bytes, a URL to fetch it from, or null. */
  onImage(path: string): Promise<TokenImage | null>;
  /** The DM's stylesheets and theme classes, so the page looks like Atlas does for the DM. */
  pageTheme(): PageTheme;
}

export interface PageTheme {
  css: string;
  bodyClass: string;
}

/**
 * The player pages' scripts and own stylesheets, built with the plugin: the frame page
 * (`src/app/online/client/`) and the canvas page (`src/app/online/canvas/`).
 */
export interface PlayerClient {
  script: string;
  styles: string;
  canvasScript: string;
  canvasStyles: string;
}

export type TokenImage = { data: Uint8Array; contentType: string } | { url: string };

interface PlayerConnection {
  response: ServerResponse;
  /** The socket buffer is full: no new frame until it drains, the player's connection is the limit. */
  isBlocked: boolean;
}

/**
 * HTTP server players reach with their link. It serves the player pages and keeps one
 * Server-Sent Events stream per player: `/events` for the frame page, which carries that
 * player's frames, `/scene-events` for the canvas page (`/play`), which carries the scene;
 * both carry what every player shares (the tokens they control, whether they follow the
 * DM's camera). Players send their camera (`POST /camera`) and commands (`POST /command`).
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
    private readonly client: PlayerClient,
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

  /** Sends `data` to `playerId` alone. */
  sendTo(playerId: string, event: string, data: unknown): void {
    this.players.get(playerId)?.response.write(sseEvent(event, JSON.stringify(data)));
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
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
          .end(playerPageHtml(this.secret, this.handlers.pageTheme().bodyClass));
        return;
      case '/client.js':
        response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' }).end(this.client.script);
        return;
      case '/styles.css':
        response.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-store' })
          .end(`${this.handlers.pageTheme().css}\n${this.client.styles}`);
        return;
      case '/events':
        this.connect(request, response, parseStreamRequest(url.searchParams));
        return;
      case '/play':
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
          .end(playerCanvasPageHtml(this.secret, this.handlers.pageTheme().bodyClass));
        return;
      case '/canvas.js':
        response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' }).end(this.client.canvasScript);
        return;
      case '/canvas.css':
        response.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-store' })
          .end(`${this.handlers.pageTheme().css}\n${this.client.canvasStyles}`);
        return;
      case '/scene-events':
        this.connect(request, response, null);
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
      case '/image':
        this.sendImage(response, url.searchParams.get('path') ?? '');
        return;
      default:
        // The canvas page names the image in the path, so PIXI sees its extension
        if (url.pathname.startsWith('/image/')) this.sendImage(response, decodeURIComponent(url.pathname.slice('/image/'.length)));
        else response.writeHead(404).end();
    }
  }

  /** Opens a player's event stream: of frames asked for with `streamRequest`, or of the scene when it is null. */
  private connect(request: IncomingMessage, response: ServerResponse, streamRequest: PlayerStreamRequest | null): void {
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
    if (streamRequest) this.handlers.onJoin(playerId, streamRequest);
    else this.handlers.onCanvasJoin(playerId);
    request.on('close', () => this.disconnect(playerId));
  }

  private sendImage(response: ServerResponse, path: string): void {
    this.handlers.onImage(path).then((image) => {
      if (!image) {
        response.writeHead(404).end();
      } else if ('url' in image) {
        response.writeHead(302, { Location: image.url }).end();
      } else {
        response.writeHead(200, { 'Content-Type': image.contentType, 'Cache-Control': 'max-age=300' }).end(Buffer.from(image.data));
      }
    }).catch((error: unknown) => {
      console.error('[OnlineSessionServer] Could not send a token image:', error);
      response.writeHead(500).end();
    });
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
