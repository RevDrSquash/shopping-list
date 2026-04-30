# Known Issues

## Scheduled Promotions Do Not Broadcast SSE Events

**Status**: Known Phase 4 gap

The PRD's real-time sync requirement says all writes should broadcast an event so connected clients update without a manual refresh. The current Phase 4 implementation broadcasts events after user/API writes, but the scheduled promotion job runs in a separate process and does not broadcast when it adds eligible staples to shopping lists.

Impact:

- Open browser sessions will not see cron-promoted `needs_review` items immediately.
- Users will see those promoted items after a manual refresh, page reload, or another household write that triggers a real-time refresh.

Reason:

- The SSE broadcaster is currently in-process on the FastAPI service.
- Railway cron promotion is expected to run as a separate process, so it cannot reliably notify the API process's in-memory subscribers.

Likely fix:

- Add a shared broker or event store, such as Redis pub/sub or database-backed notifications, and have both API requests and scheduled jobs publish household change events through it.
