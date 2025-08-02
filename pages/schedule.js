import { Cal } from 'calcom-react'; 

export default function Schedule() { 
  return <Cal url={process.env.NEXT_PUBLIC_CALCOM_URL} />; 
}