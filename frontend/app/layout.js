import './globals.css';

export const metadata = {
  title: 'Observability Lab',
  description: 'A tiny app that exists to be observed',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
