import axios from "axios";

export const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(undefined, (err) => {
  if (err.response?.status === 401 && !location.pathname.startsWith("/login")) {
    localStorage.removeItem("token");
    location.href = "/login";
  }
  return Promise.reject(err);
});

export const errMsg = (e: unknown): string =>
  (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "操作失败，请稍后重试";

export const yuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

export async function download(url: string, filename: string) {
  const r = await api.get(url, { responseType: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(r.data as Blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export const FEE: Record<string, string> = {
  property: "物业费", parking: "停车费", water: "水费", electric: "电费", garbage: "垃圾清运费",
};
export const ROOM_STATUS: Record<string, [string, string]> = {
  owner_occupied: ["自住", "green"], rented: ["出租", "blue"], vacant: ["空置", "default"],
};
export const BILL_STATUS: Record<string, [string, string]> = {
  unpaid: ["未缴", "red"], partial: ["部分缴", "orange"], paid: ["已缴", "green"],
};
export const REPAIR_STATUS: Record<string, [string, string]> = {
  pending: ["待派单", "red"], assigned: ["已派单", "blue"], processing: ["处理中", "orange"],
  done: ["已完工", "green"], closed: ["已关闭", "default"],
};
export const HANDOVER_STATUS: Record<string, [string, string]> = {
  received: ["已收房", "green"], pending: ["未收房", "orange"],
};
export const CALC_TYPE: Record<string, string> = { area: "按面积", fixed: "按户固定" };
export const PAY_METHOD: Record<string, string> = {
  cash: "现金", wechat: "微信", alipay: "支付宝", bank: "银行转账",
};
export const SPACE_TYPE: Record<string, string> = { fixed: "固定车位", temp: "临时车位" };
export const SPACE_STATUS: Record<string, [string, string]> = {
  free: ["空闲", "default"], rented: ["已出租", "blue"], sold: ["已售", "green"],
};
export const VISITOR_STATUS: Record<string, [string, string]> = {
  pending: ["待审核", "orange"], approved: ["已通过", "blue"], rejected: ["已拒绝", "red"],
  checked_in: ["已入场", "green"], checked_out: ["已离场", "default"],
};
export const COMPLAINT_STATUS: Record<string, [string, string]> = {
  pending: ["待处理", "red"], processing: ["处理中", "orange"],
  resolved: ["已解决", "green"], closed: ["已关闭", "default"],
};
export const ANNOUNCEMENT_STATUS: Record<string, [string, string]> = {
  draft: ["草稿", "default"], published: ["已发布", "green"],
};
export const ANNOUNCEMENT_CATEGORY: Record<string, string> = {
  notice: "通知", water: "停水", electric: "停电", fee: "催缴", other: "其他",
};
export const FACILITY_STATUS: Record<string, [string, string]> = {
  normal: ["正常", "green"], repairing: ["维修中", "orange"], stopped: ["停用", "red"],
};
export const INSPECTION_RESULT: Record<string, [string, string]> = {
  normal: ["正常", "green"], abnormal: ["异常", "red"],
};
export const STOCK_TYPE: Record<string, [string, string]> = {
  in: ["入库", "green"], out: ["出库", "orange"],
};
export const ROLE_LABEL: Record<string, string> = {
  admin: "超级管理员", manager: "物业经理", cashier: "收费员",
  finance: "财务", repairman: "维修工",
};

export interface Building { id: number; name: string; floors: number }
export interface CommunityInfo {
  id: number; name: string; address: string | null; contact_name: string | null;
  contact_phone: string | null;
}
export interface Unit { id: number; building_id: number; building_name: string; name: string }
export interface Room {
  id: number; building_id: number; building_name: string; unit_id: number | null;
  unit_name: string | null; room_no: string; area: number; status: string;
  handover_status: string; fee_per_sqm_cents: number; owners: string[];
}
export interface Owner {
  id: number; name: string; phone: string; id_card_masked: string | null; is_tenant: boolean;
  room_id: number | null; room_no: string | null; building_name: string | null;
  family_count: number;
}
export interface FamilyMember {
  id: number; owner_id: number; owner_name: string | null; name: string; relation: string;
  phone: string | null;
}
export interface Bill {
  id: number; room_id: number; room_no: string; building_name: string; period: string;
  fee_type: string; fee_item_id: number | null; fee_item_name: string | null;
  amount_cents: number; paid_cents: number; late_fee_cents: number; balance_cents: number;
  due_date: string | null; status: string;
}
export interface FeeItem {
  id: number; name: string; code: string; calc_type: string; unit_price_cents: number;
  enabled: boolean;
}
export interface Payment {
  id: number; bill_id: number; receipt_no: string | null; amount_cents: number; method: string;
  operator: string; paid_at: string; period: string | null; fee_type: string | null;
  room_no: string | null; building_name: string | null;
}
export interface Repair {
  id: number; room_id: number; room_no: string; building_name: string; category: string;
  description: string; status: string; assignee: string | null; rating: number | null;
  comment: string | null; created_at: string; updated_at: string;
}
export interface Visitor {
  id: number; name: string; phone: string; room_id: number | null; room_no: string | null;
  building_name: string | null; host_name: string | null; purpose: string | null;
  visit_at: string; status: string; pass_code: string; created_at: string;
}
export interface ParkingSpace {
  id: number; code: string; building_id: number | null; building_name: string | null;
  space_type: string; status: string; plate_no: string | null; owner_name: string | null;
  monthly_fee_cents: number; expire_date: string | null;
}
export interface ParkingRecord {
  id: number; plate_no: string; parking_space_id: number | null; space_code: string | null;
  billing_type: string; entry_at: string; exit_at: string | null; amount_cents: number;
  status: string;
}
export interface Complaint {
  id: number; room_id: number | null; room_no: string | null; building_name: string | null;
  owner_name: string; phone: string | null; category: string; content: string; status: string;
  handler: string | null; reply: string | null; follow_up: string | null;
  created_at: string; updated_at: string;
}
export interface Announcement {
  id: number; title: string; content: string; category: string; status: string;
  published_at: string | null; pushed_at: string | null; created_at: string;
}
export interface Material {
  id: number; name: string; category: string; unit: string; stock: number;
  warning_stock: number; low_stock: boolean;
}
export interface StockRecord {
  id: number; material_id: number; material_name: string | null; material_unit: string | null;
  record_type: string; quantity: number; amount_cents: number; operator: string;
  note: string | null; created_at: string;
}
export interface Facility {
  id: number; name: string; category: string; location: string | null; status: string;
  last_maintenance_at: string | null; next_maintenance_at: string | null;
}
export interface MaintenanceRecord {
  id: number; facility_id: number; facility_name: string | null; content: string;
  operator: string; maintained_at: string;
}
export interface InspectionPoint {
  id: number; name: string; location: string | null; qr_code: string; enabled: boolean;
}
export interface InspectionRecord {
  id: number; point_id: number; point_name: string | null; location: string | null;
  inspector: string; result: string; note: string | null; created_at: string;
}
export interface UserRow {
  id: number; username: string; real_name: string; role: string; is_active: boolean;
}
export interface RoleInfo { role: string; label: string; perms: string[] }
export interface LogRow {
  id: number; username: string; method: string; path: string; status_code: number;
  ip: string | null; created_at: string;
}
export interface ArrearsBill extends Bill { owners: string[] }
export interface Summary {
  rooms: number; occupied: number; period: string; receivable_cents: number;
  collected_cents: number; arrears_count: number; open_repairs: number;
  arrears_cents?: number; open_complaints?: number; visitors_today?: number;
  low_stock?: number; facility_alerts?: number; inspections_today?: number;
}
export interface ReportOverview extends Summary {
  arrears_cents: number; open_complaints: number; visitors_today: number;
  low_stock: number; facility_alerts: number; inspections_today: number;
}
export interface Revenue {
  period: string; receivable_cents: number; collected_cents: number;
  by_fee_type: { fee_type: string; name: string | null; count: number; amount_cents: number;
    paid_cents: number; late_fee_cents: number }[];
  by_method: { method: string; count: number; amount_cents: number }[];
}
export interface TrendPoint {
  period: string; receivable_cents: number; collected_cents: number;
  arrears_cents: number; bill_count: number;
}
export interface IncomeExpense {
  period: string; income_cents: number; expense_cents: number; net_cents: number;
  payment_count: number; purchase_count: number;
}
