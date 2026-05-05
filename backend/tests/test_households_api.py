import queue
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.models import Household, Membership, MembershipStatus, ShoppingListItem, ShoppingListItemStatus, Staple, User
from app.db.session import get_sessionmaker
from app.services.events import HOUSEHOLD_CHANGED_EVENT, household_events


def login(client: TestClient, email: str = "person@example.com") -> dict[str, object]:
    response = client.get("/dev/login", params={"email": email})
    assert response.status_code == 200
    me_response = client.get("/me")
    assert me_response.status_code == 200
    return me_response.json()


def invite(client: TestClient, email: str) -> dict[str, object]:
    response = client.post("/households/invitations", json={"email": email})
    assert response.status_code == 201
    return response.json()


def assert_no_event(subscriber: object) -> None:
    try:
        subscriber.events.get_nowait()  # type: ignore[attr-defined]
    except queue.Empty:
        return
    raise AssertionError("subscriber received an unexpected event")


def test_invite_happy_path_lists_outgoing_and_broadcasts(client: TestClient) -> None:
    me = login(client)
    household_id = UUID(str(me["household_id"]))
    subscriber = household_events.subscribe(household_id)

    try:
        response = client.post("/households/invitations", json={"email": "  Invitee@Example.com  "})

        assert response.status_code == 201
        body = response.json()
        assert body["household_id"] == str(household_id)
        assert body["household_name"] == "person@example.com's household"
        assert body["user_email"] == "invitee@example.com"
        assert body["status"] == "pending"
        assert subscriber.events.get(timeout=1) == {"type": HOUSEHOLD_CHANGED_EVENT}

        list_response = client.get("/households/invitations")
        assert list_response.status_code == 200
        assert [invitation["id"] for invitation in list_response.json()] == [body["id"]]

        with get_sessionmaker()() as db:
            user = db.scalar(select(User).where(User.email == "invitee@example.com"))
            assert user is not None
            memberships = list(db.scalars(select(Membership).where(Membership.user_id == user.id)))

        assert len(memberships) == 1
        assert memberships[0].household_id == household_id
        assert memberships[0].status == MembershipStatus.pending
    finally:
        household_events.unsubscribe(subscriber)


def test_invite_current_member_and_duplicate_pending_return_409(client: TestClient) -> None:
    login(client)

    self_invite_response = client.post("/households/invitations", json={"email": "person@example.com"})
    assert self_invite_response.status_code == 409

    invite(client, "invitee@example.com")
    duplicate_response = client.post("/households/invitations", json={"email": "invitee@example.com"})
    assert duplicate_response.status_code == 409


def test_cancel_invitation_removes_pending_row_and_broadcasts(client: TestClient) -> None:
    me = login(client)
    household_id = UUID(str(me["household_id"]))
    invitation = invite(client, "invitee@example.com")
    subscriber = household_events.subscribe(household_id)

    try:
        response = client.delete(f"/households/invitations/{invitation['id']}")

        assert response.status_code == 204
        assert subscriber.events.get(timeout=1) == {"type": HOUSEHOLD_CHANGED_EVENT}
        assert client.get("/households/invitations").json() == []

        missing_response = client.delete(f"/households/invitations/{invitation['id']}")
        assert missing_response.status_code == 404
        assert_no_event(subscriber)
    finally:
        household_events.unsubscribe(subscriber)


def test_accept_invitation_merges_households_without_unique_index_violation(
    client: TestClient,
) -> None:
    inviter_me = login(client, "inviter@example.com")
    inviter_household_id = UUID(str(inviter_me["household_id"]))
    invitation = invite(client, "invitee@example.com")

    invitee_me = login(client, "invitee@example.com")
    invitee_household_id = UUID(str(invitee_me["household_id"]))
    assert invitee_household_id != inviter_household_id
    assert client.get("/invitations").json()[0]["id"] == invitation["id"]

    with get_sessionmaker()() as db:
        inviter_staple = Staple(
            household_id=inviter_household_id,
            name="Milk",
            quantity="1 carton",
            interval_days=7,
        )
        invitee_staple = Staple(
            household_id=invitee_household_id,
            name="Milk",
            quantity="2 cartons",
            interval_days=7,
        )
        db.add_all([inviter_staple, invitee_staple])
        db.flush()
        invitee_item = ShoppingListItem(
            household_id=invitee_household_id,
            staple_id=invitee_staple.id,
            name="Milk",
            quantity="2 cartons",
            status=ShoppingListItemStatus.confirmed,
        )
        purchased_item = ShoppingListItem(
            household_id=invitee_household_id,
            name="Archived bananas",
            quantity="6",
            status=ShoppingListItemStatus.purchased,
        )
        db.add_all([invitee_item, purchased_item])
        db.commit()
        invitee_staple_id = invitee_staple.id
        invitee_item_id = invitee_item.id
        purchased_item_id = purchased_item.id

    subscriber = household_events.subscribe(inviter_household_id)
    try:
        response = client.post(f"/invitations/{invitation['id']}/accept")

        assert response.status_code == 204
        assert subscriber.events.get(timeout=1) == {"type": HOUSEHOLD_CHANGED_EVENT}
    finally:
        household_events.unsubscribe(subscriber)

    with get_sessionmaker()() as db:
        assert db.get(Household, invitee_household_id) is None

        invitee = db.scalar(select(User).where(User.email == "invitee@example.com"))
        assert invitee is not None
        invitee_memberships = list(db.scalars(select(Membership).where(Membership.user_id == invitee.id)))
        assert len(invitee_memberships) == 1
        assert invitee_memberships[0].status == MembershipStatus.member
        assert invitee_memberships[0].household_id == inviter_household_id

        staples = list(db.scalars(select(Staple).where(Staple.household_id == inviter_household_id)))
        assert sorted(staple.quantity for staple in staples if staple.name == "Milk") == ["1 carton", "2 cartons"]

        moved_staple = db.get(Staple, invitee_staple_id)
        moved_item = db.get(ShoppingListItem, invitee_item_id)
        moved_purchased_item = db.get(ShoppingListItem, purchased_item_id)
        assert moved_staple is not None
        assert moved_staple.household_id == inviter_household_id
        assert moved_item is not None
        assert moved_item.household_id == inviter_household_id
        assert moved_item.staple_id == invitee_staple_id
        assert moved_purchased_item is not None
        assert moved_purchased_item.household_id == inviter_household_id

    me_after_accept = client.get("/me")
    assert me_after_accept.status_code == 200
    assert me_after_accept.json()["household_id"] == str(inviter_household_id)
    assert me_after_accept.json()["household_member_count"] == 2


