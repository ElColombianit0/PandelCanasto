export default function DashboardCard({ title, value, description, icon }) {
  return (
    <div className="dashboard-card">
      <div className="dashboard-card-icon">{icon}</div>

      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}