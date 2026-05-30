# @spexor/results-hub

Shared results hub handler for Spexor.

It provides the HTTP request handler and runtime adapters used to ingest exported NDJSON run events and query scenario history from a central service.

## Notion store

`@spexor/results-hub/notion` exports a Notion-backed `SharedResultsStore`.
It keeps Spexor's shared results HTTP API unchanged while storing each run
event as a page in an existing Notion data source.

Required environment variables for the Notion runtime adapter:

- `NOTION_TOKEN`: Notion integration token with read, insert, and update content capabilities.
- `NOTION_DATA_SOURCE_ID`: Existing Notion data source ID for the results table.

The data source must expose these properties:

- `Event ID` title
- `Project ID` rich_text
- `Feature ID` rich_text
- `Scenario Key` rich_text
- `Scenario Title` rich_text
- `Run ID` rich_text
- `Tester` rich_text
- `Environment` rich_text
- `Status` select
- `Notes` rich_text
- `Created At` date
- `Attachments` rich_text
- `Source` rich_text

`Event ID` is used as the idempotency key. Re-ingesting the same event updates
the existing Notion page instead of creating a duplicate.

License: MIT
