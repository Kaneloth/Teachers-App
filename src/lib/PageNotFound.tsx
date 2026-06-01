import { Link } from 'react-router-dom';

export default function PageNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
      <p className="text-xl font-semibold text-foreground mb-2">Page Not Found</p>
      <p className="text-muted-foreground mb-8">The page you're looking for doesn't exist.</p>
      <Link to="/" className="text-primary font-medium hover:underline">Go Home</Link>
    </div>
  );
}
