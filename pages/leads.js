import { useState, useEffect } from 'react';

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchLeads() {
      try {
        const response = await fetch('http://localhost:4000/api/leads');
        if (!response.ok) {
          throw new Error('Failed to fetch leads');
        }
        const data = await response.json();
        setLeads(data.leads);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }

    fetchLeads();
  }, []);

  if (loading) return <div className="container mx-auto p-4">Loading...</div>;
  if (error) return <div className="container mx-auto p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Leads Dashboard</h1>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">ID</th>
              <th className="py-2 px-4 border-b">Name</th>
              <th className="py-2 px-4 border-b">Email</th>
              <th className="py-2 px-4 border-b">Status</th>
              <th className="py-2 px-4 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td className="py-2 px-4 border-b">{lead.id}</td>
                <td className="py-2 px-4 border-b">{lead.name}</td>
                <td className="py-2 px-4 border-b">{lead.email}</td>
                <td className="py-2 px-4 border-b">
                  <span className={`px-2 py-1 rounded ${getStatusColor(lead.status)}`}>
                    {lead.status}
                  </span>
                </td>
                <td className="py-2 px-4 border-b">
                  <button className="bg-blue-500 text-white px-3 py-1 rounded mr-2">
                    View
                  </button>
                  <button className="bg-green-500 text-white px-3 py-1 rounded">
                    Contact
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