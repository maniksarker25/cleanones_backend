# cleanones-backend API reference

79 documented operations from the implemented, mounted API handlers. This snapshot describes the current unfinished backend; documented contracts are not a claim that every endpoint works end to end.

## Connection and authentication

- Base URL: `http://localhost:<BACKEND_PORT>/api/v1` (replace with your deployed backend URL).
- JSON requests: `Content-Type: application/json`.
- Protected requests: `Authorization: Bearer <accessToken>`.
- Log in using a verified, active account and use `data.accessToken`.
- Refresh requests use the `refreshToken` HttpOnly cookie set by login; no JSON body is needed.
- Standalone Swagger at `http://localhost:3001/api-docs` serves documentation only. It is not the API server.

## Current implementation limitations

Manager and admin authentication profile lookups are unfinished, so protected calls can fail before the controller runs. User and super-admin modules still have missing dependencies. Zod validation failures currently return HTTP 500. Other operation-specific limitations are listed below.
Excluded: unfinished user/super-admin routes, the placeholder earnings chart, unmounted conversation/message/support routers, and empty testimonial routes. Root/static routes and the separate contact email helper are outside this versioned reference.

## Common response and errors

Successful operations below return HTTP 200, including creates and deletes. A typical envelope is:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

The `data` schema is listed per operation. For paginated lists, metadata and rows are under `data.meta` and `data.result`. Some legacy branches omit `data` or return null as noted. A response schema field marked optional is not guaranteed to be returned.

| HTTP status | Meaning                                                        |
| ----------- | -------------------------------------------------------------- |
| 400         | Invalid ID, model validation, or business-rule failure.        |
| 401         | Missing/invalid/expired access token or role not allowed.      |
| 403         | Blocked/inactive account or rejected credentials.              |
| 404         | Resource or authenticated profile not found.                   |
| 429         | Rate limit exceeded; respect Retry-After.                      |
| 500         | Server error; currently also used for Zod validation failures. |

Errors contain `success: false` and `message`; the global handler also includes `errorDetails` and `stack`. Rate-limit errors may include only success and message.
Global limit: 60 requests/minute per IP. Sensitive authentication routes share 3 requests/minute per email or IP.

## Workflow

Create a client, then its location, then a room, then tasks. Weekly tasks need a nonempty `days_of_week`; monthly tasks need a nonempty `days_of_month`. Password recovery: request reset code, verify it, then reset the password. All examples are illustrative; replace IDs and credentials with your own.

## Endpoint index

