import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
  children,
}: {
  path?: string;
  component?: () => React.JSX.Element;
  children?: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    const content = (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
    
    return path ? <Route path={path}>{content}</Route> : content;
  }

  if (!user) {
    const redirect = <Redirect to="/auth" />;
    return path ? <Route path={path}>{redirect}</Route> : redirect;
  }

  if (Component) {
    return path ? <Route path={path}><Component /></Route> : <Component />;
  }
  
  return children || null;
}
