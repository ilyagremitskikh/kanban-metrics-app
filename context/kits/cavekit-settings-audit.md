---
created: 2026-04-12T00:00:00Z
last_edited: 2026-04-12T00:00:00Z
---

# Cavekit: Settings Audit

## Scope

Add an n8n Base URL setting and fix hardcoded Jira base URL references across the application. Reorganize settings fields into labeled groups for clarity.

## Requirements

### R1: n8n Base URL Setting

**Description:** The settings page includes a field for the n8n Base URL. All API calls that previously used hardcoded or relative webhook paths construct full URLs using this setting value.

**Acceptance Criteria:**
- [ ] An "n8n Base URL" input field exists on the settings page
- [ ] The n8n Base URL value is persisted across sessions
- [ ] API calls for fetching Jira issues construct URLs as `{n8nBaseUrl}/webhook/jira/issues` (and similar paths)
- [ ] API calls for RICE scoring construct URLs as `{n8nBaseUrl}/webhook/rice-scoring` (and similar paths)
- [ ] Changing the n8n Base URL in settings causes all subsequent API calls to use the new value

**Dependencies:** None

### R2: Fix Jira Base URL Propagation

**Description:** Components that build Jira browse links currently use a hardcoded base URL constant. These must instead use the jiraBaseUrl value from settings.

**Acceptance Criteria:**
- [ ] The issues table component uses jiraBaseUrl from settings to construct Jira browse links (no hardcoded constant)
- [ ] The aging WIP component uses jiraBaseUrl from settings to construct Jira browse links (no hardcoded constant)
- [ ] The RICE scoring component uses jiraBaseUrl from settings to construct Jira browse links (no hardcoded constant)
- [ ] Changing jiraBaseUrl in settings updates all Jira browse links in all three components

**Dependencies:** None

### R3: Settings Page Grouping

**Description:** Settings fields are organized into labeled groups by purpose for easier navigation.

**Acceptance Criteria:**
- [ ] Settings fields are organized into three visually distinct groups
- [ ] Group 1 is labeled and contains: webhook URL, throughput webhook URL
- [ ] Group 2 is labeled and contains: n8n Base URL, Jira Base URL
- [ ] Group 3 is labeled and contains: mode selector, project key / custom JQL, issue type filters
- [ ] Each group has a visible heading

**Dependencies:** R1

## Out of Scope

- Validating that the n8n Base URL is reachable before saving
- Migration of existing saved settings to the new schema
- Authentication or credentials management for n8n or Jira

## Cross-References

- See also: [cavekit-dynamic-issue-types](cavekit-dynamic-issue-types.md) -- the issue type filter checkboxes in settings Group 3 are governed by dynamic-issue-types R5
