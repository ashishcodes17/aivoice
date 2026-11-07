import { BanknoteIcon, HeartPulseIcon, HomeIcon, PackageIcon, PlaneIcon, ShoppingBagIcon, type LucideIcon } from "lucide-react";

export type Solution = {
  slug: string;
  name: string;
  icon: LucideIcon;
  summary: string; // one line, used on cards and menus
  title: [string, string, string]; // before, italic accent, after
  intro: string;
  useCases: { title: string; body: string }[];
  call: { language: string; agent: string; lines: { who: "agent" | "caller"; text: string }[]; outcome: string };
  captured: string[]; // what lands in the dashboard after each call
  note?: string; // a plain-spoken limit worth stating
};

// Sample calls are illustrative scripts, not customer recordings.
export const solutions: Solution[] = [
  {
    slug: "financial-services",
    name: "Financial services",
    icon: BanknoteIcon,
    summary: "EMI reminders, lead qualification and KYC follow-ups.",
    title: ["Collections and follow‑ups that ", "sound", " human."],
    intro:
      "Call thousands of customers about due dates, pending documents or new offers, in the language they use at home. Your agent keeps the tone polite, records what the customer commits to, and hands over the cases that need a person.",
    useCases: [
      { title: "EMI and payment reminders", body: "Remind customers before the due date, ask how they plan to pay, and note a promised date." },
      { title: "Loan and card lead qualification", body: "Call new enquiries within minutes, ask your screening questions, and pass on the interested ones." },
      { title: "KYC and document follow-ups", body: "Tell customers exactly which document is missing and when to send it." },
      { title: "Inbound balance and status queries", body: "Answer the repetitive calls so your team handles the exceptions." },
    ],
    call: {
      language: "Hindi",
      agent: "Reena · Mitra Finance",
      lines: [
        { who: "agent", text: "Namaste! Main Reena bol rahi hoon, Mitra Finance se. Aapki EMI ki date paas aa rahi hai." },
        { who: "caller", text: "Haan, salary late hai, 7 tareekh ko payment ho jayega." },
        { who: "agent", text: "Theek hai, main 7 tareekh note kar leti hoon. UPI se karenge ya app se?" },
      ],
      outcome: "Customer promised to pay on the 7th by UPI",
    },
    captured: ["Promise-to-pay date and mode", "Customer's reason for delay", "Calls that need a human callback", "Full transcript of every call"],
    note: "Collections calls must follow RBI and your lender's rules on calling hours and conduct. Set those in the agent's prompt and your campaign schedule.",
  },
  {
    slug: "healthcare",
    name: "Healthcare",
    icon: HeartPulseIcon,
    summary: "Appointment booking, reminders and follow-up calls.",
    title: ["Fewer missed appointments, ", "calmer", " front desks."],
    intro:
      "Let patients book, reschedule and confirm by phone at any hour, in their own language. Your agent handles the routine calls so reception can focus on the people standing in front of them.",
    useCases: [
      { title: "Appointment booking", body: "Collect the patient's name, preferred doctor and time, then confirm the slot." },
      { title: "Reminders and no-show recovery", body: "Call before the visit, and call back patients who missed it to rebook." },
      { title: "Post-visit follow-ups", body: "Ask how the patient is doing and flag anyone who reports a problem." },
      { title: "Clinic information", body: "Timings, location, fees and which documents to bring." },
    ],
    call: {
      language: "Hindi",
      agent: "Priya · Sunrise Dental",
      lines: [
        { who: "agent", text: "Namaste! Sunrise Dental mein aapka swagat hai. Main aapki kya madad kar sakti hoon?" },
        { who: "caller", text: "Mujhe kal shaam ka appointment chahiye." },
        { who: "agent", text: "Kal shaam 5 baje ka slot khaali hai. Kya main book kar doon?" },
      ],
      outcome: "Appointment requested for tomorrow, 5 pm",
    },
    captured: ["Patient name and contact number", "Requested doctor, date and time", "Patients who reported a problem", "Full transcript of every call"],
    note: "The agent books and informs; it does not give medical advice. Tell it to hand any symptom or emergency straight to staff.",
  },
  {
    slug: "e-commerce",
    name: "E-commerce",
    icon: ShoppingBagIcon,
    summary: "Order confirmation, COD verification and support calls.",
    title: ["Confirm orders and cut ", "returns", " before they ship."],
    intro:
      "Call to verify cash-on-delivery orders, confirm addresses and answer where-is-my-order questions. A short call in the customer's language catches wrong addresses and changed minds before the parcel leaves.",
    useCases: [
      { title: "COD order verification", body: "Confirm the order, the address and that the customer will accept delivery." },
      { title: "Address fixes", body: "Catch incomplete or wrong addresses and capture the corrected one." },
      { title: "Order status and returns", body: "Answer tracking questions and start a return request." },
      { title: "Cart and payment recovery", body: "Call shoppers who stopped at payment and ask if they need help." },
    ],
    call: {
      language: "Hinglish",
      agent: "Riya · Kalaa Store",
      lines: [
        { who: "agent", text: "Hello, main Riya, Kalaa Store se. Aapne ek kurta set order kiya hai, kya main address confirm kar loon?" },
        { who: "caller", text: "Haan, par flat number 402 hai, 204 nahi." },
        { who: "agent", text: "Samajh gayi, flat 402 update kar diya. Delivery kal tak ho jayegi." },
      ],
      outcome: "Address corrected to flat 402, order confirmed",
    },
    captured: ["Confirmed or cancelled orders", "Corrected delivery addresses", "Return and complaint requests", "Full transcript of every call"],
  },
  {
    slug: "logistics",
    name: "Logistics",
    icon: PackageIcon,
    summary: "Delivery scheduling, driver check-ins and failed-delivery recovery.",
    title: ["Deliveries that land on the ", "first", " attempt."],
    intro:
      "Call recipients to confirm they are home, collect a landmark, or reschedule, and check in with drivers without tying up your dispatch team. Every call ends with a clear status your operations team can act on.",
    useCases: [
      { title: "Delivery scheduling", body: "Agree a time slot with the recipient before the driver sets out." },
      { title: "Failed-delivery recovery", body: "Call after a missed attempt, find out why, and rebook." },
      { title: "Address and landmark capture", body: "Ask for a landmark or a better pin so the driver finds the door." },
      { title: "Driver check-ins", body: "Ask drivers for status and flag the ones reporting a delay." },
    ],
    call: {
      language: "Hindi",
      agent: "Arjun · QuickMove",
      lines: [
        { who: "agent", text: "Namaste, QuickMove se bol raha hoon. Aapka parcel aaj shaam tak aayega, kya aap ghar par honge?" },
        { who: "caller", text: "Shaam ko nahi, kal subah 10 baje ke baad theek rahega." },
        { who: "agent", text: "Theek hai, kal subah 10 ke baad ka slot note kar liya." },
      ],
      outcome: "Rescheduled to tomorrow after 10 am",
    },
    captured: ["Agreed delivery slot", "Reason for a failed attempt", "Landmark or corrected address", "Full transcript of every call"],
  },
  {
    slug: "real-estate",
    name: "Real estate",
    icon: HomeIcon,
    summary: "Lead qualification and site-visit scheduling.",
    title: ["Reach every property enquiry in ", "minutes", ", not days."],
    intro:
      "Portal and ad leads go cold quickly. Call each one right away, ask about budget, location and timeline, and book site visits for the serious buyers so your sales team spends time on people ready to see a property.",
    useCases: [
      { title: "Instant lead calls", body: "Call new enquiries within minutes, in their language." },
      { title: "Budget and requirement screening", body: "Ask budget, location, configuration and timeline, and score the lead." },
      { title: "Site-visit booking", body: "Offer visit slots and confirm one with the buyer." },
      { title: "Visit reminders and follow-ups", body: "Remind before the visit and call after to ask what they thought." },
    ],
    call: {
      language: "English",
      agent: "Neha · Skyline Homes",
      lines: [
        { who: "agent", text: "Hi, this is Neha from Skyline Homes. You enquired about a 2 BHK in Wakad. Do you have a minute?" },
        { who: "caller", text: "Yes, budget is around 90 lakhs, looking to buy in three months." },
        { who: "agent", text: "That works. Would Saturday at 11 suit you for a site visit?" },
      ],
      outcome: "Qualified lead, site visit booked Saturday 11 am",
    },
    captured: ["Budget, location and timeline", "Interest level for each lead", "Booked site-visit slot", "Full transcript of every call"],
  },
  {
    slug: "travel-hospitality",
    name: "Travel & hospitality",
    icon: PlaneIcon,
    summary: "Reservations, booking confirmations and guest support.",
    title: ["Answer every guest call, ", "day", " or night."],
    intro:
      "Take table and room enquiries, confirm bookings, and answer common questions when your staff is busy or the desk is closed. Guests get an immediate answer in their own language, and you never lose a booking to a missed call.",
    useCases: [
      { title: "Table and room reservations", body: "Collect date, party size and name, and confirm the booking." },
      { title: "Booking confirmations and changes", body: "Confirm upcoming stays and handle date changes." },
      { title: "Guest questions", body: "Check-in times, directions, menus, amenities and policies." },
      { title: "After-hours coverage", body: "Keep answering when the front desk is closed." },
    ],
    call: {
      language: "English",
      agent: "Maya · Saffron Table",
      lines: [
        { who: "agent", text: "Thank you for calling Saffron Table. How can I help you today?" },
        { who: "caller", text: "A table for four tomorrow at 8 pm, please." },
        { who: "agent", text: "I have a table for four at 8 pm tomorrow. May I have a name for the booking?" },
      ],
      outcome: "Table for 4 booked, tomorrow 8 pm",
    },
    captured: ["Booking date, time and party size", "Guest name and contact number", "Special requests", "Full transcript of every call"],
  },
];

export const findSolution = (slug: string) => solutions.find((s) => s.slug === slug);