| Method | Endpoint (relative to /api/v1)           | Access                            | Section                                                             |
| ------ | ---------------------------------------- | --------------------------------- | ------------------------------------------------------------------- |
| POST   | `/client/create-client`                  | manager                           | [Create client](#postclientcreateclient)                            |
| PATCH  | `/client/update-client/{id}`             | manager                           | [Update client](#patchclientupdateclientid)                         |
| DELETE | `/client/delete-client/{id}`             | manager                           | [Deactivate client](#deleteclientdeleteclientid)                    |
| GET    | `/client/all-clients`                    | manager                           | [List clients](#getclientallclients)                                |
| POST   | `/location/create-location`              | manager                           | [Create location](#postlocationcreatelocation)                      |
| PATCH  | `/location/update-location/{id}`         | manager                           | [Update location](#patchlocationupdatelocationid)                   |
| DELETE | `/location/delete-location/{id}`         | manager                           | [Deactivate location](#deletelocationdeletelocationid)              |
| GET    | `/location/all-locations`                | manager                           | [List locations](#getlocationalllocations)                          |
| GET    | `/location/single-location/{id}`         | manager                           | [Get location](#getlocationsinglelocationid)                        |
| GET    | `/location/my-locations`                 | client                            | [My locations](#getlocationmylocations)                             |
| POST   | `/room/create-room`                      | manager                           | [Create room](#postroomcreateroom)                                  |
| PATCH  | `/room/update-room/{id}`                 | manager                           | [Update room](#patchroomupdateroomid)                               |
| DELETE | `/room/delete-room/{id}`                 | manager                           | [Deactivate room](#deleteroomdeleteroomid)                          |
| GET    | `/room/all-rooms`                        | manager                           | [List all rooms](#getroomallrooms)                                  |
| GET    | `/room/all-rooms/{locationId}`           | manager                           | [List rooms](#getroomallroomslocationid)                            |
| GET    | `/room/single-room/{id}`                 | manager                           | [Get room](#getroomsingleroomid)                                    |
| GET    | `/room/my-rooms/{locationId}`            | client                            | [My rooms](#getroommyroomslocationid)                                |
| POST   | `/task/create-task`                      | manager                           | [Create task](#posttaskcreatetask)                                  |
| PATCH  | `/task/update-task/{id}`                 | manager                           | [Update task](#patchtaskupdatetaskid)                               |
| DELETE | `/task/delete-task/{id}`                 | manager                           | [Deactivate task](#deletetaskdeletetaskid)                          |
| GET    | `/task/all-tasks/{roomId}`               | manager                           | [List tasks](#gettaskalltasksroomid)                                |
| GET    | `/task/single-task/{id}`                 | manager                           | [Get task](#gettasksingletaskid)                                    |
| GET    | `/task/my-tasks/{roomId}`                | client                            | [My tasks](#gettaskmytasksroomid)                                    |
| GET    | `/location/client-locations/{clientId}`  | manager                           | [List a client's locations](#getlocationclientlocationsclientid)    |
| POST   | `/invoice/create-invoice`                | manager                           | [Create invoice](#postinvoicecreateinvoice)                         |
| GET    | `/invoice/all-invoices`                  | manager                           | [List all invoices](#getinvoiceallinvoices)                         |
| GET    | `/invoice/my-invoices`                   | worker                            | [My invoices](#getinvoicemyinvoices)                                |
| POST   | `/auth/login`                            | Public                            | [Log in](#postauthlogin)                                            |
| POST   | `/auth/change-password`                  | client, worker, admin, superAdmin | [Change password](#postauthchangepassword)                          |
| POST   | `/auth/refresh-token`                    | refreshToken cookie               | [Refresh access token](#postauthrefreshtoken)                       |
| POST   | `/auth/forget-password`                  | Public                            | [Request password reset code](#postauthforgetpassword)              |
| POST   | `/auth/verify-reset-otp`                 | Public                            | [Verify reset code](#postauthverifyresetotp)                        |
| POST   | `/auth/reset-password`                   | Public                            | [Reset password](#postauthresetpassword)                            |
| POST   | `/auth/resend-reset-code`                | Public                            | [Resend password reset code](#postauthresendresetcode)              |
| GET    | `/auth/all-user`                         | Public                            | [List users (legacy)](#getauthalluser)                              |
| GET    | `/manage/get-about-us`                   | Public                            | [Get about-us](#getmanagegetaboutus)                                |
| POST   | `/manage/add-about-us`                   | superAdmin                        | [Add about-us](#postmanageaddaboutus)                               |
| PATCH  | `/manage/edit-about-us/{id}`             | superAdmin                        | [Edit about-us](#patchmanageeditaboutusid)                          |
| DELETE | `/manage/delete-about-us/{id}`           | superAdmin                        | [Delete about-us](#deletemanagedeleteaboutusid)                     |
| GET    | `/manage/get-privacy-policy`             | Public                            | [Get privacy-policy](#getmanagegetprivacypolicy)                    |
| POST   | `/manage/add-privacy-policy`             | superAdmin                        | [Add privacy-policy](#postmanageaddprivacypolicy)                   |
| PATCH  | `/manage/edit-privacy-policy/{id}`       | superAdmin                        | [Edit privacy-policy](#patchmanageeditprivacypolicyid)              |
| DELETE | `/manage/delete-privacy-policy/{id}`     | superAdmin                        | [Delete privacy-policy](#deletemanagedeleteprivacypolicyid)         |
| GET    | `/manage/get-terms-conditions`           | Public                            | [Get terms-conditions](#getmanagegettermsconditions)                |
| POST   | `/manage/add-terms-conditions`           | superAdmin                        | [Add terms-conditions](#postmanageaddtermsconditions)               |
| PATCH  | `/manage/edit-terms-conditions/{id}`     | superAdmin                        | [Edit terms-conditions](#patchmanageedittermsconditionsid)          |
| DELETE | `/manage/delete-terms-conditions/{id}`   | superAdmin                        | [Delete terms-conditions](#deletemanagedeletetermsconditionsid)     |
| GET    | `/manage/get-partner`                    | Public                            | [Get partner](#getmanagegetpartner)                                 |
| POST   | `/manage/add-partner`                    | superAdmin                        | [Add partner](#postmanageaddpartner)                                |
| PATCH  | `/manage/edit-partner/{id}`              | superAdmin                        | [Edit partner](#patchmanageeditpartnerid)                           |
| DELETE | `/manage/delete-partner/{id}`            | superAdmin                        | [Delete partner](#deletemanagedeletepartnerid)                      |
| GET    | `/manage/get-contact-us`                 | Public                            | [Get contact-us](#getmanagegetcontactus)                            |
| POST   | `/manage/add-contact-us`                 | superAdmin                        | [Add contact-us](#postmanageaddcontactus)                           |
| PATCH  | `/manage/edit-contact-us/{id}`           | superAdmin                        | [Edit contact-us](#patchmanageeditcontactusid)                      |
| DELETE | `/manage/delete-contact-us/{id}`         | superAdmin                        | [Delete contact-us](#deletemanagedeletecontactusid)                 |
| GET    | `/manage/get-faq`                        | Public                            | [Get faq](#getmanagegetfaq)                                         |
| POST   | `/manage/add-faq`                        | superAdmin                        | [Add faq](#postmanageaddfaq)                                        |
| PATCH  | `/manage/edit-faq/{id}`                  | superAdmin                        | [Edit faq](#patchmanageeditfaqid)                                   |
| DELETE | `/manage/delete-faq/{id}`                | superAdmin                        | [Delete faq](#deletemanagedeletefaqid)                              |
| GET    | `/manage/get-slider`                     | Public                            | [Get slider](#getmanagegetslider)                                   |
| POST   | `/manage/add-slider`                     | superAdmin                        | [Add slider](#postmanageaddslider)                                  |
| PATCH  | `/manage/edit-slider/{id}`               | superAdmin                        | [Edit slider](#patchmanageeditsliderid)                             |
| DELETE | `/manage/delete-slider/{id}`             | superAdmin                        | [Delete slider](#deletemanagedeletesliderid)                        |
| GET    | `/notification/get-notifications`        | superAdmin, client, worker, admin | [List notifications](#getnotificationgetnotifications)              |
| PATCH  | `/notification/see-notifications`        | superAdmin, client, worker, admin | [Mark all notifications read](#patchnotificationseenotifications)   |
| DELETE | `/notification/delete-notification/{id}` | superAdmin, client, worker, admin | [Delete a notification](#deletenotificationdeletenotificationid)    |
| POST   | `/file/upload-conversation-files`        | worker, client                    | [Upload conversation attachments](#postfileuploadconversationfiles) |
| POST   | `/file/delete-files`                     | worker, client                    | [Delete uploaded files](#postfiledeletefiles)                       |
| GET    | `/legal-info/get`                        | Public                            | [Get legal information](#getlegalinfoget)                           |
| POST   | `/legal-info/add-update`                 | superAdmin                        | [Create or update legal information](#postlegalinfoaddupdate)       |
| POST   | `/admin/create-admin`                    | superAdmin                        | [Create an administrator](#postadmincreateadmin)                    |
| PATCH  | `/admin/update-admin`                    | superAdmin                        | [Update the caller's admin profile](#patchadminupdateadmin)         |
| DELETE | `/admin/delete-admin/{id}`               | superAdmin                        | [Delete an administrator](#deleteadmindeleteadminid)                |
| PATCH  | `/admin/update-admin-status/{id}`        | superAdmin                        | [Toggle administrator status](#patchadminupdateadminstatusid)       |
| GET    | `/admin/all-admins`                      | superAdmin                        | [List administrators](#getadminalladmins)                           |
| GET    | `/meta/meta-data`                        | superAdmin, admin                 | [Get dashboard totals](#getmetametadata)                            |
| GET    | `/meta/customer-chart-data`              | superAdmin, admin                 | [Get monthly customer counts](#getmetacustomerchartdata)            |
| GET    | `/meta/provider-chart-data`              | superAdmin, admin                 | [Get monthly provider counts](#getmetaproviderchartdata)            |
| GET    | `/meta/get-activities`                   | superAdmin, admin                 | [Compare activity counts](#getmetagetactivities)                    |

## Authentication

Login, tokens and password recovery.

<a id="postauthlogin"></a>

### POST /auth/login

Log in
Returns accessToken, refreshToken and role. Sets an HttpOnly refreshToken cookie (SameSite=Strict, Secure in production, seven-day max age). Auth routes share a limit of three requests per minute per email or IP.

**Access:** Public (no route-level authentication).

**Request: application/json**

| Field      | Type              | Required | Details                                                                                                                                      |
| ---------- | ----------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `email`    | string            | Yes      |                                                                                                                                              |
| `password` | string (password) | Yes      |                                                                                                                                              |
| `role`     | string            | No       | Optional service-level role selection; not validated by the login Zod schema. Allowed: "client", "worker", "manager", "admin", "superAdmin". |
| `playerId` | string            | No       | Optional push device ID.                                                                                                                     |
| `platform` | string            | No       | Allowed: "android", "ios", "web". Default: "android".                                                                                        |

Example request:

```json
{
  "email": "manager@example.com",
  "password": "ExamplePass123!"
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Tokens](#schema-tokens).

Response header `Set-Cookie`: refreshToken=<token>; HttpOnly; SameSite=Strict; Secure in production

<a id="postauthchangepassword"></a>

### POST /auth/change-password

Change password
New passwords must match. Auth routes share a limit of three requests per minute per email or IP.

Required role: client, worker, admin, superAdmin.

**Access:** client, worker, admin, superAdmin.

**Request: application/json**

| Field                | Type              | Required | Details |
| -------------------- | ----------------- | -------- | ------- |
| `oldPassword`        | string (password) | Yes      |         |
| `newPassword`        | string (password) | Yes      |         |
| `confirmNewPassword` | string (password) | Yes      |         |

Example request:

```json
{
  "oldPassword": "ExamplePass123!",
  "newPassword": "ExamplePass123!",
  "confirmNewPassword": "ExamplePass123!"
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Null](#schema-null).

<a id="postauthrefreshtoken"></a>

### POST /auth/refresh-token

Refresh access token
Uses the HttpOnly refreshToken cookie set by login; no JSON body. Browser cookies are sent automatically on the same origin. Auth routes share a limit of three requests per minute per email or IP.

**Access:** refreshToken cookie.

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Tokens](#schema-tokens).

<a id="postauthforgetpassword"></a>

### POST /auth/forget-password

Request password reset code
Sends a reset code by email, valid for five minutes. Auth routes share a limit of three requests per minute per email or IP.

**Access:** Public (no route-level authentication).

**Request: application/json**

| Field   | Type   | Required | Details |
| ------- | ------ | -------- | ------- |
| `email` | string | Yes      |         |

Example request:

```json
{
  "email": "client@example.com"
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Null](#schema-null).

<a id="postauthverifyresetotp"></a>

### POST /auth/verify-reset-otp

Verify reset code
Call after requesting the code, before resetting the password. Auth routes share a limit of three requests per minute per email or IP.

**Access:** Public (no route-level authentication).

**Request: application/json**

| Field       | Type   | Required | Details |
| ----------- | ------ | -------- | ------- |
| `email`     | string | Yes      |         |
| `resetCode` | number | Yes      |         |

Example request:

```json
{
  "email": "user@example.com",
  "resetCode": 123456
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Null](#schema-null).

<a id="postauthresetpassword"></a>

### POST /auth/reset-password

Reset password
Requires prior reset-code verification. Passwords must match. Returns tokens in the response body; does not set a cookie. Auth routes share a limit of three requests per minute per email or IP.

**Access:** Public (no route-level authentication).

**Request: application/json**

| Field             | Type              | Required | Details |
| ----------------- | ----------------- | -------- | ------- |
| `email`           | string            | Yes      |         |
| `password`        | string (password) | Yes      |         |
| `confirmPassword` | string (password) | Yes      |         |

Example request:

```json
{
  "email": "user@example.com",
  "password": "ExamplePass123!",
  "confirmPassword": "ExamplePass123!"
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Tokens](#schema-tokens).

<a id="postauthresendresetcode"></a>

### POST /auth/resend-reset-code

Resend password reset code
Accepts a flat email field. The unused nested-email validator is not mounted. Auth routes share a limit of three requests per minute per email or IP.

**Access:** Public (no route-level authentication).

**Request: application/json**

| Field   | Type   | Required | Details |
| ------- | ------ | -------- | ------- |
| `email` | string | Yes      |         |

Example request:

```json
{
  "email": "client@example.com"
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Null](#schema-null).

<a id="getauthalluser"></a>

### GET /auth/all-user

List users (legacy)
Current route has no authentication middleware and returns User.find() results. The user response contract is unfinished; review access and returned fields before deployment.

**Access:** Public (no route-level authentication).

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** array of object.

Type: array of object.

## Clients

Manager-managed customer accounts.

<a id="postclientcreateclient"></a>

### POST /client/create-client

Create client
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Creates a user and client profile in a MongoDB transaction and emails login credentials. Passwords must match.

Required role: manager.

**Access:** manager.

**Request: application/json**

| Field                     | Type               | Required | Details                                   |
| ------------------------- | ------------------ | -------- | ----------------------------------------- |
| `name`                    | string             | Yes      | minLength: 1.                             |
| `email`                   | string (email)     | Yes      |                                           |
| `phone`                   | string             | Yes      |                                           |
| `company_name`            | string             | No       |                                           |
| `licence_expiration_date` | string (date-time) | No       |                                           |
| `contract_status`         | string             | No       | Allowed: "Active", "Inactive", "Pending". |
| `password`                | string (password)  | Yes      | minLength: 6.                             |
| `confirmPassword`         | string (password)  | Yes      |                                           |

Example request:

```json
{
  "name": "Northstar Facilities",
  "email": "client@example.com",
  "phone": "+8801700000000",
  "company_name": "Northstar Ltd",
  "password": "ExamplePass123!",
  "confirmPassword": "ExamplePass123!"
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Client](#schema-client).

<a id="patchclientupdateclientid"></a>

### PATCH /client/update-client/{id}

Update client
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Partial update.

Required role: manager.

**Access:** manager.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request: application/json**

| Field                     | Type               | Required | Details                                   |
| ------------------------- | ------------------ | -------- | ----------------------------------------- |
| `name`                    | string             | No       | minLength: 1.                             |
| `email`                   | string (email)     | No       |                                           |
| `phone`                   | string             | No       |                                           |
| `company_name`            | string             | No       |                                           |
| `licence_expiration_date` | string (date-time) | No       |                                           |
| `contract_status`         | string             | No       | Allowed: "Active", "Inactive", "Pending". |

Example request:

```json
{
  "name": "Northstar Facilities",
  "email": "client@example.com",
  "phone": "+8801700000000",
  "company_name": "Northstar Ltd",
  "licence_expiration_date": "2026-09-12T09:00:00.000Z",
  "contract_status": "Active"
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Client](#schema-client).

<a id="deleteclientdeleteclientid"></a>

### DELETE /client/delete-client/{id}

Deactivate client
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Soft-deletes the client and marks its user deleted and blocked. Returns null.

Required role: manager.

**Access:** manager.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Null](#schema-null).

<a id="getclientallclients"></a>

### GET /client/all-clients

List clients
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Pagination is nested under data.meta; records are under data.result. Excludes deleted clients.

Required role: manager.

**Access:** manager.

**Parameters**

| Name         | In    | Type    | Required | Details                                                                  |
| ------------ | ----- | ------- | -------- | ------------------------------------------------------------------------ |
| `page`       | query | integer | No       | Use a positive page number. Default: 1.                                  |
| `limit`      | query | integer | No       | Use a positive page size. Default: 10.                                   |
| `searchTerm` | query | string  | No       | Case-insensitive regex search across name, email, phone, company_name.   |
| `sort`       | query | string  | No       | Single field; prefix with - for descending order. Default: "-createdAt". |
| `fields`     | query | string  | No       | Comma-separated fields, for example name,email.                          |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object.

| Field    | Type                              | Required | Details    |
| -------- | --------------------------------- | -------- | ---------- |
| `meta`   | [Pagination](#schema-pagination)  | Yes      |            |
| `result` | array of [Client](#schema-client) | Yes      | Each item: |

## Locations

Client sites and room counts.

<a id="postlocationcreatelocation"></a>

### POST /location/create-location

Create location
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Client must exist and not be deleted.

Required role: manager.

**Access:** manager.

**Request: application/json**

| Field         | Type                         | Required | Details                                    |
| ------------- | ---------------------------- | -------- | ------------------------------------------- |
| `client`      | [ObjectId](#schema-objectid) | Yes      |                                             |
| `name`        | string                       | Yes      | minLength: 1.                               |
| `address`     | string                       | Yes      | minLength: 1.                               |
| `description` | string                       | No       |                                             |
| `type`        | string                       | Yes      | Allowed: "Hotel", "School", "Hospital", "Other". |
| `is_active`   | boolean                      | No       |                                             |
| `location`    | [Point](#schema-point)       | No       |                                             |

Example request:

```json
{
  "client": "507f1f77bcf86cd799439011",
  "name": "Head Office",
  "address": "12 Example Road, Dhaka",
  "type": "Hotel"
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Location](#schema-location).

<a id="patchlocationupdatelocationid"></a>

### PATCH /location/update-location/{id}

Update location
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Partial update.

Required role: manager.

**Access:** manager.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request: application/json**

| Field         | Type                   | Required | Details                                    |
| ------------- | ---------------------- | -------- | ------------------------------------------- |
| `name`        | string                 | No       | minLength: 1.                               |
| `address`     | string                 | No       | minLength: 1.                               |
| `description` | string                 | No       |                                             |
| `type`        | string                 | No       | Allowed: "Hotel", "School", "Hospital", "Other". |
| `is_active`   | boolean                | No       |                                             |
| `location`    | [Point](#schema-point) | No       |                                             |

Example request:

```json
{
  "name": "Head Office",
  "address": "12 Example Road, Dhaka",
  "type": "Hotel",
  "is_active": true,
  "location": {
    "coordinates": [90.4125, 23.8103]
  }
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Location](#schema-location).

<a id="deletelocationdeletelocationid"></a>

### DELETE /location/delete-location/{id}

Deactivate location
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Sets is_active=false and returns the updated document. Does not cascade to child records.

Required role: manager.

**Access:** manager.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Location](#schema-location).

<a id="getlocationalllocations"></a>

### GET /location/all-locations

List locations
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Pagination is nested under data.meta; records are under data.result. fields projection is not implemented for this aggregation endpoint. Defaults to active records.

Required role: manager.

**Access:** manager.

**Parameters**

| Name         | In    | Type    | Required | Details                                                                  |
| ------------ | ----- | ------- | -------- | ------------------------------------------------------------------------ |
| `page`       | query | integer | No       | Use a positive page number. Default: 1.                                  |
| `limit`      | query | integer | No       | Use a positive page size. Default: 10.                                   |
| `searchTerm` | query | string  | No       | Case-insensitive regex search across name, address.                      |
| `sort`       | query | string  | No       | Single field; prefix with - for descending order. Default: "created_at". |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object.

| Field    | Type                                  | Required | Details    |
| -------- | ------------------------------------- | -------- | ---------- |
| `meta`   | [Pagination](#schema-pagination)      | Yes      |            |
| `result` | array of [Location](#schema-location) | Yes      | Each item: |

<a id="getlocationsinglelocationid"></a>

### GET /location/single-location/{id}

Get location
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Includes populated references. The service does not exclude inactive records.

Required role: manager.

**Access:** manager.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Location](#schema-location).

<a id="getlocationclientlocationsclientid"></a>

### GET /location/client-locations/{clientId}

List a client's locations
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Returns data.meta and data.result, with total_room on each location. fields projection is not implemented.

Required role: manager.

**Access:** manager.

**Parameters**

| Name         | In    | Type                         | Required | Details                                                                  |
| ------------ | ----- | ---------------------------- | -------- | ------------------------------------------------------------------------ |
| `clientId`   | path  | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier.                                             |
| `page`       | query | integer                      | No       | Use a positive page number. Default: 1.                                  |
| `limit`      | query | integer                      | No       | Use a positive page size. Default: 10.                                   |
| `searchTerm` | query | string                       | No       | Case-insensitive regex search across name, address.                      |
| `sort`       | query | string                       | No       | Single field; prefix with - for descending order. Default: "created_at". |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object.

| Field    | Type                                  | Required | Details    |
| -------- | ------------------------------------- | -------- | ---------- |
| `meta`   | [Pagination](#schema-pagination)      | Yes      |            |
| `result` | array of [Location](#schema-location) | Yes      | Each item: |

<a id="getlocationmylocations"></a>

### GET /location/my-locations

My locations
Client-only. Returns locations belonging to the authenticated client. Pagination is nested under data.meta; records are under data.result.

Required role: client.

**Access:** client.

**Parameters**

| Name         | In    | Type    | Required | Details                                                                  |
| ------------ | ----- | ------- | -------- | ------------------------------------------------------------------------ |
| `page`       | query | integer | No       | Use a positive page number. Default: 1.                                  |
| `limit`      | query | integer | No       | Use a positive page size. Default: 10.                                   |
| `searchTerm` | query | string  | No       | Case-insensitive regex search across name, address.                      |
| `sort`       | query | string  | No       | Single field; prefix with - for descending order. Default: "created_at". |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object.

| Field    | Type                                   | Required | Details    |
| -------- | --------------------------------------- | -------- | ---------- |
| `meta`   | [Pagination](#schema-pagination)       | Yes      |            |
| `result` | array of [Location](#schema-location)  | Yes      | Each item: |

## Rooms

Rooms within a location and task counts.

<a id="postroomcreateroom"></a>

### POST /room/create-room

Create room
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. The location must be active.

Required role: manager.

**Access:** manager.

**Request: application/json**

| Field           | Type                         | Required | Details       |
| --------------- | ---------------------------- | -------- | ------------- |
| `location`      | [ObjectId](#schema-objectid) | Yes      |               |
| `name`          | string                       | Yes      | minLength: 1. |
| `room_type`     | string                       | Yes      | minLength: 1. |
| `cleaning_type` | string                       | Yes      | minLength: 1. |
| `floor`         | number                       | No       |               |
| `is_active`     | boolean                      | No       |               |

Example request:

```json
{
  "location": "507f1f77bcf86cd799439011",
  "name": "Conference Room",
  "room_type": "meeting",
  "cleaning_type": "Standard",
  "floor": 2
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Room](#schema-room).

<a id="patchroomupdateroomid"></a>

### PATCH /room/update-room/{id}

Update room
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Partial update.

Required role: manager.

**Access:** manager.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request: application/json**

| Field           | Type    | Required | Details       |
| --------------- | ------- | -------- | ------------- |
| `name`          | string  | No       | minLength: 1. |
| `room_type`     | string  | No       | minLength: 1. |
| `cleaning_type` | string  | No       | minLength: 1. |
| `floor`         | number  | No       |               |
| `is_active`     | boolean | No       |               |

Example request:

```json
{
  "name": "Conference Room",
  "room_type": "meeting",
  "cleaning_type": "Standard",
  "floor": 2,
  "is_active": true
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Room](#schema-room).

<a id="deleteroomdeleteroomid"></a>

### DELETE /room/delete-room/{id}

Deactivate room
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Sets is_active=false and returns the updated document. Does not cascade to child records.

Required role: manager.

**Access:** manager.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Room](#schema-room).

<a id="getroomallrooms"></a>

### GET /room/all-rooms

List all rooms
Manager-only. Unscoped room listing across all locations, filterable by location and client. Pagination is nested under data.meta; records are under data.result. Defaults to active records.

Required role: manager.

**Access:** manager.

**Parameters**

| Name         | In    | Type                          | Required | Details                                                                  |
| ------------ | ----- | ----------------------------- | -------- | ------------------------------------------------------------------------ |
| `location`   | query | [ObjectId](#schema-objectid)  | No       | Filter rooms belonging to this location.                                 |
| `client`     | query | [ObjectId](#schema-objectid)  | No       | Filter rooms whose location belongs to this client.                      |
| `page`       | query | integer                       | No       | Use a positive page number. Default: 1.                                  |
| `limit`      | query | integer                       | No       | Use a positive page size. Default: 10.                                   |
| `searchTerm` | query | string                        | No       | Case-insensitive regex search across name, room_type, cleaning_type.     |
| `sort`       | query | string                        | No       | Single field; prefix with - for descending order. Default: "created_at". |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object.

| Field    | Type                             | Required | Details    |
| -------- | --------------------------------- | -------- | ---------- |
| `meta`   | [Pagination](#schema-pagination) | Yes      |            |
| `result` | array of [Room](#schema-room)    | Yes      | Each item: |

<a id="getroomallroomslocationid"></a>

### GET /room/all-rooms/{locationId}

List rooms
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Pagination is nested under data.meta; records are under data.result. fields projection is not implemented for this aggregation endpoint. Defaults to active records.

Required role: manager.

**Access:** manager.

**Parameters**

| Name         | In    | Type                         | Required | Details                                                                  |
| ------------ | ----- | ---------------------------- | -------- | ------------------------------------------------------------------------ |
| `locationId` | path  | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier.                                             |
| `page`       | query | integer                      | No       | Use a positive page number. Default: 1.                                  |
| `limit`      | query | integer                      | No       | Use a positive page size. Default: 10.                                   |
| `searchTerm` | query | string                       | No       | Case-insensitive regex search across name, room_type, cleaning_type.     |
| `sort`       | query | string                       | No       | Single field; prefix with - for descending order. Default: "created_at". |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object.

| Field    | Type                             | Required | Details    |
| -------- | -------------------------------- | -------- | ---------- |
| `meta`   | [Pagination](#schema-pagination) | Yes      |            |
| `result` | array of [Room](#schema-room)    | Yes      | Each item: |

<a id="getroomsingleroomid"></a>

### GET /room/single-room/{id}

Get room
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Includes populated references. The service does not exclude inactive records.

Required role: manager.

**Access:** manager.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Room](#schema-room).

<a id="getroommyroomslocationid"></a>

### GET /room/my-rooms/{locationId}

My rooms
Client-only. locationId must be one of the client's own locations, otherwise 404 Location not found. Pagination is nested under data.meta; records are under data.result.

Required role: client.

**Access:** client.

**Parameters**

| Name         | In    | Type                         | Required | Details                                                                  |
| ------------ | ----- | ---------------------------- | -------- | ------------------------------------------------------------------------ |
| `locationId` | path  | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier.                                             |
| `page`       | query | integer                      | No       | Use a positive page number. Default: 1.                                  |
| `limit`      | query | integer                      | No       | Use a positive page size. Default: 10.                                   |
| `searchTerm` | query | string                       | No       | Case-insensitive regex search across name, room_type, cleaning_type.     |
| `sort`       | query | string                       | No       | Single field; prefix with - for descending order. Default: "created_at". |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object.

| Field    | Type                             | Required | Details    |
| -------- | --------------------------------- | -------- | ---------- |
| `meta`   | [Pagination](#schema-pagination) | Yes      |            |
| `result` | array of [Room](#schema-room)    | Yes      | Each item: |

## Tasks

Daily, weekly and monthly task definitions.

<a id="posttaskcreatetask"></a>

### POST /task/create-task

Create task
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. The room and its location must be active.

Required role: manager.

**Access:** manager.

**Request: application/json**
weekly requires a nonempty days_of_week array; monthly requires a nonempty days_of_month array. client and location are resolved from room.

| Field               | Type                         | Required | Details                                                              |
| ------------------- | ---------------------------- | -------- | -------------------------------------------------------------------- |
| `room`              | [ObjectId](#schema-objectid) | Yes      |                                                                      |
| `name`              | string                       | Yes      | minLength: 1.                                                        |
| `frequency_type`    | string                       | Yes      | Allowed: "daily", "weekly", "monthly".                               |
| `is_photo_required` | boolean                      | No       |                                                                      |
| `duration_minutes`  | number                       | No       | minimum: 0. Minimum is exclusive.                                    |
| `days_of_week`      | array of string              | No       | Each item: Allowed: "mon", "tue", "wed", "thu", "fri", "sat", "sun". |
| `days_of_month`     | array of number              | No       | Each item: minimum: 1. maximum: 31.                                  |
| `is_active`         | boolean                      | No       |                                                                      |

Example request:

```json
{
  "room": "507f1f77bcf86cd799439011",
  "name": "Clean meeting table",
  "frequency_type": "weekly",
  "days_of_week": ["mon", "fri"],
  "is_photo_required": true,
  "duration_minutes": 15
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Task](#schema-task).

<a id="patchtaskupdatetaskid"></a>

### PATCH /task/update-task/{id}

Update task
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Partial update. When changing to weekly/monthly, supply the corresponding nonempty schedule array.

Required role: manager.

**Access:** manager.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request: application/json**
If frequency_type is supplied as weekly or monthly, include its nonempty scheduling array in this request. Parent references cannot be changed through the documented update contract.

| Field               | Type            | Required | Details                                                              |
| ------------------- | --------------- | -------- | -------------------------------------------------------------------- |
| `name`              | string          | No       | minLength: 1.                                                        |
| `frequency_type`    | string          | No       | Allowed: "daily", "weekly", "monthly".                               |
| `is_photo_required` | boolean         | No       |                                                                      |
| `duration_minutes`  | number          | No       | minimum: 0. Minimum is exclusive.                                    |
| `days_of_week`      | array of string | No       | Each item: Allowed: "mon", "tue", "wed", "thu", "fri", "sat", "sun". |
| `days_of_month`     | array of number | No       | Each item: minimum: 1. maximum: 31.                                  |
| `is_active`         | boolean         | No       |                                                                      |

Example request:

```json
{
  "name": "Clean meeting table",
  "frequency_type": "daily",
  "is_photo_required": true,
  "duration_minutes": 15,
  "days_of_week": ["mon"],
  "days_of_month": [1],
  "is_active": true
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Task](#schema-task).

<a id="deletetaskdeletetaskid"></a>

### DELETE /task/delete-task/{id}

Deactivate task
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Sets is_active=false and returns the updated document. Does not cascade to child records.

Required role: manager.

**Access:** manager.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Task](#schema-task).

<a id="gettaskalltasksroomid"></a>

### GET /task/all-tasks/{roomId}

List tasks
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Pagination is nested under data.meta; records are under data.result. Defaults to active records.

Required role: manager.

**Access:** manager.

**Parameters**

| Name         | In    | Type                         | Required | Details                                                                  |
| ------------ | ----- | ---------------------------- | -------- | ------------------------------------------------------------------------ |
| `roomId`     | path  | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier.                                             |
| `page`       | query | integer                      | No       | Use a positive page number. Default: 1.                                  |
| `limit`      | query | integer                      | No       | Use a positive page size. Default: 10.                                   |
| `searchTerm` | query | string                       | No       | Case-insensitive regex search across name.                               |
| `sort`       | query | string                       | No       | Single field; prefix with - for descending order. Default: "-createdAt". |
| `fields`     | query | string                       | No       | Comma-separated fields, for example name,email.                          |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object.

| Field    | Type                             | Required | Details    |
| -------- | -------------------------------- | -------- | ---------- |
| `meta`   | [Pagination](#schema-pagination) | Yes      |            |
| `result` | array of [Task](#schema-task)    | Yes      | Each item: |

<a id="gettasksingletaskid"></a>

### GET /task/single-task/{id}

Get task
Implementation note: routes require manager, but auth.ts currently has no manager profile lookup; these calls can fail before reaching the controller. Includes populated references. The service does not exclude inactive records.

Required role: manager.

**Access:** manager.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Task](#schema-task).

<a id="gettaskmytasksroomid"></a>

### GET /task/my-tasks/{roomId}

My tasks
Client-only. roomId must be inside one of the client's own locations, otherwise 404 Room not found. Pagination is nested under data.meta; records are under data.result.

Required role: client.

**Access:** client.

**Parameters**

| Name         | In    | Type                         | Required | Details                                                                   |
| ------------ | ----- | ---------------------------- | -------- | -------------------------------------------------------------------------- |
| `roomId`     | path  | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier.                                              |
| `page`       | query | integer                      | No       | Use a positive page number. Default: 1.                                   |
| `limit`      | query | integer                      | No       | Use a positive page size. Default: 10.                                    |
| `searchTerm` | query | string                       | No       | Case-insensitive regex search across name.                                |
| `sort`       | query | string                       | No       | Single field; prefix with - for descending order. Default: "-createdAt". |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object.

| Field    | Type                             | Required | Details    |
| -------- | --------------------------------- | -------- | ---------- |
| `meta`   | [Pagination](#schema-pagination) | Yes      |            |
| `result` | array of [Task](#schema-task)    | Yes      | Each item: |

## Invoices

Manager-recorded worker payments.

<a id="postinvoicecreateinvoice"></a>

### POST /invoice/create-invoice

Create invoice
Records a payment made to a worker. The worker must exist and not be deleted, and its pending_amount (total_earning - total_paid) must be >= amount, or this returns 400. On success, amount is added to the worker's total_paid and subtracted from pending_amount, atomically (a transaction guards against two concurrent invoices overdrawing the same worker's pending balance).

Required role: manager.

**Additional error: HTTP 400.** Insufficient pending amount for this worker.

**Access:** manager.

**Request: application/json**

| Field            | Type   | Required | Details              |
| ---------------- | ------ | -------- | -------------------- |
| `worker`         | [ObjectId](#schema-objectid) | Yes | |
| `amount`         | number | Yes      | Must be greater than 0. |
| `payment_method` | string | Yes      | minLength: 1.         |
| `transaction_id` | string | No       |                       |
| `notes`          | string | No       |                       |

Example request:

```json
{
  "worker": "507f1f77bcf86cd799439011",
  "amount": 150.5,
  "payment_method": "Bank Transfer",
  "transaction_id": "TXN-2026-0912-001",
  "notes": "September payout"
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Invoice](#schema-invoice).

<a id="getinvoiceallinvoices"></a>

### GET /invoice/all-invoices

List all invoices
Pagination is nested under data.meta; records are under data.result.

Required role: manager.

**Access:** manager.

**Parameters**

| Name         | In    | Type                          | Required | Details                                                                   |
| ------------ | ----- | ------------------------------ | -------- | -------------------------------------------------------------------------- |
| `worker`     | query | [ObjectId](#schema-objectid)  | No       | Filter invoices for this worker.                                          |
| `page`       | query | integer                       | No       | Use a positive page number. Default: 1.                                   |
| `limit`      | query | integer                       | No       | Use a positive page size. Default: 10.                                    |
| `searchTerm` | query | string                        | No       | Case-insensitive regex search across payment_method, transaction_id, notes. |
| `sort`       | query | string                        | No       | Single field; prefix with - for descending order. Default: "-createdAt".  |
| `fields`     | query | string                        | No       | Comma-separated fields, for example amount,payment_method.                |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object.

| Field    | Type                                | Required | Details    |
| -------- | ------------------------------------ | -------- | ---------- |
| `meta`   | [Pagination](#schema-pagination)    | Yes      |            |
| `result` | array of [Invoice](#schema-invoice) | Yes      | Each item: |

<a id="getinvoicemyinvoices"></a>

### GET /invoice/my-invoices

My invoices
Returns invoices belonging to the authenticated worker; a `worker` query param is ignored (the caller's own scope is always enforced). Pagination is nested under data.meta; records are under data.result.

Required role: worker.

**Access:** worker.

**Parameters**

| Name         | In    | Type    | Required | Details                                                                    |
| ------------ | ----- | ------- | -------- | ---------------------------------------------------------------------------- |
| `page`       | query | integer | No       | Use a positive page number. Default: 1.                                     |
| `limit`      | query | integer | No       | Use a positive page size. Default: 10.                                      |
| `searchTerm` | query | string  | No       | Case-insensitive regex search across payment_method, transaction_id, notes. |
| `sort`       | query | string  | No       | Single field; prefix with - for descending order. Default: "-createdAt".   |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object.

| Field    | Type                                | Required | Details    |
| -------- | ------------------------------------ | -------- | ---------- |
| `meta`   | [Pagination](#schema-pagination)    | Yes      |            |
| `result` | array of [Invoice](#schema-invoice) | Yes      | Each item: |

## Administration

Administrator account management.

<a id="postadmincreateadmin"></a>

### POST /admin/create-admin

Create an administrator
superAdmin only. Creates user/profile in a transaction and sends credentials by email. For multipart, put JSON in data and the image in profile_image.

**Access:** superAdmin.

**Request: application/json**
Required by account creation, although the current Zod schema makes these fields optional. Passwords must match.

| Field             | Type              | Required | Details |
| ----------------- | ----------------- | -------- | ------- |
| `name`            | string            | Yes      |         |
| `email`           | string (email)    | Yes      |         |
| `password`        | string (password) | Yes      |         |
| `confirmPassword` | string (password) | Yes      |         |
| `address`         | string            | No       |         |
| `website`         | string            | No       |         |

Example request:

```json
{
  "name": "example",
  "email": "user@example.com",
  "password": "ExamplePass123!",
  "confirmPassword": "ExamplePass123!"
}
```

**Request: multipart/form-data**

| Field           | Type            | Required | Details                      |
| --------------- | --------------- | -------- | ---------------------------- |
| `data`          | string          | No       | JSON-encoded profile object. |
| `profile_image` | string (binary) | No       |                              |

Use form fields shown above; binary fields are file attachments. Let your HTTP client set the multipart boundary.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Admin](#schema-admin).

<a id="patchadminupdateadmin"></a>

### PATCH /admin/update-admin

Update the caller's admin profile
superAdmin only, but the service searches Admin by the caller's user ID. Can return null when that caller has no Admin profile. No target ID is accepted.

**Access:** superAdmin.

**Request: application/json**

| Field     | Type           | Required | Details |
| --------- | -------------- | -------- | ------- |
| `name`    | string         | No       |         |
| `email`   | string (email) | No       |         |
| `address` | string         | No       |         |
| `website` | string         | No       |         |

Example request:

```json
{
  "name": "example",
  "email": "user@example.com",
  "address": "example",
  "website": "example"
}
```

**Request: multipart/form-data**

| Field           | Type            | Required | Details                      |
| --------------- | --------------- | -------- | ---------------------------- |
| `data`          | string          | No       | JSON-encoded profile object. |
| `profile_image` | string (binary) | No       |                              |

Use form fields shown above; binary fields are file attachments. Let your HTTP client set the multipart boundary.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object or null.

| Field           | Type                         | Required | Details |
| --------------- | ---------------------------- | -------- | ------- |
| `_id`           | [ObjectId](#schema-objectid) | No       |         |
| `user`          | [ObjectId](#schema-objectid) | No       |         |
| `name`          | string                       | No       |         |
| `email`         | string (email)               | No       |         |
| `phone`         | string                       | No       |         |
| `profile_image` | string                       | No       |         |
| `address`       | string or null               | No       |         |
| `website`       | string or null               | No       |         |
| `isActive`      | boolean                      | No       |         |

<a id="deleteadmindeleteadminid"></a>

### DELETE /admin/delete-admin/{id}

Delete an administrator
superAdmin only. Permanently deletes both administrator profile and user in a transaction.

**Access:** superAdmin.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Null](#schema-null).

<a id="patchadminupdateadminstatusid"></a>

### PATCH /admin/update-admin-status/{id}

Toggle administrator status
superAdmin only. No body. Toggles isActive on both profile and user.

**Access:** superAdmin.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Admin](#schema-admin).

**Additional error: HTTP 503.** Status update transaction failed.

<a id="getadminalladmins"></a>

### GET /admin/all-admins

List administrators
superAdmin only. Pagination is in data.meta. The current searchTerm implementation targets storeName, which is absent from the admin model.

**Access:** superAdmin.

**Parameters**

| Name     | In    | Type    | Required | Details                                                                  |
| -------- | ----- | ------- | -------- | ------------------------------------------------------------------------ |
| `page`   | query | integer | No       | Use a positive page number. Default: 1.                                  |
| `limit`  | query | integer | No       | Use a positive page size. Default: 10.                                   |
| `sort`   | query | string  | No       | Single field; prefix with - for descending order. Default: "-createdAt". |
| `fields` | query | string  | No       | Comma-separated fields, for example name,email.                          |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object.

| Field    | Type                             | Required | Details    |
| -------- | -------------------------------- | -------- | ---------- |
| `meta`   | [Pagination](#schema-pagination) | No       |            |
| `result` | array of [Admin](#schema-admin)  | No       | Each item: |

## Website content

Public content reads and superAdmin content management.

<a id="getmanagegetaboutus"></a>

### GET /manage/get-about-us

Get about-us
Public content. Returns the first document, or null if absent.

**Access:** Public (no route-level authentication).

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object or null.

| Field         | Type               | Required | Details                     |
| ------------- | ------------------ | -------- | --------------------------- |
| `description` | string             | No       |                             |
| `_id`         | string             | No       | pattern: ^[a-fA-F0-9]{24}$. |
| `createdAt`   | string (date-time) | No       |                             |
| `updatedAt`   | string (date-time) | No       |                             |

<a id="postmanageaddaboutus"></a>

### POST /manage/add-about-us

Add about-us
Creates or updates the first document. On the update branch the current service returns undefined, so data is omitted.

Required role: superAdmin.

**Access:** superAdmin.

**Request: application/json**

| Field         | Type   | Required | Details |
| ------------- | ------ | -------- | ------- |
| `description` | string | Yes      |         |

Example request:

```json
{
  "description": "About our company."
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [AboutUs](#schema-aboutus).

<a id="patchmanageeditaboutusid"></a>

### PATCH /manage/edit-about-us/{id}

Edit about-us
Required role: superAdmin.

**Access:** superAdmin.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request: application/json**

| Field         | Type   | Required | Details |
| ------------- | ------ | -------- | ------- |
| `description` | string | No       |         |

Example request:

```json
{
  "description": "About our company."
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [AboutUs](#schema-aboutus).

<a id="deletemanagedeleteaboutusid"></a>

### DELETE /manage/delete-about-us/{id}

Delete about-us
Permanently deletes the document and returns it.

Required role: superAdmin.

**Access:** superAdmin.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [AboutUs](#schema-aboutus).

<a id="getmanagegetprivacypolicy"></a>

### GET /manage/get-privacy-policy

Get privacy-policy
Public content. Returns the first document, or null if absent.

**Access:** Public (no route-level authentication).

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object or null.

| Field         | Type               | Required | Details                     |
| ------------- | ------------------ | -------- | --------------------------- |
| `description` | string             | No       |                             |
| `_id`         | string             | No       | pattern: ^[a-fA-F0-9]{24}$. |
| `createdAt`   | string (date-time) | No       |                             |
| `updatedAt`   | string (date-time) | No       |                             |

<a id="postmanageaddprivacypolicy"></a>

### POST /manage/add-privacy-policy

Add privacy-policy
Creates or updates the first document. On the update branch the current service returns undefined, so data is omitted.

Required role: superAdmin.

**Access:** superAdmin.

**Request: application/json**

| Field         | Type   | Required | Details |
| ------------- | ------ | -------- | ------- |
| `description` | string | Yes      |         |

Example request:

```json
{
  "description": "Privacy policy text."
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [PrivacyPolicy](#schema-privacypolicy).

<a id="patchmanageeditprivacypolicyid"></a>

### PATCH /manage/edit-privacy-policy/{id}

Edit privacy-policy
Required role: superAdmin.

**Access:** superAdmin.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request: application/json**

| Field         | Type   | Required | Details |
| ------------- | ------ | -------- | ------- |
| `description` | string | No       |         |

Example request:

```json
{
  "description": "Privacy policy text."
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [PrivacyPolicy](#schema-privacypolicy).

<a id="deletemanagedeleteprivacypolicyid"></a>

### DELETE /manage/delete-privacy-policy/{id}

Delete privacy-policy
Permanently deletes the document and returns it.

Required role: superAdmin.

**Access:** superAdmin.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [PrivacyPolicy](#schema-privacypolicy).

<a id="getmanagegettermsconditions"></a>

### GET /manage/get-terms-conditions

Get terms-conditions
Public content. Returns the first document, or null if absent.

**Access:** Public (no route-level authentication).

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object or null.

| Field         | Type               | Required | Details                     |
| ------------- | ------------------ | -------- | --------------------------- |
| `description` | string             | No       |                             |
| `_id`         | string             | No       | pattern: ^[a-fA-F0-9]{24}$. |
| `createdAt`   | string (date-time) | No       |                             |
| `updatedAt`   | string (date-time) | No       |                             |

<a id="postmanageaddtermsconditions"></a>

### POST /manage/add-terms-conditions

Add terms-conditions
Creates or updates the first document. On the update branch the current service returns undefined, so data is omitted.

Required role: superAdmin.

**Access:** superAdmin.

**Request: application/json**

| Field         | Type   | Required | Details |
| ------------- | ------ | -------- | ------- |
| `description` | string | Yes      |         |

Example request:

```json
{
  "description": "Terms and conditions."
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [TermsConditions](#schema-termsconditions).

<a id="patchmanageedittermsconditionsid"></a>

### PATCH /manage/edit-terms-conditions/{id}

Edit terms-conditions
Required role: superAdmin.

**Access:** superAdmin.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request: application/json**

| Field         | Type   | Required | Details |
| ------------- | ------ | -------- | ------- |
| `description` | string | No       |         |

Example request:

```json
{
  "description": "Terms and conditions."
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [TermsConditions](#schema-termsconditions).

<a id="deletemanagedeletetermsconditionsid"></a>

### DELETE /manage/delete-terms-conditions/{id}

Delete terms-conditions
Permanently deletes the document and returns it.

Required role: superAdmin.

**Access:** superAdmin.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [TermsConditions](#schema-termsconditions).

<a id="getmanagegetpartner"></a>

### GET /manage/get-partner

Get partner
Public content. Returns the first document, or null if absent.

**Access:** Public (no route-level authentication).

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object or null.

| Field         | Type               | Required | Details                     |
| ------------- | ------------------ | -------- | --------------------------- |
| `description` | string             | No       |                             |
| `_id`         | string             | No       | pattern: ^[a-fA-F0-9]{24}$. |
| `createdAt`   | string (date-time) | No       |                             |
| `updatedAt`   | string (date-time) | No       |                             |

<a id="postmanageaddpartner"></a>

### POST /manage/add-partner

Add partner
Creates or updates the first document. On the update branch the current service returns undefined, so data is omitted.

Required role: superAdmin.

**Access:** superAdmin.

**Request: application/json**

| Field         | Type   | Required | Details |
| ------------- | ------ | -------- | ------- |
| `description` | string | Yes      |         |

Example request:

```json
{
  "description": "Partner information."
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Partner](#schema-partner).

<a id="patchmanageeditpartnerid"></a>

### PATCH /manage/edit-partner/{id}

Edit partner
Required role: superAdmin.

**Access:** superAdmin.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request: application/json**

| Field         | Type   | Required | Details |
| ------------- | ------ | -------- | ------- |
| `description` | string | No       |         |

Example request:

```json
{
  "description": "Partner information."
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Partner](#schema-partner).

<a id="deletemanagedeletepartnerid"></a>

### DELETE /manage/delete-partner/{id}

Delete partner
Permanently deletes the document and returns it.

Required role: superAdmin.

**Access:** superAdmin.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Partner](#schema-partner).

<a id="getmanagegetcontactus"></a>

### GET /manage/get-contact-us

Get contact-us
Public content. Returns the first document, or null if absent.

**Access:** Public (no route-level authentication).

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object or null.

| Field          | Type               | Required | Details                     |
| -------------- | ------------------ | -------- | --------------------------- |
| `email`        | string             | No       |                             |
| `phone_number` | string             | No       |                             |
| `_id`          | string             | No       | pattern: ^[a-fA-F0-9]{24}$. |
| `createdAt`    | string (date-time) | No       |                             |
| `updatedAt`    | string (date-time) | No       |                             |

<a id="postmanageaddcontactus"></a>

### POST /manage/add-contact-us

Add contact-us
Required role: superAdmin.

**Access:** superAdmin.

**Request: application/json**

| Field          | Type   | Required | Details |
| -------------- | ------ | -------- | ------- |
| `email`        | string | Yes      |         |
| `phone_number` | string | Yes      |         |

Example request:

```json
{
  "email": "support@example.com",
  "phone_number": "+8801700000000"
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [ContactDetails](#schema-contactdetails).

<a id="patchmanageeditcontactusid"></a>

### PATCH /manage/edit-contact-us/{id}

Edit contact-us
Required role: superAdmin.

**Access:** superAdmin.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request: application/json**

| Field          | Type   | Required | Details |
| -------------- | ------ | -------- | ------- |
| `email`        | string | No       |         |
| `phone_number` | string | No       |         |

Example request:

```json
{
  "email": "support@example.com",
  "phone_number": "+8801700000000"
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [ContactDetails](#schema-contactdetails).

<a id="deletemanagedeletecontactusid"></a>

### DELETE /manage/delete-contact-us/{id}

Delete contact-us
Permanently deletes the document and returns it.

Required role: superAdmin.

**Access:** superAdmin.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [ContactDetails](#schema-contactdetails).

<a id="getmanagegetfaq"></a>

### GET /manage/get-faq

Get faq
Public content. Returns an array.

**Access:** Public (no route-level authentication).

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** array of [FAQ](#schema-faq).

Type: array of [FAQ](#schema-faq).

<a id="postmanageaddfaq"></a>

### POST /manage/add-faq

Add faq
Required role: superAdmin.

**Access:** superAdmin.

**Request: application/json**

| Field      | Type   | Required | Details |
| ---------- | ------ | -------- | ------- |
| `question` | string | Yes      |         |
| `answer`   | string | Yes      |         |

Example request:

```json
{
  "question": "How do I contact support?",
  "answer": "Email support@example.com."
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [FAQ](#schema-faq).

<a id="patchmanageeditfaqid"></a>

### PATCH /manage/edit-faq/{id}

Edit faq
Required role: superAdmin.

**Access:** superAdmin.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request: application/json**

| Field      | Type   | Required | Details |
| ---------- | ------ | -------- | ------- |
| `question` | string | No       |         |
| `answer`   | string | No       |         |

Example request:

```json
{
  "question": "How do I contact support?",
  "answer": "Email support@example.com."
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [FAQ](#schema-faq).

<a id="deletemanagedeletefaqid"></a>

### DELETE /manage/delete-faq/{id}

Delete faq
Permanently deletes the document and returns it.

Required role: superAdmin.

**Access:** superAdmin.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [FAQ](#schema-faq).

<a id="getmanagegetslider"></a>

### GET /manage/get-slider

Get slider
Public content. Returns an array.

**Access:** Public (no route-level authentication).

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** array of [Slider](#schema-slider).

Type: array of [Slider](#schema-slider).

<a id="postmanageaddslider"></a>

### POST /manage/add-slider

Add slider
Multipart title and image file; stored image paths are returned by the existing local uploader.

Required role: superAdmin.

**Access:** superAdmin.

**Request: multipart/form-data**

| Field   | Type            | Required | Details |
| ------- | --------------- | -------- | ------- |
| `title` | string          | Yes      |         |
| `image` | string (binary) | Yes      |         |

Use form fields shown above; binary fields are file attachments. Let your HTTP client set the multipart boundary.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Slider](#schema-slider).

<a id="patchmanageeditsliderid"></a>

### PATCH /manage/edit-slider/{id}

Edit slider
Multipart title and image file; stored image paths are returned by the existing local uploader.

Required role: superAdmin.

**Access:** superAdmin.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request: multipart/form-data**

| Field   | Type            | Required | Details |
| ------- | --------------- | -------- | ------- |
| `title` | string          | No       |         |
| `image` | string (binary) | No       |         |

Use form fields shown above; binary fields are file attachments. Let your HTTP client set the multipart boundary.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Slider](#schema-slider).

<a id="deletemanagedeletesliderid"></a>

### DELETE /manage/delete-slider/{id}

Delete slider
Permanently deletes the document and returns it.

Required role: superAdmin.

**Access:** superAdmin.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Slider](#schema-slider).

## Notifications

Notifications for the authenticated receiver.

<a id="getnotificationgetnotifications"></a>

### GET /notification/get-notifications

List notifications
Lists notifications for the authenticated profile; superAdmin uses receiver admin.

Required role: superAdmin, client, worker, admin.

**Access:** superAdmin, client, worker, admin.

**Parameters**

| Name         | In    | Type    | Required | Details                                                                  |
| ------------ | ----- | ------- | -------- | ------------------------------------------------------------------------ |
| `page`       | query | integer | No       | Use a positive page number. Default: 1.                                  |
| `limit`      | query | integer | No       | Use a positive page size. Default: 10.                                   |
| `searchTerm` | query | string  | No       | Case-insensitive regex search across title.                              |
| `sort`       | query | string  | No       | Single field; prefix with - for descending order. Default: "-createdAt". |
| `fields`     | query | string  | No       | Comma-separated fields, for example name,email.                          |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object.

| Field    | Type                                          | Required | Details    |
| -------- | --------------------------------------------- | -------- | ---------- |
| `meta`   | [Pagination](#schema-pagination) + object     | No       |            |
| `result` | array of [Notification](#schema-notification) | No       | Each item: |

<a id="patchnotificationseenotifications"></a>

### PATCH /notification/see-notifications

Mark all notifications read
No request body. Marks the receiver's notifications isRead=true.

Required role: superAdmin, client, worker, admin.

**Access:** superAdmin, client, worker, admin.

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [UpdateResult](#schema-updateresult).

<a id="deletenotificationdeletenotificationid"></a>

### DELETE /notification/delete-notification/{id}

Delete a notification
Deletes only a notification belonging to the receiver. Returns null if none matches.

Required role: superAdmin, client, worker, admin.

**Access:** superAdmin, client, worker, admin.

**Parameters**

| Name | In   | Type                         | Required | Details                      |
| ---- | ---- | ---------------------------- | -------- | ---------------------------- |
| `id` | path | [ObjectId](#schema-objectid) | Yes      | MongoDB document identifier. |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object or null.

| Field           | Type               | Required | Details                     |
| --------------- | ------------------ | -------- | --------------------------- |
| `_id`           | string             | No       | pattern: ^[a-fA-F0-9]{24}$. |
| `receiver`      | string             | No       |                             |
| `type`          | string             | No       |                             |
| `title`         | string             | No       |                             |
| `message`       | string             | No       |                             |
| `data`          | object             | No       |                             |
| `data.entity`   | string             | No       |                             |
| `data.action`   | string             | No       |                             |
| `data.entityId` | string             | No       | pattern: ^[a-fA-F0-9]{24}$. |
| `data.meta`     | object             | No       |                             |
| `isRead`        | boolean            | No       |                             |
| `isSeen`        | boolean            | No       |                             |
| `readAt`        | string (date-time) | No       |                             |
| `seenAt`        | string (date-time) | No       |                             |
| `createdAt`     | string (date-time) | No       |                             |
| `updatedAt`     | string (date-time) | No       |                             |

## Files

S3 conversation attachments.

<a id="postfileuploadconversationfiles"></a>

### POST /file/upload-conversation-files

Upload conversation attachments
Maximum 50 MiB per file. Requires S3 and CloudFront configuration. conversation_video is not accepted by the uploader, so videos is currently an empty array. Supply at least one supported attachment field.

Required role: worker, client.

**Access:** worker, client.

**Request: multipart/form-data**

| Field                | Type                     | Required | Details                 |
| -------------------- | ------------------------ | -------- | ----------------------- |
| `conversation_image` | array of string (binary) | No       | maxItems: 5. Each item: |
| `conversation_pdf`   | array of string (binary) | No       | maxItems: 2. Each item: |

Use form fields shown above; binary fields are file attachments. Let your HTTP client set the multipart boundary.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object.

| Field    | Type            | Required | Details    |
| -------- | --------------- | -------- | ---------- |
| `images` | array of string | No       | Each item: |
| `videos` | array of string | No       | Each item: |
| `pdfs`   | array of string | No       | Each item: |

<a id="postfiledeletefiles"></a>

### POST /file/delete-files

Delete uploaded files
Deletes each supplied file through the existing S3 delete helper.

Required role: worker, client.

**Access:** worker, client.

**Request: application/json**

| Field   | Type            | Required | Details    |
| ------- | --------------- | -------- | ---------- |
| `files` | array of string | Yes      | Each item: |

Example request:

```json
{
  "files": [
    "https://cdn.example.com/uploads/images/conversation_image/example.png"
  ]
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [Null](#schema-null).

## Legal information

Shared company and platform information.

<a id="getlegalinfoget"></a>

### GET /legal-info/get

Get legal information
Public endpoint. Returns the first record or null; no venue-owner parameter is used.

**Access:** Public (no route-level authentication).

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object or null.

| Field                   | Type   | Required | Details                     |
| ----------------------- | ------ | -------- | --------------------------- |
| `venueOwner`            | string | No       | pattern: ^[a-fA-F0-9]{24}$. |
| `companyName`           | string | No       |                             |
| `businessType`          | string | No       |                             |
| `registeredAddress`     | string | No       |                             |
| `contactEmail`          | string | No       |                             |
| `contactPhone`          | string | No       |                             |
| `jurisdiction`          | string | No       |                             |
| `officialWebsite`       | string | No       |                             |
| `platformFeePercentage` | number | No       | Default: 20.                |
| `freeCancellationHour`  | number | No       | Default: 24.                |

<a id="postlegalinfoaddupdate"></a>

### POST /legal-info/add-update

Create or update legal information
Upserts the first record using an empty filter, not a venue-owner-specific lookup. Supply all company/contact fields and venueOwner when creating.

Required role: superAdmin.

**Access:** superAdmin.

**Request: application/json**

| Field                   | Type   | Required | Details                     |
| ----------------------- | ------ | -------- | --------------------------- |
| `venueOwner`            | string | No       | pattern: ^[a-fA-F0-9]{24}$. |
| `companyName`           | string | No       |                             |
| `businessType`          | string | No       |                             |
| `registeredAddress`     | string | No       |                             |
| `contactEmail`          | string | No       |                             |
| `contactPhone`          | string | No       |                             |
| `jurisdiction`          | string | No       |                             |
| `officialWebsite`       | string | No       |                             |
| `platformFeePercentage` | number | No       | Default: 20.                |
| `freeCancellationHour`  | number | No       | Default: 24.                |

Example request:

```json
{
  "venueOwner": "507f1f77bcf86cd799439011",
  "companyName": "example",
  "businessType": "example",
  "registeredAddress": "example",
  "contactEmail": "user@example.com",
  "contactPhone": "example",
  "jurisdiction": "example",
  "officialWebsite": "example",
  "platformFeePercentage": 20,
  "freeCancellationHour": 24
}
```

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** [LegalInfo](#schema-legalinfo).

## Dashboard

Counts and reporting; limitations are noted per operation.

<a id="getmetametadata"></a>

### GET /meta/meta-data

Get dashboard totals
superAdmin or admin. Counts all Client and Worker documents; pendingReports is a placeholder fixed at zero. admin authentication profile lookup is unfinished.

**Access:** superAdmin, admin.

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object.

| Field            | Type    | Required | Details     |
| ---------------- | ------- | -------- | ----------- |
| `totalCustomer`  | integer | No       |             |
| `totalProvider`  | integer | No       |             |
| `pendingReports` | integer | No       | Allowed: 0. |

<a id="getmetacustomerchartdata"></a>

### GET /meta/customer-chart-data

Get monthly customer counts
superAdmin or admin. Returns twelve monthly buckets. Known mismatch: aggregation reads createdAt but Client stores created_at; counts can be zero.

**Access:** superAdmin, admin.

**Parameters**

| Name   | In    | Type    | Required | Details |
| ------ | ----- | ------- | -------- | ------- |
| `year` | query | integer | Yes      |         |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object.

| Field           | Type             | Required | Details    |
| --------------- | ---------------- | -------- | ---------- |
| `chartData`     | array of object  | No       | Each item: |
| `yearsDropdown` | array of integer | No       | Each item: |

<a id="getmetaproviderchartdata"></a>

### GET /meta/provider-chart-data

Get monthly provider counts
superAdmin or admin. Returns twelve monthly buckets. Counts Worker creation dates.

**Access:** superAdmin, admin.

**Parameters**

| Name   | In    | Type    | Required | Details |
| ------ | ----- | ------- | -------- | ------- |
| `year` | query | integer | Yes      |         |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object.

| Field           | Type             | Required | Details    |
| --------------- | ---------------- | -------- | ---------- |
| `chartData`     | array of object  | No       | Each item: |
| `yearsDropdown` | array of integer | No       | Each item: |

<a id="getmetagetactivities"></a>

### GET /meta/get-activities

Compare activity counts
superAdmin or admin. report is a zero-valued placeholder. Date-filtered Client counts use createdAt despite the model storing created_at. Errors caught by this service can omit data.

**Access:** superAdmin, admin.

**Parameters**

| Name    | In    | Type   | Required | Details                                                                       |
| ------- | ----- | ------ | -------- | ----------------------------------------------------------------------------- |
| `frame` | query | string | No       | Optional reporting frame, e.g. Last 24 Hours or Last Week. Omit for all time. |

**Request body:** none.

**Response: HTTP 200**

Envelope: `success`, `message`, and `data`. **data:** object.

| Field                     | Type    | Required | Details     |
| ------------------------- | ------- | -------- | ----------- |
| `customers`               | object  | No       |             |
| `customers.count`         | integer | No       |             |
| `customers.changePercent` | number  | No       |             |
| `providers`               | object  | No       |             |
| `providers.count`         | integer | No       |             |
| `providers.changePercent` | number  | No       |             |
| `report`                  | object  | No       |             |
| `report.count`            | integer | No       | Allowed: 0. |
| `report.changePercent`    | integer | No       | Allowed: 0. |

## Schema reference

Required markers reflect the documented schema. For update payloads, fields are optional unless listed otherwise. MongoDB ObjectIds are 24-character hexadecimal strings; dates use ISO 8601.

<a id="schema-objectid"></a>

### ObjectId

pattern: ^[a-fA-F0-9]{24}$.

Type: string.

<a id="schema-pagination"></a>

### Pagination

| Field       | Type    | Required | Details |
| ----------- | ------- | -------- | ------- |
| `page`      | integer | Yes      |         |
| `limit`     | integer | Yes      |         |
| `total`     | integer | Yes      |         |
| `totalPage` | integer | Yes      |         |

<a id="schema-error"></a>

### Error

| Field          | Type           | Required | Details         |
| -------------- | -------------- | -------- | --------------- |
| `success`      | boolean        | Yes      | Allowed: false. |
| `message`      | string         | Yes      |                 |
| `errorDetails` | object         | No       |                 |
| `stack`        | string or null | No       |                 |

<a id="schema-null"></a>

### Null

Allowed: null.

Type: null.

<a id="schema-point"></a>

### Point

| Field         | Type            | Required | Details                                                             |
| ------------- | --------------- | -------- | ------------------------------------------------------------------- |
| `type`        | string          | No       | Allowed: "Point". Default: "Point".                                 |
| `coordinates` | array of number | Yes      | GeoJSON [longitude, latitude]. minItems: 2. maxItems: 2. Each item: |

<a id="schema-clientcreate"></a>

### ClientCreate

| Field                     | Type               | Required | Details                                   |
| ------------------------- | ------------------ | -------- | ----------------------------------------- |
| `name`                    | string             | Yes      | minLength: 1.                             |
| `email`                   | string (email)     | Yes      |                                           |
| `phone`                   | string             | Yes      |                                           |
| `company_name`            | string             | No       |                                           |
| `licence_expiration_date` | string (date-time) | No       |                                           |
| `contract_status`         | string             | No       | Allowed: "Active", "Inactive", "Pending". |
| `password`                | string (password)  | Yes      | minLength: 6.                             |
| `confirmPassword`         | string (password)  | Yes      |                                           |

<a id="schema-clientupdate"></a>

### ClientUpdate

| Field                     | Type               | Required | Details                                   |
| ------------------------- | ------------------ | -------- | ----------------------------------------- |
| `name`                    | string             | No       | minLength: 1.                             |
| `email`                   | string (email)     | No       |                                           |
| `phone`                   | string             | No       |                                           |
| `company_name`            | string             | No       |                                           |
| `licence_expiration_date` | string (date-time) | No       |                                           |
| `contract_status`         | string             | No       | Allowed: "Active", "Inactive", "Pending". |

<a id="schema-locationcreate"></a>

### LocationCreate

| Field         | Type                         | Required | Details                                    |
| ------------- | ---------------------------- | -------- | ------------------------------------------- |
| `client`      | [ObjectId](#schema-objectid) | Yes      |                                             |
| `name`        | string                       | Yes      | minLength: 1.                               |
| `address`     | string                       | Yes      | minLength: 1.                               |
| `description` | string                       | No       |                                             |
| `type`        | string                       | Yes      | Allowed: "Hotel", "School", "Hospital", "Other". |
| `is_active`   | boolean                      | No       |                                             |
| `location`    | [Point](#schema-point)       | No       |                                             |

<a id="schema-locationupdate"></a>

### LocationUpdate

| Field         | Type                   | Required | Details                                    |
| ------------- | ---------------------- | -------- | ------------------------------------------- |
| `name`        | string                 | No       | minLength: 1.                               |
| `address`     | string                 | No       | minLength: 1.                               |
| `description` | string                 | No       |                                             |
| `type`        | string                 | No       | Allowed: "Hotel", "School", "Hospital", "Other". |
| `is_active`   | boolean                | No       |                                             |
| `location`    | [Point](#schema-point) | No       |                                             |

<a id="schema-roomcreate"></a>

### RoomCreate

| Field           | Type                         | Required | Details       |
| --------------- | ---------------------------- | -------- | ------------- |
| `location`      | [ObjectId](#schema-objectid) | Yes      |               |
| `name`          | string                       | Yes      | minLength: 1. |
| `room_type`     | string                       | Yes      | minLength: 1. |
| `cleaning_type` | string                       | Yes      | minLength: 1. |
| `floor`         | number                       | No       |               |
| `is_active`     | boolean                      | No       |               |

<a id="schema-roomupdate"></a>

### RoomUpdate

| Field           | Type    | Required | Details       |
| --------------- | ------- | -------- | ------------- |
| `name`          | string  | No       | minLength: 1. |
| `room_type`     | string  | No       | minLength: 1. |
| `cleaning_type` | string  | No       | minLength: 1. |
| `floor`         | number  | No       |               |
| `is_active`     | boolean | No       |               |

<a id="schema-taskcreate"></a>

### TaskCreate

weekly requires a nonempty days_of_week array; monthly requires a nonempty days_of_month array. client and location are resolved from room.

| Field               | Type                         | Required | Details                                                              |
| ------------------- | ---------------------------- | -------- | -------------------------------------------------------------------- |
| `room`              | [ObjectId](#schema-objectid) | Yes      |                                                                      |
| `name`              | string                       | Yes      | minLength: 1.                                                        |
| `frequency_type`    | string                       | Yes      | Allowed: "daily", "weekly", "monthly".                               |
| `is_photo_required` | boolean                      | No       |                                                                      |
| `duration_minutes`  | number                       | No       | minimum: 0. Minimum is exclusive.                                    |
| `days_of_week`      | array of string              | No       | Each item: Allowed: "mon", "tue", "wed", "thu", "fri", "sat", "sun". |
| `days_of_month`     | array of number              | No       | Each item: minimum: 1. maximum: 31.                                  |
| `is_active`         | boolean                      | No       |                                                                      |

<a id="schema-taskupdate"></a>

### TaskUpdate

If frequency_type is supplied as weekly or monthly, include its nonempty scheduling array in this request. Parent references cannot be changed through the documented update contract.

| Field               | Type            | Required | Details                                                              |
| ------------------- | --------------- | -------- | -------------------------------------------------------------------- |
| `name`              | string          | No       | minLength: 1.                                                        |
| `frequency_type`    | string          | No       | Allowed: "daily", "weekly", "monthly".                               |
| `is_photo_required` | boolean         | No       |                                                                      |
| `duration_minutes`  | number          | No       | minimum: 0. Minimum is exclusive.                                    |
| `days_of_week`      | array of string | No       | Each item: Allowed: "mon", "tue", "wed", "thu", "fri", "sat", "sun". |
| `days_of_month`     | array of number | No       | Each item: minimum: 1. maximum: 31.                                  |
| `is_active`         | boolean         | No       |                                                                      |

<a id="schema-client"></a>

### Client

| Field                     | Type                       | Required | Details                                                       |
| ------------------------- | -------------------------- | -------- | ------------------------------------------------------------- |
| `name`                    | string                     | No       | minLength: 1.                                                 |
| `email`                   | string (email)             | No       |                                                               |
| `phone`                   | string                     | No       |                                                               |
| `company_name`            | string or null             | No       |                                                               |
| `licence_expiration_date` | string (date-time) or null | No       |                                                               |
| `contract_status`         | string                     | No       | Allowed: "Active", "Inactive", "Pending".                     |
| `_id`                     | string                     | No       | pattern: ^[a-fA-F0-9]{24}$.                                   |
| `last_updated_by`         | string or object or null   | No       | ObjectId on writes; populated document on reads. May be null. |
| `created_at`              | string (date-time)         | No       |                                                               |
| `updated_at`              | string (date-time)         | No       |                                                               |
| `user`                    | string                     | No       | pattern: ^[a-fA-F0-9]{24}$.                                   |
| `manager`                 | string or object or null   | No       | ObjectId on writes; populated document on reads. May be null. |
| `isDeleted`               | boolean                    | No       |                                                               |

<a id="schema-location"></a>

### Location

| Field             | Type                     | Required | Details                                                       |
| ----------------- | ------------------------ | -------- | ------------------------------------------------------------- |
| `client`          | string or object or null | No       | ObjectId on writes; populated document on reads. May be null. |
| `name`            | string                   | No       | minLength: 1.                                                 |
| `address`         | string                   | No       | minLength: 1.                                                 |
| `description`     | string                   | No       |                                                               |
| `type`            | string                   | No       | Allowed: "Hotel", "School", "Hospital", "Other".              |
| `is_active`       | boolean                  | No       |                                                               |
| `location`        | [Point](#schema-point)   | No       |                                                               |
| `_id`             | string                   | No       | pattern: ^[a-fA-F0-9]{24}$.                                   |
| `last_updated_by` | string or object or null | No       | ObjectId on writes; populated document on reads. May be null. |
| `created_at`      | string (date-time)       | No       |                                                               |
| `updated_at`      | string (date-time)       | No       |                                                               |
| `total_room`      | integer                  | No       | Included by aggregation reads. Read only.                     |

<a id="schema-room"></a>

### Room

| Field             | Type                     | Required | Details                                                       |
| ----------------- | ------------------------ | -------- | ------------------------------------------------------------- |
| `location`        | string or object or null | No       | ObjectId on writes; populated document on reads. May be null. |
| `name`            | string                   | No       | minLength: 1.                                                 |
| `room_type`       | string                   | No       | minLength: 1.                                                 |
| `cleaning_type`   | string                   | No       | minLength: 1.                                                 |
| `floor`           | number or null           | No       |                                                               |
| `is_active`       | boolean                  | No       |                                                               |
| `_id`             | string                   | No       | pattern: ^[a-fA-F0-9]{24}$.                                   |
| `last_updated_by` | string or object or null | No       | ObjectId on writes; populated document on reads. May be null. |
| `createdAt`       | string (date-time)       | No       |                                                               |
| `updatedAt`       | string (date-time)       | No       |                                                               |
| `total_task`      | integer                  | No       | Included by aggregation reads. Read only.                     |

<a id="schema-task"></a>

### Task

| Field               | Type                     | Required | Details                                                              |
| ------------------- | ------------------------ | -------- | -------------------------------------------------------------------- |
| `room`              | string or object or null | No       | ObjectId on writes; populated document on reads. May be null.        |
| `name`              | string                   | No       | minLength: 1.                                                        |
| `frequency_type`    | string                   | No       | Allowed: "daily", "weekly", "monthly".                               |
| `is_photo_required` | boolean                  | No       |                                                                      |
| `duration_minutes`  | number or null           | No       |                                                                      |
| `days_of_week`      | array of string          | No       | Each item: Allowed: "mon", "tue", "wed", "thu", "fri", "sat", "sun". |
| `days_of_month`     | array of number          | No       | Each item: minimum: 1. maximum: 31.                                  |
| `is_active`         | boolean                  | No       |                                                                      |
| `_id`               | string                   | No       | pattern: ^[a-fA-F0-9]{24}$.                                          |
| `last_updated_by`   | string or object or null | No       | ObjectId on writes; populated document on reads. May be null.        |
| `created_at`        | string (date-time)       | No       |                                                                      |
| `updated_at`        | string (date-time)       | No       |                                                                      |
| `client`            | string or object or null | No       | ObjectId on writes; populated document on reads. May be null.        |
| `location`          | string or object or null | No       | ObjectId on writes; populated document on reads. May be null.        |

<a id="schema-invoicecreate"></a>

### InvoiceCreate

| Field            | Type                          | Required | Details                |
| ---------------- | ----------------------------- | -------- | ----------------------- |
| `worker`         | [ObjectId](#schema-objectid) | Yes      |                         |
| `amount`         | number                        | Yes      | exclusiveMinimum: 0.    |
| `payment_method` | string                        | Yes      | minLength: 1.           |
| `transaction_id` | string                        | No       |                         |
| `notes`          | string                        | No       |                         |

<a id="schema-invoice"></a>

### Invoice

| Field             | Type                      | Required | Details                                                       |
| ----------------- | ------------------------- | -------- | -------------------------------------------------------------- |
| `_id`             | string                    | No       | pattern: ^[a-fA-F0-9]{24}$.                                    |
| `manager`         | string or object          | No       | ObjectId on writes; populated document on reads.               |
| `worker`          | string or object          | No       | ObjectId on writes; populated document on reads.               |
| `amount`          | number                    | No       | exclusiveMinimum: 0.                                            |
| `payment_method`  | string                    | No       | minLength: 1.                                                   |
| `transaction_id`  | string or null            | No       |                                                                 |
| `notes`           | string or null            | No       |                                                                 |
| `created_at`      | string (date-time)        | No       |                                                                 |
| `updated_at`      | string (date-time)        | No       |                                                                 |

<a id="schema-login"></a>

### Login

| Field      | Type              | Required | Details                                                                                                                                      |
| ---------- | ----------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `email`    | string            | Yes      |                                                                                                                                              |
| `password` | string (password) | Yes      |                                                                                                                                              |
| `role`     | string            | No       | Optional service-level role selection; not validated by the login Zod schema. Allowed: "client", "worker", "manager", "admin", "superAdmin". |
| `playerId` | string            | No       | Optional push device ID.                                                                                                                     |
| `platform` | string            | No       | Allowed: "android", "ios", "web". Default: "android".                                                                                        |

<a id="schema-tokens"></a>

### Tokens

| Field          | Type   | Required | Details |
| -------------- | ------ | -------- | ------- |
| `accessToken`  | string | Yes      |         |
| `refreshToken` | string | No       |         |
| `role`         | string | No       |         |

<a id="schema-emailrequest"></a>

### EmailRequest

| Field   | Type   | Required | Details |
| ------- | ------ | -------- | ------- |
| `email` | string | Yes      |         |

<a id="schema-changepassword"></a>

### ChangePassword

| Field                | Type              | Required | Details |
| -------------------- | ----------------- | -------- | ------- |
| `oldPassword`        | string (password) | Yes      |         |
| `newPassword`        | string (password) | Yes      |         |
| `confirmNewPassword` | string (password) | Yes      |         |

<a id="schema-resetpassword"></a>

### ResetPassword

| Field             | Type              | Required | Details |
| ----------------- | ----------------- | -------- | ------- |
| `email`           | string            | Yes      |         |
| `password`        | string (password) | Yes      |         |
| `confirmPassword` | string (password) | Yes      |         |

<a id="schema-verifyresetotp"></a>

### VerifyResetOtp

| Field       | Type   | Required | Details |
| ----------- | ------ | -------- | ------- |
| `email`     | string | Yes      |         |
| `resetCode` | number | Yes      |         |

<a id="schema-notification"></a>

### Notification

| Field           | Type               | Required | Details                     |
| --------------- | ------------------ | -------- | --------------------------- |
| `_id`           | string             | No       | pattern: ^[a-fA-F0-9]{24}$. |
| `receiver`      | string             | No       |                             |
| `type`          | string             | No       |                             |
| `title`         | string             | No       |                             |
| `message`       | string             | No       |                             |
| `data`          | object             | No       |                             |
| `data.entity`   | string             | No       |                             |
| `data.action`   | string             | No       |                             |
| `data.entityId` | string             | No       | pattern: ^[a-fA-F0-9]{24}$. |
| `data.meta`     | object             | No       |                             |
| `isRead`        | boolean            | No       |                             |
| `isSeen`        | boolean            | No       |                             |
| `readAt`        | string (date-time) | No       |                             |
| `seenAt`        | string (date-time) | No       |                             |
| `createdAt`     | string (date-time) | No       |                             |
| `updatedAt`     | string (date-time) | No       |                             |

<a id="schema-updateresult"></a>

### UpdateResult

| Field           | Type    | Required | Details |
| --------------- | ------- | -------- | ------- |
| `acknowledged`  | boolean | No       |         |
| `matchedCount`  | integer | No       |         |
| `modifiedCount` | integer | No       |         |

<a id="schema-legalinfo"></a>

### LegalInfo

| Field                   | Type   | Required | Details                     |
| ----------------------- | ------ | -------- | --------------------------- |
| `venueOwner`            | string | No       | pattern: ^[a-fA-F0-9]{24}$. |
| `companyName`           | string | No       |                             |
| `businessType`          | string | No       |                             |
| `registeredAddress`     | string | No       |                             |
| `contactEmail`          | string | No       |                             |
| `contactPhone`          | string | No       |                             |
| `jurisdiction`          | string | No       |                             |
| `officialWebsite`       | string | No       |                             |
| `platformFeePercentage` | number | No       | Default: 20.                |
| `freeCancellationHour`  | number | No       | Default: 24.                |

<a id="schema-aboutusinput"></a>

### AboutUsInput

| Field         | Type   | Required | Details |
| ------------- | ------ | -------- | ------- |
| `description` | string | Yes      |         |

<a id="schema-aboutus"></a>

### AboutUs

| Field         | Type               | Required | Details                     |
| ------------- | ------------------ | -------- | --------------------------- |
| `description` | string             | No       |                             |
| `_id`         | string             | No       | pattern: ^[a-fA-F0-9]{24}$. |
| `createdAt`   | string (date-time) | No       |                             |
| `updatedAt`   | string (date-time) | No       |                             |

<a id="schema-privacypolicyinput"></a>

### PrivacyPolicyInput

| Field         | Type   | Required | Details |
| ------------- | ------ | -------- | ------- |
| `description` | string | Yes      |         |

<a id="schema-privacypolicy"></a>

### PrivacyPolicy

| Field         | Type               | Required | Details                     |
| ------------- | ------------------ | -------- | --------------------------- |
| `description` | string             | No       |                             |
| `_id`         | string             | No       | pattern: ^[a-fA-F0-9]{24}$. |
| `createdAt`   | string (date-time) | No       |                             |
| `updatedAt`   | string (date-time) | No       |                             |

<a id="schema-termsconditionsinput"></a>

### TermsConditionsInput

| Field         | Type   | Required | Details |
| ------------- | ------ | -------- | ------- |
| `description` | string | Yes      |         |

<a id="schema-termsconditions"></a>

### TermsConditions

| Field         | Type               | Required | Details                     |
| ------------- | ------------------ | -------- | --------------------------- |
| `description` | string             | No       |                             |
| `_id`         | string             | No       | pattern: ^[a-fA-F0-9]{24}$. |
| `createdAt`   | string (date-time) | No       |                             |
| `updatedAt`   | string (date-time) | No       |                             |

<a id="schema-partnerinput"></a>

### PartnerInput

| Field         | Type   | Required | Details |
| ------------- | ------ | -------- | ------- |
| `description` | string | Yes      |         |

<a id="schema-partner"></a>

### Partner

| Field         | Type               | Required | Details                     |
| ------------- | ------------------ | -------- | --------------------------- |
| `description` | string             | No       |                             |
| `_id`         | string             | No       | pattern: ^[a-fA-F0-9]{24}$. |
| `createdAt`   | string (date-time) | No       |                             |
| `updatedAt`   | string (date-time) | No       |                             |

<a id="schema-contactdetailsinput"></a>

### ContactDetailsInput

| Field          | Type   | Required | Details |
| -------------- | ------ | -------- | ------- |
| `email`        | string | Yes      |         |
| `phone_number` | string | Yes      |         |

<a id="schema-contactdetails"></a>

### ContactDetails

| Field          | Type               | Required | Details                     |
| -------------- | ------------------ | -------- | --------------------------- |
| `email`        | string             | No       |                             |
| `phone_number` | string             | No       |                             |
| `_id`          | string             | No       | pattern: ^[a-fA-F0-9]{24}$. |
| `createdAt`    | string (date-time) | No       |                             |
| `updatedAt`    | string (date-time) | No       |                             |

<a id="schema-faqinput"></a>

### FAQInput

| Field      | Type   | Required | Details |
| ---------- | ------ | -------- | ------- |
| `question` | string | Yes      |         |
| `answer`   | string | Yes      |         |

<a id="schema-faq"></a>

### FAQ

| Field       | Type               | Required | Details                     |
| ----------- | ------------------ | -------- | --------------------------- |
| `question`  | string             | No       |                             |
| `answer`    | string             | No       |                             |
| `_id`       | string             | No       | pattern: ^[a-fA-F0-9]{24}$. |
| `createdAt` | string (date-time) | No       |                             |
| `updatedAt` | string (date-time) | No       |                             |

<a id="schema-sliderinput"></a>

### SliderInput

| Field   | Type   | Required | Details |
| ------- | ------ | -------- | ------- |
| `title` | string | Yes      |         |
| `image` | string | Yes      |         |

<a id="schema-slider"></a>

### Slider

| Field       | Type               | Required | Details                     |
| ----------- | ------------------ | -------- | --------------------------- |
| `title`     | string             | No       |                             |
| `image`     | string             | No       |                             |
| `_id`       | string             | No       | pattern: ^[a-fA-F0-9]{24}$. |
| `createdAt` | string (date-time) | No       |                             |
| `updatedAt` | string (date-time) | No       |                             |

<a id="schema-admin"></a>

### Admin

| Field           | Type                         | Required | Details |
| --------------- | ---------------------------- | -------- | ------- |
| `_id`           | [ObjectId](#schema-objectid) | No       |         |
| `user`          | [ObjectId](#schema-objectid) | No       |         |
| `name`          | string                       | No       |         |
| `email`         | string (email)               | No       |         |
| `phone`         | string                       | No       |         |
| `profile_image` | string                       | No       |         |
| `address`       | string or null               | No       |         |
| `website`       | string or null               | No       |         |
| `isActive`      | boolean                      | No       |         |

<a id="schema-admincreate"></a>

### AdminCreate

Required by account creation, although the current Zod schema makes these fields optional. Passwords must match.

| Field             | Type              | Required | Details |
| ----------------- | ----------------- | -------- | ------- |
| `name`            | string            | Yes      |         |
| `email`           | string (email)    | Yes      |         |
| `password`        | string (password) | Yes      |         |
| `confirmPassword` | string (password) | Yes      |         |
| `address`         | string            | No       |         |
| `website`         | string            | No       |         |

## Updating this file

Source: `src/app/docs/openapi.ts`, `paths.ts`, and `schemas.ts`. Regenerate after updating Swagger contracts:

```sh
node scripts/export-api-markdown.cjs
```
