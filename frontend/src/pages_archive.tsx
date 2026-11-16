import { useEffect, useState } from "react";
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space,
  Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { SPACE_STATUS, SPACE_TYPE, api, errMsg, yuan,
  type Building, type CommunityInfo, type FamilyMember, type Owner, type ParkingSpace,
  type Unit } from "./api";
import { useAuth } from "./auth";
import { Page, tag, useList } from "./pages";

export function Community() {
  const { can } = useAuth();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get<CommunityInfo>("/community").then((r) => form.setFieldsValue(r.data))
      .catch((e) => message.error(errMsg(e)));
  }, [form]);

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await api.put("/community", v);
      message.success("小区信息已保存");
    } catch (e) { message.error(errMsg(e)); } finally { setSaving(false); }
  };

  return (
    <Page title="小区信息" extra={can("archive:write") && <Button type="primary" loading={saving} onClick={save}>保存</Button>}>
      <Card>
        <Form form={form} layout="vertical" disabled={!can("archive:write")} style={{ maxWidth: 520 }}>
          <Form.Item name="name" label="小区名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="address" label="详细地址"><Input /></Form.Item>
          <Form.Item name="contact_name" label="物业联系人"><Input /></Form.Item>
          <Form.Item name="contact_phone" label="联系电话"><Input /></Form.Item>
        </Form>
      </Card>
    </Page>
  );
}

