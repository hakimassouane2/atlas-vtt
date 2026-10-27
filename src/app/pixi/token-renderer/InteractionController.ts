/**
 * Token Interaction Controller
 * 
 * Handles all pointer interactions with tokens including drag & drop,
 * hover effects, context menus, and path recording for smooth animations.
 */

import { Container, FederatedPointerEvent } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import type { ITokenInteractionController, TokenGroupContainer } from './types';
import type { TokenEntity } from '../../types';
import type { TokenMenu } from '../../canvas/canvasHost';
import type { ViewAtlasState } from '../../storeFactory';
import type { StoreApi } from 'zustand';
import type { GridSystem } from '../../grid/GridSystem';
import { beginHistoryTransaction, endHistoryTransaction } from '../../stores/history';
import { EventEmitter } from 'events';
import { copyDragSelection } from './dragCopy';
import type { DragRuler } from './DragRuler';
import { holdTokens } from '../../lighting/sightOnDrop';
import { dropTokensOnStairs, type StairsMenuPlace } from './stairsDrop';
import type { TokenPreviewAnchor } from '../../services/NotePreviewUIManager';
import type { ArtFloors } from '../../levels/levelSurfaces';
import { levelObjects } from '../../levels/levelObjects';
import { mapTokens } from '../../tokens/offMap';

interface DragState {
  isDragging: boolean;
  dragIds: string[];
  dragStartPointer: { x: number; y: number };
  /** Where the pointer was last seen, in world pixels: a drag whose pointer is lost drops there. */
  lastPointer?: { x: number; y: number };
  initialPositions: Record<string, { x: number; y: number }>;
  animationFrameId?: number;
  pendingUpdate: boolean;
  hasMoved: boolean;
  clickToken?: TokenEntity;
  /** The press grabbed a token outside the selection: it is selected on release if it never moved, and a drag leaves the selection as it was. */
  selectsOnRelease?: boolean;
  /** Alt/Option was held at pointer down: the drag moves copies and leaves the originals. */
  copyOnDrag?: boolean;
  /** The token the pointer grabbed; the drag ruler measures its path. */
  rulerTokenId?: string;
}

export class InteractionController implements ITokenInteractionController {
  private viewport: Viewport;
  private store: StoreApi<ViewAtlasState>;
  private gridSystem: GridSystem;
  private eventBus: EventEmitter;
  public isPlayerView: boolean;
  
  /** Opens a right-clicked token's menu; none where the canvas offers no token menu. */
  public tokenMenu: TokenMenu | null = null;
  /** Whether the person at this canvas may move `token`; unset, the GM moves every token and a player view none. */
  public mayControl: ((token: TokenEntity) => boolean) | null = null;
  
  // Drag state
  private dragState: DragState = {
    isDragging: false,
    dragIds: [],
    dragStartPointer: { x: 0, y: 0 },
    initialPositions: {},
    pendingUpdate: false,
    hasMoved: false
  };
  
  // Hover handlers
  private hoverHandlers: Record<string, { over: (e?: FederatedPointerEvent) => void; out: () => void }> = {};
  private _currentHoverId: string | null = null;
  /** The statblock preview the hover armed, hidden by itself: the token may have left the level shown since. */
  private hoverPreview: TokenPreviewAnchor | null = null;
  
  // Callbacks for external systems
  private onSelectionUpdate?: () => void;
  private onTokenMove?: (tokenId: string, x: number, y: number) => void;
  private getTokenSprite?: (tokenId: string) => TokenGroupContainer | null;
  private updateUIPosition?: (tokenId: string, x: number, y: number) => void;
  private settleToken?: (tokenId: string, x: number, y: number) => void;
  /** What the view draws of the levels' maps, through which a dropped token falls; none without lighting. */
  private artFloors: (() => ArtFloors | undefined) | undefined;
  private updateControlsPosition?: (x: number, y: number, tokenSize: number) => void;
  private onTokensHeldChange?: (tokenIds: string[]) => void;
  private dragRuler?: DragRuler;
  /** Where a lost pointer is heard while the pointer is down (`watchLostPointer`). */
  private lostPointerTargets: { canvas: HTMLElement; win: Window | null } | null = null;

