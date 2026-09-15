import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeDiffSources,
  DEFAULT_MARKER_KEY,
  isNoOpDiff,
  readMarker
} from '../src/metadata-diff/types.ts';

const KEY = DEFAULT_MARKER_KEY;

test('readMarker: valid edit marker', () => {
  const marker = readMarker(
    { [KEY]: { op: 'edit', original_source: 'x = 1' } },
    KEY
  );
  assert.deepEqual(marker, { op: 'edit', original_source: 'x = 1' });
});

test('readMarker: unrecognized fields are ignored', () => {
  const marker = readMarker(
    { [KEY]: { op: 'add', original_source: '', producedBy: 'some-app' } },
    KEY
  );
  assert.deepEqual(marker, {
    op: 'add',
    original_source: ''
  });
});

test('readMarker: missing key returns null', () => {
  assert.equal(readMarker({}, KEY), null);
  assert.equal(readMarker(null, KEY), null);
  assert.equal(readMarker(undefined, KEY), null);
});

test('readMarker: invalid/missing op returns null', () => {
  assert.equal(readMarker({ [KEY]: { original_source: 'x' } }, KEY), null);
  assert.equal(
    readMarker({ [KEY]: { op: 'move', original_source: 'x' } }, KEY),
    null
  );
  assert.equal(readMarker({ [KEY]: { op: 42 } }, KEY), null);
  assert.equal(readMarker({ [KEY]: 'not-an-object' }, KEY), null);
});

test('readMarker: non-string original_source defaults to empty', () => {
  const marker = readMarker({ [KEY]: { op: 'edit' } }, KEY);
  assert.deepEqual(marker, { op: 'edit', original_source: '' });
});

test('computeDiffSources: edit uses marker source vs live source', () => {
  const sources = computeDiffSources(
    { op: 'edit', original_source: 'old' },
    'new'
  );
  assert.deepEqual(sources, { originalSource: 'old', newSource: 'new' });
});

test('computeDiffSources: add uses empty original vs live source', () => {
  const sources = computeDiffSources(
    { op: 'add', original_source: '' },
    'added'
  );
  assert.deepEqual(sources, { originalSource: '', newSource: 'added' });
});

test('computeDiffSources: delete uses marker source vs empty', () => {
  const sources = computeDiffSources(
    { op: 'delete', original_source: 'doomed' },
    'doomed'
  );
  assert.deepEqual(sources, { originalSource: 'doomed', newSource: '' });
});

test('isNoOpDiff: true when both sides identical', () => {
  assert.equal(isNoOpDiff({ originalSource: 'x', newSource: 'x' }), true);
});

test('isNoOpDiff: false when sides differ', () => {
  assert.equal(isNoOpDiff({ originalSource: 'x', newSource: 'y' }), false);
});

test('isNoOpDiff: empty structural-op edge is a no-op at the pure level', () => {
  // A delete of an already-empty cell (original === '') maps to '' vs '', and
  // an add of an empty cell maps to '' vs ''. isNoOpDiff reports true for both;
  // the observer must therefore gate the no-op short-circuit to op === 'edit'
  // so structural ops are not silently dropped.
  const emptyDelete = computeDiffSources(
    { op: 'delete', original_source: '' },
    ''
  );
  const emptyAdd = computeDiffSources({ op: 'add', original_source: '' }, '');
  assert.equal(isNoOpDiff(emptyDelete), true);
  assert.equal(isNoOpDiff(emptyAdd), true);
});
