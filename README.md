# Students and Marks API

Express 5 + TypeScript + PostgreSQL. Students have a nested guardian. Each student has many marks.

Successful responses are `{ "data": ... }` from `sendSuccess()`. Errors are thrown and the error handler sends `{ "error": { "message", "details" } }`.

## Run

```bash
npm install
cp .env.example .env          # set DB_PASSWORD to your local postgres password
npm run db:migrate
npm run dev                   # http://localhost:3000
npm test
```

## 1. Configuration

`src/config/env.ts` reads `.env` with one Zod schema. `validateConfig()` is the only check.

`PASS_PERCENTAGE` is required. It is a number from 0 to 100. There is no default.

`ACADEMIC_YEAR` is required. It must look like `2026-27`. The second year must be the first year plus one, so `2026-28` is rejected.

If either value is missing or wrong, the process prints a message that names the variable and exits with code 1. Example:

```bash
PASS_PERCENTAGE= npm run dev
```

Tests in `tests/config.test.ts` call `validateConfig()` with bad values and expect those messages. `vitest.config.ts` sets valid values so the other tests can import the app without a `.env` file.

## 2. Validation and sanitisation

Request checks live in `src/utils/validators.ts` and the module `*.dto.ts` files. Controllers parse the body, params, or query before calling a service. A bad request never reaches a repository.

Text is trimmed and NFC-normalised. Control characters, null bytes, and `<` `>` are rejected.

`z.strictObject` is used for the student, the guardian, and each mark. Unknown keys such as `id` or `createdAt` are rejected. The error `details.fieldErrors` uses dotted paths such as `guardian.phone` and `marks.0.score`.

`src/middlewares/rejectDangerousPayload.ts` rejects `__proto__`, `constructor`, and `prototype` before validation.

`tests/student-validation.test.ts` sends malicious bodies and checks that the mocked repositories are not called.

## 3. Repository mapping

Services work with camelCase domain objects. PostgreSQL rows are snake_case and never leave the repository.

`student.repository.ts`

- `toDomain` builds `guardian` from `guardian_name`, `guardian_phone`, and `guardian_relation`.
- `toPersistence` flattens `guardian` back into those three columns, and only includes fields that were sent.

`mark.repository.ts`

- `toDomain` turns NUMERIC strings such as `"78.50"` into the number `78.5`.
- `insertMany` uses one database client: `BEGIN`, then each insert, then `COMMIT`. A failure runs `ROLLBACK`.
- A duplicate roll number or a duplicate student + exam + subject becomes HTTP 409. A mark for a missing student becomes HTTP 404.

The service turns dates into strings for the response. Subject averages are rounded to 2 decimals. `passed` is true when the average is greater than or equal to `PASS_PERCENTAGE`.

`tests/student-mapping.test.ts` checks the mapping without a database.

## 4. Authentication

`POST /api/auth/register` creates a plain `user` (no student or mark access).
`POST /api/auth/login` returns a JWT access token (15 minutes by default).

`authenticate` verifies the Bearer token, then reloads the user and **role from the database**. A demotion from teacher to user takes effect on the next request.

Admin-only linking (permission `admin:manage`):

- `POST /api/admin/teacher-classes` — `{ teacherUserId, className, section }`
- `POST /api/admin/student-links` — `{ userId, studentId }`

## 5. Permissions and ownership

Route guards use `requirePermission(...)`. Ownership uses one helper:

`canAccessStudent(actor, student, 'read' | 'write')`

| Permission | admin | teacher | student |
| --- | --- | --- | --- |
| students:read:own | ✓ | | ✓ |
| students:read:class | ✓ | ✓ | |
| students:read:any | ✓ | | |
| students:write:any | ✓ | | |
| marks:read:own | ✓ | | ✓ |
| marks:read:class | ✓ | ✓ | |
| marks:read:any | ✓ | | |
| marks:write:class | ✓ | ✓ | |
| marks:write:any | ✓ | | |
| marks:averages:class | ✓ | ✓ | |
| marks:averages:any | ✓ | | |

**Lists filter** to the rows the actor may see (a teacher listing students still gets a 200 with only their classes). Returning 403 for the whole list would hide the classes they *are* allowed to teach.

**Single records outside scope return 403** everywhere (same status for GET student, POST marks, averages for the wrong class). 403 means “you are signed in, but not allowed”; 404 is reserved for ids that do not exist.

## 6. API security

- `POST /api/students/:id/marks` is rate-limited **per user** (`MARKS_RATE_LIMIT_MAX`, default 60 / 10 minutes), not per IP.
- `/api/auth`, `/api/students`, and `/api/marks` send `Cache-Control: no-store`.
- `CORS_ORIGINS="*"` is rejected at boot with a clear message (allow-all would let any website read logged-in responses).
- Response `curl` fields redact passwords and Authorization tokens.

## Endpoints

| Method | Path | Who |
| --- | --- | --- |
| POST | `/api/auth/register` | public |
| POST | `/api/auth/login` | public |
| POST | `/api/admin/teacher-classes` | admin |
| POST | `/api/admin/student-links` | admin |
| GET | `/api/students` | filtered by scope |
| GET | `/api/students/:id` | own / class / any |
| POST / PATCH / DELETE | `/api/students...` | admin write |
| POST | `/api/students/:id/marks` | admin or teacher (own classes) |
| PATCH / DELETE | `/api/marks/:id` | admin or teacher (own classes) |
| GET | `/api/marks/averages` | admin or teacher (own classes) |

Teacher reading their class:

```bash
curl localhost:3000/api/students/17 \
  -H "Authorization: Bearer $TEACHER_TOKEN"
```

Student reading their own profile:

```bash
curl localhost:3000/api/students/17 \
  -H "Authorization: Bearer $STUDENT_TOKEN"
```

Teacher blocked from another class (403):

```bash
curl -X POST localhost:3000/api/students/23/marks \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"exam":"final","marks":[{"subject":"maths","score":80,"maxScore":100}]}'
```

SQL values are always `$1`, `$2`, and so on. User input is never concatenated into a query.

Open the same database in DBeaver: host `localhost`, port `5432`, database `postgres`, schema `express`.
