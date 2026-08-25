/** The child's crayon. Shared by both engines so they draw identically. */

export const CRAY = Object.freeze(['#BE3F2C', '#E0A02A', '#5E8B3A', '#14706B', '#313B77']);

export function createCrayon(canvas, slate) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = slate * dpr;
  canvas.height = slate * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('crayon: no 2d context');
    return null;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let segment = 0;

  /* Snapshots go through a second canvas and drawImage rather than
     getImageData/putImageData. Same result, but it stays on the GPU and does
     not make the browser warn about readback on every accepted stroke.
     Two stores: `store` holds the accepted strokes (rollback target when a
     whole stroke is thrown out) and `gstore` holds the canvas as it stood
     when the current gesture began (rollback target for one wiped gesture). */
  const mkStore = () => {
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    return [c, c.getContext('2d')];
  };
  const [store, storeCtx] = mkStore();
  const [gstore, gstoreCtx] = mkStore();
  let hasSnapshot = false;
  let hasGesture = false;

  const restore = (from) => {
    ctx.clearRect(0, 0, slate, slate);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(from, 0, 0);
    ctx.restore();
  };

  return {
    /** One polyline per input batch — a single beginPath/stroke covers every
     *  coalesced point of the frame, instead of a canvas pass per point.
     *  Colour shifts every few batches — a rainbow crayon, within a stroke. */
    drawLine(from, points) {
      if (!points.length) return;
      ctx.strokeStyle = CRAY[Math.floor(segment / 5) % CRAY.length];
      ctx.lineWidth = Math.max(11, slate * 0.047);
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(from[0], from[1]);
      for (const p of points) ctx.lineTo(p[0], p[1]);
      ctx.stroke();
      ctx.globalAlpha = 1;
      segment++;
    },

    /* The store canvases are in DEVICE pixels (they mirror canvas.width/
       height) while drawing happens in CSS pixels under the transform. Both
       sides of each copy use the device size, so nothing needs scaling — and
       getting that wrong is invisible at 1x and visibly broken on a 3x phone. */
    snap() {
      if (!storeCtx) return;
      storeCtx.clearRect(0, 0, store.width, store.height);
      storeCtx.drawImage(canvas, 0, 0);
      hasSnapshot = true;
    },

    /** Remember the canvas as it stands at the start of a gesture. */
    snapGesture() {
      if (!gstoreCtx) return;
      gstoreCtx.clearRect(0, 0, gstore.width, gstore.height);
      gstoreCtx.drawImage(canvas, 0, 0);
      hasGesture = true;
    },

    /** Wipe the rejected stroke but restore everything already accepted. */
    rollback() {
      ctx.clearRect(0, 0, slate, slate);
      if (hasSnapshot) restore(store);
    },

    /** Wipe only the gesture in progress — a scribble that followed nothing —
     *  keeping every earlier, productive dab of the same stroke. */
    rollbackGesture() {
      ctx.clearRect(0, 0, slate, slate);
      if (hasGesture) restore(gstore);
    },

    clear() {
      ctx.clearRect(0, 0, slate, slate);
      storeCtx?.clearRect(0, 0, store.width, store.height);
      gstoreCtx?.clearRect(0, 0, gstore.width, gstore.height);
      hasSnapshot = false;
      hasGesture = false;
      segment = 0;
    },
  };
}
