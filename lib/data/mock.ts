import type { Customer, CustomerInput, Order, OrderInput, Supplier, SupplierInput } from "@/lib/types";
import type { DataSource } from "./source";

// In-memory store used for development and testing so the live Airtable base
// is never touched during the build (spec §2a.3). Seeded with realistic data;
// resets on server restart.

const now = Date.now();
const daysAgo = (d: number, h = 0) => new Date(now - d * 864e5 - h * 36e5).toISOString();

const seedCustomers = (): Customer[] => [
  { id: "cusA1", name: "Margaret Hale", email: "m.hale@example.com", phone: "07700 900101", address: "14 Milton St, Bramhall", notes: "", orderIds: [] },
  { id: "cusA2", name: "John Thornton", email: "jthornton@example.com", phone: "07700 900202", address: "", notes: "Prefers a call, not text", orderIds: [] },
  { id: "cusA3", name: "Sara Ahmed", email: "sara.a@example.com", phone: "07700 900303", address: "2 Weir Mill Yard, Stockport", notes: "", orderIds: [] },
  { id: "cusA4", name: "David Okafor", email: "d.okafor@example.com", phone: "07700 900404", address: "", notes: "", orderIds: [] },
  { id: "cusA5", name: "Margaret Hale", email: "mhale.other@example.com", phone: "07700 900505", address: "9 Green Ln, Cheadle", notes: "NOT the Milton St Margaret", orderIds: [] },
  { id: "cusA6", name: "Priya Nair", email: "priya.n@example.com", phone: "07700 900606", address: "", notes: "", orderIds: [] },
];

const seedSuppliers = (): Supplier[] => [
  { id: "supA1", name: "Gardners", cadence: "Same day", accountNumber: "GAR-30412" },
  { id: "supA2", name: "Penguin Random House", cadence: "Tue & Thu", accountNumber: "PRH-88210" },
  { id: "supA3", name: "Faber Factory", cadence: "Weekly (Fri)", accountNumber: "FAB-1174" },
];

type OrderSeed = Omit<Order, "publisher" | "price" | "quantity" | "statusLog"> &
  Partial<Pick<Order, "publisher" | "price" | "quantity" | "statusLog">>;

const withV3 = (o: OrderSeed): Order => ({
  publisher: "",
  price: null,
  quantity: 1,
  statusLog: [],
  ...o,
});

const seedOrders = (): Order[] => ([
  { id: "ordA1", bookTitle: "Orbital", author: "Samantha Harvey", isbn: "9780224099059", customerIds: ["cusA1"], teamMember: "Ben", paid: "Paid", status: "Not Ordered", specialOrder: true, isPreorder: false, preorderPublicationDate: null, estimatedLeadTime: null, deliveryMethod: "Collection", location: "Simply Books", notes: "", orderDate: daysAgo(0, 2), lastModified: daysAgo(0, 2) },
  { id: "ordA2", bookTitle: "The Bee Sting", author: "Paul Murray", isbn: "9780241353950", customerIds: ["cusA2"], teamMember: "Karen", paid: "Not Paid", status: "Ordered", specialOrder: true, isPreorder: false, preorderPublicationDate: null, estimatedLeadTime: daysAgo(-3), deliveryMethod: "Collection", location: "Simply Books", notes: "", orderDate: daysAgo(1), lastModified: daysAgo(1) },
  { id: "ordA3", bookTitle: "Intermezzo", author: "Sally Rooney", isbn: "9780571365463", customerIds: ["cusA3"], teamMember: "Ellie", paid: "Paid Online", status: "Not Ordered", specialOrder: false, isPreorder: true, preorderPublicationDate: daysAgo(-30).slice(0, 10), estimatedLeadTime: null, deliveryMethod: "Delivery", location: "Prologue", notes: "Wants it signed if possible", orderDate: daysAgo(0, 5), lastModified: daysAgo(0, 4) },
  { id: "ordA4", bookTitle: "A Little Life", author: "Hanya Yanagihara", isbn: "9781447294832", customerIds: ["cusA4"], teamMember: "Matt", paid: "Paid", status: "Collected", specialOrder: true, isPreorder: false, preorderPublicationDate: null, estimatedLeadTime: null, deliveryMethod: "Collection", location: "Simply Books", notes: "", orderDate: daysAgo(6), lastModified: daysAgo(2) },
  { id: "ordA5", bookTitle: "Butter", author: "Asako Yuzuki", isbn: "9780008511685", customerIds: ["cusA3"], teamMember: "Anna", paid: "Not Paid", status: "Can't get", specialOrder: true, isPreorder: false, preorderPublicationDate: null, estimatedLeadTime: null, deliveryMethod: "Collection", location: "Prologue", notes: "Reprint due — check next month", orderDate: daysAgo(9), lastModified: daysAgo(3) },
  { id: "ordA6", bookTitle: "The Safekeep", author: "Yael van der Wouden", isbn: "9780241652305", customerIds: ["cusA6"], teamMember: "Ben", paid: "Paid", status: "Special Order", specialOrder: true, isPreorder: false, preorderPublicationDate: null, estimatedLeadTime: null, deliveryMethod: "Drop-Off", location: "Prologue", notes: "", orderDate: daysAgo(0, 1), lastModified: daysAgo(0, 1) },
  { id: "ordA7", bookTitle: "James", author: "Percival Everett", isbn: "9781035031238", customerIds: ["cusA1"], teamMember: "Lynsey", paid: "Ordered", status: "Ready to Ship", specialOrder: false, isPreorder: false, preorderPublicationDate: null, estimatedLeadTime: null, deliveryMethod: "Delivery", location: "Simply Books", notes: "", orderDate: daysAgo(4), lastModified: daysAgo(0, 6) },
  { id: "ordA8", bookTitle: "Wild Dark Shore", author: "Charlotte McConaghy", isbn: "9781399726181", customerIds: ["cusA5"], teamMember: "Holly", paid: "Not Paid", status: "Not Ordered", specialOrder: true, isPreorder: false, preorderPublicationDate: null, estimatedLeadTime: null, deliveryMethod: "Collection", location: "Prologue", notes: "", quantity: 2, publisher: "Penguin Random House", price: 16.99, orderDate: daysAgo(0, 3), lastModified: daysAgo(0, 3) },
] satisfies OrderSeed[]).map(withV3);

