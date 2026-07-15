export type Location = "Simply Books" | "Prologue";

export const LOCATIONS: Location[] = ["Simply Books", "Prologue"];

/** One status change, recorded by the timeline control (V3 §5 audit trail). */
export interface StatusLogEntry {
  at: string; // ISO timestamp
  by: string; // user's name
  status: string; // raw Airtable status written
}

export interface Order {
  id: string;
  bookTitle: string;
  author: string;
  isbn: string;
  customerIds: string[];
  customerName?: string;
  customerPhone?: string;
  teamMember: string;
  paid: string;
  status: string;
  specialOrder: boolean;
  isPreorder: boolean;
  preorderPublicationDate: string | null;
  estimatedLeadTime: string | null;
  deliveryMethod: string;
  location: Location;
  notes: string;
  /** V3: supplier/publisher the order is (to be) placed with. */
  publisher: string;
  /** V3: retail price, if recorded. */
  price: number | null;
  /** V3: copies on this order line (default 1). */
  quantity: number;
  statusLog: StatusLogEntry[];
  orderDate: string;
  lastModified: string;
}

export type OrderInput = Omit<
  Order,
  "id" | "orderDate" | "lastModified" | "customerName" | "customerPhone"
>;

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  orderIds: string[];
}

export type CustomerInput = Omit<Customer, "id" | "orderIds">;

/** V3 §3: per-supplier settings (ordering cadence + shop account number). */
export interface Supplier {
  id: string;
  name: string;
  cadence: string; // free text: "Same day", "Tue & Thu", …
  accountNumber: string;
}

export type SupplierInput = Omit<Supplier, "id">;

export type Role = "staff" | "manager";

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  /** Venues this user's manager powers apply to. "all" = joint manager across both. */
  managerLocations: Location[] | "all";
  /** Permission strings (V3: `settings:manage`). Defaults derive from role. */
  permissions: string[];
}
