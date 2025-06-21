import { useEffect } from "react";

export default function WhatsAppPage() {
  useEffect(() => {
    // Redirect to the standalone WhatsApp interface
    window.location.href = "/whatsapp.html";
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Redirecionando para interface WhatsApp...</p>
      </div>
    </div>
  );
}