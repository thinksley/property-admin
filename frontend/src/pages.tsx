import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Rate, Select,
  Space, Switch, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { BILL_STATUS, FEE, HANDOVER_STATUS, REPAIR_STATUS, ROOM_STATUS, api, download,
  errMsg, yuan, type Bill, type Building, type FeeItem, type Owner, type Repair,
  type Room, type Unit } from "./api";
import { useAuth } from "./auth";

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const tag = (map: Record<string, [string, string]>, key: string) => (
  <Tag color={map[key]?.[1]}>{map[key]?.[0] ?? key}</Tag>
);
export { tag };

export function useList<T>(url: string, params: Record<string, unknown> = {}) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(params);
  const reload = useCallback(() => {
    if (!url) { setData([]); setLoading(false); return; }
    setLoading(true);
    api.get<T[]>(url, { params: JSON.parse(key) })
      .then((r) => setData(r.data))
      .catch((e) => message.error(errMsg(e)))
      .finally(() => setLoading(false));
  }, [url, key]);
  useEffect(() => reload(), [reload]);
  return { data, loading, reload };
}

export function Page({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <Typography.Title level={4} style={{ margin: 0 }}>{title}</Typography.Title>
        <Space>{extra}</Space>
      </div>
      {children}
    </>
  );
}

