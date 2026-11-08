# My Work — status warnings and KPI placement

## Decision
Do not repeat storage, demo, or record-load warnings across every business page. Keep the underlying fail-closed editing and analysis guards unchanged. Surface setup and connection information in **My Business**. Surface incomplete-record warnings in the affected executive views (Overview, Opportunities, Decisions, My AI Team) when an actual load error occurs. Preserve the underlying error detail in My Business.

Executive cards for Open pipeline, Decisions pending, and Team assignments belong on **Overview** only. Their numbers are calculated from the active workspace records, not a live external CRM; zero can mean no saved records and must not be interpreted as no company activity.

## Warning meanings
- `DEMO / LOCAL PLANNING`: no active authenticated cloud workspace; not proof of missing or deleted records.
- `Secure storage is not ready`: editing is locked while workspace authentication/setup/loading is incomplete; data is not silently persisted only in browser.
- `Some records could not be loaded`: should be displayed only when an actual selected workspace record-load error is present; financial totals and AI analysis must not be treated as complete.

## Implementation
Commit `81276f639a027d1f0e5a60730c9696ee9144cc9a` scopes the UI to the relevant sections. No security or data-completeness check is disabled. Verify the production build and signed-in UI before treating this as fully accepted.
