import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, type ThemeConfig } from "antd";
import zhCN from "antd/locale/zh_CN";
import App from "./App";
import { AuthProvider } from "./auth";
import "./index.css";

// 主色取自楼宇门牌的深松绿，避免默认蓝色后台的模板感
const theme: ThemeConfig = {
  token: {
    colorPrimary: "#1e4d3b",
    borderRadius: 4,
    fontFamily: "'Noto Sans SC', 'IBM Plex Sans', system-ui, sans-serif",
    colorBgLayout: "#f3f2ee",
  },
  components: { Layout: { siderBg: "#16302a", headerBg: "#ffffff" } },
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
