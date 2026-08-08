import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout";
import { AccountPage } from "@/pages/account";
import { EntriesPage } from "@/pages/entries";
import { KeysPage } from "@/pages/keys";
import { DownloadsPage } from "@/pages/downloads";
import { HomePage } from "@/pages/home";
import { LoginPage } from "@/pages/login";
import { LogsPage } from "@/pages/logs";
import { PlayersPage } from "@/pages/players";
import { SetupPage } from "@/pages/setup";
import { SourcesPage } from "@/pages/sources";
import { UsersPage } from "@/pages/users";
import { WzaKeysPage } from "@/pages/wza-keys";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/downloads" element={<DownloadsPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={<Layout />}>
        <Route index element={<SourcesPage />} />
        <Route path="players" element={<PlayersPage />} />
        <Route path="setup" element={<SetupPage />} />
        <Route path="entries" element={<EntriesPage />} />
        <Route path="keys" element={<KeysPage />} />
        <Route path="wza-keys" element={<WzaKeysPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
