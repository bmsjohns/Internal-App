import type { Customer, CustomerInput, Order, OrderInput, Supplier, SupplierInput } from "@/lib/types";

// The seam for the future Postgres migration (spec §7): every page and API
// route goes through this interface. Swapping the store means writing one new
// implementation and changing the DATA_SOURCE env var — nothing else.
export interface DataSource {
  /** Open orders (any age) + closed orders inside the recent window. */
  listOrders(): Promise<Order[]>;
  /** Full-history search on title / author / ISBN / customer name. */
  searchOrders(query: string): Promise<Order[]>;
  /** Fetch specific orders by id regardless of age (e.g. a customer's history). */
  getOrdersByIds(ids: string[]): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
  createOrder(input: OrderInput): Promise<Order>;
  updateOrder(id: string, input: Partial<OrderInput>): Promise<Order>;
  deleteOrder(id: string): Promise<void>;

  listCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | null>;
  createCustomer(input: CustomerInput): Promise<Customer>;
  updateCustomer(id: string, input: Partial<CustomerInput>): Promise<Customer>;

  // V3 §3: supplier settings (cadence + account number)
  listSuppliers(): Promise<Supplier[]>;
  createSupplier(input: SupplierInput): Promise<Supplier>;
  updateSupplier(id: string, input: Partial<SupplierInput>): Promise<Supplier>;
  deleteSupplier(id: string): Promise<void>;
}
