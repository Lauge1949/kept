/**
 * "Shared into Kept" (D140). Opens on
 * `/capture?shared=<id>` with the files another app shared: RECEIPT by default for images and
 * PDFs, THING one tap away. The files wait in the offline store (pwa/share-target.ts) until they
 * are kept or discarded; closing the sheet leaves them there.
 *
 * `onKeep` turns the share into captures. It belongs to the capture pipeline (target place,
 * the THING photo policy, the queue); until it is passed, the sheet offers Discard only.
 */
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { CameraIcon, DocumentIcon } from '@/components/icons';
import { List } from '@/components/page';
import { Sheet } from '@/components/things/sheet';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import type { SharedInto } from '@/offline/store';

export type SharedMode = 'receipt' | 'thing';

export function SharedSheet({
  share,
  isOpen,
  onClose,
  onDiscard,
  onKeep,
  keeping = false,
}: {
  share: SharedInto;
  isOpen: boolean;
  onClose: () => void;
  onDiscard: () => void;
  keeping?: boolean;
  onKeep?: (mode: SharedMode, name: string) => void;
}) {
  const { t } = useLingui();
  const [mode, setMode] = useState<SharedMode>('receipt');
  const [name, setName] = useState(share.title ?? '');
  const count = share.files.length;
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t`Shared into Kept`}
    >
      <div className="grid gap-4">
        <p className="m-0 text-ink-2">
          <Plural value={count} one="# file arrived." other="# files arrived." />
          {share.title ? (
            <>
              {' '}
              <bdi className="text-ink">{share.title}</bdi>
            </>
          ) : null}
        </p>
        <List aria-label={t`Shared files`}>
          {share.files.map((f, i) => (
            <li
              // Two shared files can have the same name.
              // biome-ignore lint/suspicious/noArrayIndexKey: the list never reorders
              key={i}
              className="flex items-center gap-3 px-3.5 py-2.5"
            >
              {f.type === 'application/pdf' ? (
                <DocumentIcon aria-hidden="true" className="size-5 shrink-0 text-ink-2" />
              ) : (
                <CameraIcon aria-hidden="true" className="size-5 shrink-0 text-ink-2" />
              )}
              <bdi className="min-w-0 flex-1 text-[15px] [overflow-wrap:anywhere]">
                {f.name || t`Unnamed file`}
              </bdi>
            </li>
          ))}
        </List>
        <Segmented<SharedMode>
          label={t`Keep as`}
          value={mode}
          onChange={setMode}
          options={[
            { id: 'receipt', label: <Trans>Receipt</Trans> },
            { id: 'thing', label: <Trans>Thing</Trans> },
          ]}
        />
        {mode === 'thing' && count > 1 ? (
          <p>
            <Trans>Share one item at a time so each can have its own name.</Trans>
          </p>
        ) : null}
        {mode === 'thing' ? (
          <label className="grid gap-1">
            <Trans>Name</Trans>
            <input
              aria-label={t`Name`}
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-11 rounded-lg border border-line bg-surface px-3 text-[16px]"
            />
          </label>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {onKeep ? (
            <Button
              variant="primary"
              className="flex-1"
              isDisabled={keeping || (mode === 'thing' && (!name.trim() || count > 1))}
              onPress={() => onKeep(mode, name.trim())}
            >
              <Trans>Keep</Trans>
            </Button>
          ) : null}
          <Button variant="secondary" className="flex-1" isDisabled={keeping} onPress={onDiscard}>
            <Trans>Discard</Trans>
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
