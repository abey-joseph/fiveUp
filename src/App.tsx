import { Navigate, Route, Routes } from 'react-router-dom'
import TabBar from './components/TabBar.tsx'
import Today from './pages/Today.tsx'
import History from './pages/History.tsx'
import Stats from './pages/Stats.tsx'

export default function App() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 px-4 pt-4 pb-24">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/history" element={<History />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  )
}