export function Buildings() {
  const { can } = useAuth();
  const { data: buildings, loading, reload } = useList<Building>("/buildings");
  const { data: units, loading: unitLoading, reload: reloadUnits } = useList<Unit>("/units");
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [buildingForm] = Form.useForm();
  const [unitForm] = Form.useForm();

  const openBuilding = (b?: Building) => {
    setEditingBuilding(b ?? null);
    buildingForm.setFieldsValue(b ?? { floors: 18 });
    setBuildingOpen(true);
  };
  const saveBuilding = async () => {
    const v = await buildingForm.validateFields();
    try {
      if (editingBuilding) await api.patch(`/buildings/${editingBuilding.id}`, v);
      else await api.post("/buildings", v);
      message.success("楼栋已保存");
      setBuildingOpen(false);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };
  const removeBuilding = async (id: number) => {
    try { await api.delete(`/buildings/${id}`); message.success("已删除"); reload(); }
    catch (e) { message.error(errMsg(e)); }
  };

  const openUnit = (u?: Unit) => {
    setEditingUnit(u ?? null);
    unitForm.setFieldsValue(u ?? { building_id: buildings[0]?.id, name: "1单元" });
    setUnitOpen(true);
  };
  const saveUnit = async () => {
    const v = await unitForm.validateFields();
    try {
      if (editingUnit) await api.patch(`/units/${editingUnit.id}`, v);
      else await api.post("/units", v);
      message.success("单元已保存");
      setUnitOpen(false);
      reloadUnits();
    } catch (e) { message.error(errMsg(e)); }
  };
  const removeUnit = async (id: number) => {
    try { await api.delete(`/units/${id}`); message.success("已删除"); reloadUnits(); }
    catch (e) { message.error(errMsg(e)); }
  };

  const buildingCols: ColumnsType<Building> = [
    { title: "楼栋名称", dataIndex: "name" },
    { title: "楼层数", dataIndex: "floors", align: "right" },
    {
      title: "操作", render: (_, b) => can("archive:write") && (
        <Space>
          <Button size="small" onClick={() => openBuilding(b)}>编辑</Button>
          <Popconfirm title="确认删除该楼栋？" onConfirm={() => removeBuilding(b.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
  const unitCols: ColumnsType<Unit> = [
    { title: "楼栋", dataIndex: "building_name" },
    { title: "单元", dataIndex: "name" },
    {
      title: "操作", render: (_, u) => can("archive:write") && (
        <Space>
          <Button size="small" onClick={() => openUnit(u)}>编辑</Button>
          <Popconfirm title="确认删除该单元？" onConfirm={() => removeUnit(u.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Page title="楼栋与单元">
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title="楼栋" extra={can("archive:write") && <Button type="primary" size="small" onClick={() => openBuilding()}>新增楼栋</Button>}>
            <Table rowKey="id" columns={buildingCols} dataSource={buildings} loading={loading} pagination={false} size="small" />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="单元" extra={can("archive:write") && <Button type="primary" size="small" onClick={() => openUnit()}>新增单元</Button>}>
            <Table rowKey="id" columns={unitCols} dataSource={units} loading={unitLoading} pagination={false} size="small" />
          </Card>
        </Col>
      </Row>

      <Modal title={editingBuilding ? "编辑楼栋" : "新增楼栋"} open={buildingOpen}
        onOk={saveBuilding} onCancel={() => setBuildingOpen(false)} destroyOnClose>
        <Form form={buildingForm} layout="vertical">
          <Form.Item name="name" label="楼栋名称" rules={[{ required: true }]}><Input placeholder="如 3号楼" /></Form.Item>
          <Form.Item name="floors" label="楼层数" rules={[{ required: true }]}><InputNumber min={1} max={200} style={{ width: "100%" }} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={editingUnit ? "编辑单元" : "新增单元"} open={unitOpen}
        onOk={saveUnit} onCancel={() => setUnitOpen(false)} destroyOnClose>
        <Form form={unitForm} layout="vertical">
          <Form.Item name="building_id" label="所属楼栋" rules={[{ required: true }]}>
            <Select options={buildings.map((b) => ({ value: b.id, label: b.name }))} />
          </Form.Item>
          <Form.Item name="name" label="单元名称" rules={[{ required: true }]}><Input placeholder="如 1单元" /></Form.Item>
        </Form>
      </Modal>
    </Page>
  );
}

export function FamilyMembers() {
  const { can } = useAuth();
  const { data: owners } = useList<Owner>("/owners");
  const { data, loading, reload } = useList<FamilyMember>("/family-members");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyMember | null>(null);
  const [form] = Form.useForm();

  const openForm = (f?: FamilyMember) => {
    setEditing(f ?? null);
    form.setFieldsValue(f ?? { owner_id: owners[0]?.id, relation: "家属" });
    setOpen(true);
  };
  const save = async () => {
    const v = await form.validateFields();
    try {
      if (editing) await api.patch(`/family-members/${editing.id}`, v);
      else await api.post("/family-members", v);
      message.success("成员已保存");
      setOpen(false);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };
  const remove = async (id: number) => {
    try { await api.delete(`/family-members/${id}`); message.success("已删除"); reload(); }
    catch (e) { message.error(errMsg(e)); }
  };

  const columns: ColumnsType<FamilyMember> = [
    { title: "业主", dataIndex: "owner_name" },
    { title: "成员姓名", dataIndex: "name" },
    { title: "关系", dataIndex: "relation" },
    { title: "联系电话", render: (_, f) => f.phone ?? "—" },
    {
      title: "操作", render: (_, f) => can("house:write") && (
        <Space>
          <Button size="small" onClick={() => openForm(f)}>编辑</Button>
          <Popconfirm title="确认删除该成员？" onConfirm={() => remove(f.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Page title="家庭成员" extra={can("house:write") && <Button type="primary" onClick={() => openForm()}>新增成员</Button>}>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={{ pageSize: 20 }} />
      <Modal title={editing ? "编辑成员" : "新增成员"} open={open}
        onOk={save} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          {!editing && (
            <Form.Item name="owner_id" label="所属业主" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label"
                options={owners.map((o) => ({ value: o.id, label: `${o.name}（${o.phone}）` }))} />
            </Form.Item>
          )}
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="relation" label="与业主关系"><Input placeholder="配偶 / 子女 / 父母" /></Form.Item>
          <Form.Item name="phone" label="联系电话"><Input /></Form.Item>
        </Form>
      </Modal>
    </Page>
  );
}

export function ParkingSpaces() {
  const { can } = useAuth();
  const { data: buildings } = useList<Building>("/buildings");
  const { data, loading, reload } = useList<ParkingSpace>("/parking-spaces");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ParkingSpace | null>(null);
  const [renewFor, setRenewFor] = useState<ParkingSpace | null>(null);
  const [form] = Form.useForm();
  const [renewForm] = Form.useForm();

  const openForm = (s?: ParkingSpace) => {
    setEditing(s ?? null);
    form.setFieldsValue(s ? { ...s, monthly_fee: s.monthly_fee_cents / 100 }
      : { space_type: "fixed", status: "free", monthly_fee: 300 });
    setOpen(true);
  };
  const save = async () => {
    const v = await form.validateFields();
    const body = {
      code: v.code, building_id: v.building_id, space_type: v.space_type, status: v.status,
      plate_no: v.plate_no, owner_name: v.owner_name,
      monthly_fee_cents: Math.round((v.monthly_fee ?? 0) * 100),
      expire_date: v.expire_date ? `${v.expire_date}T00:00:00` : null,
    };
    try {
      if (editing) await api.patch(`/parking-spaces/${editing.id}`, body);
      else await api.post("/parking-spaces", body);
      message.success("车位已保存");
      setOpen(false);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };
  const remove = async (id: number) => {
    try { await api.delete(`/parking-spaces/${id}`); message.success("已删除"); reload(); }
    catch (e) { message.error(errMsg(e)); }
  };
  const renew = async () => {
    if (!renewFor) return;
    const v = await renewForm.validateFields();
    try {
      const { data: r } = await api.post(`/parking-spaces/${renewFor.id}/renew`, { months: v.months });
      message.success(`续费成功，到期日 ${r.expire_date}，应收 ${yuan(r.amount_cents)}`);
      setRenewFor(null);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };

  const columns: ColumnsType<ParkingSpace> = [
    { title: "车位编号", dataIndex: "code" },
    { title: "楼栋", render: (_, s) => s.building_name ?? "—" },
    { title: "类型", render: (_, s) => SPACE_TYPE[s.space_type] ?? s.space_type },
    { title: "状态", render: (_, s) => tag(SPACE_STATUS, s.status) },
    { title: "车牌", render: (_, s) => s.plate_no ?? "—" },
    { title: "使用人", render: (_, s) => s.owner_name ?? "—" },
    { title: "月租", align: "right", render: (_, s) => yuan(s.monthly_fee_cents) },
    { title: "到期日", render: (_, s) => s.expire_date ?? "—" },
    {
      title: "操作", render: (_, s) => (
        <Space>
          {can("parking:write") && <Button size="small" onClick={() => { setRenewFor(s); renewForm.setFieldsValue({ months: 12 }); }}>续费</Button>}
          {can("archive:write") && <Button size="small" onClick={() => openForm(s)}>编辑</Button>}
          {can("archive:write") && (
            <Popconfirm title="确认删除该车位？" onConfirm={() => remove(s.id)}>
              <Button size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Page title="车位档案" extra={can("archive:write") && <Button type="primary" onClick={() => openForm()}>新增车位</Button>}>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={{ pageSize: 20 }} />

      <Modal title={editing ? "编辑车位" : "新增车位"} open={open}
        onOk={save} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="车位编号" rules={[{ required: true }]}><Input placeholder="如 A-011" /></Form.Item>
          <Form.Item name="building_id" label="所属楼栋">
            <Select allowClear options={buildings.map((b) => ({ value: b.id, label: b.name }))} />
          </Form.Item>
          <Form.Item name="space_type" label="车位类型">
            <Select options={Object.entries(SPACE_TYPE).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={Object.entries(SPACE_STATUS).map(([value, [label]]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="plate_no" label="车牌号"><Input /></Form.Item>
          <Form.Item name="owner_name" label="使用人"><Input /></Form.Item>
          <Form.Item name="monthly_fee" label="月租 (元)"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="expire_date" label="到期日 (YYYY-MM-DD)"><Input placeholder="2027-12-31" /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`月卡续费 · ${renewFor?.code ?? ""}`} open={!!renewFor}
        onOk={renew} onCancel={() => setRenewFor(null)} destroyOnClose>
        <Form form={renewForm} layout="vertical">
          <Form.Item name="months" label="续费月数" rules={[{ required: true }]}>
            <InputNumber min={1} max={24} style={{ width: "100%" }} />
          </Form.Item>
          <Typography.Text type="secondary">月租 {yuan(renewFor?.monthly_fee_cents ?? 0)} / 月</Typography.Text>
        </Form>
      </Modal>
    </Page>
  );
}