  constructor(
    viewport: Viewport,
    store: StoreApi<ViewAtlasState>,
    gridSystem: GridSystem,
    eventBus: EventEmitter,
    isPlayerView: boolean = false
  ) {
    this.viewport = viewport;
    this.store = store;
    this.gridSystem = gridSystem;
    this.eventBus = eventBus;
    this.isPlayerView = isPlayerView;
  }

  attachInteractionHandlers(_tokenId: string, _container: Container, _token: TokenEntity): void {
    // No-op: sprites are non-interactive. Viewport-level dispatch handles all pointer events.
  }

  removeInteractionHandlers(_tokenId: string, _container: Container): void {
    // No-op: sprites are non-interactive. Viewport-level dispatch handles all pointer events.
  }

  setupHoverHandlers(
    _tokenId: string, 
    _container: Container,
    _onHover: (tokenId: string) => void,
    _onHoverEnd: (tokenId: string) => void
  ): void {
    // No-op: sprites are non-interactive. Viewport-level dispatch drives hover state.
  }


  /** Called by TokenRenderer when viewport pointerdown hits a token. */
  public handleViewportTokenPointerDown(tokenId: string, e: FederatedPointerEvent): void {
    const activeTool = this.store.getState().activeTool;
    if (activeTool === 'measure' || activeTool === 'measure-circle' || activeTool === 'measure-cone') {
      return;
    }

    e.stopPropagation();

    if (e.button === 2) {
      this.openTokenMenu(tokenId, e);
      return;
    }

    const token = mapTokens(levelObjects(this.store.getState()))[tokenId];
    if (!token || !this.controls(token)) return;

    this.prepareInteraction(token, e);
  }

  /** Starts a group drag for the given token IDs (click within selection bounding box). */
  public handleViewportGroupDragStart(tokenIds: string[], e: FederatedPointerEvent): void {
    if (e.button !== 0) return;

    const activeTool = this.store.getState().activeTool;
    if (activeTool !== 'select' && activeTool !== 'move') return;

    e.stopPropagation();

    // Use the first token the person here may move as the reference for prepareInteraction (it will detect the multi-selection)
    const tokens = mapTokens(levelObjects(this.store.getState()));
    const firstToken = tokenIds.map((id) => tokens[id]).find((token) => token && this.controls(token));
    if (!firstToken) return;

    this.prepareInteraction(firstToken, e);
  }

  /** Called by TokenRenderer when viewport pointermove hovers over a token (or null to clear). */
  public handleViewportTokenHover(tokenId: string | null, e?: FederatedPointerEvent): void {
    // Clear previous hover if target changed
    const prevId = this._currentHoverId ?? null;
    if (prevId === tokenId) return;

    if (prevId) {
      this.handleHoverEnd(prevId);
      if (this.hoverPreview) this.eventBus.emit('pin-hide-preview', { pin: this.hoverPreview });
      this.hoverPreview = null;
    }

    this._currentHoverId = tokenId;

    if (tokenId) {
      this.handleHoverStart(tokenId);
      // Emit hover preview for new token
      const token = mapTokens(levelObjects(this.store.getState()))[tokenId];
      if (token?.kind === 'character' && e && token.statblockPath?.trim()) {
        this.hoverPreview = {
          id: token.id,
          notePath: token.statblockPath,
          x: token.x,
          y: token.y,
          type: 'token',
          // Vitals travel with the pin so the preview can mirror them.
          name: token.name,
          resources: token.resources,
          imagePath: token.imagePath,
          ringColor: token.ringColor,
          showRing: token.showRing,
        };
        this.eventBus.emit('pin-hover-preview', {
          pin: this.hoverPreview,
          screenX: e.clientX,
          screenY: e.clientY,
          pixiEvent: e,
        });
      }
    }
  }

