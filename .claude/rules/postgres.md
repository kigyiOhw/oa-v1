# PostgreSQL + SQLAlchemy Production Rules (Claude Code)

# 1. ORM Rules (SQLAlchemy 2.0)
- MUST use SQLAlchemy 2.0 style (select, session.execute)
- MUST explicitly define all relationships
- MUST define back_populates for bidirectional relationships
- MUST NOT rely on implicit lazy loading in service layer

## Loading Strategy
- MUST use selectinload for collections
- MUST use joinedload for 1:1 relationships
- MUST NOT allow lazy-loading in business logic

## Forbidden
- Implicit attribute-triggered queries
- Uncontrolled ORM lazy loading

# 2. Data Access Rules
- ALL database access MUST go through repository or query service
- Repository MUST NOT contain business logic
- Repository MUST remain a thin persistence layer

## Allowed SQL Usage
- ORM: CRUD operations
- Core: multi-join queries
- Raw SQL: analytics / performance-critical queries / migrations

# 3. Schema Rules
## Naming
- Tables: snake_case plural
- Columns: snake_case

## Required Columns
All tables MUST include:
- id (UUID or BIGINT, must be justified)
- created_time (TIMESTAMPTZ)
- updated_time (TIMESTAMPTZ)

Optional:
- deleted_time (soft delete)
- version (optimistic lock)

## Data Types
- TIMESTAMPTZ MUST be used for timestamps
- TEXT is default string type
- VARCHAR only when strict limit required
- JSONB ONLY (never JSON)
- NUMERIC(p,s) for precision values
- MONEY type is forbidden

## Primary Key Strategy
- UUID ONLY for distributed systems
- BIGINT / IDENTITY preferred for performance systems

# 4. Constraints Rules
- ALL integrity rules MUST be enforced at database level

## Required Constraints
- NOT NULL for required fields
- UNIQUE must be explicitly declared
- FOREIGN KEY must define ON DELETE behavior

## CHECK Constraints
- enum-like fields
- range validation
- domain invariants

# 5. Index Rules
## Required Indexes
- Foreign keys MUST be indexed
- Filter columns MUST be indexed
- Sort/pagination columns SHOULD be indexed

## Composite Index Rule
equality → range → sorting

## Index Types
- B-Tree default
- GIN for JSONB/full-text search
- BRIN for large time-series
- Partial indexes for filtered datasets

## Forbidden
- Unjustified indexes
- Duplicate indexes

# 6. Query Performance Rules
## N+1 Prevention
- MUST audit queries in code review
- MUST prevent lazy loading
- MUST log slow queries (>200ms)

## Pagination
- MUST use cursor pagination for large tables
- OFFSET only for small datasets

## Forbidden
- SELECT *
- Large table full scans without limits

# 7. Transaction Rules
## Unit of Work
- Multi-write operations MUST use single transaction
- No partial commit inside service flow

## Isolation Levels
- READ COMMITTED default
- REPEATABLE READ for consistency
- SERIALIZABLE for strict correctness

## Concurrency
- SELECT FOR UPDATE for locking
- SKIP LOCKED for queue systems

## Failure
- Any exception MUST trigger rollback

# 8. Migration Rules (Alembic)
## Principles
- MUST be forward compatible
- MUST be production safe
- SHOULD be reversible

## Pattern
expand → backfill → contract

## Safety
- CREATE INDEX CONCURRENTLY preferred
- NOT VALID constraints for large tables

## Forbidden
- Multiple unrelated changes per migration
- Non-idempotent migrations

# 9. Performance & Observability
- slow query log MUST be enabled
- EXPLAIN ANALYZE required for:
  - new queries
  - index validation
  - performance fixes

## Query Review
- >3 joins MUST require execution plan review
- large scans MUST be validated

# 10. Anti-Patterns
- Lazy loading in services
- Business logic in repository
- Missing FK indexes
- SELECT *
- Commit inside repository
- ORM-only analytics design

# 11. Severity
- MUST = strict requirement
- SHOULD = recommended
- NICE = optional