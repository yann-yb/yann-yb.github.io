import artwork from './blobmoji.json'

export function EmojiArtwork({ glyph }: { glyph: string }) {
  const hexcode = Array.from(glyph, character => character.codePointAt(0)!.toString(16).toUpperCase()).join('-')
  const src = (artwork as Record<string, string>)[hexcode]
  return src ? <img className="emoji-artwork" src={src} alt="" width="34" height="34" loading="lazy" /> : <span className="emoji-icon">{glyph}</span>
}
