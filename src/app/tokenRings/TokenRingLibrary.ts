import { TFile, type App, type EventRef, type TAbstractFile } from 'obsidian';
import { AssetService } from '../services/AssetService';
import { detectTintable } from './ringTint';
import { imageMimeTypeOfPath } from '../utils/imageMimeTypes';
import { readTokenRingSettings, ringChoiceOf, ringTints } from './tokenRingChoice';
import { tokenRingFolder, tokenRingPath, tokenRingStyleOfPath } from './tokenRingFiles';
import type { RingSubject, TokenRingSettings } from './tokenRingTypes';
import type { PortraitRing } from '../packages/components/shared/tokenRingContext';

/** A ring file of a collection. */
export interface RingFile {
  /** Its file name, by which settings and tokens name it. */
  style: string;
  path: string;
  /** Where the page loads it from. */
  url: string;
}

/**
 * The ring files of the vault's collections, for what Atlas shows outside the canvas (portraits,
 * the settings): their files, whether each tints (looked at once per file and change), and the ring
 * a token's portrait is drawn with. Tells its listeners when a ring file comes, goes or changes,
 * when a file's tint is known, and when a collection's settings change.
 *
 * One per app, opened by the plugin and released when it unloads.
 */
export class TokenRingLibrary {
  private static readonly instances = new WeakMap<App, TokenRingLibrary>();

  static open(app: App): TokenRingLibrary {
    let library = TokenRingLibrary.instances.get(app);
    if (!library) {
      library = new TokenRingLibrary(app);
      TokenRingLibrary.instances.set(app, library);
    }
    return library;
  }

  /** The app's ring library once the plugin opened it; undefined before (and in tests that open none). */
  static forApp(app: App | null | undefined): TokenRingLibrary | undefined {
    return app ? TokenRingLibrary.instances.get(app) : undefined;
  }

  static release(app: App): void {
    TokenRingLibrary.instances.get(app)?.destroy();
    TokenRingLibrary.instances.delete(app);
  }

  /** Whether each ring file tints; a file being looked at has no entry yet. */
  private readonly tints = new Map<string, boolean>();
  private readonly detecting = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private readonly vaultRefs: EventRef[] = [];
  private readonly settingsRef: EventRef;
  /** Raised on every change, so a React view can tell when to read again. */
  private revisionValue = 0;

  private constructor(private readonly app: App) {
    const { vault, workspace } = app;
    this.vaultRefs.push(
      vault.on('create', (file) => this.fileChanged(file.path)),
      vault.on('modify', (file) => this.fileChanged(file.path)),
      vault.on('delete', (file) => this.fileChanged(file.path)),
      vault.on('rename', (file: TAbstractFile, oldPath: string) => {
        this.fileChanged(oldPath);
        this.fileChanged(file.path);
      }),
    );
    this.settingsRef = workspace.on('atlas-vtt:collection-settings-changed', () => this.changed());
  }

  get revision(): number {
    return this.revisionValue;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The ring files of `collectionId`, by name. */
  rings(collectionId: string): RingFile[] {
    const folder = this.app.vault.getFolderByPath(tokenRingFolder(collectionId));
    if (!folder) return [];
    return folder.children
      .flatMap((child) => {
        const style = child instanceof TFile ? tokenRingStyleOfPath(child.path) : null;
        return child instanceof TFile && style ? [{ style, path: child.path, url: this.app.vault.getResourcePath(child) }] : [];
      })
      .sort((a, b) => a.style.localeCompare(b.style));
  }

  /** Whether the ring file at `path` is grey, which a tint colours; undefined while it is being looked at. */
  detectedTint(path: string): boolean | undefined {
    const known = this.tints.get(path);
    if (known === undefined) void this.detect(path);
    return known;
  }

  /**
   * How the portrait of `subject`, placed in `collectionId`, draws its ring: by the collection's
   * stored ring settings, or by `draft` (the settings dialog shows what it would save).
   */
  portraitRing(collectionId: string | null, subject: RingSubject, draft?: TokenRingSettings): PortraitRing {
    const settings = draft ?? readTokenRingSettings(collectionId ? AssetService.getInstance(this.app).getCollectionSettings(collectionId) : null);
    const choice = ringChoiceOf(subject, settings);
    const file = choice.style && collectionId ? this.app.vault.getFileByPath(tokenRingPath(collectionId, choice.style)) : null;
    if (!file || !choice.style) return { color: choice.color };
    const tints = ringTints(choice.style, this.detectedTint(file.path), settings);
    return { image: this.app.vault.getResourcePath(file), color: tints ? choice.color : undefined };
  }

  private destroy(): void {
    for (const ref of this.vaultRefs) this.app.vault.offref(ref);
    this.app.workspace.offref(this.settingsRef);
    this.listeners.clear();
  }

  private async detect(path: string): Promise<void> {
    if (this.detecting.has(path)) return;
    this.detecting.add(path);
    try {
      const bytes = await this.app.vault.adapter.readBinary(path);
      const tints = await detectTintable(new Blob([bytes], { type: imageMimeTypeOfPath(path) ?? '' }));
      // A change of the file meanwhile looks at it again
      if (!this.detecting.has(path)) return;
      this.tints.set(path, tints);
      this.changed();
    } catch {
      // A file that cannot be read shows Atlas' ring until it changes
    } finally {
      this.detecting.delete(path);
    }
  }

  private fileChanged(path: string): void {
    if (!tokenRingStyleOfPath(path)) return;
    this.tints.delete(path);
    this.detecting.delete(path);
    this.changed();
  }

  private changed(): void {
    this.revisionValue += 1;
    for (const listener of [...this.listeners]) listener();
  }
}
