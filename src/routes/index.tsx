import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  useEffect(() => {
    window.location.replace("/index.html");
  }, []);
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui" }}>
      <p>جاري التحويل إلى التطبيق...</p>
    </div>
  );
}
