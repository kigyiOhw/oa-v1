"""Test factories using factory-boy to reduce boilerplate in test files."""

import factory

from app.utils.security import get_password_hash


class UserFactory(factory.Factory):
    class Meta:
        model = None  # Override in concrete factories or set dynamically

    id = factory.Sequence(lambda n: n + 1)
    username = factory.Sequence(lambda n: f"testuser_{n}")
    email = factory.Sequence(lambda n: f"user_{n}@test.com")
    hashed_password = factory.LazyFunction(lambda: get_password_hash("password123"))
    full_name = factory.Sequence(lambda n: f"Test User {n}")
    is_active = True
    is_superuser = False
    department_id = None
    manager_id = None
