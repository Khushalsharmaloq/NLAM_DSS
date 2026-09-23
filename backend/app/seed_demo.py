import os

from sqlalchemy import select

from app.core.security import hash_password

from app.database import SessionLocal

from app.models.user import User


DEMO_ACCOUNTS = [
    (
        "system.admin",
        "Demonstration System Administrator",
        "SYSTEM_ADMIN",
        "DEMO_ADMIN_PASSWORD",
        None, None,
    ),
    (
        "project.officer",
        "Demonstration Project Officer",
        "PROJECT_OFFICER",
        "DEMO_USER_PASSWORD",
        "Uttar Pradesh", "Lucknow",
    ),
    (
        "district.authority",
        "Demonstration District Authority",
        "DISTRICT_AUTHORITY",
        "DEMO_USER_PASSWORD",
        "Uttar Pradesh", "Lucknow",
    ),
    (
        "state.authority",
        "Demonstration State Authority",
        "STATE_AUTHORITY",
        "DEMO_USER_PASSWORD",
        "Uttar Pradesh", None,
    ),
    (
        "central.ministry", "Demonstration Central Ministry", "CENTRAL_MINISTRY",
        "DEMO_USER_PASSWORD", None, None,
    ),
]


def seed_demo_accounts():

    db = SessionLocal()

    try:
        for (
            username,
            full_name,
            role,
            password_variable,
            state,
            district,
        ) in DEMO_ACCOUNTS:

            password = os.environ[password_variable]

            if len(password) < 12:
                raise ValueError(
                    "Demonstration password is too short."
                )

            existing_user = db.execute(
                select(User).where(
                    User.username == username
                )
            ).scalar_one_or_none()

            if existing_user is not None:

                print(
                    f"Account already exists: {username}"
                )

                continue

            user = User(
                username=username,
                full_name=full_name,
                role=role,
                state=state,
                district=district,
                hashed_password=hash_password(password),
                is_active=True,
            )

            db.add(user)

            db.commit()

            print(
                f"Created demonstration account: "
                f"{username} ({role})"
            )

        print("Demonstration account seeding completed.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_accounts()
