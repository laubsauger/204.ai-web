import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Work } from './pages/Work'
import { WorkDetail } from './pages/WorkDetail'
import { Services } from './pages/Services'
import { ServiceDetail } from './pages/ServiceDetail'
import { About } from './pages/About'
import { MakerDetail } from './pages/MakerDetail'
import { Contact } from './pages/Contact'
import { NotFound } from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/work" element={<Work />} />
        <Route path="/work/:slug" element={<WorkDetail />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services/:slug" element={<ServiceDetail />} />
        <Route path="/about" element={<About />} />
        <Route path="/makers/:slug" element={<MakerDetail />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