  /** Opens the menu of the token `tokenId`, right-clicked at the event's point of the window. */
  public openTokenMenu(tokenId: string, e: { clientX: number; clientY: number }): void {
    const token = mapTokens(levelObjects(this.store.getState()))[tokenId];
    if (token && this.tokenMenu) this.tokenMenu(token, { x: e.clientX, y: e.clientY });
  }

  private controls(token: TokenEntity): boolean {
    return this.mayControl ? this.mayControl(token) : !this.isPlayerView;
  }

  /** Query whether a drag is in progress. */
  public isDraggingTokens(): boolean {
    return this.dragState.isDragging;
  }

  private prepareInteraction(token: TokenEntity, e: FederatedPointerEvent): void {
    // A second pointer (another finger) pressing during a drag is not a new gesture: taking it
    // would let go of the held tokens and leave the drag's history transaction open.
    if (this.dragState.isDragging && this.dragState.hasMoved) return;

    const { selectedIds, setSelection } = this.store.getState();
    const isTokenSelected = selectedIds.includes(token.id);

    // Shift-click toggles membership; removing never starts a drag.
    if (e.shiftKey && isTokenSelected) {
      setSelection(selectedIds.filter((id) => id !== token.id));
      return;
    }

    this.viewport.plugins.pause('drag');
    
    // Clean up any existing listeners before attaching new ones
    // This prevents accumulation if previous interaction didn't clean up properly
    this.cleanupDragListeners();
    
    // Store the token for potential click handling
    this.dragState.clickToken = token;
    this.dragState.hasMoved = false;
    // Copies are new tokens, which only the GM makes
    this.dragState.copyOnDrag = e.altKey && !this.isPlayerView;
    this.dragState.selectsOnRelease = false;
    
    // Determine which tokens to potentially drag
    if (e.shiftKey) {
      this.dragState.dragIds = [...selectedIds, token.id];
      setSelection(this.dragState.dragIds);
    } else if (isTokenSelected && selectedIds.length > 1) {
      this.dragState.dragIds = [...selectedIds];
    } else {
      this.dragState.dragIds = [token.id];
      this.dragState.selectsOnRelease = !isTokenSelected;
    }
    // A selection may hold tokens the person here may not move: they stay where they are
    const tokens = mapTokens(levelObjects(this.store.getState()));
    this.dragState.dragIds = this.dragState.dragIds.filter((id) => {
      const dragged = tokens[id];
      return dragged !== undefined && this.controls(dragged);
    });

    // Initialize drag state
    const worldPos = this.viewport.toWorld(e.global);
    this.dragState.dragStartPointer = { x: worldPos.x, y: worldPos.y };
    this.dragState.lastPointer = this.dragState.dragStartPointer;
    this.dragState.initialPositions = {};
    
    for (const id of this.dragState.dragIds) {
      const sprite = this.getTokenSprite?.(id);
      if (sprite) {
        this.dragState.initialPositions[id] = { x: sprite.position.x, y: sprite.position.y };
      }
    }
    
    this.dragState.isDragging = true;
    // Tokens outside the selection stay at rest until release, so a drag never grows their UI
    this.reportHeld(this.dragState.dragIds.filter((id) => !selectedIds.includes(id)));
    
    // Don't set isDragging in store yet - wait for actual movement
    
    // Set up drag event listeners
    this.viewport.on('pointermove', this.onPointerMove, this);
    this.viewport.on('pointerup', this.onPointerUp, this);
    this.viewport.on('pointerupoutside', this.onPointerUp, this);
    this.watchLostPointer();
  }

  /**
   * No release follows a pointer the browser cancels (a touch taken over by a system gesture)
   * or a press that outlasts the window's focus, and PIXI reports neither: the drag then ends
   * where the token is, as a drop.
   */
  private watchLostPointer(): void {
    const canvas = this.viewport.options?.events?.domElement;
    if (!canvas) return;
    const win = canvas.ownerDocument.defaultView;
    canvas.addEventListener('pointercancel', this.dropWhereItIs);
    win?.addEventListener('blur', this.dropWhereItIs);
    this.lostPointerTargets = { canvas, win };
  }

  private readonly dropWhereItIs = (): void => {
    this.endDrag(this.dragState.lastPointer ?? this.dragState.dragStartPointer);
  };

