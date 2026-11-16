import { useState } from "react";
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table,
  Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FACILITY_STATUS, INSPECTION_RESULT, STOCK_TYPE, api, errMsg, yuan,
  type Facility, type InspectionPoint, type InspectionRecord, type MaintenanceRecord,
  type Material, type StockRecord } from "./api";
import { useAuth } from "./auth";
import { Page, tag, useList } from "./pages";

export function Materials() {
  const { can } = useAuth();
  const [lowOnly, setLowOnly] = useState(false);
  const { data, loading, reload } = useList<Material>("/materials", { low_stock: lowOnly });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [stockFor, setStockFor] = useState<Material | null>(null);
  const [recordsFor, setRecordsFor] = useState<Material | null>(null);
  const [records, setRecords] = useState<StockRecord[]>([]);
  const [form] = Form.useForm();
  const [stockForm] = Form.useForm();

  const openForm = (x?: Material) => {
    setEditing(x ?? null);
    form.setFieldsValue(x ?? { category: "其他", unit: "件", stock: 0, warning_stock: 5 });
    setOpen(true);
  };
  const save = async () => {
    const v = await form.validateFields();
    try {
      if (editing) await api.patch(`/materials/${editing.id}`, v);
      else await api.post("/materials", v);
      message.success("物料已保存");
      setOpen(false);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };
  const remove = async (id: number) => {
    try { await api.delete(`/materials/${id}`); message.success("已删除"); reload(); }
    catch (e) { message.error(errMsg(e)); }
  };
  const changeStock = async () => {
    if (!stockFor) return;
    const v = await stockForm.validateFields();
    try {
      await api.post(`/materials/${stockFor.id}/stock`, {
        record_type: v.record_type, quantity: v.quantity,
        amount_cents: Math.round((v.amount ?? 0) * 100), note: v.note,
      });
      message.success("库存已更新");
      setStockFor(null);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };
  const showRecords = async (x: Material) => {
    setRecordsFor(x);
    try {
      const { data: r } = await api.get<StockRecord[]>("/stock-records", { params: { material_id: x.id } });
      setRecords(r);
    } catch (e) { message.error(errMsg(e)); }
  };

  const columns: ColumnsType<Material> = [
    { title: "物料名称", dataIndex: "name" },
    { title: "分类", dataIndex: "category" },
    { title: "单位", dataIndex: "unit" },
    {
      title: "库存", align: "right",
      render: (_, x) => <Space>{x.stock}{x.low_stock && <Tag color="red">预警</Tag>}</Space>,
    },
    { title: "预警线", dataIndex: "warning_stock", align: "right" },
    {
      title: "操作", render: (_, x) => (
        <Space>
          <Button size="small" onClick={() => showRecords(x)}>流水</Button>
          {can("asset:write") && <Button size="small" onClick={() => {
            setStockFor(x);
            stockForm.setFieldsValue({ record_type: "in", quantity: 1, amount: 0 });
          }}>出入库</Button>}
          {can("asset:write") && <Button size="small" onClick={() => openForm(x)}>编辑</Button>}
          {can("asset:write") && (
            <Popconfirm title="确认删除该物料？" onConfirm={() => remove(x.id)}>
              <Button size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Page title="物料库存" extra={<>
      <Select value={lowOnly} style={{ width: 130 }} onChange={setLowOnly}
        options={[{ value: false, label: "全部物料" }, { value: true, label: "仅库存预警" }]} />
      {can("asset:write") && <Button type="primary" onClick={() => openForm()}>新增物料</Button>}
    </>}>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={{ pageSize: 20 }} />

      <Modal title={editing ? "编辑物料" : "新增物料"} open={open}
        onOk={save} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="物料名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="category" label="分类"><Input /></Form.Item>
          <Form.Item name="unit" label="单位"><Input /></Form.Item>
          {!editing && <Form.Item name="stock" label="初始库存"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>}
          <Form.Item name="warning_stock" label="预警库存"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`出入库 · ${stockFor?.name ?? ""}`} open={!!stockFor}
        onOk={changeStock} onCancel={() => setStockFor(null)} destroyOnClose>
        <Form form={stockForm} layout="vertical">
          <Form.Item name="record_type" label="类型" rules={[{ required: true }]}>
            <Select options={Object.entries(STOCK_TYPE).map(([value, [label]]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="amount" label="金额 (元，入库采购价)"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="note" label="备注"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`出入库流水 · ${recordsFor?.name ?? ""}`} open={!!recordsFor}
        footer={null} onCancel={() => setRecordsFor(null)} width={680}>
        <Table rowKey="id" size="small" dataSource={records} pagination={false}
          columns={[
            { title: "时间", dataIndex: "created_at" },
            { title: "类型", render: (_, r) => tag(STOCK_TYPE, r.record_type) },
            { title: "数量", dataIndex: "quantity", align: "right" },
            { title: "金额", align: "right", render: (_, r) => yuan(r.amount_cents) },
            { title: "经办人", dataIndex: "operator" },
            { title: "备注", render: (_, r) => r.note ?? "—" },
          ]} />
      </Modal>
    </Page>
  );
}

export function Facilities() {
  const { can } = useAuth();
  const { data, loading, reload } = useList<Facility>("/facilities");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Facility | null>(null);
  const [maintainFor, setMaintainFor] = useState<Facility | null>(null);
  const [recordsFor, setRecordsFor] = useState<Facility | null>(null);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [form] = Form.useForm();
  const [maintainForm] = Form.useForm();

  const openForm = (x?: Facility) => {
    setEditing(x ?? null);
    form.setFieldsValue(x ?? { category: "其他", status: "normal" });
    setOpen(true);
  };
  const save = async () => {
    const v = await form.validateFields();
    try {
      if (editing) await api.patch(`/facilities/${editing.id}`, v);
      else await api.post("/facilities", v);
      message.success("设施已保存");
      setOpen(false);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };
  const remove = async (id: number) => {
    try { await api.delete(`/facilities/${id}`); message.success("已删除"); reload(); }
    catch (e) { message.error(errMsg(e)); }
  };
  const maintain = async () => {
    if (!maintainFor) return;
    const v = await maintainForm.validateFields();
    try {
      await api.post(`/facilities/${maintainFor.id}/maintain`, v);
      message.success("保养记录已登记");
      setMaintainFor(null);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };
  const showRecords = async (x: Facility) => {
    setRecordsFor(x);
    try {
      const { data: r } = await api.get<MaintenanceRecord[]>("/maintenance-records", { params: { facility_id: x.id } });
      setRecords(r);
    } catch (e) { message.error(errMsg(e)); }
  };

  const columns: ColumnsType<Facility> = [
    { title: "设施名称", dataIndex: "name" },
    { title: "类别", dataIndex: "category" },
    { title: "位置", render: (_, x) => x.location ?? "—" },
    { title: "状态", render: (_, x) => tag(FACILITY_STATUS, x.status) },
    { title: "上次保养", render: (_, x) => x.last_maintenance_at ?? "—" },
    { title: "下次保养", render: (_, x) => x.next_maintenance_at ?? "—" },
    {
      title: "操作", render: (_, x) => (
        <Space>
          <Button size="small" onClick={() => showRecords(x)}>记录</Button>
          {can("asset:write") && <Button size="small" onClick={() => { setMaintainFor(x); maintainForm.setFieldsValue({ content: "" }); }}>保养</Button>}
          {can("asset:write") && <Button size="small" onClick={() => openForm(x)}>编辑</Button>}
          {can("asset:write") && (
            <Popconfirm title="确认删除该设施？" onConfirm={() => remove(x.id)}>
              <Button size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Page title="公共设施" extra={can("asset:write") && <Button type="primary" onClick={() => openForm()}>新增设施</Button>}>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={{ pageSize: 20 }} />

      <Modal title={editing ? "编辑设施" : "新增设施"} open={open}
        onOk={save} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="设施名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="category" label="类别"><Input placeholder="电梯 / 水泵 / 配电 / 消防" /></Form.Item>
          <Form.Item name="location" label="位置"><Input /></Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={Object.entries(FACILITY_STATUS).map(([value, [label]]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="next_maintenance_at" label="下次保养时间">
            <Input placeholder="2026-12-31T09:00（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`保养登记 · ${maintainFor?.name ?? ""}`} open={!!maintainFor}
        onOk={maintain} onCancel={() => setMaintainFor(null)} destroyOnClose>
        <Form form={maintainForm} layout="vertical">
          <Form.Item name="content" label="保养内容" rules={[{ required: true, min: 2 }]}>
            <Input.TextArea rows={3} placeholder="如 更换润滑油、检查制动系统" />
          </Form.Item>
          <Typography.Text type="secondary">登记后自动更新上次/下次保养时间，并将设施状态置为正常。</Typography.Text>
        </Form>
      </Modal>

      <Modal title={`保养记录 · ${recordsFor?.name ?? ""}`} open={!!recordsFor}
        footer={null} onCancel={() => setRecordsFor(null)} width={640}>
        <Table rowKey="id" size="small" dataSource={records} pagination={false}
          columns={[
            { title: "时间", dataIndex: "maintained_at" },
            { title: "内容", dataIndex: "content" },
            { title: "操作人", dataIndex: "operator" },
          ]} />
      </Modal>
    </Page>
  );
}

export function Inspections() {
  const { can } = useAuth();
  const { data: points, loading, reload } = useList<InspectionPoint>("/inspection-points");
  const { data: records, reload: reloadRecords } = useList<InspectionRecord>("/inspection-records");
  const [pointOpen, setPointOpen] = useState(false);
  const [editing, setEditing] = useState<InspectionPoint | null>(null);
  const [checkOpen, setCheckOpen] = useState(false);
  const [pointForm] = Form.useForm();
  const [checkForm] = Form.useForm();

  const openPoint = (p?: InspectionPoint) => {
    setEditing(p ?? null);
    pointForm.setFieldsValue(p ?? { enabled: true });
    setPointOpen(true);
  };
  const savePoint = async () => {
    const v = await pointForm.validateFields();
    try {
      if (editing) await api.patch(`/inspection-points/${editing.id}`, v);
      else await api.post("/inspection-points", v);
      message.success("巡检点已保存");
      setPointOpen(false);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };
  const removePoint = async (id: number) => {
    try { await api.delete(`/inspection-points/${id}`); message.success("已删除"); reload(); }
    catch (e) { message.error(errMsg(e)); }
  };
  const checkIn = async () => {
    const v = await checkForm.validateFields();
    try {
      await api.post("/inspection-records", v);
      message.success("打卡成功");
      setCheckOpen(false);
      reloadRecords();
    } catch (e) { message.error(errMsg(e)); }
  };

  const pointCols: ColumnsType<InspectionPoint> = [
    { title: "巡检点", dataIndex: "name" },
    { title: "位置", render: (_, p) => p.location ?? "—" },
    { title: "巡检码", render: (_, p) => <Tag>{p.qr_code}</Tag> },
    { title: "状态", render: (_, p) => p.enabled ? <Tag color="green">启用</Tag> : <Tag>停用</Tag> },
    {
      title: "操作", render: (_, p) => can("inspection:write") && (
        <Space>
          <Button size="small" onClick={() => openPoint(p)}>编辑</Button>
          <Popconfirm title="确认删除该巡检点？" onConfirm={() => removePoint(p.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
  const recordCols: ColumnsType<InspectionRecord> = [
    { title: "打卡时间", dataIndex: "created_at" },
    { title: "巡检点", dataIndex: "point_name" },
    { title: "位置", render: (_, r) => r.location ?? "—" },
    { title: "巡检人", dataIndex: "inspector" },
    { title: "结果", render: (_, r) => tag(INSPECTION_RESULT, r.result) },
    { title: "备注", render: (_, r) => r.note ?? "—" },
  ];

  return (
    <Page title="巡检管理" extra={<>
      {can("inspection:write") && <Button onClick={() => { setCheckOpen(true); checkForm.setFieldsValue({ point_id: points[0]?.id, result: "normal" }); }}>巡检打卡</Button>}
      {can("inspection:write") && <Button type="primary" onClick={() => openPoint()}>新增巡检点</Button>}
    </>}>
      <Card title="巡检点位" style={{ marginBottom: 16 }}>
        <Table rowKey="id" columns={pointCols} dataSource={points} loading={loading} pagination={false} size="small" />
      </Card>
      <Card title="打卡记录">
        <Table rowKey="id" columns={recordCols} dataSource={records} pagination={{ pageSize: 10 }} size="small" />
      </Card>

      <Modal title={editing ? "编辑巡检点" : "新增巡检点"} open={pointOpen}
        onOk={savePoint} onCancel={() => setPointOpen(false)} destroyOnClose>
        <Form form={pointForm} layout="vertical">
          <Form.Item name="name" label="巡检点名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="location" label="位置"><Input /></Form.Item>
          <Form.Item name="qr_code" label="巡检码" rules={[{ required: true }]}>
            <Input placeholder="如 QR-LOBBY-01" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="enabled" label="启用">
            <Select options={[{ value: true, label: "启用" }, { value: false, label: "停用" }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="巡检打卡" open={checkOpen} onOk={checkIn}
        onCancel={() => setCheckOpen(false)} destroyOnClose>
        <Form form={checkForm} layout="vertical">
          <Form.Item name="point_id" label="巡检点" rules={[{ required: true }]}>
            <Select options={points.filter((p) => p.enabled).map((p) => ({ value: p.id, label: p.name }))} />
          </Form.Item>
          <Form.Item name="result" label="巡检结果" rules={[{ required: true }]}>
            <Select options={Object.entries(INSPECTION_RESULT).map(([value, [label]]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="note" label="备注"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </Page>
  );
}
