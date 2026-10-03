export const departments: Record<string, string[]> = {
  Kitchen: [
    "Commis Chef",
    "Chef de Partie",
    "Sous Chef",
    "Executive Chef",
    "Cook",
    "Kitchen Helper",
  ],
  "Food & Beverage Service": [
    "F&B Associate",
    "Waiter",
    "Steward",
    "Bartender",
    "F&B Supervisor",
    "Restaurant Manager",
  ],
  "Front Office": [
    "Front Desk Associate",
    "Receptionist",
    "Guest Relations Executive",
    "Front Office Manager",
  ],
  Housekeeping: [
    "Housekeeping Associate",
    "Room Attendant",
    "Housekeeping Supervisor",
    "Executive Housekeeper",
  ],
  Maintenance: [
    "Maintenance Technician",
    "Electrician",
    "Engineering Supervisor",
  ],
  Management: [
    "Hotel Manager",
    "Resort Manager",
    "Operations Manager",
    "Catering Manager",
  ],
};
export const propertyTypes = [
  "Hotel",
  "Restaurant",
  "Resort",
  "Cafe",
  "Catering",
  "Serviced accommodation",
  "Other hospitality property",
];
export const cities = [
  "Mumbai",
  "Delhi",
  "Bengaluru",
  "Goa",
  "Pune",
  "Hyderabad",
  "Chennai",
  "Jaipur",
  "Kolkata",
  "Udaipur",
  "Kochi",
  "Dehradun",
  "Ahmedabad",
  "Gurugram",
];
export const languages = [
  "Hindi",
  "English",
  "Marathi",
  "Kannada",
  "Tamil",
  "Telugu",
  "Malayalam",
  "Bengali",
  "Gujarati",
  "Punjabi",
  "Konkani",
];
export const skillsByDepartment: Record<string, string[]> = {
  Kitchen: [
    "Indian cuisine",
    "Continental cuisine",
    "Bakery & pastry",
    "Food safety",
    "Mise en place",
    "Inventory management",
    "Tandoor",
    "Chinese cuisine",
  ],
  "Food & Beverage Service": [
    "Guest service",
    "POS systems",
    "Table service",
    "Bar operations",
    "Wine knowledge",
    "Coffee brewing",
    "Banquet service",
  ],
  "Front Office": [
    "Guest check-in",
    "PMS software",
    "Reservations",
    "Guest relations",
    "Cash handling",
  ],
  Housekeeping: [
    "Room cleaning",
    "Laundry operations",
    "Chemical handling",
    "Guest service",
    "Linen management",
  ],
  Maintenance: [
    "Electrical repairs",
    "Plumbing",
    "HVAC",
    "Preventive maintenance",
  ],
  Management: [
    "Team leadership",
    "Operations",
    "Budgeting",
    "Staff training",
    "Guest relations",
  ],
};
export const salary = (value: number) =>
  `₹${new Intl.NumberFormat("en-IN").format(value)}`;
export const dateLabel = (value: string) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not specified";
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
export const uuid = () => crypto.randomUUID();
