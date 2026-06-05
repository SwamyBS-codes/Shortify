function SkeletonLoader({ rows = 5 }) {
  return (
    <div className="skeleton-loader" aria-hidden="true">
      {/* Header shimmer */}
      <div className="skeleton-header">
        <div className="skeleton-line skeleton-line-short"></div>
      </div>

      {/* Rows */}
      <div className="skeleton-rows">
        {Array.from({ length: rows }).map((_, index) => (
          <div className="skeleton-row" key={index}>
            <div className="skeleton-cell skeleton-cell-check"></div>
            <div className="skeleton-cell skeleton-cell-url"></div>
            <div className="skeleton-cell skeleton-cell-tags"></div>
            <div className="skeleton-cell skeleton-cell-small"></div>
            <div className="skeleton-cell skeleton-cell-small"></div>
            <div className="skeleton-cell skeleton-cell-date"></div>
            <div className="skeleton-cell skeleton-cell-small"></div>
            <div className="skeleton-cell skeleton-cell-actions"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SkeletonLoader
