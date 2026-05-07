import { expect, test, type Page, type TestInfo } from "@playwright/test";

const authenticatedUser = {
  id: "user-1",
  email: "person@example.com",
  household_id: "household-1",
  household_member_count: 2,
};

const shoppingListItems = [
  {
    id: "item-1",
    household_id: "household-1",
    staple_id: "staple-1",
    name: "Coffee",
    quantity: "1 bag",
    status: "confirmed",
    created_at: "2026-05-01T12:00:00.000Z",
    updated_at: "2026-05-01T12:00:00.000Z",
  },
  {
    id: "item-2",
    household_id: "household-1",
    staple_id: null,
    name: "Bananas",
    quantity: "6",
    status: "needs_review",
    created_at: "2026-05-01T12:00:00.000Z",
    updated_at: "2026-05-01T12:00:00.000Z",
  },
];

const staples = [
  {
    id: "staple-1",
    household_id: "household-1",
    name: "Coffee",
    quantity: "1 bag",
    interval_days: 14,
    last_resolved_at: "2026-04-24T12:00:00.000Z",
    eligible_at: "2026-05-08T12:00:00.000Z",
    created_at: "2026-04-01T12:00:00.000Z",
    updated_at: "2026-04-24T12:00:00.000Z",
  },
  {
    id: "staple-2",
    household_id: "household-1",
    name: "Oat milk",
    quantity: "2 cartons",
    interval_days: 7,
    last_resolved_at: "2026-05-01T12:00:00.000Z",
    eligible_at: "2026-05-08T12:00:00.000Z",
    created_at: "2026-04-01T12:00:00.000Z",
    updated_at: "2026-05-01T12:00:00.000Z",
  },
];

const pendingInvitation = {
  id: "invitation-1",
  household_id: "household-2",
  household_name: "Roommates",
  user_id: "user-2",
  user_email: "roommate@example.com",
  status: "pending",
  created_at: "2026-05-01T12:00:00.000Z",
};

const outgoingInvitation = {
  ...pendingInvitation,
  id: "outgoing-invitation-1",
  household_id: "household-1",
  household_name: "Household",
  user_email: "friend@example.com",
};

const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 800 },
];

const routes = [
  { name: "sign-in", path: "/sign-in", authenticated: false, heading: "Household" },
  { name: "invite", path: "/invite", authenticated: true, hasIncomingInvitation: true, heading: "You have been invited" },
  { name: "list", path: "/list", authenticated: true, heading: "Shopping list" },
  { name: "staples", path: "/staples", authenticated: true, heading: "Staples" },
  { name: "settings", path: "/settings", authenticated: true, heading: "Household" },
];

test.describe("visual smoke", () => {
  for (const route of routes) {
    for (const viewport of viewports) {
      test(`${route.name} renders at ${viewport.name}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await installMockEventSource(page);
        await mockApi(page, {
          authenticated: route.authenticated,
          hasIncomingInvitation: route.hasIncomingInvitation ?? false,
        });

        await page.goto(route.path);
        await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible();

        await captureScreenshot(page, testInfo, `${route.name}-${viewport.name}.png`);
      });
    }
  }
});

async function installMockEventSource(page: Page) {
  await page.addInitScript(() => {
    class MockEventSource extends EventTarget {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSED = 2;

      readonly url: string;
      readonly withCredentials: boolean;
      readyState = MockEventSource.OPEN;

      constructor(url: string | URL, init?: EventSourceInit) {
        super();
        this.url = String(url);
        this.withCredentials = Boolean(init?.withCredentials);
        setTimeout(() => this.dispatchEvent(new Event("open")), 0);
      }

      close() {
        this.readyState = MockEventSource.CLOSED;
      }
    }

    window.EventSource = MockEventSource as unknown as typeof EventSource;
  });
}

async function mockApi(
  page: Page,
  options: {
    authenticated: boolean;
    hasIncomingInvitation: boolean;
  },
) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const path = normalizedApiPath(request.url());

    if (!path || !["fetch", "xhr"].includes(request.resourceType())) {
      await route.continue();
      return;
    }

    if (path === "/config") {
      await route.fulfill({ json: { dev_login_enabled: true, google_oauth_enabled: true } });
      return;
    }

    if (path === "/me") {
      if (!options.authenticated) {
        await route.fulfill({ status: 401, json: { detail: "Not authenticated" } });
        return;
      }

      await route.fulfill({ json: authenticatedUser });
      return;
    }

    if (path === "/shopping-list") {
      await route.fulfill({ json: shoppingListItems });
      return;
    }

    if (path === "/staples") {
      await route.fulfill({ json: staples });
      return;
    }

    if (path === "/invitations") {
      await route.fulfill({ json: options.hasIncomingInvitation ? [pendingInvitation] : [] });
      return;
    }

    if (path === "/households/invitations") {
      await route.fulfill({ json: [outgoingInvitation] });
      return;
    }

    await route.continue();
  });
}

function normalizedApiPath(rawUrl: string): string | null {
  const pathname = new URL(rawUrl).pathname.replace(/\/$/, "");
  const withoutApiPrefix = pathname.startsWith("/api/") ? pathname.slice(4) : pathname;
  const apiPaths = new Set(["/config", "/me", "/shopping-list", "/staples", "/invitations", "/households/invitations"]);

  return apiPaths.has(withoutApiPrefix) ? withoutApiPrefix : null;
}

async function captureScreenshot(page: Page, testInfo: TestInfo, fileName: string) {
  const path = testInfo.outputPath(fileName);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(fileName, { path, contentType: "image/png" });
}
