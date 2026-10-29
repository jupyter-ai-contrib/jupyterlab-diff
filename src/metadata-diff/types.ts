/**
 * Types and pure helpers for the metadata-driven cell diff feature.
 *
 * Any producer (an extension, a server-side component, a script) writes a
 * durable "pending diff" marker into a cell's metadata under a well-known key.
 * The frontend observes that marker and renders a live per-cell diff. Keeping
 * the marker parsing and the op -> (original, new) mapping as pure functions
 * makes them straightforward to unit test in isolation.
 */

/**
 * Default metadata key under which pending diff markers are written.
 */
export const DEFAULT_MARKER_KEY = 'jupyterlab-diff';

/**
 * The kind of change a marker represents.
 *
 * - `edit`: the cell source was modified in place.
 * - `add`: the cell was newly created.
 * - `delete`: the cell is marked for (soft) deletion; it still holds its
 *   original content.
 */
export type DiffOp = 'edit' | 'add' | 'delete';

/**
 * The set of valid diff operations.
 */
const VALID_OPS: ReadonlyArray<DiffOp> = ['edit', 'add', 'delete'];

/**
 * A pending diff marker stored in a cell's metadata.
 *
 * Producers may include additional fields for their own bookkeeping; the reader
 * ignores anything it does not recognize.
 */
export interface IDiffMarker {
  /**
   * The operation the marker represents.
   */
  op: DiffOp;

  /**
   * The source the cell held before the change.
   *
   * For an `add` this is conventionally the empty string; for an `edit` or a
   * `delete` it is the pre-change source.
   */
  original_source: string;
}

/**
 * The (original, new) source pair to feed a unified diff view for a marker.
 */
export interface IDiffSources {
  /**
   * The baseline source shown as "removed"/original in the diff.
   */
  originalSource: string;

  /**
   * The updated source shown as "added"/new in the diff.
   */
  newSource: string;
}

/**
 * Read a diff marker from a metadata map.
 *
 * @param metadata The full cell metadata map.
 * @param key The metadata key to read the marker from.
 * @returns The parsed marker, or `null` if absent or malformed (missing or
 *   invalid `op`).
 */
export function readMarker(
  metadata: Record<string, any> | null | undefined,
  key: string
): IDiffMarker | null {
  if (!metadata) {
    return null;
  }

  const raw = metadata[key];
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const op = raw.op;
  if (typeof op !== 'string' || !VALID_OPS.includes(op as DiffOp)) {
    return null;
  }

  const originalSource =
    typeof raw.original_source === 'string' ? raw.original_source : '';

  const marker: IDiffMarker = {
    op: op as DiffOp,
    original_source: originalSource
  };

  return marker;
}

/**
 * Compute the (original, new) source pair for a marker given the cell's live
 * source.
 *
 * The cell always already holds the *new* source (edits are applied in place),
 * so:
 * - `edit`: original = marker source, new = live source.
 * - `add`: original = '', new = live source.
 * - `delete`: original = marker source, new = '' (the cell is going away).
 *
 * Known v1 limitation (accepted): for a `delete`, `newSource` is `''`. When the
 * diff is rendered, the unified merge view writes this "new" side into the
 * cell's stored source, so a pending delete BLANKS the cell's saved content
 * while the diff is open (and persists blank if saved/reloaded). This is
 * recoverable — the original content lives in the marker's `original_source`
 * and is restored on reject or re-derived on reload. Not blanking the source
 * would require a bespoke render path; deferred past v1.
 *
 * @param marker The pending diff marker.
 * @param liveSource The cell's current source.
 */
export function computeDiffSources(
  marker: IDiffMarker,
  liveSource: string
): IDiffSources {
  switch (marker.op) {
    case 'add':
      return { originalSource: '', newSource: liveSource };
    case 'delete':
      return { originalSource: marker.original_source, newSource: '' };
    case 'edit':
    default:
      return { originalSource: marker.original_source, newSource: liveSource };
  }
}

/**
 * Whether the computed diff is a no-op (nothing actually changed).
 *
 * A content-identical edit produces an empty diff; the marker is spurious and
 * should be cleared rather than rendered.
 *
 * @param sources The computed (original, new) source pair.
 */
export function isNoOpDiff(sources: IDiffSources): boolean {
  return sources.originalSource === sources.newSource;
}
