import { useEffect, useState } from "react";
import { Button, Card, Col, Input, Row, Statistic, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FEE, api, download, errMsg, yuan, type ArrearsBill, type IncomeExpense,
  type ReportOverview, type Revenue } from "./api";
import { Page, useList } from "./pages";

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function Reports() {
  const [period, setPeriod] = useState(currentPeriod());
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [ie, setIe] = useState<IncomeExpense | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<ReportOverview>("/reports/overview", { params: { period } }),
      api.get<Revenue>("/reports/revenue", { params: { period } }),
      api.get<IncomeExpense>("/reports/income-expense", { params: { period } }),
    ]).then(([a, b, c]) => { setOverview(a.data); setRevenue(b.data); setIe(c.data); })
      .catch((e) => message.error(errMsg(e)));
  }, [period]);

  const feeCols: ColumnsType<Revenue["by_fee_type"][number]> = [
    { title: "费用类型", render: (_, r) => r.name ?? FEE[r.fee_type] ?? r.fee_type },
    { title: "账单数", dataIndex: "count", align: "right" },
    { title: "应收", align: "right", render: (_, r) => yuan(r.amount_cents) },
    { title: "已收", align: "right", render: (_, r) => yuan(r.paid_cents) },
    { title: "滞纳金", align: "right", render: (_, r) => yuan(r.late_fee_cents) },
  ];
  const methodCols: ColumnsType<Revenue["by_method"][number]> = [
    { title: "支付方式", dataIndex: "method", render: (v) => <Tag>{v}</Tag> },
    { title: "笔数", dataIndex: "count", align: "right" },
    { title: "金额", align: "right", render: (_, r) => yuan(r.amount_cents) },
  ];

  return (
    <Page title="营收统计" extra={<>
      <Input style={{ width: 120 }} value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-11" />
      <Button onClick={() => download(`/reports/arrears/export?period=${period}`, `arrears_${period}.csv`)}>导出欠费</Button>
      <Button onClick={() => download("/reports/ledger/export", "ledger.csv")}>导出收费台账</Button>
    </>}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} lg={4}><Card><Statistic title="应收" value={yuan(overview?.receivable_cents ?? 0)} /></Card></Col>
        <Col xs={12} lg={4}><Card><Statistic title="已收" value={yuan(overview?.collected_cents ?? 0)} /></Card></Col>
        <Col xs={12} lg={4}><Card><Statistic title="欠费" value={yuan(overview?.arrears_cents ?? 0)} /></Card></Col>
        <Col xs={12} lg={4}><Card><Statistic title="实收收入" value={yuan(ie?.income_cents ?? 0)} /></Card></Col>
        <Col xs={12} lg={4}><Card><Statistic title="物料支出" value={yuan(ie?.expense_cents ?? 0)} /></Card></Col>
        <Col xs={12} lg={4}><Card><Statistic title="净收益" value={yuan(ie?.net_cents ?? 0)} /></Card></Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card title="按费用类型">
            <Table rowKey="fee_type" size="small" columns={feeCols} dataSource={revenue?.by_fee_type ?? []} pagination={false} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="按支付方式">
            <Table rowKey="method" size="small" columns={methodCols} dataSource={revenue?.by_method ?? []} pagination={false} />
            <Typography.Text type="secondary" style={{ display: "block", marginTop: 12 }}>
              本期缴费 {ie?.payment_count ?? 0} 笔，采购入库 {ie?.purchase_count ?? 0} 笔。
            </Typography.Text>
          </Card>
        </Col>
      </Row>
    </Page>
  );
}

export function Arrears() {
  const [period, setPeriod] = useState(currentPeriod());
  const { data, loading } = useList<ArrearsBill>("/reports/arrears", { period });

  const columns: ColumnsType<ArrearsBill> = [
    { title: "账期", dataIndex: "period" },
    { title: "房屋", render: (_, b) => `${b.building_name} ${b.room_no}` },
    { title: "业主", render: (_, b) => b.owners.join("、") || "—" },
    { title: "费用", render: (_, b) => b.fee_item_name ?? FEE[b.fee_type] ?? b.fee_type },
    { title: "应收", align: "right", render: (_, b) => yuan(b.amount_cents) },
    { title: "滞纳金", align: "right", render: (_, b) => yuan(b.late_fee_cents) },
    { title: "已收", align: "right", render: (_, b) => yuan(b.paid_cents) },
    { title: "欠费", align: "right", render: (_, b) => yuan(b.balance_cents) },
    { title: "到期日", render: (_, b) => b.due_date ?? "—" },
  ];

  const total = data.reduce((s, b) => s + b.balance_cents, 0);

  return (
    <Page title="欠费台账" extra={<>
      <Input style={{ width: 120 }} value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-11" />
      <Button onClick={() => download(`/reports/arrears/export?period=${period}`, `arrears_${period}.csv`)}>导出</Button>
      <Typography.Text strong>欠费合计 {yuan(total)}</Typography.Text>
    </>}>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={{ pageSize: 20 }} />
    </Page>
  );
}
