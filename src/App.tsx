import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { Layout } from './components/Layout'
import { GuestRoute, ProtectedRoute, TwoFactorRoute, AdminRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { Setup2FAPage } from './pages/Setup2FAPage'
import { Verify2FAPage } from './pages/Verify2FAPage'
import { OrganizationsPage } from './pages/OrganizationsPage'
import { ServicesPage } from './pages/ServicesPage'
import { UsersPage } from './pages/UsersPage'
import { OfflineKeysPage } from './pages/OfflineKeysPage'
import { ScoresPage } from './pages/ScoresPage'
import { ServiceListPage } from './pages/ServiceListPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { FeedbackOverviewPage } from './pages/FeedbackOverviewPage'

export default function App() {
  return (
    <AuthProvider>
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
              <Route path="/my-services" element={<ServiceListPage />} />
              <Route path="/feedbacks" element={<Navigate to="/feedback-overview" replace />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
              <Route element={<AdminRoute />}>
                <Route path="/organizations" element={<OrganizationsPage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/offline-keys" element={<OfflineKeysPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/scores" element={<ScoresPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
