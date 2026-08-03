import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout";
import { AccountPage } from "@/pages/account";
import { EntriesPage } from "@/pages/entries";
import { KeysPage } from "@/pages/keys";
import { HomePage } from "@/pages/home";
import { LoginPage } from "@/pages/login";
import { LogsPage } from "@/pages/logs";
import { SetupPage } from "@/pages/setup";
import { SourcesPage } from "@/pages/sources";
import { UsersPage } from "@/pages/users";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route path="/admin" element={<SourcesPage />} />
        <Route path="/admin/setup" element={<SetupPage />} />
        <Route path="/admin/entries" element={<EntriesPage />} />
        <Route path="/admin/keys" element={<KeysPage />} />
        <Route path="/admin/logs" element={<LogsPage />} />
        <Route path="/admin/account" element={<AccountPage />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
