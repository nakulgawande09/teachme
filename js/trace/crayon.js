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
     not make the browser warn about readback on every accepted stroke. */
  const store = document.createElement('canvas');
  store.width = canvas.width;
  store.height = canvas.height;
  const storeCtx = store.getContext('2d');
  let hasSnapshot = false;

  return {
    /** Colour shifts every five segments — a rainbow crayon, within a stroke. */
    draw(from, to) {
      ctx.strokeStyle = CRAY[Math.floor(segment / 5) % CRAY.length];
      ctx.lineWidth = Math.max(11, slate * 0.047);
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(from[0], from[1]);
      ctx.lineTo(to[0], to[1]);
      ctx.stroke();
      ctx.globalAlpha = 1;
      segment++;
    },

    /* The store canvas is in DEVICE pixels (it mirrors canvas.width/height)
       while drawing happens in CSS pixels under the transform. Both sides of
       the copy use the device size, so nothing needs scaling — and getting
       that wrong is invisible at 1x and visibly broken on a 3x phone. */
    snap() {
      if (!storeCtx) return;
      storeCtx.clearRect(0, 0, store.width, store.height);
      storeCtx.drawImage(canvas, 0, 0);
      hasSnapshot = true;
    },

    /** Wipe the rejected stroke but restore everything already accepted. */
    rollback() {
      ctx.clearRect(0, 0, slate, slate);
      if (!hasSnapshot) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(store, 0, 0);
      ctx.restore();
    },

    clear() {
      ctx.clearRect(0, 0, slate, slate);
      storeCtx?.clearRect(0, 0, store.width, store.height);
      hasSnapshot = false;
      segment = 0;
    },
  };
}
