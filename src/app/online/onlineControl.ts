import { useStore } from 'zustand';
import { OnlineSession, onlineSessionStore, type OnlineSessionState } from './OnlineSession';

/** What the GM's toolbar shows of the online session and does with it. */
export interface OnlineControl {
  session: OnlineSessionState;
  /** Starts the server if it is not running (again after a failure), then copies the link. */
  copyLink: () => void;
  stop: () => void;
}

/** The online session for the toolbar, following its state. */
export function useOnlineControl(): OnlineControl {
  const session = useStore(onlineSessionStore);
  return {
    session,
    copyLink: () => void OnlineSession.getInstance()?.startAndCopyLink(),
    stop: () => OnlineSession.getInstance()?.stop(),
  };
}
