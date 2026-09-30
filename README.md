# MRS Server

Production-grade NestJS API with MongoDB, JWT, bcrypt, rate limiting, sanitization, and structured logging.

## Setup
- Copy `.env.example` to `.env` and set strong secrets.
- Install: `npm install`
- Run dev: `npm run start:dev`
- Build: `npm run build` then `npm start`
- Docs: Swagger available at `/docs`.

## Docker
- `docker compose up --build`
- Provide `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PEPPER_SECRET` via environment.

## Modules
- Auth: register, login, refresh, logout.
- Users: basic profile endpoints.

## Security
- Helmet, CORS, Throttler, Mongo sanitize, validation whitelist, bcrypt with pepper.

## Super Admin Signup
- Endpoint: `POST /api/v1/auth/register`
- When no admin exists, the first successful registration becomes the Super Admin.
- Body parameters:
  - `name` (string, required)
  - `email` (string, required, valid email)
  - `password` (string, required, minimum 8 characters)
- Result:
  - Creates an Admin with role `super_admin`
  - Sets default `department` to `Administration`
  - Returns the admin without sensitive fields
- cURL example:
```
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "System Admin",
    "email": "admin@example.com",
    "password": "SecureP@ssw0rd"
  }'
```