  private onPointerMove = (e: FederatedPointerEvent) => {
    if (!this.dragState.isDragging) return;
    
    const worldPos = this.viewport.toWorld(e.global);
    this.dragState.lastPointer = { x: worldPos.x, y: worldPos.y };
    const dx = worldPos.x - this.dragState.dragStartPointer.x;
    const dy = worldPos.y - this.dragState.dragStartPointer.y;
    
    // Check if we've moved enough to consider it a drag (5 pixel threshold)
    const moveDistance = Math.sqrt(dx * dx + dy * dy);
    if (!this.dragState.hasMoved && moveDistance > 5) {
      this.dragState.hasMoved = true;
      this.store.getState().setIsDragging(true);
      // The whole drag becomes one undo step; closed in onPointerUp.
      beginHistoryTransaction(this.store);
      const grabbedIndex = Math.max(0, this.dragState.dragIds.indexOf(this.dragState.clickToken?.id ?? ''));
      if (this.dragState.copyOnDrag) this.dragCopiesInstead();
      // Held are the tokens that move: the copies of an Alt-drag, before anything has moved.
      this.reportHeld(this.dragState.dragIds);
      this.startDragRuler(this.dragState.dragIds[grabbedIndex]);
    }
    
    // If we haven't moved enough, don't update positions
    if (!this.dragState.hasMoved) return;
    
    for (const id of this.dragState.dragIds) {
      const sprite = this.getTokenSprite?.(id);
      if (!sprite) continue;
      
      const initPos = this.dragState.initialPositions[id];
      if (initPos) {
        const newX = initPos.x + dx;
        const newY = initPos.y + dy;
        
        // Update sprite position
        sprite.position.set(newX, newY);
        this.updateUIPosition?.(id, newX, newY);
      }
    }

    const rulerStart = this.dragState.rulerTokenId ? this.dragState.initialPositions[this.dragState.rulerTokenId] : undefined;
    if (rulerStart) this.dragRuler?.update({ x: rulerStart.x + dx, y: rulerStart.y + dy });

    // The store follows the sprites on every move, so sight and a token's footprint in the dark
    // move with the token in the same frame (as Foundry ties a token's vision to where it is drawn);
    // a throttled store left the footprint trailing the sprite. Chromium sends one pointermove per
    // frame, so this is one write per frame.
    // Positions come from the pointer, not the sprites: an Alt-drag copy may still be loading its sprite.
    const updates = this.dragState.dragIds.flatMap((id) => {
      const initPos = this.dragState.initialPositions[id];
      return initPos ? [{ id, x: initPos.x + dx, y: initPos.y + dy }] : [];
    });
    if (updates.length > 0) {
      // Sight waits for the drop when the scene has sight on drop on (`SightTokens`). Persistence
      // is debounced, and the open history transaction keeps these writes out of the undo stack.
      this.store.getState().setTokenPositions(updates);
    }
    
    // Schedule UI update
    if (!this.dragState.pendingUpdate && !this.dragState.animationFrameId) {
      this.dragState.pendingUpdate = true;
      this.dragState.animationFrameId = window.requestAnimationFrame(() => this.throttledUIUpdate());
    }
  };

  /** Swaps the drag over to fresh copies of the dragged tokens, which then become the selection. */
  private dragCopiesInstead(): void {
    const copies = copyDragSelection(this.store, this.dragState.dragIds, this.dragState.initialPositions, !this.dragState.selectsOnRelease);
    if (!copies) return;
    this.dragState.dragIds = copies.ids;
    this.dragState.initialPositions = copies.initialPositions;
  }

  private startDragRuler(tokenId: string | undefined): void {
    const origin = tokenId ? this.dragState.initialPositions[tokenId] : undefined;
    if (!tokenId || !origin) return;
    this.dragState.rulerTokenId = tokenId;
    this.dragRuler?.begin(tokenId, origin);
  }

