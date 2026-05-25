# Salary Audit — ระบบตรวจสอบคำสั่งข้าราชการ

ระบบตรวจสอบความถูกต้องของข้อมูลในคำสั่งข้าราชการ (HR Order Freshness Check) — ให้ข้อมูลในคำสั่งตรงกับข้อเท็จจริง ณ `effective_date` ของคำสั่งนั้นเสมอ

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript |
| CSS | Tailwind CSS v4 + shadcn/ui |
| Database | SQLite (dev) / TiDB Cloud (prod) |
| ORM | Prisma 7 + `@prisma/adapter-libsql` |
| Auth | Auth.js (NextAuth v5) — Credentials |
| Font | Noto Sans Thai |
| Tests | Node.js 20 built-in (`node:test`) + tsx |

## 🚀 Quick Start

```bash
# 1. Clone
git clone git@github.com:Arnutt-N/salary-audit.git
cd salary-audit

# 2. Install
npm install

# 3. Environment
cp .env.example .env
# Edit .env — set AUTH_SECRET (generate: openssl rand -base64 32)

# 4. Database
npx prisma db push
npx tsx prisma/seed.ts

# 5. Run
npm run dev
# → http://localhost:3000
```

## 🔑 Default Login

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `password` |

> Created by `prisma/seed.ts`. Change password after first login!

## 📁 Project Structure

```
app/
├── dashboard/           # แผงควบคุม (KPI + activity + stale)
├── employees/           # รายชื่อข้าราชการ
│   └── [id]/            # ข้อมูลบุคคล (timeline + change log)
├── batches/             # ชุดคำสั่ง (batch CRUD + approval)
│   └── [id]/            # รายละเอียด batch
├── reports/             # รายงาน
│   └── audit/           # Audit trail
├── orders/              # คำสั่ง (planned)
├── login/               # หน้า login
├── api/                 # API routes
lib/                     # Core logic
├── freshness.ts         # Freshness engine
├── prisma.ts            # Prisma client
├── auth.ts              # Auth.js config
└── date-utils.ts        # Thai date (พ.ศ.)
prisma/                  # Database
├── schema.prisma        # 10 tables
├── seed.ts              # Test data + admin user
└── prisma.config.ts     # Prisma 7 config
__tests__/               # Tests
├── fixtures/            # Test seed data
├── freshness.test.ts    # Freshness engine tests
└── api/                 # API route tests
```

## 📜 Available Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npx prisma db push   # Apply schema changes
npx tsx prisma/seed.ts         # Seed test data
npx tsx --test __tests__/*.test.ts  # Run tests
```

## ✅ CI/CD

CI runs on every push and pull request:

1. ✅ Install dependencies (`npm ci`)
2. ✅ Prisma generate + db push
3. ✅ Lint
4. ✅ Build (`npm run build`)
5. ✅ Seed test data
6. ✅ **Run tests** (`npx tsx --test`)
7. ✅ Type check

## 📖 Domain Context

See `hr-order-freshness-check-v2.md` for full spec of all 10 HR order scenarios (A-J), lifecycle states (draft → preview → active → cancelled → superseded → void), and freshness checking logic.

## 📄 License

Private — Arnutt-N
