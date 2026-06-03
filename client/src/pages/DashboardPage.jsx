import HeroSection from '../components/HeroSection'
import LinkBuilderSection from '../components/LinkBuilderSection'
import MetricsRow from '../components/MetricsRow'
import TimelineSection from '../components/TimelineSection'

function DashboardPage() {
  return (
    <main className="app-shell">
      <HeroSection />
      {/* <MetricsRow /> */}
      <LinkBuilderSection />
      {/* <TimelineSection /> */}
    </main>
  )
}

export default DashboardPage
