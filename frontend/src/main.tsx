import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, type ThemeConfig } from "antd";
import zhCN from "antd/locale/zh_CN";
import App from "./App";
import { AuthProvider } from "./auth";
import "./index.css";

// 经典后台配色：深蓝灰侧栏 + 青绿主色 + 浅灰蓝内容区
const theme: ThemeConfig = {
  token: {
    colorPrimary: "#26a69a",
    borderRadius: 6,
    fontFamily: "'Noto Sans SC', 'IBM Plex Sans', system-ui, sans-serif",
    colorBgLayout: "#f0f2f5",
  },
  components: { Layout: { siderBg: "#304156", headerBg: "#ffffff" } },
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={theme}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>,
);
