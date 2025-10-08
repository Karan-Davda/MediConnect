import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/home" element={<Home />} />
      {/* Add more routes here as needed */}
    </Routes>
  )
}

export default App
