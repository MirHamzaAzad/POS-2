# 🏪 Galiyat Store POS System

A complete, offline-capable Point of Sale system for **Galiyat Store** — a utility/grocery store in Pakistan. Built with React, Node.js, TypeScript, and PostgreSQL.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm 9+

---

## 📁 Project Structure

```
C:\Galiyat Store POS\
├── backend\          ← Node.js + Express + Prisma API
│   ├── src\
│   │   ├── controllers\    ← Business logic
│   │   ├── routes\         ← API endpoints
│   │   ├── middlewares\    ← Auth & RBAC
│   │   └── lib\            ← Prisma client
│   └── prisma\
│       ├── schema.prisma   ← Database schema
│       └── seed.ts         ← Initial data
└── frontend\         ← React + Tailwind + Vite
    └── src\
        ├── pages\          ← Screen components
        ├── components\     ← Layout, shared UI
        ├── contexts\       ← Auth context
        ├── hooks\          ← Offline/sync hooks
        └── lib\            ← API client, IndexedDB
```

---

## ⚙️ Backend Setup

```powershell
# 1. Go to backend folder
cd "C:\Galiyat Store POS\backend"

# 2. Copy and edit your .env file
copy .env.example .env
# Edit .env → set your PostgreSQL DATABASE_URL

# 3. Install dependencies
npm install

# 4. Run database migrations
npx prisma migrate dev --name init

# 5. Generate Prisma client
npx prisma generate

# 6. Seed with initial data (users, products, categories)
ts-node prisma/seed.ts

# 7. Start development server
npm run dev
```

Backend will run at: **http://localhost:3001**

---

## 🎨 Frontend Setup

```powershell
# 1. Go to frontend folder
cd "C:\Galiyat Store POS\frontend"

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev
```

Frontend will run at: **http://localhost:5173**

---

## 🔐 Default Login Credentials

| Role | Username | Password | Access |
|------|----------|----------|--------|
| Admin | `admin` | `admin123` | Full system access |
| Manager | `manager` | `manager123` | Store management, reports |
| Cashier | `cashier1` | `cashier123` | POS counter only |

> ⚠️ **Change these passwords in production!**

---

## 📋 Features

### ✅ POS Front Counter
- Barcode scanner support (keyboard wedge)
- Fast product search
- Cart management (qty, discount, delete)
- Cash & card payments with change calculation
- Numpad UI for quick amount entry
- Receipt printing
- **Offline mode** — sales queued in IndexedDB, auto-synced when online

### ✅ Product Management
- Add/edit products with SKU, barcode, pricing
- Storage types: Dry 🌾 / Chilled ❄️ / Frozen 🧊
- Expiry date tracking
- Live profit margin calculator
- Category hierarchy

### ✅ Inventory
- Real-time stock balance tracking
- Receive Goods (GRN) from suppliers
- Manual stock adjustments (damage, count correction)
- Low stock alerts with reorder levels

### ✅ Sales History
- Full transaction history with date filters
- Invoice detail view
- Void sales with manager approval (restores stock)

### ✅ Reports
- Daily closing report (sales, cash, card, discounts)
- Top products by revenue
- Stock valuation report

### ✅ User Management
- Role-based access control (RBAC)
- Roles: Admin, Manager, Cashier, Inventory, Accountant
- Activate/deactivate users

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user |
| GET | `/api/products` | List products |
| GET | `/api/products/barcode/:code` | Barcode lookup |
| POST | `/api/sales` | Create sale |
| POST | `/api/sales/:id/void` | Void sale |
| GET | `/api/inventory/balances` | Stock levels |
| POST | `/api/inventory/receive` | Receive goods (GRN) |
| POST | `/api/inventory/adjust` | Stock adjustment |
| GET | `/api/reports/daily` | Daily sales report |
| GET | `/api/reports/stock` | Stock valuation |
| GET | `/api/sync/pull` | Pull product cache for offline |

---

## 🔌 Offline Mode

The POS terminal works without internet. When offline:
1. Sales are saved to **IndexedDB** locally
2. A sync badge shows pending count
3. On reconnection, pending sales auto-sync to the server
4. Products are cached locally for barcode lookup

---

## 🖨️ Hardware Support

- **Barcode Scanner** — Keyboard wedge (USB/Bluetooth), auto-detected
- **Receipt Printer** — Any browser-print compatible thermal printer (80mm)
- **Cash Drawer** — Triggered via receipt printer
- **UPS** — Offline mode handles power/internet interruptions

---

## 🗄️ Database

PostgreSQL with Prisma ORM. Key models:
- `Branch`, `User`, `Role`, `Permission`
- `Product`, `Category`, `Brand`, `Unit`, `ProductPrice`
- `Sale`, `SaleItem`, `Payment`, `Refund`
- `InventoryBalance`, `InventoryMovement`
- `GoodsReceipt`, `PurchaseOrder`, `Supplier`
- `SyncDevice`, `SyncQueue`

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS 3, Custom Design System |
| State | React Context, IndexedDB (idb) |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT + bcrypt |
| Validation | Zod |
| Offline | IndexedDB + Background Sync |

---

*Built for Galiyat Store — Main Bazar, Galiyat, Pakistan* 🇵🇰
