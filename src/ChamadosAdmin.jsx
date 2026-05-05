export default function ChamadosAdmin() {
  return (
    <div className="h-full w-full flex flex-col animate-in fade-in duration-700">
      <iframe
        src="http://192.168.0.253:3002/agente.html"
        className="flex-1 w-full border-0 rounded-[2rem]"
        title="Chamados"
        allow="fullscreen"
      />
    </div>
  );
}
