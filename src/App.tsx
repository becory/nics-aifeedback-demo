import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { Layout } from './components/Layout'
import { GuestRoute, ProtectedRoute, TwoFactorRoute, AdminRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { Setup2FAPage } from './pages/Setup2FAPage'
import { Verify2FAPage } from './pages/Verify2FAPage'
import { ServicesPage } from './pages/ServicesPage'
import { UsersPage } from './pages/UsersPage'
import { ScoresPage } from './pages/ScoresPage'
import { AuditLogsPage } from './pages/AuditLogsPage'
import { ServiceListPage } from './pages/ServiceListPage'
import { SecuritySettingsPage } from './pages/SecuritySettingsPage'
import { FeedbackOverviewPage } from './pages/FeedbackOverviewPage'
import { ImportPage } from './pages/ImportPage'
import { TopProgressBar } from './components/TopProgressBar'

export default function App() {
  return (
    <AuthProvider>
      <TopProgressBar />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          <Route element={<TwoFactorRoute mode="setup" />}>
            <Route path="/2fa/setup" element={<Setup2FAPage />} />
          </Route>

          <Route element={<TwoFactorRoute mode="verify" />}>
            <Route path="/2fa/verify" element={<Verify2FAPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/feedback-overview" element={<FeedbackOverviewPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/my-services" element={<ServiceListPage />} />
              {/* Organizations now live inside the service pages (org ▸ services). */}
              <Route path="/my-organizations" element={<Navigate to="/my-services" replace />} />
              <Route path="/feedbacks" element={<Navigate to="/feedback-overview" replace />} />
              <Route path="/change-password" element={<Navigate to="/security-settings" replace />} />
              <Route path="/security-settings" element={<SecuritySettingsPage />} />
              <Route element={<AdminRoute />}>
                <Route path="/organizations" element={<Navigate to="/services" replace />} />
                <Route path="/services" element={<ServicesPage />} />
                {/* Agents are gone; keys are managed per organization on the services page. */}
                <Route path="/agents" element={<Navigate to="/services" replace />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/scores" element={<ScoresPage />} />
                <Route path="/audit-logs" element={<AuditLogsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
