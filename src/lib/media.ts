// Rendition helper — scripts/media-pipeline.mjs emits "-p-500"/"-p-800"
// copies next to every full-size image in /media/. Callers pair this with
// an onError fallback to the original file.
export function rendition(url: string, width: 500 | 800): string {
  if (!url || url.startsWith('data:')) return url
  return url.replace(/(\.(?:png|jpe?g|webp|avif))$/i, `-p-${width}$1`)
}
