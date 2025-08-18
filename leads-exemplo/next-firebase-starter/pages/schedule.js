import { useEffect } from 'react';
import Head from 'next/head';

export default function Schedule() {
  useEffect(() => {
    // Carrega o script do Cal.com quando o componente é montado
    const script = document.createElement('script');
    script.src = 'https://cal.com/embed.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Remove o script quando o componente é desmontado
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="container mx-auto p-4">
      <Head>
        <title>Agendar Visita | Imobiliária</title>
      </Head>
      
      <h1 className="text-2xl font-bold mb-6">Agende sua Visita</h1>
      
      <div className="cal-embed-container mb-8">
        {/* Cal.com Embed */}
        <div 
          data-cal-link={process.env.NEXT_PUBLIC_CALCOM_URL || 'yourusername/30min'} 
          data-cal-config='{"layout":"month_view"}'
          style={{ width: '100%', height: '600px', overflow: 'hidden' }}
        />
      </div>
      
      <div className="bg-blue-50 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Informações Importantes</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Escolha o melhor horário para sua visita</li>
          <li>Nosso corretor entrará em contato para confirmar</li>
          <li>Tenha seus documentos em mãos no dia da visita</li>
          <li>Em caso de cancelamento, avise com pelo menos 2 horas de antecedência</li>
        </ul>
      </div>
    </div>
  );
}