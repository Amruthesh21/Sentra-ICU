import { useAuth } from '../context/AuthContext';
import { isHospitalAdminUser } from '../utils/userRoles';

export default function ClinicalOrHospitalAdminRoute({ hospitalAdmin, clinical }) {
  const { user } = useAuth();
  if (isHospitalAdminUser(user)) return hospitalAdmin;
  return clinical;
}
