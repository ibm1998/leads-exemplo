import Link from 'next/link';
import Head from 'next/head';
import firebase from '@/firebase-client';
import 'firebase/auth';

export default function Home({ data }) {
  return (
    <div className="container mx-auto p-4">
      <Head>
        <title>Sistema de Gestão de Leads Imobiliários</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <h1 className="text-3xl font-bold mb-6">Sistema de Gestão de Leads Imobiliários</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Agendamento de Visitas</h2>
          <p className="mb-4">Agende uma visita a um de nossos imóveis usando nosso sistema de calendário integrado.</p>
          <Link href="/schedule">
            <a className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded inline-block">
              Agendar Visita
            </a>
          </Link>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Dashboard de Leads</h2>
          <p className="mb-4">Visualize e gerencie todos os leads capturados pelo sistema.</p>
          <Link href="/leads">
            <a className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded inline-block">
              Ver Leads
            </a>
          </Link>
        </div>
      </div>
      
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Formulário de Contato</h2>
        <form className="space-y-4">
          <div>
            <label className="block mb-1">Nome</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 border border-gray-300 rounded" 
              placeholder="Seu nome completo"
            />
          </div>
          <div>
            <label className="block mb-1">Email</label>
            <input 
              type="email" 
              className="w-full px-3 py-2 border border-gray-300 rounded" 
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block mb-1">Telefone</label>
            <input 
              type="tel" 
              className="w-full px-3 py-2 border border-gray-300 rounded" 
              placeholder="(00) 00000-0000"
            />
          </div>
          <div>
            <label className="block mb-1">Mensagem</label>
            <textarea 
              className="w-full px-3 py-2 border border-gray-300 rounded" 
              rows="4"
              placeholder="Como podemos ajudar?"
            ></textarea>
          </div>
          <button 
            type="submit" 
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Enviar Mensagem
          </button>
        </form>
      </div>
    </div>
  );
}

export async function getStaticProps() {
  try {
    // Importa a função getDoc do módulo de funções admin do Firestore
    const { getDoc } = await import('@/FS-admin-functions');
    const data = await getDoc();
    
    return {
      props: { data: data || {} },
      revalidate: 60 // Revalidar a cada 60 segundos
    };
  } catch (error) {
    console.error('Erro ao buscar dados:', error);
    return {
      props: { data: {} },
      revalidate: 60
    };
  }
}