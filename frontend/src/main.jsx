import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import CreatePage from "./pages/CreatePage.jsx";
import DiscussionPage from "./pages/DiscussionPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <ConfigProvider locale={zhCN}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CreatePage />} />
        <Route path="/discussion/:id" element={<DiscussionPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  </ConfigProvider>
);
