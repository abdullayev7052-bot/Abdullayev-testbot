export interface BitoEnvelope<T> {
  code: number;
  message: string;
  status_code?: number;
  data: T;
  messages?: Record<string, string>;
}

export interface BitoPaging<T> {
  total: number;
  data: T[];
}

export interface BitoOrganization {
  _id: string; name: string; currency_id?: string; type?: string; is_default?: boolean; image?: string | null; is_active?: boolean;
}
export interface BitoWarehouse { _id: string; name: string; organization_id: string; is_main?: boolean; status?: string }
export interface BitoPrice { _id: string; name: string; short_name?: string; currency_id?: string; type?: string; is_main?: boolean; is_default?: boolean; status?: string }
export interface BitoCurrency { _id: string; name: string; code?: string; symbol?: string; is_main?: boolean }
export interface BitoEmployee { _id: string; full_name: string; phone_number?: string; is_boss?: boolean }
export interface BitoState { _id: string; name: string; type: string; is_default?: boolean; default_key?: string; organization_id: string }

export interface BitoCustomer {
  _id: string; name: string; type?: string; phone_number?: string; phone_numbers?: string[]; loyalty_card_id?: string;
  organization_ids?: string[]; balance?: number; balance_currency_id?: string; telegram_id?: number | string; telegram_link?: string;
  balances?: Record<string, { balance: number; balance_currency_id?: string }>; state?: string; address?: string;
  delivery_address?: { lat?: number; long?: number; human_address?: { address?: string } };
}

export interface BitoProduct {
  _id: string; name: string; number?: string; note?: string; sku?: string; barcode?: string; image?: string | null; images?: string[];
  box_item?: number; created_at?: string; updated_at?: string; is_deleted?: boolean; is_archived?: boolean;
  measure?: { _id: string; name?: string; short_name?: string; code?: string; decimal_count?: number };
  category?: { _id: string; name: string } | null;
  custom_fields?: { _id: string; value: unknown }[];
  organizations?: { organization_id: string; amount?: number; is_available?: boolean; is_available_for_sale?: boolean; prices?: { price_id: string; amount: number }[] }[];
  _warehouses?: Record<string, { amount?: number; booked?: number }>;
  is_product?: boolean; is_parent?: boolean; is_variant?: boolean;
}

export interface BitoPriceItem { _id: string; organization_id: string; price_id: string; amount: number; product: { _id: string; name: string }; category?: { _id: string; name: string } }
export interface BitoCategory { _id: string; name: string; parent_id?: string | null; image?: string | null; item_count?: number; is_available_for_sale?: boolean }
export interface BitoCustomField { _id: string; table_name: string; name: string; type: string; is_visible?: boolean; is_system?: boolean }

export interface BitoSaleOrderProductIn {
  product_id: string; amount: number; price: number; price_id: string; warehouse_id: string; box_count?: number; box_item?: number; real_price?: number;
}
export interface BitoSaleOrderCreate {
  uuid?: string; organization_id: string; customer_id: string; responsible_id: string; state: string; state_id?: string; date: string;
  delivery_date?: string; note?: string; discounts: unknown[]; products: BitoSaleOrderProductIn[]; price_id?: string; currency_id?: string;
  delivery_address?: { long: number; lat: number; human_address?: { addres?: string; address?: string; city?: string } };
}
export interface BitoSaleOrder {
  _id: string; number?: string; uuid?: string; state: string; state_id: string; date?: string; created_at?: string; updated_at?: string;
  note?: string; total_to_pay?: number; total_price?: number; total_amount?: number; customer_id?: string; organization_id?: string;
  customer?: { _id: string; name: string; phone_number?: string }; dynamic_state?: { _id: string; name: string; default_key?: string };
  products?: { product_id: string; name?: string; amount: number; price: number; total_price?: number; box_count?: number; image?: string; measure?: { short_name?: string; name?: string } }[];
  delivery_address?: { long?: number; lat?: number; human_address?: { addres?: string; address?: string } };
  trade_status?: string; trades?: { _id: string }[];
}

export interface BitoTrade {
  _id: string; number?: string; uuid?: string; state?: string; date?: string; sold_at?: string; created_at?: string; is_refund?: boolean;
  total_amount?: number; total_to_pay?: number; total_price?: number; debt?: number; total_discount?: number; order_id?: string;
  customer?: { _id: string; name: string; phone_number?: string }; customer_id?: string; organization?: { _id: string; name: string };
  responsible?: { _id: string; full_name?: string }; created_by?: { _id: string; full_name?: string };
  currency?: { _id: string; name?: string; symbol?: string };
  products?: { product_id: string; name?: string; amount: number; price: number; total_price?: number; total_to_pay?: number; measure?: { short_name?: string; name?: string } }[];
  payments?: { payment_method?: { _id?: string; name?: string; type?: string }; amount?: number; paid?: number; currency?: { name?: string } }[];
  customer_before_balance?: { currency_id?: string; amount: number; organization_id?: string }[];
  customer_after_balance?: { currency_id?: string; amount: number; organization_id?: string }[];
  by_balance?: { amount?: number; paid?: number }[];
  installment_plan?: { date?: string; amount?: number }[];
  is_installment_plan?: boolean;
  updated_at?: string;
}

export interface BitoTransaction {
  _id: string; number?: string; type: string; state?: string; date?: string; created_at?: string; amount?: number; amount_in_main?: number;
  customer?: { _id: string; name?: string; phone_number?: string }; customer_id?: string; trade_id?: string; organization_id?: string;
  payment_type?: { _id?: string; name?: string; payment_type?: string }; payment_method?: { _id?: string; name?: string; type?: string };
  created_by?: { _id?: string; full_name?: string }; cashbox?: { _id?: string; name?: string }; description?: string;
  currency?: { _id?: string; name?: string; symbol?: string };
  human_before_balance?: { currency_id?: string; amount: number; organization_id?: string }[];
  human_after_balance?: { currency_id?: string; amount: number; organization_id?: string }[];
  is_deleted?: boolean; updated_at?: string; to_customer?: string;
}

export interface BitoBalance {
  data: { _id: string; organization?: { _id: string; name: string }; balances?: { amount: number; currency?: { _id: string; name?: string; symbol?: string; code?: string } }[] }[];
}
