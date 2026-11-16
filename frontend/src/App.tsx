import { useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Button, Card, Form, Input, Layout, Menu, Space, Spin, Typography, message } from "antd";
import type { MenuProps } from "antd";
import { errMsg } from "./api";
import { useAuth } from "./auth";
import { Bills, Dashboard, Owners, Repairs, Rooms } from "./pages";
import { Buildings, Community, FamilyMembers, ParkingSpaces } from "./pages_archive";
import { FeeItems, Payments } from "./pages_fee";
import { Announcements, Complaints, Visitors } from "./pages_service";
import { ParkingRecords } from "./pages_parking";
import { Facilities, Inspections, Materials } from "./pages_asset";
import { Logs, Users } from "./pages_system";
import { Arrears, Reports } from "./pages_report";

interface NavNode {
  key: string;
  label: string;
  perm?: string;
  children?: NavNode[];
}

const NAV: NavNode[] = [
  { key: "/", label: "总览", perm: "dashboard:read" },
  {
    key: "archive", label: "基础档案", children: [
      { key: "/community", label: "小区信息", perm: "archive:read" },
      { key: "/buildings", label: "楼栋单元", perm: "archive:read" },
      { key: "/rooms", label: "房屋档案", perm: "house:read" },
      { key: "/owners", label: "业主信息", perm: "house:read" },
      { key: "/family", label: "家庭成员", perm: "house:read" },
      { key: "/parking-spaces", label: "车位档案", perm: "archive:read" },
    ],
  },
  {
    key: "fee", label: "收费管理", children: [
      { key: "/fee-items", label: "收费项目", perm: "fee:read" },
      { key: "/bills", label: "账单管理", perm: "bill:read" },
      { key: "/payments", label: "缴费记录", perm: "bill:read" },
    ],
  },
  { key: "/repairs", label: "报修工单", perm: "repair:read" },
  {
    key: "community", label: "社区服务", children: [
      { key: "/visitors", label: "访客登记", perm: "visitor:read" },
      { key: "/complaints", label: "投诉建议", perm: "complaint:read" },
      { key: "/announcements", label: "通知公告", perm: "notice:read" },
    ],
  },
  { key: "/parking-records", label: "停车管理", perm: "parking:read" },
  {
    key: "asset", label: "资产巡检", children: [
      { key: "/materials", label: "物料库存", perm: "asset:read" },
      { key: "/facilities", label: "公共设施", perm: "asset:read" },
      { key: "/inspections", label: "巡检管理", perm: "inspection:read" },
    ],
  },
  {
    key: "report", label: "财务报表", children: [
      { key: "/reports", label: "营收统计", perm: "report:read" },
      { key: "/arrears", label: "欠费台账", perm: "report:read" },
    ],
  },
  {
    key: "system", label: "系统管理", children: [
      { key: "/users", label: "用户角色", perm: "system:read" },
      { key: "/logs", label: "操作日志", perm: "system:read" },
    ],
  },
];

function Shell() {
  const { user, can, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();

  const buildMenu = (nodes: NavNode[]): MenuProps["items"] =>
    nodes.reduce<NonNullable<MenuProps["items"]>>((acc, n) => {
      if (n.children) {
        const children = buildMenu(n.children) as NonNullable<MenuProps["items"]>;
        if (children.length) acc.push({ key: n.key, label: n.label, children });
      } else if (!n.perm || can(n.perm)) {
        acc.push({ key: n.key, label: n.label });
      }
      return acc;
    }, []);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Sider width={216}>
        <div className="brand">物业管理</div>
        <Menu theme="dark" mode="inline" selectedKeys={[pathname]} onClick={({ key }) => nav(key)}
          defaultOpenKeys={["archive"]}
          items={buildMenu(NAV)} />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="topbar">
          <Space>
            <Typography.Text>{user?.real_name}</Typography.Text>
            <Button size="small" onClick={() => { logout(); nav("/login"); }}>退出登录</Button>
          </Space>
        </Layout.Header>
        <Layout.Content className="content"><Outlet /></Layout.Content>
      </Layout>
    </Layout>
  );
}

function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const onFinish = async (v: { username: string; password: string }) => {
    setBusy(true);
    try {
      await login(v.username, v.password);
      nav("/");
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login">
      <Card title="物业管理后台" style={{ width: 360 }}>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" rules={[{ required: true, message: "请输入账号" }]}>
            <Input placeholder="账号" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password placeholder="密码" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={busy}>登录</Button>
        </Form>
      </Card>
    </div>
  );
}

function Home() {
  const { can } = useAuth();
  return can("dashboard:read") ? <Dashboard /> : <Navigate to="/repairs" replace />;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spin fullscreen />;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={user ? <Shell /> : <Navigate to="/login" replace />}>
        <Route index element={<Home />} />
        <Route path="community" element={<Community />} />
        <Route path="buildings" element={<Buildings />} />
        <Route path="rooms" element={<Rooms />} />
        <Route path="owners" element={<Owners />} />
        <Route path="family" element={<FamilyMembers />} />
        <Route path="parking-spaces" element={<ParkingSpaces />} />
        <Route path="fee-items" element={<FeeItems />} />
        <Route path="bills" element={<Bills />} />
        <Route path="payments" element={<Payments />} />
        <Route path="repairs" element={<Repairs />} />
        <Route path="visitors" element={<Visitors />} />
        <Route path="complaints" element={<Complaints />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="parking-records" element={<ParkingRecords />} />
        <Route path="materials" element={<Materials />} />
        <Route path="facilities" element={<Facilities />} />
        <Route path="inspections" element={<Inspections />} />
        <Route path="reports" element={<Reports />} />
        <Route path="arrears" element={<Arrears />} />
        <Route path="users" element={<Users />} />
        <Route path="logs" element={<Logs />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
