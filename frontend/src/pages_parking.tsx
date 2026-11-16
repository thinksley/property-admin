import { useState } from "react";
import { Button, Form, Input, Modal, Select, Space, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { api, errMsg, yuan, type ParkingRecord, type ParkingSpace } from "./api";
import { useAuth } from "./auth";
import { Page, useList } from "./pages";

export function ParkingRecords() {
  const { can } = useAuth();
  const [status, setStatus] = useState<string>();
  const [plate, setPlate] = useState<string>();
  const { data, loading, reload } = useList<ParkingRecord>("/parking-records", { status, plate_no: plate });
  const { data: spaces } = useList<ParkingSpace>("/parking-spaces");
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const entry = async () => {
    const v = await form.validateFields();
    try {
      await api.post("/parking-records", {
        ...v,
        entry_at: v.entry_at ? `${v.entry_at}:00` : undefined,
      });
      message.success("车辆已入场");
      setOpen(false);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };
  const exit = async (id: number) => {
    try {
      const { data: r } = await api.post(`/parking-records/${id}/exit`);
      message.success(`出场成功，应收 ${yuan(r.amount_cents)}`);
      reload();
    } catch (e) { message.error(errMsg(e)); }
  };

  const columns: ColumnsType<ParkingRecord> = [
    { title: "车牌号", dataIndex: "plate_no" },
    { title: "车位", render: (_, r) => r.space_code ?? "临停" },
    { title: "计费类型", render: (_, r) => r.billing_type === "monthly" ? <Tag color="blue">月卡</Tag> : <Tag>临停</Tag> },
    { title: "入场时间", dataIndex: "entry_at" },
    { title: "出场时间", render: (_, r) => r.exit_at ?? "—" },
    { title: "金额", align: "right", render: (_, r) => yuan(r.amount_cents) },
    { title: "状态", render: (_, r) => r.status === "in" ? <Tag color="green">在场</Tag> : <Tag>已出场</Tag> },
    {
      title: "操作", render: (_, r) => can("parking:write") && r.status === "in"
        ? <Button size="small" type="primary" onClick={() => exit(r.id)}>出场结算</Button> : null,
    },
  ];

  return (
    <Page title="停车管理" extra={can("parking:write") && <Button type="primary" onClick={() => setOpen(true)}>车辆入场</Button>}>
      <div className="toolbar">
        <Select allowClear placeholder="全部状态" style={{ width: 120 }} onChange={setStatus}
          options={[{ value: "in", label: "在场" }, { value: "out", label: "已出场" }]} />
        <Input.Search allowClear placeholder="车牌号" style={{ width: 180 }} onSearch={setPlate} />
      </div>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={{ pageSize: 20 }} />

      <Modal title="车辆入场" open={open} onOk={entry} onCancel={() => setOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ billing_type: "temp" }}>
          <Form.Item name="plate_no" label="车牌号" rules={[{ required: true }]}><Input placeholder="沪A12345" /></Form.Item>
          <Form.Item name="parking_space_id" label="固定车位">
            <Select allowClear showSearch optionFilterProp="label"
              options={spaces.filter((s) => s.space_type === "fixed")
                .map((s) => ({ value: s.id, label: `${s.code}${s.plate_no ? `（${s.plate_no}）` : ""}` }))} />
          </Form.Item>
          <Form.Item name="billing_type" label="计费类型">
            <Select options={[{ value: "temp", label: "临停" }, { value: "monthly", label: "月卡" }]} />
          </Form.Item>
          <Form.Item name="entry_at" label="入场时间">
            <Input placeholder="2026-11-13T09:00（留空为当前时间）" />
          </Form.Item>
        </Form>
      </Modal>
    </Page>
  );
}
