import { RouterProvider } from 'react-router';
import { router } from './routes';

export default function App() {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <RouterProvider router={router} />
    </div>
  );
}