import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Registration from './pages/Registration' 
import Account from './pages/Account'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/home" element={<Home />} />
      <Route path="/account" element={<Account />} />
      <Route path="/registration" element={<Registration />} />
      {/* Add more routes here as needed */}
    </Routes>
  )
}

export default App
