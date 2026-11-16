import { useState } from "react";
import { Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tabs, Tag,
  message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ROLE_LABEL, api, errMsg, type LogRow, type RoleInfo, type UserRow } from "./api";
import { useAuth } from "./auth";
import { Page, useList } from "./pages";

function UsersTab() {
  const { user } = useAuth();
  const { data, loading, reload } = useList<UserRow>("/users");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form] = Form.useForm();

  const openForm = (u?: UserRow) => {
    setEditing(u ?? null);
    form.setFieldsValue(u ? { ...u, password: undefined } : { role: "cashier", is_active: true });
    setOpen(true);
  };
  const save = async () => {
    const v = await form.validateFields();
    try {
      if (editing) {
        await api.patch(`/users/${editing.id}`, {
          real_name: v.real_name, role: v.role, is_active: v.is_active,
          password: v.password || undefined,
        });
      } else {
        await api.post("/users", v);
      }
      message.success("用户已保存");
      setOpen(false);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };
  const remove = async (id: number) => {
    try { await api.delete(`/users/${id}`); message.success("已删除"); reload(); }
    catch (e) { message.error(errMsg(e)); }
  };

  const columns: ColumnsType<UserRow> = [
    { title: "账号", dataIndex: "username" },
    { title: "姓名", dataIndex: "real_name" },
    { title: "角色", render: (_, u) => <Tag color="blue">{ROLE_LABEL[u.role] ?? u.role}</Tag> },
    { title: "状态", render: (_, u) => u.is_active ? <Tag color="green">启用</Tag> : <Tag>停用</Tag> },
    {
      title: "操作", render: (_, u) => (
        <Space>
          <Button size="small" onClick={() => openForm(u)}>编辑</Button>
          {u.id !== user?.id && (
            <Popconfirm title="确认删除该用户？" onConfirm={() => remove(u.id)}>
              <Button size="small" danger>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="toolbar" style={{ justifyContent: "flex-end" }}>
        <Button type="primary" onClick={() => openForm()}>新增用户</Button>
      </div>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={false} />
      <Modal title={editing ? "编辑用户" : "新增用户"} open={open}
        onOk={save} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="登录账号" rules={editing ? [] : [{ required: true, min: 2 }]}>
            <Input disabled={!!editing} />
          </Form.Item>
          <Form.Item name="real_name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="password" label={editing ? "重置密码（留空不修改）" : "初始密码"}
            rules={editing ? [{ min: 6 }] : [{ required: true, min: 6 }]}>
            <Input.Password placeholder="至少 6 位" />
          </Form.Item>
          {editing && (
            <Form.Item name="is_active" label="启用账号" valuePropName="checked"><Switch /></Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}

function RolesTab() {
  const { data, loading } = useList<RoleInfo>("/roles");
  const columns: ColumnsType<RoleInfo> = [
    { title: "角色", render: (_, r) => <Tag color="blue">{r.label}</Tag>, width: 120 },
    { title: "角色标识", dataIndex: "role", width: 120 },
    {
      title: "权限点", render: (_, r) => (
        <Space wrap>{r.perms.map((p) => <Tag key={p}>{p === "*" ? "全部权限" : p}</Tag>)}</Space>
      ),
    },
  ];
  return <Table rowKey="role" columns={columns} dataSource={data} loading={loading} pagination={false} />;
}

export function Users() {
  return (
    <Page title="用户与角色">
      <Tabs items={[
        { key: "users", label: "用户管理", children: <UsersTab /> },
        { key: "roles", label: "角色权限", children: <RolesTab /> },
      ]} />
    </Page>
  );
}

export function Logs() {
  const [username, setUsername] = useState<string>();
  const [method, setMethod] = useState<string>();
  const { data, loading, reload } = useList<LogRow>("/logs", { username, method });

  const clear = async () => {
    try { await api.delete("/logs"); message.success("已清空他人日志"); reload(); }
    catch (e) { message.error(errMsg(e)); }
  };

  const columns: ColumnsType<LogRow> = [
    { title: "时间", dataIndex: "created_at" },
    { title: "用户", dataIndex: "username" },
    {
      title: "方法", dataIndex: "method",
      render: (v: string) => <Tag color={v === "DELETE" ? "red" : v === "POST" ? "blue" : "orange"}>{v}</Tag>,
    },
    { title: "接口", dataIndex: "path" },
    {
      title: "状态码", dataIndex: "status_code", align: "right",
      render: (v: number) => <Tag color={v < 400 ? "green" : "red"}>{v}</Tag>,
    },
    { title: "IP", render: (_, l) => l.ip ?? "—" },
  ];

  return (
    <Page title="操作日志" extra={<>
      <Input.Search allowClear placeholder="用户名" style={{ width: 160 }} onSearch={setUsername} />
      <Select allowClear placeholder="全部方法" style={{ width: 120 }} onChange={setMethod}
        options={["POST", "PATCH", "PUT", "DELETE"].map((m) => ({ value: m, label: m }))} />
      <Popconfirm title="确认清空其他用户的操作日志？" onConfirm={clear}>
        <Button danger>清空日志</Button>
      </Popconfirm>
    </>}>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={{ pageSize: 20 }} />
    </Page>
  );
}
