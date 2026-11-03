// Profile photos, before they're uploaded: shrunk in the browser, and what to say when one can't be used.
// Used on the Profile page (your own photo) and by admins (anyone's: components/AdminGuestPhoto.tsx).
import { errorMessage } from "@/lib/hooks";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Scales a photo down to at most 800px (as a JPEG) so it uploads fast and loads fast. */
export async function shrinkPhoto(file: File, max = 800): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("NOT_AN_IMAGE");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Formats the browser can't draw (e.g. HEIC outside Safari): upload as is when allowed.
    if (PHOTO_TYPES.includes(file.type) && file.size <= 5 * 1024 * 1024) return file;
    throw new Error("UNREADABLE");
  }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("UNREADABLE"))), "image/jpeg", 0.85),
  );
}

/** What's wrong with the photo itself, in words; null when the problem is something else. */
export function photoProblem(message: string) {
  if (message === "NOT_AN_IMAGE") return "Choose a photo (JPG or PNG).";
  if (message === "UNREADABLE" || /mime|type/i.test(message)) return "That photo couldn't be read. Try a JPG or PNG.";
  if (/size|large/i.test(message)) return "That photo is too big. Try a smaller one.";
  return null;
}

export function photoError(e: unknown) {
  return photoProblem(errorMessage(e)) ?? "Couldn't upload the photo. Please try again.";
}
