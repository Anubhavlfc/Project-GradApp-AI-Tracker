import { Link, Route, Routes } from 'react-router';
import { brand } from './config/brand';

function Landing() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold">{brand.tagline}</h1>
      <p className="mt-4 text-gray-600">{brand.description}</p>
      <Link className="mt-8 inline-block underline" to="/app">
        Open the app
      </Link>
    </main>
  );
}

function AppHome() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-4 text-gray-600">Coming soon.</p>
    </main>
  );
}

function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link className="mt-4 inline-block underline" to="/">
        Go home
      </Link>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<AppHome />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
