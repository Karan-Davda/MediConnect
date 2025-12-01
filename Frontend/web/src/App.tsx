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
import Claims from './pages/Claims'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/home" element={<Home />} />
      <Route path="/account" element={<Account />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register/patient/step1" element={<PatientRegisterStep1 />} />
      <Route path="/register/patient/step2" element={<PatientRegisterStep2 />} />
      <Route path="/register/provider" element={<ProviderRegister />} />
      <Route path="/book-appointment" element={<BookAppointment />} />
      <Route path="/find-doctors" element={<FindDoctors />} />
      <Route path="/access-control" element={<AccessControl />} />
      <Route path="/clinic-operations" element={<ClinicOperations />} />
      <Route path="/medical-records" element={<MedicalRecords />} />
      <Route path="/prescriptions" element={<Prescriptions />} />
      <Route path="/insurance" element={<Insurance />} />
      <Route path="/process-payments" element={<ProcessPayments />} />
      <Route path="/billing" element={<Billing />} />
      <Route path="/billing/reports" element={<BillingReportsPage />} />
      <Route path="/audit-log/billing" element={<BillingAuditLogPage />} />
      <Route path="/claims" element={<Claims />} />
    </Routes>
  )
}

export default App
