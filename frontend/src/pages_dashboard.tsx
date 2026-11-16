import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Card, Col, Row, Spin, Statistic, Tag, message } from "antd";
import {
  AlertOutlined, CarOutlined, CheckCircleOutlined, HomeOutlined,
  IdcardOutlined, PayCircleOutlined, RiseOutlined, ToolOutlined, WalletOutlined,
} from "@ant-design/icons";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { FEE, PAY_METHOD, api, errMsg, yuan,
  type ReportOverview, type Revenue, type TrendPoint } from "./api";
import { Page } from "./pages";

const COLORS = ["#26a69a", "#5b8ff9", "#f6bd16", "#e8684a", "#6dc8ec", "#9270ca"];

const moneyTick = (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : `${v}`);

function Kpi({ title, value, icon, color, bg, extra }: {
  title: string; value: string; icon: ReactNode; color: string; bg: string; extra?: string;
}) {
  return (
    <Card className="kpi-card">
      <div className="kpi-body">
        <div>
          <div className="kpi-title">{title}</div>
          <div className="kpi-value">{value}</div>
          {extra && <div className="kpi-extra">{extra}</div>}
        </div>
        <div className="kpi-icon" style={{ color, background: bg }}>{icon}</div>
      </div>
    </Card>
  );
}

export function Dashboard() {
  const [s, setS] = useState<ReportOverview | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [revenue, setRevenue] = useState<Revenue | null>(null);

  useEffect(() => {
    api.get<ReportOverview>("/reports/overview").then((r) => setS(r.data))
      .catch((e) => message.error(errMsg(e)));
    api.get<TrendPoint[]>("/reports/trend", { params: { months: 6 } })
      .then((r) => setTrend(r.data)).catch(() => setTrend([]));
    api.get<Revenue>("/reports/revenue").then((r) => setRevenue(r.data)).catch(() => {});
  }, []);

  const trendData = useMemo(() => trend.map((t) => ({
    period: t.period.slice(2),
    应收: Math.round(t.receivable_cents / 100),
    实收: Math.round(t.collected_cents / 100),
    欠费: Math.round(t.arrears_cents / 100),
  })), [trend]);

  const feeData = useMemo(() => (revenue?.by_fee_type ?? []).map((f) => ({
    name: f.name ?? FEE[f.fee_type] ?? f.fee_type,
    value: Math.round(f.amount_cents / 100),
  })), [revenue]);

  const methodData = useMemo(() => (revenue?.by_method ?? []).map((m) => ({
    name: PAY_METHOD[m.method] ?? m.method,
    value: Math.round(m.amount_cents / 100),
  })), [revenue]);

  if (!s) return <Spin />;
  const rate = s.receivable_cents > 0 ? (s.collected_cents / s.receivable_cents) * 100 : 0;
  const todos: [string, number, string][] = [
    ["待处理报修", s.open_repairs, s.open_repairs > 0 ? "orange" : "green"],
    ["待处理投诉", s.open_complaints, s.open_complaints > 0 ? "orange" : "green"],
    ["库存预警物料", s.low_stock, s.low_stock > 0 ? "red" : "green"],
    ["设施异常", s.facility_alerts, s.facility_alerts > 0 ? "red" : "green"],
  ];
  const miniStats: [string, number, ReactNode][] = [
    ["房屋总数", s.rooms, <HomeOutlined />],
    ["在用房屋", s.occupied, <IdcardOutlined />],
    ["今日访客", s.visitors_today, <CarOutlined />],
    ["今日巡检打卡", s.inspections_today, <CheckCircleOutlined />],
  ];

  return (
    <Page title={`${s.period} 运营概况`}>
      <Row className="dashboard-row" gutter={[16, 16]}>
        <Col xs={12} lg={6}>
          <Kpi title="本期应收" value={yuan(s.receivable_cents)} icon={<WalletOutlined />}
            color="#5b8ff9" bg="#eef4ff" extra={`未结清账单 ${s.arrears_count} 笔`} />
        </Col>
        <Col xs={12} lg={6}>
          <Kpi title="本期已收" value={yuan(s.collected_cents)} icon={<PayCircleOutlined />}
            color="#26a69a" bg="#e6f7f5" />
        </Col>
        <Col xs={12} lg={6}>
          <Kpi title="欠费金额" value={yuan(s.arrears_cents)} icon={<AlertOutlined />}
            color="#e8684a" bg="#fdece7" />
        </Col>
        <Col xs={12} lg={6}>
          <Kpi title="本期收缴率" value={`${rate.toFixed(1)}%`} icon={<RiseOutlined />}
            color="#f6bd16" bg="#fdf6e3" extra="已收 / 应收" />
        </Col>
      </Row>

      <Row className="dashboard-row" gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="近 6 个月收费趋势（元）">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trendData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f3" />
                <XAxis dataKey="period" tickLine={false} />
                <YAxis tickFormatter={moneyTick} tickLine={false} axisLine={false} width={56} />
                <Tooltip formatter={(v) => [`¥${Number(v).toLocaleString()}`, undefined]} />
                <Legend />
                <Bar dataKey="应收" fill="#c6d4e8" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="实收" fill="#26a69a" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="欠费" fill="#e8684a" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="本期费用构成（元）">
            {feeData.length === 0 ? <div className="chart-empty">本期暂无账单</div> : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={feeData} dataKey="value" nameKey="name" innerRadius={60}
                    outerRadius={100} paddingAngle={2}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {feeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`¥${Number(v).toLocaleString()}`, undefined]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      <Row className="dashboard-row" gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={10}>
          <Card title="本期收款方式（元）">
            {methodData.length === 0 ? <div className="chart-empty">本期暂无收款记录</div> : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={methodData} dataKey="value" nameKey="name" outerRadius={95}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {methodData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`¥${Number(v).toLocaleString()}`, undefined]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="运营待办">
            <Row gutter={[16, 16]}>
              {todos.map(([name, count, color]) => (
                <Col span={12} key={name}>
                  <div className="todo-item">
                    <ToolOutlined style={{ color: "#8c8c8c" }} />
                    <span>{name}</span>
                    <Tag color={color}>{count}</Tag>
                  </div>
                </Col>
              ))}
            </Row>
            <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
              {miniStats.map(([name, value, icon]) => (
                <Col xs={12} md={6} key={name}>
                  <Statistic title={<>{icon} {name}</>} value={value} />
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </Page>
  );
}
