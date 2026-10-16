import sharp from "sharp";

// Visual fingerprint of a page image, so a re-saved, re-scanned or cropped copy of a document
// is recognised even though its bytes (and SHA-256) are different.
//
// How: trim the blank margins (so cropping and scaling don't matter), shrink the page to a
// 64×90 "ink map" (how dark each cell is), and compare two maps by correlation.
// Measured on the sample documents (tests/attacks.test.ts): a cropped, re-saved JPEG scores
// 0.98 and a slightly rotated, darker re-shoot 0.80, while different documents — including two
// patients' pages from the same hospital template — score 0.46 or less.
//
// A plain difference-hash was tried first and rejected: sparse pages (an ID card, a clinical
// note) are mostly white, so their hashes agreed ~96% with each other.

const W = 64;
const H = 90;
export const LOOKALIKE_MIN = 0.75;

export async function visualHash(buf: Buffer, mime: string): Promise<string | undefined> {
  if (!mime.startsWith("image/")) return undefined; // PDFs: rely on SHA-256 and document numbers
  try {
    const trimmed = await sharp(buf).grayscale().trim({ threshold: 30 }).toBuffer();
    const { data } = await sharp(trimmed).resize(W, H, { fit: "fill", kernel: "cubic" }).raw().toBuffer({ resolveWithObject: true });
    return Buffer.from(data.map((v) => 255 - v)).toString("base64");
  } catch {
    return undefined;
  }
}

/** Correlation of two ink maps: ~1 for the same page, ≤0.5 for different documents. */
export function visualSimilarity(a?: string, b?: string): number {
  if (!a || !b) return 0;
  const x = Buffer.from(a, "base64");
  const y = Buffer.from(b, "base64");
  if (x.length !== y.length || !x.length) return 0;
  const n = x.length;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

export const looksAlike = (a?: string, b?: string) => visualSimilarity(a, b) >= LOOKALIKE_MIN;
