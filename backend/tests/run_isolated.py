"""Run backend tests against the dedicated nlam_test database only."""

import os
import subprocess
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


def main():
    original_url = os.environ.get("DATABASE_URL")

    if not original_url:
        raise SystemExit("STOP: DATABASE_URL is missing.")

    # Derive the test connection from the container's existing connection.
    # Do not print the URL: it may contain a database password.
    test_url = make_url(original_url).set(database="nlam_test")

    if test_url.database != "nlam_test":
        raise SystemExit("STOP: Incorrect test database configuration.")

    test_engine = create_engine(test_url, pool_pre_ping=True)

    try:
        with test_engine.connect() as connection:
            actual_database = connection.execute(
                text("SELECT current_database()")
            ).scalar_one()

            if actual_database != "nlam_test":
                raise SystemExit(
                    "STOP: Connection is not using nlam_test."
                )

            print("Verified isolated database: nlam_test", flush=True)
    finally:
        test_engine.dispose()

    # The application reads DATABASE_URL when it is imported.
    # Set it before pytest imports any backend application modules.
    test_environment = os.environ.copy()
    test_environment["DATABASE_URL"] = test_url.render_as_string(
        hide_password=False
    )

    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-q",
            "/app/tests",
        ],
        env=test_environment,
        check=False,
    )

    raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
