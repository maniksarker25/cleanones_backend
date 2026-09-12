# Worker APIs

Base path: `/api/v1/worker`. Management operations require `Authorization: Bearer <manager-access-token>`. The availability endpoint requires the freelancer's worker access token.

## Working days and availability

Managers can supply `working_days` when creating or updating Employee profiles only. They cannot set a freelancer's working days, including when submitting a type change in the same update.

Freelancers use `PATCH /api/v1/worker/my-availability` with their own access token:

```json
{ "working_days": ["Monday", "Wednesday", "Friday"] }
```

This sets or replaces the complete availability list; `[]` clears it. Only `working_days` is accepted. The account is selected from the authenticated token, so no worker ID is supplied. Employees cannot use this endpoint.

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/create-worker` | Create a worker profile and verified worker login account |
| PATCH | `/update-worker/:id` | Update an active profile and synchronize email/phone with its account |
| DELETE | `/delete-worker/:id` | Soft-delete the profile and mark its account deleted and blocked |
| GET | `/all-workers` | List active profiles with pagination |
| GET | `/single-worker/:id` | Retrieve one active profile |

IDs refer to worker profile IDs. Successful responses use HTTP 200 and the existing `{ success, message, data }` envelope. Deletes return `data: null`. Invalid IDs return 400; missing or deleted profiles return 404.

## Create example

```json
{
  "email": "worker@example.com",
  "phone": "+8801700000000",
  "password": "example-password",
  "confirmPassword": "example-password",
  "worker_type": "Employee",
  "address": "Dhaka",
  "languages": ["Bangla", "English"],
  "hourly_rate": 25
}
```

Email, phone, password, confirmPassword, worker_type and address are required. Worker type is `Employee` or `Freelancer`. Phone is required by the linked user account. Password must have 6–72 characters and match confirmPassword. Existing account email or phone is rejected.

Optional profile fields: `isagree_condition`, `dob`, `nationality`, `position`, `base_location`, `languages`, `employee_contract_pdf`, `working_days`, `hourly_rate`, `is_profile_completed`, `id_card_front`, `id_card_back`, `certificates`, `national_id`. File fields accept stored file references; these endpoints accept JSON.

Updates accept any nonempty subset of the profile fields, including email and phone. Passwords, user IDs, roles and deletion flags cannot be set through updates. Account creation returns the profile only; credentials are not emailed.

## Listing

`GET /api/v1/worker/all-workers?page=1&limit=10&worker_type=Employee&searchTerm=Dhaka&sort=-created_at`

- Search covers email, phone, position and nationality.
- Page must be positive; limit is 1–100 (default 10).
- Sort accepts `created_at`, `email`, `hourly_rate`, or their descending forms prefixed with `-`. Default: `-created_at`.
- Response data contains `meta: { page, limit, total, totalPage }` and `result: Worker[]`.
- Deleted profiles cannot be requested through filters. Legacy profiles without an isDeleted field remain visible.

Create, update and delete use MongoDB transactions, requiring a replica set or sharded deployment, as in the client module. The existing global error handler reports Zod validation errors as HTTP 500.

Focused checks: `node scripts/check-worker.cjs`. These exercise validation, route authorization and service behavior with database mocks; they do not replace a live MongoDB integration check.
