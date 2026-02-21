import EmptyState from "@/components/EmptyState";

export default function NoPlanState() {
  return (
    <EmptyState
      title="No hay plan cargado"
      description="El admin debe importar y asignarte un plan."
    />
  );
}