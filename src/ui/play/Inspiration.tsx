/** The notes that drift up the sides of the screen while the character holds a Bardic Inspiration. */
const NOTES = [
  { glyph: "♪", left: 4, delay: 0, duration: 9, size: 1.5 },
  { glyph: "♫", left: 93, delay: 1.5, duration: 11, size: 1.9 },
  { glyph: "♩", left: 10, delay: 4, duration: 10, size: 1.3 },
  { glyph: "♬", left: 88, delay: 5.5, duration: 9, size: 1.6 },
  { glyph: "♪", left: 2, delay: 7, duration: 12, size: 1.8 },
  { glyph: "♫", left: 96, delay: 8.5, duration: 10, size: 1.4 },
];

/** The animated notes of the aura, for the Bardic Inspiration. */
export function BardNotes() {
  return (
    <>
      {NOTES.map((n) => (
        <i
          key={`${n.glyph}-${n.left}`}
          class="bard-note"
          style={{
            "--x": `${n.left}%`,
            "--delay": `${n.delay}s`,
            "--time": `${n.duration}s`,
            "--size": `${n.size}rem`,
          }}
        >
          {n.glyph}
        </i>
      ))}
    </>
  );
}
