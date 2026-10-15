import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR } from "./store";

// Uploaded documents are stored by content hash. Medical documents are sensitive:
// they are never served on the public campaign page, only to the organizer, the hospital
// and the reviewer views (see /api/docs/[id]).

const DIR = path.join(DATA_DIR, "uploads");
export const MAX_BYTES = 8 * 1024 * 1024;
export const ALLOWED = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;

export function sha256(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function extFor(mime: string) {
  return mime === "application/pdf" ? "pdf" : mime.split("/")[1].replace("jpeg", "jpg");
}

export function sniffMime(buf: Buffer): string | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}

export async function storeFile(buf: Buffer): Promise<{ sha256: string; mime: string; size: number }> {
  const mime = sniffMime(buf);
  if (!mime) throw new Error("Unsupported file. Upload a PNG, JPEG, WebP or PDF.");
  if (buf.length > MAX_BYTES) throw new Error("File is larger than 8 MB.");
  const hash = sha256(buf);
  await fs.mkdir(DIR, { recursive: true });
  const p = path.join(DIR, `${hash}.${extFor(mime)}`);
  await fs.writeFile(p, buf);
  return { sha256: hash, mime, size: buf.length };
}

export async function readFile(hash: string, mime: string): Promise<Buffer> {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("bad hash");
  return fs.readFile(path.join(DIR, `${hash}.${extFor(mime)}`));
}
