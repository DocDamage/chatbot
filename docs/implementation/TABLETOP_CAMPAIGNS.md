# Local tabletop campaigns

Open **D&D campaigns** in the application header. Create a campaign with a fixed
2014 or 2024 rules edition, add a character sheet, and start the adventure. The
campaign selector resumes saved narration, recaps, characters and world records.

## Play and persistence

- Dice, attacks, HP, temporary HP, spell-slot spending, hit-dice spending, initiative
  and rest recovery run on the server. Narrator output can update only the public
  scene, recap and dialogue. It cannot write a character sheet.
- Use the dice/attack controls when the narrator requests a check. `/roll 1d20+3`
  is also accepted in the campaign composer. Kept dice support advantage and
  disadvantage (`2d20kh1`, `2d20kl1`).
- Sheets explicitly configure attack bonuses, damage, hit dice, spell-slot maxima,
  conditions and inventory. This is a basic campaign engine, not an automatic
  implementation of every class feature, spell, condition or tactical rule.
  Encounter participants and their actions are managed through the controls.
- Saves and an append-only action ledger live in the existing `chatbot.db` under
  `tabletop_campaigns` and `tabletop_events`, so the existing WAL-safe scheduled
  backups include them. Optimistic versions reject stale/concurrent actions.
- Dialogue is retained up to 2,000 messages within the 2 MB save limit. An
  over-limit update fails without altering the prior save. Export full DM saves
  for independent archives; player exports deliberately cannot restore private
  campaign state.

## Player knowledge and DM notes

The owner can explicitly open **DM notes & records** to manage private notes,
hidden NPC/quest/location records and full sheets. The player projection removes
private notes, hidden records and NPC AC/HP. These private fields never enter the
player-facing model prompt. Revealing a record exposes its public description,
not its `dmSecret`.

Campaign narration may retrieve only the selected edition's Player's Handbook.
Raw adventure text and the rest of the private book library are not fed into
player-facing campaign turns. This prevents retrieval from automatically exposing
published adventure spoilers. The model still improvises; it is not an infallible
DM. This first workspace is owner-scoped solo play, not multiplayer membership or
an autonomous tactical agent.

## Upstream components and interoperability

Exact revisions, adaptations and full notices are under `services/tabletop`.

| Project | Used here |
| --- | --- |
| [Open Game Master](https://github.com/DocDamage/open-game-master) | MIT dice parser/roller, cryptographic randomness, kept dice, natural-roll and critical handling. |
| [Campfire](https://github.com/DocDamage/campfire) | MIT spell-slot expenditure and initiative tiebreak components; persistent campaign/visibility requirements; JSON NPC, quest and location import. |
| [Dungeon Master Tool](https://github.com/DocDamage/dungeon-master-tool) | Independently written reader for its published `.dmtz` format-1 world and JSON payload contracts. No Flutter code or assets are incorporated. Its upstream application is CC BY-NC 4.0. |

Imports create a new private campaign and new record identifiers. Imported world
records start hidden until revealed. DMT imports preserve entity names, public
descriptions and DM notes. Campfire imports preserve NPC/quest/location text,
private notes and supported quest status. Unsupported character rules, media,
relationships, memberships, mind-map layouts, schedules and combat saves remain
in the original export/application; the import result states this boundary.

Archive reads are bounded, accept only one `manifest.json` and `payload.json`, and
never extract media or follow archive paths on disk. Only format-1 DMT **world**
archives are accepted. A standalone character/package archive is rejected.

Full native Chatbot DM saves round-trip campaign records, sheets, edition,
recap and dialogue into a fresh owner-scoped campaign.
