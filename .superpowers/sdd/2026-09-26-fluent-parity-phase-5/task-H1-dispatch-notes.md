# Task H1 — real-browser checklist additions (collected by the controller during waves A–B)

Add these to the spec's §6.3 checklist run (`/browser-check`), each with its observed result:

1. **Listbox pointer press (A5, D17):** in Chromium and Firefox, a press on an option of an unfocused, scrolled standalone Listbox focuses the list and activates the pressed option in one render, without the list scrolling under the pointer; the click then selects it.
2. **Right/middle mouse press on a Listbox option (A5 minor):** it focuses the list and activates the option but selects nothing; decide whether to ignore non-primary buttons (`event.button === 0`) — record the decision.
3. **Multi-select option box (A6):** the checkbox box in light, dark, high-contrast and Windows forced colours (GrayText for disabled, Highlight fill for checked); a custom `checkIcon` glyph fits the 16px box.
4. **Multi-select announcements (B1/B2, D41):** NVDA/JAWS/VoiceOver announce each toggle once (`Apple added, 1 selected`), not a clear, a reset or a controlled change.
5. **Multi-select Combobox input (B2, D11, ruling R16):** with "Apple, Banana" selected — typing a letter that equals the labels' first or last letter (`a`, `A`), paste, cut, drag-and-drop text, undo, autocorrect/dictation where available, and an IME composition (Japanese/Chinese) over the selected labels each yield the query the edit inserted, and the composition is never interrupted; the same right after a toggle.
6. **Escape hand-off of a custom picker (A6 note):** a custom picker built from the docs closes on Escape and hands Escape to an enclosing Dialog while it shows nothing, and ignores Escape during an IME composition.
7. **Multi-select Combobox after a toggle (B2 review, R18):** the labels are selected again after a toggle, Escape and a reset; an IME composition started right after a toggle keeps its text; whether screen readers announce the re-selection (acceptable, or noisy?).
8. **Typing text identical to the whole labels (B2 review):** with sizes S/M/L and M selected, typing `M` over the selected labels changes no value, so React fires no change: note what happens (list closed? Enter submits?) and file a backlog item if it matters.