// Next dev compiles each route into its own bundle, so plain module state
// would give every API route a separate copy. Stash the store on globalThis
// so all routes (and HMR reloads) share one instance.
type Store = { orders: Order[]; customers: Customer[]; suppliers: Supplier[]; seq: number };
const g = globalThis as typeof globalThis & { __orderBookMock?: Store };
if (!g.__orderBookMock || !g.__orderBookMock.suppliers) {
  const store: Store = { orders: seedOrders(), customers: seedCustomers(), suppliers: seedSuppliers(), seq: 100 };
  for (const o of store.orders) {
    for (const c of o.customerIds) {
      store.customers.find((x) => x.id === c)?.orderIds.push(o.id);
    }
  }
  g.__orderBookMock = store;
}
const { orders, customers, suppliers } = g.__orderBookMock;
const id = (p: string) => `${p}${g.__orderBookMock!.seq++}`;

function attach(o: Order): Order {
  const c = customers.find((x) => x.id === o.customerIds[0]);
  return { ...o, customerName: c?.name, customerPhone: c?.phone };
}

export const mockDataSource: DataSource = {
  async listOrders() {
    return orders.map(attach);
  },
  async getOrder(oid) {
    const o = orders.find((x) => x.id === oid);
    return o ? attach(o) : null;
  },
  async createOrder(input: OrderInput) {
    const o: Order = {
      ...input,
      id: id("ord"),
      orderDate: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };
    orders.unshift(o);
    for (const c of o.customerIds) customers.find((x) => x.id === c)?.orderIds.push(o.id);
    return attach(o);
  },
  async updateOrder(oid, input) {
    const o = orders.find((x) => x.id === oid);
    if (!o) throw new Error("Order not found");
    Object.assign(o, input, { lastModified: new Date().toISOString() });
    return attach(o);
  },
  async deleteOrder(oid) {
    const i = orders.findIndex((x) => x.id === oid);
    if (i >= 0) orders.splice(i, 1);
  },

  async listCustomers() {
    return [...customers];
  },
  async getCustomer(cid) {
    return customers.find((x) => x.id === cid) ?? null;
  },
  async createCustomer(input: CustomerInput) {
    const c: Customer = { ...input, id: id("cus"), orderIds: [] };
    customers.unshift(c);
    return c;
  },
  async updateCustomer(cid, input) {
    const c = customers.find((x) => x.id === cid);
    if (!c) throw new Error("Customer not found");
    Object.assign(c, input);
    return c;
  },

  async listSuppliers() {
    return [...suppliers].sort((a, b) => a.name.localeCompare(b.name));
  },
  async createSupplier(input: SupplierInput) {
    const s: Supplier = { ...input, id: id("sup") };
    suppliers.push(s);
    return s;
  },
  async updateSupplier(sid, input) {
    const s = suppliers.find((x) => x.id === sid);
    if (!s) throw new Error("Supplier not found");
    Object.assign(s, input);
    return s;
  },
  async deleteSupplier(sid) {
    const i = suppliers.findIndex((x) => x.id === sid);
    if (i >= 0) suppliers.splice(i, 1);
  },
};
