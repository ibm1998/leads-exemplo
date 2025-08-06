import { useState, useEffect } from 'react';

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Simulating API call to get leads
    // In a real application, this would fetch from your API
    setTimeout(() => {
      setLeads([
        { id: 1, name: 'João Silva', email: 'joao.silva@example.com', phone: '(11) 98765-4321', status: 'new' },
        { id: 2, name: 'Maria Oliveira', email: 'maria.oliveira@example.com', phone: '(21) 91234-5678', status: 'contacted' },
        { id: 3, name: 'Carlos Santos', email: 'carlos.santos@example.com', phone: '(31) 99876-5432', status: 'qualified' },
        { id: 4, name: 'Ana Pereira', email: 'ana.pereira@example.com', phone: '(41) 98765-1234', status: 'new' }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) return <div className="p-4">Carregando leads...</div>;
  if (error) return <div className="p-4 text-red-500">Erro: {error}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Dashboard de Leads</h1>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">ID</th>
              <th className="py-2 px-4 border-b">Nome</th>
              <th className="py-2 px-4 border-b">Email</th>
              <th className="py-2 px-4 border-b">Telefone</th>
              <th className="py-2 px-4 border-b">Status</th>
              <th className="py-2 px-4 border-b">Ações</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td className="py-2 px-4 border-b">{lead.id}</td>
                <td className="py-2 px-4 border-b">{lead.name}</td>
                <td className="py-2 px-4 border-b">{lead.email}</td>
                <td className="py-2 px-4 border-b">{lead.phone}</td>
                <td className="py-2 px-4 border-b">
                  <span className={`px-2 py-1 rounded ${getStatusColor(lead.status)}`}>
                    {getStatusText(lead.status)}
                  </span>
                </td>
                <td className="py-2 px-4 border-b">
                  <button className="bg-blue-500 text-white px-3 py-1 rounded mr-2">
                    Ver
                  </button>
                  <button className="bg-green-500 text-white px-3 py-1 rounded">
                    Contatar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getStatusColor(status) {
  switch (status.toLowerCase()) {
    case 'new':
      return 'bg-blue-100 text-blue-800';
    case 'contacted':
      return 'bg-yellow-100 text-yellow-800';
    case 'qualified':
      return 'bg-green-100 text-green-800';
    case 'lost':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getStatusText(status) {
  switch (status.toLowerCase()) {
    case 'new':
      return 'Novo';
    case 'contacted':
      return 'Contatado';
    case 'qualified':
      return 'Qualificado';
    case 'lost':
      return 'Perdido';
    default:
      return status;
  }
}