# 🚗 ServiceWise - Fleet Management & Operations System

A comprehensive fleet management and operations system built for travel and transportation companies. ServiceWise provides end-to-end management of vehicles, bookings, drivers, services, maintenance operations, billing, and financial tracking.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![React](https://img.shields.io/badge/React-18.3-blue)
![Supabase](https://img.shields.io/badge/Supabase-Backend-green)
![Vercel](https://img.shields.io/badge/Vercel-Deployment-black)

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Database Setup](#-database-setup)
- [Edge Functions](#-edge-functions)
- [Project Structure](#-project-structure)
- [Key Workflows](#-key-workflows)
- [User Roles & Permissions](#-user-roles--permissions)
- [Development](#-development)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

## 🎯 Overview

ServiceWise is a complete fleet management solution designed to streamline operations for travel and transportation companies. It handles everything from vehicle registration and booking management to automated billing, financial tracking, and maintenance scheduling.

### Key Capabilities

- **Complete Fleet Management**: Track vehicles, drivers, documents, and vehicle health
- **Booking System**: Calendar-based booking management with multiple rate types
- **Automated Billing**: Generate customer and company bills with PDF export
- **Financial Management**: Track advance payments, transfers, and company bills
- **Service & Maintenance**: Automated service scheduling and critical queue management
- **Real-time Tracking**: Odometer readings, incidents, and downtime monitoring
- **Comprehensive Reporting**: Analytics dashboard with visualizations
- **Role-Based Access**: Admin, Manager, and Supervisor roles with secure access control

### Target Users

- Travel & Transportation Companies
- Fleet Operators
- Taxi/Cab Services
- Car Rental Companies
- Corporate Transport Departments

## ✨ Features

### 🚗 Fleet Management

- **Vehicle Registration**: Complete vehicle information (brand, model, year, VIN, fuel type, seats)
- **Vehicle Status**: Active/Inactive status management
- **Vehicle Documents**: Store insurance, registration, permits, PUC certificates
- **Vehicle Notes**: Maintenance notes and special instructions
- **Vehicle Health Score**: AI-powered health scoring based on service history and incidents
- **Driver Assignments**: Assign drivers to specific vehicles
- **Odometer Tracking**: Record and track odometer readings with timestamps
- **Search & Filter**: Advanced search and filtering capabilities

### 📅 Booking Management

- **Create Bookings**: Customer details, trip dates, pickup/dropoff locations
- **Booking Status**: Draft → Confirmed → Ongoing → Completed → Cancelled
- **Calendar View**: Visual calendar interface for booking management
- **Vehicle Assignment**: Assign vehicles from fleet to bookings
- **Multiple Rate Types**:
  - Fixed Total Amount
  - Per Day Rate
  - Per KM Rate
  - Hybrid (Per Day + Per KM)
- **Advance Payment**: Capture advance payment details (amount, method, account type, collected by)
- **Booking Editing**: Modify booking details before completion
- **Booking Cancellation**: Cancel confirmed bookings
- **Booking History**: View complete booking history

### 💰 Billing & Invoicing System

#### Customer Bills
- **Auto-Generation**: Automatically generated after trip completion
- **KM Calculation**: Odometer-based or manual entry
- **Rate Calculation**: Automatic calculation with minimum KM thresholds
- **Multiple Vehicles**: Support for multiple vehicles per booking
- **Driver Allowance**: Track driver allowances separately
- **PDF Generation**: Generate professional PDF bills
- **Download & Share**: Download PDFs and share via WhatsApp
- **Bill Status**: Draft → Sent → Paid workflow
- **Payment Reminders**: Automated reminder system for unpaid bills

#### Company Bills
- **Internal Accounting**: Separate bills for company accounting
- **Advance Tracking**: Track advance payments and transfers
- **Transfer Requirements**: Monitor required transfers from personal/cash accounts
- **Driver Allowance Deductions**: Track driver allowances separately
- **PDF Generation**: Generate company bill PDFs
- **Bill Interlinking**: Link customer and company bills

#### Standalone Bills
- Create bills without bookings
- Manual vehicle and rate entry
- Full billing functionality

### 💳 Financial Management

- **Advance Payment Tracking**:
  - Payment method tracking (cash/online)
  - Account type tracking (company/personal/cash)
  - Collected by tracking
- **Transfer Management**:
  - Track transfers from personal accounts/cash to company accounts
  - Pending transfers queue
  - Transfer completion workflow
  - Transfer history with filtering
  - Overdue transfers tracking
- **Bank Account Management**: Manage company and personal bank accounts
- **Financial Reports**:
  - Pending transfers summary
  - Completed transfers summary
  - Company bills overview
  - Date range filtering
  - Manager-wise filtering

### 🔧 Service & Maintenance Management

- **Service Rules**: Define service templates (e.g., "Oil Change every 5000 km")
- **Vehicle-Specific Rules**: Assign rules to specific vehicles
- **Service Records**: Log services with complete details
- **Critical Queue**: Vehicles needing immediate service
- **Service Scheduling**: Automated reminders based on rules
- **Service History**: Complete maintenance history per vehicle
- **Service Cost Tracking**: Track service expenses

### 🚨 Incident Management

- **Incident Logging**: Record accidents, breakdowns, violations
- **Incident Details**: Date, location, description, severity
- **Vehicle Association**: Link incidents to vehicles
- **Resolution Tracking**: Track incident resolution status
- **Incident History**: View all incidents with filtering

### ⏸️ Downtime Tracking

- **Downtime Logging**: Track when vehicles are unavailable
- **Downtime Reasons**: Service, repair, accident, etc.
- **Downtime Reports**: Analyze vehicle availability
- **Impact Analysis**: See downtime impact on bookings

### 👨‍✈️ Driver Management

- **Driver Profiles**: Name, phone, license details
- **Driver Assignments**: Assign to vehicles/bookings
- **Driver Activity Tracking**: Monitor driver activities
- **License Expiry Tracking**: Track license expiration dates
- **Driver Performance Metrics**: Performance analytics

### 📊 Odometer Tracking

- **Odometer Entry**: Record readings with date/time
- **Reading History**: View all readings per vehicle
- **Mileage Calculation**: Automatic calculation between readings
- **Odometer-Based Billing**: Use readings for bill generation

### 📈 Reports & Analytics

- **Dashboard**: Real-time fleet statistics
- **Vehicle Reports**: Detailed vehicle reports
- **Booking Reports**: Booking analytics
- **Financial Reports**: Revenue, expenses, transfers
- **Service Reports**: Maintenance analytics
- **Custom Date Ranges**: Filter reports by date

### 👥 User Management & Security

- **Role-Based Access Control**:
  - **Admin**: Full system access
  - **Manager**: Operational access
  - **Supervisor**: Limited access
- **User Creation**: Create users with role assignment
- **Profile Management**: User profiles and settings
- **Activity Logging**: Track user actions

### ⚙️ Settings & Configuration

- **System Settings**: Configure application-wide settings
- **Service Rules**: Manage service templates
- **Bank Accounts**: Manage bank account details
- **Threshold Settings**: Configure minimum KM thresholds
- **Brand Management**: Manage vehicle brands

## 🛠 Tech Stack

### Frontend

- **React 18.3** - UI library
- **TypeScript 5.8** - Type safety
- **Vite 5.4** - Build tool and dev server
- **React Router 6.30** - Client-side routing
- **TanStack Query 5.83** - Data fetching and caching
- **Tailwind CSS 3.4** - Utility-first CSS framework
- **shadcn/ui** - High-quality component library
- **Recharts 2.15** - Data visualization
- **React Hook Form 7.61** - Form management
- **Zod 3.25** - Schema validation
- **date-fns 3.6** - Date manipulation
- **jsPDF 3.0** - PDF generation
- **html2canvas 1.4** - Screenshot capture
- **QRCode.react 4.2** - QR code generation
- **Lucide React** - Icon library

### Backend

- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Authentication (JWT-based)
  - Row Level Security (RLS)
  - Edge Functions (Deno)
  - Storage (for PDFs and documents)

### Additional Libraries

- **Google Maps API** - Location services
- **WhatsApp Web API** - Bill sharing

## 🏗 Architecture

### Frontend Architecture

- **Component-Based**: Modular React components
- **Custom Hooks**: Reusable data fetching and business logic
- **Type Safety**: Full TypeScript coverage
- **State Management**: TanStack Query for server state
- **Form Management**: React Hook Form with Zod validation
- **Routing**: React Router with protected routes

### Backend Architecture

- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth (JWT)
- **Security**: Row Level Security (RLS) policies
- **API**: Supabase Client for database operations
- **Storage**: Supabase Storage for files
- **Serverless**: Edge Functions for custom logic

### Security Architecture

- **Authentication**: JWT-based authentication via Supabase
- **Authorization**: Role-based access control (RBAC)
- **Database Security**: Row Level Security (RLS) policies
- **Route Protection**: Protected routes based on user roles
- **API Security**: Edge functions with JWT verification
- **Input Validation**: Zod schemas for all inputs

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.x or higher ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- **npm** 9.x or higher (comes with Node.js)
- **Git** for version control
- **Supabase Account** ([sign up here](https://supabase.com))

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Mithil1105/ServiceWise.git
cd ServiceWise
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

> **Note**: See [Environment Variables](#-environment-variables) section for detailed information.

### 4. Run Database Migrations

1. Open your Supabase Dashboard
2. Navigate to SQL Editor
3. Run all migration files from `supabase/migrations/` in chronological order

> **Important**: Run migrations in order based on their timestamp prefix.

### 5. Set Up Admin Account

Run the SQL script to create an admin account:

```sql
-- Replace with your admin email
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'admin@yourcompany.com'
ON CONFLICT DO NOTHING;
```

### 6. Deploy Edge Functions

See [Edge Functions](#-edge-functions) section for detailed deployment instructions.

### 7. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## 🔐 Environment Variables

### Frontend (.env)

Create a `.env` file in the root directory:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Edge Functions

Edge functions automatically receive these environment variables from Supabase:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

> **Note**: Do NOT add `SUPABASE_SERVICE_ROLE_KEY` to your frontend `.env` file. It's only available server-side.

### Getting Your Supabase Credentials

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`
   - **service_role key** → (for edge functions only, never expose to frontend)

## 🗄 Database Setup

### Running Migrations

All database migrations are located in `supabase/migrations/`. Run them in chronological order:

1. **20251228154117_6442342c-352b-4e53-92db-7df155ac3e9b.sql** - Core schema (profiles, roles, cars, services)
2. **20251228165518_69c1b17e-ebbe-46f3-b8fa-5034cf4ab3fa.sql** - Additional tables
3. Continue with remaining migrations in chronological order...

### Database Schema Overview

#### Core Tables
- `profiles` - User profiles
- `user_roles` - Role assignments (admin, manager, supervisor)
- `cars` - Vehicle information
- `drivers` - Driver profiles
- `bookings` - Booking records
- `customers` - Customer information

#### Billing Tables
- `bills` - Customer bills
- `company_bills` - Internal company bills
- `transfers` - Transfer tracking
- `bank_accounts` - Bank account management

#### Service & Maintenance
- `service_rules` - Service templates
- `car_service_rules` - Vehicle-specific service rules
- `service_records` - Service history
- `odometer_entries` - Odometer readings
- `incidents` - Incident records
- `downtime_logs` - Vehicle downtime tracking

#### Additional Tables
- `car_documents` - Vehicle documents
- `car_notes` - Vehicle notes
- `car_assignments` - Driver-vehicle assignments
- `supervisor_activity_log` - Supervisor activity tracking

### Row Level Security (RLS)

All tables have RLS policies enabled. Policies are defined in the migration files and ensure:
- Users can only access data they're authorized to view
- Role-based access control at the database level
- Secure data isolation

## ⚡ Edge Functions

### Available Functions

1. **create-user-v3** - User creation with role assignment
   - Location: `supabase/functions/create-user-v3/`
   - Purpose: Create new users and assign roles (admin/manager/supervisor)
   - Authentication: Requires admin role

2. **petty-expenses** - Petty expenses management
   - Location: `supabase/functions/petty-expenses/`
   - Purpose: Handle petty expense operations

### Deploying Edge Functions

#### Option 1: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy a function
supabase functions deploy create-user-v3
```

#### Option 2: Using Supabase Dashboard

1. Go to **Edge Functions** in your Supabase Dashboard
2. Click **Create a new function**
3. Name it (e.g., `create-user-v3`)
4. Copy the code from `supabase/functions/create-user-v3/index.ts`
5. Click **Deploy**

> **Note**: See `DEPLOY_EDGE_FUNCTION.md` for detailed deployment instructions.

### Function Configuration

Edge function settings are configured in `supabase/config.toml`:

```toml
[functions.create-user-v3]
verify_jwt = false  # Manual JWT verification in function
```

## 📁 Project Structure

```
servicewise/
├── public/                 # Static assets
│   ├── favicon.ico
│   └── robots.txt
├── src/
│   ├── assets/            # Images and media
│   ├── components/         # React components
│   │   ├── bookings/      # Booking-related components
│   │   ├── dashboard/      # Dashboard components
│   │   ├── fleet/          # Fleet management components
│   │   ├── layout/         # Layout components
│   │   └── ui/             # shadcn/ui components
│   ├── hooks/              # Custom React hooks
│   ├── integrations/       # Third-party integrations
│   │   └── supabase/       # Supabase client and types
│   ├── lib/                # Utility functions
│   ├── pages/              # Page components
│   ├── types/              # TypeScript type definitions
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── supabase/
│   ├── functions/          # Edge functions
│   │   ├── create-user-v3/
│   │   └── petty-expenses/
│   ├── migrations/         # Database migrations
│   └── config.toml         # Supabase configuration
├── .env                    # Environment variables (create this)
├── .gitignore
├── package.json
├── tailwind.config.ts      # Tailwind configuration
├── tsconfig.json           # TypeScript configuration
├── vercel.json             # Vercel deployment configuration
└── vite.config.ts          # Vite configuration
```

## 🔄 Key Workflows

### Booking to Bill Flow

1. **Create Booking** → Enter customer details, trip dates, vehicle selection
2. **Assign Vehicle** → Select vehicle from fleet
3. **Set Rates** → Configure rate type and amounts
4. **Capture Advance** → Record advance payment details
5. **Complete Trip** → Mark booking as completed
6. **Generate Bill** → Auto-generate customer bill with KM calculation
7. **Generate Company Bill** → Auto-generate internal bill
8. **Track Transfers** → Monitor advance payment transfers
9. **Complete Transfers** → Mark transfers as completed

### Service Management Flow

1. **Define Service Rules** → Create service templates
2. **Assign to Vehicles** → Link rules to specific vehicles
3. **Track Odometer** → Record odometer readings
4. **Auto-Detect Service Needs** → System flags vehicles needing service
5. **Log Service** → Record service completion
6. **Update Health Score** → Recalculate vehicle health

### Transfer Management Flow

1. **Advance Payment Received** → If cash or personal account → Transfer required
2. **View Pending Transfers** → Financials page → Pending Transfers tab
3. **Complete Transfer** → Enter transfer date, cashier name, notes
4. **Transfer History** → View completed transfers with filtering

## 👥 User Roles & Permissions

### Admin Role
- ✅ Full system access
- ✅ User management (create/edit/delete users)
- ✅ System settings configuration
- ✅ All operational features
- ✅ Financial management
- ✅ Reports and analytics

### Manager Role
- ✅ Operational access
- ✅ Booking management
- ✅ Bill generation
- ✅ Fleet management
- ✅ Service management
- ✅ Driver management
- ✅ Financial tracking
- ⚠️ Limited settings access

### Supervisor Role
- ✅ Limited operational access
- ✅ View bookings
- ✅ View fleet status
- ✅ Log services
- ✅ Record odometer readings
- ✅ View reports (read-only)
- ❌ No billing access
- ❌ No user management

## 💻 Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Build for development
npm run build:dev

# Preview production build
npm run preview

# Run linter
npm run lint
```

### Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write code following TypeScript best practices
   - Use ESLint for code quality
   - Follow the existing code style

3. **Test your changes**
   - Test in development mode
   - Verify database changes if applicable
   - Test edge functions if modified

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Style

- Use TypeScript for all new code
- Follow React best practices (hooks, functional components)
- Use ESLint configuration provided
- Follow naming conventions:
  - Components: PascalCase (`UserManagement.tsx`)
  - Hooks: camelCase with `use` prefix (`useBookings.ts`)
  - Utilities: camelCase (`date.ts`, `utils.ts`)

## 🚢 Deployment

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Deployment Options

#### Vercel (Recommended)

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Configure environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

4. The `vercel.json` file is already configured for SPA routing

#### Netlify

1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Create `netlify.toml`:
   ```toml
   [build]
     command = "npm run build"
     publish = "dist"
   
   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

3. Deploy:
   ```bash
   netlify deploy --prod
   ```

#### Other Platforms

The built application is a static site and can be deployed to any static hosting service:
- GitHub Pages
- AWS S3 + CloudFront
- Azure Static Web Apps
- Google Cloud Storage

### Environment Variables in Production

Make sure to set your environment variables in your hosting platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 🔧 Troubleshooting

### Common Issues

#### 1. 401 Unauthorized Errors

If you're experiencing 401 errors when calling edge functions:

1. **Check your authentication**: Ensure you're logged in
2. **Verify admin role**: Run the diagnostic SQL query (see `DIAGNOSTIC_CHECK.md`)
3. **Check token**: Verify your session token is valid
4. **Review edge function logs**: Check Supabase Dashboard → Edge Functions → Logs

See `TROUBLESHOOTING_401.md` for detailed troubleshooting steps.

#### 2. Database Connection Issues

- Verify your `VITE_SUPABASE_URL` is correct
- Check your `VITE_SUPABASE_ANON_KEY` is valid
- Ensure your Supabase project is active

#### 3. Migration Errors

- Run migrations in chronological order
- Check for conflicting migrations
- Verify all dependencies are met

#### 4. Edge Function Deployment Issues

- Verify function code syntax
- Check `config.toml` settings
- Review function logs in Supabase Dashboard

#### 5. Routing Issues (404 Errors)

- Ensure `vercel.json` is present in root directory
- Verify rewrites configuration is correct
- Check deployment platform routing settings

### Getting Help

- Check existing documentation files:
  - `DIAGNOSTIC_CHECK.md` - Diagnostic procedures
  - `TROUBLESHOOTING_401.md` - 401 error troubleshooting
  - `DEPLOY_EDGE_FUNCTION.md` - Edge function deployment guide
  - `ENV_VARIABLES_GUIDE.md` - Environment variables guide
  - `REFERENCE_ERROR_FIXES.md` - Common error fixes

- Review Supabase documentation: [supabase.com/docs](https://supabase.com/docs)

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'feat: add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Contribution Guidelines

- Write clear commit messages
- Follow the existing code style
- Add tests if applicable
- Update documentation as needed
- Ensure all checks pass before submitting PR

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Supabase](https://supabase.com) for the amazing backend platform
- [shadcn/ui](https://ui.shadcn.com) for the beautiful component library
- [Vite](https://vitejs.dev) for the fast build tool
- All contributors and users of this project

## 📞 Support

For support, please:
1. Check the troubleshooting section above
2. Review the documentation files in the repository
3. Open an issue on GitHub with detailed information

---

**Built with ❤️ for efficient fleet management**
