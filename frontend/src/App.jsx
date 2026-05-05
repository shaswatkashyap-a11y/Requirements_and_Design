import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Dashboard from './pages/Dashboard'
import RequirementStudio from './pages/RequirementStudio'
import SOWDetail from './pages/SOWDetail'
import GenerationProgress from './pages/GenerationProgress'
import GenerationResults from './pages/GenerationResults'
import PromptEditor from './pages/PromptEditor'

function Layout({ children }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/requirement-studio" element={<RequirementStudio />} />
          <Route path="/projects/:projectId/sow/:sowId" element={<SOWDetail />} />
          <Route path="/projects/:projectId/generations/:runId" element={<GenerationProgress />} />
          <Route path="/projects/:projectId/generations/:runId/results" element={<GenerationResults />} />
          <Route path="/projects/:projectId/prompts" element={<PromptEditor />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}