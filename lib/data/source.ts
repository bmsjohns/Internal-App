import type { Customer, CustomerInput, Order, OrderInput } from "@/lib/types";

// The seam for the future Postgres migration (spec §7): every page and API
// route goes through this interface. Swapping the store means writing one new
// implementation and changing the DATA_SOURCE env var — nothing else.
export interface DataSource {
  listOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
  createOrder(input: OrderInput): Promise<Order>;
  updateOrder(id: string, input: Partial<OrderInput>): Promise<Order>;
  deleteOrder(id: string): Promise<void>;

  listCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | null>;
  createCustomer(input: CustomerInput): Promise<Customer>;
  updateCustomer(id: string, input: Partial<CustomerInput>): Promise<Customer>;
}
