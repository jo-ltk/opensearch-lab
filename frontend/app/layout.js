import './globals.css';

export const metadata = {
  title: 'Monitoring Demo',
  description:
    'Live demo buttons for Node Exporter, Grafana dashboards, and Slack alerts.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
