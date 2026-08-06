# FPS Smart Management System

A Next.js web application to replace Excel-based management of Fair Price Shop (FPS) transactions from the Maharashtra ePOS system.

## Features

- **Dashboard** — KPIs, daily distribution charts, scheme split, auth method breakdown, pending customer alerts
- **Transactions** — Searchable/sortable/paginated table with scheme & auth filters
- **Customer Master** — Import from Excel (KGS_Master), CRUD operations, collection status tracking
- **Reports** — Daily summary, scheme-wise (PHH/AAY), pending list, Goshwara (monthly summary)
- **Sync Data** — Fetch & parse HTML from ePOS API using Cheerio, deduplication, sync history
- **Settings** — FPS configuration, data management, reset options

## Tech Stack

- **Framework**: Next.js 15 + TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand with localStorage persistence
- **Charts**: Recharts
- **HTML Parser**: Cheerio (server-side)
- **Excel Import**: SheetJS (xlsx)
- **PDF Export**: jsPDF + jspdf-autotable

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## Workflow

1. **Settings** → Configure your FPS ID and district code
2. **Customers** → Import your KGS_Master Excel file
3. **Sync Data** → Fetch transactions from ePOS API
4. **Dashboard** → View analytics and pending customers
5. **Reports** → Generate daily/scheme-wise/pending/goshwara reports

## API Integration

The app fetches data from:
```
POST https://epos.mahafood.gov.in/FPS_Trans_Details.jsp
Content-Type: application/x-www-form-urlencoded

dist_code=1512&fps_id=151209500212&month=7&year=2026
```

The HTML response is parsed server-side using Cheerio in `/api/fetch-transactions`.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── fetch-transactions/   # ePOS API proxy + HTML parser
│   │   ├── import-customers/     # Excel file parser
│   │   └── export-pdf/           # PDF generation helper
│   ├── dashboard/                # Dashboard with KPIs & charts
│   ├── transactions/             # Transaction list with filters
│   ├── customers/                # Customer master CRUD
│   ├── reports/                  # Report generation
│   ├── sync/                     # Data sync from ePOS
│   ├── settings/                 # App configuration
│   ├── layout.tsx                # Root layout with sidebar
│   ├── page.tsx                  # Redirect to dashboard
│   └── globals.css               # Tailwind + custom styles
├── components/
│   ├── ui/                       # KPICard, Badge, DataTable, TabGroup
│   └── layout/                   # Sidebar navigation
├── lib/
│   ├── parser.ts                 # Cheerio HTML parser
│   └── utils.ts                  # Helper functions
├── store/
│   └── useStore.ts               # Zustand global state
└── types/
    └── index.ts                  # TypeScript interfaces
```

## Deployment

Deploy to Vercel:

```bash
npm run build
# or connect GitHub repo to Vercel
```

## Data Persistence

Currently uses browser localStorage via Zustand persist middleware. For production, consider:
- Google Sheets via Apps Script
- Supabase / PostgreSQL
- MongoDB Atlas
