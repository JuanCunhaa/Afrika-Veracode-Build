# Private dependency fixtures (stubs)

Prepared for future local/mocked registry tests:

- `maven/` — settings.xml pointing to a local mock repo (no credentials committed)
- `nuget/` — nuget.config with placeholder source
- `npm/` — .npmrc with env-var token name only

Do **not** commit real tokens.
