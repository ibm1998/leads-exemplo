import '../styles/globals.css';
import initAuth from '@/auth';

// Inicializa o Firebase
initAuth();

function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}

export default MyApp;