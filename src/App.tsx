import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { NotificationProvider } from './contexts/NotificationContext'
import { Toaster } from './components/ui/sonner'
import HomePage from './pages/HomePage'
import RepoPage from './pages/RepoPage'
import DocumentationPage from './pages/DocumentationPage'
import PackagePromptPage from './pages/PackagePromptPage'
import ReimplementPromptPage from './pages/ReimplementPromptPage'
import WikiPage from './pages/WikiPage'
import ProductDocsPage from './pages/ProductDocsPage'

function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/repo/:owner/:repo" element={<RepoPage />} />
          <Route path="/repo/:owner/:repo/documentation" element={<DocumentationPage />} />
          <Route path="/repo/:owner/:repo/package-prompt" element={<PackagePromptPage />} />
          <Route path="/repo/:owner/:repo/reimplement-prompt" element={<ReimplementPromptPage />} />
          <Route path="/repo/:owner/:repo/wiki/:type" element={<WikiPage />} />
          <Route path="/repo/:owner/:repo/product-docs" element={<ProductDocsPage />} />
        </Routes>
        <Toaster />
      </NotificationProvider>
    </BrowserRouter>
  )
}

export default App
