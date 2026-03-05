# Canopy Routes

Route planning tool for Sunset Services US, built by North 37 LLC.

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Zustand, React Query
- **API:** Express, TypeScript, PostgreSQL, JWT (RS256), Zod
- **Storage:** Cloudflare R2
- **Maps:** Google Maps Platform

## Project Structure

```
Canopy_Routes/
├── frontend/   # React SPA
├── api/        # Express REST API
└── db/         # Database migrations and seeds
```

## Running Locally

```bash
# Install dependencies
cd frontend && npm install
cd ../api && npm install

# Copy environment config
cp api/.env.example api/.env
# Fill in the values in api/.env

# Start the API (port 3000)
cd api && npm run dev

# Start the frontend (port 5173)
cd frontend && npm run dev
```
