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
    </Routes>
  )
}

export default App