  private throttledUIUpdate = () => {
    if (!this.dragState.pendingUpdate) return;
    this.dragState.pendingUpdate = false;
    delete this.dragState.animationFrameId;
    
    // Update controls position if single token selected
    const selectedIds = this.store.getState().selectedIds;
    if (selectedIds.length === 1) {
      const selectedId = selectedIds[0];
      if (selectedId) {
        const sprite = this.getTokenSprite?.(selectedId);
        if (sprite) {
          const tokenSize = sprite.getChildByLabel('tokenSprite')?.width || 70;
          this.updateControlsPosition?.(sprite.position.x, sprite.position.y, tokenSize);
        }
      }
    }
    
    // Emit drag update event
    window.dispatchEvent(new CustomEvent('atlas-tokens-drag-update', { 
      detail: { tokenIds: this.dragState.dragIds } 
    }));
    
    // Trigger selection overlay update
    this.onSelectionUpdate?.();
  };

  private cleanupDragListeners(): void {
    // Remove all drag-related event listeners from viewport
    this.viewport.off('pointermove', this.onPointerMove, this);
    this.viewport.off('pointerup', this.onPointerUp, this);
    this.viewport.off('pointerupoutside', this.onPointerUp, this);
    this.lostPointerTargets?.canvas.removeEventListener('pointercancel', this.dropWhereItIs);
    this.lostPointerTargets?.win?.removeEventListener('blur', this.dropWhereItIs);
    this.lostPointerTargets = null;
  }

  private onPointerUp = (e: FederatedPointerEvent): void => {
    this.endDrag(this.viewport.toWorld(e.global), { x: e.clientX, y: e.clientY, doc: this.viewport.options?.events?.domElement?.ownerDocument });
  };

  /**
   * Ends the press or drag with the pointer at `worldPos`: a drag drops its tokens there, as one undo
   * step. `menuAt` is where a choice of levels opens for tokens dropped into an elevator (none for a
   * pointer that was lost), whose pick joins that step.
   */
  private endDrag(worldPos: { x: number; y: number }, menuAt: StairsMenuPlace | null = null): void {
    if (!this.dragState.isDragging) return;
    const wasDrag = this.dragState.hasMoved;
    let stepHeld = false;

    try {
      this.dragState.isDragging = false;
      
      // Check if this was a click (no significant movement)
      if (!this.dragState.hasMoved && this.dragState.clickToken) {
        // A click selects a token the press found outside the selection
        if (this.dragState.selectsOnRelease) this.store.getState().setSelection([this.dragState.clickToken.id]);
        this.cleanupDragListeners();
        this.viewport.plugins.resume('drag');
        delete this.dragState.clickToken;
        this.dragState.hasMoved = false;
        return;
      }
      
      // This was a drag
      this.store.getState().setIsDragging(false);
      
      // Clean up event listeners
      this.cleanupDragListeners();
      
      // Clean up animation frame
      if (this.dragState.animationFrameId) {
        window.cancelAnimationFrame(this.dragState.animationFrameId);
        delete this.dragState.animationFrameId;
      }
      
      // Calculate final positions
      const dx = worldPos.x - this.dragState.dragStartPointer.x;
      const dy = worldPos.y - this.dragState.dragStartPointer.y;
      
      const tokenUpdates: Array<{id: string, x: number, y: number}> = [];
      const snapToGrid = this.store.getState().grid?.snapToGrid ?? true;
      const tokens = mapTokens(levelObjects(this.store.getState()));
      
      for (const id of this.dragState.dragIds) {
        const initPos = this.dragState.initialPositions[id];
        if (!initPos) continue;
        
        const newX = initPos.x + dx;
        const newY = initPos.y + dy;
        
        // Snap to grid if enabled
        const finalPos = snapToGrid 
          ? this.gridSystem.snapTokenCenter(newX, newY, tokens[id]?.size || 1)
          : { x: newX, y: newY };
        
        // The token, with its resource bars and nameplate, glides from the pointer to where it snaps
        this.settleToken?.(id, finalPos.x, finalPos.y);
        
        tokenUpdates.push({id, x: finalPos.x, y: finalPos.y});
      }
      
      if (tokenUpdates.length > 0) stepHeld = dropTokensOnStairs(this.store, tokenUpdates, menuAt, this.artFloors?.());
      
      // Update UI
      this.onSelectionUpdate?.();
      
      
    } catch (error) {
      console.error('[InteractionController] Error in onPointerUp handler:', error);
    } finally {
      if (wasDrag && !stepHeld) endHistoryTransaction(this.store);
      this.dragRuler?.end();
      delete this.dragState.rulerTokenId;

      // Always clean up event listeners to prevent accumulation
      this.cleanupDragListeners();

      // Always resume viewport drag
      this.viewport.plugins.resume('drag');

      // Reset drag state
      this.dragState.pendingUpdate = false;
      this.dragState.hasMoved = false;
      delete this.dragState.clickToken;
      this.dragState.selectsOnRelease = false;
      this.reportHeld([]);
    }
  }