export function Rooms() {
  const { can } = useAuth();
  const [status, setStatus] = useState<string>();
  const { data, loading, reload } = useList<Room>("/rooms", { status });
  const { data: buildings } = useList<Building>("/buildings");
  const { data: units } = useList<Unit>("/units");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form] = Form.useForm();
  const buildingId = Form.useWatch<number | undefined>("building_id", form);

  const openForm = (r?: Room) => {
    setEditing(r ?? null);
    form.setFieldsValue(r ? {
      building_id: r.building_id, unit_id: r.unit_id, room_no: r.room_no, area: r.area,
      fee: r.fee_per_sqm_cents / 100, status: r.status, handover_status: r.handover_status,
    } : { status: "vacant", handover_status: "received", fee: 2 });
    setOpen(true);
  };

  const save = async () => {
    const v = await form.validateFields();
    const body = {
      building_id: v.building_id, unit_id: v.unit_id, room_no: v.room_no, area: v.area,
      status: v.status, handover_status: v.handover_status,
      fee_per_sqm_cents: Math.round(v.fee * 100),
    };
    try {
      if (editing) await api.patch(`/rooms/${editing.id}`, body);
      else await api.post("/rooms", body);
      message.success("房屋已保存");
      setOpen(false);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };

  const remove = async (id: number) => {
    try { await api.delete(`/rooms/${id}`); message.success("已删除"); reload(); }
    catch (e) { message.error(errMsg(e)); }
  };

  const changeStatus = async (id: number, value: string) => {
    try { await api.patch(`/rooms/${id}/status`, { status: value }); reload(); }
    catch (e) { message.error(errMsg(e)); }
  };

  const changeHandover = async (id: number, value: string) => {
    try { await api.patch(`/rooms/${id}`, { handover_status: value }); reload(); }
    catch (e) { message.error(errMsg(e)); }
  };

  const columns: ColumnsType<Room> = [
    { title: "楼栋", dataIndex: "building_name" },
    { title: "单元", render: (_, r) => r.unit_name ?? "—" },
    { title: "房号", dataIndex: "room_no" },
    { title: "面积 (㎡)", dataIndex: "area", align: "right" },
    { title: "业主 / 租客", render: (_, r) => r.owners.join("、") || "—" },
    { title: "物业费 (元/㎡·月)", align: "right", render: (_, r) => (r.fee_per_sqm_cents / 100).toFixed(2) },
    {
      title: "入住状态",
      render: (_, r) => (
        <Select size="small" style={{ width: 96 }} value={r.status} disabled={!can("house:write")}
          onChange={(v) => changeStatus(r.id, v)}
          options={Object.entries(ROOM_STATUS).map(([value, [label]]) => ({ value, label }))} />
      ),
    },
    {
      title: "收房状态",
      render: (_, r) => (
        <Select size="small" style={{ width: 100 }} value={r.handover_status} disabled={!can("house:write")}
          onChange={(v) => changeHandover(r.id, v)}
          options={Object.entries(HANDOVER_STATUS).map(([value, [label]]) => ({ value, label }))} />
      ),
    },
    {
      title: "操作", render: (_, r) => can("house:write") && (
        <Space>
          <Button size="small" onClick={() => openForm(r)}>编辑</Button>
          <Popconfirm title="确认删除该房屋？" onConfirm={() => remove(r.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Page title="房屋档案" extra={<>
      <Select allowClear placeholder="全部状态" style={{ width: 130 }} onChange={setStatus}
        options={Object.entries(ROOM_STATUS).map(([value, [label]]) => ({ value, label }))} />
      {can("house:write") && <Button type="primary" onClick={() => openForm()}>新增房屋</Button>}
    </>}>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={{ pageSize: 20 }} />
      <Modal title={editing ? "编辑房屋" : "新增房屋"} open={open} onOk={save}
        onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="building_id" label="楼栋" rules={[{ required: true }]}>
            <Select options={buildings.map((b) => ({ value: b.id, label: b.name }))}
              onChange={() => form.setFieldValue("unit_id", undefined)} />
          </Form.Item>
          <Form.Item name="unit_id" label="单元">
            <Select allowClear placeholder="可不选"
              options={units.filter((u) => !buildingId || u.building_id === buildingId)
                .map((u) => ({ value: u.id, label: `${u.building_name} ${u.name}` }))} />
          </Form.Item>
          <Form.Item name="room_no" label="房号" rules={[{ required: true }]}><Input placeholder="如 1502" /></Form.Item>
          <Form.Item name="area" label="建筑面积 (㎡)" rules={[{ required: true }]}><InputNumber min={1} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="fee" label="物业费单价 (元/㎡·月)"><InputNumber min={0} step={0.1} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="status" label="入住状态">
            <Select options={Object.entries(ROOM_STATUS).map(([value, [label]]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="handover_status" label="收房状态">
            <Select options={Object.entries(HANDOVER_STATUS).map(([value, [label]]) => ({ value, label }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Page>
  );
}

export function Owners() {
  const { can } = useAuth();
  const [keyword, setKeyword] = useState<string>();
  const { data, loading, reload } = useList<Owner>("/owners", { keyword });
  const { data: rooms } = useList<Room>("/rooms");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Owner | null>(null);
  const [form] = Form.useForm();

  const openForm = (o?: Owner) => {
    setEditing(o ?? null);
    form.setFieldsValue(o ? {
      name: o.name, phone: o.phone, id_card_masked: o.id_card_masked,
      room_id: o.room_id, is_tenant: o.is_tenant,
    } : { is_tenant: false });
    setOpen(true);
  };

  const save = async () => {
    const v = await form.validateFields();
    try {
      if (editing) await api.patch(`/owners/${editing.id}`, v);
      else await api.post("/owners", v);
      message.success("业主已保存");
      setOpen(false);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };

  const remove = async (id: number) => {
    try { await api.delete(`/owners/${id}`); message.success("已删除"); reload(); }
    catch (e) { message.error(errMsg(e)); }
  };

  const columns: ColumnsType<Owner> = [
    { title: "姓名", dataIndex: "name" },
    { title: "电话", dataIndex: "phone" },
    { title: "房屋", render: (_, o) => (o.room_no ? `${o.building_name} ${o.room_no}` : "—") },
    { title: "身份", render: (_, o) => <Tag>{o.is_tenant ? "租客" : "业主"}</Tag> },
    { title: "家庭成员", dataIndex: "family_count", align: "right" },
    { title: "证件号", dataIndex: "id_card_masked", render: (v) => v ?? "—" },
    {
      title: "操作", render: (_, o) => can("house:write") && (
        <Space>
          <Button size="small" onClick={() => openForm(o)}>编辑</Button>
          <Popconfirm title="确认删除该业主？" onConfirm={() => remove(o.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Page title="业主管理" extra={<>
      <Input.Search allowClear placeholder="姓名 / 电话" style={{ width: 220 }} onSearch={setKeyword} />
      {can("house:write") && <Button type="primary" onClick={() => openForm()}>新增业主</Button>}
    </>}>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={{ pageSize: 20 }} />
      <Modal title={editing ? "编辑业主" : "新增业主"} open={open}
        onOk={save} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="phone" label="联系电话" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="id_card_masked" label="证件号（脱敏）"><Input placeholder="310***********1234" /></Form.Item>
          <Form.Item name="room_id" label="关联房屋">
            <Select allowClear options={rooms.map((r) => ({ value: r.id, label: `${r.building_name} ${r.room_no}` }))} />
          </Form.Item>
          <Form.Item name="is_tenant" label="是否租客" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </Page>
  );
}

export function Bills() {
  const { can } = useAuth();
  const [period, setPeriod] = useState(currentPeriod());
  const [status, setStatus] = useState<string>();
  const { data, loading, reload } = useList<Bill>("/bills", { period, status });
  const { data: feeItems } = useList<FeeItem>("/fee-items");
  const [genOpen, setGenOpen] = useState(false);
  const [payFor, setPayFor] = useState<Bill | null>(null);
  const [genForm] = Form.useForm();
  const [payForm] = Form.useForm();

  const generate = async () => {
    const v = await genForm.validateFields();
    try {
      const { data: r } = await api.post("/bills/generate", {
        period: v.period, fee_item_id: v.fee_item_id,
      });
      message.success(`已生成 ${r.created} 笔账单，跳过 ${r.skipped} 笔已存在的账单`);
      setGenOpen(false);
      if (v.period === period) reload(); else setPeriod(v.period);
    } catch (e) { message.error(errMsg(e)); }
  };

  const applyLate = async () => {
    try {
      const { data: r } = await api.post("/bills/apply-late-fee", { period });
      message.success(`已更新 ${r.changed} 笔滞纳金，合计 ${yuan(r.late_fee_cents)}`);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };

  const remind = async () => {
    try {
      const { data: r } = await api.post("/bills/remind", { period });
      message.success(r.message);
    } catch (e) { message.error(errMsg(e)); }
  };

  const reconcile = async () => {
    try {
      const { data: r } = await api.get("/bills/reconcile", { params: { period } });
      Modal.info({
        title: `${period} 对账结果`,
        content: (
          <div>
            <div>应收合计：{yuan(r.receivable_cents)}</div>
            <div>已收合计：{yuan(r.collected_cents)}</div>
            <div>欠费合计：{yuan(r.arrears_cents)}</div>
            <div>账单 {r.bill_count} 笔，未结清 {r.unpaid_count} 笔</div>
          </div>
        ),
      });
    } catch (e) { message.error(errMsg(e)); }
  };

  const pay = async () => {
    if (!payFor) return;
    const v = await payForm.validateFields();
    try {
      await api.post(`/bills/${payFor.id}/payments`, { amount_cents: Math.round(v.amount * 100), method: v.method });
      message.success("收款成功");
      setPayFor(null);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };

  const onlinePay = async (b: Bill, method: "wechat" | "alipay") => {
    try {
      await api.post(`/bills/${b.id}/online-pay`, { method });
      message.success(method === "wechat" ? "微信缴清成功" : "支付宝缴清成功");
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };

  const columns: ColumnsType<Bill> = [
    { title: "房屋", render: (_, b) => `${b.building_name} ${b.room_no}` },
    { title: "账期", dataIndex: "period" },
    { title: "费用", render: (_, b) => b.fee_item_name ?? FEE[b.fee_type] ?? b.fee_type },
    { title: "应收", align: "right", render: (_, b) => yuan(b.amount_cents) },
    { title: "滞纳金", align: "right", render: (_, b) => yuan(b.late_fee_cents) },
    { title: "已收", align: "right", render: (_, b) => yuan(b.paid_cents) },
    { title: "欠费", align: "right", render: (_, b) => yuan(b.balance_cents) },
    { title: "到期日", dataIndex: "due_date", render: (v) => v ?? "—" },
    { title: "状态", render: (_, b) => tag(BILL_STATUS, b.status) },
    {
      title: "操作",
      render: (_, b) => b.balance_cents > 0 && can("bill:write") ? (
        <Space size={4}>
          <Button size="small" onClick={() => setPayFor(b)}>收款</Button>
          <Button size="small" onClick={() => onlinePay(b, "wechat")}>微信缴清</Button>
          <Button size="small" onClick={() => onlinePay(b, "alipay")}>支付宝</Button>
        </Space>
      ) : null,
    },
  ];

  return (
    <Page title="账单管理" extra={<>
      <Input style={{ width: 120 }} value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-11" />
      <Select allowClear placeholder="全部状态" style={{ width: 120 }} onChange={setStatus}
        options={Object.entries(BILL_STATUS).map(([value, [label]]) => ({ value, label }))} />
      <Button onClick={applyLate} disabled={!can("bill:write")}>计算滞纳金</Button>
      <Button onClick={remind} disabled={!can("bill:write")}>欠费催缴</Button>
      <Button onClick={reconcile}>对账</Button>
      <Button onClick={() => download(`/bills/export?period=${period}`, `bills_${period}.csv`)}>导出</Button>
      {can("bill:write") && <Button type="primary" onClick={() => setGenOpen(true)}>生成账单</Button>}
    </>}>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={{ pageSize: 20 }} />

      <Modal title="生成账单" open={genOpen} onOk={generate} onCancel={() => setGenOpen(false)} destroyOnClose>
        <Form form={genForm} layout="vertical"
          initialValues={{ period: currentPeriod(), fee_item_id: feeItems[0]?.id }}>
          <Form.Item name="period" label="账期 (YYYY-MM)" rules={[{ required: true, pattern: /^\d{4}-\d{2}$/ }]}><Input /></Form.Item>
          <Form.Item name="fee_item_id" label="收费项目" rules={[{ required: true }]}>
            <Select options={feeItems.filter((f) => f.enabled).map((f) => ({
              value: f.id,
              label: `${f.name}（${f.calc_type === "area" ? "按面积" : "按户"} ${yuan(f.unit_price_cents)}${f.calc_type === "area" ? "/㎡" : "/户"}）`,
            }))} />
          </Form.Item>
          <Typography.Text type="secondary">按面积项目 = 面积 × 单价；按户项目 = 每户固定金额。已生成的房屋会跳过。</Typography.Text>
        </Form>
      </Modal>

      <Modal title={payFor ? `收款 · ${payFor.building_name} ${payFor.room_no}` : "收款"} open={!!payFor}
        onOk={pay} onCancel={() => setPayFor(null)} destroyOnClose>
        <Form key={payFor?.id} form={payForm} layout="vertical"
          initialValues={{ amount: payFor ? payFor.balance_cents / 100 : 0, method: "cash" }}>
          <Form.Item name="amount" label="收款金额 (元)" rules={[{ required: true }]}>
            <InputNumber min={0.01} max={payFor ? payFor.balance_cents / 100 : undefined} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="method" label="支付方式">
            <Select options={[{ value: "cash", label: "现金" }, { value: "wechat", label: "微信" },
              { value: "alipay", label: "支付宝" }, { value: "bank", label: "银行转账" }]} />
          </Form.Item>
        </Form>
      </Modal>
    </Page>
  );
}

const REPAIR_CATEGORIES = ["水电", "门窗", "电梯", "公共设施", "其他"];

export function Repairs() {
  const { can } = useAuth();
  const { data, loading, reload } = useList<Repair>("/repairs");
  const { data: rooms } = useList<Room>(can("repair:write") ? "/rooms" : "");
  const [createOpen, setCreateOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<Repair | null>(null);
  const [reviewFor, setReviewFor] = useState<Repair | null>(null);
  const [createForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [reviewForm] = Form.useForm();

  const move = async (id: number, status: string, assignee?: string) => {
    try {
      await api.post(`/repairs/${id}/status`, { status, assignee });
      message.success("工单已更新");
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };

  const create = async () => {
    const v = await createForm.validateFields();
    try {
      await api.post("/repairs", v);
      message.success("报修已登记");
      setCreateOpen(false);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };

  const assign = async () => {
    if (!assignFor) return;
    const v = await assignForm.validateFields();
    await move(assignFor.id, "assigned", v.assignee);
    setAssignFor(null);
  };

  const review = async () => {
    if (!reviewFor) return;
    const v = await reviewForm.validateFields();
    try {
      await api.post(`/repairs/${reviewFor.id}/review`, v);
      message.success("评价已提交");
      setReviewFor(null);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };

  const actions = (r: Repair) => {
    const out: ReactNode[] = [];
    if (r.status === "pending" && can("repair:write"))
      out.push(<Button key="a" size="small" onClick={() => setAssignFor(r)}>派单</Button>);
    if (r.status === "assigned" && can("repair:handle"))
      out.push(<Button key="p" size="small" onClick={() => move(r.id, "processing")}>开始处理</Button>);
    if (r.status === "processing" && can("repair:handle"))
      out.push(<Button key="d" size="small" type="primary" onClick={() => move(r.id, "done")}>完工</Button>);
    if (r.status === "done" && can("repair:write"))
      out.push(<Button key="c" size="small" onClick={() => move(r.id, "closed")}>关闭</Button>);
    if (["done", "closed"].includes(r.status) && !r.rating && can("repair:read"))
      out.push(<Button key="r" size="small" onClick={() => setReviewFor(r)}>评价</Button>);
    return <Space>{out}</Space>;
  };

  const columns: ColumnsType<Repair> = [
    { title: "报修时间", dataIndex: "created_at" },
    { title: "房屋", render: (_, r) => `${r.building_name} ${r.room_no}` },
    { title: "类别", dataIndex: "category" },
    { title: "描述", dataIndex: "description", ellipsis: true },
    { title: "状态", render: (_, r) => tag(REPAIR_STATUS, r.status) },
    { title: "负责人", render: (_, r) => r.assignee ?? "—" },
    {
      title: "评价",
      render: (_, r) => r.rating
        ? <Space direction="vertical" size={0}><Rate disabled value={r.rating} />
            {r.comment && <Typography.Text type="secondary">{r.comment}</Typography.Text>}</Space>
        : "—",
    },
    { title: "操作", render: (_, r) => actions(r) },
  ];

  return (
    <Page title="报修工单" extra={can("repair:write") && <Button type="primary" onClick={() => setCreateOpen(true)}>登记报修</Button>}>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={{ pageSize: 20 }} />

      <Modal title="登记报修" open={createOpen} onOk={create} onCancel={() => setCreateOpen(false)} destroyOnClose>
        <Form form={createForm} layout="vertical">
          <Form.Item name="room_id" label="房屋" rules={[{ required: true }]}>
            <Select options={rooms.map((r) => ({ value: r.id, label: `${r.building_name} ${r.room_no}` }))} />
          </Form.Item>
          <Form.Item name="category" label="类别" rules={[{ required: true }]}>
            <Select options={REPAIR_CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="description" label="问题描述" rules={[{ required: true, min: 2 }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="派单" open={!!assignFor} onOk={assign} onCancel={() => setAssignFor(null)} destroyOnClose>
        <Form form={assignForm} layout="vertical">
          <Form.Item name="assignee" label="维修人员" rules={[{ required: true }]}>
            <Input placeholder="填写维修人员姓名，如：张师傅" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="工单评价" open={!!reviewFor} onOk={review} onCancel={() => setReviewFor(null)} destroyOnClose>
        <Form form={reviewForm} layout="vertical" initialValues={{ rating: 5 }}>
          <Form.Item name="rating" label="满意度" rules={[{ required: true }]}><Rate /></Form.Item>
          <Form.Item name="comment" label="评价内容"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </Page>
  );
}
