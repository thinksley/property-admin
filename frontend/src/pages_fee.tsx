import { useState } from "react";
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table,
  Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CALC_TYPE, PAY_METHOD, api, download, errMsg, yuan,
  type FeeItem, type Payment } from "./api";
import { useAuth } from "./auth";
import { Page, useList } from "./pages";

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function FeeItems() {
  const { can } = useAuth();
  const { data, loading, reload } = useList<FeeItem>("/fee-items");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FeeItem | null>(null);
  const [form] = Form.useForm();

  const openForm = (f?: FeeItem) => {
    setEditing(f ?? null);
    form.setFieldsValue(f ? { ...f, price: f.unit_price_cents / 100 }
      : { calc_type: "area", price: 2.3, enabled: true });
    setOpen(true);
  };
  const save = async () => {
    const v = await form.validateFields();
    const body = {
      name: v.name, calc_type: v.calc_type,
      unit_price_cents: Math.round((v.price ?? 0) * 100), enabled: v.enabled,
    };
    try {
      if (editing) await api.patch(`/fee-items/${editing.id}`, body);
      else await api.post("/fee-items", { ...body, code: v.code });
      message.success("收费项目已保存");
      setOpen(false);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };
  const toggle = async (f: FeeItem, enabled: boolean) => {
    try { await api.patch(`/fee-items/${f.id}`, { enabled }); reload(); }
    catch (e) { message.error(errMsg(e)); }
  };
  const remove = async (id: number) => {
    try { await api.delete(`/fee-items/${id}`); message.success("已删除"); reload(); }
    catch (e) { message.error(errMsg(e)); }
  };

  const columns: ColumnsType<FeeItem> = [
    { title: "项目名称", dataIndex: "name" },
    { title: "编码", dataIndex: "code" },
    { title: "计价方式", render: (_, f) => CALC_TYPE[f.calc_type] ?? f.calc_type },
    {
      title: "单价",
      align: "right",
      render: (_, f) => `${yuan(f.unit_price_cents)}${f.calc_type === "area" ? " /㎡" : " /户"}`,
    },
    {
      title: "启用", render: (_, f) => (
        <Switch size="small" checked={f.enabled} disabled={!can("fee:write")}
          onChange={(v) => toggle(f, v)} />
      ),
    },
    {
      title: "操作", render: (_, f) => can("fee:write") && (
        <Space>
          <Button size="small" onClick={() => openForm(f)}>编辑</Button>
          <Popconfirm title="确认删除该收费项目？" onConfirm={() => remove(f.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Page title="收费项目" extra={can("fee:write") && <Button type="primary" onClick={() => openForm()}>新增项目</Button>}>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={false} />
      <Modal title={editing ? "编辑收费项目" : "新增收费项目"} open={open}
        onOk={save} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="项目名称" rules={[{ required: true }]}><Input placeholder="如 物业费" /></Form.Item>
          {!editing && (
            <Form.Item name="code" label="项目编码" rules={[{ required: true, pattern: /^[a-z][a-z0-9_]*$/ }]}>
              <Input placeholder="小写字母开头，如 property" />
            </Form.Item>
          )}
          <Form.Item name="calc_type" label="计价方式" rules={[{ required: true }]}>
            <Select options={Object.entries(CALC_TYPE).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="price" label="单价 (元)" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="enabled" label="是否启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </Page>
  );
}

export function Payments() {
  const [period, setPeriod] = useState(currentPeriod());
  const [method, setMethod] = useState<string>();
  const { data, loading } = useList<Payment>("/payments", { period, method });

  const columns: ColumnsType<Payment> = [
    { title: "票据号", dataIndex: "receipt_no", render: (v) => v ?? "—" },
    { title: "缴费时间", dataIndex: "paid_at" },
    { title: "房屋", render: (_, p) => p.room_no ? `${p.building_name} ${p.room_no}` : "—" },
    { title: "账期", render: (_, p) => p.period ?? "—" },
    { title: "费用类型", render: (_, p) => p.fee_type ?? "—" },
    { title: "金额", align: "right", render: (_, p) => yuan(p.amount_cents) },
    { title: "方式", render: (_, p) => <Tag>{PAY_METHOD[p.method] ?? p.method}</Tag> },
    { title: "经办人", dataIndex: "operator" },
  ];

  return (
    <Page title="缴费记录" extra={<>
      <Input style={{ width: 120 }} value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-11" />
      <Select allowClear placeholder="全部方式" style={{ width: 130 }} onChange={setMethod}
        options={Object.entries(PAY_METHOD).map(([value, label]) => ({ value, label }))} />
      <Button onClick={() => download(`/payments/export?period=${period}`, `payments_${period}.csv`)}>导出</Button>
    </>}>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={{ pageSize: 20 }} />
    </Page>
  );
}
