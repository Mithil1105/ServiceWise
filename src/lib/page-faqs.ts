/**
 * Page-specific FAQs for marketing pages. Shown at the bottom of each page.
 */

export type FaqItem = { q: string; a: string };

export const PAGE_FAQS: Record<string, FaqItem[]> = {
  home: [
    { q: 'Does inquiry block vehicles?', a: 'Yes. Inquiry, tentative, confirmed, and ongoing all block the car for that time (with a gap). Completed and cancelled do not block.' },
    { q: 'Can it prevent double booking?', a: 'Yes. You only add cars that are still free when you click Add. The system rejects assignments that overlap with existing bookings.' },
    { q: 'Is it mobile friendly?', a: 'Yes. Responsive layout, collapsible sidebar on mobile, stacked cards, and touch-friendly controls.' },
  ],
  product: [
    { q: 'Is minimum KM configurable?', a: 'Yes. In Settings you set minimum km (e.g. 300 km/day). It applies to per-km and mixed rate bills.' },
    { q: 'Can we generate PDFs?', a: 'Yes. Customer bills and company bills can be generated as PDFs and downloaded.' },
    { q: 'Can we add calendar or reports later?', a: 'Yes. Calendar view and full reports are on the roadmap. The product is built to extend.' },
  ],
  features: [
    { q: 'Can it prevent double booking?', a: 'Yes. You only add cars that are still free when you click Add. The system rejects assignments that overlap with existing bookings.' },
    { q: 'How are transfers tracked?', a: 'When advance is cash or personal account, you record a deposit (move to company). Pending and done deposits show on the Financials page with date, cashier, and notes.' },
    { q: 'What happens when a vehicle is in downtime?', a: 'Downtime logs mark a car as unavailable for a date range. It won’t show as available for booking.' },
  ],
  roles: [
    { q: 'Do supervisors see billing?', a: 'No. Supervisors see Fleet, Drivers, Odometer, Services, Critical Queue, and Reports (read-only). No Bookings or Billing.' },
    { q: 'What can supervisors do?', a: 'Supervisors see only their assigned cars. They can update odometer, log service, and view critical alerts. They cannot create bookings, generate bills, or change settings.' },
  ],
  'how-it-works': [
    { q: 'Does inquiry block vehicles?', a: 'Yes. Inquiry, tentative, confirmed, and ongoing all block the car for that time (with a gap).' },
    { q: 'Can it prevent double booking?', a: 'Yes. You only add cars that are still free. The system rejects assignments that overlap with existing bookings.' },
  ],
  security: [
    { q: 'Is our data secure?', a: 'Yes. Data is stored in your own Supabase project. You control access, backups, and region.' },
    { q: 'Who can access the app?', a: 'Only users you create (Owner, Manager, Supervisor). Roles control what each can see and do.' },
  ],
  pricing: [
    { q: 'How is pricing determined?', a: 'Pricing depends on fleet size and which modules you need. We’ll give you a tailored quote after the demo.' },
    { q: 'What’s included?', a: 'Fleet, bookings, billing, advance & deposits, drivers, services, critical queue, dashboard, and roles. Optional: reports, calendar, incidents.' },
  ],
  contact: [
    { q: 'What does the demo cover?', a: 'We walk through fleet, bookings, billing, advance tracking, service alerts, and roles — tailored to your fleet size.' },
    { q: 'How long is the demo?', a: 'Typically 30–45 minutes. We show the flow with your scenarios and answer questions.' },
  ],
};
