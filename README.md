# 🚗 TravelTrak Ops

A comprehensive fleet management and operations system built for travel and transportation companies. TravelTrak Ops provides end-to-end management of vehicles, bookings, drivers, services, and maintenance operations.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![React](https://img.shields.io/badge/React-18.3-blue)
![Supabase](https://img.shields.io/badge/Supabase-Backend-green)

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Database Setup](#-database-setup)
- [Edge Functions](#-edge-functions)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### 🎯 Core Functionality

- **Fleet Management**: Complete vehicle tracking, documentation, and status management
- **Booking System**: Calendar-based booking management with invoice generation
- **Driver Management**: Driver profiles, assignments, and activity tracking
- **Service & Maintenance**: Automated service scheduling, critical queue management, and maintenance history
- **Odometer Tracking**: Real-time odometer readings and mileage tracking
- **Incident Management**: Track and manage vehicle incidents and accidents
- **Downtime Reporting**: Monitor vehicle downtime and availability
- **Vehicle Health Score**: AI-powered health scoring based on service history and incidents
- **Reports & Analytics**: Comprehensive reporting dashboard with visualizations
- **User Management**: Role-based access control (Admin, Manager, Supervisor)

### 🔐 Security & Access Control

- **Role-Based Access Control (RBAC)**: Admin, Manager, and Supervisor roles
- **Row Level Security (RLS)**: Database-level security policies
- **JWT Authentication**: Secure token-based authentication
- **Protected Routes**: Route-level authorization

### 📊 Dashboard Features

- Real-time fleet statistics
- Critical service alerts
- Booking calendar view
- Vehicle health monitoring
- Supervisor activity tracking
- Customizable reports

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

### Backend
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Authentication
  - Row Level Security (RLS)
  - Edge Functions (Deno)
  - Storage

### Additional Libraries
- **jsPDF 3.0** - PDF generation for invoices
- **html2canvas 1.4** - Screenshot capture
- **QRCode.react 4.2** - QR code generation
- **Lucide React** - Icon library

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

```bash
# In Supabase SQL Editor
-- Run: supabase/migrations/set_admin_account.sql
```

Or manually:

```sql
-- Replace with your admin email
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'admin@patidartravels.com'
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

All database migrations are located in `supabase/migrations/`. Run them in order:

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
- `invoices` - Booking invoices
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
traveltrak-ops-main/
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
└── vite.config.ts          # Vite configuration
```

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

3. Configure environment variables in Vercel dashboard

#### Netlify

1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Deploy:
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

### Getting Help

- Check existing documentation files:
  - `DIAGNOSTIC_CHECK.md` - Diagnostic procedures
  - `TROUBLESHOOTING_401.md` - 401 error troubleshooting
  - `DEPLOY_EDGE_FUNCTION.md` - Edge function deployment guide
  - `ENV_VARIABLES_GUIDE.md` - Environment variables guide

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
