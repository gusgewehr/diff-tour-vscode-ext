# Real tour fixtures

Generated headless on Windows 11 with `tour.exe --json --llm claude-code --lang en` driven by `scripts/headless-run.mjs`.
Source repo: upstream diff-tour (https://github.com/init-co-jp/diff-tour). The refs resolve only inside that repository
(`--repo <clone>`). Each `.progress.jsonl` is the raw JSONL v1 stream of the run; the last line is the `done` event.
All fixtures pass `tour.exe --dump --plain --repo <clone> <file>` (tour.Load + Validate).

| Fixture | Target | baseSha | headSha | Files | Repairs | Cost | Duration | Prompt |
|---|---|---|---|---|---|---|---|---|
| real-b146230.json | b146230^..b146230 | bc6d3c41...dd960 | b146230e...f9df | 11 | 0 | $1.94 | 399 s | v6 |
| real-9cbe3d2.json | 9cbe3d2^..9cbe3d2 | b146230e...f9df | 9cbe3d28a35a0aaabf23968add06e6dd770a396a | 14 | 0 | $1.83 | 396 s | v6 |
| real-9c18e24.json | 9c18e24^..9c18e24 | c74612e9b7ad3384e3ec604eabafac5b7c4024cf | 9c18e24a8245ea4aaa4c418bc54a82cc4cec4ab4 | 16 | 0 | $2.24 | 474 s | v7 (flow nodes carry file/lines) |

Full SHAs are in each `.progress.jsonl` done event. d05c686 was dropped (only 5 files); 9cbe3d2 replaced it.

## Notes

- First 9c18e24 attempt failed with `llm`: "Opus 5.5's safeguards flagged this message" (AUP false positive). Retried once with the same target and it passed (v6, 361 s). That v6 tour was later replaced by the v7 regeneration (CLI-07 fallback, see docs/decisions/flow-mapping.md).
- Cache re-run of b146230: `stage show done` + `done` with `cached:true`, 0.26 s, no LLM call.

## Cancel tests (CLI-05, target 9cbe3d2, tour-spawned claude.exe counted by `--permission-prompts none` in its command line)

- stdin closed after 45 s (stage + read events seen): last line `{"code":"cancelled","message":"context canceled"}`, exit 1, claude count 0, export dir removed.
- tour.exe hard-killed (TerminateProcess, no tree) after 45 s: claude count 0 after 10 s (Job Object); export dir `work/2853efb3fb7f8dc30d8cdf00` remained as expected.
- Next run of the same target (stdin closed after 5 s): `cancelled`, claude count 0, the work dir was removed.
