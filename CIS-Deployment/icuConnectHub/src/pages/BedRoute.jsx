import { useParams } from 'react-router-dom';
import BedDetail from './BedDetail';

/** Always use live bed detail (vitals / clinical from Alarm Engine). */
export default function BedRoute() {
  useParams();
  return <BedDetail />;
}
