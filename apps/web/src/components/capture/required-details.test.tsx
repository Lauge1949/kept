import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryStore } from '@/offline/store';
import { makeDexieStore } from '@/test/dexie';
import { renderUI } from '@/test/render';
import { firstPage } from '@/test/store-contract';
import { CaptureScreen } from './capture-screen';
import { enqueueCapture, removeCapturedThing } from './enqueue';

vi.mock('@/camera/grab', () => ({
  hasFrame: () => true,
  grabFrame: async () => ({
    original: new Blob(['jpeg'], { type: 'image/jpeg' }),
    display: null,
    previewUnavailable: false,
  }),
}));
const locationId = '01926f00-0000-7000-8000-00000000b002';
const placeId = '01926f00-0000-7000-8000-0000000c0091';
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 404 })),
  );
  HTMLMediaElement.prototype.play = vi.fn(async () => {});
});
afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});
async function setup(placed = true, ai = false) {
  const store = new MemoryStore();
  const page = firstPage();
  await store.applySnapshot({
    ...page,
    locations: page.locations.map((l) => ({ ...l, effectiveModules: ai ? ['ai_capture'] : [] })),
    changes: {
      ...page.changes,
      places: [
        ...page.changes.places,
        {
          id: placeId,
          locationId,
          parentId: null,
          name: 'Loftet',
          kindKey: 'room',
          icon: null,
          isUnplaced: false,
          sort: 1,
          deleted: false,
        },
      ],
    },
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = await renderUI(
    <QueryClientProvider client={qc}>
      <CaptureScreen
        store={store}
        personalLocationId={locationId}
        {...(placed ? { placeId } : {})}
        onExit={vi.fn()}
        onOpen={vi.fn()}
        camera={{
          secure: true,
          media: { getUserMedia: async () => ({ getTracks: () => [] }) as unknown as MediaStream },
        }}
        geo={null}
        detect={null}
        decode={async () => {
          throw new Error('no canvas');
        }}
      />
    </QueryClientProvider>,
  );
  await screen.findByRole('textbox', { name: 'Name' });
  return { ...result, store };
}
it.each([false, true])('requires a title before a camera capture, also with AI=%s', async (ai) => {
  const { user, store } = await setup(true, ai);
  const field = screen.getByRole('textbox', { name: 'Name' });
  expect(field).toBeRequired();
  await user.click(await screen.findByRole('button', { name: /^Take photo/ }));
  expect(await screen.findByText('Enter a name before saving.')).toBeInTheDocument();
  expect(await store.pending()).toHaveLength(0);
  await user.type(field, '  ');
  await user.keyboard('{Enter}');
  expect(await store.pending()).toHaveLength(0);
  await user.clear(field);
  await user.type(field, 'Kommode');
  await user.click(screen.getByRole('button', { name: /^Take photo/ }));
  await waitFor(async () => expect(await store.pending()).toHaveLength(1));
  expect((await store.pending())[0]?.payload).toMatchObject({
    name: 'Kommode',
    target: { placeId },
  });
  expect(field).toHaveValue('');
});
it('refuses Unplaced and preserves the title while choosing a room', async () => {
  const { user, store } = await setup(false);
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Kommode{Enter}');
  expect(await store.pending()).toHaveLength(0);
  expect(screen.getByRole('textbox', { name: 'Name', hidden: true })).toHaveValue('Kommode');
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});
it('validates gallery imports and passes the typed title into the queue', async () => {
  const { user, store } = await setup();
  const input = [...document.querySelectorAll<HTMLInputElement>('input[type=file]')].find(
    (i) => i.multiple,
  );
  if (!input) throw new Error('Gallery input missing');
  const photo = () => new File(['photo'], 'image.jpg', { type: 'image/jpeg' });
  await user.upload(input, photo());
  expect(await store.pending()).toHaveLength(0);
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Kommode');
  await user.upload(input, photo());
  await waitFor(async () => expect(await store.pending()).toHaveLength(1));
  expect((await store.pending())[0]?.payload).toMatchObject({
    name: 'Kommode',
    target: { placeId },
  });
});
it('deletes just one queued capture and keeps the rest of the session', async () => {
  const { user, store } = await setup();
  const field = screen.getByRole('textbox', { name: 'Name' });
  await user.type(field, 'Kommode{Enter}');
  await waitFor(async () => expect(await store.pending()).toHaveLength(1));
  await user.type(field, 'Lampe{Enter}');
  await waitFor(async () => expect(await store.pending()).toHaveLength(2));
  await user.click(screen.getByRole('button', { name: 'Done' }));
  await user.click(await screen.findByRole('button', { name: 'Delete capture: Kommode' }));
  const dialog = await screen.findByRole('alertdialog');
  await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
  await waitFor(async () => expect(await store.pending()).toHaveLength(1));
  expect((await store.pending())[0]?.payload).toMatchObject({ name: 'Lampe' });
  expect(screen.getByRole('button', { name: 'Delete capture: Lampe' })).toBeInTheDocument();
});

it('keeps dependent photos when sync claimed the root before deletion', async () => {
  const store = new MemoryStore();
  vi.spyOn(store, 'pending').mockResolvedValue([
    { idempotencyKey: 'root', state: 'pending' },
    { idempotencyKey: 'child', state: 'pending', dependsOn: ['root'] },
  ] as never);
  const unqueue = vi.spyOn(store, 'unqueue').mockResolvedValue([]);
  const trash = vi.fn();
  await expect(removeCapturedThing(store, 'id', 'root', [], trash)).rejects.toThrow(
    'Capture sync started',
  );
  expect(unqueue).toHaveBeenCalledExactlyOnceWith(['root', 'child'], 'root');
  expect(trash).not.toHaveBeenCalled();
});
it('does not remove photos if the synced item cannot be trashed', async () => {
  const store = new MemoryStore();
  vi.spyOn(store, 'pending').mockResolvedValue([]);
  const unqueue = vi.spyOn(store, 'unqueue');
  await expect(
    removeCapturedThing(store, 'id', 'root', [], async () => {
      throw new Error('offline');
    }),
  ).rejects.toThrow('offline');
  expect(unqueue).not.toHaveBeenCalled();
});
it('blocks multi-photo gallery imports instead of silently making duplicate items', async () => {
  const { user, store } = await setup();
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Kommode');
  const input = [...document.querySelectorAll<HTMLInputElement>('input[type=file]')].find(
    (i) => i.multiple,
  );
  if (!input) throw new Error('Gallery input missing');
  await user.upload(input, [
    new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
    new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
  ]);
  expect(await store.pending()).toHaveLength(0);
  expect(
    await screen.findByText('Choose one photo at a time and give each item a name.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Kommode');
});

it.each(['pending', 'uploading', 'sent'] as const)(
  'atomically guards root and child removal in IndexedDB when root is %s',
  async (state) => {
    const store = makeDexieStore();
    const root = await enqueueCapture(store, {
      target: { locationId, placeId, containerId: null },
      batchId: locationId,
      mode: 'thing',
      name: 'Kommode',
      image: null,
    });
    const child = await enqueueCapture(store, {
      target: { locationId, placeId, containerId: null },
      batchId: locationId,
      mode: 'thing',
      image: null,
      attachToThingId: root.id,
      dependsOn: [root.idempotencyKey],
    });
    const rootEntry = (await store.pending())[0];
    if (!rootEntry) throw new Error('Missing root');
    await store.setState([rootEntry.seq], state);
    const removed = await store.unqueue(
      [root.idempotencyKey, child.idempotencyKey],
      root.idempotencyKey,
    );
    if (state === 'pending') {
      expect(removed).toEqual([root.idempotencyKey, child.idempotencyKey]);
      expect(await store.pending()).toHaveLength(0);
    } else {
      expect(removed).toEqual([]);
      expect(await store.pending()).toHaveLength(2);
    }
    store.db.close();
  },
);