def test_decline_invitation_removes_pending_row_and_keeps_own_household(
    client: TestClient,
) -> None:
    inviter_me = login(client, "inviter@example.com")
    inviter_household_id = UUID(str(inviter_me["household_id"]))
    invitation = invite(client, "invitee@example.com")

    invitee_me = login(client, "invitee@example.com")
    invitee_household_id = invitee_me["household_id"]
    subscriber = household_events.subscribe(inviter_household_id)

    try:
        response = client.post(f"/invitations/{invitation['id']}/decline")

        assert response.status_code == 204
        assert subscriber.events.get(timeout=1) == {"type": HOUSEHOLD_CHANGED_EVENT}
    finally:
        household_events.unsubscribe(subscriber)

    assert client.get("/invitations").json() == []
    assert client.get("/me").json()["household_id"] == invitee_household_id
    with get_sessionmaker()() as db:
        invitee = db.scalar(select(User).where(User.email == "invitee@example.com"))
        assert invitee is not None
        pending = list(
            db.scalars(
                select(Membership).where(
                    Membership.user_id == invitee.id,
                    Membership.status == MembershipStatus.pending,
                )
            )
        )
    assert pending == []


def test_leave_household_copies_data_with_remapped_staple_links_and_broadcasts(
    client: TestClient,
) -> None:
    owner_me = login(client, "owner@example.com")
    old_household_id = UUID(str(owner_me["household_id"]))
    invitation = invite(client, "leaver@example.com")
    login(client, "leaver@example.com")
    accept_response = client.post(f"/invitations/{invitation['id']}/accept")
    assert accept_response.status_code == 204
    assert client.get("/me").json()["household_member_count"] == 2

    with get_sessionmaker()() as db:
        staple = Staple(
            household_id=old_household_id,
            name="Coffee",
            quantity="1 bag",
            interval_days=30,
        )
        db.add(staple)
        db.flush()
        item = ShoppingListItem(
            household_id=old_household_id,
            staple_id=staple.id,
            name="Coffee",
            quantity="1 bag",
            status=ShoppingListItemStatus.confirmed,
        )
        one_off = ShoppingListItem(
            household_id=old_household_id,
            name="Chocolate",
            quantity="1 bar",
            status=ShoppingListItemStatus.needs_review,
        )
        db.add_all([item, one_off])
        db.commit()
        old_staple_id = staple.id
        old_item_id = item.id

    subscriber = household_events.subscribe(old_household_id)
    try:
        response = client.post("/households/leave")

        assert response.status_code == 204
        assert subscriber.events.get(timeout=1) == {"type": HOUSEHOLD_CHANGED_EVENT}
    finally:
        household_events.unsubscribe(subscriber)

    me_after_leave = client.get("/me")
    assert me_after_leave.status_code == 200
    new_household_id = UUID(me_after_leave.json()["household_id"])
    assert new_household_id != old_household_id
    assert me_after_leave.json()["household_member_count"] == 1

    with get_sessionmaker()() as db:
        original_staple = db.get(Staple, old_staple_id)
        original_item = db.get(ShoppingListItem, old_item_id)
        assert original_staple is not None
        assert original_staple.household_id == old_household_id
        assert original_item is not None
        assert original_item.household_id == old_household_id
        assert original_item.staple_id == old_staple_id

        copied_staple = db.scalar(select(Staple).where(Staple.household_id == new_household_id))
        assert copied_staple is not None
        assert copied_staple.id != old_staple_id
        assert copied_staple.name == "Coffee"

        copied_items = list(
            db.scalars(
                select(ShoppingListItem)
                .where(ShoppingListItem.household_id == new_household_id)
                .order_by(ShoppingListItem.name)
            )
        )
        assert [item.name for item in copied_items] == ["Chocolate", "Coffee"]
        copied_linked_item = next(item for item in copied_items if item.name == "Coffee")
        assert copied_linked_item.id != old_item_id
        assert copied_linked_item.staple_id == copied_staple.id

        old_members = list(
            db.scalars(
                select(Membership).where(
                    Membership.household_id == old_household_id,
                    Membership.status == MembershipStatus.member,
                )
            )
        )
        assert len(old_members) == 1


def test_sole_member_leave_returns_409(client: TestClient) -> None:
    me = login(client, "solo@example.com")
    assert me["household_member_count"] == 1

    response = client.post("/households/leave")

    assert response.status_code == 409
