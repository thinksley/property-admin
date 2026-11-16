import { useState } from "react";
import { Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography,
  message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ANNOUNCEMENT_CATEGORY, ANNOUNCEMENT_STATUS, COMPLAINT_STATUS, VISITOR_STATUS, api,
  errMsg, type Announcement, type Complaint, type Room, type Visitor } from "./api";
import { useAuth } from "./auth";
import { Page, tag, useList } from "./pages";

export function Visitors() {
  const { can } = useAuth();
  const [status, setStatus] = useState<string>();
  const { data, loading, reload } = useList<Visitor>("/visitors", { status });
  const { data: rooms } = useList<Room>("/rooms");
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const create = async () => {
    const v = await form.validateFields();
    try {
      await api.post("/visitors", {
        ...v,
        visit_at: v.visit_at ? `${v.visit_at}:00` : undefined,
      });
      message.success("访客预约已登记");
      setOpen(false);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };
  const move = async (id: number, value: string) => {
    try { await api.post(`/visitors/${id}/status`, { status: value }); message.success("状态已更新"); reload(); }
    catch (e) { message.error(errMsg(e)); }
  };
  const remove = async (id: number) => {
    try { await api.delete(`/visitors/${id}`); message.success("已删除"); reload(); }
    catch (e) { message.error(errMsg(e)); }
  };

  const actions = (v: Visitor) => {
    if (!can("visitor:write")) return null;
    return (
      <Space>
        {v.status === "pending" && <>
          <Button size="small" type="primary" onClick={() => move(v.id, "approved")}>通过</Button>
          <Button size="small" danger onClick={() => move(v.id, "rejected")}>拒绝</Button>
        </>}
        {v.status === "approved" && <Button size="small" onClick={() => move(v.id, "checked_in")}>入场</Button>}
        {v.status === "checked_in" && <Button size="small" onClick={() => move(v.id, "checked_out")}>离场</Button>}
        <Popconfirm title="确认删除该访客记录？" onConfirm={() => remove(v.id)}>
          <Button size="small" danger>删除</Button>
        </Popconfirm>
      </Space>
    );
  };

  const columns: ColumnsType<Visitor> = [
    { title: "访客", dataIndex: "name" },
    { title: "电话", dataIndex: "phone" },
    { title: "拜访房屋", render: (_, v) => v.room_no ? `${v.building_name} ${v.room_no}` : "—" },
    { title: "被访人", render: (_, v) => v.host_name ?? "—" },
    { title: "来访时间", dataIndex: "visit_at" },
    { title: "事由", render: (_, v) => v.purpose ?? "—" },
    { title: "通行码", render: (_, v) => <Tag color="blue">{v.pass_code}</Tag> },
    { title: "状态", render: (_, v) => tag(VISITOR_STATUS, v.status) },
    { title: "操作", render: (_, v) => actions(v) },
  ];

  return (
    <Page title="访客登记" extra={can("visitor:write") && <Button type="primary" onClick={() => setOpen(true)}>登记访客</Button>}>
      <div className="toolbar">
        <Select allowClear placeholder="全部状态" style={{ width: 140 }} onChange={setStatus}
          options={Object.entries(VISITOR_STATUS).map(([value, [label]]) => ({ value, label }))} />
      </div>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={{ pageSize: 20 }} />
      <Modal title="登记访客" open={open} onOk={create} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="访客姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="phone" label="联系电话" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="room_id" label="拜访房屋">
            <Select allowClear showSearch optionFilterProp="label"
              options={rooms.map((r) => ({ value: r.id, label: `${r.building_name} ${r.room_no}` }))} />
          </Form.Item>
          <Form.Item name="host_name" label="被访人"><Input /></Form.Item>
          <Form.Item name="purpose" label="来访事由"><Input placeholder="探亲 / 送快递 / 维修" /></Form.Item>
          <Form.Item name="visit_at" label="来访时间">
            <Input placeholder="2026-11-13T14:30（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </Page>
  );
}

const COMPLAINT_CATEGORIES = ["噪音", "卫生", "服务态度", "公共设施", "停车", "其他"];

export function Complaints() {
  const { can } = useAuth();
  const [status, setStatus] = useState<string>();
  const { data, loading, reload } = useList<Complaint>("/complaints", { status });
  const { data: rooms } = useList<Room>("/rooms");
  const [createOpen, setCreateOpen] = useState(false);
  const [handleFor, setHandleFor] = useState<Complaint | null>(null);
  const [createForm] = Form.useForm();
  const [handleForm] = Form.useForm();

  const create = async () => {
    const v = await createForm.validateFields();
    try {
      await api.post("/complaints", v);
      message.success("投诉已登记");
      setCreateOpen(false);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };
  const handle = async () => {
    if (!handleFor) return;
    const v = await handleForm.validateFields();
    try {
      await api.post(`/complaints/${handleFor.id}/handle`, v);
      message.success("投诉已处理");
      setHandleFor(null);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };
  const remove = async (id: number) => {
    try { await api.delete(`/complaints/${id}`); message.success("已删除"); reload(); }
    catch (e) { message.error(errMsg(e)); }
  };

  const columns: ColumnsType<Complaint> = [
    { title: "登记时间", dataIndex: "created_at" },
    { title: "投诉人", dataIndex: "owner_name" },
    { title: "房屋", render: (_, c) => c.room_no ? `${c.building_name} ${c.room_no}` : "—" },
    { title: "类别", dataIndex: "category" },
    { title: "内容", dataIndex: "content", ellipsis: true },
    { title: "状态", render: (_, c) => tag(COMPLAINT_STATUS, c.status) },
    { title: "处理人", render: (_, c) => c.handler ?? "—" },
    { title: "回复", render: (_, c) => c.reply ?? "—", ellipsis: true },
    {
      title: "操作", render: (_, c) => can("complaint:write") && (
        <Space>
          <Button size="small" onClick={() => {
            setHandleFor(c);
            handleForm.setFieldsValue({ status: "processing", reply: c.reply, follow_up: c.follow_up });
          }}>处理</Button>
          <Popconfirm title="确认删除该投诉？" onConfirm={() => remove(c.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Page title="投诉建议" extra={<>
      <Select allowClear placeholder="全部状态" style={{ width: 130 }} onChange={setStatus}
        options={Object.entries(COMPLAINT_STATUS).map(([value, [label]]) => ({ value, label }))} />
      {can("complaint:write") && <Button type="primary" onClick={() => setCreateOpen(true)}>登记投诉</Button>}
    </>}>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={{ pageSize: 20 }} />

      <Modal title="登记投诉" open={createOpen} onOk={create} onCancel={() => setCreateOpen(false)} destroyOnClose>
        <Form form={createForm} layout="vertical" initialValues={{ category: "其他" }}>
          <Form.Item name="owner_name" label="投诉人" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="phone" label="联系电话"><Input /></Form.Item>
          <Form.Item name="room_id" label="关联房屋">
            <Select allowClear showSearch optionFilterProp="label"
              options={rooms.map((r) => ({ value: r.id, label: `${r.building_name} ${r.room_no}` }))} />
          </Form.Item>
          <Form.Item name="category" label="类别">
            <Select options={COMPLAINT_CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="content" label="投诉内容" rules={[{ required: true, min: 2 }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="处理投诉" open={!!handleFor} onOk={handle} onCancel={() => setHandleFor(null)} destroyOnClose>
        <Form form={handleForm} layout="vertical">
          <Form.Item name="status" label="处理状态" rules={[{ required: true }]}>
            <Select options={[
              { value: "processing", label: "处理中" },
              { value: "resolved", label: "已解决" },
              { value: "closed", label: "已关闭" },
            ]} />
          </Form.Item>
          <Form.Item name="reply" label="回复业主"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="follow_up" label="回访记录"><Input placeholder="如 已电话回访，业主满意" /></Form.Item>
        </Form>
      </Modal>
    </Page>
  );
}

export function Announcements() {
  const { can } = useAuth();
  const [status, setStatus] = useState<string>();
  const { data, loading, reload } = useList<Announcement>("/announcements", { status });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form] = Form.useForm();

  const openForm = (a?: Announcement) => {
    setEditing(a ?? null);
    form.setFieldsValue(a ?? { category: "notice" });
    setOpen(true);
  };
  const save = async () => {
    const v = await form.validateFields();
    try {
      if (editing) await api.patch(`/announcements/${editing.id}`, v);
      else await api.post("/announcements", v);
      message.success("公告已保存");
      setOpen(false);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };
  const publish = async (id: number, push: boolean) => {
    try {
      await api.post(`/announcements/${id}/publish?push=${push}`);
      message.success(push ? "已发布并推送" : "已发布");
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };
  const remove = async (id: number) => {
    try { await api.delete(`/announcements/${id}`); message.success("已删除"); reload(); }
    catch (e) { message.error(errMsg(e)); }
  };

  const columns: ColumnsType<Announcement> = [
    { title: "标题", dataIndex: "title" },
    { title: "分类", render: (_, a) => ANNOUNCEMENT_CATEGORY[a.category] ?? a.category },
    { title: "内容", dataIndex: "content", ellipsis: true },
    { title: "状态", render: (_, a) => tag(ANNOUNCEMENT_STATUS, a.status) },
    { title: "发布时间", render: (_, a) => a.published_at ?? "—" },
    { title: "推送时间", render: (_, a) => a.pushed_at ?? "—" },
    {
      title: "操作", render: (_, a) => can("notice:write") && (
        <Space>
          <Button size="small" onClick={() => openForm(a)}>编辑</Button>
          {a.status === "draft" && <Button size="small" type="primary" onClick={() => publish(a.id, false)}>发布</Button>}
          {!a.pushed_at && <Button size="small" onClick={() => publish(a.id, true)}>推送</Button>}
          <Popconfirm title="确认删除该公告？" onConfirm={() => remove(a.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Page title="通知公告" extra={<>
      <Select allowClear placeholder="全部状态" style={{ width: 120 }} onChange={setStatus}
        options={Object.entries(ANNOUNCEMENT_STATUS).map(([value, [label]]) => ({ value, label }))} />
      {can("notice:write") && <Button type="primary" onClick={() => openForm()}>新建公告</Button>}
    </>}>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={{ pageSize: 20 }} />
      <Modal title={editing ? "编辑公告" : "新建公告"} open={open}
        onOk={save} onCancel={() => setOpen(false)} destroyOnClose width={620}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}>
            <Select options={Object.entries(ANNOUNCEMENT_CATEGORY).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="content" label="正文" rules={[{ required: true, min: 2 }]}>
            <Input.TextArea rows={6} />
          </Form.Item>
          <Typography.Text type="secondary">保存后为草稿，可在列表点击「发布」或「推送」。</Typography.Text>
        </Form>
      </Modal>
    </Page>
  );
}
