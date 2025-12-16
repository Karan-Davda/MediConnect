import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Account from './pages/Account'
import Login from './pages/Login'
import PatientRegisterStep1 from './pages/PatientRegisterStep1'
import PatientRegisterStep2 from './pages/PatientRegisterStep2'
import ProviderRegister from './pages/ProviderRegister'
import BookAppointment from './pages/BookAppointment'
import FindDoctors from './pages/FindDoctors'
import AccessControl from './pages/AccessControl'
import ClinicOperations from './pages/ClinicOperations'
import MedicalRecords from './pages/MedicalRecords'
import Prescriptions from './pages/Prescriptions'
import Insurance from './pages/Insurance'
import ProcessPayments from './pages/ProcessPayments'
import Billing from './pages/Billing'
import BillingReportsPage from "./pages/BillingReportsPage";
import BillingAuditLogPage from "./pages/BillingAuditLogPage";
import CompleteProfile from './pages/CompleteProfile'
import ProtectedRoute from './components/ProtectedRoute'
import Messages from "./pages/Message";
import Claims from './pages/Claims'
import MarketingCampaigns from './pages/MarketingCampaigns'
import ManageAvailability from './pages/ManageAvailability'
import './App.css'

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register/patient/step1" element={<PatientRegisterStep1 />} />
      <Route path="/register/patient/step2" element={<PatientRegisterStep2 />} />
      <Route path="/register/provider" element={<ProviderRegister />} />

      {/* Protected Routes - Available to All Authenticated Users */}
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/home" 
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/account" 
        element={
          <ProtectedRoute>
            <Account />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/onboarding" 
        element={
          <ProtectedRoute requiredRole={['doctor', 'clinic_admin']}>
            <CompleteProfile />
          </ProtectedRoute>
        } 
      />

      {/* Patient-Only Routes */}
      <Route 
        path="/find-doctors" 
        element={
          <ProtectedRoute requiredRole="patient">
            <FindDoctors />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/book-appointment" 
        element={
          <ProtectedRoute requiredRole="patient">
            <BookAppointment />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/billing" 
        element={
          <ProtectedRoute requiredRole="patient">
            <Billing />
          </ProtectedRoute>
        } 
      />

      {/* Provider Routes (Doctors, Clinic Staff, Clinic Admins) */}
      <Route 
        path="/medical-records" 
        element={
          <ProtectedRoute requiredRole={['doctor', 'clinic_staff', 'clinic_admin']}>
            <MedicalRecords />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/prescriptions" 
        element={
          <ProtectedRoute requiredRole={['doctor', 'clinic_staff', 'clinic_admin']}>
            <Prescriptions />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/manage-availability" 
        element={
          <ProtectedRoute requiredRole={['doctor']}>
            <ManageAvailability />
          </ProtectedRoute>
        } 
      />

      {/* Clinic Admin Routes */}
      <Route 
        path="/clinic-operations" 
        element={
          <ProtectedRoute requiredRole="clinic_admin">
            <ClinicOperations />
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/access-control" 
        element={
          <ProtectedRoute requiredRole="clinic_admin">
            <AccessControl />
          </ProtectedRoute>
        } 
      />

      {/* Shared Routes (Patients and Providers) */}
      <Route 
        path="/insurance" 
        element={
          <ProtectedRoute requiredRole={['patient', 'doctor', 'clinic_staff', 'clinic_admin']}>
            <Insurance />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/process-payments" 
        element={
          <ProtectedRoute requiredRole={['patient', 'clinic_admin']}>
            <ProcessPayments />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/billing/reports" 
        element={
          <ProtectedRoute requiredRole={['clinic_admin', 'clinic_staff']}>
            <BillingReportsPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/audit-log/billing" 
        element={
          <ProtectedRoute requiredRole={['clinic_admin']}>
            <BillingAuditLogPage />
          </ProtectedRoute>
        } 
      />

      {/* Additional Routes from Dev */}
      <Route 
        path="/messages" 
        element={
          <ProtectedRoute>
            <Messages />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/claims" 
        element={
          <ProtectedRoute>
            <Claims />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/marketing-campaigns" 
        element={
          <ProtectedRoute>
            <MarketingCampaigns />
          </ProtectedRoute>
        } 
      />
    </Routes>
  )
}

export default App
