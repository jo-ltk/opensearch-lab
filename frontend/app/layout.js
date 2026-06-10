import './globals.css';

export const metadata = {
  title: 'Tech Store Observability Lab',
  description:
    'A demo tech store app that generates normal, slow, and failing requests to observe logs, metrics, dashboards, and alerts.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