  /** The store notes where the held tokens stand (`holdTokens`: sight waits there for the drop); then the token UI. */
  private reportHeld(tokenIds: string[]): void {
    holdTokens(this.store, tokenIds);
    this.onTokensHeldChange?.(tokenIds);
  }

  handleDrag(
    tokenId: string,
    startX: number,
    startY: number,
    onMove: (x: number, y: number) => void,
    onEnd: (finalX: number, finalY: number, path: Array<{x: number, y: number, timestamp: number}>) => void
  ): void {
    // This method is part of the interface but drag is handled internally
    // Could be used for programmatic drag operations
  }

  emitContextMenu(tokenId: string, x: number, y: number): void {
    this.eventBus.emit('token-context-menu', { tokenId, x, y });
  }

  // Callbacks setup
  
  setSelectionUpdateCallback(callback: () => void): void {
    this.onSelectionUpdate = callback;
  }

  setTokenSpriteProvider(provider: (tokenId: string) => TokenGroupContainer | null): void {
    this.getTokenSprite = provider;
  }

  setUIPositionUpdater(updater: (tokenId: string, x: number, y: number) => void): void {
    this.updateUIPosition = updater;
  }

  /** What the view draws of the levels' maps (`ArtFloors`): a token dropped where a level below shows falls to it. */
  setArtFloors(provider: (() => ArtFloors | undefined) | undefined): void {
    this.artFloors = provider;
  }

  /** How a dropped token gets from where the pointer left it to its place. */
  setTokenSettler(settler: (tokenId: string, x: number, y: number) => void): void {
    this.settleToken = settler;
  }

  setControlsPositionUpdater(updater: (x: number, y: number, tokenSize: number) => void): void {
    this.updateControlsPosition = updater;
  }

  /**
   * Receives the tokens whose UI stays at rest while the pointer is down: the ones a press
   * newly selects, every dragged token once a drag starts, and none on release.
   */
  setTokensHeldCallback(callback: (tokenIds: string[]) => void): void {
    this.onTokensHeldChange = callback;
  }

  setDragRuler(ruler: DragRuler): void {
    this.dragRuler = ruler;
  }

  private handleHoverStart(tokenId: string): void {
    // Hover start logic - could emit events or update UI
  }

  private handleHoverEnd(tokenId: string): void {
    // Hover end logic - could emit events or update UI
  }

  destroyAll(): void {
    // Clean up all hover handlers
    for (const tokenId in this.hoverHandlers) {
      delete this.hoverHandlers[tokenId];
    }

    // A drag interrupted by teardown must not leave its transaction open
    if (this.dragState.hasMoved) endHistoryTransaction(this.store);
    holdTokens(this.store, []);
    this.dragRuler?.end();

    // Remove any active viewport listeners using the same cleanup method
    this.cleanupDragListeners();
    
    // Clean up animation frame
    if (this.dragState.animationFrameId) {
      window.cancelAnimationFrame(this.dragState.animationFrameId);
    }
    
    // Reset state
    this.dragState = {
      isDragging: false,
      dragIds: [],
      dragStartPointer: { x: 0, y: 0 },
      initialPositions: {},
      pendingUpdate: false,
      hasMoved: false
    };
  }
}
