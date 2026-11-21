/**
 * What the capture screen shows for a share (D140):
 *
 * - `?shared=<id>`: claims the share (pwa/share-target.ts) and opens "Shared into Kept";
 *   a share that is gone says so.
 * - `?share=unavailable`: the server answered the share because the service worker wasn't
 *   running yet: "Open Kept once, then share again".
 * - `?share=failed` / `?share=empty`: the worker couldn't read it, or nothing in it was an image
 *   or a PDF.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { Notice } from '@/components/page';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { offlineSupported } from '@/offline/open';
import { useOffline } from '@/offline/provider';
import type { OfflineStore, SharedInto } from '@/offline/store';
import { pageStore } from '@/pwa/page-store';
import { claimShare } from '@/pwa/share-target';
import { type SharedMode, SharedSheet } from './shared-sheet';

export type ShareProblem = 'unavailable' | 'failed' | 'empty';

export function ShareArrival({
  sharedId,
  problem,
  store: storeProp,
  ask,
  onDone,
  onKeep,
}: {
  sharedId?: string;
  problem?: ShareProblem;
  /** Defaults to the signed-in person's store, or memory where IndexedDB is missing. */
  store?: OfflineStore;
  /** Asks the service worker for the share (tests pass a fake). */
  ask?: (id: string) => Promise<SharedInto | null>;
  /** Called after the share is kept or discarded, to drop `?shared` from the address. */
  onDone: () => void;
  onKeep?: (share: SharedInto, mode: SharedMode) => Promise<void>;
}) {
  const { t } = useLingui();
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'ready'; share: SharedInto } | { kind: 'gone' } | null
  >(sharedId ? { kind: 'loading' } : null);
  const [open, setOpen] = useState(true);
  const [keeping, setKeeping] = useState(false);
  const inFlight = useRef(false);
  const kept = useRef(false);
  // Wait for the person's own store: a share kept in memory would be lost on reload.
  const loaded = useOffline()?.store;
  const store = storeProp ?? loaded ?? (offlineSupported() ? undefined : pageStore());

  useEffect(() => {
    if (!sharedId || !store) return;
    let live = true;
    void claimShare(sharedId, store, ask).then(
      (share) => live && setState(share ? { kind: 'ready', share } : { kind: 'gone' }),
      () => live && setState({ kind: 'gone' }),
    );
    return () => {
      live = false;
    };
  }, [sharedId, store, ask]);

  if (problem === 'unavailable')
    return (
      <Notice tone="info" title={<Trans>Open Kept once, then share again</Trans>}>
        <Trans>
          Kept wasn't ready to receive files on this device yet. It is now: go back to the other app
          and share again.
        </Trans>
      </Notice>
    );
  if (problem === 'failed' || problem === 'empty')
    return (
      <Notice tone="warn" title={<Trans>Nothing to keep from that share</Trans>}>
        <Trans>Kept takes photos and PDFs. Share those, or use Gallery.</Trans>
      </Notice>
    );
  if (!state || state.kind === 'loading') return null;
  if (state.kind === 'gone')
    return (
      <Notice tone="info" title={<Trans>That share has expired</Trans>}>
        <Trans>Share the files into Kept again.</Trans>
      </Notice>
    );
  const { share } = state;
  if (!store) return null;
  return (
    <>
      {!open ? (
        <Button onPress={() => setOpen(true)}>
          <Trans>Shared into Kept</Trans>
        </Button>
      ) : null}
      <SharedSheet
        share={share}
        keeping={keeping}
        isOpen={open}
        onClose={() => setOpen(false)}
        onDiscard={() => {
          void store.dropShared(share.id).then(onDone);
          setOpen(false);
        }}
        onKeep={
          onKeep
            ? (mode, name) => {
                if (inFlight.current) return;
                inFlight.current = true;
                setKeeping(true);
                void (async () => {
                  try {
                    if (!kept.current) {
                      await onKeep({ ...share, title: mode === 'thing' ? name : '' }, mode);
                      kept.current = true;
                    }
                    await store.dropShared(share.id);
                    setOpen(false);
                    onDone();
                  } catch {
                    setOpen(false);
                    toast({
                      title: t`Couldn't finish keeping this share. Check the name, room and available storage, then try again.`,
                      tone: 'danger',
                    });
                  } finally {
                    inFlight.current = false;
                    setKeeping(false);
                  }
                })();
              }
            : undefined
        }
      />
    </>
  );
}
