export type CurrentUser = {
  id: string;
  email: string;
  household_id: string;
  household_member_count: number;
};

export type ShoppingListItemStatus = "needs_review" | "confirmed";

export type ShoppingListItem = {
  id: string;
  household_id: string;
  staple_id: string | null;
  name: string;
  quantity: string;
  status: ShoppingListItemStatus;
  created_at: string;
  updated_at: string;
};

export type Staple = {
  id: string;
  household_id: string;
  name: string;
  quantity: string;
  interval_days: number;
  last_resolved_at: string | null;
  eligible_at: string;
  created_at: string;
  updated_at: string;
};

export type StaplePayload = {
  name: string;
  quantity: string;
  interval_days: number;
};

export type PromotionResult = {
  promoted_count: number;
};

export type Invitation = {
  id: string;
  household_id: string;
  household_name: string;
  user_id: string;
  user_email: string;
  status: "pending" | "member";
  created_at: string;
};

export type AppConfig = {
  dev_login_enabled: boolean;
  google_oauth_enabled: boolean;
};

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
export const API_BASE_URL = configuredApiBaseUrl || "/api";

function buildUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getHouseholdEventsUrl(): string {
  return buildUrl("/events");
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
    credentials: "include",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      message = payload.detail ?? message;
    } catch {
      // Some responses, especially 204s and proxy errors, do not include JSON.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function devLogin(email: string): Promise<{ user: Pick<CurrentUser, "id" | "email"> }> {
  const params = new URLSearchParams({ email });
  return request(`/dev/login?${params.toString()}`);
}

export function getConfig(): Promise<AppConfig> {
  return request<AppConfig>("/config");
}

export function logout(): Promise<void> {
  return request<void>("/auth/logout", {
    method: "POST",
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await request<CurrentUser>("/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export function getShoppingList(): Promise<ShoppingListItem[]> {
  return request<ShoppingListItem[]>("/shopping-list");
}

export function getStaples(): Promise<Staple[]> {
  return request<Staple[]>("/staples");
}

export function createStaple(payload: StaplePayload): Promise<Staple> {
  return request<Staple>("/staples", {
    method: "POST",
    body: payload,
  });
}

export function updateStaple(stapleId: string, payload: Partial<StaplePayload>): Promise<Staple> {
  return request<Staple>(`/staples/${stapleId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteStaple(stapleId: string): Promise<void> {
  return request<void>(`/staples/${stapleId}`, {
    method: "DELETE",
  });
}

export function promoteAllStaples(): Promise<PromotionResult> {
  return request<PromotionResult>("/staples/promote-all", {
    method: "POST",
  });
}

export function listIncomingInvitations(): Promise<Invitation[]> {
  return request<Invitation[]>("/invitations");
}

export function listOutgoingInvitations(): Promise<Invitation[]> {
  return request<Invitation[]>("/households/invitations");
}

export function inviteUser(email: string): Promise<Invitation> {
  return request<Invitation>("/households/invitations", {
    method: "POST",
    body: { email },
  });
}

export function cancelInvitation(invitationId: string): Promise<void> {
  return request<void>(`/households/invitations/${invitationId}`, {
    method: "DELETE",
  });
}

export function acceptInvitation(invitationId: string): Promise<void> {
  return request<void>(`/invitations/${invitationId}/accept`, {
    method: "POST",
  });
}

export function declineInvitation(invitationId: string): Promise<void> {
  return request<void>(`/invitations/${invitationId}/decline`, {
    method: "POST",
  });
}

export function leaveHousehold(): Promise<void> {
  return request<void>("/households/leave", {
    method: "POST",
  });
}

export function addOneOffItem(payload: { name: string; quantity: string }): Promise<ShoppingListItem> {
  return request<ShoppingListItem>("/shopping-list/items", {
    method: "POST",
    body: payload,
  });
}

export function confirmItem(itemId: string): Promise<ShoppingListItem> {
  return request<ShoppingListItem>(`/shopping-list/items/${itemId}/confirm`, {
    method: "POST",
  });
}

export function skipItem(itemId: string): Promise<void> {
  return request<void>(`/shopping-list/items/${itemId}/skip`, {
    method: "POST",
  });
}

export function purchaseItem(itemId: string): Promise<void> {
  return request<void>(`/shopping-list/items/${itemId}/purchase`, {
    method: "POST",
  });
}
