export type Location = "Simply Books" | "Prologue";

export const LOCATIONS: Location[] = ["Simply Books", "Prologue"];

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
  orderDate: string;
  lastModified: string;
}

export type OrderInput = Omit<Order, "id" | "orderDate" | "lastModified" | "customerName" | "customerPhone">;

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

export type Role = "staff" | "manager";

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  /** Venues this user's manager powers apply to. "all" = joint manager across both. */
  managerLocations: Location[] | "all";
}
