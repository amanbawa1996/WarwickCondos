import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function ErrorPage() {
  const error = useRouteError();

  let errorMessage = 'An unexpected error occurred';
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status;
    errorMessage = error.statusText || error.data?.message || errorMessage;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-heading text-6xl text-primary-foreground mb-4">
          {errorStatus}
        </h1>
        <p className="font-paragraph text-xl text-primary-foreground/80 mb-8">
          {errorMessage}
        </p>
        <Link to="/">
          <Button className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-paragraph">
            Go Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
