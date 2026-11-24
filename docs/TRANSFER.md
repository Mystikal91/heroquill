# Moving to another device

The character menu has **Move to another device**: one file with the parts the person chooses,
opened on the other device with Import (or with the ordinary Import in the menu, which notices a
transfer file). Everything stays on the person's devices; the app uploads nothing, unless the person asks to save the file in their own Google Drive (see docs/GOOGLE_DRIVE.md).

## What a file can hold

| Part | In the file | Default |
| --- | --- | --- |
| `characters` | every saved character, with its play state | on |
| `encounters` | the fights of the DM mode (creatures, initiative, hit points, conditions and effects, notes), whole, and the campaigns they belong to (name and party) in `campaigns`, and the effects the DM saved to use again in `dmEffects` | on |
| `homebrew` | the homebrew packs, whole | on |
| `edits` | the quick edits of each language, whole (merged on import: the file wins per text) | on |
| `links` | the **addresses** of the packs imported from Aurora, with whether the 2024 versions were kept | on |
| `settings` | language, look, units, print options, and whether translation is on with its relay | on |
| `deeplKey` | the DeepL key | **off** |
| `translations` | the saved machine translations | off |

Packs imported from Aurora travel only as addresses: the app says it never exports or shares
that content, so the other device downloads it again (and on import the addresses are listed,
not followed: a button downloads them). A pack downloaded this way keeps the id it had, because the entries that characters use are named after it; and a character that still points at a pack under another id (a file made before this) is put right when the same entries are found in one other pack. A pack made from files has no address and cannot
travel; the file only names it, so the person knows what to select again.

On import the person chooses again which parts to bring in. Characters follow the rule of the
backup: one that is already here and the same is left alone, one with the same id that differs
becomes a copy. A fight of the DM mode follows the same choice: the same fight is left alone, and one with the
same id and other content is kept in both versions (the incoming one as a copy), or the newest wins, or the one
here is kept. A saved effect with the same id, or the same kind and name, takes the newest version, unless the choice is to keep the ones here. A homebrew pack with the same id is replaced.

## The file

```
{ "format": "dnd-character-maker-transfer", "version": 1, "exportedAt": "...",
  "characters": [...], "encounters": [...], "campaigns": [...], "dmEffects": [...], "homebrew": [...], "edits": [...],
  "links": [{ "id", "name", "url", "keepEditions" }], "files": ["name"],
  "settings": {...}, "deeplKey": "...", "translations": [["key", "text"]] }
```

Every part is optional. A part that cannot be read is skipped and counted.

## Protecting it

With a passphrase the whole file is encrypted: PBKDF2-SHA256 (210,000 rounds, a new 16-byte salt)
makes an AES-256-GCM key, with a new 12-byte nonce each time, using the browser's own crypto.
The result is `{ "format": "dnd-character-maker-sealed", ... }`; a wrong passphrase or a changed
file does not open. There is no way to recover a lost passphrase. Without one, the file is plain
text, so the DeepL key should only go in a protected file.

## Not done

Linking an account (Google Drive and the like) is not part of this. On a phone, **Share** hands
the file to the system share sheet, which can send it to Drive; on the other device, Import
reads it from Drive through the file picker.
