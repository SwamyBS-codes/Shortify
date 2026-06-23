import AppNavbar from '../components/layout/AppNavbar'
import UrlShortener from '../components/UrlShortener'
import LinksTable from '../components/dashboard/LinksTable'
import LinkEditModal from '../components/dashboard/LinkEditModal'
import { useLinkWorkspace } from '../context/LinkWorkspaceContext'

function DashboardPage() {
  const { editModalLink } = useLinkWorkspace()

  return (
    <div className="page">
      <AppNavbar />
      <main>
        <UrlShortener />
        <div className="container section">
          <LinksTable />
        </div>
        {editModalLink && <LinkEditModal />}
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <p>© {new Date().getFullYear()} Shortify — Smart URL shortening</p>
        </div>
      </footer>
    </div>
  )
}

export default DashboardPage
